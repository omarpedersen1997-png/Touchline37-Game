// Frosne kampmotorer 1–10: SHA256 fra baseline c71fbb7 (identisk med BACKUP-MANIFEST.json).
// Bruges af tests/engine-freeze.test.mjs og dev/prepare-baseline-tag.mjs.
// Denne liste må kun udvides – aldrig ændres – og nye motorer (11+) fryses først,
// når de er udgivet.
export const FROZEN_ENGINE_FILES = Object.freeze([
  { version: 1, file: 'shared/arcade-v1.js', sha256: '46ab8608e889d79c187f3d80df42fee6ae04dd12181416c9ec875664832707fb' },
  { version: 2, file: 'shared/football11.js', sha256: '12975e3dce9e7e90564a744c91725d1896ddc05b10a08f9f5ddbb3a13433b495' },
  { version: 3, file: 'shared/football-modern.js', sha256: 'ee8f54a6653733583271748f2120d1ab92a924187a67c52db9730c837f1c8542' },
  { version: 4, file: 'shared/football-spaced.js', sha256: '5b807c46facdb459fe39ba8c51cb54bea3fa705017794d8e215517aa3c033220' },
  { version: 5, file: 'shared/football-pro.js', sha256: 'a8edf95f5b0c142f5f0f53a0d5444f12f68186fcbe93dfa83441dfc78932cb66' },
  { version: 6, file: 'shared/football-halves.js', sha256: '91fbb93f1dc3c7929cb8671a22efdc59f9c039f7d8c55687a52cadfca505e14b' },
  { version: 7, file: 'shared/football-contact.js', sha256: 'd404483ef415f90966e014f436c3412b8242a2cf29326ef7922c82c846270cda' },
  { version: 8, file: 'shared/football-tactics.js', sha256: '929fd965dfb7887042d371b9cc3905c7c0c91b02a2beaabdb2eb99dd46aef9d8' },
  { version: 9, file: 'shared/football-receiving.js', sha256: '1ae9d7a34cc368deb0e4fcd4dd7a1a3120b713650d5bed3added4692640bed5e' },
  { version: 10, file: 'shared/football-goals.js', sha256: '289006eb1ea9a82117d0f594603686058bea63da63c786f850b485afb78ea607' },
]);
