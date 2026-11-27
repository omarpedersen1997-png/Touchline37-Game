"""Check the staged website's offline entry points in the signed Android archive."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from zipfile import ZipFile
import re
import sys


class LocalLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attributes):
        self.links.extend(value for key, value in attributes if key in ('href', 'src') and value)


root = 'assets/public'
website = '/motor12/kampdag/'
with ZipFile(Path(sys.argv[1])) as apk:
    names = set(apk.namelist())
    def read(path):
        return apk.read(root + path).decode()

    club = read('/motor12/play/index.html')
    assert website + 'index.html' in club
    for page in ['index.html', 'contact/index.html', 'privacy/index.html', 'delete-account/index.html']:
        parser = LocalLinks()
        parser.feed(read(website + page))
        for link in parser.links:
            dest = urlsplit(urljoin(website + page, link))
            if dest.scheme:
                assert dest.scheme == 'https' and dest.hostname == 'playtouchline.dk', link
            else:
                assert root + dest.path in names, link
    script = read(website + 'site.js')
    css = read(website + 'site.css')
    assert "'/motor12/play/index.html?demo=1'" in script
    assert website + 'assets/motor12/' in script
    for font in re.findall(r'url\(([^)]+)\)', css):
        assert root + font in names, font
    for name in ['club', 'arena', 'frispark']:
        assert root + website + 'assets/motor12/' + name + '.webp' in names

print('BESTÅET: APK-menu, lokalt hjemmesideudkast, billedgalleri, skrifter, hjælpesider og adgang til Motor 12.')
