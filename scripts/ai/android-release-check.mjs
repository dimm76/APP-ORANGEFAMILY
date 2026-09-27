import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export const RELEASE_OPERATIONS = ['prepare_android_release', 'build_android_release', 'adb_install_release', 'publish_android_release', 'register_android_release'];
export function normalizeHash(value) { return String(value ?? '').trim().toLowerCase(); }
export function compareHashes(localHash, publishedHash) {
  if (!localHash || !publishedHash) return { status: 'BLOCKED', reason: 'both hashes are required' };
  return normalizeHash(localHash) === normalizeHash(publishedHash) ? { status: 'PASS' } : { status: 'HARD_STOP', reason: 'published hash mismatch' };
}
export function validatePreflight({ branch, clean, head, originMain, gradle }) {
  if (branch !== 'main') return 'release must run on main';
  if (!clean) return 'working tree is not clean';
  if (head !== originMain) return 'main is not origin/main';
  if (!/applicationId\s*=\s*"com\.orangefamily\.photossync"/.test(gradle)) return 'unexpected applicationId';
  const versionCode = gradle.match(/versionCode\s*=\s*(\d+)/)?.[1];
  const versionName = gradle.match(/versionName\s*=\s*"([^"]+)"/)?.[1];
  if (!versionCode || Number(versionCode) <= 0) return 'invalid Android versionCode';
  if (!versionName) return 'missing Android versionName';
  return null;
}
export function apkHash(file) {
  if (!fs.existsSync(file)) return { status: 'HARD_STOP', reason: 'APK file does not exist' };
  return { status: 'PASS', hash: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
}
export function inspectApk({ apk, expectedPackage, expectedVersionCode, expectedVersionName, apkanalyzer, apksigner }) {
  const hash = apkHash(apk);
  if (hash.status !== 'PASS') return hash;
  if (!apkanalyzer || !fs.existsSync(apkanalyzer) || !apksigner || !fs.existsSync(apksigner)) return { status: 'BLOCKED', reason: 'Android APK inspection tools unavailable' };
  const dump = args => execFileSync(apkanalyzer, args, { encoding: 'utf8' });
  const packageName = dump(['manifest', 'application-id', apk]).trim();
  const versionCode = dump(['manifest', 'version-code', apk]).trim();
  const versionName = dump(['manifest', 'version-name', apk]).trim();
  if (packageName !== expectedPackage || versionCode !== String(expectedVersionCode) || versionName !== expectedVersionName) return { status: 'HARD_STOP', reason: 'APK metadata mismatch' };
  execFileSync(apksigner, ['verify', '--print-certs', apk], { stdio: 'ignore' });
  return { status: 'PASS', hash: hash.hash, packageName, versionCode, versionName, signed: true };
}
function main() {
  const fail = message => { console.error(`HARD_STOP: ${message}`); process.exit(2); };
  const operation = process.argv[2] ?? 'prepare_android_release';
  const authorized = new Set(process.env.HARNESS_AUTHORIZED_OPERATIONS?.split(',').filter(Boolean) ?? []);
  if (!RELEASE_OPERATIONS.includes(operation)) fail(`unknown release operation: ${operation}`);
  if (!authorized.has(operation)) fail(`unauthorized operation: ${operation}`);
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const gradle = fs.readFileSync('mobile/orange-photos-sync-agent/app/build.gradle.kts', 'utf8');
  const preflightError = validatePreflight({ branch: git(['branch', '--show-current']), clean: !git(['status', '--short']), head: git(['rev-parse', 'HEAD']), originMain: git(['rev-parse', 'origin/main']), gradle });
  if (preflightError) fail(preflightError);
  if (operation === 'prepare_android_release' || operation === 'build_android_release') {
    if (!(process.env.ORANGEFAMILY_RELEASE_API_BASE_URL ?? '').startsWith('https://')) fail('release API must be HTTPS');
    if (!process.env.ORANGEFAMILY_KEYSTORE_FILE || !process.env.ORANGEFAMILY_KEY_ALIAS) fail('release keystore configuration is incomplete');
    if (!fs.existsSync(process.env.ORANGEFAMILY_KEYSTORE_FILE)) fail('configured keystore file does not exist');
  }
  if (process.env.ORANGEFAMILY_APK_PATH) {
    const result = inspectApk({ apk: process.env.ORANGEFAMILY_APK_PATH, expectedPackage: 'com.orangefamily.photossync', expectedVersionCode: process.env.ORANGEFAMILY_EXPECTED_VERSION_CODE, expectedVersionName: process.env.ORANGEFAMILY_EXPECTED_VERSION_NAME, apkanalyzer: process.env.ORANGEFAMILY_APKANALYZER, apksigner: process.env.ORANGEFAMILY_APKSIGNER });
    if (result.status !== 'PASS') fail(result.reason);
    if (process.env.ORANGEFAMILY_EXPECTED_HASH && normalizeHash(result.hash) !== normalizeHash(process.env.ORANGEFAMILY_EXPECTED_HASH)) fail('APK hash mismatch');
    console.log(`APK SHA-256: ${result.hash}`);
  }
  if (process.env.ORANGEFAMILY_PUBLISHED_HASH) { const result = compareHashes(process.env.ORANGEFAMILY_LOCAL_HASH, process.env.ORANGEFAMILY_PUBLISHED_HASH); if (result.status !== 'PASS') fail(result.reason); }
  console.log(`READY: ${operation}`);
}
if (process.argv[1]?.endsWith('android-release-check.mjs')) main();
