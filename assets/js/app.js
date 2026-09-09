/* =====================================================================
   Project Simracing — logika strony głównej
   Bez bibliotek zewnętrznych. Wszystkie treści bierze z config.js.
   ===================================================================== */
(function () {
'use strict';

var PS   = window.PS;
var CFG  = PS.cfg;
var $    = PS.$;
var $$   = PS.$$;
var esc  = PS.esc;
var txt  = PS.txt;
var t    = PS.t;
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Teksty tylko dla strony głównej — reszta siedzi w core.js. */
PS.addStrings({
  pl: {
    'hero.brandline': 'Project Simracing — polska liga simracingowa',
    'hero.scroll': 'Runda, odnośniki i wyniki',
    'next.kicker': 'Najbliższa runda', 'next.in': 'Start za',
    'next.soon': 'Termin wkrótce', 'next.live': 'Trwa teraz',
    'next.left': 'Do końca', 'next.after': 'Następna runda', 'next.afterIn': 'za',
    'next.ics': 'Dodaj do kalendarza',
    'hub.title': 'Gdzie toczy się liga',
    'hub.sub': 'Wszystkie odnośniki w jednym miejscu',
    'pod.title': 'Podium ostatniej rundy',
    'pod.live': 'Na żywo z arkusza',
    'pod.more': 'Pełne wyniki →',
    'pod.demo': 'Dane demonstracyjne — podpięcie arkusza Google w kolejnym kroku.',
    'pod.waiting': 'Wyniki pojawią się tu po pierwszej rundzie',
    'pod.error': 'Nie udało się pobrać wyników z arkusza — zajrzyj na podstronę wyników.',
    'art.title': 'Najnowszy artykuł', 'art.more': 'Wszystkie artykuły →',
    'art.read': 'Czytaj',
    'media.title': 'Najnowsze materiały', 'media.more': 'Kanał YouTube →',
    'media.play': 'Odtwórz najnowsze filmy',
    'media.expand': 'Powiększ odtwarzacz', 'media.close': 'Zamknij odtwarzacz',
    'slides.pause': 'Wstrzymaj automatyczną zmianę',
    'slides.play': 'Wznów automatyczną zmianę',
    'slides.goto': 'Pokaż',
    'd': 'dni', 'd1': 'dzień',
  },
  en: {
    'hero.brandline': 'Project Simracing — Polish sim racing league',
    'hero.scroll': 'Round, links and results',
    'next.kicker': 'Next round', 'next.in': 'Starts in',
    'next.soon': 'Date to be announced', 'next.live': 'Running now',
    'next.left': 'Ends in', 'next.after': 'Next round', 'next.afterIn': 'in',
    'next.ics': 'Add to calendar',
    'hub.title': 'Where the league lives',
    'hub.sub': 'Every link in one place',
    'pod.title': 'Last round podium',
    'pod.live': 'Live from the sheet',
    'pod.more': 'Full results →',
    'pod.demo': 'Sample data — the Google Sheet connection comes next.',
    'pod.waiting': 'Results will show up here after the first round',
    'pod.error': 'Could not load results from the spreadsheet — try the results page.',
    'art.title': 'Latest article', 'art.more': 'All articles →',
    'art.read': 'Read',
    'media.title': 'Latest media', 'media.more': 'YouTube channel →',
    'media.play': 'Play the latest videos',
    'media.expand': 'Expand player', 'media.close': 'Close player',
    'slides.pause': 'Pause automatic rotation',
    'slides.play': 'Resume automatic rotation',
    'slides.goto': 'Show',
    'd': 'days', 'd1': 'day'
  }
});

/* ------------------------------------------------------------------
   HERO — SLAJDY SEZONOWE
------------------------------------------------------------------ */
var slidesBox = $('.hero__slides');
var mediaBox  = $('.hero__media');
var dotsBox   = $('.dots');
var heroEl    = $('.hero');
var slides    = CFG.slides || [];
var current   = 0;
var timer     = null;
var paused    = reduceMotion;

/* Zdjęcia tła. Pierwsze jest już w HTML (wczytuje się najwcześniej),
   resztę dokładamy tutaj, żeby liczba slajdów zależała od konfiguracji. */
function buildMedia () {
  if (!mediaBox) return;
  $$('.hero__frame', mediaBox).forEach(function (fr, i) { if (i > 0) fr.remove(); });

  slides.forEach(function (s, i) {
    if (i === 0) return;
    var frame = document.createElement('div');
    frame.className = 'hero__frame';

    var im = document.createElement('img');
    im.className = 'hero__img';
    im.alt = '';
    im.loading = 'lazy';
    im.decoding = 'async';

    /* Tło kolejnych slajdów wisi w atrybutach i wczytuje się dopiero,
       gdy slajd ma się pokazać. Inaczej pierwsze wejście na stronę
       ściąga wszystkie zdjęcia naraz, choć widać tylko jedno. */
    if (s.type === 'video' && s.video) {
      im.setAttribute('data-src', 'https://i.ytimg.com/vi/' + s.video + '/maxresdefault.jpg');
      im.setAttribute('data-zapas', 'https://i.ytimg.com/vi/' + s.video + '/hqdefault.jpg');
    } else {
      im.setAttribute('data-src', 'assets/img/hero/' + s.image + '-1920.webp');
      im.setAttribute('data-srcset',
        'assets/img/hero/' + s.image + '-1280.webp 1280w, ' +
        'assets/img/hero/' + s.image + '-1920.webp 1920w, ' +
        'assets/img/hero/' + s.image + '-2560.webp 2560w');
      im.sizes = '100vw';
    }
    frame.appendChild(im);
    mediaBox.appendChild(frame);
  });
}

function renderSlides () {
  if (!slidesBox || !slides.length) return;

  slidesBox.innerHTML = slides.map(function (s, i) {
    var acts = (s.actions || []).map(function (a) {
      var ext = a.external ? ' target="_blank" rel="noopener"' : '';
      var cls = a.primary ? 'btn btn--primary' : 'btn btn--ghost';
      return '<a class="' + cls + '" href="' + esc(a.href) + '"' + ext +
             '><span class="btn__t">' + esc(txt(a.label)) + '</span></a>';
    }).join('');

    var kick = esc(txt(s.kicker));
    if (s.type === 'video') {
      kick = '<span class="slide__yt" aria-hidden="true">' +
             '<svg viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z"/></svg></span>' + kick;
    }

    return '<article class="slide' + (i === current ? ' is-on' : '') + '" data-slide="' + i + '">' +
             '<p class="slide__kick mono">' + kick + '</p>' +
             '<h2 class="slide__title">' + txt(s.title) + '</h2>' +
             '<p class="slide__desc">' + esc(txt(s.desc)) + '</p>' +
             '<p class="slide__cta">' + acts + '</p>' +
           '</article>';
  }).join('');

  if (dotsBox) {
    dotsBox.style.setProperty('--slide-dur', (CFG.slideInterval || 8000) + 'ms');
    dotsBox.innerHTML = slides.map(function (s, i) {
      return '<button type="button" class="dot' + (i === current ? ' is-on' : '') + '"' +
             ' role="tab" aria-selected="' + (i === current) + '"' +
             ' aria-label="' + esc(t('slides.goto') + ' ' + txt(s.kicker)) + '"' +
             ' data-goto="' + i + '"><span><i></i></span></button>';
    }).join('');
    $$('[data-goto]', dotsBox).forEach(function (d) {
      d.addEventListener('click', function () {
        go(parseInt(d.getAttribute('data-goto'), 10));
      });
    });
  }
  syncState();
  armZoom();
  armProgress();
}

/* Wczytuje tło slajdu, jeżeli jeszcze go nie ma. */
function dociagnij (n) {
  var ramki = $$('.hero__frame', mediaBox);
  var fr = ramki[n];
  if (!fr) return;
  var im = fr.querySelector('img');
  if (!im || im.getAttribute('src')) return;

  var zrodlo = im.getAttribute('data-src');
  if (!zrodlo) return;
  var zapas = im.getAttribute('data-zapas');
  if (zapas) {
    im.addEventListener('error', function raz () {
      im.removeEventListener('error', raz);
      im.src = zapas;
    });
  }
  if (im.getAttribute('data-srcset')) im.srcset = im.getAttribute('data-srcset');
  im.src = zrodlo;
}

/* Widoczność ustawiamy tak, żeby ukryte slajdy nie łapały fokusu. */
function syncState () {
  dociagnij(current);
  dociagnij((current + 1) % Math.max(1, slides.length));   // następny w tle

  $$('.slide', slidesBox).forEach(function (el, n) {
    var on = n === current;
    el.classList.toggle('is-on', on);
    if (on) { el.removeAttribute('aria-hidden'); } else { el.setAttribute('aria-hidden', 'true'); }
    $$('a', el).forEach(function (a) { a.tabIndex = on ? 0 : -1; });
  });
  $$('.hero__frame', mediaBox).forEach(function (fr, n) { fr.classList.toggle('is-on', n === current); });
  $$('.dot', dotsBox).forEach(function (d, n) {
    d.classList.toggle('is-on', n === current);
    d.setAttribute('aria-selected', n === current ? 'true' : 'false');
  });
}

/* Pasek postępu JEST licznikiem czasu — jedna animacja steruje i
   wypełnieniem kropki, i momentem zmiany slajdu. Dzięki temu pauza
   zatrzymuje jedno i drugie w tym samym punkcie, a zdjęcie kursora
   wznawia odliczanie od miejsca, w którym stanęło. */
var progress = null;        // Animation z Web Animations API
var fallbackTimer = null;   // awaryjny licznik dla przeglądarek bez WAAPI
var held = false;           // kursor albo fokus na nagłówku

function clearProgress () {
  if (progress) { progress.onfinish = null; progress.cancel(); progress = null; }
  clearTimeout(fallbackTimer);
  fallbackTimer = null;
}

/* Najazd zdjęcia. Trwa dokładnie tyle, co jeden slajd, więc kończy się
   równo z przejściem — nie ma skoku na końcu. Zdjęcie schodzące dokręca
   swoją animację w tle przez czas przenikania, zamiast wracać do zera. */
function armZoom () {
  var fr = $('.hero__frame.is-on', mediaBox);
  if (!fr || typeof fr.animate !== 'function') return;

  if (fr._zoom) { fr._zoom.cancel(); fr._zoom = null; }

  var to  = CFG.slideZoom || 1;
  var pan = CFG.slidePan  || 0;
  var dur = CFG.slideInterval || 0;
  if (!dur || reduceMotion || (to <= 1 && !pan)) return;

  var from = 'scale(1) translate3d(' + pan + '%, ' + (pan * 0.6) + '%, 0)';
  var till = 'scale(' + to + ') translate3d(' + (-pan) + '%, ' + (-pan * 0.6) + '%, 0)';

  fr._zoom = fr.animate([{ transform: from }, { transform: till }],
    { duration: dur + 1500, easing: 'linear', fill: 'forwards' });   // +1,5 s = czas przenikania
  if (paused || held) fr._zoom.pause();
}

function eachZoom (fn) {
  $$('.hero__frame', mediaBox).forEach(function (fr) { if (fr._zoom) fn(fr._zoom); });
}

function armProgress () {
  clearProgress();
  var bar = $('.dot.is-on i', dotsBox);
  if (!bar) return;

  var dur = CFG.slideInterval || 0;
  if (!dur || slides.length < 2) { bar.style.width = '100%'; return; }

  if (typeof bar.animate !== 'function') {
    bar.style.width = '100%';
    if (!paused && !held) fallbackTimer = setTimeout(function () { go(current + 1); }, dur);
    return;
  }

  bar.style.width = '';
  progress = bar.animate([{ width: '0%' }, { width: '100%' }],
                         { duration: dur, easing: 'linear', fill: 'forwards' });
  progress.onfinish = function () { go(current + 1); };
  if (paused || held) progress.pause();
}

function go (i) {
  if (!slides.length) return;
  current = (i + slides.length) % slides.length;
  syncState();
  armZoom();
  armProgress();
}

var ppBtn = $('#playpause');

function setPaused (v) {
  paused = v;
  if (heroEl) heroEl.classList.toggle('is-paused', v);
  if (ppBtn) {
    ppBtn.classList.toggle('is-paused', v);
    ppBtn.setAttribute('aria-label', t(v ? 'slides.play' : 'slides.pause'));
  }
  /* Kliknięcie „wznów” jest wyraźną decyzją użytkownika, więc znosi też
     wstrzymanie wynikające z tego, że kursor stoi na nagłówku. */
  if (!v && held) { held = false; if (heroEl) heroEl.classList.remove('is-hold'); }

  eachZoom(function (a) { if (v) { a.pause(); } else { a.play(); } });

  if (progress) {
    if (v) { progress.pause(); } else { progress.play(); }
  } else if (!v) {
    armProgress();
  }
  if (v) { clearTimeout(fallbackTimer); fallbackTimer = null; }
}
if (ppBtn) { ppBtn.addEventListener('click', function () { setPaused(!paused); }); }

/* Wstrzymanie na czas najechania i fokusu — bez cofania paska. */
function hold () {
  held = true;
  if (heroEl) heroEl.classList.add('is-hold');
  eachZoom(function (a) { a.pause(); });
  if (progress) progress.pause();
  clearTimeout(fallbackTimer);
  fallbackTimer = null;
}

function unhold () {
  held = false;
  if (heroEl) heroEl.classList.remove('is-hold');
  if (paused) return;
  eachZoom(function (a) { a.play(); });
  if (progress) { progress.play(); } else { armProgress(); }
}

if (heroEl) {
  heroEl.addEventListener('mouseenter', hold);
  heroEl.addEventListener('mouseleave', unhold);
  heroEl.addEventListener('focusin',  hold);
  heroEl.addEventListener('focusout', unhold);
}
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { hold(); } else { unhold(); }
});

