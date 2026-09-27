import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const fail = message => { console.error(`HARD_STOP: ${message}`); process.exit(2); };
const output = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const authorized = new Set(process.env.HARNESS_AUTHORIZED_OPERATIONS?.split(',').filter(Boolean) ?? []);
const operation = process.argv[2] ?? 'prepare_android_release';
const operations = ['prepare_android_release', 'build_android_release', 'adb_install_release', 'publish_android_release', 'register_android_release'];
if (!operations.includes(operation)) fail(`unknown release operation: ${operation}`);
if (!authorized.has(operation)) fail(`unauthorized operation: ${operation}`);
if (output(['branch', '--show-current']) !== 'main') fail('release must run on main');
if (output(['status', '--short'])) fail('working tree is not clean');
if (output(['rev-parse', 'HEAD']) !== output(['rev-parse', 'origin/main'])) fail('main is not origin/main');
const gradle = fs.readFileSync('mobile/orange-photos-sync-agent/app/build.gradle.kts', 'utf8');
if (!/applicationId\s*=\s*"com\.orangefamily\.photossync"/.test(gradle)) fail('unexpected applicationId');
const versionCode = gradle.match(/versionCode\s*=\s*(\d+)/)?.[1];
const versionName = gradle.match(/versionName\s*=\s*"([^"]+)"/)?.[1];
if (!versionCode || !versionName || Number(versionCode) <= 0) fail('invalid Android version');
const releaseUrl = process.env.ORANGEFAMILY_RELEASE_API_BASE_URL ?? '';
const keystoreFile = process.env.ORANGEFAMILY_KEYSTORE_FILE ?? '';
const keyAlias = process.env.ORANGEFAMILY_KEY_ALIAS ?? '';
if (operation === 'prepare_android_release' || operation === 'build_android_release') {
  if (!releaseUrl.startsWith('https://')) fail('release API must be HTTPS');
  if (!keystoreFile || !keyAlias) fail('release keystore configuration is incomplete');
  if (!fs.existsSync(keystoreFile)) fail('configured keystore file does not exist');
}
const apk = process.env.ORANGEFAMILY_APK_PATH;
if (apk) {
  if (!fs.existsSync(apk)) fail('APK file does not exist');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
  if (process.env.ORANGEFAMILY_EXPECTED_HASH && hash !== process.env.ORANGEFAMILY_EXPECTED_HASH.toLowerCase()) fail('APK hash mismatch');
  console.log(`APK SHA-256: ${hash}`);
}
if (process.env.ORANGEFAMILY_PUBLISHED_HASH && process.env.ORANGEFAMILY_LOCAL_HASH !== process.env.ORANGEFAMILY_PUBLISHED_HASH) fail('published hash mismatch');
console.log(`READY: ${operation} versionCode=${versionCode} versionName=${versionName}`);
