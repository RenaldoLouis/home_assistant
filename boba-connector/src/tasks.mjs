import { FieldPath } from 'firebase-admin/firestore';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';

export class TaskError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const taskFields = {
  title: z.string().trim().min(1).max(500),
  targetDate: day,
  description: z.string().max(4000).default(''),
  scheduledTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
  sortOrder: z.number().int().min(0).max(1000000).default(0),
  parentId: id.nullable().default(null),
  estimatedTimeMins: z.number().int().min(1).max(10080).nullable().default(null),
};
export const createSchema = z.object({ requestId: id, task: z.object(taskFields).strict() }).strict();
export const getSchema = z.object({ taskId: id }).strict();
export const editSchema = z.object({
  requestId: id, taskId: id, expectedVersion: z.string().min(1).max(80),
  patch: z.object({
    title: taskFields.title.optional(), targetDate: day.optional(),
    description: z.string().max(4000).optional(),
    scheduledTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    sortOrder: z.number().int().min(0).max(1000000).optional(),
    parentId: id.nullable().optional(),
    estimatedTimeMins: z.number().int().min(1).max(10080).nullable().optional(),
    isCompleted: z.boolean().optional(),
  }).strict().refine(value => Object.keys(value).length > 0),
}).strict();
export const operationSchema = z.object({ requestId: id }).strict();
export const deleteSchema = z.object({
  requestId: id, taskId: id, confirmationToken: z.string().regex(/^[a-f0-9]{64}$/),
  affectedTaskIds: z.array(id).min(1).max(100), confirmed: z.literal(true),
}).strict();
const key = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(field => [field, canonical(value[field])]));
  return value;
}
export const listSchema = z.object({
  query: z.string().trim().max(200).optional(),
  targetDate: day.optional(),
  cursor: id.optional(),
  limit: z.number().int().min(1).max(100).default(50),
}).strict();

export function input(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new TaskError('invalid_request', 'Check the task identifiers, dates, and supported fields.');
  return result.data;
}

function view(snapshot) {
  const data = snapshot.data();
  const task = { id: snapshot.id, version: `${snapshot.updateTime.seconds}.${snapshot.updateTime.nanoseconds}` };
  for (const field of ['title', 'description', 'targetDate', 'scheduledTime', 'sortOrder', 'createdAt', 'completedAt', 'isCompleted', 'parentId', 'estimatedTimeMins', 'assistantRevision', 'phoneAppliedRevision']) {
    if (data[field] !== undefined) task[field] = data[field];
  }
  return task;
}

