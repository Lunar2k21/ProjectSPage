/**
 * =====================================================================
 * Project Simracing — most między arkuszem a stroną wyników
 * ---------------------------------------------------------------------
 * Ten sam plik wkleja się do KAŻDEGO arkusza ligowego (WRC, Le Mans
 * Ultimate, Forza). Nic tu nie trzeba dopasowywać — skrypt po prostu
 * oddaje widoczne zakładki, a strona sama rozpoznaje kolumny.
 *
 * DODAJ GO JAKO OSOBNY PLIK w projekcie Apps Script (Plik → + → Skrypt),
 * obok istniejących makr. Po wklejeniu pierwsza linia pliku musi brzmieć
 * dokładnie tak jak ta na samej górze — jeśli nad nią zostało
 * "function myFunction() {", wszystkie funkcje są zagnieżdżone i Apps
 * Script ich nie zobaczy.
 *
 * Nazwy funkcji są dobrane tak, żeby nie kolidowały z makrami
 * importującymi wyniki (Results, przetworzPlik, Makrobeznazwy1,
 * otworzOkienkoDodatkowychPunktow, dokonczSortowanieIDywizje).
 *
 * Instrukcja wdrożenia: plik INSTRUKCJA.md obok.
 * =====================================================================
 */

/* Zakładki pomijane w wynikach — po nazwie, wielkość liter bez znaczenia.
   Nazwa zaczynająca się od podkreślenia jest pomijana zawsze.

   UWAGA: "nick" trzyma powiązanie pseudonimu z imieniem i nazwiskiem,
   a "overall points" i "division points" to arkusze pomocnicze makra
   importującego. Żadnego z nich nie publikujemy. Jeśli w Twoim arkuszu
   nazywają się inaczej, dopisz je poniżej. */
var POMIJAJ = [
  'nick',
  'overall points',
  'division points',
  'ustawienia', 'notatki', 'roboczy'
];

/* Ile wierszy najwyżej oddajemy z jednej zakładki. Zabezpieczenie przed
   arkuszem, w którym formuły ciągną się do tysięcznego wiersza. */
var MAX_WIERSZY = 500;

/* Ile komórek musi być wypełnionych, żeby wiersz uznać za wynik.
   Zakładki mają numerację i formuły sięgające setek wierszy w dół —
   wiersz z samym numerem porządkowym albo pustą formułą to nie wynik. */
var MIN_KOMOREK = 2;

/* Na ile sekund trzymać gotową odpowiedź w pamięci podręcznej.
   Przy odpytywaniu co 60 s oznacza to najwyżej jedno czytanie arkusza
   na minutę, niezależnie od liczby odwiedzających. */
var CACHE_SEK = 25;

/* Separator używany tylko do liczenia znacznika zmiany. Musi być czymś,
   czego nie ma w danych — pionowa kreska w zupełności wystarcza. */
var SEP = '|';


function doGet(e) {
  var tylkoZnacznik = !!(e && e.parameter && e.parameter.meta);

  try {
    /* Zapytanie kontrolne odpowiadamy z pamięci podręcznej, bez czytania
       arkusza — na tym polega sens odpytywania co minutę. */
    if (tylkoZnacznik) {
      var cache = CacheService.getScriptCache();
      var znacznik = cache.get('updated');
      if (znacznik) {
        return json_({ title: cache.get('title') || '', updated: znacznik });
      }
    }

    var dane = pobierzDane_();
    return json_(tylkoZnacznik ? { title: dane.title, updated: dane.updated } : dane);

  } catch (blad) {
    return json_({ error: String(blad), updated: 0, sheets: [] });
  }
}


/* ------------------------------------------------------------------
   Odczyt arkusza (z pamięcią podręczną)
------------------------------------------------------------------ */
function pobierzDane_() {
  var cache = CacheService.getScriptCache();
  var gotowe = cache.get('dane');
  if (gotowe) return JSON.parse(gotowe);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var wynik = { title: ss.getName(), updated: 0, sheets: [] };
  var doHasza = [];

  ss.getSheets().forEach(function (sheet) {
    if (sheet.isSheetHidden()) return;

    var nazwa = sheet.getName();
    if (nazwa.charAt(0) === '_') return;
    if (POMIJAJ.indexOf(nazwa.toLowerCase().trim()) !== -1) return;

    var zakres = sheet.getDataRange();
    if (zakres.getNumRows() < 2) {
      wynik.sheets.push({ name: nazwa, headers: [], rows: [] });
      return;
    }

    var wartosci = zakres.getDisplayValues();      // to, co widać w arkuszu
    var naglowki = wartosci.shift();

    wartosci = wartosci.filter(function (w) {
      var ile = 0;
      for (var i = 0; i < w.length; i++) {
        if (String(w[i]).trim() !== '') ile++;
      }
      return ile >= MIN_KOMOREK;
    });

    if (wartosci.length > MAX_WIERSZY) wartosci = wartosci.slice(0, MAX_WIERSZY);

    wynik.sheets.push({ name: nazwa, headers: naglowki, rows: wartosci });

    doHasza.push(nazwa, naglowki.join(SEP));
    wartosci.forEach(function (w) { doHasza.push(w.join(SEP)); });
  });

  wynik.updated = haszuj_(doHasza.join(SEP));

  /* Znacznik i tytuł są malutkie i zawsze się mieszczą. Pełne dane
     wchodzą do pamięci podręcznej tylko wtedy, gdy nie przekraczają
     limitu 100 kB na wpis — inaczej Google i tak by je odrzuciło. */
  try {
    cache.put('updated', wynik.updated, CACHE_SEK);
    cache.put('title', wynik.title, CACHE_SEK);
    var tekst = JSON.stringify(wynik);
    if (tekst.length < 90000) cache.put('dane', tekst, CACHE_SEK);
  } catch (e) {}

  return wynik;
}


/* ------------------------------------------------------------------
   Znacznik zmiany
   Zamiast daty modyfikacji pliku (wymaga dostępu do całego Dysku)
   liczymy skrót z zawartości. Zmiana choćby jednej komórki daje inny
   znacznik, a strona pobiera pełne dane dopiero wtedy, gdy się różni.
------------------------------------------------------------------ */
function haszuj_(tekst) {
  var bajty = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, tekst, Utilities.Charset.UTF_8);
  var out = '';
  for (var i = 0; i < 8; i++) {
    var b = (bajty[i] + 256) % 256;
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}


function json_(obiekt) {
  return ContentService
    .createTextOutput(JSON.stringify(obiekt))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ------------------------------------------------------------------
   Do sprawdzenia z poziomu edytora (Uruchom → sprawdz).
   W dzienniku zobaczysz nazwy zakładek, liczbę wierszy i wagę
   odpowiedzi, którą dostanie strona.
------------------------------------------------------------------ */
function sprawdz() {
  var d = pobierzDane_();
  Logger.log('Arkusz: %s', d.title);
  Logger.log('Znacznik zmiany: %s', d.updated);

  d.sheets.forEach(function (s) {
    Logger.log('  %s — kolumny: %s, wierszy: %s',
      s.name, s.headers.length, s.rows.length);
  });

  var kb = Math.round(JSON.stringify(d).length / 1024);
  Logger.log('Waga odpowiedzi: %s kB %s', kb,
    kb > 400 ? '(dużo — zobacz, czy zakładki nie ciągną pustych wierszy)'
             : '(w porządku)');
}
