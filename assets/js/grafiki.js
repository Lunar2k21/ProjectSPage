/* =====================================================================
   Project Simracing — generator grafik
   ---------------------------------------------------------------------
   Cztery układy wzięte z plakatów ligi:
     skos   — zdjęcie z jednej strony, pomarańczowy klin, granatowy panel
              z tytułem i listą (jak „Seasonal Cup" i „Informacje"),
     pasek  — zdjęcie na całość i granatowa belka na dole,
     pas    — plakat rundy: dwa zdjęcia, między nimi kolorowy pas z tytułem,
     jasny  — kremowe tło, zdjęcie ucięte skosem, ciemny tytuł.
   Rysowane na płótnie w pełnej rozdzielczości — to, co widać w podglądzie,
   jest dokładnie tym, co się pobierze. Zdjęcia nie opuszczają przeglądarki.
   ===================================================================== */
(function () {
'use strict';

var PS  = window.PS;
var CFG = PS.cfg;
var $   = PS.$;

var KOL = {
  navy: '#151B2D', ciemny: '#0B111C', krem: '#EFE8DA', kremTlo: '#EFE7DA',
  tusz: '#131A2E', tuszDim: '#6B7285', dim: '#8C95A8'
};
var LINKI = ['discord.gg/R3Tu68jWwK', 'YT @ProjectSimracingpl', 'projectsimracing.pl'];
var KLUCZ = 'ps-grafiki';
var DOMYSLNE_ZDJ = 'assets/img/hero/lmu-1920.webp';

var st = {
  szablon: 'skos',
  zdj: [{ img: null, z: 1, dx: 0, dy: 0 }, { img: null, z: 1, dx: 0, dy: 0 }],
  aktywne: 0,
  domyslne: null, logo: null, logoCiemne: null,
  sloty: []
};

var plotno, ctx;

/* ------------------------------------------------------------------
   POMOCNICZE
------------------------------------------------------------------ */
function dwa (n) { return (n < 10 ? '0' : '') + n; }
function dataKropki (d) { return d ? dwa(d.getDate()) + '.' + dwa(d.getMonth() + 1) + '.' + d.getFullYear() : ''; }
function ogr (x, a, b) { return Math.max(a, Math.min(b, x)); }

function fD (px) { return 'italic 800 ' + Math.round(px) + 'px "Saira Condensed", "Arial Narrow", sans-serif'; }
function fM (px, w) { return (w || 400) + ' ' + Math.round(px) + 'px "IBM Plex Mono", monospace'; }
function odstep (px) { if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(px) + 'px'; }

function wielokat (pkt) {
  ctx.beginPath();
  ctx.moveTo(pkt[0], pkt[1]);
  for (var i = 2; i < pkt.length; i += 2) ctx.lineTo(pkt[i], pkt[i + 1]);
  ctx.closePath();
}

/* „R1 | **Belgia** | 02.10" -> odcinki z zaznaczeniem akcentu */
function odcinki (t) {
  return String(t).split('**').map(function (x, i) { return { t: x, akc: i % 2 === 1 }; })
    .filter(function (o) { return o.t; });
}
function szerokosc (segs) {
  return segs.reduce(function (s, o) { return s + ctx.measureText(o.t).width; }, 0);
}
function piszOdcinki (segs, x, y, wyrownaj, kolor, akcent) {
  var w = szerokosc(segs);
  var start = wyrownaj === 'right' ? x - w : wyrownaj === 'center' ? x - w / 2 : x;
  var stare = ctx.textAlign;
  ctx.textAlign = 'left';
  segs.forEach(function (o) {
    ctx.fillStyle = o.akc ? akcent : kolor;
    ctx.fillText(o.t, start, y);
    start += ctx.measureText(o.t).width;
  });
  ctx.textAlign = stare;
}

/* Tytuł: linie z Entera, rozmiar zmniejszany aż zmieści się w szerokości. */
function tytul (o) {
  var linie = String(o.tekst || '').toUpperCase().split(/\r?\n/).filter(function (l) { return l.trim(); });
  if (!linie.length) return 0;
  var r = o.rozmiar;
  for (; r > o.rozmiar * .35; r -= 2) {
    ctx.font = fD(r);
    var maks = Math.max.apply(null, linie.map(function (l) { return szerokosc(odcinki(l)); }));
    if (maks <= o.maxW && (!o.maxH || linie.length * r * .92 <= o.maxH)) break;
  }
  ctx.font = fD(r);
  var lh = r * .92;
  if (o.cien) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = r * .25; ctx.shadowOffsetY = r * .04; }
  linie.forEach(function (l, i) {
    piszOdcinki(odcinki(l), o.x, o.y + r * .8 + i * lh, o.wyrownaj, o.kolor, o.akcent);
  });
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  return r * .8 + (linie.length - 1) * lh + r * .2;
}

/* Treść: linie wersalikami, „---" to kreska, pusta linia to odstęp.
   Rozmiar dobierany do szerokości i wysokości dostępnego miejsca. */
function tresc (o) {
  var linie = String(o.tekst || '').split(/\r?\n/);
  while (linie.length && !linie[linie.length - 1].trim()) linie.pop();
  if (!linie.length) return 0;
  var odstepLinii = o.interlinia || 1.75;

  function wysokosc (r) {
    return linie.reduce(function (h, l) {
      return h + (!l.trim() ? r * .7 : l.trim() === '---' ? r * .9 : r * odstepLinii);
    }, 0);
  }
  var r = o.rozmiar;
  for (; r > 12; r -= 1) {
    ctx.font = o.font ? o.font(r) : fD(r);
    var maks = Math.max.apply(null, linie.map(function (l) { return szerokosc(odcinki(l.toUpperCase())); }));
    if (maks <= o.maxW && wysokosc(r) <= o.maxH) break;
  }
  ctx.font = o.font ? o.font(r) : fD(r);
  var y = o.y;
  if (o.odDolu) y = o.y - wysokosc(r);
  var kreska = o.szerKreski || o.maxW;
  linie.forEach(function (l) {
    var t = l.trim();
    if (!t) { y += r * .7; return; }
    if (t === '---') {
      ctx.fillStyle = o.akcent;
      var kx = o.wyrownaj === 'right' ? o.x - kreska : o.wyrownaj === 'center' ? o.x - kreska / 2 : o.x;
      ctx.fillRect(kx, y + r * .35, kreska, Math.max(2, r * .07));
      y += r * .9;
      return;
    }
    piszOdcinki(odcinki(t.toUpperCase()), o.x, y + r * 1.1, o.wyrownaj, o.kolor, o.akcent);
    y += r * odstepLinii;
  });
  return y - o.y;
}

/* Zdjęcie przycięte do kształtu (clip) i wpasowane „cover" w prostokąt
   ramki, z powiększeniem i przesunięciem ustawionym przez użytkownika. */
function zdjecie (i, ramka, ksztalt) {
  var z = st.zdj[i];
  var im = z.img || st.zdj[0].img || st.domyslne;
  ctx.save();
  if (ksztalt) { wielokat(ksztalt); } else { ctx.beginPath(); ctx.rect(ramka.x, ramka.y, ramka.w, ramka.h); }
  ctx.clip();
  ctx.fillStyle = KOL.ciemny; ctx.fillRect(ramka.x, ramka.y, ramka.w, ramka.h);
  if (im) {
    var s = Math.max(ramka.w / im.width, ramka.h / im.height) * z.z;
    var dw = im.width * s, dh = im.height * s;
    var mx = (dw - ramka.w) / 2, my = (dh - ramka.h) / 2;
    z.dx = ogr(z.dx, -mx, mx); z.dy = ogr(z.dy, -my, my);
    ctx.drawImage(im, ramka.x - mx + z.dx, ramka.y - my + z.dy, dw, dh);
  }
  ctx.restore();
  st.sloty.push({ i: i, x: ramka.x, y: ramka.y, w: ramka.w, h: ramka.h });
}

function logo (x, y, w, ciemne, wyrownaj) {
  var im = ciemne ? st.logoCiemne : st.logo;
  if (!im) return 0;
  var h = w * im.height / im.width;
  var lx = wyrownaj === 'right' ? x - w : wyrownaj === 'center' ? x - w / 2 : x;
  ctx.drawImage(im, lx, y, w, h);
  return h;
}

/* Jedna linia mono z rozstrzeleniem; zmniejszana, aż zmieści się w maxW. */
function mono (t, x, y, maxW, r, o) {
  o = o || {};
  var min = r * .45;
  for (; r > min; r -= .5) {
    ctx.font = fM(r, o.waga); odstep(r * (o.rozstaw == null ? .3 : o.rozstaw));
    if (ctx.measureText(t).width <= maxW) break;
  }
  ctx.fillStyle = o.kolor || KOL.krem;
  ctx.textAlign = o.wyrownaj || 'left';
  ctx.fillText(t, x, y);
  ctx.textAlign = 'left';
  odstep(0);
}

function linki (x, y, rozmiar, kolor, wyrownaj, maxW) {
  mono(LINKI.join('   ·   '), x, y, maxW || plotno.width * .9, rozmiar, { waga: 500, rozstaw: .12, kolor: kolor, wyrownaj: wyrownaj });
}

function pole (id) { var el = $(id); return el ? el.value : ''; }
function zaz (id) { var el = $(id); return !!(el && el.checked); }

/* ------------------------------------------------------------------
   UKŁAD 1 — SKOS
------------------------------------------------------------------ */
function rysujSkos (W, H, akc) {
  var u = Math.min(W, H) / 1080;
  var poziomo = W / H >= 1.15;
  var odw = zaz('#gOdwroc');
  var marg = 0.035 * W;

  ctx.fillStyle = KOL.navy; ctx.fillRect(0, 0, W, H);

  if (poziomo) {
    var xF = 0.503 * W, xG = xF + 0.004 * W, xD = xF + 0.06 * W;
    var fx = function (x) { return odw ? W - x : x; };
    zdjecie(0, { x: odw ? W - xF : 0, y: 0, w: xF, h: H },
      [fx(0), 0, fx(xF), 0, fx(xF), H, fx(0), H]);
    ctx.fillStyle = akc;
    wielokat([fx(xF), 0, fx(xG), 0, fx(xD), H, fx(xF), H]); ctx.fill();

    var al = odw ? 'left' : 'right', X = odw ? marg : W - marg;
    var hT = tytul({ tekst: pole('#gTytul'), x: X, y: 0.01 * H, rozmiar: 0.17 * H, maxW: W - 2 * marg,
      wyrownaj: al, kolor: KOL.krem, akcent: akc, cien: true });

    var yN = 0.01 * H + hT + 0.06 * H;
    mono(pole('#gNad').toUpperCase(), X, yN, W * .6, 0.03 * H, { wyrownaj: al });

    var lw = 0.42 * W;
    var hL = st.logo ? lw * st.logo.height / st.logo.width : 0;
    var dol = H - 0.035 * H - hL;
    var dopH = rysujDopiski(X, dol - 0.03 * H, al, KOL.krem, akc, 0.035 * H, 0.07 * H);
    var panelL = xD + 0.03 * W;
    tresc({ tekst: pole('#gTresc'), x: X, y: yN + 0.03 * H, rozmiar: 0.06 * H, maxW: W - panelL - marg,
      maxH: dol - dopH - 0.05 * H - yN, wyrownaj: al, kolor: KOL.krem, akcent: akc, szerKreski: 0.35 * W });
    logo(X, H - 0.035 * H - hL, lw, false, al);
    if (zaz('#gLinki')) {
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 12 * u;
      linki(odw ? W - marg : marg, H - 0.04 * H, 0.022 * H, KOL.krem, odw ? 'right' : 'left', xF - 2 * marg);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }
  } else {
    var yF = 0.42 * H, yA = yF + 0.004 * H, yB = yF + 0.05 * H;
    var fy = function (x) { return odw ? W - x : x; };
    zdjecie(0, { x: 0, y: 0, w: W, h: yF });
    ctx.fillStyle = akc;
    wielokat([0, yF, W, yF, fy(W), yA, fy(0), yB]); ctx.fill();
    ctx.fillStyle = KOL.navy;
    wielokat([fy(0), yB, fy(W), yA, fy(W), H, fy(0), H]); ctx.fill();

    var al2 = odw ? 'left' : 'right', X2 = odw ? marg : W - marg;
    var r = 0.19 * W;
    var hT2 = tytul({ tekst: pole('#gTytul'), x: X2, y: yF - r * .7, rozmiar: r, maxW: W - 2 * marg,
      wyrownaj: al2, kolor: KOL.krem, akcent: akc, cien: true });

    var yN2 = yF - r * .7 + hT2 + 0.06 * W;
    mono(pole('#gNad').toUpperCase(), X2, yN2, W - 2 * marg, 0.028 * W, { wyrownaj: al2 });

    var lw2 = 0.62 * W;
    var hL2 = st.logo ? lw2 * st.logo.height / st.logo.width : 0;
    var dol2 = H - 0.04 * W - hL2 - (zaz('#gLinki') ? 0.06 * W : 0);
    var dopH2 = rysujDopiski(X2, dol2 - 0.04 * W, al2, KOL.krem, akc, 0.035 * W, 0.075 * W);
    tresc({ tekst: pole('#gTresc'), x: X2, y: yN2 + 0.02 * W, rozmiar: 0.065 * W, maxW: W - 2 * marg,
      maxH: dol2 - dopH2 - 0.06 * W - yN2, wyrownaj: al2, kolor: KOL.krem, akcent: akc, szerKreski: 0.5 * W });
    logo(X2, dol2, lw2, false, al2);
    if (zaz('#gLinki')) linki(W / 2, H - 0.03 * W, 0.024 * W, 'rgba(239,232,218,.75)', 'center', W - 2 * marg);
  }
}

/* Dopiski (mały mono + duży kursywą) — zwraca zajętą wysokość; rysuje od dołu. */
function rysujDopiski (x, yDol, al, kolor, akc, rMaly, rDuzy) {
  var maly = pole('#gDopMaly').trim(), duzy = pole('#gDop').trim();
  var h = 0;
  ctx.textAlign = al;
  if (duzy) {
    ctx.font = fD(rDuzy); ctx.fillStyle = kolor;
    ctx.fillText(duzy.toUpperCase(), x, yDol);
    h += rDuzy * 1.05;
  }
  if (maly) {
    ctx.font = fM(rMaly, 500); odstep(rMaly * .25); ctx.fillStyle = akc;
    ctx.fillText(maly.toUpperCase(), x, yDol - h - rMaly * .2);
    odstep(0);
    h += rMaly * 1.6;
  }
  ctx.textAlign = 'left';
  return h;
}

/* ------------------------------------------------------------------
   UKŁAD 2 — PASEK
------------------------------------------------------------------ */
function rysujPasek (W, H, akc) {
  var poziomo = W / H >= 1.15;
  var m = Math.min(W, H);
  var marg = 0.035 * W;
  var hb = poziomo ? 0.17 * H : 0.2 * H;
  var t = 0.011 * m;

  zdjecie(0, { x: 0, y: 0, w: W, h: H - hb });

  /* treść na zdjęciu, po lewej, na ciemnym przejściu */
  var tekst = pole('#gTresc');
  if (tekst.trim()) {
    var g = ctx.createLinearGradient(0, 0, W * .7, 0);
    g.addColorStop(0, 'rgba(11,17,28,.85)'); g.addColorStop(1, 'rgba(11,17,28,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H - hb);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 0.01 * m;
    tresc({ tekst: tekst, x: marg, y: 0.05 * H, rozmiar: 0.06 * m, maxW: W * .6, maxH: H - hb - 0.1 * H,
      wyrownaj: 'left', kolor: KOL.krem, akcent: akc, szerKreski: W * .4, interlinia: 1.3 });
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  }

  ctx.fillStyle = akc; ctx.fillRect(0, H - hb - t, W, t);
  ctx.fillStyle = KOL.ciemny; ctx.fillRect(0, H - hb, W, hb);

  var maly = pole('#gDopMaly').trim().toUpperCase(), duzy = pole('#gDop').trim().toUpperCase();

  if (poziomo) {
    var lw = 0.24 * W;
    var lh = st.logo ? lw * st.logo.height / st.logo.width : 0;
    var yS = H - hb / 2;
    logo(marg, yS - lh / 2, lw, false);

    var prawa = W - marg, szerP = 0;
    ctx.textAlign = 'right';
    if (duzy) { ctx.font = fD(0.36 * hb); szerP = ctx.measureText(duzy).width; ctx.fillStyle = KOL.krem; ctx.fillText(duzy, prawa, yS + 0.13 * hb); }
    if (maly) {
      ctx.font = fM(0.12 * hb, 500); odstep(0.03 * hb); ctx.fillStyle = akc;
      ctx.fillText(maly, prawa, duzy ? yS - 0.2 * hb : yS + 0.04 * hb);
      szerP = Math.max(szerP, ctx.measureText(maly).width); odstep(0);
    }
    ctx.textAlign = 'left';

    var tx = marg + lw + 0.035 * W, maxW = prawa - szerP - 0.04 * W - tx;
    mono(pole('#gNad').toUpperCase(), tx, yS - 0.14 * hb, maxW, 0.1 * hb, { kolor: 'rgba(239,232,218,.6)' });
    tytul({ tekst: pole('#gTytul').split(/\r?\n/).join(' '), x: tx, y: yS - 0.1 * hb, rozmiar: 0.34 * hb, maxW: maxW,
      wyrownaj: 'left', kolor: KOL.krem, akcent: akc });
    if (zaz('#gLinki')) {
      ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 0.012 * H;
      linki(W - marg, 0.05 * H, 0.018 * H, KOL.krem, 'right');
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }
  } else {
    var lw2 = 0.42 * W;
    var lh2 = st.logo ? lw2 * st.logo.height / st.logo.width : 0;
    var y0 = H - hb;
    logo(marg, y0 + 0.14 * hb, lw2, false);
    ctx.textAlign = 'right';
    if (duzy) { ctx.font = fD(0.2 * hb); ctx.fillStyle = KOL.krem; ctx.fillText(duzy, W - marg, y0 + 0.14 * hb + lh2); }
    if (maly) { ctx.font = fM(0.065 * hb, 500); odstep(0.015 * hb); ctx.fillStyle = akc; ctx.fillText(maly, W - marg, y0 + 0.14 * hb + lh2 - (duzy ? 0.2 * hb : 0)); odstep(0); }
    ctx.textAlign = 'left';
    mono(pole('#gNad').toUpperCase(), marg, y0 + 0.52 * hb, W - 2 * marg, 0.06 * hb, { kolor: 'rgba(239,232,218,.6)' });
    tytul({ tekst: pole('#gTytul').split(/\r?\n/).join(' '), x: marg, y: y0 + 0.56 * hb, rozmiar: 0.26 * hb, maxW: W - 2 * marg,
      wyrownaj: 'left', kolor: KOL.krem, akcent: akc });
    if (zaz('#gLinki')) linki(W / 2, H - 0.05 * hb, 0.05 * hb, 'rgba(239,232,218,.55)', 'center', W - 2 * marg);
  }
}

/* ------------------------------------------------------------------
   UKŁAD 3 — PAS ŚRODKOWY
------------------------------------------------------------------ */
function rysujPas (W, H, akc) {
  var poziomo = W / H >= 1.15;
  var m = Math.min(W, H);
  var marg = 0.05 * W;
  var hHead = (poziomo ? 0.13 : 0.12) * H;
  var hF = (poziomo ? 0.19 : 0.23) * H;
  var hPas = (poziomo ? 0.19 : 0.16) * H;
  var kreska = 0.004 * m;

  ctx.fillStyle = KOL.navy; ctx.fillRect(0, 0, W, H);

  var y1 = hHead, y2 = y1 + hF + kreska, y3 = y2 + hPas + kreska, y4 = y3 + hF;
  zdjecie(0, { x: 0, y: y1, w: W, h: hF });
  ctx.fillStyle = akc; ctx.fillRect(0, y2, W, hPas);
  zdjecie(1, { x: 0, y: y3, w: W, h: hF });
  ctx.fillStyle = KOL.ciemny;
  ctx.fillRect(0, y2 - kreska, W, kreska); ctx.fillRect(0, y2 + hPas, W, kreska);

  /* nagłówek: logo i dopiski */
  var lw = (poziomo ? 0.3 : 0.5) * W;
  var lh = st.logo ? lw * st.logo.height / st.logo.width : 0;
  logo(marg, (hHead - lh) / 2, lw, false);
  var maly = pole('#gDopMaly').trim().toUpperCase(), duzy = pole('#gDop').trim().toUpperCase();
  ctx.textAlign = 'right';
  if (duzy) { ctx.font = fD(0.34 * hHead); ctx.fillStyle = KOL.krem; ctx.fillText(duzy, W - marg, hHead * (maly ? .72 : .62)); }
  if (maly) { ctx.font = fM(0.11 * hHead, 500); odstep(0.03 * hHead); ctx.fillStyle = akc; ctx.fillText(maly, W - marg, hHead * (duzy ? .36 : .55)); odstep(0); }
  ctx.textAlign = 'left';

  /* pas: tytuł ciemny na kolorze, nadtytuł pod spodem */
  var nad = pole('#gNad').toUpperCase();
  var hT = tytul({ tekst: pole('#gTytul').split(/\r?\n/).join(' '), x: W / 2, y: y2 + hPas * .14, rozmiar: hPas * .5,
    maxW: W - 2 * marg, maxH: hPas * .55, wyrownaj: 'center', kolor: KOL.navy, akcent: KOL.krem });
  mono(nad, W / 2, y2 + hPas * .14 + hT + hPas * .14, W - 2 * marg, hPas * .1, { kolor: KOL.navy, wyrownaj: 'center', rozstaw: .25 });

  /* dół: treść wyśrodkowana i linki */
  var hLinki = zaz('#gLinki') ? 0.06 * H : 0;
  tresc({ tekst: pole('#gTresc'), x: W / 2, y: y4 + 0.02 * H, rozmiar: 0.06 * m, maxW: W - 2 * marg,
    maxH: H - y4 - 0.05 * H - hLinki, wyrownaj: 'center', kolor: KOL.krem, akcent: akc, szerKreski: W * .4, interlinia: 1.25 });
  if (hLinki) linki(W / 2, H - 0.03 * H, 0.022 * m, 'rgba(239,232,218,.8)', 'center', W - 2 * marg);
}

/* ------------------------------------------------------------------
   UKŁAD 4 — JASNY
------------------------------------------------------------------ */
function rysujJasny (W, H, akc) {
  var poziomo = W / H >= 1.15;
  var m = Math.min(W, H);
  var marg = 0.07 * W;
  var odw = zaz('#gOdwroc');
  /* z treścią zdjęcie oddaje trochę miejsca */
  var zT = pole('#gTresc').trim() ? (poziomo ? .82 : .66) : 1;
  var yL = (poziomo ? 0.56 : 0.6) * H * zT, yR = (poziomo ? 0.46 : 0.54) * H * zT;
  if (odw) { var t = yL; yL = yR; yR = t; }
  var gap = 0.012 * H, gr = 0.022 * H;

  ctx.fillStyle = KOL.kremTlo; ctx.fillRect(0, 0, W, H);
  zdjecie(0, { x: 0, y: 0, w: W, h: Math.max(yL, yR) }, [0, 0, W, 0, W, yR, 0, yL]);
  ctx.fillStyle = akc;
  wielokat([0, yL + gap, W, yR + gap, W, yR + gap + gr, 0, yL + gap + gr]); ctx.fill();

  var yGora = Math.max(yL, yR) + gap + gr;
  var y = yGora + 0.05 * H;
  var nad = pole('#gNad').trim();
  var jestTresc = !!pole('#gTresc').trim();
  var kolumny = poziomo && jestTresc;          /* poziomo: treść w prawej kolumnie */
  var szerT = kolumny ? W * .52 : W - 2 * marg;
  if (nad) { mono('//  ' + nad.toUpperCase(), marg, y, szerT, 0.022 * m, { kolor: KOL.tuszDim }); y += 0.02 * H; }

  var lw = (poziomo ? 0.24 : 0.36) * W;
  var lh = st.logoCiemne ? lw * st.logoCiemne.height / st.logoCiemne.width : 0;
  var yDol = H - 0.045 * H;
  var yLinia = yDol - Math.max(lh, 0.09 * m) - 0.035 * H;
  var hLinki = zaz('#gLinki') ? 0.04 * H : 0;

  var hT = tytul({ tekst: pole('#gTytul'), x: marg - 0.005 * W, y: y, rozmiar: (poziomo ? 0.14 : 0.1) * H,
    maxW: szerT, maxH: (yLinia - y - hLinki) * (jestTresc && !kolumny ? .32 : .85), wyrownaj: 'left', kolor: KOL.tusz, akcent: akc });
  y += hT + 0.025 * H;
  if (kolumny) {
    tresc({ tekst: pole('#gTresc'), x: W - marg, y: yGora + 0.035 * H, rozmiar: 0.04 * m, maxW: W - 2 * marg - szerT - 0.04 * W,
      maxH: yLinia - yGora - 0.05 * H - hLinki, wyrownaj: 'right', kolor: KOL.tusz, akcent: akc, szerKreski: W * .2, interlinia: 1.45 });
  } else {
    tresc({ tekst: pole('#gTresc'), x: marg, y: y, rozmiar: 0.04 * m, maxW: W - 2 * marg,
      maxH: yLinia - y - 0.015 * H - hLinki, wyrownaj: 'left', kolor: KOL.tusz, akcent: akc, szerKreski: W * .3, interlinia: 1.4 });
  }

  if (hLinki) linki(W - marg, yLinia - 0.018 * H, 0.018 * m, KOL.tuszDim, 'right', W - 2 * marg);
  ctx.fillStyle = KOL.tusz; ctx.fillRect(marg, yLinia, W - 2 * marg, Math.max(2, 0.002 * m));

  logo(marg, yDol - lh, lw, true);
  var maly = pole('#gDopMaly').trim().toUpperCase(), duzy = pole('#gDop').trim().toUpperCase();
  ctx.textAlign = 'right';
  if (duzy) { ctx.font = fD(0.07 * m); ctx.fillStyle = KOL.tusz; ctx.fillText(duzy, W - marg, yDol); }
  if (maly) mono(maly, W - marg, yDol - (duzy ? 0.08 * m : 0), W * .5, 0.02 * m, { waga: 500, kolor: KOL.tuszDim, wyrownaj: 'right' });
  ctx.textAlign = 'left';
}

/* ------------------------------------------------------------------
   RYSOWANIE I OBSŁUGA
------------------------------------------------------------------ */
function wymiary () {
  var f = pole('#gFormat').split('x');
  return { W: parseInt(f[0], 10) || 1920, H: parseInt(f[1], 10) || 1080 };
}

function rysuj () {
  var r = wymiary();
  if (plotno.width !== r.W || plotno.height !== r.H) { plotno.width = r.W; plotno.height = r.H; }
  ctx.textBaseline = 'alphabetic';
  st.sloty = [];
  var akc = pole('#gKolor') || '#ED4703';
  ({ skos: rysujSkos, pasek: rysujPasek, pas: rysujPas, jasny: rysujJasny }[st.szablon] || rysujSkos)(r.W, r.H, akc);
  $('#gZdj2Wrzut').hidden = st.szablon !== 'pas';
  zapisz();
}

var czeka = false;
function rysujWkrotce () {
  if (czeka) return;
  czeka = true;
  requestAnimationFrame(function () { czeka = false; rysuj(); });
}

var POLA = ['#gFormat', '#gKolor', '#gOdwroc', '#gNad', '#gTytul', '#gTresc', '#gDopMaly', '#gDop', '#gLinki'];

function zapisz () {
  var o = { szablon: st.szablon };
  POLA.forEach(function (id) { var el = $(id); o[id] = el.type === 'checkbox' ? el.checked : el.value; });
  try { localStorage.setItem(KLUCZ, JSON.stringify(o)); } catch (e) {}
}

function wczytajZapis () {
  var o = null;
  try { o = JSON.parse(localStorage.getItem(KLUCZ) || 'null'); } catch (e) {}
  if (!o) return false;
  st.szablon = o.szablon || 'skos';
  POLA.forEach(function (id) {
    var el = $(id);
    if (!el || o[id] === undefined) return;
    if (el.type === 'checkbox') el.checked = !!o[id]; else el.value = o[id];
  });
  return true;
}

function obraz (src) {
  return new Promise(function (ok) {
    var im = new Image();
    im.onload = function () { ok(im); };
    im.onerror = function () { ok(null); };
    im.src = src;
  });
}

/* Logo na jasne tło: biały blok „SIMRACING.PL" (litery są w nim
   wycięte) przemalowujemy na granat — na kremie litery zostają widoczne. */
function logoNaJasne (im) {
  var c = document.createElement('canvas');
  c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
  var x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  try {
    var d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (var i = 0; i < p.length; i += 4) {
      if (p[i] > 200 && p[i + 1] > 200 && p[i + 2] > 200) { p[i] = 21; p[i + 1] = 27; p[i + 2] = 45; }
    }
    x.putImageData(d, 0, 0);
  } catch (e) { return im; }
  return c;
}

/* Kalendarz serii jako linie „R1 | BELGIA | 02.10.2026". */
function listaSerii () {
  var serie = {};
  PS.rounds().forEach(function (r) { if (r.series) serie[r.series] = r.seriesLabel || r.series; });
  $('#gSeria').innerHTML = Object.keys(serie).map(function (k) {
    return '<option value="' + k + '">' + PS.esc(serie[k]) + '</option>';
  }).join('');
}

function wstawKalendarz () {
  var s = pole('#gSeria');
  var rundy = PS.rounds().filter(function (r) { return r.series === s; });
  if (!rundy.length) return;
  $('#gTresc').value = rundy.map(function (r) {
    var nazwa = String(r.name || '').split(/\s+[—–]\s+/)[0];
    var data = r.wielodniowy && r.end
      ? dwa(r.start.getDate()) + '.' + dwa(r.start.getMonth() + 1) + '–' + dataKropki(r.end)
      : dataKropki(r.start);
    return 'R' + r.n + ' | ' + nazwa + (data ? ' | ' + data : '');
  }).join('\n');
  var et = rundy[0].seriesLabel;
  if (et) $('#gNad').value = et.replace(/\s*·\s*/g, ' / ');
  rysuj();
}

function zPliku (plik, i) {
  if (!plik || !/^image\//.test(plik.type)) return;
  var url = URL.createObjectURL(plik);
  obraz(url).then(function (im) {
    if (!im) return;
    st.zdj[i] = { img: im, z: 1, dx: 0, dy: 0 };
    st.aktywne = i;
    $('#gZoom').value = 100;
    $(i ? '#gZdj2Nazwa' : '#gZdjNazwa').textContent = plik.name + ' · przeciągnij na podglądzie, żeby ustawić kadr';
    rysuj();
  });
}

function punktNaPlotnie (e) {
  var r = plotno.getBoundingClientRect();
  return { x: (e.clientX - r.left) * plotno.width / r.width, y: (e.clientY - r.top) * plotno.height / r.height, s: plotno.width / r.width };
}

function slotW (p) {
  for (var i = st.sloty.length - 1; i >= 0; i--) {
    var s = st.sloty[i];
    if (p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) return s.i;
  }
  return -1;
}

function start () {
  plotno = $('#gPlotno');
  if (!plotno) return;
  ctx = plotno.getContext('2d');

  listaSerii();
  if (!wczytajZapis()) {
    var lmu = PS.rounds().some(function (r) { return r.series === 'lmu'; });
    if (lmu) { $('#gSeria').value = 'lmu'; }
  }
  [].forEach.call(document.querySelectorAll('#gSzablony [data-szablon]'), function (b) {
    b.classList.toggle('is-on', b.getAttribute('data-szablon') === st.szablon);
  });

  $('#gSzablony').addEventListener('click', function (e) {
    var b = e.target.closest('[data-szablon]');
    if (!b) return;
    st.szablon = b.getAttribute('data-szablon');
    [].forEach.call(this.querySelectorAll('[data-szablon]'), function (x) { x.classList.toggle('is-on', x === b); });
    rysuj();
  });

  POLA.forEach(function (id) { $(id).addEventListener('input', rysujWkrotce); $(id).addEventListener('change', rysujWkrotce); });
  $('#gKal').addEventListener('click', wstawKalendarz);

  $('#gZdj').addEventListener('change', function () { zPliku(this.files[0], 0); this.value = ''; });
  $('#gZdj2').addEventListener('change', function () { zPliku(this.files[0], 1); this.value = ''; });
  [['#gZdjWrzut', 0], ['#gZdj2Wrzut', 1]].forEach(function (p) {
    var el = $(p[0]);
    el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('is-nad'); });
    el.addEventListener('dragleave', function () { el.classList.remove('is-nad'); });
    el.addEventListener('drop', function (e) { e.preventDefault(); el.classList.remove('is-nad'); zPliku(e.dataTransfer.files[0], p[1]); });
  });

  $('#gZoom').addEventListener('input', function () {
    st.zdj[st.aktywne].z = this.value / 100;
    rysujWkrotce();
  });

  /* przeciąganie kadru na podglądzie; upuszczenie zdjęcia na podgląd */
  var ciag = null;
  plotno.addEventListener('pointerdown', function (e) {
    var p = punktNaPlotnie(e), i = slotW(p);
    if (i < 0) return;
    st.aktywne = i;
    $('#gZoom').value = Math.round(st.zdj[i].z * 100);
    ciag = { x: p.x, y: p.y };
    plotno.setPointerCapture(e.pointerId);
    plotno.classList.add('is-ciag');
  });
  plotno.addEventListener('pointermove', function (e) {
    if (!ciag) return;
    var p = punktNaPlotnie(e), z = st.zdj[st.aktywne];
    z.dx += p.x - ciag.x; z.dy += p.y - ciag.y;
    ciag = { x: p.x, y: p.y };
    rysujWkrotce();
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    plotno.addEventListener(ev, function () { ciag = null; plotno.classList.remove('is-ciag'); });
  });
  plotno.addEventListener('wheel', function (e) {
    var i = slotW(punktNaPlotnie(e));
    if (i < 0) return;
    e.preventDefault();
    st.aktywne = i;
    var z = st.zdj[i];
    z.z = ogr(z.z * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 1, 3);
    $('#gZoom').value = Math.round(z.z * 100);
    rysujWkrotce();
  }, { passive: false });
  plotno.addEventListener('dragover', function (e) { e.preventDefault(); });
  plotno.addEventListener('drop', function (e) {
    e.preventDefault();
    var i = slotW(punktNaPlotnie(e));
    zPliku(e.dataTransfer.files[0], i > 0 ? i : 0);
  });

  $('#gPobierz').addEventListener('click', function () {
    rysuj();
    var r = wymiary();
    var nazwa = (pole('#gTytul') || 'grafika').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grafika';
    plotno.toBlob(function (b) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = nazwa + '-' + st.szablon + '-' + r.W + 'x' + r.H + '.png';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      $('#gInfo').textContent = 'Zapisano: ' + a.download;
    }, 'image/png');
  });

  /* czcionki, logo i zdjęcie przykładowe — potem pierwszy rysunek */
  var fonty = document.fonts && document.fonts.load ? Promise.all([
    '800 64px "Saira Condensed"', '400 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"'
  ].map(function (f) { return document.fonts.load(f).catch(function () {}); })) : Promise.resolve();

  rysuj();
  Promise.all([fonty, obraz('assets/img/brand/logo.png'), obraz(DOMYSLNE_ZDJ)]).then(function (w) {
    st.logo = w[1];
    st.logoCiemne = w[1] ? logoNaJasne(w[1]) : null;
    st.domyslne = w[2];
    if (!$('#gTresc').value.trim() && PS.rounds().some(function (r) { return r.series === pole('#gSeria'); })) wstawKalendarz();
    rysuj();
  });
}

window.GRAFIKI = { rysuj: rysuj, st: st };

start();
PS.boot();

})();
