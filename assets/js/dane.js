/* =====================================================================
   Project Simracing — warstwa danych z arkuszy
   ---------------------------------------------------------------------
   Jedno miejsce, w którym wiemy, jak czytać arkusz ligi: skąd go wziąć
   (Apps Script albo opublikowany CSV), które kolumny co znaczą i jak
   przyciąć puste wiersze. Korzysta z tego i podstrona wyników, i skrót
   podium na stronie głównej — dzięki temu obie pokazują to samo.
   ===================================================================== */
(function () {
'use strict';

var PS  = window.PS;
var CFG = PS.cfg;

function norm (v) { return PS.normalize(v); }

/* ------------------------------------------------------------------
   ROZPOZNAWANIE KOLUMN
------------------------------------------------------------------ */
var ALIASES = {
  pos:    ['l.p.', 'l.p', 'lp', 'poz', 'pos', 'miejsce', 'place', '#'],
  driver: ['kierowca', 'driver', 'zawodnik', 'nick', 'gracz'],
  time:   ['czas', 'time', 'wynik', 'total time', 'laptime'],
  points: ['punkty', 'points', 'suma', 'total'],
  team:   ['zespol', 'zespół', 'team', 'ekipa'],
  car:    ['samochod', 'samochód', 'car', 'auto', 'pojazd', 'vehicle'],
  div:    ['division', 'dywizja', 'div', 'klasa', 'class', 'grupa']
};

/* Nagłówek listy kierowców w arkuszu zespołów. Skład bywa rozpisany na
   kilka kolumn, z których tylko pierwsza ma nagłówek („Drivers”), więc
   doklejamy do niej sąsiednie kolumny bez nagłówka. */
var ZALOGA = ['drivers', 'kierowcy', 'zawodnicy', 'sklad', 'sklad zespolu',
              'roster', 'team drivers', 'kierowcy zespolu', 'zawodnik 1'];

var DIV_RE  = /^(psr\s?\d|rookie|div\.?\s?\w+|[a-s]\d?)$/i;

/* Formuła dywizji w arkuszu zwraca FALSE dla kierowcy spoza list —
   takie wartości nie są dywizją i nie mogą trafiać ani na plakietki,
   ani do filtrów. */
var NIE_DYWIZJA = /^(false|true|0|-|—|n\/a|#n\/a|#nd|brak|null)$/i;

function jestDywizja (v) {
  var x = String(v == null ? '' : v).trim();
  return !!x && !NIE_DYWIZJA.test(x);
}

/* Zwraca {pos, driver, time, ...} => indeks kolumny albo -1. */
function resolveColumns (headers, rows) {
  var used = {}, map = {};

  Object.keys(ALIASES).forEach(function (key) {
    map[key] = -1;
    for (var a = 0; a < ALIASES[key].length; a++) {
      var want = norm(ALIASES[key][a]);
      for (var i = 0; i < headers.length; i++) {
        if (used[i]) continue;
        if (norm(headers[i]) === want) { map[key] = i; used[i] = true; return; }
      }
    }
  });

  /* SKŁAD ZESPOŁU — nagłówek „Drivers” plus kolejne kolumny bez
     nagłówka, w których faktycznie coś stoi. */
  map.crew = [];
  for (var k = 0; k < headers.length; k++) {
    if (used[k]) continue;
    if (ZALOGA.indexOf(norm(headers[k])) === -1) continue;

    map.crew.push(k); used[k] = true;
    for (var n = k + 1; n < headers.length; n++) {
      if (used[n] || String(headers[n] || '').trim()) break;
      var cos = rows.some(function (r) { return String(r[n] == null ? '' : r[n]).trim() !== ''; });
      if (!cos) break;
      map.crew.push(n); used[n] = true;
    }
    break;
  }

  /* W arkuszach rundowych dywizja bywa w kolumnie bez nagłówka —
     rozpoznajemy ją po zawartości. */
  if (map.div === -1) {
    for (var c = 0; c < headers.length; c++) {
      if (used[c]) continue;
      var hits = 0, seen = 0;
      for (var r = 0; r < rows.length; r++) {
        var v = (rows[r][c] || '').toString().trim();
        if (!v) continue;
        seen++;
        if (DIV_RE.test(v)) hits++;
      }
      if (seen >= 2 && hits / seen >= 0.6) { map.div = c; used[c] = true; break; }
    }
  }

  map._used = used;
  return map;
}

/* Przycina puste kolumny z prawej i puste wiersze. */
function przygotuj (sheet) {
  var headers = (sheet.headers || []).slice();
  var rows    = (sheet.rows || []).map(function (r) { return r.slice(); });

  var width = 0;
  headers.forEach(function (h, i) { if (String(h).trim()) width = i + 1; });
  rows.forEach(function (r) {
    r.forEach(function (v, i) { if (String(v == null ? '' : v).trim()) width = Math.max(width, i + 1); });
  });

  headers = headers.slice(0, width);
  rows = rows
    .map(function (r) {
      var out = r.slice(0, width);
      while (out.length < width) out.push('');
      return out.map(function (v) { return v == null ? '' : String(v).trim(); });
    })
    .filter(function (r) { return r.some(function (v) { return v !== ''; }); });

  var map = resolveColumns(headers, rows);

  var extra = [];
  for (var i = 0; i < width; i++) {
    if (map._used[i]) continue;
    if (!String(headers[i] || '').trim()) continue;
    extra.push(i);
  }

  /* Kto jest bohaterem tej zakładki: kierowca, a w arkuszu zespołów —
     zespół. Ta kolumna dostaje pierwszy plan na podium i w tabeli. */
  map.name   = map.driver !== -1 ? map.driver : map.team;
  map.isTeam = map.driver === -1 && map.team !== -1;

  /* Wiersz bez nazwy to nie wynik, tylko pusta linijka arkusza —
     w tabeli zespołów bywa ich kilkanaście i tylko spowalniają stronę. */
  if (map.name !== -1) {
    rows = rows.filter(function (r) { return String(r[map.name] || '').trim() !== ''; });
  } else {
    rows = rows.filter(function (r) {
      return r.some(function (v) { var x = String(v).trim(); return x !== '' && x !== '0'; });
    });
  }

  return { name: sheet.name, headers: headers, rows: rows, map: map, extra: extra };
}

/* Skład zespołu z jednego wiersza, bez pustych miejsc. */
function zaloga (t2, r) {
  return (t2.map.crew || []).map(function (i) { return String(r[i] == null ? '' : r[i]).trim(); })
                            .filter(Boolean);
}

/* ------------------------------------------------------------------
   POBIERANIE
------------------------------------------------------------------ */
function fetchJson (url) {
  return fetch(url, { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}

/* Bardzo prosty czytnik CSV — radzi sobie z cudzysłowami i przecinkami. */
function parseCsv (text) {
  var rows = [], row = [], cell = '', quoted = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
      } else { cell += ch; }
    } else if (ch === '"') { quoted = true;
    } else if (ch === ',') { row.push(cell); cell = '';
    } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '';
    } else if (ch !== '\r') { cell += ch; }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* Mistrzostwa po identyfikatorze („wrc”, „lmu”…). */
function champ (id) {
  var lista = CFG.championships || [];
  for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
  return null;
}

/* Zwraca { title, updated, sheets, demo } albo odrzuca obietnicę.
   Brak adresu i brak danych przykładowych => błąd z kodem „nosource”. */
function pobierz (ch) {
  var src = (ch && ch.source) || {};

  if (!src.url) {
    var d = ch && ch.demo && (CFG.demoSheets || {})[ch.id];
    if (d) return Promise.resolve({ title: d.title, updated: 'demo', sheets: d.sheets, demo: true });
    var e = new Error('nosource'); e.kod = 'nosource';
    return Promise.reject(e);
  }

  if (src.type === 'pubcsv') {
    return Promise.all((src.tabs || []).map(function (tab) {
      return fetch(tab.url, { cache: 'no-store' })
        .then(function (r) { return r.text(); })
        .then(function (tekst) {
          var rows = parseCsv(tekst);
          return { name: tab.name, headers: rows.shift() || [], rows: rows };
        });
    })).then(function (sheets) {
      return { title: ch.label, updated: String(Date.now()), sheets: sheets };
    });
  }

  return fetchJson(src.url).then(function (data) {
    if (data && data.error && !(data.sheets || []).length) throw new Error(data.error);
    doPamieci(ch, data);
    return data;
  });
}

/* ------------------------------------------------------------------
   PAMIĘĆ PRZEGLĄDARKI
   Apps Script potrafi odpowiadać kilka sekund. Ostatnie dane każdej
   serii trzymamy więc w przeglądarce czytelnika: przy następnej wizycie
   tabela pojawia się od razu, a świeże dane podmieniają ją po cichu,
   gdy tylko przyjdą (i tylko wtedy, gdy coś się zmieniło).
------------------------------------------------------------------ */
var PAMIEC = 'ps-dane-';
var PAMIEC_WIEK = 14 * 24 * 3600 * 1000;      // starsze niż dwa tygodnie — nie pokazujemy

function zPamieci (ch) {
  var src = ch && ch.source;
  if (!src || !src.url) return null;
  try {
    var o = JSON.parse(window.localStorage.getItem(PAMIEC + ch.id) || 'null');
    if (!o || o.u !== src.url || !o.d || !o.d.sheets || Date.now() - o.t > PAMIEC_WIEK) return null;
    o.d.zPamieci = o.t;                       // kiedy te dane przyszły z arkusza
    return o.d;
  } catch (e) { return null; }
}

function doPamieci (ch, data) {
  if (!ch || !ch.id || !data || data.demo || !(data.sheets || []).length) return;
  try {
    window.localStorage.setItem(PAMIEC + ch.id,
      JSON.stringify({ u: ch.source.url, t: Date.now(), d: data }));
  } catch (e) {
    try { window.localStorage.removeItem(PAMIEC + ch.id); } catch (e2) {}
  }
}

/* Najpierw to, co jest w pamięci (od razu), potem świeże dane z arkusza.
   gdyDane(data, zPamieci) może więc zostać wywołane dwa razy; drugi raz
   tylko wtedy, gdy znacznik zmiany się różni. Zwraca obietnicę świeżych
   danych — odrzuconą, gdy arkusz nie odpowiedział. */
function pobierzSzybko (ch, gdyDane) {
  var stare = zPamieci(ch);
  if (stare) gdyDane(stare, true);
  return pobierz(ch).then(function (data) {
    if (!stare || String(stare.updated) !== String(data.updated)) gdyDane(data, false);
    return data;
  });
}

/* Zakładki widoczne dla użytkownika (te z podkreśleniem są techniczne). */
function zakladki (data) {
  return ((data && data.sheets) || []).filter(function (s) {
    return String(s.name || '').charAt(0) !== '_';
  });
}

/* Czy w wierszu stoi jakikolwiek wynik? Zero punktów i pusty czas
   znaczą, że runda jest dopiero wpisana do arkusza, ale nierozegrana. */
function maWynik (t2, r) {
  var m = t2.map;
  if (m.time !== -1) {
    var c = String(r[m.time] || '').trim();
    if (c && !/^(0|0[:.,]0+|-|—)$/.test(c)) return true;
  }
  if (m.points !== -1) {
    var pkt = parseFloat(String(r[m.points] || '').replace(',', '.'));
    if (pkt > 0) return true;
  }
  return false;
}

/* Ostatnia zakładka z prawdziwymi wynikami kierowców — tego szuka
   skrót podium na stronie głównej. Najpierw szukamy wśród rund
   (nazwa zaczyna się od numeru, np. „3. FIN”), a dopiero potem
   wśród pozostałych zakładek, żeby nie pokazać klasyfikacji
   generalnej zamiast ostatniego rajdu. */
/* Numer rundy z nazwy zakładki: „4. ESP” -> 4, „R3 Japonia” -> 3. */
function numerRundy (nazwa) {
  var m = /^\s*r?\s?(\d+)/i.exec(String(nazwa || ''));
  return m ? parseInt(m[1], 10) : 0;
}

/* Wśród rund wygrywa ta z najwyższym numerem (nie ostatnia z lewej na
   prawo — kolejność zakładek w arkuszu bywa dowolna), a zakładki
   testowe („Test – Monte-Carlo”) tylko wtedy, gdy nie ma nic innego. */
function ostatniaZWynikami (lista, wgNumeru) {
  var wybor = null, test = null;
  for (var i = 0; i < lista.length; i++) {
    var t2 = przygotuj(lista[i]);
    if (t2.map.driver === -1 || !t2.rows.length) continue;
    if (!t2.rows.some(function (r) { return maWynik(t2, r); })) continue;
    if (/\btest/i.test(t2.name)) { test = t2; continue; }
    if (wgNumeru && wybor && numerRundy(t2.name) < numerRundy(wybor.name)) continue;
    wybor = t2;
  }
  return wybor || test;
}

/* Zakładka rundy: „3. FIN” (WRC) albo „R3 Japonia” (LMU). */
var JEST_RUNDA = /^\s*(\d+\s*[.)]|r\s?\d+\b)/i;

function ostatniaRunda (data) {
  var rundy = [], inne = [];
  zakladki(data).forEach(function (s) {
    (JEST_RUNDA.test(String(s.name || '')) ? rundy : inne).push(s);
  });
  return ostatniaZWynikami(rundy, true) || ostatniaZWynikami(inne);
}

/* Auto każdego kierowcy z ostatniej rozegranej rundy, w której jechał.
   Klasyfikacje (generalna, dywizje) nie mają kolumny z autem — stąd
   bierzemy, czym kierowca jeździ teraz. Klucz: znormalizowane nazwisko. */
function autaKierowcow (data) {
  var mapa = {};
  zakladki(data).forEach(function (s) {
    if (!JEST_RUNDA.test(String(s.name || ''))) return;   // tylko rundy („2. GRE”, „R2 Stany…”)
    var t2 = przygotuj(s);
    var m = t2.map;
    if (m.driver === -1 || m.car === -1) return;
    t2.rows.forEach(function (r) {
      var kto = norm(r[m.driver]), auto = String(r[m.car] || '').trim();
      if (kto && auto && maWynik(t2, r)) mapa[kto] = auto;
    });
  });
  return mapa;
}

/* ------------------------------------------------------------------
   KLASY WYŚCIGOWE (LMU)
   Kolumna „Klasa” z wartościami LMGT3, LMP2… to nie dywizje jednej
   klasyfikacji, tylko osobne klasyfikacje: LMP2 nie może być „pierwszy”
   przed LMGT3. Rozpoznajemy to po samych wartościach — dywizje WRC
   (PSR1, Rookie…) zostają po staremu.
------------------------------------------------------------------ */
var KLASA_RE = /^(lm\s?gt\s?[34e]|gt\s?[34]|gte(\s?(pro|am))?|lmp\s?[1-3](\s?elms)?|hypercar|lmh|lmdh)$/i;

/* Lista klas w zakładce (najliczniejsza pierwsza = główna) albo null. */
function klasy (t2) {
  var m = t2 && t2.map;
  if (!m || m.div === -1) return null;
  var ile = {}, lista = [];
  for (var i = 0; i < t2.rows.length; i++) {
    var v = String(t2.rows[i][m.div] || '').trim();
    if (!jestDywizja(v)) continue;
    if (!KLASA_RE.test(v)) return null;
    if (!(v in ile)) { ile[v] = 0; lista.push(v); }
    ile[v]++;
  }
  if (lista.length < 2) return null;
  var glowna = (CFG.klasaGlowna || '').toLowerCase();
  return lista.sort(function (a, b) {
    return (b.toLowerCase() === glowna) - (a.toLowerCase() === glowna) || ile[b] - ile[a] || a.localeCompare(b);
  });
}

/* Wiersze jednej klasy z pozycją w tej klasie (pole .poz).
   Klasyfikacja (punkty, bez czasu): kolejność wg punktów, remis = ta
   sama pozycja. Runda: kolejność z arkusza, numeracja od 1 w klasie,
   „—” (nie ukończył) zostaje. */
function wierszeKlasy (t2, klasa) {
  var m = t2.map;
  var rows = t2.rows.filter(function (r) { return norm(r[m.div]) === norm(klasa); });

  if (m.points !== -1 && m.time === -1) {
    var pkt = function (r) {
      var x = parseFloat(String(r[m.points] || '').replace(',', '.'));
      return isNaN(x) ? -1 : x;
    };
    var oc = rows.map(function (r, i) { return { r: r, i: i, p: pkt(r) }; })
      .sort(function (a, b) { return b.p - a.p || a.i - b.i; });
    return oc.map(function (o) {
      var c = o.r.slice();
      c.poz = String(1 + oc.filter(function (x) { return x.p > o.p; }).length);
      return c;
    });
  }

  /* Arkusz z eksportu LMU ma już pozycje w klasie (zaczynają się od 1) —
     wtedy je zostawiamy; pozycje w całej stawce numerujemy od nowa. */
  var org = function (r) { return m.pos !== -1 ? String(r[m.pos] || '').trim() : ''; };
  var liczbowe = rows.map(org).filter(function (v) { return /^\d+\.?$/.test(v); });
  var wKlasie = liczbowe.length && parseInt(liczbowe[0], 10) === 1;
  var n = 0;
  return rows.map(function (r) {
    var c = r.slice(), o = org(r);
    c.poz = (!o || /^\d+\.?$/.test(o)) ? (wKlasie && o ? o.replace('.', '') : String(++n)) : o;
    return c;
  });
}

/* Zdjęcie na podium. Gdy seria ma zdjęcia przypisane do aut (LMU),
   a tego auta wśród nich nie ma (np. gościnna Oreca z LMP2), lepszy
   jest gładki kafelek niż losowe, cudze auto. */
function zdjecieAuta (kto, seria, auto, zespol, zajete) {
  var tekst = [auto || '', zespol || ''].join(' ');
  var pp = (CFG.podiumPhotos || {})[seria];
  if (seria === 'lmu' && pp && pp.auta && typeof PS.dopasuj === 'function' && String(auto || '').trim() &&
      !PS.dopasuj(pp.auta, tekst)) return null;
  return PS.photoFile(kto, seria, tekst, zajete);
}

/* ------------------------------------------------------------------
   PODIUM — wygląd wspólny dla strony głównej i wyników
   Kilka reguł dokładanych z kodu, żeby działały niezależnie od wersji
   style.css na serwerze: puste miejsce na podium, przyciski serii
   z paskiem odliczania i wjazd kafelków.
------------------------------------------------------------------ */
var STYL_PODIUM =
  '.pod.pod--puste{visibility:hidden;pointer-events:none;border-color:transparent;background:none}' +
  '@media (max-width:860px){.pod.pod--puste{display:none}}' +
  '.podchamps{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}' +
  '.podchamps[hidden]{display:none}' +
  '.podchamps .champ{position:relative;display:inline-flex;align-items:center;gap:9px;min-height:0;' +
    'padding:10px 16px 12px;border:1px solid rgba(174,182,198,.22);background:rgba(17,26,42,.55);color:inherit;' +
    'font:600 .72rem/1 var(--mono,"IBM Plex Mono",ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;' +
    'cursor:pointer;overflow:hidden;opacity:.62;transition:opacity .2s,border-color .2s}' +
  '.podchamps .champ:hover{opacity:.9}' +
  '.podchamps .champ.is-on{opacity:1;border-color:var(--kolor,#F04E23)}' +
  '.podchamps .champ small{display:none}' +
  '.podchamps .champ__kropka{flex:none;width:7px;height:7px;border-radius:50%;background:var(--kolor,#F04E23)}' +
  '.podchamps .champ__czas{position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--kolor,#F04E23);' +
    'transform-origin:0 50%;transform:scaleX(0);animation:psPodCzas var(--czas,9000ms) linear forwards}' +
  '.podchamps.is-pauza .champ__czas{animation-play-state:paused}' +
  '@keyframes psPodCzas{to{transform:scaleX(1)}}' +
  '@media (prefers-reduced-motion:reduce){.podchamps .champ__czas{display:none}}';

(function () {
  if (document.getElementById('psStylPodium')) return;
  var st = document.createElement('style');
  st.id = 'psStylPodium';
  st.textContent = STYL_PODIUM;
  (document.head || document.documentElement).appendChild(st);
})();

/* Kafelki wjeżdżają po kolei (2 – 1 – 3), podpis rundy przenika. */
function wjazd (kafelki, podpis) {
  if (!kafelki || !kafelki.length || !kafelki[0].animate) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  [].forEach.call(kafelki, function (el, i) {
    el.animate([
      { opacity: 0, transform: 'translateY(18px) scale(.985)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 520, delay: i * 90, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
    var foto = el.querySelector('.pod__img');
    if (foto) foto.animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
                           { duration: 900, delay: i * 90, easing: 'cubic-bezier(.2,.75,.25,1)' });
  });
  if (podpis && podpis.animate) podpis.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
}

PS.dane = {
  wjazd: wjazd,
  numerRundy: numerRundy,
  zdjecieAuta: zdjecieAuta,
  klasy: klasy,
  wierszeKlasy: wierszeKlasy,
  autaKierowcow: autaKierowcow,
  jestDywizja: jestDywizja,
  resolveColumns: resolveColumns,
  przygotuj: przygotuj,
  zaloga: zaloga,
  parseCsv: parseCsv,
  fetchJson: fetchJson,
  pobierz: pobierz,
  pobierzSzybko: pobierzSzybko,
  zPamieci: zPamieci,
  champ: champ,
  zakladki: zakladki,
  maWynik: maWynik,
  ostatniaRunda: ostatniaRunda
};

})();