/* ------------------------------------------------------------------
   NAJBLIŻSZA RUNDA + ODLICZANIE
   Terminy i plik .ics liczy core.js — tu tylko je pokazujemy.
------------------------------------------------------------------ */
var active = null;

function pad (n) { return (n < 10 ? '0' : '') + n; }

function renderNextRound () {
  active = PS.nextRound();
  var nameEl = $('#nrName'), kickEl = $('#nrKicker'), icsEl = $('#nrIcs');
  if (!nameEl) return;

  nameEl.textContent = active
    ? (active.n ? 'Runda ' + pad(active.n) + ' · ' : '') + active.name
    : '—';
  if (kickEl) {
    kickEl.textContent = active && active.live
      ? t('next.live') + (active.seriesLabel ? ' · ' + active.seriesLabel : '')
      : ((active && active.seriesLabel) || t('next.kicker'));
    kickEl.classList.toggle('is-live', !!(active && active.live));
  }

  /* Gdy runda trwa (np. cały tydzień), obok pokazujemy, kiedy startuje
     kolejna — inaczej pasek na cały ten czas przestaje cokolwiek mówić. */
  var potemEl = $('#nrPotem');
  if (potemEl) {
    var potem = active && active.live ? PS.nastepnaPo(active) : null;
    potemEl.hidden = !potem;
    if (potem) {
      var dni = potem.start ? Math.max(0, Math.ceil((potem.start.getTime() - Date.now()) / 86400000)) : 0;
      potemEl.textContent = t('next.after') + ': ' + potem.name +
        (potem.start ? ' · ' + t('next.afterIn') + ' ' + dni + ' ' + t(dni === 1 ? 'd1' : 'd') : '');
    }
  }

  if (icsEl) {
    var maDate = !!(active && active.start);
    icsEl.hidden = !maDate;
    if (maDate) {
      icsEl.href = PS.icsUrl(active);
      icsEl.download = 'project-simracing.ics';
      $('.btn__t', icsEl).textContent = t('next.ics');
    }
  }
  tickCountdown();
}

