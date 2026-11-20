#!/usr/bin/env python3
"""Build a Danish update report from evidence JSON. Never reads credentials.

python dev/reports/build-update-pdf.py --input test-evidence/performance-v38.json
Use --draft before the APK is ready, or --output outputs/report-preview.pdf.
Final mode verifies the referenced APK's real size, SHA-256 and ZIP integrity.
"""
from __future__ import annotations

import argparse
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import zipfile
from xml.sax.saxutils import escape

from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether,
)
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
NAVY = colors.HexColor('#102330')
LIME = colors.HexColor('#B7EF63')
INK = colors.HexColor('#17303D')
MUTED = colors.HexColor('#55707C')
PALE = colors.HexColor('#EDF4E9')
BORDER = colors.HexColor('#DCE5E8')
MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli',
          'august', 'september', 'oktober', 'november', 'december']
SECRET_KEY = re.compile(r'password|passphrase|pepper|private.?key|keystore|'
                        r'signing.?key|authorization|cookie|(?:api|access|setup|bypass).?token|api.?key', re.I)


def fail(message: str):
    raise ValueError(message)


def reject_secrets(value, path='rapport'):
    if isinstance(value, dict):
        for key, item in value.items():
            if SECRET_KEY.search(key):
                fail(f'Følsomt feltnavn er ikke tilladt i PDF-input: {path}.{key}')
            reject_secrets(item, f'{path}.{key}')
    elif isinstance(value, list):
        for item in value:
            reject_secrets(item, path)
    elif isinstance(value, str) and re.search(r'-----BEGIN [^-]*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}', value):
        fail('Input ser ud til at indeholde en privat nøgle eller adgangstoken.')


def text(value, name, limit=1200, required=True):
    if value is None and not required:
        return ''
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        fail(f'{name} skal være tekst på højst {limit} tegn.')
    return value.strip()


def string_list(value, name, limit=10):
    if not isinstance(value, list) or not 1 <= len(value) <= limit:
        fail(f'{name} skal indeholde 1–{limit} punkter.')
    return [text(item, name, 600) for item in value]


def validate(data, draft):
    reject_secrets(data)
    if data.get('schemaVersion') != 1:
        fail('schemaVersion skal være 1.')
    update, apk, tests = (data.get(key, {}) for key in ['update', 'apk', 'tests'])
    for key in ['id', 'title', 'date', 'summary']:
        text(update.get(key), 'update.' + key, 1000 if key == 'summary' else 180)
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,24}', update['id']):
        fail('update.id må kun indeholde bogstaver, tal, _ og -.')
    date.fromisoformat(update['date'])
    commit = update.get('sourceCommit')
    if not draft and not (isinstance(commit, str) and re.fullmatch(r'[a-f0-9]{40}', commit)):
        fail('Finalrapporten kræver fuld sourceCommit på 40 hextegn.')
    for key in ['fileName', 'appId', 'versionName']:
        text(apk.get(key), 'apk.' + key, 180)
    if not re.fullmatch(r'[A-Za-z0-9._-]+\.apk', apk['fileName']):
        fail('apk.fileName skal være et enkelt APK-filnavn uden mapper.')
    if not isinstance(apk.get('versionCode'), int) or isinstance(apk['versionCode'], bool) or apk['versionCode'] < 1:
        fail('apk.versionCode skal være et positivt heltal.')
    if apk.get('downloadUrl'):
        url = text(apk['downloadUrl'], 'apk.downloadUrl', 600)
        if not url.startswith('https://github.com/') or '?' in url or '#' in url or '@' in url:
            fail('Downloadlink skal være en GitHub HTTPS-filadresse uden token eller query.')
    if not isinstance(tests.get('passed'), int) or isinstance(tests['passed'], bool) or tests['passed'] < 1:
        fail('tests.passed skal være det verificerede positive testantal.')
    text(tests.get('phoneModel'), 'tests.phoneModel', 80)
    text(tests.get('note'), 'tests.note', 800)
    if not isinstance(tests.get('physicalDeviceVerified'), bool):
        fail('tests.physicalDeviceVerified skal være true eller false.')
    string_list(tests.get('checks'), 'tests.checks', 10)
    changes = data.get('changes')
    if not isinstance(changes, list) or not 1 <= len(changes) <= 7:
        fail('changes skal indeholde 1–7 ændringer.')
    for change in changes:
        text(change.get('title'), 'changes.title', 130)
        text(change.get('detail'), 'changes.detail', 550)
    measurements = data.get('measurements')
    if not isinstance(measurements, list) or not 1 <= len(measurements) <= 7:
        fail('measurements skal indeholde 1–7 målinger.')
    for item in measurements:
        text(item.get('label'), 'measurements.label', 120)
        if item.get('unit') not in ['bytes', 'ms', 'pixels', 'queries']:
            fail('Måleenhed skal være bytes, ms, pixels eller queries.')
        for key in ['before', 'after']:
            if item.get(key) is not None and (not isinstance(item[key], (int, float)) or isinstance(item[key], bool) or not math.isfinite(item[key]) or item[key] < 0):
                fail('Målinger skal være positive tal eller null, hvis ikke målt.')
    for key in ['preserved', 'limitations', 'installSteps', 'nextTest']:
        string_list(data.get(key), key, 6 if key != 'installSteps' else 5)
    if not draft:
        digest = apk.get('sha256')
        if not isinstance(digest, str) or not re.fullmatch(r'[a-f0-9]{64}', digest):
            fail('Finalrapporten kræver APK-filenes faktiske SHA-256.')
        artifact = ROOT / 'dev/artifacts' / apk['fileName']
        payload = artifact.read_bytes()
        if hashlib.sha256(payload).hexdigest() != digest:
            fail('APK-kontrolsummen stemmer ikke med filen i dev/artifacts.')
        if apk.get('bytes') != len(payload):
            fail('APK-størrelsen stemmer ikke med filen i dev/artifacts.')
        with zipfile.ZipFile(artifact) as archive:
            if archive.testzip() is not None:
                fail('APK-arkivets CRC-kontrol fejlede.')
    return update, apk, tests


