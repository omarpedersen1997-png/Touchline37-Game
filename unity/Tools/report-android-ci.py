"""Generate a separate Danish CI report; never overwrite the foundation report."""
from pathlib import Path
import hashlib
import json
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

root = Path(__file__).resolve().parents[2]
data = json.loads((root / 'unity/Evidence/android-ci.json').read_text())
out = root / 'unity/Artifacts/TouchlineUnity-Android-CI-6000.6.10f1.pdf'
if out.exists():
    raise SystemExit('Rapporten findes allerede; tidligere afleveringer overskrives ikke.')
pdfmetrics.registerFont(TTFont('TouchlineCI', str(root / 'assets/fonts/DM-Sans.ttf')))
body = ParagraphStyle('body', fontName='TouchlineCI', fontSize=10, leading=15,
                      textColor=colors.HexColor('#102330'), spaceAfter=8)
title = ParagraphStyle('title', parent=body, fontSize=22, leading=28, spaceAfter=14)
heading = ParagraphStyle('heading', parent=body, fontSize=14, leading=20, spaceBefore=10)
story = []


def p(text, style=body):
    story.append(Paragraph(escape(text), style))


p('Touchline Unity · Android CI', title)
p('Unity 6000.6.10f1 · 22. november 2026 · separat udviklingsbranch')
p('Leverance: automatiseret APK-workflow, CI-byggemetode, sikker testsignering, verificering, dansk opsætningsvejledning og regressionstests. Ingen Unity-APK er bygget i dette miljø. Licensaktivering og første rigtige Unity-bygning er fortsat udestående.')
p('Automatisk bygning og aflevering', heading)
p('Push til codex/unity-66-foundation og workflow_dispatch er konfigureret. Begge jobs afviser main, andre branches, tags og forks. GameCI v4 og den præcise 6000.6.10f1 Android-container fra serie 4 er låst til verificerede commits/digest. Delt hukommelse er sat til 2 GiB.')
p('Bygningen bruger ARM64/IL2CPP, egen app-identitet dk.touchline.footballidle.unitytest og en vedvarende særskilt debug-keystore fra GitHub Secrets. Stigende versionCode og unikke outputmapper understøtter sikre fremtidige Unity-testopdateringer uden overskrivning af tidligere artefakter.')
p('Apksigner og aapt kontrollerer signatur, app-id og versionCode. Kun APK, build-info, SHA-256 og offentligt certifikat uploades som et artifact med 14 dages opbevaring. Licenser, private nøgler, saves og rå editorlogs uploades ikke. Repositoryet er offentligt; testartefaktet er ikke privat.')
p('Licens: vigtig rettelse', heading)
p('Unity 6.6 understøtter ikke manuel .alf → .ulf-aktivering af Unity Personal. GameCI beskriver en Hub-baseret .ulf-metode, hvis din konto/Hub leverer den relevante fil; den kræver UNITY_LICENSE, UNITY_EMAIL og UNITY_PASSWORD. Denne kontos kompatibilitet er ikke verificeret. Ingen licens må omdøbes, manipuleres eller deles i chatten.')
p('Alternativt kan en Windows-runner under samme bruger som den Hub-aktiverede Personal-editor bygge uden cloud-licens eller Unity-password på GitHub. Sæt UNITY_BUILD_RUNNER=windows-personal og brug den dedikerede runner-label. PC og runner skal være online. Se unity/CI-ANDROID.md for alle Windows- og Android-trin.')
p('GitHubs Run workflow-knap kræver normalt filen på standardbranchen. Den flyttes ikke til main. Efter første push-kørsel dokumenterer GitHub branch-dispatch via CLI/API; eksisterende kørsler kan også gentages fra Android med Re-run all jobs. En gentagelse bygger samme commit, ikke ny kode.')
p('Faktiske kontroller', heading)
p('46 eksisterende C#-domænetests: bestået. 7 workflow-regressionstests: bestået. 8 PowerShell-parser-/fejlkontroller på PowerShell 7.7.0/Linux: bestået. Actionlint 1.7.12: ingen fejl. Roslyn: 19 C#-filer, 0 syntaksfejl. Dette er ikke Unity API-kompilering eller en Windows PowerShell 5.1-kørsel.')
p('Projektkontrol: 31 oprindelige ressourcer byteidentiske, fem afledte FBX bevaret, 66 unikke asset-fil-GUID’er og frosne domænechecksums består. Original APK 37 og R2/R3 har uændrede kontrolsummer. Ingen spilregler, UI, local save, lyd-/splash-valg, hjemmeside, DNS eller produktionsdata er ændret.')
p('Ikke verificeret: Unity-import, CI-licens, IL2CPP/Android-bygning, den færdige APK-signatur, fysisk installation, opstart og FPS. GitHub-forbindelsen afviste læsning af Secret-navne med HTTP 403; ingen Secret-værdier blev læst eller ændret.')
p('Filer', heading)
for file in data['changedFiles']:
    p(file)
p('Android: GitHub → Actions → grøn Touchline Unity Android TEST-kørsel → Artifacts → Touchline-Unity-Android-… → download og udpak ZIP → installer Touchline-Unity-Test.apk. Unity TEST ligger ved siden af den tidligere Capacitor TEST og APK 37. Kontroller efter første bygning opstart, dansk klubflow, kamp, baggrund/retur og opdatering med bevaret Unity-save.')
p('Beskyttet main før upload: ' + data['protected']['main'])
p('Lancering fastholdt: fredag 1. januar 2027 kl. 10.00 København / 09.00 UTC.')
SimpleDocTemplate(str(out), pagesize=A4, leftMargin=45, rightMargin=45,
                  topMargin=42, bottomMargin=42).build(story)
print(json.dumps({'file': str(out.relative_to(root)), 'bytes': out.stat().st_size,
                  'sha256': hashlib.sha256(out.read_bytes()).hexdigest()}))
