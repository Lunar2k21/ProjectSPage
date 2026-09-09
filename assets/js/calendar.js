/* =====================================================================
   Project Simracing — kalendarz sezonu
   ---------------------------------------------------------------------
   Terminy, odliczanie i pliki .ics liczy core.js — ta strona tylko je
   pokazuje. Jedynym źródłem dat jest tablica `calendar` w config.js,
   ta sama, z której korzysta pasek na stronie głównej.
   ===================================================================== */
(function () {
'use strict';

var PS  = window.PS;
var CFG = PS.cfg;
var $   = PS.$;
var $$  = PS.$$;
var esc = PS.esc;
var t   = PS.t;

PS.addStrings({
  pl: {
    'cal.title': 'Kalendarz sezonu',
    'cal.sub': 'Wszystkie rundy z terminami. Godziny podane w Twojej strefie czasowej — przycisk przy każdej rundzie dodaje ją do kalendarza w telefonie lub w Google.',
    'cal.next': 'Najbliższa runda',
    'cal.in': 'Start za',
    'cal.livenow': 'Trwa teraz',
    'cal.done': 'Rozegrana',
    'cal.planned': 'Zaplanowana',
    'cal.nodate': 'Termin wkrótce',
    'cal.round': 'Runda',
    'cal.add': 'Dodaj do kalendarza',
    'cal.addAll': 'Dodaj cały sezon do kalendarza',
    'cal.results': 'Wyniki rundy',
    'cal.empty': 'Kalendarz jest jeszcze pusty — terminy pojawią się tu, gdy zostaną ustalone.',
    'cal.noteSome': 'Rundy bez godziny czekają na potwierdzenie terminu.',
    'cal.noteNone': 'Żadna runda nie ma jeszcze terminu. Po wpisaniu dat do pliku config.js odliczanie ruszy samo.',
    'cal.tz': 'Strefa czasowa',
    'cal.all': 'Wszystkie',
    'cal.left': 'Do końca',
    'cal.after': 'Następna runda',
    'd': 'dni', 'd1': 'dzień',
  },
  en: {
    'cal.title': 'Season calendar',
    'cal.sub': 'Every round with its date. Times are shown in your own time zone — the button next to each round adds it to your phone or Google calendar.',
    'cal.next': 'Next round',
    'cal.in': 'Starts in',
    'cal.livenow': 'Running now',
    'cal.done': 'Finished',
    'cal.planned': 'Scheduled',
    'cal.nodate': 'Date to be announced',
    'cal.round': 'Round',
    'cal.add': 'Add to calendar',
    'cal.addAll': 'Add the whole season',
    'cal.results': 'Round results',
    'cal.empty': 'The calendar is still empty — dates will appear here once they are set.',
    'cal.noteSome': 'Rounds without a time are still awaiting confirmation.',
    'cal.noteNone': 'No round has a date yet. Once dates are filled in config.js the countdown starts by itself.',
    'cal.tz': 'Time zone',
    'cal.all': 'All',
    'cal.left': 'Ends in',
    'cal.after': 'Next round',
    'd': 'days', 'd1': 'day'
  }
});

var state = { series: 'all' };
var tickTimer = null;

function pad (n) { return (n < 10 ? '0' : '') + n; }

/* ------------------------------------------------------------------
   WYBÓR MISTRZOSTW — pokazujemy tylko wtedy, gdy jest z czego wybierać
------------------------------------------------------------------ */
function renderSeries (lista) {
  var box = $('#series');
  if (!box) return;

  var seen = [];
  lista.forEach(function (r) { if (r.series && seen.indexOf(r.series) === -1) seen.push(r.series); });

  if (seen.length < 2) { box.hidden = true; state.series = 'all'; return; }
  box.hidden = false;

  var etyk = CFG.seriesLabel || {};
  box.innerHTML = ['all'].concat(seen).map(function (id) {
    var label = id === 'all' ? t('cal.all') : (PS.txt(etyk[id]) || id).split(' · ')[0];
    return '<button type="button" class="champ' + (state.series === id ? ' is-on' : '') + '"' +
           ' data-series="' + esc(id) + '" role="tab" aria-selected="' + (state.series === id) + '">' +
           esc(label) + '</button>';
  }).join('');

  $$('[data-series]', box).forEach(function (b) {
    b.addEventListener('click', function () {
      state.series = b.getAttribute('data-series');
      render();
    });
  });
}

/* ------------------------------------------------------------------
   KARTA NAJBLIŻSZEJ RUNDY
------------------------------------------------------------------ */
function renderNext (lista) {
  var box = $('#nextCard');
  if (!box) return;

  var r = null;
  for (var i = 0; i < lista.length; i++) { if (lista[i].next) { r = lista[i]; break; } }
  if (!r) { box.hidden = true; return; }
  box.hidden = false;

  var ics = r.start
    ? '<a class="btn btn--ghost btn--sm" href="' + PS.icsUrl(r) + '" download="project-simracing.ics">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M3.5 9h17M4.5 5.5h15v15h-15z"/></svg>' +
      '<span class="btn__t">' + esc(t('cal.add')) + '</span></a>'
    : '';

  box.innerHTML =
    '<p class="mono nextcard__kick">' + esc(r.live ? t('cal.livenow') : t('cal.next')) +
      (r.seriesLabel ? ' · ' + esc(r.seriesLabel) : '') + '</p>' +
    '<h2 class="nextcard__name">' +
      (r.n ? esc(t('cal.round')) + ' ' + pad(r.n) + ' · ' : '') + esc(r.name) + '</h2>' +
    '<div class="nextcard__grid">' +
      '<div><span class="mono dim" id="ncLabel"></span>' +
        '<p class="nextcard__clock" id="ncClock">—</p></div>' +
      '<div><span class="mono dim">' + esc(PS.dateRange(r.start, r.end) || t('cal.nodate')) + '</span></div>' +
      '<div class="nextcard__act">' + ics + '</div>' +
    '</div>' +
    potemHtml(r);

  tick(r);
}

/* Gdy runda trwa, pod kartą dopisujemy, kiedy startuje kolejna. */
function potemHtml (r) {
  if (!r || !r.live) return '';
  var p = PS.nastepnaPo(r);
  if (!p) return '';
  var dni = p.start ? Math.max(0, Math.ceil((p.start.getTime() - Date.now()) / 86400000)) : 0;
  return '<p class="mono dim nextcard__potem">' + esc(t('cal.after')) + ': ' + esc(p.name) +
         (p.start ? ' · ' + esc(t('cal.in').toLowerCase()) + ' ' + dni + ' ' + esc(t(dni === 1 ? 'd1' : 'd')) : '') +
         '</p>';
}

function tick (r) {
  var clockEl = $('#ncClock'), labelEl = $('#ncLabel');
  if (!clockEl) return;

  if (!r || !r.start) {
    labelEl.textContent = '';
    clockEl.textContent = t('cal.nodate');
    clockEl.classList.add('is-soft');
    return;
  }

  var teraz = Date.now();
  var diff = r.start.getTime() - teraz;
  var doKonca = false;

  if (diff <= 0 && r.end && r.end.getTime() > teraz) {
    diff = r.end.getTime() - teraz;
    doKonca = true;
  } else if (diff <= 0) {
    labelEl.textContent = '';
    clockEl.textContent = t('cal.livenow');
    clockEl.classList.add('is-soft');
    return;
  }

  var s = Math.floor(diff / 1000);
  var d = Math.floor(s / 86400); s -= d * 86400;
  var h = Math.floor(s / 3600);  s -= h * 3600;
  var m = Math.floor(s / 60);    s -= m * 60;

  labelEl.textContent = doKonca ? t('cal.left') : t('cal.in');
  clockEl.classList.remove('is-soft');
  clockEl.textContent = (d > 0 ? d + ' ' + t(d === 1 ? 'd1' : 'd') + ' · ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
}

/* ------------------------------------------------------------------
   LISTA RUND
------------------------------------------------------------------ */
function status (r) {
  if (r.live) return { cls: 'is-live', label: t('cal.livenow') };
  if (r.done) return { cls: 'is-done', label: t('cal.done') };
  if (r.next) return { cls: 'is-next', label: t('cal.next') };
  if (!r.start) return { cls: 'is-soon', label: t('cal.nodate') };
  return { cls: '', label: t('cal.planned') };
}

function renderList (lista) {
  var box = $('#rlist');
  if (!box) return;

  if (!lista.length) {
    box.innerHTML = '<li class="empty">' + esc(t('cal.empty')) + '</li>';
    return;
  }

  box.innerHTML = lista.map(function (r) {
    var st = status(r);

    /* Bez daty wystarczy sama plakietka — powtarzanie „termin wkrótce"
       dwa razy w jednym wierszu tylko zaśmieca. */
    var kiedy = r.start ? '<b>' + esc(PS.dateRange(r.start, r.end)) + '</b>' : '<b class="dim">—</b>';

    var akcje = '';
    if (r.start && !r.done) {
      akcje += '<a class="btn btn--ghost btn--sm" href="' + PS.icsUrl(r) + '" download="project-simracing.ics">' +
               '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M3.5 9h17M4.5 5.5h15v15h-15z"/></svg>' +
               '<span class="btn__t">' + esc(t('cal.add')) + '</span></a>';
    }
    if (r.done) {
      var cel = 'wyniki.html?champ=' + encodeURIComponent(r.series || '') +
                (r.resultsTab ? '&tab=' + encodeURIComponent(r.resultsTab) : '');
      akcje += '<a class="rlist__res" href="' + esc(cel) + '">' + esc(t('cal.results')) + ' →</a>';
    }

    return '<li class="rnd ' + st.cls + '">' +
             '<span class="rnd__n">' + pad(r.n) + '</span>' +
             '<div class="rnd__body">' +
               '<h2 class="rnd__name">' + esc(r.name) + '</h2>' +
               (r.seriesLabel ? '<p class="mono dim">' + esc(r.seriesLabel) + '</p>' : '') +
             '</div>' +
             '<div class="rnd__when">' + kiedy +
               '<span class="mono rnd__badge">' + esc(st.label) + '</span></div>' +
             '<div class="rnd__act">' + akcje + '</div>' +
           '</li>';
  }).join('');
}

/* ------------------------------------------------------------------
   STOPKA KALENDARZA
------------------------------------------------------------------ */
function renderFoot (lista) {
  var btn = $('#icsAll');
  var note = $('#calNote');

  var zDatami = lista.filter(function (r) { return r.start && !r.done; });

  if (btn) {
    btn.hidden = zDatami.length < 2;
    if (!btn.hidden) {
      btn.href = PS.icsUrl(zDatami);
      btn.download = 'project-simracing-sezon.ics';
      $('.btn__t', btn).textContent = t('cal.addAll');
    }
  }

  if (note) {
    var bezDaty = lista.filter(function (r) { return !r.start; }).length;
    var strefa = '';
    try { strefa = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}

    var czesci = [];
    if (bezDaty === lista.length) czesci.push(t('cal.noteNone'));
    else if (bezDaty) czesci.push(t('cal.noteSome'));
    if (strefa) czesci.push(t('cal.tz') + ': ' + strefa);
    note.textContent = czesci.join(' · ');
  }
}

/* ------------------------------------------------------------------
   SKŁADANIE
------------------------------------------------------------------ */
function render () {
  var wszystkie = PS.rounds();
  var lista = state.series === 'all'
    ? wszystkie
    : wszystkie.filter(function (r) { return r.series === state.series; });

  renderSeries(wszystkie);
  renderNext(lista);
  renderList(lista);
  renderFoot(lista);

  clearInterval(tickTimer);
  var nast = null;
  for (var i = 0; i < lista.length; i++) { if (lista[i].next) { nast = lista[i]; break; } }
  if (nast) tickTimer = setInterval(function () { tick(nast); }, 1000);
}

PS.onLang(render);
PS.boot();

})();
