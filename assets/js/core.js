/* =====================================================================
   Project Simracing — warstwa wspólna dla wszystkich podstron
   ---------------------------------------------------------------------
   Trzyma to, co powtarza się na każdej stronie: motyw, język, nawigację,
   dopasowanie obrazów aut i drobne narzędzia. Kod konkretnej strony
   dokłada własne teksty przez PS.addStrings() i rejestruje się na zmianę
   języka przez PS.onLang().
   ===================================================================== */
(function () {
'use strict';

var CFG  = window.PS_CONFIG || {};
var HTML = document.documentElement;

/* ------------------------------------------------------------------
   USTAWIENIA WŁASNE (assets/js/zrodla.js)
   Adresy arkuszy i daty rund trzymamy w osobnym pliku, żeby
   aktualizacja kodu strony nigdy ich nie skasowała. Tutaj wkładamy je
   w odpowiednie miejsca konfiguracji.
------------------------------------------------------------------ */
(function scalUstawienia () {
  var L = window.PS_LOCAL || {};

  /* Terminarz pochodzi z tresci/kalendarz.md — przy budowaniu strony
     powstaje z niego assets/js/kalendarz.js. Lista w config.js zostaje
     tylko jako zapas, gdyby pliku nie było. */
  if (window.PS_KALENDARZ && window.PS_KALENDARZ.length) {
    CFG.calendar = window.PS_KALENDARZ;
  }
  if (window.PS_SERIE) {
    CFG.seriesLabel = CFG.seriesLabel || {};
    for (var s in window.PS_SERIE) {
      if (Object.prototype.hasOwnProperty.call(window.PS_SERIE, s)) {
        CFG.seriesLabel[s] = window.PS_SERIE[s];
      }
    }
  }

  var zrodla = L.sources || {};
  (CFG.championships || []).forEach(function (c) {
    var z = zrodla[c.id];
    if (!z) return;

    if (typeof z === 'string') {
      c.source = { type: (c.source && c.source.type) || 'apps', url: z };
    } else {
      c.source = z;                       // pełny obiekt, np. wariant 'pubcsv'
    }
    if (c.source.url) c.demo = false;     // prawdziwe dane wypierają przykładowe
  });

  var daty = L.dates || {};
  var zakladki = L.resultTabs || {};
  (CFG.calendar || []).forEach(function (r) {
    if (daty[r.round]) r.date = daty[r.round];
    if (zakladki[r.round]) r.resultsTab = zakladki[r.round];
  });

  if (L.videos && L.videos.length) {
    if (CFG.media) CFG.media.videos = L.videos;

    /* Slajd „Najnowszy film” bierze identyfikator i opis z pierwszej
       pozycji listy — jedna zmiana w zrodla.js odświeża i slajd,
       i sekcję materiałów. */
    var nowy = L.videos[0] || {};
    (CFG.slides || []).forEach(function (s2) {
      if (s2.type !== 'video' || !nowy.id) return;
      s2.video = nowy.id;
      if (nowy.title) s2.desc = { pl: nowy.title, en: nowy.title };
      (s2.actions || []).forEach(function (a) {
        if (a.primary) a.href = 'https://www.youtube.com/watch?v=' + nowy.id;
      });
    });
  }
})();

function $  (s, r) { return (r || document).querySelector(s); }
function $$ (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

/* ------------------------------------------------------------------
   TEKSTY
------------------------------------------------------------------ */
var STR = {
  pl: {
    'skip': 'Przejdź do treści',
    'soon': 'wkrótce',
    'theme.toDark': 'Włącz motyw ciemny',
    'theme.toLight': 'Włącz motyw jasny',
    'pod.notime': '--:--.---'
  },
  en: {
    'skip': 'Skip to content',
    'soon': 'soon',
    'theme.toDark': 'Switch to dark theme',
    'theme.toLight': 'Switch to light theme',
    'pod.notime': '--:--.---'
  }
};

function addStrings (obj) {
  ['pl', 'en'].forEach(function (l) {
    if (!obj[l]) return;
    for (var k in obj[l]) { if (Object.prototype.hasOwnProperty.call(obj[l], k)) STR[l][k] = obj[l][k]; }
  });
}

var lang = 'pl';
function t (key) { return (STR[lang] && STR[lang][key]) || STR.pl[key] || key; }

/* Pole konfiguracji może być stringiem albo obiektem {pl,en}. */
function txt (v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.pl || '';
}

function esc (s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ------------------------------------------------------------------
   MOTYW
------------------------------------------------------------------ */
var themeBtn = $('#themeBtn');

function applyTheme (name) {
  HTML.setAttribute('data-theme', name);
  try { localStorage.setItem('ps-theme', name); } catch (e) {}
  if (themeBtn) {
    var next = name === 'dark' ? 'theme.toLight' : 'theme.toDark';
    themeBtn.setAttribute('aria-label', t(next));
    themeBtn.setAttribute('title', t(next));
  }
}

if (themeBtn) {
  themeBtn.addEventListener('click', function () {
    applyTheme(HTML.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
}

/* ------------------------------------------------------------------
   JĘZYK
------------------------------------------------------------------ */
var listeners = [];
function onLang (fn) { listeners.push(fn); }

function applyLang (code) {
  lang = (code === 'en') ? 'en' : 'pl';
  HTML.lang = lang;
  try { localStorage.setItem('ps-lang', lang); } catch (e) {}

  $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
  $$('[data-lang]').forEach(function (b) {
    var on = b.getAttribute('data-lang') === lang;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  applyTheme(HTML.getAttribute('data-theme') || 'dark');
  renderNav();
  listeners.forEach(function (fn) { fn(); });
}

$$('[data-lang]').forEach(function (b) {
  b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); });
});

/* ------------------------------------------------------------------
   NAWIGACJA
------------------------------------------------------------------ */
var burger = $('#burger');
var mobnav = $('#mobnav');

/* Strony dokumentów leżą w podfolderach (np. /artykuly/nazwa/), więc
   odnośniki do reszty serwisu muszą wiedzieć, gdzie jest korzeń.
   Ścieżkę podaje atrybut data-baza na <html>. */
var BAZA = document.documentElement.getAttribute('data-baza') || '';

function adres (h) {
  if (!h || /^(https?:|mailto:|#|\/)/.test(h)) return h;
  return BAZA + h;
}

function klucz (h) {
  return String(h || '').split('#')[0].split('?')[0]
    .replace(/index\.html$/, '').replace(/\.html$/, '')
    .replace(/\/$/, '').replace(/^.*\//, '') || 'index';
}

function navHtml (extra) {
  /* Strona mówi o sobie sama (data-strona), bo z adresu w podfolderze
     nie da się tego odczytać. */
  var here = document.body.getAttribute('data-strona') ||
             klucz(location.pathname.split('/').pop() || 'index.html');
  return (CFG.nav || []).map(function (n) {
    var label = esc(txt(n.label));
    if (n.soon) {
      return '<span class="nav__soon" aria-disabled="true" title="' + esc(t('soon')) + '">' +
             label + '<i class="pill">' + esc(t('soon')) + '</i></span>';
    }
    var on = klucz(n.href) === here;
    return '<a href="' + esc(adres(n.href)) + '"' + (on ? ' class="is-on" aria-current="page"' : '') + '>' + label + '</a>';
  }).join('') + (extra || '');
}

function renderNav () {
  var main = $('#navMain');
  if (main) main.innerHTML = navHtml();
  if (mobnav) {
    mobnav.innerHTML = navHtml('<a href="https://discord.gg/R3Tu68jWwK" target="_blank" rel="noopener">Discord</a>');
    $$('a', mobnav).forEach(function (a) {
      a.addEventListener('click', function () {
        mobnav.hidden = true;
        if (burger) burger.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

if (burger && mobnav) {
  burger.addEventListener('click', function () {
    var open = mobnav.hidden;
    mobnav.hidden = !open;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

/* ------------------------------------------------------------------
   ZDJĘCIA NA KAFELKACH PODIUM
   Kierowcy jeżdżą czym chcą, więc nie próbujemy dopasowywać zdjęcia do
   modelu auta. Bierzemy losowe zdjęcie ze wspólnej puli — ale losowanie
   jest STAŁE: ten sam kierowca w tej samej rundzie dostaje zawsze to
   samo zdjęcie, a dwaj różni kierowcy różne. Bez tego zdjęcia
   przeskakiwałyby przy każdym odświeżeniu.
------------------------------------------------------------------ */
function normalize (s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function seedFrom (str) {
  var h = 2166136261;
  str = String(str);
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

function photoFile (seedKey) {
  var pula = CFG.podiumPhotos || [];
  if (!pula.length) return null;
  return pula[seedFrom(seedKey) % pula.length];
}

function photoImg (file, sizes) {
  if (!file) return '<span class="pod__img pod__img--none" aria-hidden="true"></span>';
  return '<img class="pod__img" alt="" loading="lazy" decoding="async"' +
         ' src="assets/img/podium/' + file + '-800.webp"' +
         ' srcset="assets/img/podium/' + file + '-800.webp 800w,' +
         ' assets/img/podium/' + file + '-1400.webp 1400w"' +
         ' sizes="' + (sizes || '(max-width: 860px) 92vw, 30vw') + '">';
}

/* ------------------------------------------------------------------
   KALENDARZ
   Jedno miejsce, z którego terminy bierze i pasek na stronie głównej,
   i podstrona kalendarza. Dzięki temu obie liczą tak samo.
------------------------------------------------------------------ */
function rounds () {
  var cal = CFG.calendar || [];
  var etykiety = CFG.seriesLabel || {};
  var teraz = Date.now();

  var lista = cal.map(function (r, i) {
    var ts = r.date ? Date.parse(r.date) : NaN;
    var start = isNaN(ts) ? null : new Date(ts);
    var dlugosc = r.durationMin || 90;

    /* Wydarzenie może trwać tydzień — wtedy w kalendarzu podany jest
       koniec i przez cały ten czas runda jest „w trakcie". */
    var tsK = r.koniec ? Date.parse(r.koniec) : NaN;
    var koniec = !isNaN(tsK) ? tsK : (start ? start.getTime() + dlugosc * 60000 : 0);

    return {
      n: r.round || (i + 1),
      series: r.series || '',
      seriesLabel: txt(etykiety[r.series] || ''),
      name: txt(r.name),
      resultsTab: r.resultsTab || '',
      start: start,
      end: koniec ? new Date(koniec) : null,
      wielodniowy: !!(r.koniec && !isNaN(tsK)),
      durationMin: dlugosc,
      done: !!(start && koniec <= teraz),
      live: !!(start && start.getTime() <= teraz && koniec > teraz),
      next: false
    };
  });

  /* Najbliższa = pierwsza nierozegrana z datą. Gdy nikt nie wpisał
     jeszcze dat, bierzemy pierwszą nierozegraną z listy. */
  var nast = null;
  lista.forEach(function (r) {
    if (r.done || !r.start) return;
    if (!nast || r.start < nast.start) nast = r;
  });
  if (!nast) {
    for (var i = 0; i < lista.length; i++) {
      if (!lista[i].done) { nast = lista[i]; break; }
    }
  }
  if (nast) nast.next = true;

  return lista;
}

function nextRound () {
  var ov = CFG.nextRoundOverride || {};
  if (txt(ov.name)) {
    var ts = ov.date ? Date.parse(ov.date) : NaN;
    return {
      n: 0, name: txt(ov.name), seriesLabel: txt(ov.note),
      start: isNaN(ts) ? null : new Date(ts),
      durationMin: 90, done: false, live: false, next: true, resultsTab: ''
    };
  }
  var lista = rounds();
  for (var i = 0; i < lista.length; i++) { if (lista[i].next) return lista[i]; }
  return lista[0] || null;
}

/* ------------------------------------------------------------------
   PLIK .ICS
   Generowany w przeglądarce — żaden serwer nie jest do tego potrzebny.
------------------------------------------------------------------ */
function pad2 (n) { return (n < 10 ? '0' : '') + n; }

function icsStamp (d) {
  return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + 'T' +
         pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + '00Z';
}

function icsEscape (v) {
  return String(v || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

/* Runda po wskazanej — potrzebna, gdy jakieś wydarzenie właśnie trwa
   i chcemy obok pokazać, za ile startuje kolejne. */
function nastepnaPo (r) {
  var lista = rounds(), out = null;
  var od = r && r.start ? r.start.getTime() : 0;

  lista.forEach(function (x) {
    if (!x.start || x.done || x.live) return;
    if (x.start.getTime() <= od) return;
    if (!out || x.start < out.start) out = x;
  });
  return out;
}

/* Zakres dat: „17–24 września" albo pojedynczy termin z godziną. */
function dateRange (start, end) {
  if (!start) return '';
  if (!end || end - start < 20 * 3600 * 1000) return dateText(start);

  var loc = lang === 'en' ? 'en-GB' : 'pl-PL';
  var tenSamMiesiac = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  var a = start.toLocaleDateString(loc, tenSamMiesiac ? { day: 'numeric' } : { day: 'numeric', month: 'long' });
  var b = end.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
  return a + '–' + b;
}

function icsUrl (co) {
  var lista = Object.prototype.toString.call(co) === '[object Array]' ? co : [co];
  var wydarzenia = lista.filter(function (r) { return r && r.start; });
  if (!wydarzenia.length) return '';

  var linie = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'CALSCALE:GREGORIAN',
               'PRODID:-//Project Simracing//projectsimracing.pl//PL'];

  wydarzenia.forEach(function (r) {
    var koniec = r.end || new Date(r.start.getTime() + (r.durationMin || 90) * 60000);
    var tytul = 'Project Simracing' + (r.n ? ' — Runda ' + pad2(r.n) : ' —') + ' ' + r.name;
    linie.push(
      'BEGIN:VEVENT',
      'UID:' + icsStamp(r.start) + '-' + (r.n || 0) + '@projectsimracing.pl',
      'DTSTAMP:' + icsStamp(new Date()),
      'DTSTART:' + icsStamp(r.start),
      'DTEND:'   + icsStamp(koniec),
      'SUMMARY:' + icsEscape(tytul),
      'DESCRIPTION:' + icsEscape(r.seriesLabel || ''),
      'URL:https://projectsimracing.pl/kalendarz.html',
      'END:VEVENT'
    );
  });

  linie.push('END:VCALENDAR');
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(linie.join('\r\n'));
}

/* Data w formie czytelnej dla człowieka, w języku strony. */
function dateText (d, opcje) {
  if (!d) return '';
  return d.toLocaleString(lang === 'en' ? 'en-GB' : 'pl-PL', opcje || {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

/* Brakujący plik nie może pokazać ikonki „zepsuty obraz”. */
function guardImages (root) {
  $$('.pod__img', root).forEach(function (im) {
    im.addEventListener('error', function () { im.classList.add('is-fail'); });
  });
}

/* ------------------------------------------------------------------
   START
------------------------------------------------------------------ */
function boot () {
  var saved = 'pl';
  try { saved = localStorage.getItem('ps-lang') || 'pl'; } catch (e) {}
  applyLang(saved);

  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var topbar = $('#topbar');
  if (topbar) {
    window.addEventListener('scroll', function () {
      topbar.classList.toggle('is-stuck', window.scrollY > 10);
    }, { passive: true });
  }
}

window.PS = {
  $: $, $$: $$, esc: esc, txt: txt, t: t,
  addStrings: addStrings, onLang: onLang, applyLang: applyLang, applyTheme: applyTheme,
  normalize: normalize, seedFrom: seedFrom,
  photoFile: photoFile, photoImg: photoImg,
  rounds: rounds, nextRound: nextRound, nastepnaPo: nastepnaPo,
  icsUrl: icsUrl, dateText: dateText, dateRange: dateRange,
  guardImages: guardImages, renderNav: renderNav, boot: boot, cfg: CFG,
  get lang () { return lang; }
};

})();
