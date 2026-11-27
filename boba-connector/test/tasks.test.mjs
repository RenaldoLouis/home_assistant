import { beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { db, ownerUid, reset } from './helpers.mjs';
import { TaskService } from '../src/tasks.mjs';

const tasks = new TaskService({ db, ownerUid });
beforeEach(reset);
after(() => db.terminate());

test('task retrieval rejects anyone other than the configured, allowlisted owner', async () => {
  await assert.rejects(tasks.list('another-owner', {}), { code: 'access_denied' });
  await assert.rejects(tasks.list(ownerUid, {}), { code: 'access_denied' });
});

test('creating a task saves one cloud record and stays pending until the exact phone revision matches', async () => {
  await db.doc(`personalTaskOwners/${ownerUid}`).set({});
  const args = { requestId: 'create-one', task: { title: 'Buy tea', targetDate: '2026-11-26' } };
  const created = await tasks.create(ownerUid, args);
  assert.equal(created.status, 'pending');
  assert.equal(created.cloudSaved, true);
  const found = await tasks.list(ownerUid, {});
  assert.equal(found.tasks.length, 1);
  assert.equal(found.tasks[0].title, 'Buy tea');
  const ref = db.doc(`users/${ownerUid}/tasks/${created.taskIds[0]}`);
  assert.equal((await ref.get()).data().date, '2026-11-26');
  await tasks.create(ownerUid, args);
  assert.equal((await tasks.list(ownerUid, {})).tasks.length, 1);
  await ref.update({ phoneAppliedRevision: 'older-revision' });
  assert.equal((await tasks.operation(ownerUid, { requestId: 'create-one' })).status, 'pending');
  await ref.update({ phoneAppliedRevision: created.assistantRevision });
  assert.equal((await tasks.operation(ownerUid, { requestId: 'create-one' })).status, 'applied');
});

test('edits preserve unrelated fields, reject stale versions, and never replay an old edit over a newer one', async () => {
  await db.doc(`personalTaskOwners/${ownerUid}`).set({});
  const created = await tasks.create(ownerUid, { requestId: 'seed', task: { title: 'Tea', targetDate: '2026-11-26' } });
  const taskId = created.taskIds[0];
  const ref = db.doc(`users/${ownerUid}/tasks/${taskId}`);
  await ref.update({ phoneOnlyField: 'keep' });
  const original = (await tasks.list(ownerUid, {})).tasks[0];
  const edit = { requestId: 'edit-one', taskId, expectedVersion: original.version, patch: { title: 'Green tea', targetDate: '2026-11-27', isCompleted: true } };
  await tasks.edit(ownerUid, edit);
  const saved = (await ref.get()).data();
  assert.equal(saved.title, 'Green tea');
  assert.equal(saved.date, '2026-11-27');
  assert.equal(saved.phoneOnlyField, 'keep');
  assert.equal(saved.isCompleted, true);
  assert.ok(saved.completedAt);
  await assert.rejects(tasks.edit(ownerUid, { ...edit, requestId: 'stale' }), { code: 'conflict' });
  const latest = (await tasks.list(ownerUid, {})).tasks[0];
  await tasks.edit(ownerUid, { requestId: 'edit-two', taskId, expectedVersion: latest.version, patch: { title: 'Black tea' } });
  assert.equal((await tasks.edit(ownerUid, edit)).status, 'superseded');
  assert.equal((await ref.get()).data().title, 'Black tea');
});

test('deletion requires an exact preview and soft-deletes the confirmed parent and children for offline catch-up', async () => {
  await db.doc(`personalTaskOwners/${ownerUid}`).set({});
  const parent = await tasks.create(ownerUid, { requestId: 'parent', task: { title: 'Shopping', targetDate: '2026-11-26' } });
  const child = await tasks.create(ownerUid, { requestId: 'child', task: { title: 'Tea', targetDate: '2026-11-26', parentId: parent.taskIds[0] } });
  const preview = await tasks.previewDelete(ownerUid, { taskId: parent.taskIds[0] });
  assert.deepEqual(preview.targets.map(task => task.id).sort(), [...parent.taskIds, ...child.taskIds].sort());
  const args = { requestId: 'delete-family', taskId: parent.taskIds[0], confirmationToken: preview.confirmationToken, affectedTaskIds: preview.targets.map(task => task.id), confirmed: true };
  await assert.rejects(tasks.delete(ownerUid, { ...args, affectedTaskIds: parent.taskIds }), { code: 'confirmation_changed' });
  const deleted = await tasks.delete(ownerUid, args);
  assert.equal(deleted.status, 'pending');
  assert.equal((await tasks.list(ownerUid, {})).tasks.length, 0);
  for (const taskId of deleted.taskIds) {
    const snapshot = await db.doc(`users/${ownerUid}/tasks/${taskId}`).get();
    assert.equal(snapshot.exists, true);
    assert.equal(snapshot.data().deleted, true);
  }
  await db.doc(`users/${ownerUid}/tasks/${parent.taskIds[0]}`).update({ phoneAppliedRevision: deleted.assistantRevision });
  assert.equal((await tasks.operation(ownerUid, { requestId: args.requestId })).status, 'pending');
  await db.doc(`users/${ownerUid}/tasks/${child.taskIds[0]}`).update({ phoneAppliedRevision: deleted.assistantRevision });
  assert.equal((await tasks.delete(ownerUid, args)).status, 'applied');
});
