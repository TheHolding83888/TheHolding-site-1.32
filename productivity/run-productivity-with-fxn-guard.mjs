#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';

function run(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}`);
}

try {
  run('productivity-engine.mjs');
  run('fxn-locker-apr-guard.mjs');
} catch (error) {
  console.error(error?.stack || error);
  process.exit(1);
}