function tickCountdown () {
  var clockEl = $('#nrClock'), labelEl = $('#nrLabel'), dateEl = $('#nrDate');
  if (!clockEl) return;

  if (!active || !active.start) {
    labelEl.textContent = '';
    clockEl.textContent = t('next.soon');
    clockEl.classList.add('is-soft');
    dateEl.textContent = '';
    return;
  }

  var teraz = Date.now();
  var diff = active.start.getTime() - teraz;

  /* Wydarzenie w trakcie: odliczamy do jego końca, a nie do startu. */
  if (diff <= 0 && active.end && active.end.getTime() > teraz) {
    diff = active.end.getTime() - teraz;
    labelEl.textContent = t('next.left');
    clockEl.classList.remove('is-soft');
    var sc = Math.floor(diff / 1000);
    var dc = Math.floor(sc / 86400); sc -= dc * 86400;
    var hc = Math.floor(sc / 3600);  sc -= hc * 3600;
    var mc = Math.floor(sc / 60);    sc -= mc * 60;
    clockEl.textContent = (dc > 0 ? dc + ' ' + t(dc === 1 ? 'd1' : 'd') + ' · ' : '') +
                          pad(hc) + ':' + pad(mc) + ':' + pad(sc);
    dateEl.textContent = PS.dateRange(active.start, active.end);
    return;
  }

  if (diff <= 0) {
    labelEl.textContent = '';
    clockEl.textContent = t('next.live');
    clockEl.classList.add('is-soft');
  } else {
    var s = Math.floor(diff / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600);  s -= h * 3600;
    var m = Math.floor(s / 60);    s -= m * 60;
    labelEl.textContent = t('next.in');
    clockEl.classList.remove('is-soft');
    clockEl.textContent = (d > 0 ? d + ' ' + t(d === 1 ? 'd1' : 'd') + ' · ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  dateEl.textContent = PS.dateRange(active.start, active.end);
}

/* ------------------------------------------------------------------
   HUB ODNOŚNIKÓW
------------------------------------------------------------------ */
function renderHub () {
  var box = $('#hubCols');
  if (!box) return;

  box.innerHTML = (CFG.hub || []).map(function (col) {
    var rows = (col.links || []).map(function (l) {
      var label = esc(txt(l.label));
      var tag   = l.tag ? '<span class="pill">' + esc(txt(l.tag)) + '</span>' : '';
      if (l.soon || !l.href) {
        return '<span class="row row--off">' + label + '<span class="pill">' + esc(t('soon')) + '</span></span>';
      }
      return '<a class="row" href="' + esc(l.href) + '" target="_blank" rel="noopener">' +
             label + tag + '<span class="row__ar" aria-hidden="true">→</span></a>';
    }).join('');
    return '<div class="col"><h3 class="col__cat mono">' + esc(txt(col.title)) + '</h3>' + rows + '</div>';
  }).join('');
}

/* ------------------------------------------------------------------
   PODIUM
------------------------------------------------------------------ */
function renderPodium () {
  var box = $('#podium');
  if (!box) return;

  var rows   = podium.rows;
  var notice = $('#demoNotice');
  var live   = $('#liveTag');
  var runda  = $('#podRound');

  /* Zanim arkusz odpowie (albo gdy runda się nie odbyła) pokazujemy
     trzy puste kafelki — sekcja nie skacze po wczytaniu danych. */
  var empty = !rows.length;
  if (empty) rows = [{ pos: 1 }, { pos: 2 }, { pos: 3 }];

  if (runda) runda.textContent = podium.round || '';

  if (live) {
    var naZywo = podium.status === 'ok' && !podium.demo;
    live.hidden = !naZywo;
  }

  if (notice) {
    var msg = '';
    if (podium.status === 'error')      msg = t('pod.error');
    else if (podium.status === 'nosource' || podium.status === 'empty') msg = t('pod.waiting');
    else if (podium.demo)               msg = t('pod.demo');
    notice.hidden = !msg;
    notice.textContent = msg;
  }

  var order = [1, 0, 2];   // 2 – 1 – 3, jak na podium
  var html  = '';

  order.forEach(function (idx) {
    var r = rows[idx];
    if (!r) return;

    var seed  = (r.driver || 'x') + '|' + (podium.round || '') + '|' + r.pos;
    var media = PS.photoImg(PS.photoFile(seed));
    var time  = r.time || (CFG.results || {}).emptyTime || '--:--.---';
    var carLbl = [r.car, r.team].filter(Boolean).map(esc).join(' · ');

    html += '<article class="pod pod--' + r.pos + (r.driver ? '' : ' pod--empty') + '">' +
              media +
              '<span class="pod__rank" aria-hidden="true">' + r.pos + '</span>' +
              '<div class="pod__body">' +
                (r.div ? '<span class="mono pod__div">' + esc(r.div) + '</span>' : '') +
                '<h3 class="pod__driver">' + esc(r.driver || '—') + '</h3>' +
                '<p class="pod__car">' + carLbl + '</p>' +
                '<p class="pod__time">' + esc(time) + '</p>' +
              '</div>' +
            '</article>';
  });

  box.innerHTML = html;
  PS.guardImages(box);
}

/* ------------------------------------------------------------------
   PODIUM — dane z arkusza
   Bierzemy ostatnią zakładkę, w której naprawdę są wyniki kierowców,
   i pokazujemy z niej trzy pierwsze miejsca. Ten sam kod czyta arkusz
   co podstrona wyników, więc obie strony nie mogą się rozjechać.
------------------------------------------------------------------ */
var podium = { rows: [], round: '', demo: false, status: 'idle' };

function wczytajPodium () {
  var D = PS.dane;
  if (!D) return;

  var ch = D.champ((CFG.results || {}).champ || 'wrc');
  if (!ch) { podium.status = 'nosource'; renderPodium(); return; }

  D.pobierz(ch).then(function (data) {
    var t2 = D.ostatniaRunda(data);
    podium.demo = !!data.demo;

    if (!t2) { podium.rows = []; podium.round = ''; podium.status = 'empty'; renderPodium(); return; }

    var m = t2.map;
    podium.rows = t2.rows.slice(0, 3).map(function (r, i) {
      return {
        pos:    i + 1,
        driver: m.driver !== -1 ? r[m.driver] : '',
        car:    m.car    !== -1 ? r[m.car]    : '',
        team:   m.team   !== -1 ? r[m.team]   : '',
        div:    (m.div !== -1 && D.jestDywizja(r[m.div])) ? r[m.div] : '',
        time:   m.time !== -1 ? r[m.time] : (m.points !== -1 ? r[m.points] + ' pkt' : '')
      };
    });
    podium.round  = t2.name;
    podium.status = 'ok';
    renderPodium();
  renderOstatni();
  }).catch(function (err) {
    podium.status = (err && err.kod === 'nosource') ? 'nosource' : 'error';
    if (window.console && podium.status === 'error') console.warn('[podium]', err);
    renderPodium();
  });
}

/* ------------------------------------------------------------------
   NAJNOWSZY ARTYKUŁ
   Lista artykułów powstaje przy budowaniu strony (artykuly/lista.json).
   Gdy nie ma jeszcze żadnego, sekcja po prostu się nie pokazuje.
------------------------------------------------------------------ */
var ostatniArtykul = null;

function renderOstatni () {
  var sekcja = $('#ostatni');
  var box = $('#ostatniBox');
  if (!sekcja || !box) return;

  if (!ostatniArtykul) { sekcja.hidden = true; return; }
  sekcja.hidden = false;

  var d = ostatniArtykul;
  var mini = d.miniatura
    ? '<span class="dok-card__img"><img src="' + esc(d.miniatura) + '" alt="" loading="lazy" decoding="async"></span>'
    : '<span class="dok-card__img"></span>';
  var meta = [d.seria ? d.seria.toUpperCase() : '', PS.dateText(d.data ? new Date(d.data + 'T12:00:00') : null,
              { day: 'numeric', month: 'long', year: 'numeric' })].filter(Boolean).join(' · ');

  box.innerHTML = '<a class="dok-card dok-card--szeroki" href="' + esc(d.adres) + '">' + mini +
    '<span class="dok-card__body">' +
      (meta ? '<span class="mono dim dok-card__meta">' + esc(meta) + '</span>' : '') +
      '<span class="dok-card__title">' + esc(d.tytul) + '</span>' +
      (d.opis ? '<span class="dok-card__lead">' + esc(d.opis) + '</span>' : '') +
      '<span class="dok-card__more">' + esc(t('art.read')) + ' →</span>' +
    '</span></a>';
  PS.guardImages(box);
}

function wczytajOstatniArtykul () {
  fetch('artykuly/lista.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (dane) {
      var lista = (dane && dane.dokumenty) || [];
      ostatniArtykul = lista[0] || null;
      renderOstatni();
    })
    .catch(function () { /* brak listy — sekcja zostaje ukryta */ });
}

/* ------------------------------------------------------------------
   MEDIA — fasada YouTube (odtwarzacz ładuje się dopiero po kliknięciu)
------------------------------------------------------------------ */
function ytCmd (tile, func) {
  var f = tile.querySelector('iframe');
  if (!f || !f.contentWindow) return;
  try {
    f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: [] }), '*');
  } catch (e) {}
}

