# Eksterne originale spilleraktiver — Touchline 37

Der er fundet en supplerende original arbejdsmappe uden for spillets Git-repository:

`/workspace/football-asset-research`

Denne mappe indeholder redigerbare Blenderprojekter, den lokalt tilpassede karaktergenerator, parametre, rå eksportfiler, bagte animationer og licensmateriale. Den er vigtig for videre arbejde med de eksisterende spilleraktiver og skal bevares særskilt sammen med hovedprojektets kildekode.

Den valgte bevaringsplacering er:

`backup-records/external-assets/football-asset-research/`

Den oprindelige relative mappestruktur bevares under dette præfiks. Denne dokumentationsagent har kun læst originalerne og skrevet rapporter; hovedbackupen skal udføre selve kopieringen og verificere den mod inventaret.

## Omfang og integritet

Det anbefalede udvalg består af **902 filer på 120.566.112 bytes** før komprimering. `external-assets-inventory.json` registrerer hver fil med original relativ sti, størrelse og SHA256. Der er ikke fulgt symlinks, og udeladte mapper er angivet særskilt med årsag.

Følgende er særligt vigtige:

- `touchline-footballer.blend` og `.blend1`: første redigerbare spillerudgave og Blender-autobackup.
- `touchline-footballer-v2.blend` og `.blend1`: den videreudviklede spiller med slankere fodtøj og dens tidligere Blender-backup.
- `out/footballer-raw.blend`: redigerbart råt mellemprojekt.
- `out/touchline_footballer.glb`, `out/touchline_footballer_v2.glb`, GLB-/glTF-metadata, previews og knogle-/meshregistreringer.
- `footballer.params.json` og `footballer-v2.params.json`: parametre til karaktergeneratoren.
- `optimize_footballer.py` og `optimize_footballer_v2.py`: den eksisterende Blenderoptimering og eksport, som også gemmer de redigerbare scener.
- `touchline-motion.json`: de bagte bevægelsesspor.
- `ara/scripts/export-touchline-motion.ts`: det lokale script, der bager idle/walk/run/strafe/cheer fra generatoren.
- `ara/src/`, `ara/scripts/`, `ara/package.json`, lockfil, konfiguration, licenser og `ara/public/assets/`: generatorens kildekode og lokale karakterdata, katalog, basemesh, targets, proxies og teksturer.
- `deps/package.json` og `deps/package-lock.json`: deklaration af de lokale hjælpedependenser.
- `ASSET-LICENSES.md`, `INTEGRATION.md`, `makehuman-license.md`, `ara-assets-license.txt`, `ara/LICENSE`, `ara/scripts/ASSETS_LICENSE.txt` samt øvrige eksisterende reference-/licensfiler.

Alle fem `.blend`/`.blend1`-filer har den forventede `BLENDER-v403`-header. Header og filhash er læst; scenerne er ikke åbnet og rendret i Blender under denne inventarkontrol.

To direkte forbindelser til den leverede spilversion er verificeret byte-for-byte via SHA256:

| Oprindelig arbejdsfil | Spillets aktiv | SHA256 |
|---|---|---|
| `touchline-footballer-v2.glb` | `assets/game/football-pro.glb` | `d31843ec2e893e2e080f360010f9c380beb8f92fa85904b391b1770c2910c916` |
| `touchline-motion.json` | `assets/game/football-motion.json` | `8d95cb2eec29dcf242b594ff093640c4c367e282124ce6e869dccb965041c413` |

## Generatorens lokale ændringer skal bevares

`ara/` er baseret på det offentlige MIT-projekt `https://github.com/olatunde85/3d-gen`, commit:

`3a9fca61fc1ea081a2d252fcdd588023d1c10587`

Den lokale arbejdsmappe indeholder vigtige ændringer, som en almindelig genkloning af dette commit ikke genskaber:

- Ændret `src/core/garments/catalog.ts`.
- Ændret `src/core/garments/sneakers.ts`.
- Lokalt, ikke-versioneret `scripts/export-touchline-motion.ts`.

Inventaret omfatter disse aktuelle arbejdsfiler, ikke kun generatorens Git-HEAD. Hverken generatorens originale repository eller arbejdstræ er ændret under kontrollen.

## Bevidst udeladte værktøjs-/demofiler

- `deps/node_modules/` og andre installerede afhængigheder/caches: pakkerne beskrives af de bevarede package-/lockfiler.
- `ara/.git/`: tredjepartsrepositoryets metadata og objektpakke. Den offentlige baselinecommit er dokumenteret, og den lokalt ændrede kildekode er medtaget.
- `ara/public/media/` og `ara/docs/media/`: ca.49,8MB af generatorens demonstrationsvideoer, animerede dokumentationsbilleder og generel tredjepartsdemomusik. Disse er ikke de eksisterende Touchline-spilleraktiver eller kamplyd og kræves ikke af Touchlines almindelige appbygning eller karakterens CLI-eksport.
- Mulige `.env`-/keystore-/privatekeyfiler og genererede cachemapper udelukkes, hvis de findes. Den konkrete liste fremgår af inventaret.

Alle generatorens øvrige kildefiler, dokumentation og lokale `public/assets`-karakterdata er medtaget. Generatorens komplette demonstrationshjemmeside kan kræve de udeladte marketing-/demomedier; dette udvalg hævder ikke at være en komplet produktbackup af tredjepartsprojektet Ara3D.

## Sikkerhed og licenser

488 relevante tekstfiler er undersøgt for kendte mønstre på private PEM-nøgler, rå GitHub/OpenAI/AWS-tokens, literal Bearer-token og rå Touchline-downloadkapabiliteter. Der blev ikke fundet sådanne mønstre i udvalget. Det er en afgrænset mønsterkontrol, ikke en garanti for fravær af alle tænkelige hemmeligheder i binære Blender-/GLB-metadata.

Bevar licensfilerne. MakeHuman-karakterdata og Ara-generatorens kode har forskellige licensgrundlag. Motiondata har CMU/NSF-proveniens, som den eksisterende licensdokumentation beskriver. Ubrugte anatomiske referencefiler som `male-base-mesh.glb` skal holdes adskilt fra den leverede, påklædte fodboldspiller og må ikke automatisk erstatte den.

## Arbejd sikkert videre

Kør ikke de gamle eksport-/optimeringsscripts direkte fra originalplaceringen. De indeholder hårdkodede stier til `/workspace/football-asset-research/` og kan overskrive eksisterende GLB-/Blender-/previewfiler. Arbejd på en ny udviklingskopi, og få brugerens udtrykkelige godkendelse før enhver faktisk ændring af grafikken.

Touchlines eksisterende app kan bygges med de leverede GLB-/JSON-filer uden at køre Ara3D eller Blender. At de redigerbare originaler er fundet gør bevaringen bedre dokumenteret, men det erstatter ikke kontrol af Androidværktøjskæde, signeringsnøgle, produktionsdatabase og andre eksterne driftsdata.
