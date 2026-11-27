import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, openSync, closeSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';

const jar = process.env.FIRESTORE_EMULATOR_JAR ?? join(homedir(), '.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar');
if (!existsSync(jar)) throw new Error('Set FIRESTORE_EMULATOR_JAR to the official Firestore emulator JAR.');
const reservation = createServer();
await new Promise(resolveListen => reservation.listen(0, '127.0.0.1', resolveListen));
const port = reservation.address().port;
await new Promise(resolveClose => reservation.close(resolveClose));
const directory = mkdtempSync(join(tmpdir(), 'jarvis-boba-test-'));
const log = openSync(join(directory, 'emulator.log'), 'w');
const emulator = spawn('java', ['-jar', jar, '--host=127.0.0.1', `--port=${port}`, '--project_id=demo-jarvis-boba', `--rules=${resolve('../JarvisAssistant/firestore.rules')}`], { stdio: ['ignore', log, log] });
closeSync(log);
const stop = () => emulator.kill('SIGTERM');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  let ready = false;
  for (let attempt = 0; attempt < 160; attempt++) {
    if (emulator.exitCode !== null) break;
    try { await fetch(`http://127.0.0.1:${port}/`); ready = true; break; } catch { await setTimeout(100); }
  }
  if (!ready) throw new Error(`Emulator did not start; diagnostics: ${directory}/emulator.log`);
  const tests = spawn(process.execPath, ['--test', '--test-concurrency=1', ...(process.argv.length > 2 ? process.argv.slice(2) : ['test/*.test.mjs'])], {
    stdio: 'inherit', env: { ...process.env, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}`, GCLOUD_PROJECT: 'demo-jarvis-boba' },
  });
  process.exitCode = await new Promise(resolveExit => tests.once('exit', code => resolveExit(code ?? 1)));
} finally { stop(); }