/* Tryb kinowy: kafelek nie zmienia rodzica w drzewie dokumentu, tylko
   zostaje przypięty do okna. Przeglądarka przeładowuje <iframe> za
   każdym razem, gdy ten zmieni rodzica — a tak film nie traci postępu. */
var theater = null, openTile = null, lastFocus = null;

function ensureTheater () {
  if (theater) return theater;
  theater = document.createElement('div');
  theater.className = 'theater';
  theater.hidden = true;
  theater.innerHTML = '<button type="button" class="theater__close">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  document.body.appendChild(theater);
  theater.addEventListener('click', function (e) {
    if (e.target === theater || e.target.closest('.theater__close')) closeTheater();
  });
  return theater;
}

function openTheater (tile) {
  var box = ensureTheater();
  box.hidden = false;
  $('.theater__close', box).setAttribute('aria-label', t('media.close'));
  document.body.classList.add('is-theater-open');
  tile.classList.add('is-theater');
  openTile = tile;
  ytCmd(tile, 'playVideo');
  lastFocus = document.activeElement;
  $('.theater__close', box).focus();
}

function closeTheater () {
  if (!openTile) return;
  ytCmd(openTile, 'pauseVideo');          // wraca do kafelka zapauzowany
  openTile.classList.remove('is-theater');
  var back = $('.vid__expand', openTile);
  openTile = null;
  if (theater) theater.hidden = true;
  document.body.classList.remove('is-theater-open');
  if (back) { back.focus(); } else if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' || e.key === 'Esc') closeTheater();
});

