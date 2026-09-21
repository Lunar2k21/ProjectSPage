#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Project Simracing — obrazy do wyników Le Mans Ultimate
======================================================

Gra trzyma rendery wszystkich aut, logotypy marek i panoramy torów
w swoim folderze UI. Ten skrypt wybiera z niego tylko to, czego potrzebują
konkretne pliki wyników (.xml z folderu UserData/Log/Results), i kładzie
w assets/img/lmu/ w lekkiej postaci:

    assets/img/lmu/auta/<plik .VEH>.webp    render auta z przodu, 380×152
    assets/img/lmu/marki/<marka>.svg|webp  logotyp producenta
    assets/img/lmu/tory/<tor>.svg          logotyp toru
    assets/img/lmu/tory/<tor>-tlo.webp     panorama toru, 1920×360

Na koniec zapisuje assets/js/lmu-zasoby.js — spis tego, co jest na
miejscu. Strona wyników sprawdza w nim, czy ma obraz auta, i jeśli nie,
pokazuje logo marki zamiast pustego miejsca.

Jak używać
----------
    python3 narzedzia/lmu-zasoby.py wyniki1.xml wyniki2.xml
    python3 narzedzia/lmu-zasoby.py --folder ~/LMU/Results
    python3 narzedzia/lmu-zasoby.py --wszystkie          # wszystkie auta z gry (~5,5 MB)

Polecane: --wszystkie. Każde malowanie ma w grze osobny plik, więc
wyniki z innego wyścigu prawie zawsze mają auta, których jeszcze nie ma.

