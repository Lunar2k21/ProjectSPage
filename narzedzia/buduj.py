#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Project Simracing — budowanie strony z plików .md
=================================================

Co robi
-------
Czyta foldery z treścią:

    tresci/artykuly/<nazwa>/tekst.md   + obrazy w tym samym folderze
    tresci/regulaminy/<nazwa>/tekst.md

i składa z nich gotowe strony w formatowaniu serwisu:

    _site/artykuly/<nazwa>/index.html     pojedynczy artykuł
    _site/artykuly/index.html             lista artykułów
    _site/regulamin/<nazwa>/index.html    pojedynczy regulamin
    _site/regulamin/index.html            lista regulaminów

Obrazy z folderu dokumentu przerabia na WebP w dwóch szerokościach,
resztę strony (index.html, wyniki, kalendarz, assets) po prostu kopiuje.
Treść trafia wprost do HTML-a — nic nie jest doczytywane skryptem, więc
link wrzucony na Discorda pokazuje miniaturkę, a Google widzi tekst.

Jak używać
----------
    python3 narzedzia/buduj.py              # buduje do _site/
    python3 narzedzia/buduj.py --serwuj     # buduje i uruchamia podgląd
    python3 narzedzia/buduj.py --out kat    # inny folder wynikowy

Nagłówek pliku .md (wszystko opcjonalne):

    ---
    tytul: Rajd Sardynii — finał Sezonu 14.
    data: 2026-05-30
    opis: Zajawka na kafelku listy.
    miniatura: Podium PSR1.jpg
    seria: wrc
    pdf: podsumowanie.pdf
    ukryty: nie
    ---

