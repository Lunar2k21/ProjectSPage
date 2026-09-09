/* =====================================================================
   Project Simracing — TWOJE USTAWIENIA
   ---------------------------------------------------------------------
   To jedyny plik, w którym wpisujesz adresy arkuszy i daty rund.
   Nie jest nadpisywany przy aktualizacjach strony — config.js i reszta
   kodu mogą się zmieniać, ten plik zostaje taki, jak go zapiszesz.

   Wszystko, co tu podasz, nadpisuje odpowiednie miejsca w config.js.
   Puste pola są po prostu pomijane.
   ===================================================================== */

window.PS_LOCAL = {

  /* ---------------------------------------------------------------
     ADRESY ARKUSZY
     Wklej adres aplikacji internetowej Apps Script — ten kończący się
     na /exec. Instrukcja: apps-script/INSTRUKCJA.md.

     Samo wpisanie adresu wyłącza dane przykładowe dla tych mistrzostw.
  --------------------------------------------------------------- */
  sources: {
    wrc: 'https://script.google.com/macros/s/AKfycbzx3qJy153SDlr6dS03XtGav3t_sHgx_tscX0HCvKpv-VwlwpMFmFx2VpZwIKOTs2Vj/exec',      // EA Sports WRC        — https://script.google.com/macros/s/…/exec
    lmu: '',      // Le Mans Ultimate
    fh6: '',      // Forza Horizon 6
    acr: ''       // Assetto Corsa Rally
  },

  /* ---------------------------------------------------------------
     TERMINY RUND
     Klucz = numer rundy z kalendarza w config.js.
     Format: 'ROK-MIESIĄC-DZIEŃTGODZINA:MINUTA:00+02:00'
     (+02:00 to czas letni w Polsce, zimą +01:00).

     Wpisanie daty uruchamia odliczanie na stronie głównej,
     na podstronie kalendarza i w plikach .ics.
  --------------------------------------------------------------- */
  dates: {
    // 1: '2026-09-17T20:00:00+02:00',
    // 2: '2026-10-01T20:00:00+02:00',
    // 3: '2026-10-15T20:00:00+02:00',
    // 4: '2026-10-29T20:00:00+01:00',
    // 5: '2026-11-12T20:00:00+01:00',
    // 6: '2026-11-26T20:00:00+01:00',
    // 7: '2026-12-10T20:00:00+01:00'
  },

  /* ---------------------------------------------------------------
     NAZWY ZAKŁADEK Z WYNIKAMI
     Klucz = numer rundy, wartość = dokładna nazwa zakładki w arkuszu.
     Dzięki temu przycisk „Wyniki rundy” w kalendarzu prowadzi prosto
     do właściwej tabeli.
  --------------------------------------------------------------- */
  resultTabs: {
    // 1: '1. LAT',
    // 2: '2. GRE',
    // 3: '3. FIN'
  },

  /* ---------------------------------------------------------------
     FILMY NA STRONIE GŁÓWNEJ (opcjonalnie)
     Zostaw pustą tablicę, żeby korzystać z listy wpisanej w config.js.
     Lista filmów kanału: youtube.com/feeds/videos.xml?channel_id=UCpjDcxwIfcoN5exRmAd6SYw
  --------------------------------------------------------------- */
  videos: [
    // { id: 'udDeI9KIbv8', title: 'S0 · Wyścig 5. Bahrajn — podsumowanie' }
  ]
};
