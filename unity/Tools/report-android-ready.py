"""Separate Danish report; preserves every earlier PDF/APK artifact."""
from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph

repo=Path(__file__).resolve().parents[2]
data=json.loads((repo/'unity/Evidence/android-ready.json').read_text())
out=repo/'unity/Artifacts/TouchlineUnity-Android-Ready-6000.6.10f1.pdf'
if out.exists():raise SystemExit('Tidligere rapport må ikke overskrives.')
pdfmetrics.registerFont(TTFont('TLReady',str(repo/'assets/fonts/DM-Sans.ttf')))
body=ParagraphStyle('body',fontName='TLReady',fontSize=10,leading=15,spaceAfter=8,textColor=colors.HexColor('#102330'))
title=ParagraphStyle('title',parent=body,fontSize=22,leading=28,spaceAfter=15)
small=ParagraphStyle('small',parent=body,fontSize=7,leading=10,spaceAfter=2)
story=[]
def p(text,style=body):story.append(Paragraph(escape(text),style))
p('Touchline Unity · Android-klargøring',title)
p('Unity 6.6 / 6000.6.10f1 · codex/unity-66-foundation · 22. november 2026')
p('Status: projektkonfiguration, automatisk import, buildmenu og CI-testsignering er klargjort og kildekontrolleret. Unity Editor findes ikke i dette miljø. Unity-import, API-kompilering, APK-bygning og fysisk Android-test er derfor ikke verificeret; projektet erklæres ikke 100 % buildverificeret.')
p('Scene og Android')
p('EditorBuildSettings har én nødvendig startscene: Assets/Touchline/Scenes/Touchline.unity. Den eksisterende bootstrapper åbner den danske klubskærm og skifter til den lokale 3D-verden i samme scene. Play Mode-startscenen vælges automatisk uden at overskrive andre åbne scener. Kamera, lys, stadion, bold og 22 spillere bygges af runtime-koden.')
p('Native ProjectSettings.asset er nu gemt med separat app-id dk.touchline.footballidle.unitytest, IL2CPP, ARM64, minimum API 26, target API 35, lineær farve, frame pacing og Input System. Portræt og begge landskabsretninger er tilladt; kampen anmoder om landskab og menuen gendannes ved retur. Lokal debug-signering er automatisk og bruger ingen produktionsnøgle.')
p('URP og import')
p('Player/Graphics/Quality/URP-settings samt renderer, pipeline, global settings og standard-volumeprofil er afledt af Unitys officielle com.unity.template.urp-blank 17.2.6, beregnet til Unity 6000.6 / URP 17.6.0. Pakkens SHA-1 er verificeret; GUID’er er remappet til dette projekt, og licens/proveniens er bevaret i unity/ThirdParty.')
p('Klargøringen opretter/synkroniserer materialer og fire Animator-controllere med hver 12 klip. Før bygning kontrolleres alle fem importerede FBX-modeller, renderere, controllere, animationer, centrale teksturer, URP-materialer og startscene. Manglende shader/ressourcer afbryder bygningen frem for en succesmeddelelse. De 31 originale ressourcer og fem eksisterende FBX er uændrede. Faktisk shader- og animationsvisning kræver stadig Unity-test.')
p('Ét klik og CI')
p('Touchline → Build Android Test APK køsætter Android-targetskift og venter over import/assembly-reload før bygning af Builds/Android/Touchline-Unity-Test.apk. Versionsnummer øges lokalt. Tidligere output med samme navn kopieres til History/. Compiler-/buildadvarsler skrives til Builds/Android/Build-*.log.')
p('GitHub Actions bruger den valgfrie UNITY_ANDROID_DEBUG_KEYSTORE_BASE64, hvis den findes. Ellers oprettes en kryptografisk tilfældig, midlertidig RSA-3072 debugnøgle automatisk. Keystore eksporteres ikke som artifact og slettes fra runneren efter brug. Tilfældige nøgler giver forskellige signaturer; APK’er fra forskellige kørsler kan derfor ikke automatisk opdatere hinanden. Ingen app eller save afinstalleres/slettes. Fast Secret er stadig valgfri til vedvarende CI-signering.')
p('CI kræver fortsat gyldig Unity-licens eller en Hub-aktiveret Windows-runner. Apk-signatur, app-id, versionCode, commit og checksum kontrolleres før artifact-upload. Workflowet bygger kun Unity-branchen; ingen merge, deployment eller main-write.')
p('Faktiske kontroller')
p('816 legacy-tests består uden skip: 503 før en miljøblokering og 313 i fortsættelsen med eksisterende JDK på PATH og en verificeret, midlertidig org.json-JAR. 46 C#-domænetests, 14 workflow/settings-tests og 15 PowerShell-kontroller består. PowerShell-testen genererer reelle midlertidige testnøgler og verificerer genbrug af en valgfri fast nøgle uden at åbne oprindelige signeringsnøgler. 21 C#-filer har nul Roslyn-syntaksfejl; Actionlint er fejlfri. Dette er ikke Unity API-kompilering eller Windows PowerShell 5.1-verifikation.')
p('12 Unity EditMode-tests er leveret, men ikke afviklet her. Ingen Unity-APK eller telefon-FPS er opfundet. APK 37, R2/R3 og tidligere afleveringsfiler har uændrede checksums. Motor 1–10, R1/R2, optagelser, main, brugerdata, hjemmeside v56, DNS og produktion er ikke ændret. Lanceringen er stadig 1. januar 2027 kl. 10.00 København / 09.00 UTC.')
p('Åbn lokalt: installer 6000.6.10f1 + Android Build Support/SDK/NDK/OpenJDK og aktivér Unity i Hub. Åbn unity/TouchlineUnity, lad importen afslutte, og vælg Touchline → Build Android Test APK. Ingen manuel ændring af scene, input, Player Settings, materialer eller controllere er tilsigtet. En rigtig første Unity-bygning er den udestående accepttest.')
p('Ændrede/oprettede filer')
for name in data['changes']:p(name,small)
p('Læste Unity-referencer: '+', '.join(data['skillReferences']),small)
SimpleDocTemplate(str(out),leftMargin=44,rightMargin=44,topMargin=40,bottomMargin=40).build(story)
print(out.relative_to(repo),out.stat().st_size,'bytes')
