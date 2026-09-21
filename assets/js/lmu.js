/* =====================================================================
   Project Simracing — wyniki Le Mans Ultimate z pliku XML
   ---------------------------------------------------------------------
   Gra po każdej sesji zapisuje plik w UserData/Log/Results. Ta strona
   czyta go w przeglądarce (nic nie jest nigdzie wysyłane) i robi z niego:
     1. tabelę wyników w stylu serwisu, podzieloną na klasy,
     2. przebieg wyścigu, okrążenia i sektory, incydenty,
     3. klasyfikację sezonu, gdy wczyta się kilka plików naraz,
     4. grafiki PNG 1920 px szerokości (wyniki rundy i klasyfikacja),
     5. dane do wklejenia w arkusz — w kolumnach, które strona wyników
        rozpoznaje sama (Poz, Kierowca, Zespół, Samochód, Klasa, Czas,
        Punkty).

   Obrazy aut, marek i torów pochodzą z plików gry — przygotowuje je
   narzedzia/lmu-zasoby.py, a spis tego, co jest, leży w lmu-zasoby.js.
   Poprawne zapisy nazwisk (z polskimi znakami) są w lmu-kierowcy.js.
   ===================================================================== */
(function () {
'use strict';

var PS  = window.PS;
var CFG = PS.cfg;
var $   = PS.$;
var esc = PS.esc;
var ZAS = window.LMU_ZASOBY || { auta: [], marki: {}, tory: [], tla: [] };

/* ------------------------------------------------------------------
   USTAWIENIA — łatwe do zmiany
------------------------------------------------------------------ */
/* Punkty za miejsce w klasie (regulamin LMU). Kto nie ukończył, nie
   dostaje nic. Inna punktacja = podmiana tej jednej listy. */
var PUNKTY = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/* Klasy: nazwa pokazywana i kolor. Klucz to CarClass z pliku gry. */
var KLASY = {
  'hyper':    { nazwa: 'Hypercar', kolor: '#D8323F', kolejnosc: 1 },
  'hypercar': { nazwa: 'Hypercar', kolor: '#D8323F', kolejnosc: 1 },
  'lmp2':     { nazwa: 'LMP2',     kolor: '#4E9BE0', kolejnosc: 2 },
  'lmp2_elms':{ nazwa: 'LMP2 ELMS',kolor: '#4E9BE0', kolejnosc: 2 },
  'lmp3':     { nazwa: 'LMP3',     kolor: '#9B7BF0', kolejnosc: 3 },
  'gt3':      { nazwa: 'LMGT3',    kolor: '#E9B949', kolejnosc: 4 },
  'lmgt3':    { nazwa: 'LMGT3',    kolor: '#E9B949', kolejnosc: 4 },
  'gte':      { nazwa: 'GTE',      kolor: '#3FBF7F', kolejnosc: 5 }
};

/* Marka z nazwy auta — dłuższe przedrostki najpierw. */
var MARKI = [
  ['Chevrolet Corvette', 'corvette'], ['Corvette', 'corvette'], ['Aston Martin', 'aston-martin'],
  ['Isotta Fraschini', 'isotta-fraschini'], ['Mercedes', 'mercedes-amg'], ['McLaren', 'mclaren'],
  ['Ferrari', 'ferrari'], ['Porsche', 'porsche'], ['Lamborghini', 'lamborghini'], ['BMW', 'bmw'],
  ['Ford', 'ford'], ['Lexus', 'lexus'], ['Toyota', 'toyota'], ['Cadillac', 'cadillac'],
  ['Peugeot', 'peugeot'], ['Alpine', 'alpine'], ['Glickenhaus', 'glickenhaus'], ['Vanwall', 'vanwall'],
  ['Oreca', 'oreca'], ['Ligier', 'ligier'], ['Genesis', 'genesis'], ['Duqueine', 'duqueine'],
  ['Ginetta', 'ginetta'], ['ADESS', 'adess'], ['Chevrolet', 'chevrolet']
];

/* Okrążenie wolniejsze niż 107% najlepszego nie liczy się do równości
   tempa (wyjazd z pitu, obrót, żółta flaga). */
var PROG_TEMPA = 1.07;

var KLUCZ_NAZW = 'ps-lmu-nazwy';

/* pliki: [{ nazwa, dane }], aktywny: indeks pokazywanego pliku */
var stan = { pliki: [], aktywny: -1, zakladka: 'wyniki', nazwy: {} };

function dane () {
  var p = stan.pliki[stan.aktywny];
  return p ? p.dane : null;
}

/* ------------------------------------------------------------------
   POPRAWNE ZAPISY NAZWISK
   Gra zapisuje nazwy tak, jak kierowca wpisał je w profilu — zwykle
   bez polskich znaków. Lista „Michal Krol = Michał Król" podmienia je
   wszędzie: w tabelach, na grafikach, w arkuszu i w klasyfikacji.
------------------------------------------------------------------ */
function parsujNazwy (tekst) {
  var m = {};
  String(tekst || '').split(/\r?\n/).forEach(function (w) {
    w = w.trim();
    if (!w || w.charAt(0) === '#') return;
    var i = w.indexOf('=');
    if (i < 1) return;
    var z = w.slice(0, i).trim(), na = w.slice(i + 1).trim();
    if (z && na && z !== na) m[z.toLowerCase()] = na;
  });
  return m;
}

function nazwyDoTekstu (mapa) {
  return Object.keys(mapa).map(function (k) { return k + ' = ' + mapa[k]; }).join('\n');
}

function nazwa (s) {
  s = String(s || '');
  return stan.nazwy[s.toLowerCase()] || s;
}

/* ------------------------------------------------------------------
   CZYTANIE PLIKU
------------------------------------------------------------------ */
function tekstZ (el, tag) {
  var x = el.getElementsByTagName(tag)[0];
  return x ? (x.textContent || '').trim() : '';
}

function liczba (s) {
  var n = parseFloat(String(s == null ? '' : s).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function klasa (surowa) {
  var k = String(surowa || '').toLowerCase().replace(/\s+/g, '');
  return KLASY[k] || { nazwa: surowa || '—', kolor: '#AEB6C6', kolejnosc: 9 };
}

function marka (typ) {
  var t = String(typ || '').toLowerCase();
  for (var i = 0; i < MARKI.length; i++) {
    if (t.indexOf(MARKI[i][0].toLowerCase()) === 0) return MARKI[i][1];
  }
  return '';
}

/* „TF Sport 2025 #33:LM" -> „TF Sport" */
function zespol (vehName) {
  return String(vehName || '')
    .replace(/\s+#\d+.*$/, '')
    .replace(/\s+(19|20)\d{2}\b.*$/, '')
    .trim();
}

/* „Chevrolet Corvette Z06 LMGT3.R" -> „Chevrolet Corvette Z06" */
function model (carType) {
  return String(carType || '')
    .replace(/\s+(LMGT3|GT3|LMP2|LMP3|LMH|LMDh|Hypercar)(\.R)?(\s+Evo\d?)?\s*$/i, '')
    .trim() || carType;
}

/* Klucz toru z ścieżki w pliku: …\Locations\PortimaoWEC_2023\… -> portimaowec */
function kluczToru (trackData, venue) {
  var m = /Locations[\\\/]+([A-Za-z]+?)(?:_\d{4})?[\\\/]/.exec(trackData || '');
  var k = m ? m[1].toLowerCase() : '';
  if (k && ZAS.tory.indexOf(k) > -1) return k;

  var slowo = String(venue || '').toLowerCase().split(/[^a-z]+/).filter(Boolean)[0] || '';
  for (var i = 0; i < ZAS.tory.length; i++) {
    if (slowo && ZAS.tory[i].indexOf(slowo) === 0) return ZAS.tory[i];
  }
  return k;
}

/* Okrążenia kierowcy: pozycja, sektory, prędkość, opony, pit. */
function okrazenia (el) {
  var ll = el.getElementsByTagName('Lap'), out = [];
  for (var i = 0; i < ll.length; i++) {
    var l = ll[i];
    out.push({
      n: parseInt(l.getAttribute('num'), 10) || i + 1,
      p: parseInt(l.getAttribute('p'), 10) || null,
      et: liczba(l.getAttribute('et')),
      s1: liczba(l.getAttribute('s1')),
      s2: liczba(l.getAttribute('s2')),
      s3: liczba(l.getAttribute('s3')),
      t: liczba(l.textContent),                 /* „--.----" = okrążenie bez czasu */
      v: liczba(l.getAttribute('topspeed')),
      pit: l.getAttribute('pit') === '1',
      opony: String(l.getAttribute('fcompound') || '').split(',')[1] || ''
    });
  }
  return out;
}

/* Dziennik sesji: kontakty, limity toru, kary, czat. Imię w dzienniku
   ma dopisany numer gracza w nawiasie — „Michal Sas(3)". */
function dziennik (sesja) {
  var z = { kontakty: [], limity: [], kary: [], czat: [] };
  var st = sesja.getElementsByTagName('Stream')[0];
  if (!st) return z;

  var widziane = {};
  var ii = st.getElementsByTagName('Incident');
  for (var i = 0; i < ii.length; i++) {
    var t = ii[i].textContent || '';
    var et = liczba(ii[i].getAttribute('et'));
    var m = /^(.+?)\(\d+\) reported contact \(([\d.]+)\) with (?:another vehicle (.+?)\(\d+\)|(.+))$/.exec(t.trim());
    if (!m) continue;
    var kto = m[1].trim(), sila = liczba(m[2]), z2 = m[3] ? m[3].trim() : '';
    /* obaj uczestnicy zgłaszają ten sam kontakt — liczymy go raz */
    var klucz = z2 ? [kto, z2].sort().join('|') + '@' + Math.round(et) : kto + '#' + Math.round(et);
    if (widziane[klucz]) { widziane[klucz].sila = Math.max(widziane[klucz].sila, sila || 0); continue; }
    var k = { et: et, kto: kto, z: z2, sciana: !z2, sila: sila || 0 };
    widziane[klucz] = k;
    z.kontakty.push(k);
  }

  var tl = st.getElementsByTagName('TrackLimits');
  for (var j = 0; j < tl.length; j++) {
    z.limity.push({
      et: liczba(tl[j].getAttribute('et')),
      kto: tl[j].getAttribute('Driver') || '',
      okr: parseInt(tl[j].getAttribute('Lap'), 10),
      punkty: liczba(tl[j].getAttribute('CurrentPoints')) || 0,
      decyzja: (tl[j].textContent || '').trim()
    });
  }

  var kk = st.getElementsByTagName('Penalty');
  for (var p = 0; p < kk.length; p++) {
    z.kary.push({
      et: liczba(kk[p].getAttribute('et')),
      kto: kk[p].getAttribute('Driver') || '',
      rodzaj: kk[p].getAttribute('Penalty') || '',
      powod: kk[p].getAttribute('Reason') || ''
    });
  }

  var cc = st.getElementsByTagName('ChatMessage');
  for (var c = 0; c < cc.length; c++) {
    z.czat.push({ et: liczba(cc[c].getAttribute('et')), tekst: (cc[c].textContent || '').trim() });
  }
  return z;
}

/* Odchylenie standardowe — „równość" tempa. */
function odchylenie (xs) {
  if (xs.length < 3) return null;
  var sr = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  var w = xs.reduce(function (a, b) { return a + (b - sr) * (b - sr); }, 0) / xs.length;
  return Math.sqrt(w);
}

function minimum (xs) {
  var m = null;
  xs.forEach(function (x) { if (x != null && (m == null || x < m)) m = x; });
  return m;
}

function statystyki (k) {
  var ll = k.laps;
  k.sektory = [minimum(ll.map(function (l) { return l.s1; })),
               minimum(ll.map(function (l) { return l.s2; })),
               minimum(ll.map(function (l) { return l.s3; }))];
  k.idealne = k.sektory[0] && k.sektory[1] && k.sektory[2]
    ? k.sektory[0] + k.sektory[1] + k.sektory[2] : null;
  var vv = ll.map(function (l) { return l.v; }).filter(function (v) { return v; });
  k.vmax = vv.length ? Math.max.apply(null, vv) : null;

  var najl = k.najlepsze;
  var czyste = ll.filter(function (l) {
    return l.t && l.n > 1 && !l.pit && najl && l.t <= najl * PROG_TEMPA;
  }).map(function (l) { return l.t; });
  k.rownosc = odchylenie(czyste);
  k.okrCzyste = czyste.length;
  k.opony = ll.length ? ll[ll.length - 1].opony : '';
}

function parsuj (tekst) {
  /* Plik zaczyna się deklaracją DTD, która w przeglądarce potrafi
     zablokować parser — wycinamy ją, niczego nie zawiera. */
  tekst = String(tekst).replace(/<!DOCTYPE[\s\S]*?\]>/i, '');
  var doc = new DOMParser().parseFromString(tekst, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('To nie jest poprawny plik XML.');

  var rr = doc.getElementsByTagName('RaceResults')[0];
  if (!rr) throw new Error('W pliku nie ma wyników (brak sekcji RaceResults).');

  /* Sesja: wyścig, a jeśli go nie ma — kwalifikacje albo trening. */
  var sesja = null, rodzaj = '';
  var nazwy = [['Race', 'Wyścig'], ['Race2', 'Wyścig 2'], ['Qualify', 'Kwalifikacje'],
               ['Practice1', 'Trening'], ['Warmup', 'Rozgrzewka']];
  for (var i = 0; i < nazwy.length && !sesja; i++) {
    var s = rr.getElementsByTagName(nazwy[i][0])[0];
    if (s && s.getElementsByTagName('Driver').length) { sesja = s; rodzaj = nazwy[i][1]; }
  }
  if (!sesja) throw new Error('Plik nie zawiera żadnej sesji z kierowcami.');
  var wyscig = rodzaj.indexOf('Wyścig') === 0;

  var zd = dziennik(sesja);

  var dd = sesja.getElementsByTagName('Driver');
  var kierowcy = [];
  for (var d = 0; d < dd.length; d++) {
    var el = dd[d];
    var imie = tekstZ(el, 'Name');
    var typ = tekstZ(el, 'CarType');
    var status = tekstZ(el, 'FinishStatus');
    var k = {
      poz: parseInt(tekstZ(el, 'Position'), 10) || 999,
      pozKlasa: parseInt(tekstZ(el, 'ClassPosition'), 10) || 999,
      start: parseInt(tekstZ(el, 'GridPos'), 10) || null,
      startKlasa: parseInt(tekstZ(el, 'ClassGridPos'), 10) || null,
      klasaId: tekstZ(el, 'CarClass'),
      nr: tekstZ(el, 'CarNumber'),
      nazwa: imie.replace(/#\d+$/, '').trim(),
      nazwaPliku: imie,
      zespol: zespol(tekstZ(el, 'VehName')),
      auto: model(typ),
      autoPelne: typ,
      marka: marka(typ),
      veh: tekstZ(el, 'VehFile').replace(/\.veh$/i, ''),
      okr: parseInt(tekstZ(el, 'Laps'), 10) || 0,
      najlepsze: liczba(tekstZ(el, 'BestLapTime')),
      czas: liczba(tekstZ(el, 'FinishTime')),
      pit: parseInt(tekstZ(el, 'Pitstops'), 10) || 0,
      ukonczyl: /finished/i.test(status),
      status: /finished/i.test(status) ? '' : (/dq|disq/i.test(status) ? 'DSQ' : 'DNF'),
      laps: okrazenia(el)
    };
    k.kary = zd.kary.filter(function (x) { return x.kto === imie; });
    k.kontakty = zd.kontakty.filter(function (x) { return !x.sciana && (x.kto === imie || x.z === imie); }).length;
    k.sciana = zd.kontakty.filter(function (x) { return x.sciana && x.kto === imie; }).length;
    /* Limity toru: gra zgłasza każde wyjechanie, ale większość kończy się
       „No Further Action". Liczymy ostrzeżenia i najwyższy stan punktów. */
    var lim = zd.limity.filter(function (x) { return x.kto === imie; });
    k.limity = lim.filter(function (x) { return !/no further action/i.test(x.decyzja); }).length;
    k.limityPkt = lim.reduce(function (m, x) { return Math.max(m, x.punkty); }, 0);
    statystyki(k);
    kierowcy.push(k);
  }
  kierowcy.sort(function (a, b) { return a.poz - b.poz; });

  /* Klasy w kolejności: Hypercar, LMP2, LMGT3… */
  var klasy = {};
  kierowcy.forEach(function (k) {
    var info = klasa(k.klasaId);
    if (!klasy[info.nazwa]) klasy[info.nazwa] = { nazwa: info.nazwa, kolor: info.kolor, kolejnosc: info.kolejnosc, kierowcy: [] };
    klasy[info.nazwa].kierowcy.push(k);
    k.klasa = info.nazwa;
  });
  var listaKlas = Object.keys(klasy).map(function (n) { return klasy[n]; })
    .sort(function (a, b) { return a.kolejnosc - b.kolejnosc; });

  /* Straty, punkty i rekordy liczymy w obrębie klasy. */
  listaKlas.forEach(function (kl) {
    kl.kierowcy.sort(function (a, b) { return a.pozKlasa - b.pozKlasa; });
    var lider = kl.kierowcy[0];
    var ks = kl.kierowcy;
    kl.najl = minimum(ks.map(function (k) { return k.najlepsze; }));
    kl.sektory = [0, 1, 2].map(function (i) { return minimum(ks.map(function (k) { return k.sektory[i]; })); });
    kl.idealne = minimum(ks.map(function (k) { return k.idealne; }));
    var vv = ks.map(function (k) { return k.vmax; }).filter(Boolean);
    kl.vmax = vv.length ? Math.max.apply(null, vv) : null;

    ks.forEach(function (k, i) {
      k.najszybszy = !!(kl.najl && k.najlepsze === kl.najl);
      k.punkty = (wyscig && k.ukonczyl && i < PUNKTY.length) ? PUNKTY[i] : 0;
      k.zyskane = (wyscig && k.ukonczyl && k.startKlasa) ? k.startKlasa - k.pozKlasa : null;

      if (!wyscig) {
        k.strata = k === lider ? '' : (k.najlepsze && lider.najlepsze ? '+' + sekundy(k.najlepsze - lider.najlepsze) : '');
      } else if (!k.ukonczyl || k === lider) {
        k.strata = '';
      } else if (k.okr < lider.okr) {
        k.strata = '+' + (lider.okr - k.okr) + ' okr.';
      } else if (k.czas && lider.czas) {
        k.strata = '+' + sekundy(k.czas - lider.czas);
      } else {
        k.strata = '';
      }
    });

    /* Pozycja w klasie po każdym okrążeniu — do wykresu przebiegu.
       Gra zapisuje pozycję w całej stawce; w klasie ustawiamy według niej. */
    var maks = 0;
    ks.forEach(function (k) { k.przebieg = [k.startKlasa]; maks = Math.max(maks, k.laps.length); });
    for (var n = 1; n <= maks; n++) {
      var na = ks.filter(function (k) { return k.laps[n - 1] && k.laps[n - 1].p; })
                 .sort(function (a, b) { return a.laps[n - 1].p - b.laps[n - 1].p; });
      na.forEach(function (k, i) { k.przebieg[n] = i + 1; });
    }
    kl.maksOkr = maks;
  });

  var trackData = tekstZ(rr, 'TrackData');
  var venue = tekstZ(rr, 'TrackVenue');
  var ts = parseInt(tekstZ(sesja, 'DateTime') || tekstZ(rr, 'DateTime'), 10);

  /* Dla zdarzeń: okrążenie, na którym się wydarzyły (wg lidera stawki). */
  var etLidera = (kierowcy[0] && kierowcy[0].laps || []).map(function (l) { return l.et; });
  function okrZ (et) {
    for (var i = 0; i < etLidera.length; i++) if (etLidera[i] >= et) return i + 1;
    return etLidera.length || null;
  }
  zd.kontakty.forEach(function (x) { x.okr = okrZ(x.et); });
  zd.kary.forEach(function (x) { x.okr = okrZ(x.et); });

  return {
    rodzaj: rodzaj,
    wyscig: wyscig,
    tor: {
      nazwa: venue,
      wydarzenie: tekstZ(rr, 'TrackEvent'),
      klucz: kluczToru(trackData, venue),
      dlugosc: liczba(tekstZ(rr, 'TrackLength'))
    },
    data: ts ? new Date(ts * 1000) : null,
    minuty: parseInt(tekstZ(sesja, 'Minutes'), 10) || null,
    najwiecejOkr: parseInt(tekstZ(sesja, 'MostLapsCompleted'), 10) || null,
    kierowcy: kierowcy,
    klasy: listaKlas,
    zdarzenia: zd
  };
}

/* ------------------------------------------------------------------
   WYRÓŻNIENIA — cztery kafelki nad tabelą i na grafice
------------------------------------------------------------------ */
function nagrody (d) {
  var ks = d.kierowcy, out = [];
  var wiele = d.klasy.length > 1;

  var sz = null;
  ks.forEach(function (k) { if (k.najlepsze && (!sz || k.najlepsze < sz.najlepsze)) sz = k; });
  if (sz) out.push({ etyk: 'Najszybsze okrążenie', kto: sz, wartosc: czas(sz.najlepsze) + (wiele ? ' · ' + sz.klasa : '') });

  if (d.wyscig) {
    var zy = null;
    ks.forEach(function (k) {
      if (k.zyskane > 0 && (!zy || k.zyskane > zy.zyskane || (k.zyskane === zy.zyskane && k.poz < zy.poz))) zy = k;
    });
    if (zy) out.push({ etyk: 'Najwięcej zyskanych pozycji', kto: zy, wartosc: '+' + zy.zyskane + '  ·  P' + zy.startKlasa + ' → P' + zy.pozKlasa });
  }

  var vm = null;
  ks.forEach(function (k) { if (k.vmax && (!vm || k.vmax > vm.vmax)) vm = k; });
  if (vm) out.push({ etyk: 'Prędkość maksymalna', kto: vm, wartosc: vm.vmax.toFixed(1).replace('.', ',') + ' km/h' });

  if (d.wyscig) {
    /* Najczystszy: ukończył, najmniej kontaktów, potem limitów, potem
       wyższe miejsce. Bez żadnego kontaktu — inaczej kafelek znika. */
    var cz = ks.filter(function (k) { return k.ukonczyl && k.kontakty + k.sciana === 0 && !k.kary.length; })
      .sort(function (a, b) { return (a.limityPkt - b.limityPkt) || (a.limity - b.limity) || (a.poz - b.poz); })[0];
    if (cz) out.push({ etyk: 'Najczystszy przejazd', kto: cz,
      wartosc: '0 kontaktów  ·  ' + (cz.limityPkt ? 'limity toru: ' + pkt(cz.limityPkt) + ' pkt' : 'bez punktów za limity') });
  }
  return out;
}

/* ------------------------------------------------------------------
   FORMATOWANIE
------------------------------------------------------------------ */
function dwa (n) { return (n < 10 ? '0' : '') + n; }

/* 114.6198 -> 1:54.620 ; 2793.0974 -> 46:33.097 ; ponad godzina -> 1:02:03.456 */
function czas (s) {
  if (s == null) return '';
  var ms = Math.round(s * 1000);
  var h = Math.floor(ms / 3600000); ms -= h * 3600000;
  var m = Math.floor(ms / 60000);   ms -= m * 60000;
  var sek = Math.floor(ms / 1000);  ms -= sek * 1000;
  var reszta = dwa(sek) + '.' + ('00' + ms).slice(-3);
  return h ? h + ':' + dwa(m) + ':' + reszta : m + ':' + reszta;
}

/* Strata: poniżej minuty same sekundy („12.840"), wyżej jak czas. */
function sekundy (s) {
  if (s == null) return '';
  return s < 60 ? s.toFixed(3) : czas(s);
}

function dataTekst (d) {
  if (!d) return '';
  try {
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return d.toISOString().slice(0, 10); }
}

function pkt (n) { return String(Math.round(n * 100) / 100).replace('.', ','); }

function dataKropki (d) {
  return d ? dwa(d.getDate()) + '.' + dwa(d.getMonth() + 1) + '.' + d.getFullYear() : '';
}

function obrazAuta (veh) {
  return ZAS.auta.indexOf(veh) > -1 ? 'assets/img/lmu/auta/' + veh + '.webp' : '';
}
function obrazMarki (m) {
  return m && ZAS.marki[m] ? 'assets/img/lmu/marki/' + ZAS.marki[m] : '';
}
function obrazTla (d) {
  return d.tor.klucz && ZAS.tla.indexOf(d.tor.klucz) > -1 ? 'assets/img/lmu/tory/' + d.tor.klucz + '-tlo.webp' : '';
}
function obrazToru (d) {
  return d.tor.klucz && ZAS.tory.indexOf(d.tor.klucz) > -1 ? 'assets/img/lmu/tory/' + d.tor.klucz + '.svg' : '';
}

/* ------------------------------------------------------------------
   RUNDY Z KALENDARZA
------------------------------------------------------------------ */
function rundyLmu () {
  return PS.rounds().filter(function (r) { return r.series === 'lmu'; });
}

/* Runda najbliższa dacie z pliku (wyścig odbywa się w dniu rundy). */
function dopasujRunde (data) {
  var lista = rundyLmu();
  if (!data || !lista.length) return -1;
  var best = -1, roznica = Infinity;
  lista.forEach(function (r, i) {
    if (!r.start) return;
    var d = Math.abs(r.start.getTime() - data.getTime());
    if (d < roznica) { roznica = d; best = i; }
  });
  return roznica < 4 * 86400000 ? best : -1;
}

function wybranaRunda () {
  var sel = $('#lmuRunda');
  return rundyLmu()[sel ? parseInt(sel.value, 10) : -1] || null;
}

/* „R3 | JAPONIA | 30.10.2026" — jak na plakatach ligi. */
function znacznikRundy (d) {
  var r = wybranaRunda();
  if (!r) return dataKropki(d.data);
  var kraj = String(r.name || '').split(/\s+[—–-]\s+/)[0];
  return 'R' + r.n + '  |  ' + kraj.toUpperCase() + '  |  ' + dataKropki(r.start || d.data);
}

function tytulDomyslny (d) {
  return d ? (d.tor.wydarzenie || d.tor.nazwa) : '';
}

function metaTekst (d) {
  return [d.tor.nazwa, dataTekst(d.data), d.rodzaj, d.minuty ? d.minuty + ' min' : '',
          d.najwiecejOkr ? d.najwiecejOkr + ' okr.' : ''].filter(Boolean);
}

/* ------------------------------------------------------------------
   KLASYFIKACJA SEZONU — z wszystkich wczytanych wyścigów
------------------------------------------------------------------ */
function sezon () {
  var wyscigi = stan.pliki.filter(function (p) { return p.dane.wyscig; })
    .slice().sort(function (a, b) { return (a.dane.data || 0) - (b.dane.data || 0); });

  var lista = rundyLmu();
  var rundy = wyscigi.map(function (p, i) {
    var idx = dopasujRunde(p.dane.data);
    var r = lista[idx];
    return {
      n: r ? r.n : i + 1,
      nazwa: r ? String(r.name).split(/\s+[—–-]\s+/)[0] : (p.dane.tor.nazwa || p.nazwa),
      tor: p.dane.tor.nazwa,
      dane: p.dane
    };
  });

  var klasy = {};
  rundy.forEach(function (r, ri) {
    r.dane.klasy.forEach(function (kl) {
      var K = klasy[kl.nazwa] = klasy[kl.nazwa] || { nazwa: kl.nazwa, kolor: kl.kolor, kolejnosc: kl.kolejnosc, kto: {} };
      kl.kierowcy.forEach(function (k) {
        var klucz = nazwa(k.nazwa).toLowerCase();
        var o = K.kto[klucz] = K.kto[klucz] || { nazwa: nazwa(k.nazwa), punkty: [], suma: 0, wygrane: 0, podia: 0, najlepsze: 999 };
        o.zespol = nazwa(k.zespol); o.nr = k.nr; o.veh = k.veh; o.marka = k.marka; o.auto = k.auto;
        o.punkty[ri] = k.ukonczyl ? k.punkty : null;
        o.dnf = o.dnf || [];
        o.dnf[ri] = !k.ukonczyl;
        o.suma += k.punkty;
        if (k.ukonczyl && k.pozKlasa === 1) o.wygrane++;
        if (k.ukonczyl && k.pozKlasa <= 3) o.podia++;
        if (k.ukonczyl) o.najlepsze = Math.min(o.najlepsze, k.pozKlasa);
      });
    });
  });

  var listaKlas = Object.keys(klasy).map(function (n) {
    var K = klasy[n];
    K.kierowcy = Object.keys(K.kto).map(function (k) { return K.kto[k]; })
      .sort(function (a, b) {
        return (b.suma - a.suma) || (b.wygrane - a.wygrane) || (b.podia - a.podia) || (a.najlepsze - b.najlepsze);
      });
    K.kierowcy.forEach(function (o, i, arr) {
      o.poz = i && arr[i - 1].suma === o.suma && arr[i - 1].wygrane === o.wygrane && arr[i - 1].podia === o.podia
        ? arr[i - 1].poz : i + 1;
      o.strata = i ? o.suma - arr[0].suma : 0;
    });
    return K;
  }).sort(function (a, b) { return a.kolejnosc - b.kolejnosc; });

  return { rundy: rundy, klasy: listaKlas };
}

/* ------------------------------------------------------------------
   STRONA — BANER
------------------------------------------------------------------ */
function htmlBaner (d, tytul, znacznik) {
  var tlo = obrazTla(d), logo = obrazToru(d);
  return '<header class="lmu-baner"' +
    /* Pełny adres, bo url() w zmiennej CSS liczy się od pliku stylów,
       a nie od strony — ścieżka względna trafiałaby w assets/css/. */
    (tlo ? ' style="--tlo:url(\'' + new URL(tlo, location.href).href + '\')"' : '') + '>' +
    '<div class="lmu-baner__tekst">' +
      '<h2 class="lmu-baner__tytul">' + esc(tytul) + '</h2>' +
      '<p class="mono lmu-baner__meta">' + metaTekst(d).map(esc).join(' · ') + '</p>' +
    '</div>' +
    '<div class="lmu-baner__panel">' +
      (logo ? '<img class="lmu-baner__tor" src="' + logo + '" alt="">' : '') +
      '<p class="mono lmu-baner__seria">' + esc($('#lmuSeria').value) + '</p>' +
      '<p class="lmu-baner__runda">' + esc(znacznik) + '</p>' +
    '</div>' +
  '</header>';
}

function htmlNagrody (d) {
  var nn = nagrody(d);
  if (!nn.length) return '';
  return '<div class="lmu-nagrody">' + nn.map(function (n) {
    return '<div class="lmu-nagroda">' +
      '<span class="mono lmu-nagroda__etyk">' + esc(n.etyk) + '</span>' +
      '<span class="lmu-nagroda__kto">' + esc(nazwa(n.kto.nazwa)) + '</span>' +
      '<span class="mono lmu-nagroda__war">' + esc(n.wartosc) + '</span>' +
    '</div>';
  }).join('') + '</div>';
}

function htmlKlasa (kl, tresc, dopisek) {
  return '<section class="lmu-klasa" style="--klasa:' + kl.kolor + '">' +
    '<h3 class="lmu-klasa__tytul"><span>' + esc(kl.nazwa) + '</span>' +
      '<span class="mono dim">' + esc(dopisek) + '</span></h3>' + tresc + '</section>';
}

function htmlZmiana (k) {
  if (k.zyskane == null || k.zyskane === 0) return '';
  var w = k.zyskane > 0;
  return '<span class="lmu-zmiana ' + (w ? 'is-w' : 'is-n') + '" title="Start: P' + k.startKlasa + '">' +
    (w ? '▲' : '▼') + Math.abs(k.zyskane) + '</span>';
}

/* ------------------------------------------------------------------
   ZAKŁADKA: WYNIKI
------------------------------------------------------------------ */
function htmlWyniki (d) {
  var punkty = $('#lmuPunkty').checked && d.wyscig;
  var html = $('#lmuNagrodyCh').checked ? htmlNagrody(d) : '';

  d.klasy.forEach(function (kl) {
    html += htmlKlasa(kl,
      '<div class="tbl-wrap"><table class="lmu-tab"><thead><tr>' +
        '<th class="th-pos">Poz</th><th>Nr</th><th>Kierowca</th><th>Auto</th>' +
        '<th class="th-num">Okr.</th><th class="th-num">Czas / strata</th>' +
        '<th class="th-num">Najlepsze</th><th class="th-num">Pit</th>' +
        (punkty ? '<th class="th-pts">Pkt</th>' : '') +
      '</tr></thead><tbody>' +
      kl.kierowcy.map(function (k, i) {
        var auto = obrazAuta(k.veh);
        var mk = obrazMarki(k.marka);
        var wynik = k.status
          ? '<span class="lmu-status">' + k.status + '</span>'
          : (i === 0 ? czas(k.czas) : esc(k.strata));
        var kara = k.kary.length
          ? ' <span class="lmu-kara" title="' + esc(k.kary.map(function (x) { return x.rodzaj + ' — ' + x.powod; }).join('; ')) + '">kara</span>'
          : '';
        return '<tr class="' + (i < 3 && !k.status ? 'r' + (i + 1) : '') + (k.status ? ' is-dnf' : '') + '">' +
          '<td class="pos">' + (k.status ? '—' : k.pozKlasa) + htmlZmiana(k) + '</td>' +
          '<td><span class="lmu-nr">' + esc(k.nr) + '</span></td>' +
          '<td class="drv"><span class="lmu-kto">' + esc(nazwa(k.nazwa)) + kara + '</span>' +
            '<span class="lmu-zespol">' + esc(nazwa(k.zespol)) + '</span></td>' +
          '<td class="lmu-auto mach">' +
            (auto ? '<img src="' + auto + '" alt="" loading="lazy">' : '') +
            (mk ? '<img class="lmu-marka" src="' + mk + '" alt="">' : '') +
            '<span class="lmu-model">' + esc(k.auto) + '</span></td>' +
          '<td class="num" data-label="Okr.">' + k.okr + '</td>' +
          '<td class="num lmu-czas" data-label="Czas">' + wynik + '</td>' +
          '<td data-label="Najl." class="num' + (k.najszybszy ? ' lmu-najl' : '') + '">' + czas(k.najlepsze) + '</td>' +
          '<td class="num" data-label="Pit">' + k.pit + '</td>' +
          (punkty ? '<td class="pts" data-label="Pkt">' + (k.punkty || '') + '</td>' : '') +
        '</tr>';
      }).join('') +
      '</tbody></table></div>', kl.kierowcy.length + ' aut');
  });
  return html;
}

/* ------------------------------------------------------------------
   ZAKŁADKA: PRZEBIEG — pozycja w klasie po każdym okrążeniu
------------------------------------------------------------------ */
/* Kolory linii: kolejne odcienie co „złoty kąt", żeby sąsiednie
   pozycje nie dostały podobnych barw. */
function kolorLinii (i) {
  return 'hsl(' + Math.round((i * 137.508 + 25) % 360) + ' 72% 62%)';
}

function wykresPrzebiegu (kl) {
  var ks = kl.kierowcy, n = ks.length, L = Math.max(kl.maksOkr, 1);
  var W = 1100, WIERSZ = 26, lewo = 44, prawo = 230, gora = 18, dol = 34;
  var H = gora + dol + Math.max(n - 1, 1) * WIERSZ;
  function x (l) { return lewo + l * (W - lewo - prawo) / L; }
  function y (p) { return gora + (p - 1) * WIERSZ; }

  var s = '<svg class="lmu-wykres" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Pozycje w klasie ' + esc(kl.nazwa) + ' na kolejnych okrążeniach">';
  for (var p = 1; p <= n; p++) {
    s += '<line class="lmu-wykres__siatka" x1="' + lewo + '" x2="' + (W - prawo) + '" y1="' + y(p) + '" y2="' + y(p) + '"/>' +
         '<text class="lmu-wykres__os" x="' + (lewo - 12) + '" y="' + (y(p) + 4) + '" text-anchor="end">' + p + '</text>';
  }
  var krok = L > 40 ? 10 : 5;
  for (var l = 0; l <= L; l += krok) {
    s += '<text class="lmu-wykres__os" x="' + x(l) + '" y="' + (H - 10) + '" text-anchor="middle">' + (l === 0 ? 'START' : l) + '</text>';
  }

  ks.forEach(function (k, i) {
    var pkt = [];
    k.przebieg.forEach(function (pp, l) { if (pp) pkt.push(x(l).toFixed(1) + ',' + y(pp).toFixed(1)); });
    if (!pkt.length) return;
    var ost = k.przebieg.length - 1;
    while (ost > 0 && !k.przebieg[ost]) ost--;
    var kol = kolorLinii(i);
    s += '<g class="lmu-linia' + (k.ukonczyl ? '' : ' is-dnf') + '" style="--k:' + kol + '">' +
      '<title>' + esc(nazwa(k.nazwa)) + ' — start P' + (k.startKlasa || '?') + ', meta ' + (k.ukonczyl ? 'P' + k.pozKlasa : k.status) + '</title>' +
      '<polyline points="' + pkt.join(' ') + '"/>' +
      (k.ukonczyl ? '' : '<text class="lmu-linia__x" x="' + x(ost) + '" y="' + (y(k.przebieg[ost]) + 5) + '" text-anchor="middle">✕</text>') +
      '<text class="lmu-linia__kto" x="' + (W - prawo + 12) + '" y="' + (y(k.ukonczyl ? k.pozKlasa : k.przebieg[ost]) + 4) + '">' +
        (k.ukonczyl ? k.pozKlasa + '. ' : '✕ ') + esc(nazwa(k.nazwa)) + '</text>' +
    '</g>';
  });
  return s + '</svg>';
}

function htmlPrzebieg (d) {
  if (!d.wyscig) return '<p class="notice">Przebieg pokazujemy tylko dla wyścigu.</p>';
  var html = '<p class="lmu-opis dim">Pozycja w klasie po każdym okrążeniu. Najedź na linię, żeby ją wyróżnić. ✕ — koniec jazdy.</p>';
  d.klasy.forEach(function (kl) {
    html += htmlKlasa(kl, '<div class="lmu-wykres-wrap">' + wykresPrzebiegu(kl) + '</div>', kl.maksOkr + ' okr.');
  });
  return html;
}

/* ------------------------------------------------------------------
   ZAKŁADKA: OKRĄŻENIA I SEKTORY
------------------------------------------------------------------ */
function iskra (k) {
  var ll = k.laps.filter(function (l) { return l.t; });
  if (ll.length < 2 || !k.najlepsze) return '';
  var W = 150, H = 30, gorny = k.najlepsze * 1.08;
  function x (i) { return (i / (k.laps.length - 1 || 1)) * (W - 4) + 2; }
  function y (t) { return 2 + (Math.min(t, gorny) - k.najlepsze) / (gorny - k.najlepsze) * (H - 4); }
  var pkt = [], pity = '';
  k.laps.forEach(function (l, i) {
    if (l.t) pkt.push(x(i).toFixed(1) + ',' + y(l.t).toFixed(1));
    if (l.pit) pity += '<line x1="' + x(i) + '" x2="' + x(i) + '" y1="0" y2="' + H + '" class="lmu-iskra__pit"/>';
  });
  return '<svg class="lmu-iskra" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + pity +
    '<polyline points="' + pkt.join(' ') + '"/></svg>';
}

function komorkaRekord (war, rekord, tekst, etyk) {
  return '<td data-label="' + etyk + '" class="num' + (war != null && war === rekord ? ' lmu-fiolet' : '') + '">' + (war != null ? tekst : '—') + '</td>';
}

function htmlOkrazenia (d) {
  var html = '<p class="lmu-opis dim">Fioletowe — najlepsze w klasie. Idealne okrążenie to suma najlepszych sektorów. ' +
    'Równość: odchylenie czasów okrążeń bez pierwszego, pit stopów i okrążeń wolniejszych o ponad 7%. Wykres: czasy kolejnych okrążeń (niżej = szybciej), kreski — pit stop.</p>';
  d.klasy.forEach(function (kl) {
    var najRown = minimum(kl.kierowcy.map(function (k) { return k.okrCzyste >= 5 ? k.rownosc : null; }));
    html += htmlKlasa(kl,
      '<div class="tbl-wrap"><table class="lmu-tab lmu-tab--staty"><thead><tr>' +
        '<th class="th-pos">Poz</th><th>Kierowca</th>' +
        '<th class="th-num">S1</th><th class="th-num">S2</th><th class="th-num">S3</th>' +
        '<th class="th-num">Idealne</th><th class="th-num">Najlepsze</th>' +
        '<th class="th-num">Równość</th><th class="th-num">V max</th><th>Tempo</th>' +
      '</tr></thead><tbody>' +
      kl.kierowcy.map(function (k) {
        return '<tr class="' + (k.status ? 'is-dnf' : '') + '">' +
          '<td class="pos">' + (k.status ? '—' : k.pozKlasa) + '</td>' +
          '<td class="drv"><span class="lmu-kto">' + esc(nazwa(k.nazwa)) + '</span>' +
            '<span class="lmu-zespol">' + esc(k.auto) + '</span></td>' +
          komorkaRekord(k.sektory[0], kl.sektory[0], sekundy(k.sektory[0]), 'S1') +
          komorkaRekord(k.sektory[1], kl.sektory[1], sekundy(k.sektory[1]), 'S2') +
          komorkaRekord(k.sektory[2], kl.sektory[2], sekundy(k.sektory[2]), 'S3') +
          komorkaRekord(k.idealne, kl.idealne, czas(k.idealne), 'Idealne') +
          komorkaRekord(k.najlepsze, kl.najl, czas(k.najlepsze), 'Najl.') +
          komorkaRekord(k.okrCzyste >= 5 ? k.rownosc : null, najRown, '±' + (k.rownosc || 0).toFixed(3), 'Równość') +
          komorkaRekord(k.vmax, kl.vmax, k.vmax ? k.vmax.toFixed(1) : '', 'Vmax') +
          '<td class="mach">' + iskra(k) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>', 'Tor: ' + (d.tor.dlugosc ? (d.tor.dlugosc / 1000).toFixed(3).replace('.', ',') + ' km' : '—'));
  });
  return html;
}

/* ------------------------------------------------------------------
   ZAKŁADKA: INCYDENTY
------------------------------------------------------------------ */
function htmlIncydenty (d) {
  var zd = d.zdarzenia;
  var ks = d.kierowcy.slice().sort(function (a, b) {
    return (b.kontakty + b.sciana + b.kary.length) - (a.kontakty + a.sciana + a.kary.length) || b.limityPkt - a.limityPkt || a.poz - b.poz;
  });

  var html = '<p class="lmu-opis dim">Z dziennika gry. Kontakt dwóch aut liczy się raz dla obu kierowców. ' +
    'Limity toru: ostrzeżenia od sędziego gry i najwyższy stan punktów karnych za wyjazdy (gra je zbiera i po przekroczeniu progu daje karę).</p>' +
    '<div class="tbl-wrap"><table class="lmu-tab lmu-tab--staty"><thead><tr>' +
      '<th>Kierowca</th><th class="th-num">Kontakty z autami</th><th class="th-num">Ściana / bariera</th>' +
      '<th class="th-num">Ostrzeżenia</th><th class="th-num">Pkt limitów</th><th>Kary</th>' +
    '</tr></thead><tbody>' +
    ks.map(function (k) {
      return '<tr><td class="drv"><span class="lmu-kto">' + esc(nazwa(k.nazwa)) + '</span>' +
          '<span class="lmu-zespol">' + esc(k.klasa) + ' · ' + (k.status || 'P' + k.pozKlasa) + '</span></td>' +
        '<td class="num" data-label="Kontakty">' + (k.kontakty || '·') + '</td>' +
        '<td class="num" data-label="Ściana">' + (k.sciana || '·') + '</td>' +
        '<td class="num" data-label="Ostrzeżenia">' + (k.limity || '·') + '</td>' +
        '<td class="num" data-label="Pkt limitów">' + (k.limityPkt ? pkt(k.limityPkt) : '·') + '</td>' +
        '<td class="team" data-label="Kary">' + (k.kary.map(function (x) { return esc(x.rodzaj + ' — ' + x.powod); }).join('<br>') || '<span class="dim">—</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>';

  var lista = zd.kontakty.map(function (x) {
    return { et: x.et, okr: x.okr, typ: x.sciana ? 'Ściana' : 'Kontakt',
      opis: esc(nazwa(x.kto)) + (x.sciana ? '' : ' ↔ ' + esc(nazwa(x.z))),
      dop: 'siła ' + Math.round(x.sila), mocny: x.sila >= 1500 };
  }).concat(zd.kary.map(function (x) {
    return { et: x.et, okr: x.okr, typ: 'Kara', opis: esc(nazwa(x.kto)), dop: esc(x.rodzaj + ' — ' + x.powod), kara: true };
  })).sort(function (a, b) { return a.et - b.et; });

  html += '<h3 class="lmu-sekcja">Przebieg zdarzeń</h3>';
  html += lista.length ? '<ol class="lmu-zdarz">' + lista.map(function (z) {
    return '<li class="' + (z.kara ? 'is-kara' : z.mocny ? 'is-mocny' : '') + '">' +
      '<span class="mono dim">Okr. ' + (z.okr || '—') + '</span>' +
      '<span class="lmu-zdarz__typ">' + z.typ + '</span>' +
      '<span>' + z.opis + '</span>' +
      '<span class="mono dim">' + z.dop + '</span></li>';
  }).join('') + '</ol>' : '<p class="dim">Czysty wyścig — brak kontaktów i kar.</p>';

  if (zd.czat.length) {
    html += '<details class="lmu-czat"><summary class="lmu-sekcja">Czat z serwera · ' + zd.czat.length + '</summary><ul>' +
      zd.czat.map(function (c) { return '<li>' + esc(c.tekst) + '</li>'; }).join('') + '</ul></details>';
  }
  return html;
}

/* ------------------------------------------------------------------
   ZAKŁADKA: SEZON
------------------------------------------------------------------ */
function htmlSezon () {
  var S = sezon();
  if (!S.rundy.length) return '<p class="notice">Wczytaj pliki wyścigów — każdy to jedna runda.</p>';

  var html = '<p class="lmu-opis dim">Klasyfikacja z ' + S.rundy.length + ' wczytanych wyścigów. ' +
    'Remis rozstrzygają wygrane, potem podia, potem najlepsze miejsce. Kierowcy są łączeni po nazwisku — ' +
    'jeśli ktoś wpisał się różnie w dwóch wyścigach, popraw to w „Poprawnych zapisach nazwisk".</p>';

  S.klasy.forEach(function (kl) {
    html += htmlKlasa(kl,
      '<div class="tbl-wrap"><table class="lmu-tab lmu-tab--sezon"><thead><tr>' +
        '<th class="th-pos">Poz</th><th>Kierowca</th>' +
        S.rundy.map(function (r) { return '<th class="th-num" title="' + esc(r.tor) + '">R' + r.n + '<small>' + esc(r.nazwa) + '</small></th>'; }).join('') +
        '<th class="th-pts">Suma</th>' +
      '</tr></thead><tbody>' +
      kl.kierowcy.map(function (o, i) {
        return '<tr class="' + (i < 3 ? 'r' + (i + 1) : '') + '">' +
          '<td class="pos">' + o.poz + '</td>' +
          '<td class="drv"><span class="lmu-kto">' + esc(o.nazwa) + '</span>' +
            '<span class="lmu-zespol">' + esc(o.zespol) + '</span></td>' +
          S.rundy.map(function (r, ri) {
            var p = o.punkty[ri];
            return '<td class="num" data-label="R' + r.n + '">' + (p === undefined ? '<span class="dim">·</span>' : o.dnf[ri] ? '<span class="lmu-status">DNF</span>' : p) + '</td>';
          }).join('') +
          '<td class="pts" data-label="Suma">' + o.suma + '</td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>', kl.kierowcy.length + ' kierowców');
  });
  return html;
}

/* ------------------------------------------------------------------
   RYSOWANIE STRONY
------------------------------------------------------------------ */
function renderPliki () {
  var box = $('#lmuPliki');
  box.innerHTML = stan.pliki.map(function (p, i) {
    var d = p.dane;
    return '<span class="lmu-plik' + (i === stan.aktywny ? ' is-on' : '') + '">' +
      '<button type="button" data-plik="' + i + '">' +
        '<b>' + esc(d.tor.nazwa || p.nazwa) + '</b>' +
        '<small class="mono">' + esc(dataKropki(d.data)) + ' · ' + esc(d.rodzaj) + '</small>' +
      '</button>' +
      '<button type="button" class="lmu-plik__x" data-usun="' + i + '" aria-label="Usuń ' + esc(p.nazwa) + '">×</button>' +
    '</span>';
  }).join('');
}

function render () {
  var d = dane();
  var box = $('#lmuPodglad');
  if (!d || !box) return;

  renderPliki();
  [].forEach.call(document.querySelectorAll('#lmuZakl [data-z]'), function (b) {
    var on = b.getAttribute('data-z') === stan.zakladka;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  var sezonowa = stan.zakladka === 'sezon';
  $('#lmuPng').querySelector('.btn__t').textContent = sezonowa ? 'Pobierz grafikę klasyfikacji' : 'Pobierz grafikę PNG';

  var html;
  if (sezonowa) {
    var S = sezon();
    var ost = S.rundy[S.rundy.length - 1];
    html = ost ? htmlBaner(ost.dane, 'Klasyfikacja generalna', 'PO RUNDZIE ' + ost.n) : '';
    html += htmlSezon();
  } else {
    html = htmlBaner(d, $('#lmuTytul').value, znacznikRundy(d));
    html += stan.zakladka === 'przebieg' ? htmlPrzebieg(d)
          : stan.zakladka === 'okrazenia' ? htmlOkrazenia(d)
          : stan.zakladka === 'incydenty' ? htmlIncydenty(d)
          : htmlWyniki(d);
  }
  box.innerHTML = html;
  $('#lmuInfo').textContent = stan.pliki[stan.aktywny].nazwa + ' · ' + d.kierowcy.length + ' kierowców' +
    (stan.pliki.length > 1 ? ' · plików: ' + stan.pliki.length : '');
}

/* ------------------------------------------------------------------
   GRAFIKA PNG
   Rysowana od zera na płótnie, a nie „zrzut" strony — dzięki temu
   wygląda tak samo w każdej przeglądarce i zawsze ma 1920 px szerokości.
   Nagłówek jak plakaty ligi: zdjęcie toru ucięte skosem, pomarańczowy
   pas, granatowy panel z logo toru i numerem rundy.
------------------------------------------------------------------ */
var KOL = {
  tlo: '#0B111C', pas: '#111A2A', pas2: '#0E1624', linia: 'rgba(174,182,198,.14)',
  tekst: '#F1ECE2', krem: '#EFE8DA', dim: '#8C95A8', bursztyn: '#E9B949', pomar: '#ED4703',
  lmu: '#D8323F', panel: '#151B2D', zloto: '#E9B949', srebro: '#C7CEDB', braz: '#C08A55',
  zielony: '#3FBF7F', czerwony: '#E0553B'
};

var W = 1920, M = 88, X = M + 28, PRAWA = W - M - 28;

function wczytajObraz (src) {
  return new Promise(function (ok) {
    if (!src) { ok(null); return; }
    var im = new Image();
    im.onload = function () { ok(im); };
    im.onerror = function () { ok(null); };
    im.src = src;
  });
}

function czcionki () {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.all([
    '800 64px "Saira Condensed"', '700 30px "Saira Condensed"', '600 20px "Saira Condensed"',
    '400 18px "Barlow"', '500 18px "Barlow"', '500 20px "IBM Plex Mono"', '400 16px "IBM Plex Mono"'
  ].map(function (f) { return document.fonts.load(f).catch(function () {}); }));
}

/* Wczytuje listę obrazów naraz; zwraca słownik adres -> obraz. */
function obrazy (adresy) {
  adresy = adresy.filter(Boolean).filter(function (a, i, arr) { return arr.indexOf(a) === i; });
  return Promise.all([czcionki()].concat(adresy.map(wczytajObraz))).then(function (wyn) {
    var img = {};
    adresy.forEach(function (a, i) { img[a] = wyn[i + 1]; });
    return img;
  });
}

function odstep (ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }

/* Tekst przycięty do szerokości, z wielokropkiem. */
function tekstMax (ctx, t, x, y, max) {
  t = String(t || '');
  if (ctx.measureText(t).width <= max) { ctx.fillText(t, x, y); return; }
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  ctx.fillText(t + '…', x, y);
}

/* Równoległobok w stylu serwisu (jak zakładki i przyciski). */
/* Tekst zmniejszany, aż zmieści się w szerokości (do rozmiaru min). */
function tekstDopasuj (ctx, t, x, y, max, szablon, rozmiar, min) {
  t = String(t || '');
  for (var r = rozmiar; r >= min; r--) {
    ctx.font = szablon.replace('#', r);
    if (ctx.measureText(t).width <= max) break;
  }
  tekstMax(ctx, t, x, y, max);
}

function skos (ctx, x, y, w, h, s) {
  ctx.beginPath();
  ctx.moveTo(x + s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - s, y + h); ctx.lineTo(x, y + h);
  ctx.closePath();
}

function wielokat (ctx, pkt) {
  ctx.beginPath();
  ctx.moveTo(pkt[0], pkt[1]);
  for (var i = 2; i < pkt.length; i += 2) ctx.lineTo(pkt[i], pkt[i + 1]);
  ctx.closePath();
}

function naglowekGrafiki (ctx, o, img) {
  var NAG = 360;
  var gA = 1250, gB = 1130, PAS = 38;      /* skos: góra i dół krawędzi zdjęcia */

  ctx.fillStyle = KOL.panel; ctx.fillRect(0, 0, W, NAG);

  /* zdjęcie toru */
  ctx.save();
  wielokat(ctx, [0, 0, gA, 0, gB, NAG, 0, NAG]); ctx.clip();
  ctx.fillStyle = KOL.tlo; ctx.fillRect(0, 0, gA, NAG);
  var ob = img[o.tlo];
  if (ob) {
    var sk = Math.max(gA / ob.width, NAG / ob.height);
    ctx.drawImage(ob, (gA - ob.width * sk) / 2, (NAG - ob.height * sk) / 2, ob.width * sk, ob.height * sk);
  }
  var g = ctx.createLinearGradient(0, 0, gA, 0);
  g.addColorStop(0, 'rgba(11,17,28,.88)'); g.addColorStop(.55, 'rgba(11,17,28,.55)'); g.addColorStop(1, 'rgba(11,17,28,.15)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, gA, NAG);
  var g2 = ctx.createLinearGradient(0, NAG * .45, 0, NAG);
  g2.addColorStop(0, 'rgba(11,17,28,0)'); g2.addColorStop(1, 'rgba(11,17,28,.75)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, gA, NAG);
  ctx.restore();

  /* pomarańczowy pas po skosie */
  ctx.fillStyle = KOL.pomar;
  wielokat(ctx, [gA, 0, gA + PAS, 0, gB + PAS, NAG, gB, NAG]); ctx.fill();

  /* logo ligi */
  var logo = img['assets/img/brand/logo.png'];
  if (logo) { var lw = 300; ctx.drawImage(logo, X, 48, lw, lw * logo.height / logo.width); }

  /* tytuł i opis po lewej */
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = KOL.krem;
  ctx.font = 'italic 800 92px "Saira Condensed", "Arial Narrow", sans-serif';
  tekstMax(ctx, String(o.tytul || '').toUpperCase(), X - 4, 236, gB - X - 60);
  ctx.fillStyle = 'rgba(239,232,218,.72)';
  odstep(ctx, 2);
  tekstDopasuj(ctx, String(o.meta || '').toUpperCase(), X, 290, gB - X - 70, '400 #px "IBM Plex Mono", monospace', 19, 14);
  odstep(ctx, 0);

  /* panel po prawej: logo toru, seria, runda */
  var lewyPanel = gA + PAS + 40;
  var t = img[o.logoToru];
  if (t) {
    var bw = PRAWA - lewyPanel, bh = 130;
    var tw = t.width || 316, th = t.height || 113;
    var s = Math.min(bw / tw, bh / th);
    ctx.drawImage(t, PRAWA - tw * s, 40 + (bh - th * s) / 2, tw * s, th * s);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = KOL.krem;
  odstep(ctx, 3);
  tekstDopasuj(ctx, String(o.seria || '').toUpperCase(), PRAWA, 238, PRAWA - (gB + PAS + 50), '400 #px "IBM Plex Mono", monospace', 18, 12);
  odstep(ctx, 0);
  ctx.font = 'italic 800 50px "Saira Condensed", sans-serif';
  var znak = String(o.znacznik || '');
  var szer = ctx.measureText(znak).width, maks = PRAWA - (gB + PAS + 20);
  if (szer > maks) ctx.font = 'italic 800 ' + Math.floor(50 * maks / szer) + 'px "Saira Condensed", sans-serif';
  ctx.fillText(znak, PRAWA, 306);
  ctx.textAlign = 'left';

  return NAG;
}

function stopkaGrafiki (ctx, H, tekst) {
  var STOPKA = 78;
  ctx.fillStyle = KOL.linia; ctx.fillRect(M, H - STOPKA, W - 2 * M, 1);
  ctx.fillStyle = KOL.dim;
  ctx.font = '400 16px "IBM Plex Mono", monospace';
  odstep(ctx, 2);
  ctx.fillText('PROJECTSIMRACING.PL', X, H - 32);
  ctx.textAlign = 'right';
  ctx.fillText(tekst, PRAWA, H - 32);
  ctx.textAlign = 'left';
  odstep(ctx, 0);
  ctx.fillStyle = KOL.pomar; ctx.fillRect(0, H - 6, W, 6);
}

function pasKlasy (ctx, kl, y, dopisek) {
  ctx.fillStyle = kl.kolor;
  skos(ctx, M, y + 14, 210, 36, 12); ctx.fill();
  ctx.fillStyle = '#0B111C';
  ctx.font = '800 24px "Saira Condensed", sans-serif';
  ctx.fillText(kl.nazwa.toUpperCase(), M + 26, y + 41);
  ctx.fillStyle = KOL.dim;
  ctx.font = '400 16px "IBM Plex Mono", monospace';
  ctx.fillText(dopisek, M + 230, y + 39);
}

var NAGRODA_H = 128;

function rysujNagrody (ctx, nn, y) {
  var gap = 18, n = nn.length, w = (W - 2 * M - gap * (n - 1)) / n;
  nn.forEach(function (a, i) {
    var x = M + i * (w + gap);
    ctx.fillStyle = KOL.panel;
    skos(ctx, x, y, w, NAGRODA_H - 24, 16); ctx.fill();
    ctx.fillStyle = KOL.pomar;
    skos(ctx, x, y, 34, NAGRODA_H - 24, 16); ctx.fill();
    var tx = x + 48;
    ctx.fillStyle = KOL.pomar;
    ctx.font = '500 14px "IBM Plex Mono", monospace';
    odstep(ctx, 2.5);
    tekstMax(ctx, a.etyk.toUpperCase(), tx, y + 30, w - 70);
    odstep(ctx, 0);
    ctx.fillStyle = KOL.krem;
    ctx.font = '700 30px "Saira Condensed", sans-serif';
    tekstMax(ctx, nazwa(a.kto.nazwa).toUpperCase(), tx, y + 64, w - 70);
    ctx.fillStyle = KOL.dim;
    ctx.font = '400 17px "IBM Plex Mono", monospace';
    tekstMax(ctx, a.wartosc, tx, y + 90, w - 70);
  });
}

function rysujGrafike () {
  var d = dane();
  if (!d) return Promise.reject(new Error('Brak danych'));
  var punkty = $('#lmuPunkty').checked && d.wyscig;
  var nn = $('#lmuNagrodyCh').checked ? nagrody(d) : [];

  var NAG = 360, PAS_KL = 58, NAG_TAB = 42, WIERSZ = 66, ODST = 26, STOPKA = 78;
  var H = NAG + STOPKA + (nn.length ? NAGRODA_H + 20 : 0);
  d.klasy.forEach(function (kl) { H += PAS_KL + NAG_TAB + kl.kierowcy.length * WIERSZ + ODST; });

  var adresy = [obrazTla(d), obrazToru(d), 'assets/img/brand/logo.png'];
  d.kierowcy.forEach(function (k) { adresy.push(obrazAuta(k.veh), obrazMarki(k.marka)); });

  return obrazy(adresy).then(function (img) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = KOL.tlo; ctx.fillRect(0, 0, W, H);

    naglowekGrafiki(ctx, {
      tlo: obrazTla(d), logoToru: obrazToru(d),
      tytul: $('#lmuTytul').value, meta: metaTekst(d).join('  ·  '),
      seria: $('#lmuSeria').value, znacznik: znacznikRundy(d)
    }, img);

    var y = NAG;
    if (nn.length) { rysujNagrody(ctx, nn, y + 32); y += NAGRODA_H + 20; }

    var K = { poz: X - 4, nr: X + 70, kto: X + 178, auto: X + 590, okr: 1150, czas: 1270, najl: 1460, pit: 1600 };

    d.klasy.forEach(function (kl) {
      pasKlasy(ctx, kl, y, kl.kierowcy.length + ' AUT');
      y += PAS_KL;

      ctx.fillStyle = KOL.dim;
      ctx.font = '400 15px "IBM Plex Mono", monospace';
      ctx.fillText('POZ', K.poz, y + 26);
      ctx.fillText('NR', K.nr, y + 26);
      ctx.fillText('KIEROWCA · ZESPÓŁ', K.kto, y + 26);
      ctx.fillText('AUTO', K.auto, y + 26);
      ctx.textAlign = 'right';
      ctx.fillText('OKR.', K.okr + 60, y + 26);
      ctx.fillText('CZAS / STRATA', K.czas + 170, y + 26);
      ctx.fillText('NAJLEPSZE', K.najl + 120, y + 26);
      ctx.fillText('PIT', K.pit + 40, y + 26);
      if (punkty) ctx.fillText('PKT', PRAWA, y + 26);
      ctx.textAlign = 'left';
      ctx.fillStyle = KOL.linia; ctx.fillRect(M, y + NAG_TAB - 1, W - 2 * M, 1);
      y += NAG_TAB;

      kl.kierowcy.forEach(function (k, i) {
        var yy = y + i * WIERSZ;
        var dnf = !!k.status;
        ctx.fillStyle = i % 2 ? KOL.pas2 : KOL.pas;
        ctx.fillRect(M, yy, W - 2 * M, WIERSZ - 2);

        if (!dnf && i < 3) {
          ctx.fillStyle = [KOL.zloto, KOL.srebro, KOL.braz][i];
          ctx.fillRect(M, yy, 5, WIERSZ - 2);
        }
        ctx.globalAlpha = dnf ? .55 : 1;

        var sy = yy + WIERSZ / 2 + 11;
        ctx.fillStyle = !dnf && i < 3 ? [KOL.zloto, KOL.srebro, KOL.braz][i] : KOL.tekst;
        ctx.font = '800 34px "Saira Condensed", sans-serif';
        var pozT = dnf ? '—' : String(k.pozKlasa);
        ctx.fillText(pozT, K.poz + 10, sy + 1);

        /* zyskane / stracone pozycje obok miejsca */
        if (k.zyskane) {
          var pw = ctx.measureText(pozT).width;
          ctx.fillStyle = k.zyskane > 0 ? KOL.zielony : KOL.czerwony;
          ctx.font = '500 13px "IBM Plex Mono", monospace';
          ctx.fillText((k.zyskane > 0 ? '▲' : '▼') + Math.abs(k.zyskane), K.poz + 14 + pw, sy - 12);
        }

        ctx.fillStyle = kl.kolor;
        skos(ctx, K.nr, yy + 16, 78, 32, 9); ctx.fill();
        ctx.fillStyle = '#0B111C';
        ctx.font = '800 22px "Saira Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(k.nr), K.nr + 39, yy + 40);
        ctx.textAlign = 'left';

        ctx.fillStyle = KOL.tekst;
        ctx.font = '700 28px "Saira Condensed", sans-serif';
        tekstMax(ctx, nazwa(k.nazwa).toUpperCase(), K.kto, yy + 32, K.auto - K.kto - 30);
        ctx.fillStyle = KOL.dim;
        ctx.font = '400 17px "Barlow", sans-serif';
        tekstMax(ctx, nazwa(k.zespol), K.kto, yy + 54, K.auto - K.kto - 30);

        var a = img[obrazAuta(k.veh)];
        var m = img[obrazMarki(k.marka)];
        if (a) ctx.drawImage(a, K.auto - 12, yy - 6, 190, 76);
        else if (m) {                       /* brak renderu: duże, przygaszone logo marki */
          ctx.save(); ctx.globalAlpha *= .35; ctx.drawImage(m, K.auto + 58, yy + 8, 48, 48); ctx.restore();
        }
        if (m) ctx.drawImage(m, K.auto + 186, yy + 17, 30, 30);
        ctx.fillStyle = KOL.dim;
        ctx.font = '400 16px "Barlow", sans-serif';
        tekstMax(ctx, k.auto, K.auto + 226, yy + 38, K.okr - K.auto - 236);

        ctx.textAlign = 'right';
        ctx.fillStyle = KOL.tekst;
        ctx.font = '500 22px "IBM Plex Mono", monospace';
        ctx.fillText(String(k.okr), K.okr + 60, sy);

        if (dnf) {
          ctx.fillStyle = KOL.czerwony;
          ctx.font = '800 24px "Saira Condensed", sans-serif';
          ctx.fillText(k.status, K.czas + 170, sy);
        } else {
          ctx.fillStyle = i === 0 ? KOL.bursztyn : KOL.tekst;
          ctx.font = '500 22px "IBM Plex Mono", monospace';
          ctx.fillText(i === 0 ? czas(k.czas) : k.strata, K.czas + 170, sy);
        }

        ctx.fillStyle = k.najszybszy ? KOL.bursztyn : KOL.dim;
        ctx.font = '400 20px "IBM Plex Mono", monospace';
        ctx.fillText(czas(k.najlepsze), K.najl + 120, sy);

        ctx.fillStyle = KOL.dim;
        ctx.fillText(String(k.pit), K.pit + 40, sy);

        if (punkty) {
          ctx.fillStyle = k.punkty ? KOL.tekst : KOL.dim;
          ctx.font = '800 30px "Saira Condensed", sans-serif';
          ctx.fillText(k.punkty ? String(k.punkty) : '—', PRAWA, sy + 1);
        }
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      });
      y += kl.kierowcy.length * WIERSZ + ODST;
    });

    stopkaGrafiki(ctx, H, 'WYNIKI Z PLIKU LE MANS ULTIMATE' + (punkty ? '  ·  PUNKTACJA ' + PUNKTY.join('-') : ''));
    return c;
  });
}

/* Klasyfikacja sezonu: kierowca, auto, punkty z każdej rundy, suma. */
function rysujSezon () {
  var S = sezon();
  if (!S.rundy.length) return Promise.reject(new Error('Brak wczytanych wyścigów'));
  var ost = S.rundy[S.rundy.length - 1];

  var NAG = 360, PAS_KL = 58, NAG_TAB = 42, WIERSZ = 60, ODST = 26, STOPKA = 78;
  var H = NAG + STOPKA;
  S.klasy.forEach(function (kl) { H += PAS_KL + NAG_TAB + kl.kierowcy.length * WIERSZ + ODST; });

  var adresy = [obrazTla(ost.dane), obrazToru(ost.dane), 'assets/img/brand/logo.png'];
  S.klasy.forEach(function (kl) { kl.kierowcy.forEach(function (o) { adresy.push(obrazAuta(o.veh), obrazMarki(o.marka)); }); });

  return obrazy(adresy).then(function (img) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = KOL.tlo; ctx.fillRect(0, 0, W, H);

    naglowekGrafiki(ctx, {
      tlo: obrazTla(ost.dane), logoToru: obrazToru(ost.dane),
      tytul: 'Klasyfikacja generalna',
      meta: 'Po ' + S.rundy.length + (S.rundy.length === 1 ? ' wyścigu' : ' wyścigach') + '  ·  ostatni: ' + ost.tor + ', ' + dataTekst(ost.dane.data),
      seria: $('#lmuSeria').value, znacznik: 'PO RUNDZIE ' + ost.n
    }, img);

    /* kolumny rund dzielą miejsce między autem a sumą */
    var R = S.rundy.length;
    var K = { poz: X - 4, nr: X + 70, kto: X + 178, auto: X + 590 };
    var rOd = 1080, rDo = PRAWA - 150, rKrok = Math.min(110, (rDo - rOd) / Math.max(R, 1));

    var y = NAG;
    S.klasy.forEach(function (kl) {
      pasKlasy(ctx, kl, y, kl.kierowcy.length + ' KIEROWCÓW');
      y += PAS_KL;

      ctx.fillStyle = KOL.dim;
      ctx.font = '400 15px "IBM Plex Mono", monospace';
      ctx.fillText('POZ', K.poz, y + 26);
      ctx.fillText('NR', K.nr, y + 26);
      ctx.fillText('KIEROWCA · ZESPÓŁ', K.kto, y + 26);
      ctx.fillText('AUTO', K.auto, y + 26);
      ctx.textAlign = 'center';
      S.rundy.forEach(function (r, ri) {
        ctx.fillText('R' + r.n + ' ' + String(r.nazwa).slice(0, 3).toUpperCase(), rOd + rKrok * (ri + .5), y + 26);
      });
      ctx.textAlign = 'right';
      ctx.fillText('PKT', PRAWA, y + 26);
      ctx.textAlign = 'left';
      ctx.fillStyle = KOL.linia; ctx.fillRect(M, y + NAG_TAB - 1, W - 2 * M, 1);
      y += NAG_TAB;

      kl.kierowcy.forEach(function (o, i) {
        var yy = y + i * WIERSZ, sy = yy + WIERSZ / 2 + 10;
        ctx.fillStyle = i % 2 ? KOL.pas2 : KOL.pas;
        ctx.fillRect(M, yy, W - 2 * M, WIERSZ - 2);
        var podium = o.poz <= 3 && o.suma > 0;
        if (podium) { ctx.fillStyle = [KOL.zloto, KOL.srebro, KOL.braz][o.poz - 1]; ctx.fillRect(M, yy, 5, WIERSZ - 2); }

        ctx.fillStyle = podium ? [KOL.zloto, KOL.srebro, KOL.braz][o.poz - 1] : KOL.tekst;
        ctx.font = '800 32px "Saira Condensed", sans-serif';
        ctx.fillText(String(o.poz), K.poz + 10, sy + 1);

        ctx.fillStyle = kl.kolor;
        skos(ctx, K.nr, yy + 14, 78, 30, 9); ctx.fill();
        ctx.fillStyle = '#0B111C';
        ctx.font = '800 21px "Saira Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(o.nr), K.nr + 39, yy + 37);
        ctx.textAlign = 'left';

        ctx.fillStyle = KOL.tekst;
        ctx.font = '700 27px "Saira Condensed", sans-serif';
        tekstMax(ctx, o.nazwa.toUpperCase(), K.kto, yy + 29, K.auto - K.kto - 30);
        ctx.fillStyle = KOL.dim;
        ctx.font = '400 16px "Barlow", sans-serif';
        tekstMax(ctx, o.zespol, K.kto, yy + 50, K.auto - K.kto - 30);

        var a = img[obrazAuta(o.veh)], m = img[obrazMarki(o.marka)];
        if (a) ctx.drawImage(a, K.auto - 12, yy - 6, 170, 68);
        if (m) ctx.drawImage(m, K.auto + 166, yy + 16, 26, 26);
        ctx.fillStyle = KOL.dim;
        ctx.font = '400 15px "Barlow", sans-serif';
        tekstMax(ctx, o.auto, K.auto + 200, yy + 35, rOd - K.auto - 215);

        ctx.textAlign = 'center';
        S.rundy.forEach(function (r, ri) {
          var p = o.punkty[ri], cx = rOd + rKrok * (ri + .5);
          if (p === undefined) { ctx.fillStyle = KOL.dim; ctx.font = '400 20px "IBM Plex Mono", monospace'; ctx.fillText('·', cx, sy); }
          else if (o.dnf[ri]) { ctx.fillStyle = KOL.czerwony; ctx.font = '800 20px "Saira Condensed", sans-serif'; ctx.fillText('DNF', cx, sy); }
          else { ctx.fillStyle = p ? KOL.tekst : KOL.dim; ctx.font = '500 21px "IBM Plex Mono", monospace'; ctx.fillText(String(p), cx, sy); }
        });
        ctx.textAlign = 'right';
        ctx.fillStyle = i === 0 ? KOL.bursztyn : KOL.krem;
        ctx.font = '800 32px "Saira Condensed", sans-serif';
        ctx.fillText(String(o.suma), PRAWA, sy + 1);
        ctx.textAlign = 'left';
      });
      y += kl.kierowcy.length * WIERSZ + ODST;
    });

    stopkaGrafiki(ctx, H, 'KLASYFIKACJA Z PLIKÓW LE MANS ULTIMATE  ·  PUNKTACJA ' + PUNKTY.join('-'));
    return c;
  });
}

function nazwaPliku (rozszerzenie) {
  if (stan.zakladka === 'sezon') {
    var S = sezon(), ost = S.rundy[S.rundy.length - 1];
    return 'klasyfikacja-lmu-po-rundzie-' + (ost ? ost.n : 0) + '.' + rozszerzenie;
  }
  var d = dane();
  var data = d && d.data ? d.data.toISOString().slice(0, 10) : 'wyniki';
  var tor = d && d.tor.klucz ? d.tor.klucz : 'lmu';
  return 'wyniki-lmu-' + data + '-' + tor + '.' + rozszerzenie;
}

function pobierz (blob, plik) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = plik;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ------------------------------------------------------------------
   DANE DO ARKUSZA
   Nagłówki są dobrane tak, żeby strona wyników rozpoznała kolumny
   sama: Poz, Kierowca, Zespół, Samochód, Klasa (jak dywizja), Czas,
   Punkty. Reszta pokaże się jako dodatkowe kolumny.
   Na zakładce „Sezon" eksportujemy klasyfikację zamiast rundy.
------------------------------------------------------------------ */
function wiersze () {
  if (stan.zakladka === 'sezon') {
    var S = sezon();
    var nag = ['Poz', 'Kierowca', 'Zespół', 'Samochód', 'Klasa']
      .concat(S.rundy.map(function (r) { return 'R' + r.n + ' ' + r.nazwa; })).concat(['Punkty']);
    var out = [nag];
    S.klasy.forEach(function (kl) {
      kl.kierowcy.forEach(function (o) {
        out.push([o.poz, o.nazwa, o.zespol, o.auto, kl.nazwa]
          .concat(S.rundy.map(function (r, ri) { return o.punkty[ri] === undefined ? '' : o.dnf[ri] ? 'DNF' : o.punkty[ri]; }))
          .concat([o.suma]));
      });
    });
    return out;
  }

  var d = dane();
  var punkty = $('#lmuPunkty').checked && d.wyscig;
  var naglowki = ['Poz', 'Kierowca', 'Zespół', 'Samochód', 'Klasa', 'Nr', 'Okrążenia', 'Czas',
                  'Najlepsze okrążenie', 'Pit', 'Status'];
  if (punkty) naglowki.push('Punkty');
  var wynik = [naglowki];
  d.klasy.forEach(function (kl) {
    kl.kierowcy.forEach(function (k, i) {
      var w = [k.status ? '' : k.pozKlasa, nazwa(k.nazwa), nazwa(k.zespol), k.auto, kl.nazwa, k.nr, k.okr,
               k.status ? '' : (i === 0 ? czas(k.czas) : k.strata),
               czas(k.najlepsze), k.pit, k.status || 'Ukończył'];
      if (punkty) w.push(k.punkty);
      wynik.push(w);
    });
  });
  return wynik;
}

function tsv () {
  return wiersze().map(function (w) {
    return w.map(function (c) { return String(c).replace(/[\t\n]/g, ' '); }).join('\t');
  }).join('\n');
}

function csv () {
  return '﻿' + wiersze().map(function (w) {
    return w.map(function (c) {
      c = String(c);
      return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
    }).join(',');
  }).join('\n');
}

function kopiuj (tekst) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(tekst);
  return new Promise(function (ok, zle) {
    var ta = document.createElement('textarea');
    ta.value = tekst; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy') ? ok() : zle(); } catch (e) { zle(e); }
    ta.remove();
  });
}

/* ------------------------------------------------------------------
   OBSŁUGA STRONY
------------------------------------------------------------------ */
function blad (tekst) {
  var el = $('#lmuBlad');
  el.hidden = !tekst;
  el.textContent = tekst || '';
}

function info (tekst) {
  var el = $('#lmuInfo');
  el.textContent = tekst;
  clearTimeout(info.t);
  info.t = setTimeout(render, 3500);
}

/* Ustawia pola (runda, tytuł) pod pokazywany plik. */
function ustawPola () {
  var d = dane();
  if (!d) return;
  var sel = $('#lmuRunda');
  var rundy = rundyLmu();
  sel.innerHTML = rundy.map(function (r, i) {
    return '<option value="' + i + '">Runda ' + dwa(r.n) + ' · ' + esc(r.name) + '</option>';
  }).join('') + '<option value="-1">Bez rundy — sama data</option>';
  sel.value = String(dopasujRunde(d.data));
  $('#lmuTytul').value = tytulDomyslny(d);
}

function dodaj (tekst, plik) {
  var d;
  try { d = parsuj(tekst); } catch (e) {
    blad('Nie udało się odczytać pliku ' + plik + ': ' + e.message);
    return false;
  }
  /* ten sam plik drugi raz — podmieniamy */
  var jest = -1;
  stan.pliki.forEach(function (p, i) { if (p.nazwa === plik) jest = i; });
  if (jest > -1) stan.pliki[jest].dane = d;
  else stan.pliki.push({ nazwa: plik, dane: d });
  stan.aktywny = jest > -1 ? jest : stan.pliki.length - 1;
  return true;
}

function poWczytaniu () {
  if (!stan.pliki.length) return;
  if (!$('#lmuSeria').value) {
    var etyk = (CFG.seriesLabel || {}).lmu;
    $('#lmuSeria').value = PS.txt(etyk) || 'Le Mans Ultimate';
  }
  ustawPola();
  $('#lmuWynik').hidden = false;
  render();
}

function zaladuj (tekst, plik) {
  blad('');
  if (dodaj(tekst, plik)) poWczytaniu();
}

function zPlikow (lista) {
  var pliki = [].slice.call(lista || []).filter(function (f) { return /\.xml$/i.test(f.name); });
  if (!pliki.length) { blad('To nie jest plik .xml z wynikami.'); return; }
  blad('');
  Promise.all(pliki.map(function (f) {
    return new Promise(function (ok) {
      var r = new FileReader();
      r.onload = function () { ok({ tekst: r.result, nazwa: f.name }); };
      r.onerror = function () { ok(null); };
      r.readAsText(f);
    });
  })).then(function (wyn) {
    wyn.filter(Boolean)
      .forEach(function (w) { dodaj(w.tekst, w.nazwa); });
    if (pliki.length > 1 && stan.pliki.filter(function (p) { return p.dane.wyscig; }).length > 1) stan.zakladka = 'sezon';
    poWczytaniu();
  });
}

/* Poprawne zapisy nazwisk: plik z repozytorium + zmiany z tej przeglądarki. */
function startNazwy () {
  var pole = $('#lmuNazwy');
  var tekst = null;
  try { tekst = localStorage.getItem(KLUCZ_NAZW); } catch (e) {}
  if (tekst == null) tekst = nazwyDoTekstu(window.LMU_KIEROWCY || {});
  pole.value = tekst;
  stan.nazwy = parsujNazwy(tekst);

  var t;
  pole.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(function () {
      stan.nazwy = parsujNazwy(pole.value);
      try { localStorage.setItem(KLUCZ_NAZW, pole.value); } catch (e) {}
      render();
    }, 250);
  });

  $('#lmuNazwyDodaj').addEventListener('click', function () {
    var znane = parsujNazwy(pole.value), jest = {};
    pole.value.split(/\r?\n/).forEach(function (w) { var i = w.indexOf('='); if (i > 0) jest[w.slice(0, i).trim().toLowerCase()] = 1; });
    var nowe = [];
    stan.pliki.forEach(function (p) {
      p.dane.kierowcy.forEach(function (k) {
        var n = k.nazwa, kl = n.toLowerCase();
        if (!znane[kl] && !jest[kl] && /^[\x20-\x7e]+$/.test(n)) { jest[kl] = 1; nowe.push(n + ' = ' + n); }
      });
    });
    if (!nowe.length) { info('Wszyscy kierowcy z wczytanych plików są już na liście.'); return; }
    pole.value = (pole.value.replace(/\s+$/, '') + (pole.value.trim() ? '\n' : '') + nowe.sort().join('\n'));
    pole.dispatchEvent(new Event('input'));
    pole.focus();
    info('Dopisano ' + nowe.length + ' — popraw prawą stronę każdej linii.');
  });

  $('#lmuNazwyPobierz').addEventListener('click', function () {
    var mapa = {};
    pole.value.split(/\r?\n/).forEach(function (w) {
      var i = w.indexOf('=');
      if (i < 1 || w.trim().charAt(0) === '#') return;
      var z = w.slice(0, i).trim(), na = w.slice(i + 1).trim();
      if (z && na && z !== na) mapa[z] = na;
    });
    var js = '/* Poprawne zapisy nazwisk do wyników LMU.\n' +
      '   Lewa strona — tak, jak nazwa stoi w pliku gry; prawa — jak ma się pokazywać.\n' +
      '   Plik powstaje na stronie lmu.html (przycisk „Pobierz plik z listą"). */\n' +
      'window.LMU_KIEROWCY = ' + JSON.stringify(mapa, null, 1) + ';\n';
    pobierz(new Blob([js], { type: 'text/javascript' }), 'lmu-kierowcy.js');
    info('Zapisz plik jako assets/js/lmu-kierowcy.js w repozytorium.');
  });
}

function start () {
  var wrzut = $('#lmuWrzut');
  var plik = $('#lmuPlik');
  if (!wrzut) return;

  startNazwy();

  plik.addEventListener('change', function () { zPlikow(plik.files); plik.value = ''; });

  ['dragenter', 'dragover'].forEach(function (ev) {
    wrzut.addEventListener(ev, function (e) { e.preventDefault(); wrzut.classList.add('is-nad'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    wrzut.addEventListener(ev, function (e) { e.preventDefault(); wrzut.classList.remove('is-nad'); });
  });
  wrzut.addEventListener('drop', function (e) {
    zPlikow(e.dataTransfer && e.dataTransfer.files);
  });

  $('#lmuPrzyklad').addEventListener('click', function () {
    fetch('assets/lmu/przyklad.xml').then(function (r) { return r.text(); })
      .then(function (t) { zaladuj(t, 'przyklad.xml'); })
      .catch(function () { blad('Nie udało się wczytać przykładu.'); });
  });

  $('#lmuPliki').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-usun')) {
      stan.pliki.splice(+b.getAttribute('data-usun'), 1);
      if (!stan.pliki.length) { stan.aktywny = -1; $('#lmuWynik').hidden = true; return; }
      stan.aktywny = Math.min(stan.aktywny, stan.pliki.length - 1);
    } else {
      stan.aktywny = +b.getAttribute('data-plik');
      if (stan.zakladka === 'sezon') stan.zakladka = 'wyniki';
    }
    ustawPola();
    render();
  });

  $('#lmuZakl').addEventListener('click', function (e) {
    var b = e.target.closest('[data-z]');
    if (!b) return;
    stan.zakladka = b.getAttribute('data-z');
    render();
  });

  $('#lmuRunda').addEventListener('change', render);
  ['#lmuSeria', '#lmuTytul'].forEach(function (s) { $(s).addEventListener('input', render); });
  ['#lmuPunkty', '#lmuNagrodyCh'].forEach(function (s) { $(s).addEventListener('change', render); });

  $('#lmuPng').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    info('Rysuję grafikę…');
    (stan.zakladka === 'sezon' ? rysujSezon() : rysujGrafike()).then(function (c) {
      c.toBlob(function (b) {
        pobierz(b, nazwaPliku('png'));
        info('Grafika zapisana: ' + nazwaPliku('png'));
        btn.disabled = false;
      }, 'image/png');
    }).catch(function (e) {
      blad('Nie udało się narysować grafiki: ' + e.message);
      btn.disabled = false;
    });
  });

  $('#lmuArkusz').addEventListener('click', function () {
    kopiuj(tsv()).then(function () {
      info('Skopiowane — wklej w arkuszu w komórce A1 nowej zakładki.');
    }).catch(function () { blad('Przeglądarka nie pozwoliła skopiować — użyj przycisku CSV.'); });
  });
  $('#lmuCsv').addEventListener('click', function () {
    pobierz(new Blob([csv()], { type: 'text/csv;charset=utf-8' }), nazwaPliku('csv'));
  });
  $('#lmuJson').addEventListener('click', function () {
    var eksport;
    if (stan.zakladka === 'sezon') {
      var S = sezon();
      eksport = { seria: $('#lmuSeria').value, rundy: S.rundy.map(function (r) { return { n: r.n, nazwa: r.nazwa, tor: r.tor, data: r.dane.data }; }),
                  klasy: S.klasy.map(function (k) { return { nazwa: k.nazwa, kierowcy: k.kierowcy }; }) };
    } else {
      eksport = JSON.parse(JSON.stringify(dane()));
      eksport.seria = $('#lmuSeria').value;
      eksport.tytul = $('#lmuTytul').value;
      eksport.kierowcy.forEach(function (k) { k.nazwaPoprawna = nazwa(k.nazwa); });
    }
    pobierz(new Blob([JSON.stringify(eksport, null, 1)], { type: 'application/json' }), nazwaPliku('json'));
  });
}

/* dla testów i przyszłej integracji z resztą strony */
window.LMU = {
  parsuj: parsuj, rysujGrafike: rysujGrafike, rysujSezon: rysujSezon, zaladuj: zaladuj,
  czas: czas, sezon: sezon, nagrody: nagrody, stan: stan, zakladka: function (z) { stan.zakladka = z; render(); }
};

start();
PS.boot();

})();
