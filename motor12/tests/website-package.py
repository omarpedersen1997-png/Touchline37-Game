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
website = '/motor12/'
with ZipFile(Path(sys.argv[1])) as apk:
    names=set(apk.namelist())
    def read(path):
        return apk.read(root+website+path).decode()
    assert '../index.html' in read('play/index.html')
    homepage=read('index.html')
    assert 'scene entrance' in homepage and 'demo-kick' in homepage
    assert '2027-01-01T10:00:00+01:00' in homepage
    for page in ['index.html','play/index.html','contact/index.html','privacy/index.html','delete-account/index.html']:
        parser=LocalLinks()
        parser.feed(read(page))
        for link in parser.links:
            dest=urlsplit(urljoin(website+page,link))
            if dest.scheme:
                assert dest.scheme=='https' and dest.hostname=='playtouchline.dk',link
            else:
                assert root+dest.path in names,link
    for name in ['showcase','engine','loop','pitch','navigation','app']:
        assert root+website+'src/'+name+'.js' in names
    for name in ['stadium-night.webp','match-free-kick.webp','arena.js','arena/player-auto.glb','arena/keeper-auto.glb']:
        assert root+website+'assets/'+name in names
print('BESTÅET: Fire lokale stadionscener, klubhus, hjælpeveje, Motor 12 og 3D-aktiver i den signerede APK.')
