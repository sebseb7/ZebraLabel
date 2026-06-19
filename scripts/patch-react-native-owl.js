/**
 * react-native-owl's Android build.gradle still references jcenter(), which
 * Gradle 9 removed. Re-apply this patch after every npm install.
 */
const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-owl',
  'native',
  'android',
  'build.gradle',
);

if (!fs.existsSync(buildGradlePath)) {
  process.exit(0);
}

let source = fs.readFileSync(buildGradlePath, 'utf8');
const patched = source
  .replace(/\n\s*jcenter\(\)/g, '')
  .replace(
    'android {',
    "android {\n    namespace \"com.formidable.reactnativeowl\"",
  )
  .replace(
    'implementation "com.facebook.react:react-native:+"  // From node_modules',
    'implementation("com.facebook.react:react-android")',
  );

if (source !== patched) {
  fs.writeFileSync(buildGradlePath, patched);
  console.log('patched react-native-owl Android build.gradle');
}
