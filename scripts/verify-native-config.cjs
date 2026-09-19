const fs = require('node:fs');
const assert = require('node:assert/strict');
const app = require('../app.json').expo;
const gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
const strings = fs.readFileSync('android/app/src/main/res/values/strings.xml', 'utf8');
const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const properties = fs.readFileSync('android/gradle.properties', 'utf8');
assert.ok(gradle.includes(`versionName "${app.version}"`), 'native app version matches config');
assert.ok(strings.includes(`>${app.runtimeVersion}<`), 'native update runtime matches config');
assert.ok(manifest.includes('android:allowBackup="false"'), 'Android automatic backup is disabled');
for (const permission of [
  'RECORD_AUDIO',
  'SYSTEM_ALERT_WINDOW',
  'READ_EXTERNAL_STORAGE',
  'WRITE_EXTERNAL_STORAGE',
])
  assert.ok(
    manifest.includes(`android:name="android.permission.${permission}" tools:node="remove"`),
    `${permission} removed`
  );
assert.ok(
  !/android:screenOrientation\s*=/.test(manifest),
  'no orientation lock in the manifest (Android 16 ignores it on large screens)'
);
assert.equal(app.orientation, 'default', 'app config does not re-add an orientation lock');
assert.ok(
  manifest.includes('GmsBarcodeScanningDelegateActivity" tools:remove="android:screenOrientation"'),
  "the code scanner's own portrait lock is stripped at merge time"
);
assert.ok(
  /^edgeToEdgeEnabled=true$/m.test(properties),
  'edge-to-edge stays on, so no deprecated status bar colour calls run'
);
assert.ok(
  /^android\.enableMinifyInReleaseBuilds=true$/m.test(properties),
  'release builds run R8, so the DEX is obfuscated and shrunk'
);
assert.ok(
  gradle.includes('signingConfig signingConfigs.release'),
  'release signing uses release credentials'
);
assert.ok(
  !gradle.match(/release\s*\{[^}]*signingConfig signingConfigs.debug/),
  'no debug signing in release'
);
console.log('PASS native configuration, runtime and signing guards');
