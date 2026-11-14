# Temporary APK delivery for the owner

The owner could not open the workspace file link. The candidate24APK itself passed ZIP integrity and retained its verified signature/hash. A separate unlisted HTTPS capability endpoint now delivers those exact bytes with Android's APK MIME type and Content-Disposition filename, HEAD, byte ranges for resume, and no-store/noindex/no-referrer headers.

The random256-bit capability is kept only in session memory and sent to the owner in the resulting download URL. Only its SHA256 hash, exact artifact binding and a24-hour issue/expiry window are committed in owner-apk.json. Possession of the link permits the download; it is a capability link, not an account-login claim. Wrong token/path/build/hash/size, malformed time windows and expired/not-yet-issued grants fail closed. There is no homepage link, public test page, database access or change to the January1 public APK/web gates. The APK/app version remains24 because no installed code changed.

Verification:7 dedicated capability/range/method/expiry tests,6 existing public launch-gate checks and the release metadata/build checks passed. The deployed URL is then fetched in full and compared byte-for-byte by SHA256 with the approved APK. Android installation and device-specific source permission are still handled on the user's phone. No token is written into this note or client assets.
