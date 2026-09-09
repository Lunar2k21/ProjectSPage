#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Project Simracing — jednorazowy import PDF-a do pliku .md
=========================================================

Do czego to służy
-----------------
PDF nie wie, co jest listą, a co tabelą — to tylko tekst rozmieszczony
na kartce. Dlatego nie próbujemy czytać PDF-ów przy każdej publikacji.
Ten skrypt uruchamiasz RAZ na dokument: robi z niego folder z plikiem
.md i obrazami, który poprawiasz ręcznie i od tej pory to on jest
źródłem. Stronę buduje potem narzedzia/buduj.py.

Jak używać
----------
    python3 narzedzia/pdf-na-md.py regulamin.pdf
    python3 narzedzia/pdf-na-md.py artykul.pdf --dzial artykuly

Powstaje:
    tresci/<dzial>/<nazwa>/tekst.md
    tresci/<dzial>/<nazwa>/Obraz 1.webp, Obraz 2.webp, …

Po imporcie warto przejrzeć plik .md: sprawdzić nagłówki, scalone
tabele i nazwy obrazów. Nazwa pliku obrazu jest jego podpisem na
stronie, więc „Obraz 1.webp" wypada zmienić na coś sensownego.
"""

import io
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import unicodedata
from datetime import datetime

try:
    import pdfplumber
except ImportError:
    sys.exit('Brakuje biblioteki pdfplumber:  pip3 install pdfplumber')

try:
    from PIL import Image
except ImportError:
    sys.exit('Brakuje biblioteki Pillow:  pip3 install pillow')

KORZEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRESCI = os.path.join(KORZEN, 'tresci')

DPI          = 150          # rozdzielczość renderowania stron (do wycinania obrazów)
SZER_OBRAZU  = 1200         # maksymalna szerokość zapisywanego obrazu
MIN_OBRAZ_PX = 90           # mniejsze wycinki (ikonki, linie) pomijamy
JAKOSC       = 82

PUNKTORY = ('•', '‣', '▪', '●', '·', '–', '—', '-', '*', '')
NUMEROWANY = re.compile(r'^\(?\d+[.)]\s+')

# Niektóre PDF-y nie mają mapowania znaku punktora i pdfplumber zwraca
# go jako „(cid:127)". Zamieniamy takie kody na zwykłą kropkę listy.
CID = re.compile(r'\(cid:\d+\)')


def bez_cid(tekst):
    t = CID.sub('\u2022', tekst).strip()
    return re.sub(r'^\u2022(\s*\u2022)+', '\u2022', t)


# ----------------------------------------------------------------------
# drobiazgi
# ----------------------------------------------------------------------
def slug(tekst):
    t = unicodedata.normalize('NFKD', tekst).encode('ascii', 'ignore').decode()
    t = re.sub(r'[^a-zA-Z0-9]+', '-', t).strip('-').lower()
    return t or 'dokument'


def rozmiar_linii(linia):
    znaki = linia.get('chars') or []
    if not znaki:
        return 0.0
    return round(statistics.median([c.get('size', 0) for c in znaki]), 2)


def pogrubiona(linia):
    znaki = linia.get('chars') or []
    if not znaki:
        return False
    grube = sum(1 for c in znaki if 'bold' in str(c.get('fontname', '')).lower())
    return grube > len(znaki) * 0.6


def scal_myslnik(a, b):
    """Łączy przeniesienie wyrazu na nową linię."""
    if a.endswith('-') and not a.endswith('--'):
        return a[:-1] + b
    return a + ' ' + b


# ----------------------------------------------------------------------
# czytanie jednej strony
# ----------------------------------------------------------------------
def linie_z(obszar):
    """Wiersze tekstu z podanego kawałka strony."""
    try:
        linie = obszar.extract_text_lines(layout=False, strip=True, return_chars=True)
    except TypeError:                                  # starsze pdfplumber
        linie = obszar.extract_text_lines()
    out = []
    for l in linie:
        tekst = bez_cid((l.get('text') or '').strip())
        if not tekst:
            continue
        out.append({
            'text': tekst,
            'top': float(l.get('top', 0)),
            'bottom': float(l.get('bottom', 0)),
            'x0': float(l.get('x0', 0)),
            'x1': float(l.get('x1', 0)),
            'size': rozmiar_linii(l),
            'bold': pogrubiona(l),
        })
    return out


def przerwy_pionowe(strona, slowa):
    """Pionowe korytarze bez tekstu, czyli granice łamów.

    Bez tego dwułamowy skład czyta się na przemian z lewej i prawej
    strony — zdania mieszają się w kaszę."""
    if len(slowa) < 60:
        return []

    krok = 1.5
    kubelki = [0] * (int(strona.width / krok) + 2)
    for w in slowa:
        a = max(0, int(w['x0'] / krok))
        b = min(len(kubelki) - 1, int(w['x1'] / krok))
        for i in range(a, b + 1):
            kubelki[i] += 1

    # Korytarz między łamami bywa wąski — w gazetowym składzie to raptem
    # kilka punktów. Liczy się nie tyle szerokość, co to, że jest pusty
    # na całej wysokości strony.
    od, do = int(len(kubelki) * 0.12), int(len(kubelki) * 0.88)
    przerwy, start = [], None
    for i in range(od, do + 1):
        if kubelki[i] == 0:
            if start is None:
                start = i
        elif start is not None:
            if (i - start) * krok >= 5:
                przerwy.append((start * krok, i * krok))
            start = None
    if start is not None and (do - start) * krok >= 5:
        przerwy.append((start * krok, do * krok))

    # korytarz jest granicą łamów tylko wtedy, gdy po obu stronach
    # naprawdę stoi tekst
    dobre = []
    for (x0, x1) in przerwy[:3]:
        lewo  = sum(1 for w in slowa if w['x1'] <= x0)
        prawo = sum(1 for w in slowa if w['x0'] >= x1)
        if lewo > len(slowa) * 0.15 and prawo > len(slowa) * 0.15:
            dobre.append((x0, x1))
    return dobre


def pasy_przez_cala_szerokosc(slowa, przerwy):
    """Wiersze idące przez łamy — tytuły i śródtytuły na całą szerokość.

    Zwykły wiersz mieści się w jednym łamie. Wiersz „przez całą stronę"
    rozpoznajemy dwojako: albo któreś słowo leży na korytarzu, albo
    wiersz jest wyraźnie większym pismem i ciągnie się przez łamy —
    tak wygląda tytuł gazetowego artykułu."""
    pasy = []
    for w in slowa:
        for (x0, x1) in przerwy:
            if w['x0'] < x1 and w['x1'] > x0:
                pasy.append([float(w['top']) - 1, float(w['bottom']) + 1])
                break

    rozmiary = [float(w.get('size') or 0) for w in slowa if w.get('size')]
    if rozmiary:
        zwykly = statistics.median(rozmiary)
        wiersze = {}
        for w in slowa:
            klucz = round(float(w['top']) / 3.0)
            wiersze.setdefault(klucz, []).append(w)

        for grupa in wiersze.values():
            duze = [float(w.get('size') or 0) for w in grupa]
            if not duze or statistics.median(duze) < zwykly * 1.15:
                continue
            for (x0, x1) in przerwy:
                if (any(w['x1'] <= x0 for w in grupa) and any(w['x0'] >= x1 for w in grupa)):
                    pasy.append([min(float(w['top']) for w in grupa) - 1,
                                 max(float(w['bottom']) for w in grupa) + 1])
                    break

    pasy.sort()

    scalone = []
    for pas in pasy:
        if scalone and pas[0] <= scalone[-1][1] + 2:
            scalone[-1][1] = max(scalone[-1][1], pas[1])
        else:
            scalone.append(pas)
    return scalone


def linie_strony(strona):
    """Wiersze strony w kolejności czytania — z uwzględnieniem łamów.

    Zwraca (linie, czy_lamy). Przy jednym łamie czytamy stronę jak
    leci; przy dwóch — pas po pasie, w każdym najpierw lewy łam."""
    try:
        slowa = strona.extract_words(extra_attrs=['size']) or []
    except Exception:
        slowa = strona.extract_words() or []
    przerwy = przerwy_pionowe(strona, slowa)
    if not przerwy:
        return linie_z(strona), False

    kolumny, lewa = [], 0.0
    for (x0, x1) in przerwy:
        kolumny.append((lewa, x0))
        lewa = x1
    kolumny.append((lewa, float(strona.width)))

    pasy = pasy_przez_cala_szerokosc(slowa, przerwy)
    wys = float(strona.height)

    def wytnij(x0, top, x1, bottom):
        x0, x1 = max(0.0, x0), min(float(strona.width), x1)
        top, bottom = max(0.0, top), min(wys, bottom)
        if x1 - x0 < 5 or bottom - top < 5:
            return []
        try:
            return linie_z(strona.crop((x0, top, x1, bottom)))
        except Exception:
            return []

    out, y = [], 0.0
    for pas in pasy + [[wys, wys]]:
        gora, dol = pas[0], pas[1]
        if gora - y > 4:
            for (kx0, kx1) in kolumny:
                out += wytnij(kx0, y, kx1, gora)
        if dol > gora:
            out += wytnij(0, gora, float(strona.width), dol)
        y = dol

    return out, True


def tabele_strony(strona):
    """Tabele bierzemy tylko tam, gdzie naprawdę są linie siatki —
    inaczej pdfplumber „znajduje" tabelę w zwykłym akapicie."""
    if len(strona.lines or []) < 4 and len(strona.rects or []) < 4:
        return []
    znalezione = []
    try:
        for t in strona.find_tables():
            dane = [[(c or '').strip() for c in w] for w in (t.extract() or [])]
            dane = [w for w in dane if any(w)]
            if len(dane) < 2:
                continue
            znalezione.append({'bbox': t.bbox, 'rows': dane, 'top': float(t.bbox[1])})
    except Exception:
        pass
    return znalezione


