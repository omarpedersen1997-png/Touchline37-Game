# Squad, transfer and player-career continuation — code24

Following the owner's request to continue the reference-inspired refresh, this update extends code23's game menu and full-pitch controls into squad selection, scouting and player career. The original blue-grey background remains; no green page theme is restored.

The transfer market is now its own component with actual position filters, strength/price sorting, a current-budget filter, available-cash summary, clear blocked-purchase reasons, and a resettable empty state. Player cards display the actual name, position, age, strength, number, price and position improvement. Buying remains the existing server action; signed, active-match, insufficient-cash and non-improving candidates stay blocked. The pure selector does not reorder the server's scout list.

The lineup has eleven actual player cards, current formation, current trained ratings and clickable details. Recruit and tactical/reserve destinations remain real application actions; the reserve shortcut also focuses its workspace tab. The tactical field remains a formation board, with no invented live ball movement. Player career uses a portrait profile, separate wallet and existing development data, plus sticky horizontally scrollable links to real career sections. No backend progression, money or replay rules change.

assets/game/portraits.webp is an original generated atlas of six fictional adult-player illustrations (960x640,53,000bytes), exported from its retained generated PNG. Deterministic ID hashing keeps a player's cell stable across renders/devices. The atlas is embedded once as a native/web-game CSS custom property, not repeated per portrait and not fetched from another host. The original PNG remains in /workspace/generated_images. These are game character illustrations, not real player photographs or gameplay captures.

Public version1.0.0, internal24.283 full-suite tests and3 separate web-draft checks passed. New checks cover market filtering/order/budget and immutability, purchase eligibility, real squad actions and stable accessible/decorative portraits. Initial asset CSS insertion revealed an existing root-theme contract; the atlas declaration now follows the real theme rules so the initial Android color rule remains valid. No existing theme assertion was weakened. Logs:outputs/sections-all-tests.log and sections-web-tests.log.

Native packaging, retained certificate, exact bundled HTML and release metadata checks accompany handoff. Real Android visual/touch/rotation/performance verification remains outstanding; no fabricated app screenshot or browser workaround is used. The public January1 2027 at10CET APK/web gates remain. No GooglePlay publication.

Candidate24: 3,750,378bytes; SHA256:df327c3eeaf8a5f249920184608d1804f361baedbffdbf319be2da39d42f743b. Packaged native HTML, atlas token and build identity match the source output.
