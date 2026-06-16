const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const {version} = require(path.join(projectRoot, 'package.json'));
const apkPath = path.join(
  projectRoot,
  'dist',
  `ZebraLabel-${version}-release.apk`,
);

function listConnectedDevices() {
  const result = spawnSync('adb', ['devices'], {encoding: 'utf8'});

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split('\n')
    .slice(1)
    .map(line => line.trim().split(/\s+/))
    .filter(([, state]) => state === 'device')
    .map(([serial]) => serial);
}

function installOnDevice(serial) {
  console.log(`Installing on ${serial}...`);

  const result = spawnSync('adb', ['-s', serial, 'install', '-r', apkPath], {
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    return false;
  }

  return result.status === 0;
}

if (!fs.existsSync(apkPath)) {
  console.error(`Release APK not found at ${apkPath}`);
  console.error('Run npm run build:apk first.');
  process.exit(1);
}

const devices = listConnectedDevices();

if (devices.length === 0) {
  console.error('No adb devices in "device" state. Connect a device or emulator.');
  process.exit(1);
}

let failed = 0;

for (const serial of devices) {
  if (!installOnDevice(serial)) {
    failed += 1;
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log(`Installed on ${devices.length} device(s).`);
