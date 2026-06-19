const {execSync} = require('child_process');

const device = process.env.ANDROID_SERIAL || 'emulator-5554';
const packageName = 'com.zebralabel';
const owlArgs = process.argv.slice(2);

execSync(`adb -s ${device} shell pm clear ${packageName}`, {
  stdio: 'inherit',
});

execSync(`npx owl test --platform android ${owlArgs.join(' ')}`, {
  stdio: 'inherit',
  env: {
    ...process.env,
    ANDROID_SERIAL: device,
  },
});
