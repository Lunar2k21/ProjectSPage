#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Project Simracing — zdjęcia aut WRC do wyników
==============================================

Bierze wycięte auta (PNG z przezroczystym tłem) z folderu „WRC2 Obrazy"
obok repozytorium i robi z nich:

    assets/img/podium/wrc-<auto>-<n>-1400.webp, -800.webp
        kafelki podium: rozmyte ujęcie z odcinka specjalnego (folder WRC2),
        przyciemnione, z pomarańczowym skosem w barwach ligi i autem na środku
    assets/img/wrc/auta/<auto>.webp
        samo auto (przezroczyste tło) do tabel wyników

Szyby w wyciętych autach są przezroczyste — skrypt wypełnia je ciemnym
szkłem, żeby przez okna nie prześwitywało tło.

Jak używać
----------
    python3 narzedzia/wrc-podium.py                # wszystkie auta
    python3 narzedzia/wrc-podium.py skoda toyota   # tylko wybrane

Nowe auto: wrzuć PNG do „WRC2 Obrazy" (nazwa pliku = nazwa auta, np.
peugeot.png), dopisz je w AUTA poniżej i w config.js (podiumPhotos.wrc
oraz autaWRC).
"""
import os, sys
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance, ImageChops

KORZEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STRONA = os.path.dirname(KORZEN)
AUTA_DIR = os.path.join(STRONA, 'WRC2 Obrazy')
TLA_DIR = os.path.join(STRONA, 'WRC2')
PODIUM = os.path.join(KORZEN, 'assets', 'img', 'podium')
MINI = os.path.join(KORZEN, 'assets', 'img', 'wrc', 'auta')

# auto -> trzy tła (pliki z folderu WRC2, auto w kadrze tła zasłania nasze)
AUTA = {
    'skoda':      ['EA_Sports_WRC_Screenshot_2026.08.13_-_12.57.18.15.png',
                   'EA_Sports_WRC_Screenshot_2026.08.13_-_14.52.29.93.png',
                   'Wrc_Screenshot_2025.02.15_-_15.40.19.69.png'],
    'hyundai':    ['EA_Sports_WRC_Screenshot_2026.08.13_-_13.26.35.33.png',
                   'EA_Sports_WRC_Screenshot_2026.08.13_-_15.10.30.03.png',
                   'EA_Sports_WRC_Screenshot_2026.08.13_-_14.10.15.25.png'],
    'citroen':    ['EA_Sports_WRC_Screenshot_2026.08.13_-_14.34.24.91.png',
                   'EA_Sports_WRC_Screenshot_2026.08.13_-_12.57.18.15.png',
                   'EA_Sports_WRC_Screenshot_2026.08.13_-_15.26.41.55.png'],
    'ford':       ['EA_Sports_WRC_Screenshot_2026.08.13_-_15.10.30.03.png',
                   'EA_Sports_WRC_Screenshot_2026.08.13_-_13.21.58.39.png',
                   'Wrc_Screenshot_2025.02.15_-_15.40.19.69.png'],
    'toyota':     ['EA_Sports_WRC_Screenshot_2026.08.13_-_14.52.29.93.png',
                   'EA_Sports_WRC_Screenshot_2026.08.13_-_13.26.35.33.png',
                   'EA_Sports_WRC_Screenshot_2026.08.13_-_12.55.07.52.png'],
    'volkswagen': ['EA_Sports_WRC_Screenshot_2026.08.13_-_13.21.58.39.png',
                   'EA_Sports_WRC_Screenshot_2026.08.13_-_14.34.24.91.png',
                   'EA_Sports_WRC_Screenshot_2026.08.13_-_15.26.41.55.png'],
}
W, H = 1400, 788
POMAR = (237, 71, 3)


def szyby(auto):
    """Wypełnia przezroczyste okna ciemnym szkłem (to, co nie łączy się z tłem)."""
    a = auto.getchannel('A')
    maska = a.point(lambda v: 255 if v > 12 else 0)
    ramka = Image.new('L', (maska.width + 2, maska.height + 2), 0)
    ramka.paste(maska, (1, 1))
    ImageDraw.floodfill(ramka, (0, 0), 128)
    wnetrze = ramka.crop((1, 1, maska.width + 1, maska.height + 1)).point(lambda v: 0 if v == 128 else 255)
    wnetrze = wnetrze.filter(ImageFilter.MinFilter(5))          # bez ciemnej obwódki na krawędzi
    pod = Image.new('RGBA', auto.size, (16, 20, 28, 0))
    pod.putalpha(wnetrze)
    return Image.alpha_composite(pod, auto)


def tlo(plik, wariant):
    im = Image.open(os.path.join(TLA_DIR, plik)).convert('RGB')
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    im = im.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(9))
    im = ImageEnhance.Brightness(im).enhance(0.62)
    im = Image.blend(im, Image.new('RGB', (W, H), (11, 17, 28)), 0.28)
    # pomarańczowy skos jak na plakatach ligi — za autem, co wariant inaczej
    pas = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(pas)
    xs = [880, 220, 1040][wariant % 3]
    d.polygon([(xs, 0), (xs + 70, 0), (xs - 180, H), (xs - 250, H)], fill=150)
    d.polygon([(xs + 100, 0), (xs + 116, 0), (xs - 134, H), (xs - 150, H)], fill=110)
    im.paste(POMAR, (0, 0), pas)
    return im


def main():
    wybrane = [a for a in sys.argv[1:] if a in AUTA] or list(AUTA)
    os.makedirs(PODIUM, exist_ok=True)
    os.makedirs(MINI, exist_ok=True)
    for nazwa in wybrane:
        auto = Image.open(os.path.join(AUTA_DIR, nazwa + '.png')).convert('RGBA')
        auto = auto.crop(auto.getbbox())
        auto = szyby(auto)

        # miniatura do tabel: samo auto, przezroczyste tło
        m = auto.copy(); m.thumbnail((480, 270), Image.LANCZOS)
        m.save(os.path.join(MINI, nazwa + '.webp'), 'WEBP', quality=86, method=6)

        sz = min(980 / auto.width, 520 / auto.height)
        duze = auto.resize((round(auto.width * sz), round(auto.height * sz)), Image.LANCZOS)
        x = (W - duze.width) // 2
        y = 300 - duze.height // 2
        for i, plik in enumerate(AUTA[nazwa], 1):
            im = tlo(plik, i)
            cien = Image.new('L', (W, H), 0)
            ImageDraw.Draw(cien).ellipse((x + 10, y + duze.height - 60, x + duze.width - 10, y + duze.height + 40), fill=225)
            im.paste((0, 0, 0), (0, 0), cien.filter(ImageFilter.GaussianBlur(24)))
            im.paste(duze, (x, y), duze)
            for w in (1400, 800):
                out = im if w == 1400 else im.resize((800, 450), Image.LANCZOS)
                out.save(os.path.join(PODIUM, 'wrc-%s-%d-%d.webp' % (nazwa, i, w)), 'WEBP', quality=78, method=6)
        print(nazwa)


if __name__ == '__main__':
    main()
