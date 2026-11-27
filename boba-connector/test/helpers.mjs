import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host ?? '') || process.env.GCLOUD_PROJECT !== 'demo-jarvis-boba') {
  throw new Error('Tests require the isolated demo Firestore emulator. Use npm test.');
}
export const db = getFirestore(initializeApp({ projectId: 'demo-jarvis-boba' }));
export const ownerUid = 'verified-founder';
export async function reset() {
  const result = await fetch(`http://${host}/emulator/v1/projects/demo-jarvis-boba/databases/(default)/documents`, { method: 'DELETE' });
  if (!result.ok) throw new Error('Unable to reset test-only database');
}
