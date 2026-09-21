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
function renderSeries (serie) {
  var box = $('#series');
  if (!box) return;

  var id = serie.map(function (s) { return s.seria; }).filter(Boolean);
  if (id.length < 2) { box.hidden = true; state.series = 'all'; return; }
  box.hidden = false;

  box.innerHTML = [{ seria: 'all' }].concat(serie).map(function (s) {
    var wszystkie = s.seria === 'all';
    var label = wszystkie ? t('cal.all') : (s.etykieta || s.seria).split(' · ')[0];
    return '<button type="button" class="champ' + (state.series === s.seria ? ' is-on' : '') + '"' +
           (wszystkie ? '' : ' style="--kolor:' + PS.kolorSerii(s.seria) + '"') +
           ' data-series="' + esc(s.seria) + '" role="tab" aria-selected="' + (state.series === s.seria) + '">' +
           (wszystkie ? '' : '<i class="champ__kropka" aria-hidden="true"></i>') +
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
   KARTY BIEŻĄCYCH RUND — po jednej na serię
   Dwie serie potrafią się nakładać (runda WRC trwa dwa tygodnie, a w
   tym czasie startuje LMU), więc każda dostaje własną kartę z własnym
   odliczaniem, zamiast walczyć o jedno miejsce.
------------------------------------------------------------------ */
var karty = [];

function ikonaIcs () {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M3.5 9h17M4.5 5.5h15v15h-15z"/></svg>';
}

function renderNext (serie) {
  var box = $('#nextCard');
  if (!box) return;

  karty = serie.filter(function (s) { return s.glowna; });
  if (!karty.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.classList.toggle('is-para', karty.length > 1);

  box.innerHTML = karty.map(function (s, i) {
    var r = s.glowna;
    var ics = r.start
      ? '<a class="btn btn--ghost btn--sm" href="' + PS.icsUrl(r) + '" download="project-simracing.ics">' +
        ikonaIcs() + '<span class="btn__t">' + esc(t('cal.add')) + '</span></a>'
      : '';

    var potem = '';
    if (r.live && s.potem) {
      potem = '<p class="mono dim nextcard__potem">' + esc(t('cal.after')) + ': ' + esc(s.potem.name) +
              (s.potem.start ? ' · <span data-za="' + i + '"></span>' : '') + '</p>';
    }

    return '<article class="nextcard' + (r.live ? ' is-live' : '') + '" style="--kolor:' + PS.kolorSerii(s.seria) + '">' +
             '<p class="mono nextcard__kick"><span class="nextcard__stan">' +
               esc(r.live ? t('cal.livenow') : t('cal.next')) + '</span>' +
               (s.etykieta ? '<span class="nextcard__seria">' + esc(s.etykieta) + '</span>' : '') + '</p>' +
             '<h2 class="nextcard__name">' +
               (r.n ? esc(t('cal.round')) + ' ' + pad(r.n) + ' · ' : '') + esc(r.name) + '</h2>' +
             '<div class="nextcard__grid">' +
               '<div><span class="mono dim" data-etyk="' + i + '"></span>' +
                 '<p class="nextcard__clock" data-zegar="' + i + '">—</p></div>' +
               '<div><span class="mono dim">' + esc(PS.dateRange(r.start, r.end) || t('cal.nodate')) + '</span></div>' +
               '<div class="nextcard__act">' + ics + '</div>' +
             '</div>' +
             potem +
           '</article>';
  }).join('');

  tick();
}

function tick () {
  var teraz = Date.now();
  karty.forEach(function (s, i) {
    var r = s.glowna;
    var zegar = $('[data-zegar="' + i + '"]');
    var etyk = $('[data-etyk="' + i + '"]');
    if (!zegar) return;

    if (!r.start) {
      etyk.textContent = '';
      zegar.textContent = t('cal.nodate');
      zegar.classList.add('is-soft');
    } else if (r.live && r.end) {
      etyk.textContent = t('cal.left');
      zegar.textContent = PS.odliczanie(r.end.getTime() - teraz);
      zegar.classList.remove('is-soft');
    } else if (r.start.getTime() <= teraz) {
      etyk.textContent = '';
      zegar.textContent = t('cal.livenow');
      zegar.classList.add('is-soft');
    } else {
      etyk.textContent = t('cal.in');
      zegar.textContent = PS.odliczanie(r.start.getTime() - teraz);
      zegar.classList.remove('is-soft');
    }

    var za = $('[data-za="' + i + '"]');
    if (za && s.potem && s.potem.start) {
      var dni = Math.max(0, Math.ceil((s.potem.start.getTime() - teraz) / 86400000));
      za.textContent = t('cal.in').toLowerCase() + ' ' + dni + ' ' + t(dni === 1 ? 'd1' : 'd');
    }

    if ((r.live && r.end && r.end.getTime() <= teraz) ||
        (!r.live && r.start && r.start.getTime() <= teraz && r.end && r.end.getTime() > teraz)) {
      render();
    }
  });
}

/* ------------------------------------------------------------------
   LISTA RUND — pogrupowana seriami
------------------------------------------------------------------ */
function status (r, s) {
  if (r.live) return { cls: 'is-live', label: t('cal.livenow') };
  if (r.done) return { cls: 'is-done', label: t('cal.done') };
  if (s && s.glowna === r) return { cls: 'is-next', label: t('cal.next') };
  if (!r.start) return { cls: 'is-soon', label: t('cal.nodate') };
  return { cls: '', label: t('cal.planned') };
}

function wiersz (r, s) {
  var st = status(r, s);

  /* Bez daty wystarczy sama plakietka — powtarzanie „termin wkrótce"
     dwa razy w jednym wierszu tylko zaśmieca. */
  var kiedy = r.start ? '<b>' + esc(PS.dateRange(r.start, r.end)) + '</b>' : '<b class="dim">—</b>';

  var akcje = '';
  if (r.start && !r.done) {
    akcje += '<a class="btn btn--ghost btn--sm" href="' + PS.icsUrl(r) + '" download="project-simracing.ics">' +
             ikonaIcs() + '<span class="btn__t">' + esc(t('cal.add')) + '</span></a>';
  }
  if (r.done) {
    var cel = 'wyniki.html?champ=' + encodeURIComponent(r.series || '') +
              (r.resultsTab ? '&tab=' + encodeURIComponent(r.resultsTab) : '');
    akcje += '<a class="rlist__res" href="' + esc(cel) + '">' + esc(t('cal.results')) + ' →</a>';
  }

  return '<li class="rnd ' + st.cls + '">' +
           '<span class="rnd__n">' + pad(r.n) + '</span>' +
           '<div class="rnd__body"><h3 class="rnd__name">' + esc(r.name) + '</h3></div>' +
           '<div class="rnd__when">' + kiedy +
             '<span class="mono rnd__badge">' + esc(st.label) + '</span></div>' +
           '<div class="rnd__act">' + akcje + '</div>' +
         '</li>';
}

/* 1 runda, 2–4 rundy, 5 rund, 22 rundy… */
function ileRund (n) {
  if (PS.lang === 'en') return n === 1 ? 'round' : 'rounds';
  if (n === 1) return 'runda';
  var j = n % 10, d = n % 100;
  return (j >= 2 && j <= 4 && (d < 10 || d >= 20)) ? 'rundy' : 'rund';
}

function renderList (serie) {
  var box = $('#rlist');
  if (!box) return;

  if (!serie.length) {
    box.innerHTML = '<p class="empty">' + esc(t('cal.empty')) + '</p>';
    return;
  }

  box.innerHTML = serie.map(function (s) {
    var zakres = s.od ? PS.dateRange(s.od, s.do) : '';
    var ile = s.rundy.length;
    return '<section class="rgrupa" style="--kolor:' + PS.kolorSerii(s.seria) + '">' +
             '<header class="rgrupa__head">' +
               '<h2 class="rgrupa__tytul">' + esc(s.etykieta || t('cal.title')) + '</h2>' +
               '<p class="mono dim rgrupa__info">' + ile + ' ' + esc(ileRund(ile)) +
                 (zakres ? ' · ' + esc(zakres) : '') + '</p>' +
             '</header>' +
             '<ol class="rlist">' + s.rundy.map(function (r) { return wiersz(r, s); }).join('') + '</ol>' +
           '</section>';
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
  var wszystkie = PS.stanSerii();
  var widoczne = state.series === 'all'
    ? wszystkie
    : wszystkie.filter(function (s) { return s.seria === state.series; });

  var rundy = [];
  widoczne.forEach(function (s) { rundy = rundy.concat(s.rundy); });

  renderSeries(wszystkie);
  renderNext(widoczne);
  renderList(widoczne);
  renderFoot(rundy);

  clearInterval(tickTimer);
  if (karty.length) tickTimer = setInterval(tick, 1000);
}

PS.onLang(render);
PS.boot();

})();