def scal_prostokaty(boxy, luz=12):
    """Kilka wycinków obok siebie to zwykle jeden obrazek."""
    boxy = sorted(boxy, key=lambda b: (b[1], b[0]))
    out = []
    for b in boxy:
        dolaczony = False
        for i, a in enumerate(out):
            if (b[0] < a[2] + luz and a[0] < b[2] + luz and
                    b[1] < a[3] + luz and a[1] < b[3] + luz):
                out[i] = (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))
                dolaczony = True
                break
        if not dolaczony:
            out.append(tuple(b))
    return out


def render_strony(pdf, nr, dpi=DPI):
    """Renderuje jedną stronę do PNG (poppler) i zwraca obraz PIL."""
    baza = os.path.join('/tmp', 'psr-strona')
    subprocess.run(['pdftoppm', '-png', '-r', str(dpi), '-f', str(nr), '-l', str(nr),
                    pdf, baza], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for kandydat in (f'{baza}-{nr}.png', f'{baza}-{nr:02d}.png', f'{baza}-{nr:03d}.png'):
        if os.path.exists(kandydat):
            im = Image.open(kandydat).convert('RGB')
            dane = io.BytesIO()
            im.save(dane, 'PNG')
            os.remove(kandydat)
            return Image.open(dane)
    return None


def obrazy_strony(strona, pdf, nr, folder, licznik):
    """Wycina obrazy ze strony i zapisuje jako WebP."""
    boxy = []
    for im in (strona.images or []):
        x0, top, x1, bottom = im['x0'], im['top'], im['x1'], im['bottom']
        if (x1 - x0) < 24 or (bottom - top) < 24:
            continue
        boxy.append((x0, top, x1, bottom))
    if not boxy:
        return []

    boxy = scal_prostokaty(boxy)
    render = render_strony(pdf, nr)
    if render is None:
        return []

    skala = render.width / float(strona.width)
    out = []
    for box in boxy:
        x0, top, x1, bottom = [v * skala for v in box]
        x0, top = max(0, int(x0)), max(0, int(top))
        x1, bottom = min(render.width, int(x1)), min(render.height, int(bottom))
        if x1 - x0 < MIN_OBRAZ_PX or bottom - top < MIN_OBRAZ_PX:
            continue

        wycinek = render.crop((x0, top, x1, bottom))
        if wycinek.width > SZER_OBRAZU:
            h = int(wycinek.height * SZER_OBRAZU / wycinek.width)
            wycinek = wycinek.resize((SZER_OBRAZU, h), Image.LANCZOS)

        licznik[0] += 1
        nazwa = 'Obraz %d.webp' % licznik[0]
        wycinek.save(os.path.join(folder, nazwa), 'WEBP', quality=JAKOSC, method=5)
        out.append({'top': box[1], 'blok': {'t': 'img', 'src': nazwa,
                                            'w': wycinek.width, 'h': wycinek.height}})
    return out


# ----------------------------------------------------------------------
# składanie bloków treści
# ----------------------------------------------------------------------
def bloki_z_linii(linie, body, wysokosc_linii):
    bloki, akapit, lista, rodzaj_listy = [], [], [], 'ul'

    def zamknij_akapit():
        if akapit:
            bloki.append({'t': 'p', 'x': ' '.join(akapit).strip()})
            del akapit[:]

    def zamknij_liste():
        if lista:
            bloki.append({'t': rodzaj_listy, 'items': list(lista)})
            del lista[:]

    poprzednia = None
    for l in linie:
        tekst, rozmiar = l['text'], l['size']

        # nagłówek — większa czcionka albo krótka pogrubiona linia
        naglowek = None
        if rozmiar >= body * 1.28:
            naglowek = 'h2'
        elif rozmiar >= body * 1.1 or (l['bold'] and len(tekst) < 90 and not tekst.endswith('.')):
            naglowek = 'h3'

        punktor = tekst[:1] in PUNKTORY and len(tekst) > 2
        numer = bool(NUMEROWANY.match(tekst))

        if naglowek and not punktor:
            zamknij_akapit(); zamknij_liste()
            czysty = tekst.lstrip('•‣▪●· ').strip()
            odstep = (l['top'] - poprzednia['bottom']) if poprzednia else 999

            # nagłówek złamany na dwie linie to wciąż jeden nagłówek
            if (bloki and bloki[-1]['t'] == naglowek
                    and 0 <= odstep < wysokosc_linii * 0.9):
                bloki[-1]['x'] = scal_myslnik(bloki[-1]['x'], czysty)
            else:
                bloki.append({'t': naglowek, 'x': czysty})
            poprzednia = l
            continue

        if punktor or numer:
            zamknij_akapit()
            if lista and ((numer and rodzaj_listy == 'ul') or (punktor and rodzaj_listy == 'ol')):
                zamknij_liste()
            rodzaj_listy = 'ol' if numer else 'ul'
            lista.append(NUMEROWANY.sub('', tekst.lstrip('•‣▪●·-–— ').strip()))
            poprzednia = l
            continue

        # Dalszy ciąg punktu listy. W wielu regulaminach kolejne wiersze
        # punktu wracają do lewego marginesu, więc samo wcięcie nie
        # wystarczy — patrzymy też, czy punkt jest niedokończony albo czy
        # wiersz zaczyna się małą literą.
        if lista and poprzednia:
            odstep = l['top'] - poprzednia['bottom']
            wciecie = l['x0'] > poprzednia['x0'] + 4
            mala = tekst[:1].islower()
            niedokonczony = not re.search(r'[.:;!?]$', lista[-1])
            if (-wysokosc_linii < odstep < wysokosc_linii * 1.4
                    and (wciecie or mala or niedokonczony)):
                lista[-1] = scal_myslnik(lista[-1], tekst)
                poprzednia = l
                continue

        zamknij_liste()
        przerwa = (l['top'] - poprzednia['bottom']) if poprzednia else 0
        # skok w górę = przeskok do następnego łamu, więc też nowy akapit
        if akapit and (przerwa > wysokosc_linii * 0.9 or przerwa < -wysokosc_linii):
            zamknij_akapit()
        if akapit:
            akapit[-1] = scal_myslnik(akapit[-1], tekst)
        else:
            akapit.append(tekst)
        poprzednia = l

    zamknij_akapit(); zamknij_liste()
    return bloki


def bloki_z_lamow(linie, elementy, body, wys_linii):
    """Składa stronę łamaną na kolumny: obraz albo tabelę wstawiamy tam,
    gdzie w kolejności czytania zaczyna się tekst pod nią."""
    miejsca = {}
    for n, e in enumerate(elementy):
        srodek = (e.get('x0', 0) + e.get('x1', 0)) / 2.0 if e.get('x1') else None
        idx = len(linie)
        for i, l in enumerate(linie):
            if l['top'] < e.get('bottom', e['top']) - 1:
                continue
            if srodek is not None and not (l['x0'] - 60 <= srodek <= l['x1'] + 60):
                continue
            idx = i
            break
        miejsca.setdefault(idx, []).append(n)

    out, kawalek = [], []
    for i, l in enumerate(linie):
        if i in miejsca:
            out += bloki_z_linii(kawalek, body, wys_linii); kawalek = []
            for n in miejsca[i]:
                out.append(elementy[n]['blok'])
        kawalek.append(l)

    out += bloki_z_linii(kawalek, body, wys_linii)
    for n in miejsca.get(len(linie), []):
        out.append(elementy[n]['blok'])
    return out


def powtarzalne(strony):
    """Nagłówki i stopki powtarzające się na większości stron."""
    if len(strony) < 3:
        return set()
    from collections import Counter
    licz = Counter()
    for linie in strony:
        for l in linie[:2] + linie[-2:]:
            licz[l['text'].strip()] += 1
    prog = max(2, int(len(strony) * 0.6))
    return {t for t, n in licz.items() if n >= prog}


def przerob(pdf_path, folder_img):
    """Czyta PDF i zwraca (bloki, liczba stron). Obrazy zapisuje w folderze
    dokumentu — ich nazwy plików staną się podpisami na stronie."""
    os.makedirs(folder_img, exist_ok=True)

    bloki_all, licznik = [], [0]
    with pdfplumber.open(pdf_path) as pdf:
        odczyt       = [linie_strony(s) for s in pdf.pages]
        strony_linie = [o[0] for o in odczyt]
        lamy_strony  = [o[1] for o in odczyt]
        smieci = powtarzalne(strony_linie)

        rozmiary = [l['size'] for linie in strony_linie for l in linie if l['size']]
        body = statistics.median(rozmiary) if rozmiary else 11.0
        wysokosci = [l['bottom'] - l['top'] for linie in strony_linie for l in linie]
        wys_linii = statistics.median(wysokosci) if wysokosci else body * 1.2

        for nr, strona in enumerate(pdf.pages, start=1):
            linie = strony_linie[nr - 1]
            tabele = tabele_strony(strona)

            # linie wewnątrz tabel pomijamy, żeby treść się nie dublowała
            def w_tabeli(l):
                for t in tabele:
                    x0, top, x1, bottom = t['bbox']
                    if l['top'] >= top - 2 and l['bottom'] <= bottom + 2:
                        return True
                return False

            linie = [l for l in linie
                     if l['text'].strip() not in smieci
                     and not re.fullmatch(r'[-–—\s]*\d{1,3}[-–—\s]*', l['text'].strip())
                     and not w_tabeli(l)]

            dwa_lamy = lamy_strony[nr - 1]

            elementy = []
            for t in tabele:
                elementy.append({'top': t['top'], 'bottom': float(t['bbox'][3]),
                                 'x0': float(t['bbox'][0]), 'x1': float(t['bbox'][2]),
                                 'blok': {'t': 'table', 'rows': t['rows']}})
            elementy += obrazy_strony(strona, pdf_path, nr, folder_img, licznik)

            if not elementy:
                bloki_all += bloki_z_linii(linie, body, wys_linii)
                continue

            # Przy dwóch łamach kolejność pionowa nic nie mówi o kolejności
            # czytania, więc obrazy sprzed pierwszej linijki idą na górę,
            # a reszta pod tekst strony.
            if dwa_lamy:
                bloki_all += bloki_z_lamow(linie, elementy, body, wys_linii)
                continue

            # tekst wplatamy między tabele i obrazy według położenia na stronie
            elementy.sort(key=lambda e: e['top'])
            kursor = 0
            for e in elementy:
                czesc = [l for l in linie[kursor:] if l['top'] < e['top']]
                kursor += len(czesc)
                bloki_all += bloki_z_linii(czesc, body, wys_linii)
                bloki_all.append(e['blok'])
            bloki_all += bloki_z_linii(linie[kursor:], body, wys_linii)

        stron = len(pdf.pages)

    return scal_tabele(bloki_all), stron


def scal_tabele(bloki):
    """Tabela przecięta podziałem strony wraca do jednego kawałka.

    W PDF-ie taka tabela to dwa osobne obiekty; jeżeli stoją tuż obok
    siebie i mają tyle samo kolumn, to jest jedna tabela."""
    out = []
    for b in bloki:
        if b['t'] == 'table' and out and out[-1]['t'] == 'table':
            a = out[-1]
            if a['rows'] and b['rows'] and len(a['rows'][0]) == len(b['rows'][0]):
                nowe = b['rows'][1:] if b['rows'][0] == a['rows'][0] else b['rows']
                a['rows'] += nowe
                continue
        out.append(b)
    return out


# ----------------------------------------------------------------------
# zapis do Markdowna
# ----------------------------------------------------------------------
def na_md(bloki):
    czesci = []
    for b in bloki:
        t = b['t']
        if t == 'h2':
            czesci.append('## ' + b['x'])
        elif t == 'h3':
            czesci.append('### ' + b['x'])
        elif t == 'p':
            czesci.append(b['x'])
        elif t == 'ul':
            czesci.append('\n'.join('- ' + i for i in b['items']))
        elif t == 'ol':
            czesci.append('\n'.join('%d. %s' % (n + 1, i) for n, i in enumerate(b['items'])))
        elif t == 'img':
            czesci.append('![](%s)' % b['src'])
        elif t == 'table':
            rows = b['rows']
            if not rows:
                continue
            szer = max(len(w) for w in rows)
            def wiersz(w):
                w = list(w) + [''] * (szer - len(w))
                return '| ' + ' | '.join(c.replace('|', '\\|') for c in w) + ' |'
            czesci.append('\n'.join([wiersz(rows[0]),
                                     '|' + '---|' * szer] +
                                    [wiersz(w) for w in rows[1:]]))
    return '\n\n'.join(czesci) + '\n'


def main():
    pliki = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not pliki:
        print(__doc__)
        return

    dzial = 'regulaminy'
    if '--dzial' in sys.argv:
        dzial = sys.argv[sys.argv.index('--dzial') + 1]

    for pdf_path in pliki:
        if not os.path.exists(pdf_path):
            print('Nie ma pliku:', pdf_path)
            continue

        nazwa = os.path.splitext(os.path.basename(pdf_path))[0]
        id_dok = slug(nazwa)
        auto = dzial
        if '--dzial' not in sys.argv and 'regulamin' not in id_dok:
            auto = 'artykuly'

        folder = os.path.join(TRESCI, auto, id_dok)
        os.makedirs(folder, exist_ok=True)

        print('Czytam %s…' % os.path.basename(pdf_path))
        bloki, stron = przerob(pdf_path, folder)

        tytul = ''
        for b in bloki:
            if b['t'] in ('h2', 'h3') and b.get('x'):
                tytul = b['x']
                bloki.remove(b)
                break
        if not tytul:
            tytul = nazwa.replace('_', ' ').replace('-', ' ').strip()

        data = datetime.fromtimestamp(os.path.getmtime(pdf_path)).strftime('%Y-%m-%d')
        naglowek = ('---\n'
                    'tytul: %s\n'
                    'data: %s\n'
                    'opis:\n'
                    'seria:\n'
                    '---\n\n' % (tytul, data))

        cel = os.path.join(folder, 'tekst.md')
        io.open(cel, 'w', encoding='utf-8').write(naglowek + na_md(bloki))

        obrazy = sorted(p for p in os.listdir(folder) if p.lower().endswith('.webp'))
        print('  zapisane: %s' % os.path.relpath(cel, KORZEN))
        print('  stron: %d, bloków: %d, obrazów: %d' % (stron, len(bloki), len(obrazy)))
        print('  Przejrzyj plik, popraw nagłówki i ponazywaj obrazy —')
        print('  nazwa pliku obrazu jest jego podpisem na stronie.')


if __name__ == '__main__':
    main()