Folder gry domyślnie szukany jest w ../LMU/UI (obok repozytorium);
inny podajesz przez --ui /ścieżka/do/UI.
"""

import io
import json
import os
import re
import shutil
import sys
import xml.etree.ElementTree as ET

try:
    from PIL import Image
except ImportError:
    sys.exit('Brakuje biblioteki Pillow:  pip3 install pillow')

KORZEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CEL    = os.path.join(KORZEN, 'assets', 'img', 'lmu')
SPIS   = os.path.join(KORZEN, 'assets', 'js', 'lmu-zasoby.js')

# Grafika rysuje auto na 190 px, strona na 150 — 380 px starcza z zapasem
# na ekrany o podwójnej gęstości, a waży pięć razy mniej niż oryginał.
SZER_AUTA = 380

# Marki w kolejności dopasowania — dłuższe nazwy przed krótszymi,
# „Chevrolet Corvette" ma dostać logo Corvette, nie Chevroleta.
MARKI = [
    ('Chevrolet Corvette', 'Corvette'), ('Corvette', 'Corvette'),
    ('Aston Martin', 'Aston Martin'), ('Isotta Fraschini', 'Isotta Fraschini'),
    ('Mercedes', 'Mercedes-AMG'), ('McLaren', 'McLaren'), ('Ferrari', 'Ferrari'),
    ('Porsche', 'Porsche'), ('Lamborghini', 'Lamborghini'), ('BMW', 'BMW'),
    ('Ford', 'Ford'), ('Lexus', 'Lexus'), ('Toyota', 'Toyota'), ('Cadillac', 'Cadillac'),
    ('Peugeot', 'Peugeot'), ('Alpine', 'Alpine'), ('Glickenhaus', 'Glickenhaus'),
    ('Vanwall', 'Vanwall'), ('Oreca', 'Oreca'), ('Ligier', 'Ligier'),
    ('Genesis', 'Genesis'), ('Duqueine', 'Duqueine'), ('Ginetta', 'Ginetta'),
    ('ADESS', 'ADESS'), ('Chevrolet', 'Chevrolet'),
]


def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')


def gotowe(cel):
    """Obraz już jest we właściwym rozmiarze (a nie ucięty przerwanym zapisem)."""
    try:
        with Image.open(cel) as im:
            im.load()
            return im.width == SZER_AUTA
    except Exception:
        return False


def marka(car_type):
    for przedrostek, nazwa in MARKI:
        if (car_type or '').lower().startswith(przedrostek.lower()):
            return nazwa
    return ''


def wczytaj_xml(sciezka):
    tekst = io.open(sciezka, encoding='utf-8', errors='replace').read()
    tekst = re.sub(r'<!DOCTYPE.*?\]>', '', tekst, flags=re.S)
    return ET.fromstring(tekst)


def z_plikow(pliki):
    """Zwraca (zbiór plików .VEH, zbiór marek) użytych w wynikach."""
    auta, marki = set(), set()
    for p in pliki:
        try:
            korzen = wczytaj_xml(p)
        except Exception as e:
            print('  ! nie umiem przeczytać %s (%s)' % (p, e))
            continue
        for d in korzen.iter('Driver'):
            veh = (d.findtext('VehFile') or '').strip()
            if veh:
                auta.add(os.path.splitext(veh)[0])
            m = marka(d.findtext('CarType'))
            if m:
                marki.add(m)
        print('  %s: %d kierowców' % (os.path.basename(p), len(list(korzen.iter('Driver')))))
    return auta, marki


def main():
    argumenty = sys.argv[1:]
    ui = os.path.join(os.path.dirname(KORZEN), 'LMU', 'UI')
    if '--ui' in argumenty:
        ui = os.path.expanduser(argumenty[argumenty.index('--ui') + 1])
    obrazy = os.path.join(ui, 'start', 'images')
    if not os.path.isdir(obrazy):
        sys.exit('Nie widzę folderu gry: %s\nPodaj go przez --ui /ścieżka/do/UI' % obrazy)

    pliki = [a for a in argumenty if a.lower().endswith('.xml')]
    if '--folder' in argumenty:
        f = os.path.expanduser(argumenty[argumenty.index('--folder') + 1])
        pliki += [os.path.join(f, n) for n in sorted(os.listdir(f)) if n.lower().endswith('.xml')]

    for k in ('auta', 'marki', 'tory'):
        os.makedirs(os.path.join(CEL, k), exist_ok=True)

    # --- auta ---------------------------------------------------------
    zrodlo_aut = os.path.join(obrazy, 'cars', 'FrontThumbnail')
    if '--wszystkie' in argumenty:
        auta = {n.replace('_frontAngle.webp', '') for n in os.listdir(zrodlo_aut) if n.endswith('_frontAngle.webp')}
        marki = {m for _, m in MARKI}
    else:
        auta, marki = z_plikow(pliki)
        if not pliki:
            print('Nie podano żadnego pliku wyników — dokładam tylko tory i spis.')

    dodane = 0
    for veh in sorted(auta):
        cel = os.path.join(CEL, 'auta', veh + '.webp')
        if gotowe(cel):
            continue
        zr = os.path.join(zrodlo_aut, veh + '_frontAngle.webp')
        if not os.path.exists(zr):
            print('  ! brak renderu auta %s — strona pokaże logo marki' % veh)
            continue
        im = Image.open(zr)
        im = im.resize((SZER_AUTA, round(SZER_AUTA * im.height / im.width)), Image.LANCZOS)
        im.save(cel, 'WEBP', quality=80, method=6)
        dodane += 1
    print('Auta: dodane %d, razem w folderze %d' % (dodane, len(os.listdir(os.path.join(CEL, 'auta')))))

    # --- marki --------------------------------------------------------
    zrodlo_marek = os.path.join(obrazy, 'manufacturer')
    for m in sorted(marki):
        svg = os.path.join(zrodlo_marek, 'Brand=%s.svg' % m)
        png = os.path.join(zrodlo_marek, 'Brand=%s.png' % m)
        cel_svg = os.path.join(CEL, 'marki', slug(m) + '.svg')
        cel_webp = os.path.join(CEL, 'marki', slug(m) + '.webp')
        if os.path.exists(cel_svg) or os.path.exists(cel_webp):
            continue
        # SVG z wklejoną bitmapą waży setki kilobajtów — wtedy lepszy mały WebP
        if os.path.exists(svg) and os.path.getsize(svg) < 120 * 1024:
            shutil.copy2(svg, cel_svg)
        elif os.path.exists(png):
            im = Image.open(png).convert('RGBA')
            im.thumbnail((160, 160), Image.LANCZOS)
            im.save(cel_webp, 'WEBP', quality=90)
        elif os.path.exists(svg):
            shutil.copy2(svg, cel_svg)
        else:
            print('  ! brak logo marki %s' % m)

    # --- tory: logo i panorama ----------------------------------------
    logo_torow = os.path.join(obrazy, 'tracks', 'logos')
    tla_torow = os.path.join(obrazy, 'tracks', 'backgrounds')
    for n in sorted(os.listdir(logo_torow)):
        if not n.endswith('.svg') or n.startswith('Circuit='):
            continue
        cel = os.path.join(CEL, 'tory', n)
        if not os.path.exists(cel):
            shutil.copy2(os.path.join(logo_torow, n), cel)
    if os.path.isdir(tla_torow):
        for n in sorted(os.listdir(tla_torow)):
            cel = os.path.join(CEL, 'tory', n.replace('.webp', '-tlo.webp'))
            if os.path.exists(cel):
                continue
            im = Image.open(os.path.join(tla_torow, n)).convert('RGB')
            im = im.resize((1920, int(1920 * im.height / im.width)), Image.LANCZOS)
            im.save(cel, 'WEBP', quality=72, method=6)

    # --- spis ---------------------------------------------------------
    spis = {
        'auta': sorted(os.path.splitext(n)[0] for n in os.listdir(os.path.join(CEL, 'auta'))),
        'marki': {os.path.splitext(n)[0]: n for n in sorted(os.listdir(os.path.join(CEL, 'marki')))},
        'tory': sorted(n[:-4] for n in os.listdir(os.path.join(CEL, 'tory')) if n.endswith('.svg')),
        'tla': sorted(n[:-9] for n in os.listdir(os.path.join(CEL, 'tory')) if n.endswith('-tlo.webp')),
    }
    io.open(SPIS, 'w', encoding='utf-8').write(
        '/* Spis obrazów do wyników LMU — powstaje z narzedzia/lmu-zasoby.py.\n'
        '   Nie edytuj ręcznie. */\n'
        'window.LMU_ZASOBY = %s;\n' % json.dumps(spis, ensure_ascii=False, indent=1))

    rozmiar = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(CEL) for f in fs)
    print('Marki: %d · tory: %d (panoramy: %d) · razem %.1f MB'
          % (len(spis['marki']), len(spis['tory']), len(spis['tla']), rozmiar / 1048576.0))


if __name__ == '__main__':
    main()
