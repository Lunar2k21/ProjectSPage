#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Project Simracing — zdjęcia podium dla Le Mans Ultimate
=======================================================

Składa kafelki podium z plików gry: przyciemniona panorama toru w tle
i duży render auta (folder UI/start/images/cars/FrontLarge). Wynik:

    assets/img/podium/<nazwa>-1400.webp i <nazwa>-800.webp

Nazwy plików trzeba potem dopisać w config.js (podiumPhotos.lmu.auta)
pod modelem auta, którego dotyczą.

Jak używać
----------
    python3 narzedzia/lmu-podium.py                    # wszystkie z listy AUTA
    python3 narzedzia/lmu-podium.py lmu-bmw-1          # tylko wybrane
    python3 narzedzia/lmu-podium.py --ui /ścieżka/do/UI

Nowy model albo inne malowanie: dopisz linijkę do listy AUTA poniżej
(nazwa pliku, plik auta z gry bez _frontAngle.webp, tor w tle).
Nazwę pliku auta znajdziesz w wynikach LMU (kolumna VehFile w XML) albo
w folderze FrontLarge.
"""
import os, sys
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance
KORZEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI = os.path.join(os.path.dirname(KORZEN), 'LMU', 'UI')
if '--ui' in sys.argv:
    UI = os.path.expanduser(sys.argv[sys.argv.index('--ui') + 1])
UI = os.path.join(UI, 'start', 'images')
CEL = os.path.join(KORZEN, 'assets', 'img', 'podium')
AUTA = [  # nazwa pliku wynikowego, plik auta z gry, tor w tle
 # prawdziwe malowania zespołów
 ('lmu-corvette-1',    '33_25_TFSP8CFFDF39', 'spawec'),       # TF Sport #33
 ('lmu-corvette-2',    '81_25_TFSP2359C8D5', 'lemanswec'),    # TF Sport #81
 ('lmu-bmw-1',         '32_26_WRT_83524148', 'portimaowec'),  # WRT #32
 ('lmu-bmw-2',         '46_25_WRT_596F2E7B', 'fujiwec'),      # WRT #46
 ('lmu-bmw-3',         '31_24_WRT_F2B895A5', 'imolawec'),     # WRT #31
 ('lmu-porsche-1',     '85_25_IRON5675B0BB', 'bahrainwec'),   # Iron Dames #85
 ('lmu-porsche-2',     '92_26_MANT22466058', 'spawec'),       # Manthey #92
 ('lmu-mercedes-1',    '61_25_IRONCD7DD0C0', 'lemanswec'),    # Iron Lynx #61
 ('lmu-mercedes-2',    '60_25_IRONC4D9EC57', 'sebringwec'),   # Iron Lynx #60
 ('lmu-ferrari-1',     '54_25_AFCOC5FA7500', 'monzawec'),     # Vista AF Corse #54
 ('lmu-ferrari-2',     '21_26_AFCO95641716', 'imolawec'),     # AF Corse #21
 ('lmu-aston-1',       '27_26_THOR22130173', 'cotawec'),      # Heart of Racing #27
 ('lmu-aston-2',       '10_25_RSLMA53F60AD', 'portimaowec'),  # Racing Spirit of Léman #10
 ('lmu-mclaren-1',     '59_25_UNITDF975F11', 'interlagoswec'),# United Autosports #59
 ('lmu-mclaren-2',     '95_25_UNIT9DF0EEED', 'fujiwec'),      # United Autosports #95
 ('lmu-mustang-1',     '88_25_PROTEFF5EDCF', 'sebringwec'),   # Proton #88
 ('lmu-mustang-2',     '77_25_PROT192000D7', 'cotawec'),      # Proton #77
 ('lmu-lexus-1',       '78_26_AKKO79996909', 'bahrainwec'),   # Akkodis #78
 ('lmu-lexus-2',       '87_26_AKKO74271960', 'qatarwec'),     # Akkodis #87
 ('lmu-lamborghini-1', '60_24_IRONDCDFC07B', 'spawec'),       # Iron Lynx #60
 ('lmu-lamborghini-2', '85_24_IRON243EA520', 'monzawec'),     # Iron Dames #85
 # „Custom Team" — własny zespół z gry (czarne malowanie z numerem 397)
 ('lmu-corvette-custom',    '397_26_Z06GT3R', 'monzawec'),
 ('lmu-bmw-custom',         '397_26_BMW',     'spawec'),
 ('lmu-porsche-custom',     '397_26_911GT3R', 'qatarwec'),
 ('lmu-mercedes-custom',    '397_26_AMG',     'silverstoneelms'),
 ('lmu-ferrari-custom',     '397_26_296GT3',  'portimaowec'),
 ('lmu-aston-custom',       '397_26_AMV',     'lemanswec'),
 ('lmu-mclaren-custom',     '397_26_MCLAREN', 'imolawec'),
 ('lmu-mustang-custom',     '397_26_MUSTANG', 'fujiwec'),
 ('lmu-lexus-custom',       '397_26_LEXUS',   'interlagoswec'),
 ('lmu-lamborghini-custom', '397_24_HURACAN', 'sebringwec'),
]
W, H = 1400, 788
tla = {}
def tlo(tor):
    if tor not in tla:
        p = Image.open(os.path.join(UI, 'tracks', 'backgrounds', tor + '.webp')).convert('RGB')
        s = H * 1.0 / p.height
        p = p.resize((round(p.width * s), H), Image.LANCZOS)
        x = (p.width - W) // 2
        p = p.crop((x, 0, x + W, H)).filter(ImageFilter.GaussianBlur(2.5))
        p = ImageEnhance.Brightness(p).enhance(0.5)
        nav = Image.new('RGB', (W, H), (11, 17, 28))
        p = Image.blend(p, nav, 0.3)
        tla[tor] = p
    return tla[tor].copy()

only = [a for a in sys.argv[1:] if a.startswith('lmu-')]
for nazwa, veh, tor in AUTA:
    if only and nazwa not in only: continue
    im = tlo(tor)
    auto = Image.open(os.path.join(UI, 'cars', 'FrontLarge', veh + '_frontAngle.webp')).convert('RGBA')
    bb = auto.getbbox(); auto = auto.crop(bb)
    sz = min(1080 / auto.width, 400 / auto.height)
    auto = auto.resize((round(auto.width * sz), round(auto.height * sz)), Image.LANCZOS)
    x = (W - auto.width) // 2; y = 285 - auto.height // 2   # wyżej: dół kafelka zajmuje podpis
    # cień pod autem
    cien = Image.new('L', (W, H), 0)
    ImageDraw.Draw(cien).ellipse((x + 40, y + auto.height - 40, x + auto.width - 40, y + auto.height + 30), fill=170)
    cien = cien.filter(ImageFilter.GaussianBlur(22))
    im.paste((0, 0, 0), (0, 0), cien)
    im.paste(auto, (x, y), auto)
    for w in (1400, 800):
        out = im if w == 1400 else im.resize((800, 450), Image.LANCZOS)
        out.save(os.path.join(CEL, '%s-%d.webp' % (nazwa, w)), 'WEBP', quality=78, method=6)
    print(nazwa)