export class TaskService {
  constructor({ db, ownerUid, timeZone = 'Asia/Jakarta', resetHour = 4 }) {
    Object.assign(this, { db, ownerUid, timeZone, resetHour });
  }
  async assertOwner(uid, transaction) {
    const ref = this.db.doc(`personalTaskOwners/${this.ownerUid}`);
    if (uid !== this.ownerUid || !(await (transaction ? transaction.get(ref) : ref.get())).exists) {
      throw new TaskError('access_denied', 'This connection is not authorized for personal Boba tasks.');
    }
  }
  collection() { return this.db.collection(`users/${this.ownerUid}/tasks`); }
  async get(uid, raw) {
    await this.assertOwner(uid);
    const { taskId } = input(getSchema, raw);
    const snapshot = await this.collection().doc(taskId).get();
    if (!snapshot.exists || snapshot.data().deleted === true) throw new TaskError('not_found', 'That active task was not found.');
    return { task: view(snapshot), timeZone: this.timeZone };
  }
  async mutate(uid, action, args, perform) {
    const ref = this.db.doc(`bobaConnectorOperations/${key([this.ownerUid, args.requestId])}`);
    const fingerprint = key(canonical({ action, args }));
    await this.db.runTransaction(async transaction => {
      await this.assertOwner(uid, transaction);
      const previous = await transaction.get(ref);
      if (previous.exists) {
        if (previous.data().fingerprint !== fingerprint) throw new TaskError('request_reused', 'This request ID was already used for another operation.');
        return;
      }
      const revision = `assistant_${key([this.ownerUid, args.requestId])}`;
      const taskIds = await perform(transaction, revision, new Date().toISOString());
      transaction.create(ref, { ownerUid: this.ownerUid, requestId: args.requestId, action, fingerprint, revision, taskIds });
    });
    return this.operation(uid, { requestId: args.requestId });
  }
  async create(uid, raw) {
    const args = input(createSchema, raw);
    return this.mutate(uid, 'create', args, async (transaction, revision, now) => {
      const taskId = key(['task', this.ownerUid, args.requestId]);
      const ref = this.collection().doc(taskId);
      if ((await transaction.get(ref)).exists) throw new TaskError('conflict', 'That task identifier already exists.');
      if (args.task.parentId) {
        const parent = await transaction.get(this.collection().doc(args.task.parentId));
        if (!parent.exists || parent.data().deleted === true || parent.data().parentId) {
          throw new TaskError('invalid_parent', 'Choose an active top-level parent; Boba supports one child level.');
        }
      }
      transaction.create(ref, { ...args.task, id: taskId, date: args.task.targetDate, createdAt: now, isCompleted: false, completedAt: null, deleted: false, assistantRevision: revision });
      return [taskId];
    });
  }
  async edit(uid, raw) {
    const args = input(editSchema, raw);
    return this.mutate(uid, 'edit', args, async (transaction, revision, now) => {
      const ref = this.collection().doc(args.taskId);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists || snapshot.data().deleted === true) throw new TaskError('not_found', 'That active task was not found.');
      if (view(snapshot).version !== args.expectedVersion) throw new TaskError('conflict', 'The task changed. Retrieve it again before editing.');
      if (args.patch.parentId) {
        const parent = await transaction.get(this.collection().doc(args.patch.parentId));
        const children = await transaction.get(this.collection().where('parentId', '==', args.taskId));
        if (args.patch.parentId === args.taskId || !parent.exists || parent.data().deleted === true || parent.data().parentId || children.docs.some(child => child.data().deleted !== true)) {
          throw new TaskError('invalid_parent', 'Choose an active top-level parent without creating a cycle or grandchildren.');
        }
      }
      const patch = { ...args.patch, assistantRevision: revision };
      if (patch.targetDate !== undefined) patch.date = patch.targetDate;
      if (patch.isCompleted !== undefined) patch.completedAt = patch.isCompleted ? now : null;
      transaction.update(ref, patch);
      return [args.taskId];
    });
  }
  async deletionTargets(transaction, taskId) {
    const target = await transaction.get(this.collection().doc(taskId));
    if (!target.exists || target.data().deleted === true) throw new TaskError('not_found', 'That active task was not found.');
    const children = await transaction.get(this.collection().where('parentId', '==', taskId));
    const active = children.docs.filter(child => child.data().deleted !== true);
    if (active.length > 99) throw new TaskError('too_many_children', 'This parent requires a separate review before deletion.');
    return [target, ...active].sort((a, b) => a.id.localeCompare(b.id));
  }
  async previewDelete(uid, raw) {
    const { taskId } = input(getSchema, raw);
    const confirmationToken = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const targets = await this.db.runTransaction(async transaction => {
      await this.assertOwner(uid, transaction);
      const targets = (await this.deletionTargets(transaction, taskId)).map(view);
      transaction.create(this.db.doc(`bobaConnectorDeletePlans/${key(confirmationToken)}`), {
        ownerUid: this.ownerUid, taskId, expiresAt,
        targets: targets.map(({ id, version }) => ({ id, version })),
      });
      return targets;
    });
    return { taskId, targets, confirmationToken, expiresAt: new Date(expiresAt).toISOString(), message: 'Confirm these exact task IDs and all affected children with the user before deleting.' };
  }
  async delete(uid, raw) {
    const args = input(deleteSchema, raw);
    return this.mutate(uid, 'delete', args, async (transaction, revision, now) => {
      const plan = (await transaction.get(this.db.doc(`bobaConnectorDeletePlans/${key(args.confirmationToken)}`))).data();
      if (!plan || plan.ownerUid !== this.ownerUid || plan.taskId !== args.taskId || plan.expiresAt <= Date.now()) {
        throw new TaskError('confirmation_expired', 'Retrieve a new deletion preview and confirm it with the user.');
      }
      const targets = await this.deletionTargets(transaction, args.taskId);
      const current = targets.map(snapshot => ({ id: snapshot.id, version: view(snapshot).version }));
      if (JSON.stringify(current) !== JSON.stringify(plan.targets) || JSON.stringify(args.affectedTaskIds.slice().sort()) !== JSON.stringify(current.map(task => task.id).sort())) {
        throw new TaskError('confirmation_changed', 'The task or affected children changed. Retrieve a new preview and confirm it again.');
      }
      for (const target of targets) transaction.update(target.ref, { deleted: true, deletedAt: now, assistantRevision: revision });
      return targets.map(target => target.id);
    });
  }
  async operation(uid, raw) {
    await this.assertOwner(uid);
    const { requestId } = input(operationSchema, raw);
    const receipt = await this.db.doc(`bobaConnectorOperations/${key([this.ownerUid, requestId])}`).get();
    if (!receipt.exists) throw new TaskError('not_found', 'No saved operation was found for that request ID.');
    const { revision, taskIds } = receipt.data();
    const snapshots = await this.db.getAll(...taskIds.map(taskId => this.collection().doc(taskId)));
    const states = snapshots.map(snapshot => !snapshot.exists ? 'failed' : snapshot.data().assistantRevision !== revision ? 'superseded' : snapshot.data().phoneAppliedRevision === revision ? 'applied' : 'pending');
    const status = states.includes('failed') ? 'failed' : states.includes('superseded') ? 'superseded' : states.every(state => state === 'applied') ? 'applied' : 'pending';
    const messages = {
      applied: 'The phone confirmed this exact revision was applied.',
      pending: 'Saved to the cloud mirror; waiting for Boba on the phone to apply this revision.',
      superseded: 'This saved operation has since been replaced. It was not applied again.',
      failed: 'The cloud operation was saved, but a task record is now missing; phone application cannot be confirmed.',
    };
    return { requestId, assistantRevision: revision, taskIds, cloudSaved: true, status, message: messages[status] };
  }
  async list(uid, raw = {}) {
    await this.assertOwner(uid);
    const args = input(listSchema, raw);
    let query = this.collection().orderBy(FieldPath.documentId()).limit(args.limit);
    if (args.cursor) query = query.startAfter(args.cursor);
    const page = await query.get();
    return {
      tasks: page.docs.filter(doc => doc.data().deleted !== true)
        .filter(doc => !args.targetDate || doc.data().targetDate === args.targetDate)
        .filter(doc => !args.query || String(doc.data().title ?? '').toLowerCase().includes(args.query.toLowerCase()))
        .map(view),
      nextCursor: page.size === args.limit ? page.docs.at(-1).id : null,
      timeZone: this.timeZone,
      coverage: 'Synced cloud tasks only. Offline phone changes may be missing; continue with nextCursor for further matches.',
    };
  }
}
