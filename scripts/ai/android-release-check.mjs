import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const fail = message => { console.error(`HARD_STOP: ${message}`); process.exit(2); };
const output = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const authorized = new Set(process.env.HARNESS_AUTHORIZED_OPERATIONS?.split(',').filter(Boolean) ?? []);
const operation = process.argv[2] ?? 'prepare_android_release';
if (['publish_android_release', 'register_android_release', 'adb_install_release'].includes(operation) && !authorized.has(operation)) fail(`unauthorized operation: ${operation}`);
if (output(['branch', '--show-current']) !== 'main') fail('release must run on main');
if (output(['status', '--short'])) fail('working tree is not clean');
if (output(['rev-parse', 'HEAD']) !== output(['rev-parse', 'origin/main'])) fail('main is not origin/main');
const gradle = fs.readFileSync('mobile/orange-photos-sync-agent/app/build.gradle.kts', 'utf8');
if (!/applicationId\s*=\s*"com\.orangefamily\.photossync"/.test(gradle)) fail('unexpected applicationId');
const versionCode = gradle.match(/versionCode\s*=\s*(\d+)/)?.[1];
const versionName = gradle.match(/versionName\s*=\s*"([^"]+)"/)?.[1];
if (!versionCode || !versionName || Number(versionCode) <= 0) fail('invalid Android version');
if (operation === 'prepare_android_release') console.log(`READY: versionCode=${versionCode} versionName=${versionName}`);