function renderVideos () {
  var box = $('#videos');
  if (!box) return;
  var m = CFG.media || {};

  function facade (poster, title, src, big) {
    return '<div class="vidwrap' + (big ? ' vidwrap--big' : '') + '">' +
             '<button type="button" class="vid" data-src="' + esc(src) + '">' +
               '<img class="vid__img" src="' + esc(poster) + '" alt="" loading="lazy" decoding="async">' +
               '<span class="vid__play" aria-hidden="true">' +
                 '<svg viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z"/></svg></span>' +
               '<span class="vid__title">' + esc(title) + '</span>' +
             '</button>' +
           '</div>';
  }

  if (m.videos && m.videos.length) {
    box.className = 'videos';
    box.innerHTML = m.videos.slice(0, 3).map(function (v) {
      return facade('https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg', txt(v.title),
                    'https://www.youtube-nocookie.com/embed/' + v.id +
                    '?autoplay=1&enablejsapi=1&rel=0&modestbranding=1');
    }).join('');
  } else {
    box.className = 'videos videos--single';
    box.innerHTML = facade(m.poster || '', t('media.play'),
      'https://www.youtube-nocookie.com/embed/videoseries?list=' + m.playlist +
      '&autoplay=1&enablejsapi=1&rel=0', true);
  }

  $$('.vid', box).forEach(function (b) {
    b.addEventListener('click', function () { activate(b); });
  });
}

