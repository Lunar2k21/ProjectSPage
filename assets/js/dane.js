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

function norm (v) { return PS.normalize(v); }

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

  return fetchJson(src.url);
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
function ostatniaZWynikami (lista) {
  var wybor = null;
  for (var i = 0; i < lista.length; i++) {
    var t2 = przygotuj(lista[i]);
    if (t2.map.driver === -1 || !t2.rows.length) continue;
    if (!t2.rows.some(function (r) { return maWynik(t2, r); })) continue;
    wybor = t2;
  }
  return wybor;
}

function ostatniaRunda (data) {
  var rundy = [], inne = [];
  zakladki(data).forEach(function (s) {
    (/^\s*\d+\s*[.)]/.test(String(s.name || '')) ? rundy : inne).push(s);
  });
  return ostatniaZWynikami(rundy) || ostatniaZWynikami(inne);
}

PS.dane = {
  jestDywizja: jestDywizja,
  resolveColumns: resolveColumns,
  przygotuj: przygotuj,
  zaloga: zaloga,
  parseCsv: parseCsv,
  fetchJson: fetchJson,
  pobierz: pobierz,
  champ: champ,
  zakladki: zakladki,
  maWynik: maWynik,
  ostatniaRunda: ostatniaRunda
};

})();