def fonts():
    body, title = 'Helvetica', 'Helvetica-Bold'
    try:
        pdfmetrics.registerFont(TTFont('TouchlineBody', str(ROOT / 'assets/fonts/DM-Sans.ttf')))
        pdfmetrics.registerFont(TTFont('TouchlineTitle', str(ROOT / 'assets/fonts/Barlow-Condensed.ttf')))
        body, title = 'TouchlineBody', 'TouchlineTitle'
    except Exception as error:
        print('Projektfont kunne ikke indlæses; bruger PDF-standardfont: ' + str(error), file=sys.stderr)
    return body, title


def format_value(value, unit):
    if value is None:
        return 'Ikke målt'
    if unit == 'bytes':
        return f'{value / 1_000_000:.2f}'.replace('.', ',') + ' MB'
    if unit == 'pixels':
        return f'{value / 1_000_000:.2f}'.replace('.', ',') + ' mio.'
    if unit == 'ms':
        return f'{value:.0f}'.replace('.', ',') + ' ms'
    return f'{value:g}' + ' SQL-kald'


def build_pdf(data, output: Path, draft=False):
    update, apk, tests = validate(data, draft)
    body, title = fonts()
    rl_config.warnOnMissingFontGlyphs = 1
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='BodyTL', fontName=body, fontSize=10, leading=15, textColor=INK, spaceAfter=8))
    styles.add(ParagraphStyle(name='SmallTL', fontName=body, fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=7))
    styles.add(ParagraphStyle(name='TitleTL', fontName=title, fontSize=30, leading=32, textColor=NAVY, spaceAfter=12))
    styles.add(ParagraphStyle(name='SectionTL', fontName=title, fontSize=18, leading=21, textColor=NAVY, spaceBefore=10, spaceAfter=7))
    styles.add(ParagraphStyle(name='BulletTL', fontName=body, fontSize=9.7, leading=14, textColor=INK, leftIndent=11, firstLineIndent=-10, spaceAfter=6))
    styles.add(ParagraphStyle(name='CellTL', fontName=body, fontSize=9, leading=13, textColor=INK))
    styles.add(ParagraphStyle(name='CellHeadTL', fontName=body, fontSize=9, leading=13, textColor=colors.white))
    styles.add(ParagraphStyle(name='CodeTL', fontName='Courier', fontSize=8.1, leading=12, textColor=INK))
    p = lambda value, style='BodyTL': Paragraph(escape(str(value)).replace('\n', '<br/>'), styles[style])
    bullet = lambda value: p('•  ' + value, 'BulletTL')
    day = date.fromisoformat(update['date'])
    date_label = f'{day.day}. {MONTHS[day.month - 1]} {day.year}'
    width = A4[0] - 36 * mm

    def page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(NAVY)
        canvas.rect(0, A4[1] - 45 * mm, A4[0], 45 * mm, fill=1, stroke=0)
        canvas.setFillColor(LIME)
        canvas.rect(18 * mm, A4[1] - 45 * mm, 35 * mm, 2 * mm, fill=1, stroke=0)
        canvas.setFont(title, 24)
        canvas.setFillColor(colors.white)
        canvas.drawString(18 * mm, A4[1] - 19 * mm, 'TOUCHLINE')
        canvas.setFont(body, 8.5)
        canvas.setFillColor(LIME)
        canvas.drawString(18 * mm, A4[1] - 29 * mm, 'OPDATERINGSRAPPORT  ·  ' + update['id'])
        canvas.setFillColor(colors.white)
        canvas.drawRightString(A4[0] - 18 * mm, A4[1] - 19 * mm, date_label)
        canvas.setFillColor(colors.HexColor('#B5C6CE'))
        canvas.drawRightString(A4[0] - 18 * mm, A4[1] - 29 * mm, 'Motor 11 · Android-test')
        if draft:
            canvas.setFillColor(LIME)
            canvas.drawRightString(A4[0] - 18 * mm, A4[1] - 37 * mm, 'KLADDE — APK-KONTROL AFVENTES')
        canvas.setStrokeColor(BORDER)
        canvas.line(18 * mm, 15 * mm, A4[0] - 18 * mm, 15 * mm)
        canvas.setFont(body, 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 10 * mm, 'Kun test · APK 37 og aktiv hjemmeside bevares')
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f'Side {doc.page}')
        canvas.restoreState()

    output.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(output), pagesize=A4, title='Touchline — opdateringsrapport ' + update['id'],
                          author='Touchline / Codex', subject='Verificerede ændringer og separat Android-test-APK',
                          leftMargin=18 * mm, rightMargin=18 * mm, topMargin=57 * mm, bottomMargin=20 * mm)
    doc.addPageTemplates(PageTemplate(id='TL', frames=[Frame(18 * mm, 20 * mm, width, 220 * mm,
                                                           leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=page))
    story = [p(update['title'], 'TitleTL'), p(update['summary'])]
    status = Table([[p('TESTUDGAVE', 'SmallTL'), p(str(tests['passed']) + ' tests består', 'CellTL'), p(tests['phoneModel'], 'CellTL')]], colWidths=[width * .23, width * .37, width * .4])
    status.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), PALE), ('BOX', (0, 0), (-1, -1), .5, BORDER),
                               ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 10),
                               ('RIGHTPADDING', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
    story += [Spacer(1, 5 * mm), status, p('Ændringer i denne opdatering', 'SectionTL')]
    for index, change in enumerate(data['changes'], 1):
        story.append(KeepTogether([p(f'{index:02d}  ' + change['title'], 'SectionTL'), p(change['detail'])]))
    story += [PageBreak(), p('Kontrol og målinger', 'TitleTL'), p(tests['note'])]
    rows = [[p('Måling', 'CellHeadTL'), p('Før', 'CellHeadTL'), p('Efter', 'CellHeadTL')]]
    for item in data['measurements']:
        rows.append([p(item['label'], 'CellTL'), p(format_value(item.get('before'), item['unit']), 'CellTL'), p(format_value(item.get('after'), item['unit']), 'CellTL')])
    table = Table(rows, colWidths=[width * .52, width * .24, width * .24], repeatRows=1)
    table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), NAVY), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, PALE]),
                              ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                              ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9), ('LINEBELOW', (0, -1), (-1, -1), .5, BORDER)]))
    story += [table, Spacer(1, 3 * mm)]
    notes = list(dict.fromkeys(item.get('note', '').strip() for item in data['measurements'] if item.get('note', '').strip()))
    story += [p(note, 'SmallTL') for note in notes]
    story.append(p('Gennemførte kontroller', 'SectionTL'))
    story += [bullet(item) for item in tests['checks']]
    story.append(p('Det er endnu ikke verificeret', 'SectionTL'))
    if not tests['physicalDeviceVerified']:
        story.append(p('Fysiske FPS, varme og touchforsinkelse er endnu ikke målt på ' + tests['phoneModel'] + '. Beregnede pixelbudgetter og desktop-/servermålinger er ikke telefon-FPS.'))
    story += [bullet(item) for item in data['limitations']]
    story += [PageBreak(), p('APK og afprøvning', 'TitleTL')]
    artifact_rows = [
        ['Fil', apk['fileName']], ['App-id', apk['appId']], ['Version', f"{apk['versionName']} · kode {apk['versionCode']}"],
        ['Filstørrelse', format_value(apk.get('bytes'), 'bytes')],
    ]
    details = Table([[p(a, 'SmallTL'), p(b, 'CellTL')] for a, b in artifact_rows], colWidths=[width * .2, width * .8])
    details.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
    story.append(details)
    story.append(p('SHA-256 · test-APK', 'SmallTL'))
    digest = apk.get('sha256') or 'Afventer den færdige APK'
    story.append(p(' '.join(digest[i:i+8] for i in range(0, len(digest), 8)) if apk.get('sha256') else digest, 'CodeTL'))
    story += [Spacer(1, 3 * mm), p('Kildecommit: ' + (update.get('sourceCommit') or 'Afventer endelig kildecommit'), 'SmallTL')]
    if apk.get('downloadUrl'):
        story.append(Paragraph('<link href="' + escape(apk['downloadUrl'], {'"': '&quot;'}) + '" color="#315C29">Åbn test-APK-filens side på GitHub</link>', styles['BodyTL']))
    story.append(p('På Android', 'SectionTL'))
    story += [bullet(f'{index}. {item}') for index, item in enumerate(data['installSteps'], 1)]
    story.append(p('Bevaret', 'SectionTL'))
    story += [bullet(item) for item in data['preserved']]
    story.append(p('Næste afprøvning på telefonen', 'SectionTL'))
    story += [bullet(item) for item in data['nextTest']]
    doc.build(story)
    reader = PdfReader(output)
    if not 3 <= len(reader.pages) <= 6:
        fail(f'Rapporten blev {len(reader.pages)} sider; forkort inputteksterne, så layoutet holder højst seks sider.')
    extracted = '\n'.join(page.extract_text() or '' for page in reader.pages)
    for expected in [update['id'], apk['fileName'], tests['phoneModel'], 'APK 37']:
        if expected not in extracted:
            fail('PDF-tekstkontrol fejlede: ' + expected)
    if not draft:
        plain = ''.join(extracted.split())
        for expected in [apk['sha256'], update['sourceCommit']]:
            if expected not in plain:
                fail('PDF-kontrol af kontrolsum/kildecommit fejlede.')
    payload = output.read_bytes()
    return {'output': str(output), 'pages': len(reader.pages), 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest(),
            'draft': draft, 'apkChecked': not draft, 'font': body}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, help='Evidence-JSON; må ikke indeholde credentials.')
    parser.add_argument('--output', help='PDF-sti; standard er dev/artifacts/Touchline37-Opdateringsrapport-<id>.pdf')
    parser.add_argument('--draft', action='store_true', help='Markér PDF som kladde; APK kan afvente.')
    parser.add_argument('--overwrite', action='store_true', help='Erstat kun egen tidligere genererede rapport før aflevering.')
    args = parser.parse_args()
    try:
        data = json.loads(Path(args.input).read_text(encoding='utf8'))
        update, _, _ = validate(data, args.draft)
        output = Path(args.output).resolve() if args.output else ROOT / 'dev/artifacts' / f"Touchline37-Opdateringsrapport-{update['id']}.pdf"
        if not output.is_relative_to(ROOT) or output.suffix.lower() != '.pdf':
            fail('Output skal være en PDF under projektets egen mappe.')
        if output.exists() and not args.overwrite:
            fail('PDF-filen findes allerede. Brug nyt versionsnavn eller --overwrite før aflevering.')
        print(json.dumps(build_pdf(data, output, args.draft), ensure_ascii=False))
    except (ValueError, OSError, zipfile.BadZipFile) as error:
        print('PDF kunne ikke dannes: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
