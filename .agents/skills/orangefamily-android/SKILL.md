# OrangeFamily Android

`mobile/orange-photos-sync-agent` is Kotlin/Gradle and consumes the same Node API as React. It never accesses PostgreSQL or Wasabi directly; Room is local operational state and WorkManager handles existing background work. Preserve user isolation, privacy, deduplication, tokens, MediaStore, FileProvider, exported components, network security, backups, upload hashes, and API response safety.

For Android changes run `:app:testDebugUnitTest --no-configuration-cache` and `:app:assembleDebug --no-configuration-cache`.

For any task that builds, installs, versions, signs, publishes, registers, replaces, or verifies an APK, read and apply both:

- `.agents/skills/orangefamily-android-release/SKILL.md`
- `docs/40-features/orange-photos/ANDROID_RELEASE_WORKFLOW.md`

Do not run release, ADB, or instrumented tests without explicit authorization and a device.

Critical release invariant: physical validation of a signed test APK happens before the version bump. A test APK keeps the currently published `versionCode` and `versionName`, uses the release signature and production API, is installed only on the authorized test device, and is never published or registered. Only after explicit human approval may the final version be bumped, rebuilt from clean `main`, installed, verified, uploaded, hash-checked, and registered.
