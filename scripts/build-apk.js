const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const androidDir = path.join(projectRoot, 'android');
const isWindows = process.platform === 'win32';
const gradlew = isWindows ? 'gradlew.bat' : './gradlew';
const releaseApk = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
);

function runGradleAssembleRelease() {
  console.log('Building release APK...');

  const result = spawnSync(gradlew, ['assembleRelease'], {
    cwd: androidDir,
    stdio: 'inherit',
    shell: isWindows,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyApkToDist() {
  if (!fs.existsSync(releaseApk)) {
    console.error(`Release APK not found at ${releaseApk}`);
    process.exit(1);
  }

  const {version} = require(path.join(projectRoot, 'package.json'));
  const distDir = path.join(projectRoot, 'dist');
  const outputApk = path.join(distDir, `ZebraLabel-${version}-release.apk`);

  fs.mkdirSync(distDir, {recursive: true});
  fs.copyFileSync(releaseApk, outputApk);

  const sizeMb = (fs.statSync(outputApk).size / (1024 * 1024)).toFixed(1);
  console.log(`\nAPK ready: ${outputApk} (${sizeMb} MB)\n`);
}

runGradleAssembleRelease();
copyApkToDist();
