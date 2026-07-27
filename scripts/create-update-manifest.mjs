import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const valueFor = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const apkArg = valueFor('--apk');
const versionCode = Number(valueFor('--version-code'));
const notes = valueFor('--notes') || '';
const outputArg = valueFor('--output');

if (!apkArg || !Number.isSafeInteger(versionCode) || versionCode <= 0) {
  throw new Error(
    '用法：npm run release:manifest -- --apk /path/IdeaPocket-v0.5.0.apk --version-code 3 [--notes "更新说明"]'
  );
}

const projectRoot = path.resolve(import.meta.dirname, '..');
const appConfig = JSON.parse(await readFile(path.join(projectRoot, 'app.json'), 'utf8'));
const versionName = String(appConfig?.expo?.version || '').trim();
if (!versionName) throw new Error('app.json 缺少 expo.version');
const runtimePolicy = appConfig?.expo?.runtimeVersion?.policy;
if (runtimePolicy !== 'appVersion') throw new Error('发布前必须使用 appVersion runtime policy');

const apkPath = path.resolve(apkArg);
const apkName = path.basename(apkPath);
if (!/^[A-Za-z0-9._-]+\.apk$/.test(apkName)) throw new Error('APK 文件名必须安全且以 .apk 结尾');
const bytes = await readFile(apkPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const tag = valueFor('--tag') || `v${versionName}`;
const encodedTag = encodeURIComponent(tag);
const encodedName = encodeURIComponent(apkName);
const manifest = {
  schemaVersion: 1,
  versionName,
  versionCode,
  runtimeVersion: versionName,
  apkUrl: `https://github.com/jieqinghua/IdeaPocket/releases/download/${encodedTag}/${encodedName}`,
  sha256,
  releaseNotes: notes,
  publishedAt: new Date().toISOString(),
};

const outputPath = path.resolve(outputArg || path.join(path.dirname(apkPath), 'update.json'));
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'w' });
process.stdout.write(`${outputPath}\nSHA-256 ${sha256}\n`);