/* Pierwsze kliknięcie tworzy odtwarzacz i od razu otwiera tryb kinowy. */
function activate (btn) {
  var wrap = btn.parentNode;

  var frame = document.createElement('iframe');
  frame.src = btn.getAttribute('data-src');
  frame.title = 'Project Simracing — YouTube';
  frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
  frame.setAttribute('allowfullscreen', '');

  var live = document.createElement('div');
  live.className = 'vid vid--live';
  live.appendChild(frame);

  var expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'vid__expand';
  expand.setAttribute('aria-label', t('media.expand'));
  expand.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5"/></svg>';
  expand.addEventListener('click', function () { openTheater(live); });
  live.appendChild(expand);

  wrap.replaceChild(live, btn);
  openTheater(live);
}

/* ------------------------------------------------------------------
   WSKAŹNIK PRZEWIJANIA
------------------------------------------------------------------ */
var hint = $('#scrollhint');
if (hint) {
  window.addEventListener('scroll', function () {
    hint.classList.toggle('is-gone', window.scrollY > 80);
  }, { passive: true });
}

/* ------------------------------------------------------------------
   START
------------------------------------------------------------------ */
buildMedia();

/* Przy zmianie języka przerysowujemy wszystko, co bierze treść z konfiguracji. */
PS.onLang(function () {
  renderSlides();
  renderHub();
  renderPodium();
  renderVideos();
  renderNextRound();
});

wczytajPodium();
wczytajOstatniArtykul();
PS.boot();
go(0);
setPaused(reduceMotion);
setInterval(tickCountdown, 1000);

})();
