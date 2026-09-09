/* =====================================================================
   Project Simracing — strona wyników
   ---------------------------------------------------------------------
   Strona nie zna układu żadnego arkusza z góry. Rozpoznaje kolumny po
   nagłówkach (z listy synonimów), a wszystko, czego nie rozpozna,
   pokazuje jako dodatkowe kolumny liczbowe. Dzięki temu ten sam kod
   obsługuje arkusz rajdowy, wyścigowy i klasyfikację generalną — także
   te, których jeszcze nie ma.
   ===================================================================== */
(function () {
'use strict';

var PS  = window.PS;
var CFG = PS.cfg;
var $   = PS.$;
var $$  = PS.$$;
var esc = PS.esc;
var txt = PS.txt;
var t   = PS.t;

/* Czytanie arkusza (kolumny, przycinanie, pobieranie) siedzi w dane.js —
   ta sama warstwa obsługuje skrót podium na stronie głównej. */
var D           = PS.dane;
var prepare     = D.przygotuj;
var zaloga      = D.zaloga;
var jestDywizja = D.jestDywizja;
var norm        = PS.normalize;

PS.addStrings({
  pl: {
    'res.title': 'Wyniki i klasyfikacje',
    'res.live': 'Na żywo',
    'res.division': 'Dywizja',
    'res.all': 'Wszystkie',
    'res.searchLabel': 'Szukaj kierowcy',
    'res.searchPh': 'Szukaj kierowcy…',
    'res.updated': 'Zaktualizowano',
    'res.checked': 'Sprawdzono',
    'res.longago': 'dawno temu',
    'res.justnow': 'przed chwilą',
    'res.ago': 'temu',
    'res.min': 'min',
    'res.sec': 's',
    'res.openSheet': 'Otwórz arkusz',
    'res.demo': 'Dane demonstracyjne z poprzedniego sezonu — bieżące wyniki pojawią się po podpięciu arkusza.',
    'res.nosource': 'Dla tych mistrzostw nie podano jeszcze arkusza z wynikami.',
    'res.loading': 'Wczytywanie wyników…',
    'res.error': 'Nie udało się pobrać wyników z arkusza. Sprawdź, czy adres jest poprawny, a arkusz udostępniony.',
    'res.retry': 'Spróbuj ponownie',
    'res.empty': 'Ta runda jeszcze się nie odbyła — wyniki pojawią się tu automatycznie.',
    'res.nomatch': 'Żaden kierowca nie pasuje do wyszukiwania.',
    'res.rows': 'Wyników',
    'res.of': 'z',
    'col.pos': 'Poz', 'col.driver': 'Kierowca', 'col.car': 'Samochód',
    'col.team': 'Zespół', 'col.crew': 'Kierowcy', 'col.time': 'Czas', 'col.points': 'Pkt',
    'src.demo': 'dane przykładowe'
  },
  en: {
    'res.title': 'Results & standings',
    'res.live': 'Live',
    'res.division': 'Division',
    'res.all': 'All',
    'res.searchLabel': 'Search driver',
    'res.searchPh': 'Search driver…',
    'res.updated': 'Updated',
    'res.checked': 'Checked',
    'res.longago': 'a long time ago',
    'res.justnow': 'just now',
    'res.ago': 'ago',
    'res.min': 'min',
    'res.sec': 's',
    'res.openSheet': 'Open spreadsheet',
    'res.demo': 'Sample data from last season — live results appear once the spreadsheet is connected.',
    'res.nosource': 'No results spreadsheet has been set for this championship yet.',
    'res.loading': 'Loading results…',
    'res.error': 'Could not load results. Check the address and that the spreadsheet is shared.',
    'res.retry': 'Try again',
    'res.empty': 'This round has not run yet — results will appear here automatically.',
    'res.nomatch': 'No driver matches your search.',
    'res.rows': 'Results',
    'res.of': 'of',
    'col.pos': 'Pos', 'col.driver': 'Driver', 'col.car': 'Car',
    'col.team': 'Team', 'col.crew': 'Drivers', 'col.time': 'Time', 'col.points': 'Pts',
    'src.demo': 'sample data'
  }
});

/* ------------------------------------------------------------------
   STAN
------------------------------------------------------------------ */
var state = {
  champ: 0,
  tab: 0,
  data: null,      // { title, updated, sheets: [...] }
  status: 'idle',  // idle | loading | ok | error | nosource
  division: 'all',
  query: '',
  updated: 0,      // znacznik zmiany z arkusza — ciąg znaków, NIE data
  checkedAt: 0,    // kiedy strona ostatnio pytała źródło
  changedAt: 0,    // kiedy znacznik ostatnio się zmienił (0 = nie wiemy)
  demo: false
};

var pollTimer = null;
var agoTimer  = null;

/* ------------------------------------------------------------------
   POBIERANIE DANYCH
------------------------------------------------------------------ */
function currentChamp () { return (CFG.championships || [])[state.champ] || null; }

function loadChampionship (force) {
  var ch = currentChamp();
  if (!ch) return;

  var zywe = !!(ch.source && ch.source.url);
  if (zywe) { state.status = 'loading'; state.demo = false; renderAll(); }

  D.pobierz(ch).then(function (data) {
    var poprzedni = state.updated;

    state.data      = data;
    state.demo      = !!data.demo;
    state.updated   = data.updated || '';
    state.checkedAt = Date.now();
    if (poprzedni && poprzedni !== state.updated) state.changedAt = Date.now();
    state.status = 'ok';

    if (state.tab >= D.zakladki(data).length) state.tab = 0;
    if (typeof wybierzZadanaZakladke === 'function') wybierzZadanaZakladke();

    renderAll();
    if (zywe) schedulePoll();
  }).catch(function (err) {
    state.data = null;
    state.demo = false;
    state.tab  = 0;

    if (err && err.kod === 'nosource') {
      state.status = 'nosource';
      renderAll();
      return;
    }
    if (window.console) console.warn('[wyniki]', err);
    state.status = 'error';
    renderAll();
    schedulePoll();
  });
}

/* Zapytanie kontrolne: pytamy tylko o znacznik zmiany. */
function schedulePoll () {
  clearTimeout(pollTimer);
  var ch = currentChamp();
  var src = ch && ch.source;
  if (!src || !src.url) return;

  pollTimer = setTimeout(function () {
    if (document.hidden) { schedulePoll(); return; }

    if (src.type === 'pubcsv') { loadChampionship(true); return; }

    var sep = src.url.indexOf('?') === -1 ? '?' : '&';
    fetchJson(src.url + sep + 'meta=1')
      .then(function (meta) {
        state.checkedAt = Date.now();
        if (meta && meta.updated && meta.updated !== state.updated) {
          loadChampionship(true);      // coś się zmieniło — pobieramy całość
        } else {
          schedulePoll();
          renderStatus();
        }
      })
      .catch(function () { schedulePoll(); });
  }, CFG.refreshMs || 60000);
}

/* ------------------------------------------------------------------
   RYSOWANIE
------------------------------------------------------------------ */
function renderChamps () {
  var box = $('#champs');
  if (!box) return;

  box.innerHTML = (CFG.championships || []).map(function (c, i) {
    var has = !!(c.source && c.source.url) || (c.demo && (CFG.demoSheets || {})[c.id]);
    return '<button type="button" class="champ' + (i === state.champ ? ' is-on' : '') + '"' +
           (has ? '' : ' disabled') + ' data-champ="' + i + '" role="tab"' +
           ' aria-selected="' + (i === state.champ) + '">' +
           esc(txt(c.label)) +
           '<small>' + esc(has ? txt(c.season) : t('soon')) + '</small></button>';
  }).join('');

  $$('[data-champ]', box).forEach(function (b) {
    b.addEventListener('click', function () {
      state.champ = parseInt(b.getAttribute('data-champ'), 10);
      state.tab = 0; state.division = 'all'; state.query = '';
      var s = $('#search'); if (s) s.value = '';
      clearTimeout(pollTimer);
      loadChampionship();
    });
  });
}

function renderTabs () {
  var box = $('#rounds');
  if (!box) return;

  var list = D.zakladki(state.data);
  box.innerHTML = list.map(function (s, i) {
    return '<button type="button" class="round' + (i === state.tab ? ' is-on' : '') + '"' +
           ' data-tab="' + i + '" role="tab" aria-selected="' + (i === state.tab) + '">' +
           esc(s.name) + '</button>';
  }).join('');
  box.hidden = list.length < 2;

  $$('[data-tab]', box).forEach(function (b) {
    b.addEventListener('click', function () {
      state.tab = parseInt(b.getAttribute('data-tab'), 10);
      renderBody();
    });
  });
}

function currentSheet () {
  var list = D.zakladki(state.data);
  return list[state.tab] ? prepare(list[state.tab]) : null;
}

function filterRows (t2, ignoreQuery) {
  var q = ignoreQuery ? '' : state.query.trim().toLowerCase();
  return t2.rows.filter(function (r) {
    if (state.division !== 'all') {
      if (t2.map.div === -1) return false;
      if (norm(r[t2.map.div]) !== norm(state.division)) return false;
    }
    if (q) {
      var gdzie = [];
      if (t2.map.name !== -1) gdzie.push(r[t2.map.name]);
      (t2.map.crew || []).forEach(function (i) { gdzie.push(r[i]); });
      if (t2.map.team !== -1) gdzie.push(r[t2.map.team]);
      if (gdzie.join(' ').toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  });
}

function renderDivisions (t2) {
  var box = $('#divChips');
  var wrap = $('#filters');
  if (!box || !wrap) return;

  if (!t2 || t2.map.div === -1 || !t2.rows.length) { wrap.hidden = true; return; }

  var seen = [];
  t2.rows.forEach(function (r) {
    var v = String(r[t2.map.div] || '').trim();
    if (jestDywizja(v) && seen.indexOf(v) === -1) seen.push(v);
  });
  seen.sort();

  /* Zakładka jednej dywizji (np. „Div. PSR1") ma wszystkie wiersze
     w tej samej dywizji — filtry byłyby tam powtórzeniem zakładek. */
  if (seen.length < 2) { wrap.hidden = true; state.division = 'all'; return; }
  wrap.hidden = false;

  box.innerHTML = ['all'].concat(seen).map(function (d) {
    return '<button type="button" class="chip' + (state.division === d ? ' is-on' : '') + '"' +
           ' data-div="' + esc(d) + '">' + esc(d === 'all' ? t('res.all') : d) + '</button>';
  }).join('');

  $$('[data-div]', box).forEach(function (b) {
    b.addEventListener('click', function () {
      state.division = b.getAttribute('data-div');
      renderBody();
    });
  });
}

function renderPodium (t2, rows) {
  var box = $('#podium');
  if (!box) return;

  var m = t2 ? t2.map : null;
  var scored = m && (m.time !== -1 || m.points !== -1);
  if (!t2 || !scored || !rows.length) { box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;

  var top = rows.slice(0, 3);
  var order = [1, 0, 2];
  var html = '';

  order.forEach(function (idx) {
    var r = top[idx];
    if (!r) return;

    var pos  = idx + 1;
    var car  = m.car  !== -1 ? r[m.car]  : '';
    var team = m.team !== -1 ? r[m.team] : '';
    var time = m.time !== -1 ? r[m.time] : (m.points !== -1 ? r[m.points] + ' pkt' : '');
    var div  = (m.div !== -1 && jestDywizja(r[m.div])) ? r[m.div] : '';

    /* W arkuszu zespołów pierwszy plan należy do zespołu, a skład
       schodzi do linijki pod spodem — odwrotnie niż w rundach. */
    var tytul  = m.name !== -1 ? String(r[m.name] || '').trim() : '';
    var podpis = m.isTeam
      ? zaloga(t2, r).map(esc).join(' · ')
      : [car, team].filter(Boolean).map(esc).join(' · ');

    var seed = (tytul || 'x') + '|' + t2.name + '|' + pos;

    html += '<article class="pod pod--' + pos + (m.isTeam ? ' pod--team' : '') + '">' +
              PS.photoImg(PS.photoFile(seed)) +
              '<span class="pod__rank" aria-hidden="true">' + pos + '</span>' +
              '<div class="pod__body">' +
                (div ? '<span class="mono pod__div">' + esc(div) + '</span>' : '') +
                '<h2 class="pod__driver">' + esc(tytul || '—') + '</h2>' +
                (podpis ? '<p class="pod__car">' + podpis + '</p>' : '') +
                '<p class="pod__time">' + esc(time || t('pod.notime')) + '</p>' +
              '</div>' +
            '</article>';
  });

  box.innerHTML = html;
  PS.guardImages(box);
}

function renderTable (t2, rows) {
  var wrap = $('#tableWrap');
  var count = $('#rowCount');
  if (!wrap) return;

  if (!t2) { wrap.innerHTML = ''; if (count) count.textContent = ''; return; }

  if (!t2.rows.length) {
    wrap.innerHTML = '<p class="empty">' + esc(t('res.empty')) + '</p>';
    if (count) count.textContent = '';
    return;
  }
  if (!rows.length) {
    wrap.innerHTML = '<p class="empty">' + esc(t('res.nomatch')) + '</p>';
    if (count) count.textContent = '';
    return;
  }

  var m = t2.map;
  var cols = [];
  cols.push({ key: 'pos', label: t('col.pos'), cls: 'pos' });
  if (m.driver !== -1) cols.push({ key: 'driver', label: t('col.driver'), cls: 'drv' });
  if (m.car    !== -1) cols.push({ key: 'car',    label: t('col.car'),    cls: 'mach' });
  if (m.team   !== -1) cols.push({ key: 'team',   label: t('col.team'),   cls: m.isTeam ? 'drv' : 'team' });
  if ((m.crew || []).length) cols.push({ key: 'crew', label: t('col.crew'), cls: 'crew' });
  t2.extra.forEach(function (i) { cols.push({ key: 'x' + i, idx: i, label: t2.headers[i], cls: 'num' }); });
  if (m.time   !== -1) cols.push({ key: 'time',   label: t('col.time'),   cls: 'gap' });
  if (m.points !== -1) cols.push({ key: 'points', label: t('col.points'), cls: 'pts' });

  var head = '<tr>' + cols.map(function (c) {
    return '<th class="th-' + c.cls + '">' + esc(c.label) + '</th>';
  }).join('') + '</tr>';

  var body = rows.map(function (r, n) {
    var place = m.pos !== -1 && String(r[m.pos]).trim() ? String(r[m.pos]).trim() : String(n + 1);
    var rank  = parseInt(place, 10);
    var cls   = (state.division === 'all' && rank >= 1 && rank <= 3) ? ' class="r' + rank + '"' : '';

    var cells = cols.map(function (c) {
      /* Skład zespołu — jedna komórka zamiast trzech bezimiennych kolumn,
         inaczej kierowcy gubią się w tabeli. */
      if (c.key === 'crew') {
        var lista = zaloga(t2, r);
        return '<td class="crew" data-label="' + esc(c.label) + '">' +
               (lista.length
                 ? lista.map(function (n) { return '<span class="crew__n">' + esc(n) + '</span>'; }).join('')
                 : '<span class="dim">—</span>') + '</td>';
      }

      var v;
      if (c.key === 'pos') v = place;
      else if (c.key.charAt(0) === 'x') v = r[c.idx];
      else v = r[m[c.key]];

      if (c.key === 'time' && !String(v).trim()) v = t('pod.notime');
      if (c.key === 'driver' && m.div !== -1 && jestDywizja(r[m.div])) {
        return '<td class="' + c.cls + '" data-label="' + esc(c.label) + '">' + esc(v) +
               '<span class="pill pill--div">' + esc(r[m.div]) + '</span></td>';
      }
      return '<td class="' + c.cls + '" data-label="' + esc(c.label) + '">' + esc(v || '') + '</td>';
    }).join('');

    return '<tr' + cls + '>' + cells + '</tr>';
  }).join('');

  wrap.innerHTML = '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';

  if (count) {
    count.textContent = t('res.rows') + ': ' + rows.length +
      (rows.length !== t2.rows.length ? ' ' + t('res.of') + ' ' + t2.rows.length : '');
  }
}

function renderNotice () {
  var el = $('#notice');
  if (!el) return;
  var msg = '';
  var kind = '';

  if (state.status === 'nosource') { msg = t('res.nosource'); kind = 'notice--info'; }
  else if (state.status === 'error') { msg = t('res.error'); kind = 'notice--error'; }
  else if (state.status === 'loading') { msg = t('res.loading'); kind = 'notice--info'; }
  else if (state.demo) { msg = t('res.demo'); kind = ''; }

  el.hidden = !msg;
  el.className = 'notice ' + kind;
  el.textContent = msg;
}

function agoText (ts) {
  var n = Number(ts);
  if (!n || isNaN(n)) return t('res.longago');
  var s = Math.max(0, Math.round((Date.now() - n) / 1000));
  if (s < 15) return t('res.justnow');
  if (s < 90) return s + ' ' + t('res.sec') + ' ' + t('res.ago');
  if (s < 5400) return Math.round(s / 60) + ' ' + t('res.min') + ' ' + t('res.ago');
  return t('res.longago');
}

function renderStatus () {
  var up = $('#stUpdated');
  var src = $('#stSource');
  var live = $('.live');
  var ch = currentChamp();

  if (up) {
    if (state.status !== 'ok') {
      up.textContent = '—';
    } else if (state.demo) {
      up.textContent = '';
    } else {
      /* „Sprawdzono" to ostatnie zapytanie do arkusza, „zaktualizowano" —
         ostatnia realna zmiana danych. Znacznik z arkusza jest ciągiem
         znaków, nie datą, więc czas liczymy po stronie przeglądarki. */
      var txt2 = t('res.checked') + ': ' + agoText(state.checkedAt);
      if (state.changedAt) txt2 += ' · ' + t('res.updated') + ': ' + agoText(state.changedAt);
      up.textContent = txt2;
    }
  }
  if (live) live.classList.toggle('is-off', state.status !== 'ok' || state.demo);

  /* Czytelnika nie obchodzi, czym technicznie dane przyjeżdżają ani co
     ile sekundy pytamy arkusz — zostaje nazwa sezonu i odnośnik do
     arkusza dla tych, którzy chcą zajrzeć do źródła. */
  if (src && ch) {
    var bits = [];
    if (state.demo) bits.push(t('src.demo'));
    else if (state.data && state.data.title) bits.push(state.data.title);

    src.innerHTML = esc(bits.join(' · ')) +
      (ch.sheetUrl ? (bits.length ? ' · ' : '') +
                     '<a href="' + esc(ch.sheetUrl) + '" target="_blank" rel="noopener">' +
                     esc(t('res.openSheet')) + '</a>' : '');
  }
}

function renderBody () {
  var t2 = currentSheet();
  var rows = t2 ? filterRows(t2) : [];
  renderTabs();
  renderDivisions(t2);
  renderPodium(t2, t2 ? filterRows(t2, true) : []);
  renderTable(t2, rows);
  renderStatus();
}

function renderAll () {
  renderChamps();
  renderNotice();
  renderBody();
}

/* ------------------------------------------------------------------
   OBSŁUGA
------------------------------------------------------------------ */
var search = $('#search');
if (search) {
  search.addEventListener('input', function () {
    state.query = search.value || '';
    renderBody();
  });
}

document.addEventListener('visibilitychange', function () {
  if (!document.hidden) renderStatus();
});

PS.onLang(function () {
  if (search) search.placeholder = t('res.searchPh');
  renderAll();
});

/* Wejście z kalendarza: wyniki.html?champ=wrc&tab=1.%20LAT */
var zadana = { champ: '', tab: '' };
(function () {
  var q = location.search.replace(/^\?/, '').split('&');
  q.forEach(function (para) {
    var kv = para.split('=');
    var k = decodeURIComponent(kv[0] || '');
    var v = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
    if (k === 'champ') zadana.champ = v;
    if (k === 'tab')   zadana.tab = v;
  });
  if (zadana.champ) {
    (CFG.championships || []).forEach(function (c, i) {
      if (c.id === zadana.champ) state.champ = i;
    });
  }
})();

/* Po wczytaniu danych ustawiamy zakładkę wskazaną w adresie. */
var wybierzZadanaZakladke = function () {
  if (!zadana.tab) return;
  var lista = D.zakladki(state.data);
  for (var i = 0; i < lista.length; i++) {
    if (PS.normalize(lista[i].name) === PS.normalize(zadana.tab)) { state.tab = i; break; }
  }
  zadana.tab = '';
};

PS.boot();
loadChampionship();

agoTimer = setInterval(renderStatus, 15000);

})();
