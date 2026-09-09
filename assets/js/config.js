/* =====================================================================
   Project Simracing — konfiguracja strony
   ---------------------------------------------------------------------
   To jedyny plik, który trzeba edytować przy zmianie sezonu, linków,
   terminów czy dodaniu nowego auta. Reszta kodu go tylko czyta.
   ===================================================================== */

window.PS_CONFIG = {

  /* ---------------------------------------------------------------
     1. NAWIGACJA
     soon: true  => pozycja widoczna, ale wyszarzona i nieklikalna.
     Gdy podstrona powstanie, wystarczy usunąć „soon” i wpisać href.
  --------------------------------------------------------------- */
  nav: [
    { label: { pl: 'Odnośniki',  en: 'Links'    }, href: 'index.html#hub' },
    { label: { pl: 'Wyniki',     en: 'Results'  }, href: 'wyniki.html' },
    { label: { pl: 'Kalendarz',  en: 'Calendar' }, href: 'kalendarz.html' },
    { label: { pl: 'Artykuły',   en: 'Articles' }, href: 'artykuly/' },
    { label: { pl: 'Regulamin',  en: 'Rules'    }, href: 'regulamin/' },
    { label: { pl: 'Media',      en: 'Media'    }, href: 'index.html#media' }
  ],

  /* ---------------------------------------------------------------
     2. SLAJDY W NAGŁÓWKU
     Każdy slajd = jedno mistrzostwo: własne tło, tekst i przyciski.
     type: 'video' bierze tło prosto z miniatury YouTube.
     Maksymalnie 4–5 slajdów, inaczej nikt nie doczeka do ostatniego.
  --------------------------------------------------------------- */
  slides: [
    {
      id: 'wrc',
      image: 'wrc',                        // assets/img/hero/wrc-{1280,1920,2560}.webp
      kicker: { pl: 'EA Sports WRC · Sezon 15', en: 'EA Sports WRC · Season 15' },
      title:  { pl: 'Rajdy w czterech<br>dywizjach', en: 'Rally across four<br>divisions' },
      desc:   { pl: 'Siedem rund, 182 kierowców, klasyfikacje od Rookie po PSR1.',
                en: 'Seven rounds, 182 drivers, classes from Rookie up to PSR1.' },
      actions: [
        { label: { pl: 'Zapisz się', en: 'Sign up' }, href: 'https://forms.gle/djYKmgeQmg75uitF9', primary: true, external: true },
        { label: { pl: 'Wyniki sezonu', en: 'Season standings' }, href: '#wyniki' }
      ]
    },
    {
      id: 'lmu',
      image: 'lmu',
      kicker: { pl: 'Le Mans Ultimate · Sezon 0', en: 'Le Mans Ultimate · Season 0' },
      title:  { pl: 'Wyścigi<br>długodystansowe', en: 'Endurance<br>racing' },
      desc:   { pl: 'Bahrajn, Katar, Włochy, Algarve — pełne obsady GT3 i hypercar.',
                en: 'Bahrain, Qatar, Italy, Algarve — full GT3 and hypercar grids.' },
      actions: [
        { label: { pl: 'Aktualny sezon', en: 'Current season' }, href: 'https://www.thesimgrid.com/championships/22373', primary: true, external: true },
        { label: { pl: 'Klasyfikacja', en: 'Standings' }, href: 'https://www.thesimgrid.com/championships/22373/standings', external: true }
      ]
    },
    {
      id: 'fh6',
      image: 'fh6',
      kicker: { pl: 'Forza Horizon 6 · Sezon 0', en: 'Forza Horizon 6 · Season 0' },
      title:  { pl: 'Pięć rund,<br>klasy B–S1', en: 'Five rounds,<br>classes B–S1' },
      desc:   { pl: 'Asfalt i rally, trasy społecznościowe. Szczegóły na Discordzie.',
                en: 'Tarmac and rally, community-built routes. Details on Discord.' },
      actions: [
        { label: { pl: 'Dołącz na Discordzie', en: 'Join on Discord' }, href: 'https://discord.gg/R3Tu68jWwK', primary: true, external: true }
      ]
    },
    {
      /* Slajd filmowy — tłem jest miniatura z YouTube, więc wystarczy
         podmienić „video” na nowe ID i slajd sam się aktualizuje. */
      id: 'video',
      type: 'video',
      video: 'udDeI9KIbv8',
      kicker: { pl: 'YouTube · Project Simracing', en: 'YouTube · Project Simracing' },
      title:  { pl: 'Najnowszy<br>film', en: 'Latest<br>video' },
      /* Opis podmienia się sam na tytuł najnowszego filmu wpisanego
         w zrodla.js — dlatego tytuł slajdu jest stały. */
      desc:   { pl: 'Relacje z rund, zapowiedzi i materiały z sezonu.',
                en: 'Round recaps, previews and season features.' },
      actions: [
        { label: { pl: 'Obejrzyj film', en: 'Watch video' }, href: 'https://www.youtube.com/watch?v=udDeI9KIbv8', primary: true, external: true },
        { label: { pl: 'Wszystkie materiały', en: 'All media' }, href: '#media' }
      ]
    }
  ],

  /* Czas jednego slajdu (ms). Pasek pod slajdem odlicza dokładnie tyle.
     0 = brak automatycznej zmiany. */
  slideInterval: 8000,

  /* Ruch zdjęcia w tle na przestrzeni jednego slajdu.
     slideZoom — docelowe powiększenie ramki (1 = brak najazdu).
     slidePan  — dryf w bok w procentach kadru (0 = brak).
     Uwaga: zbyt mały najazd wygląda gorzej niż większy, bo przy ruchu
     poniżej ok. 0,1 px na klatkę przeglądarka zaokrągla go do pikseli
     i widać skoki. Najgładszy wariant to slideZoom: 1 i slidePan: 2.5
     — sam przesuw, bez skalowania. */
  slideZoom: 1.09,
  slidePan:  0.8,

  /* ---------------------------------------------------------------
     3. KALENDARZ — jedno źródło terminów
     Pasek „najbliższa runda”, odliczanie, przycisk „dodaj do
     kalendarza” i przyszła podstrona /kalendarz biorą dane stąd.
     date: ISO 8601 ze strefą, np. '2026-09-17T20:00:00+02:00'.
     Puste date => runda bez terminu, pasek pokazuje „termin wkrótce”.
  --------------------------------------------------------------- */
  calendar: [
    { round: 1, series: 'wrc', name: { pl: 'Rajd Łotwy',            en: 'Rally Latvia' },          date: '', durationMin: 90 },
    { round: 2, series: 'wrc', name: { pl: 'Rajd Grecji',           en: 'Acropolis Rally' },       date: '', durationMin: 90 },
    { round: 3, series: 'wrc', name: { pl: 'Rajd Finlandii',        en: 'Rally Finland' },         date: '', durationMin: 90 },
    { round: 4, series: 'wrc', name: { pl: 'Rajd Hiszpanii',        en: 'Rally Spain' },           date: '', durationMin: 90 },
    { round: 5, series: 'wrc', name: { pl: 'Rajd Europy Środkowej', en: 'Central European Rally' },date: '', durationMin: 90 },
    { round: 6, series: 'wrc', name: { pl: 'Rajd Estonii',          en: 'Rally Estonia' },         date: '', durationMin: 90 },
    { round: 7, series: 'wrc', name: { pl: 'Rajd Polski',           en: 'Rally Poland' },          date: '', durationMin: 90 }
  ],

  /* Etykieta serii pokazywana przy najbliższej rundzie. */
  seriesLabel: {
    wrc: { pl: 'EA Sports WRC · Sezon 15', en: 'EA Sports WRC · Season 15' },
    lmu: { pl: 'Le Mans Ultimate · Sezon 0', en: 'Le Mans Ultimate · Season 0' },
    fh6: { pl: 'Forza Horizon 6 · Sezon 0', en: 'Forza Horizon 6 · Season 0' }
  },

  /* Ręczne nadpisanie paska rundy. Zostaw puste name, żeby strona
     sama wybrała najbliższą rundę z kalendarza powyżej. */
  nextRoundOverride: { name: '', note: '', date: '' },

  /* ---------------------------------------------------------------
     4. HUB ODNOŚNIKÓW
  --------------------------------------------------------------- */
  hub: [
    {
      title: { pl: 'Społeczność', en: 'Community' },
      links: [
        { label: 'Discord',   href: 'https://discord.gg/R3Tu68jWwK' },
        { label: 'Facebook',  href: 'https://www.facebook.com/ProjectSimracing/' },
        { label: 'YouTube',   href: 'https://www.youtube.com/@ProjectSimracingpl' },
        { label: 'Patronite', href: 'https://patronite.pl/projectsimracing', tag: { pl: 'wsparcie', en: 'support' } }
      ]
    },
    {
      title: { pl: 'EA Sports WRC', en: 'EA Sports WRC' },
      links: [
        { label: { pl: 'Klub Racenet', en: 'Racenet club' }, href: 'https://racenet.com/ea_sports_wrc/clubs/3358' },
        { label: { pl: 'Arkusz wyników — Sezon 15', en: 'Results sheet — Season 15' },
          href: 'https://docs.google.com/spreadsheets/d/1J8lfQ3qvBeook9-UVQQSu8xf7pYBDv7FcCve7VJEmNw/edit' },
        { label: { pl: 'Formularz zgłoszeniowy', en: 'Entry form' }, href: 'https://forms.gle/djYKmgeQmg75uitF9' },
        { label: { pl: 'Archiwum sezonów', en: 'Season archive' },
          href: 'https://docs.google.com/spreadsheets/d/1fLWQQbc7HStSIGq3NQbhQQgR-bZWzC19oCcl4MD0iA8/edit' }
      ]
    },
    {
      title: { pl: 'Le Mans Ultimate', en: 'Le Mans Ultimate' },
      links: [
        { label: { pl: 'Profil społeczności', en: 'Community profile' }, href: 'https://www.thesimgrid.com/communities/project-simracing' },
        { label: { pl: 'Aktualny sezon', en: 'Current season' }, href: 'https://www.thesimgrid.com/championships/22373' },
        { label: { pl: 'Klasyfikacja', en: 'Standings' }, href: 'https://www.thesimgrid.com/championships/22373/standings' }
      ]
    },
    {
      title: { pl: 'Pozostałe serie', en: 'Other series' },
      links: [
        { label: 'Assetto Corsa Rally', href: 'https://www.facebook.com/groups/1885078062424849/', tag: 'FB' },
        { label: 'Forza Horizon 6', soon: true },
        { label: { pl: 'Community Cup', en: 'Community Cup' }, soon: true }
      ]
    }
  ],

  /* ---------------------------------------------------------------
     5. MEDIA
     Lista z kanału: youtube.com/feeds/videos.xml?channel_id=UCpjDcxwIfcoN5exRmAd6SYw
     Miniatury lecą prosto z YouTube, więc wystarczy podmienić ID.
  --------------------------------------------------------------- */
  media: {
    channel:  'https://www.youtube.com/@ProjectSimracingpl',
    channelId:'UCpjDcxwIfcoN5exRmAd6SYw',
    playlist: 'UUpjDcxwIfcoN5exRmAd6SYw',
    poster:   'assets/img/hero/lmu-1280.webp',
    videos: [
      { id: 'udDeI9KIbv8', title: 'S0 · Wyścig 5. Bahrajn — podsumowanie Le Mans Ultimate' },
      { id: 'Vs5rvrvONnE', title: 'S0 · Wyścig 4. Katar — podsumowanie Le Mans Ultimate' },
      { id: 'WsJ_ocLVQHw', title: 'S14 · 5. Rajd Francji — podsumowanie EA Sports WRC' }
    ]
  },

  /* ---------------------------------------------------------------
     6. PODIUM NA STRONIE GŁÓWNEJ
     Skrót bierze trzy pierwsze miejsca z ostatniej zakładki arkusza,
     w której są już wyniki. Nie ma tu żadnych nazwisk na sztywno —
     wystarczy podać, z których mistrzostw czytać.
  --------------------------------------------------------------- */
  results: {
    champ: 'wrc',                   // identyfikator z listy championships
    emptyTime: '--:--.---'          // gdy runda się jeszcze nie odbyła
  },

  /* ---------------------------------------------------------------
     7. MISTRZOSTWA — źródła wyników dla podstrony wyniki.html
     ---------------------------------------------------------------
     source.type:
       'apps'   – adres aplikacji internetowej Apps Script (/exec).
                  Zalecane: jeden adres podaje wszystkie zakładki
                  arkusza naraz i pozwala wykryć zmianę bez pobierania
                  całości. Skrypt i instrukcja: folder apps-script/.
       'pubcsv' – arkusz opublikowany przez Plik → Udostępnij →
                  Opublikuj w internecie → CSV. Wtedy każdą zakładkę
                  podaje się osobno w tabs[].
       ''       – brak źródła: mistrzostwa są wyszarzone, chyba że mają
                  dane demonstracyjne (demo).

     UWAGA: adresów NIE wpisuj tutaj. Wpisz je w assets/js/zrodla.js —
     tamten plik nie jest nadpisywany przy aktualizacjach strony,
     a ten owszem.
  --------------------------------------------------------------- */
  championships: [
    {
      id: 'wrc',
      label:  'EA Sports WRC',
      season: { pl: 'Sezon 15', en: 'Season 15' },
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1J8lfQ3qvBeook9-UVQQSu8xf7pYBDv7FcCve7VJEmNw/edit',
      source: { type: '', url: '' },
      demo: true                       // do czasu podania adresu pokazujemy przykład
    },
    {
      id: 'lmu',
      label:  'Le Mans Ultimate',
      season: { pl: 'Sezon 0', en: 'Season 0' },
      sheetUrl: '',
      source: { type: '', url: '' }
    },
    {
      id: 'fh6',
      label:  'Forza Horizon 6',
      season: { pl: 'Sezon 0', en: 'Season 0' },
      sheetUrl: '',
      source: { type: '', url: '' }
    },
    {
      id: 'acr',
      label:  'Assetto Corsa Rally',
      season: { pl: 'Wkrótce', en: 'Soon' },
      sheetUrl: '',
      source: { type: '', url: '' }
    }
  ],

  /* Co ile milisekund pytać źródło o zmianę. Zapytanie kontrolne waży
     kilkaset bajtów — pełne dane lecą tylko wtedy, gdy coś się zmieniło. */
  refreshMs: 60000,

  /* ---------------------------------------------------------------
     8. DANE DEMONSTRACYJNE
     Prawdziwe wyniki z poprzedniego sezonu. Znikają w chwili podania
     adresu źródła — służą tylko do tego, żeby strona nie była pusta.
  --------------------------------------------------------------- */
  demoSheets: {
    wrc: {
      title: 'Sezon 14 (przykład)',
      sheets: [
        {
          name: 'Klasyfikacja generalna',
          headers: ['L.p.', 'Driver', '1. CRO', '2. NZ', '3. KEN', '4. SWE', 'Points', 'Team', 'Division'],
          rows: [
            ['1', 'Tomasz Ciborek',   '42', '55', '48', '54', '199', 'EXR Rally Team', 'PSR1'],
            ['2', 'SRT_AdamRacerPL',  '46', '43', '46', '51', '186', 'SRT_RacersPL',   'PSR1'],
            ['3', 'Norbert',          '51', '43', '42', '45', '181', 'SRC',            'PSR1'],
            ['4', 'Zibiman96',        '52', '19', '37', '39', '147', '',               'PSR1'],
            ['5', 'Gosciu185',        '29', '33', '25', '29', '116', 'SRC',            'PSR1'],
            ['6', 'krystyniaczek',    '38', '21', '27', '24', '110', '',               'Rookie'],
            ['7', 'Jarkus233',        '35', '26', '22', '20', '103', 'Adblue Rally Team', 'PSR2']
          ]
        },
        {
          name: '1. Rajd Chorwacji',
          headers: ['L.p', 'Kierowca', 'Czas', 'Punkty', 'Zespół', 'Samochód', 'Pkt.', 'PS', ''],
          rows: [
            ['1', 'Zibiman96',       '00:28:58.684', '52', '',                  'Skoda Fabia RS Rally2', '50', '2', 'PSR1'],
            ['2', 'Norbert',         '00:29:07.457', '51', 'SRC',               'Ford Fiesta Rally2',    '46', '5', 'PSR1'],
            ['3', 'SRT_AdamRacerPL', '00:29:11.631', '46', 'SRT_RacersPL',      'Hyundai i20 N Rally2',  '42', '4', 'PSR1'],
            ['4', 'Tomasz Ciborek',  '00:29:11.942', '42', 'EXR Rally Team',    'Citroen C3 Rally2',     '39', '3', 'PSR1'],
            ['5', 'krystyniaczek',   '00:29:26.807', '38', '',                  'Volkswagen Polo GTI R5','37', '1', 'Rookie'],
            ['6', 'Jarkus233',       '00:29:31.541', '35', 'Adblue Rally Team', 'Skoda Fabia Rally2',    '35', '',  'PSR1'],
            ['7', 'Gosciu185',       '00:29:48.220', '29', 'SRC',               'Ford Fiesta Rally2',    '29', '',  'PSR2'],
            ['8', 'Kuba',            '00:30:02.910', '26', '',                  '',                      '26', '',  'PSR3'],
            ['9', 'Olex',            '00:30:19.104', '24', '',                  'Hyundai i20 N Rally2',  '24', '',  'PSR2'],
            ['10','Pabcio',          '00:30:41.663', '22', '',                  'Citroen C3 Rally2',     '22', '',  'Rookie']
          ]
        },
        {
          name: '2. Rajd Nowej Zelandii',
          headers: ['L.p', 'Kierowca', 'Czas', 'Punkty', 'Zespół', 'Samochód', 'Pkt.', 'PS', ''],
          rows: []
        }
      ]
    }
  },

  /* ---------------------------------------------------------------
     9. ZDJĘCIA NA KAFELKACH PODIUM
     Wspólna pula zdjęć — bez wiązania z modelem auta, bo kierowcy
     jeżdżą czym chcą. Każdemu z TOP 3 przydzielane jest zdjęcie
     losowo, ale STALE: ten sam kierowca w tej samej rundzie dostaje
     zawsze to samo, więc nic nie przeskakuje przy odświeżeniu.

     Pliki leżą w assets/img/podium/ w dwóch szerokościach:
     <nazwa>-800.webp i <nazwa>-1400.webp. Żeby dorzucić nowe zdjęcie,
     wrzuć oba rozmiary i dopisz nazwę (bez -800/-1400) do listy.
  --------------------------------------------------------------- */
  podiumPhotos: [
    'citroen-c3-1',
    'citroen-c3-2',
    'citroen-c3-3',
    'ford-fiesta-1',
    'ford-fiesta-2',
    'hyundai-i20-1',
    'hyundai-i20-2',
    'hyundai-i20-3',
    'hyundai-i20-4',
    'hyundai-i20-5',
    'hyundai-i20-6',
    'skoda-fabia-1',
    'skoda-fabia-2',
    'skoda-fabia-3',
    'skoda-fabia-4',
    'skoda-fabia-5',
    'skoda-fabia-6',
    'skoda-fabia-7',
    'skoda-fabia-rs-1',
    'skoda-fabia-rs-2',
    'toyota-yaris-1',
    'vw-polo-1',
    'vw-polo-2',
    'vw-polo-3'
  ]
};
