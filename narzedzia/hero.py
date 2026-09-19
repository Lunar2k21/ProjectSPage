#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Przygotowuje zdjęcie tła slajdu na stronie głównej.

    python3 narzedzia/hero.py wrc "moje zdjecie.jpg"

Z jednego pliku robi komplet, którego oczekuje strona:

    assets/img/hero/wrc-1280.webp
    assets/img/hero/wrc-1920.webp
    assets/img/hero/wrc-2560.webp
    assets/img/hero/wrc-lqip.webp   (rozmazana plamka, ładowana zanim
                                     dojdzie duże zdjęcie)

Nazwa (pierwszy argument) to `image` ze slajdu w assets/js/config.js.
Zdjęcie jest przycinane do kadru 16:9 — środek kadru zostaje, góra i dół
albo boki są ucinane. Chcesz inny wycinek: przytnij plik wcześniej.
"""
import os
import sys

try:
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit('Brakuje biblioteki Pillow:  pip install pillow')

SZEROKOSCI = [2560, 1920, 1280]
PROPORCJA = 16 / 9
JAKOSC = 82
KATALOG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       'assets', 'img', 'hero')


def kadruj(im):
    """Przycina do 16:9 względem środka."""
    szer, wys = im.size
    if szer / wys > PROPORCJA:
        nowa = int(round(wys * PROPORCJA))
        lewy = (szer - nowa) // 2
        return im.crop((lewy, 0, lewy + nowa, wys))
    nowa = int(round(szer / PROPORCJA))
    gora = (wys - nowa) // 2
    return im.crop((0, gora, szer, gora + nowa))


def main():
    if len(sys.argv) != 3:
        sys.exit('Użycie:  python3 narzedzia/hero.py <nazwa> <plik ze zdjęciem>')

    nazwa, zrodlo = sys.argv[1], sys.argv[2]
    if not os.path.exists(zrodlo):
        sys.exit('Nie ma takiego pliku: %s' % zrodlo)

    im = Image.open(zrodlo)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    im = kadruj(im)

    if im.width < max(SZEROKOSCI):
        print('  uwaga: zdjęcie ma tylko %d px szerokości — największy rozmiar '
              'zostanie powiększony i może być miękki.' % im.width)

    os.makedirs(KATALOG, exist_ok=True)

    for szer in SZEROKOSCI:
        kopia = im.resize((szer, int(round(szer / PROPORCJA))), Image.LANCZOS)
        plik = os.path.join(KATALOG, '%s-%d.webp' % (nazwa, szer))
        kopia.save(plik, 'WEBP', quality=JAKOSC, method=6)
        print('  %s  (%d×%d, %.0f kB)' % (os.path.basename(plik), kopia.width,
                                          kopia.height,
                                          os.path.getsize(plik) / 1024))

    maly = im.resize((32, 18), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    plik = os.path.join(KATALOG, '%s-lqip.webp' % nazwa)
    maly.save(plik, 'WEBP', quality=40, method=6)
    print('  %s  (podgląd, %.0f B)' % (os.path.basename(plik),
                                       os.path.getsize(plik)))

    print('Gotowe. W config.js slajd ma mieć  image: \'%s\'.' % nazwa)


if __name__ == '__main__':
    main()
