# MOB EAS And OTA Readiness

No EAS build or AAB was created during this task. Local Gradle APK remains the current build path for testing.

## Current App Identity

- App display name: MOB.
- Android package ID: `com.arpanpatra.mobapp`.
- Package ID was not changed because changing it affects Play Store identity and upgrade continuity.
- Runtime version policy: `appVersion`.
- Future channels: `development`, `preview`, `production`.

## EAS Profiles

`eas.json` is prepared for:

- `development`: internal development client.
- `preview`: APK for internal testing.
- `production`: app bundle for Play Store later.

## Future Commands Only

Do not run these until ready to consume EAS quota and produce store artifacts.

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile production
eas update --channel production --message "MOB production update"
```

Preview later:

```bash
eas build --platform android --profile preview
eas update --channel preview --message "MOB preview update"
```

## OTA Notes

- `expo-updates` is installed for future OTA readiness.
- OTA updates can update JavaScript and assets only.
- Native changes still require a new binary build.
- AAB is for Play Store distribution.
- APK is better for direct local install/testing.
- Production OTA should be used only after release signing, testing channels, and rollback discipline are ready.

## Current Limitation

Release APKs generated locally still use debug signing and are not Play Store ready.
