# OrangeFamily Android

`mobile/orange-photos-sync-agent` is Kotlin/Gradle and consumes the same Node API as React. It never accesses PostgreSQL or Wasabi directly; Room is local operational state and WorkManager handles existing background work. Preserve user isolation, privacy, deduplication, tokens, MediaStore, FileProvider, exported components, network security, backups, upload hashes, and API response safety.

For Android changes run `:app:testDebugUnitTest --no-configuration-cache` and `:app:assembleDebug --no-configuration-cache`. Do not run release, ADB, or instrumented tests without explicit authorization and a device.