Czego nie podasz, skrypt dobierze sam: tytuł z pierwszego nagłówka,
datę z nazwy folderu, opis z pierwszego akapitu, miniaturkę z pierwszego
obrazu.
"""

import io
import json
import os
import re
import shutil
import sys
import unicodedata
from datetime import datetime

try:
    from PIL import Image
except ImportError:
    sys.exit('Brakuje biblioteki Pillow:  pip3 install pillow')

KORZEN   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRESCI   = os.path.join(KORZEN, 'tresci')
SZABLONY = os.path.join(KORZEN, 'narzedzia', 'szablony')
DOMENA   = 'https://projectsimracing.pl'

# folder w tresci/ -> (adres na stronie, rodzaj)
DZIALY = [
    ('artykuly',   'artykuly',  'artykul'),
    ('regulaminy', 'regulamin', 'regulamin'),
]

# Czego nie kopiujemy do gotowej strony. Foldery działów pomijamy,
# bo powstają od nowa przy każdym budowaniu — inaczej strona skasowanego
# artykułu potrafiłaby przyjechać ze starej kopii.
POMIJANE = {'narzedzia', 'tresci', '_site', 'apps-script', '.git', '.github',
            'test-najazd.html', 'dokumenty', 'sitemap.xml',
            'artykuly', 'regulamin'}

SZEROKOSCI  = [1600, 800]
JAKOSC      = 82
OBRAZY_ROZS = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp')


# ----------------------------------------------------------------------
# drobiazgi
# ----------------------------------------------------------------------
def slug(tekst):
    t = unicodedata.normalize('NFKD', tekst)
    t = t.replace('ł', 'l').replace('Ł', 'L')
    t = t.encode('ascii', 'ignore').decode()
    t = re.sub(r'[^a-zA-Z0-9]+', '-', t).strip('-').lower()
    return t or 'dokument'


def esc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def data_pl(iso):
    """2026-05-30 -> 30 maja 2026"""
    MIESIACE = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
                'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
    try:
        d = datetime.strptime(iso[:10], '%Y-%m-%d')
        return '%d %s %d' % (d.day, MIESIACE[d.month - 1], d.year)
    except Exception:
        return iso


# ----------------------------------------------------------------------
# Markdown — tyle, ile naprawdę potrzeba
# ----------------------------------------------------------------------
def naglowek_pliku(tekst):
    """Zwraca (ustawienia, reszta tekstu)."""
    if not tekst.startswith('---'):
        return {}, tekst
    koniec = tekst.find('\n---', 3)
    if koniec == -1:
        return {}, tekst

    ust = {}
    for linia in tekst[3:koniec].splitlines():
        if ':' not in linia:
            continue
        k, v = linia.split(':', 1)
        v = re.sub(r'\s+#.*$', '', v)          # komentarz po wartości
        ust[k.strip().lower()] = v.strip().strip('"\'')
    reszta = tekst[koniec + 4:]
    return ust, reszta.lstrip('-\n')


def inline(tekst):
    """**pogrubienie**, *kursywa*, `kod`, [odnośnik](adres)."""
    t = esc(tekst)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)',
               lambda m: '<a href="%s"%s>%s</a>' % (
                   m.group(2),
                   ' target="_blank" rel="noopener"' if m.group(2).startswith('http') else '',
                   m.group(1)), t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*([^*\n]+)\*(?![\w*])', r'<em>\1</em>', t)
    t = re.sub(r'(?<![\w_])_([^_\n]+)_(?![\w_])', r'<em>\1</em>', t)
    return t


OBRAZ_RE = re.compile(r'^!\[(.*?)\]\(([^)]+)\)\s*$')
TABELA_RE = re.compile(r'^\s*\|.*\|\s*$')
ROZDZIEL_RE = re.compile(r'^\s*\|[\s:\-|]+\|\s*$')


def komorki(linia):
    linia = linia.strip()
    if linia.startswith('|'):
        linia = linia[1:]
    if linia.endswith('|'):
        linia = linia[:-1]
    return [c.strip() for c in linia.split('|')]


def parsuj(tekst):
    """Markdown -> lista bloków."""
    linie = tekst.replace('\r\n', '\n').split('\n')
    bloki, i = [], 0

    while i < len(linie):
        l = linie[i]
        goly = l.strip()

        if not goly:
            i += 1
            continue

        # nagłówki
        m = re.match(r'^(#{1,4})\s+(.*)$', goly)
        if m:
            poziom = len(m.group(1))
            bloki.append({'t': 'h1' if poziom == 1 else ('h2' if poziom == 2 else 'h3'),
                          'x': inline(m.group(2).strip()), 'txt': m.group(2).strip()})
            i += 1
            continue

        # linia pozioma
        if re.match(r'^(-{3,}|\*{3,}|_{3,})$', goly):
            bloki.append({'t': 'hr'})
            i += 1
            continue

        # obraz w osobnej linii
        m = OBRAZ_RE.match(goly)
        if m:
            bloki.append({'t': 'img', 'podpis': m.group(1).strip(), 'plik': m.group(2).strip()})
            i += 1
            continue

        # tabela
        if TABELA_RE.match(l) and i + 1 < len(linie) and ROZDZIEL_RE.match(linie[i + 1]):
            wiersze = [komorki(l)]
            i += 2
            while i < len(linie) and TABELA_RE.match(linie[i]):
                wiersze.append(komorki(linie[i]))
                i += 1
            bloki.append({'t': 'table', 'rows': [[inline(c) for c in w] for w in wiersze]})
            continue

        # cytat
        if goly.startswith('>'):
            czesci = []
            while i < len(linie) and linie[i].strip().startswith('>'):
                czesci.append(linie[i].strip().lstrip('>').strip())
                i += 1
            bloki.append({'t': 'quote', 'x': inline(' '.join(czesci))})
            continue

        # listy
        punkt = re.match(r'^\s*[-*+]\s+(.*)$', l)
        numer = re.match(r'^\s*\d+[.)]\s+(.*)$', l)
        if punkt or numer:
            rodzaj = 'ol' if numer else 'ul'
            elementy = []
            while i < len(linie):
                p = re.match(r'^\s*[-*+]\s+(.*)$', linie[i])
                n = re.match(r'^\s*\d+[.)]\s+(.*)$', linie[i])
                if p or n:
                    if (n and rodzaj == 'ul') or (p and rodzaj == 'ol'):
                        break
                    elementy.append((p or n).group(1).strip())
                    i += 1
                elif linie[i].strip() and linie[i][:1] in ' \t' and elementy:
                    elementy[-1] += ' ' + linie[i].strip()      # dalszy ciąg punktu
                    i += 1
                else:
                    break
            bloki.append({'t': rodzaj, 'items': [inline(e) for e in elementy]})
            continue

        # akapit
        czesci = []
        while i < len(linie) and linie[i].strip() and not re.match(r'^(#{1,4}\s|\s*[-*+]\s|\s*\d+[.)]\s|>|\|)', linie[i]) \
                and not OBRAZ_RE.match(linie[i].strip()):
            czesci.append(linie[i].strip())
            i += 1
        if czesci:
            bloki.append({'t': 'p', 'x': inline(' '.join(czesci)), 'txt': ' '.join(czesci)})
        else:
            i += 1

    return bloki


# ----------------------------------------------------------------------
# obrazy
# ----------------------------------------------------------------------
def przerob_obraz(zrodlo, folder_wy, nazwa_pliku):
    """Zapisuje WebP w dwóch szerokościach. Zwraca (nazwa, szerokość, wysokość)."""
    os.makedirs(folder_wy, exist_ok=True)
    baza = slug(os.path.splitext(nazwa_pliku)[0])

    try:
        im = Image.open(zrodlo)
    except Exception as e:
        print('     ! nie umiem otworzyć obrazu %s (%s)' % (nazwa_pliku, e))
        return None

    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGB')
    if im.mode == 'RGBA':
        tlo = Image.new('RGB', im.size, (12, 18, 32))
        tlo.paste(im, mask=im.split()[-1])
        im = tlo

    duzy = None
    for szer in SZEROKOSCI:
        kopia = im
        if im.width > szer:
            kopia = im.resize((szer, max(1, int(im.height * szer / im.width))), Image.LANCZOS)
        elif szer != max(SZEROKOSCI):
            continue                                  # małego obrazu nie powielamy
        plik = '%s-%d.webp' % (baza, kopia.width)
        kopia.save(os.path.join(folder_wy, plik), 'WEBP', quality=JAKOSC, method=5)
        if duzy is None:
            duzy = (plik, kopia.width, kopia.height)
    return duzy


# ----------------------------------------------------------------------
# jeden dokument
# ----------------------------------------------------------------------
def wczytaj_dokument(folder, adres_dzialu, rodzaj):
    pliki = sorted(os.listdir(folder))
    md = [p for p in pliki if p.lower().endswith('.md')]
    if not md:
        return None

    tekst = io.open(os.path.join(folder, md[0]), encoding='utf-8').read()
    ust, tresc = naglowek_pliku(tekst)
    bloki = parsuj(tresc)

    nazwa_folderu = os.path.basename(folder.rstrip('/'))
    id_dok = slug(re.sub(r'^\d{4}-\d{2}(-\d{2})?-', '', nazwa_folderu))

    # tytuł: nagłówek pliku albo pierwszy nagłówek w treści
    tytul = ust.get('tytul') or ''
    if not tytul:
        for b in bloki:
            if b['t'] in ('h1', 'h2', 'h3'):
                tytul = b.get('txt') or ''
                bloki.remove(b)
                break
    if not tytul:
        tytul = nazwa_folderu.replace('-', ' ').capitalize()
    else:
        # tytuł z nagłówka pliku też nie ma się dublować w treści
        for b in list(bloki[:2]):
            if b['t'] in ('h1', 'h2', 'h3') and (b.get('txt') or '').strip() == tytul.strip():
                bloki.remove(b)
                break

    # data: z nagłówka pliku, z nazwy folderu, w ostateczności z pliku
    data = ust.get('data') or ''
    if not data:
        m = re.match(r'^(\d{4})-(\d{2})(?:-(\d{2}))?', nazwa_folderu)
        if m:
            data = '%s-%s-%s' % (m.group(1), m.group(2), m.group(3) or '01')
        else:
            data = datetime.fromtimestamp(os.path.getmtime(os.path.join(folder, md[0]))).strftime('%Y-%m-%d')

    obrazy_w_folderze = [p for p in pliki if p.lower().endswith(OBRAZY_ROZS)]

    return {
        'id': id_dok,
        'folder': folder,
        'rodzaj': rodzaj,
        'adres': '%s/%s/' % (adres_dzialu, id_dok),
        'tytul': tytul.strip(),
        'data': data,
        'opis': ust.get('opis', '').strip(),
        'seria': ust.get('seria', '').strip().lower(),
        'miniatura': ust.get('miniatura', '').strip(),
        'pdf': ust.get('pdf', '').strip(),
        'ukryty': ust.get('ukryty', '').strip().lower() in ('tak', 'true', '1'),
        'bloki': bloki,
        'obrazy': obrazy_w_folderze,
    }


def zbuduj_dokument(dok, out):
    """Przerabia obrazy, składa HTML treści. Zwraca dane do listy."""
    kat = os.path.join(out, dok['adres'].strip('/'))
    kat_obrazy = os.path.join(kat, 'obrazy')
    os.makedirs(kat, exist_ok=True)

    uzyte, mapa = set(), {}

    def obraz(nazwa_pliku, podpis):
        zrodlo = os.path.join(dok['folder'], nazwa_pliku)
        if not os.path.exists(zrodlo):
            print('     ! brak pliku obrazu:', nazwa_pliku)
            return ''
        if nazwa_pliku not in mapa:
            wynik = przerob_obraz(zrodlo, kat_obrazy, nazwa_pliku)
            if not wynik:
                return ''
            mapa[nazwa_pliku] = wynik
        plik, w, h = mapa[nazwa_pliku]
        uzyte.add(nazwa_pliku)

        maly = plik.replace('-%d.webp' % w, '-800.webp')
        srcset = ''
        if os.path.exists(os.path.join(kat_obrazy, maly)) and maly != plik:
            srcset = ' srcset="obrazy/%s 800w, obrazy/%s %dw" sizes="(max-width: 820px) 100vw, 820px"' % (maly, plik, w)

        # tytuł obrazu bierzemy z nazwy pliku, chyba że podano własny podpis
        nazwa = podpis or os.path.splitext(nazwa_pliku)[0].replace('_', ' ').strip()

        return ('<figure class="fig">' +
                ('<figcaption class="fig__nazwa">' + esc(nazwa) + '</figcaption>' if nazwa else '') +
                '<img src="obrazy/%s"%s width="%d" height="%d" alt="%s" loading="lazy" decoding="async">'
                % (plik, srcset, w, h, esc(nazwa)) +
                '</figure>')

    czesci = []
    for b in dok['bloki']:
        t = b['t']
        if t in ('h2', 'h3'):
            if t == 'h2':
                czesci.append('<h2 id="%s">%s</h2>' % (esc(kotwica(b.get('txt') or '')), b['x']))
            else:
                czesci.append('<h3>%s</h3>' % b['x'])
        elif t == 'h1':
            czesci.append('<h2 id="%s">%s</h2>' % (esc(kotwica(b.get('txt') or '')), b['x']))
        elif t == 'p':
            czesci.append('<p>%s</p>' % b['x'])
        elif t in ('ul', 'ol'):
            czesci.append('<%s>%s</%s>' % (t, ''.join('<li>%s</li>' % i for i in b['items']), t))
        elif t == 'quote':
            czesci.append('<blockquote class="dok__cytat">%s</blockquote>' % b['x'])
        elif t == 'hr':
            czesci.append('<hr class="dok__hr">')
        elif t == 'img':
            czesci.append(obraz(b['plik'], b['podpis']))
        elif t == 'table':
            rows = b['rows']
            glowa = ''.join('<th>%s</th>' % c for c in rows[0])
            ciało = ''.join('<tr>%s</tr>' % ''.join('<td>%s</td>' % c for c in w) for w in rows[1:])
            czesci.append('<div class="tbl-wrap tbl-wrap--dok"><table><thead><tr>%s</tr></thead>'
                          '<tbody>%s</tbody></table></div>' % (glowa, ciało))

    # obrazy, których nie wstawiono w tekst, dokładamy na końcu
    for nazwa_pliku in dok['obrazy']:
        if nazwa_pliku in uzyte or nazwa_pliku == dok['miniatura']:
            continue
        czesci.append(obraz(nazwa_pliku, ''))

    # miniaturka: wskazana w nagłówku pliku albo pierwszy obraz dokumentu
    mini = ''
    zrodlo_mini = dok['miniatura'] or (dok['obrazy'][0] if dok['obrazy'] else '')
    if zrodlo_mini:
        if zrodlo_mini not in mapa:
            wynik = przerob_obraz(os.path.join(dok['folder'], zrodlo_mini), kat_obrazy, zrodlo_mini)
            if wynik:
                mapa[zrodlo_mini] = wynik
        if zrodlo_mini in mapa:
            mini = dok['adres'] + 'obrazy/' + mapa[zrodlo_mini][0]

    # PDF do pobrania, jeśli leży w folderze
    pdf = ''
    if dok['pdf'] and os.path.exists(os.path.join(dok['folder'], dok['pdf'])):
        shutil.copy2(os.path.join(dok['folder'], dok['pdf']), os.path.join(kat, dok['pdf']))
        pdf = dok['pdf']

    dok['tresc_html'] = '\n'.join(czesci)
    dok['mini'] = mini
    dok['pdf_plik'] = pdf
    if not dok['opis']:
        for b in dok['bloki']:
            if b['t'] == 'p' and len(b.get('txt', '')) > 60:
                dok['opis'] = b['txt'][:220].rsplit(' ', 1)[0] + '…'
                break
    return dok


def kotwica(tekst):
    return 'r-' + slug(tekst)[:48]


# ----------------------------------------------------------------------
# składanie stron
# ----------------------------------------------------------------------
def szablon():
    return io.open(os.path.join(SZABLONY, 'strona.html'), encoding='utf-8').read()


def wypelnij(sz, **pola):
    for k, v in pola.items():
        sz = sz.replace('{{%s}}' % k, v)
    return re.sub(r'\{\{[A-Z]+\}\}', '', sz)


def strona_dokumentu(dok, sz):
    B = '../../'
    czyReg = dok['rodzaj'] == 'regulamin'
    wroc = ('%sregulamin/' % B, '← Wszystkie regulaminy') if czyReg else ('%sartykuly/' % B, '← Wszystkie artykuły')

    naglowki = [b for b in dok['bloki'] if b['t'] in ('h1', 'h2')]
    spis = ''
    if len(naglowki) >= 3:
        spis = ('<nav class="dok__toc" aria-label="Spis treści">'
                '<p class="mono dim dok__toch">W tym dokumencie</p><ol>' +
                ''.join('<li><a href="#%s">%s</a></li>' % (esc(kotwica(b.get('txt') or '')), esc(b.get('txt') or ''))
                        for b in naglowki) +
                '</ol></nav>')

    slow = sum(len(b.get('txt', '').split()) for b in dok['bloki'] if b['t'] in ('p', 'h1', 'h2', 'h3'))
    slow += sum(len(' '.join(b.get('items', [])).split()) for b in dok['bloki'] if b['t'] in ('ul', 'ol'))
    minuty = max(1, int(round(slow / 200.0)))

    meta = [data_pl(dok['data']), '%d min czytania' % minuty]
    if dok['seria']:
        meta.insert(0, dok['seria'].upper())

    pdf = ''
    if dok['pdf_plik']:
        pdf = ('<a class="btn btn--ghost btn--sm dok__pdf" href="%s" download>'
               '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 11l4.5 4.5 4.5-4.5M4.5 20h15"/></svg>'
               '<span class="btn__t">Pobierz PDF</span></a>' % esc(dok['pdf_plik']))

    tresc = (
        '<main id="main">\n<article class="dok">\n'
        '  <header class="dok__head"><div class="shell">\n'
        '    <a class="dok__back" href="%s">%s</a>\n'
        '    <h1>%s</h1>\n'
        '    <p class="mono dim dok__meta">%s</p>\n'
        '    %s\n'
        '  </div></header>\n'
        '  <div class="shell dok__cols%s">\n'
        '    %s\n'
        '    <div class="dok__body">\n%s\n    </div>\n'
        '  </div>\n</article>\n</main>'
        % (esc(wroc[0]), wroc[1], esc(dok['tytul']),
           ('<span class="dok__sep" aria-hidden="true">·</span>'.join('<span>%s</span>' % esc(m) for m in meta)),
           pdf, '' if spis else ' is-solo', spis, dok['tresc_html'])
    )

    url = '%s/%s' % (DOMENA, dok['adres'])
    obrazek = '%s/%s' % (DOMENA, dok['mini']) if dok['mini'] else '%s/assets/img/hero/wrc-1920.webp' % DOMENA

    jsonld = json.dumps({
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': dok['tytul'],
        'datePublished': dok['data'],
        'image': obrazek,
        'author': {'@type': 'Organization', 'name': 'Project Simracing'},
        'publisher': {'@type': 'Organization', 'name': 'Project Simracing'},
        'mainEntityOfPage': url,
    }, ensure_ascii=False)

    return wypelnij(sz, B=B, TYTUL=esc(dok['tytul']), OPIS=esc(dok['opis'] or dok['tytul']),
                    URL=url, OBRAZEK=obrazek, TRESC=tresc,
                    BODY='data-strona="%s"' % ('regulamin' if czyReg else 'artykuly'),
                    JSONLD='<script type="application/ld+json">%s</script>' % jsonld)


def strona_listy(rodzaj, adres, dokumenty, sz):
    czyReg = rodzaj == 'regulamin'
    tytul = 'Regulaminy' if czyReg else 'Artykuły'
    podtytul = ('Zasady obowiązujące w każdej z serii. Ta sama treść co w PDF-ie, tylko czytelna na telefonie.'
                if czyReg else
                'Relacje z rund, zapowiedzi sezonu i teksty od zarządu ligi. Wszystko do przeczytania na miejscu.')

    if dokumenty:
        kafelki = []
        for d in dokumenty:
            # lista leży w tym samym folderze co dokumenty, więc ścieżkę
            # do miniaturki liczymy od niego
            mini = ('<span class="dok-card__img"><img src="%s" alt="" loading="lazy" decoding="async"></span>'
                    % esc(d['mini'].split('/', 1)[1]) if d['mini'] else '<span class="dok-card__img"></span>')
            meta = ' · '.join([x for x in [d['seria'].upper() if d['seria'] else '', data_pl(d['data'])] if x])
            kafelki.append(
                '<a class="dok-card" href="%s/">' % esc(d['id']) + mini +
                '<span class="dok-card__body">'
                '<span class="mono dim dok-card__meta">%s</span>'
                '<span class="dok-card__title">%s</span>'
                '<span class="dok-card__lead">%s</span>'
                '<span class="dok-card__more">Czytaj →</span>'
                '</span></a>' % (esc(meta), esc(d['tytul']), esc(d['opis'])))
        srodek = '<div class="doks">%s</div>' % ''.join(kafelki)

        # Przy kilku dokumentach filtr tylko przeszkadza; przy kilkunastu
        # oszczędza przewijanie. Zwykły filtr po tytule i opisie.
        if len(dokumenty) >= 4:
            srodek = (
                '<label class="search doks__szukaj">'
                '<span class="visually-hidden">Szukaj w dokumentach</span>'
                '<input type="search" id="szukajDok" placeholder="Szukaj…" autocomplete="off">'
                '</label>' + srodek +
                '<p class="empty" id="szukajPusto" hidden>Nic nie pasuje do wyszukiwania.</p>'
                '<script>'
                '(function(){var p=document.getElementById("szukajDok");'
                'var k=[].slice.call(document.querySelectorAll(".dok-card"));'
                'var pusto=document.getElementById("szukajPusto");'
                'p.addEventListener("input",function(){'
                'var q=p.value.trim().toLowerCase(),n=0;'
                'k.forEach(function(el){var ok=!q||el.textContent.toLowerCase().indexOf(q)>-1;'
                'el.hidden=!ok;if(ok)n++;});'
                'pusto.hidden=n>0;});})();'
                '</script>')
    else:
        srodek = ('<p class="notice notice--info">%s</p>' %
                  ('Regulaminy pojawią się tu, gdy tylko trafią do folderu z treścią.' if czyReg
                   else 'Nie ma jeszcze żadnego artykułu.'))

    # Podtytuł zostaje tylko w opisie strony dla wyszukiwarek — na samej
    # stronie zabierał miejsce i niczego nie wyjaśniał.
    tresc = ('<main id="main">\n'
             '<section class="rhead"><div class="shell">\n'
             '  <h1>%s</h1>\n'
             '</div></section>\n'
             '<div class="shell">%s</div>\n</main>' % (tytul, srodek))

    url = '%s/%s/' % (DOMENA, adres)
    return wypelnij(sz, B='../', TYTUL=tytul, OPIS=podtytul, URL=url,
                    OBRAZEK='%s/assets/img/hero/wrc-1920.webp' % DOMENA,
                    TRESC=tresc, BODY='data-strona="%s"' % adres, JSONLD='')


# ----------------------------------------------------------------------
# kalendarz — tresci/kalendarz.md  ->  assets/js/kalendarz.js
# ----------------------------------------------------------------------
NAGLOWEK_ALIASY = {
    'nr': ('#', 'nr', 'lp', 'l.p.', 'runda nr'),
    'nazwa': ('runda', 'nazwa', 'event', 'wydarzenie'),
    'start': ('start', 'poczatek', 'początek', 'data', 'termin'),
    'koniec': ('koniec', 'do', 'zakonczenie', 'zakończenie'),
    'wyniki': ('wyniki', 'zakladka', 'zakładka', 'zakładka wyników', 'zakladka wynikow'),
}


def strefa(dt):
    """Dopisuje polskie przesunięcie czasu (+02:00 latem, +01:00 zimą)."""
    try:
        from zoneinfo import ZoneInfo
        return dt.replace(tzinfo=ZoneInfo('Europe/Warsaw')).isoformat()
    except Exception:
        # ostatnia deska ratunku: czas letni od kwietnia do października
        przes = '+02:00' if 4 <= dt.month <= 10 else '+01:00'
        return dt.strftime('%Y-%m-%dT%H:%M:%S') + przes


def czas(tekst):
    """„2026-09-17 20:00", „17.09.2026 20:00", sama data — wszystko jedno."""
    t = (tekst or '').strip().replace('  ', ' ')
    if not t:
        return ''
    for wzor in ('%Y-%m-%d %H:%M', '%Y-%m-%dT%H:%M', '%d.%m.%Y %H:%M',
                 '%Y-%m-%d', '%d.%m.%Y'):
        try:
            d = datetime.strptime(t, wzor)
            if wzor in ('%Y-%m-%d', '%d.%m.%Y'):
                d = d.replace(hour=20, minute=0)
            return strefa(d)
        except ValueError:
            continue
    print('     ! nie rozumiem terminu: %s' % tekst)
    return ''


def kalendarz(out):
    """Buduje assets/js/kalendarz.js. Plik powstaje zawsze — także pusty,
    żeby strony nie prosiły serwera o coś, czego nie ma."""
    plik = os.path.join(TRESCI, 'kalendarz.md')
    rundy, serie = [], {}

    if os.path.exists(plik):
        tekst = io.open(plik, encoding='utf-8').read()
        _, tresc = naglowek_pliku(tekst)
        seria_teraz, etykieta = '', ''
        naglowki = None
        numer = 0

        for linia in tresc.split('\n'):
            g = linia.strip()
            if not g:
                continue

            m = re.match(r'^#{2,3}\s+(.*)$', g)
            if m:
                naglowki = None
                etykieta = m.group(1).strip()
                znak = re.search(r'\{([a-z0-9_-]+)\}\s*$', etykieta)
                seria_teraz = znak.group(1) if znak else ''
                etykieta = re.sub(r'\s*\{[a-z0-9_-]+\}\s*$', '', etykieta)
                if seria_teraz:
                    serie[seria_teraz] = etykieta
                continue

            if not TABELA_RE.match(linia):
                continue
            if ROZDZIEL_RE.match(linia):
                continue

            pola = komorki(linia)
            if naglowki is None:
                naglowki = []
                for c in pola:
                    klucz = ''
                    for k, aliasy in NAGLOWEK_ALIASY.items():
                        if c.strip().lower() in aliasy:
                            klucz = k
                            break
                    naglowki.append(klucz)
                continue

            w = {}
            for i, c in enumerate(pola):
                if i < len(naglowki) and naglowki[i]:
                    w[naglowki[i]] = c.strip()

            if not w.get('nazwa'):
                continue
            numer += 1
            rundy.append({
                'round': int(w['nr']) if w.get('nr', '').isdigit() else numer,
                'series': seria_teraz,
                'name': {'pl': w['nazwa'], 'en': w['nazwa']},
                'date': czas(w.get('start', '')),
                'koniec': czas(w.get('koniec', '')),
                'resultsTab': w.get('wyniki', ''),
            })

    tresc = ('/* Ten plik powstaje z tresci/kalendarz.md przy budowaniu strony.\n'
             '   Nie edytuj go ręcznie — zmiany przepadną przy kolejnym budowaniu. */\n'
             'window.PS_KALENDARZ = %s;\n'
             'window.PS_SERIE = %s;\n'
             % (json.dumps(rundy, ensure_ascii=False, indent=1),
                json.dumps(serie, ensure_ascii=False, indent=1)))

    kat = os.path.join(out, 'assets', 'js')
    os.makedirs(kat, exist_ok=True)
    io.open(os.path.join(kat, 'kalendarz.js'), 'w', encoding='utf-8').write(tresc)
    if rundy:
        print('  kalendarz: %d rund w %d seriach' % (len(rundy), max(1, len(serie))))
    return rundy


# ----------------------------------------------------------------------
# kopiowanie reszty strony
# ----------------------------------------------------------------------
def skopiuj_strone(out):
    for nazwa in sorted(os.listdir(KORZEN)):
        if nazwa in POMIJANE or nazwa.startswith('.'):
            continue
        zrodlo = os.path.join(KORZEN, nazwa)
        cel = os.path.join(out, nazwa)
        if os.path.isdir(zrodlo):
            shutil.copytree(zrodlo, cel, dirs_exist_ok=True)
        else:
            shutil.copy2(zrodlo, cel)


def sitemap(out, wszystkie):
    adresy = ['', 'wyniki.html', 'kalendarz.html', 'artykuly/', 'regulamin/']
    adresy += [d['adres'] for d in wszystkie]
    dzis = datetime.now().strftime('%Y-%m-%d')
    czesci = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for a in adresy:
        czesci.append('  <url><loc>%s/%s</loc><lastmod>%s</lastmod></url>' % (DOMENA, a, dzis))
    czesci.append('</urlset>')
    io.open(os.path.join(out, 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(czesci) + '\n')


# ----------------------------------------------------------------------
def main():
    # Bez --out budujemy „u siebie": strony artykułów i regulaminów
    # powstają obok index.html, więc lokalny podgląd wygląda dokładnie
    # tak jak strona w internecie i wszystkie odnośniki działają.
    # Z --out (tak robi to automat na GitHubie) powstaje osobny,
    # czysty folder bez źródeł i narzędzi.
    w_miejscu = '--out' not in sys.argv
    out = KORZEN if w_miejscu else os.path.abspath(sys.argv[sys.argv.index('--out') + 1])

    if w_miejscu:
        for _, adres, _ in DZIALY:
            shutil.rmtree(os.path.join(KORZEN, adres), ignore_errors=True)
    else:
        if os.path.isdir(out):
            shutil.rmtree(out, ignore_errors=True)
        os.makedirs(out, exist_ok=True)
        print('Kopiuję stronę…')
        skopiuj_strone(out)

    kalendarz(out)

    sz = szablon()
    wszystkie = []

    for folder_zrodel, adres, rodzaj in DZIALY:
        katalog = os.path.join(TRESCI, folder_zrodel)
        os.makedirs(katalog, exist_ok=True)
        dokumenty = []

        for nazwa in sorted(os.listdir(katalog)):
            sciezka = os.path.join(katalog, nazwa)
            if not os.path.isdir(sciezka) or nazwa.startswith('.'):
                continue
            dok = wczytaj_dokument(sciezka, adres, rodzaj)
            if not dok:
                print('  pomijam %s — brak pliku .md' % nazwa)
                continue
            if dok['ukryty']:
                print('  ukryty: %s' % dok['tytul'])
                continue

            zbuduj_dokument(dok, out)
            io.open(os.path.join(out, dok['adres'].strip('/'), 'index.html'), 'w', encoding='utf-8') \
              .write(strona_dokumentu(dok, sz))
            dokumenty.append(dok)
            print('  %s: %s (%d bloków)' % (rodzaj, dok['tytul'], len(dok['bloki'])))

        dokumenty.sort(key=lambda d: d['data'], reverse=True)
        os.makedirs(os.path.join(out, adres), exist_ok=True)
        io.open(os.path.join(out, adres, 'index.html'), 'w', encoding='utf-8') \
          .write(strona_listy(rodzaj, adres, dokumenty, sz))

        # lista dla strony głównej („najnowszy artykuł")
        io.open(os.path.join(out, adres, 'lista.json'), 'w', encoding='utf-8').write(
            json.dumps({'dokumenty': [{'id': d['id'], 'tytul': d['tytul'], 'opis': d['opis'],
                                       'data': d['data'], 'seria': d['seria'],
                                       'adres': d['adres'], 'miniatura': d['mini']}
                                      for d in dokumenty]}, ensure_ascii=False, indent=1))
        wszystkie += dokumenty

    sitemap(out, wszystkie)
    print('Gotowe — dokumentów: %d.' % len(wszystkie))
    if w_miejscu:
        print('Strony artykułów i regulaminów leżą teraz obok index.html.')
        print('Podgląd:  python3 narzedzia/buduj.py --serwuj')
    else:
        print('Gotowa strona: %s' % out)

    if '--serwuj' in sys.argv:
        import http.server, socketserver
        os.chdir(out)
        port = 8000
        print('Podgląd: http://localhost:%d/  (Ctrl+C kończy)' % port)
        socketserver.TCPServer.allow_reuse_address = True
        socketserver.TCPServer(('', port), http.server.SimpleHTTPRequestHandler).serve_forever()


if __name__ == '__main__':
    main()
