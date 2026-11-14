# Visible dark forest background and viewport fade — code22

The owner reported no visible change in either app or site. Fresh public responses from both domains contained code21 CSS with no-store caching, and its APK contained matching CSS: deployment itself was current. Its green/previous-color difference was small and its translucent680px fade covered only the beginning of a page.

The replacement uses a much clearer forest gradient with an opaque #286443 upper glow and deeper green lower stops. A shared fixed ::before layer is contained by an isolated page stacking context, so the fade spans the viewport and remains visible while scrolling, with no scroll-blocking or pointer handling. App, login, public contact/legal pages and website share it. Main secondary text is brighter to retain readability: brightest-point contrast6.32:1 for primary and4.87:1 for secondary text. Native startup and theme color use #103d28.

Login and account details now show1.0.0 (22), allowing the owner to identify an installed update. Release validation cross-checks this public build number against Android metadata. No gameplay, user data or public launch gates change.

Verification:7 management/auth UI checks,3 web checks,6 launch-gate checks, native build and matching bundled HTML passed. Signature and metadata verification accompany packaging. Physical phone/browser rendering review remains unavailable in this environment; do not claim a captured device screenshot. APK SHA256: 3c5dad64955b3a9b47befb79b30a6a397e8f9c18e9b440003545da316cc79209.
