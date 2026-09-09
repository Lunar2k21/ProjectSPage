# Podpięcie arkusza do strony wyników

Instrukcja dla osoby prowadzącej arkusz. Robi się to **raz na arkusz**,
zajmuje kilka minut i nie wymaga wiedzy programistycznej. Każdy z trzech
arkuszy (WRC, Le Mans Ultimate, Forza) podpina się osobno i niezależnie —
nikt nie musi nikomu niczego udostępniać.

---

## Krok 1. Dodaj skrypt jako nowy plik

Jeśli w arkuszu są już jakieś makra (np. import wyników z pliku CSV),
**nie kasuj ich i nie dopisuj do ich pliku.** Skrypt strony dodajemy
obok, jako osobny plik.

1. Otwórz swój arkusz w Arkuszach Google.
2. Menu **Rozszerzenia → Apps Script**. Otworzy się nowa karta z edytorem.
3. W lewej kolumnie, przy nagłówku **Pliki**, kliknij **+ → Skrypt**.
4. Nazwij nowy plik **`Strona`** i zatwierdź.
5. Kliknij w pole z kodem, naciśnij **Ctrl + A** i **Delete**. Plik ma
   zostać **całkiem pusty** — razem z domyślną funkcją `myFunction`.
6. Wklej całą zawartość pliku **`Strona.gs`** z tego folderu.
7. Kliknij ikonę dyskietki (**Zapisz projekt**).

> **Najczęstszy błąd na tym kroku:** wklejenie kodu *pomiędzy klamry*
> domyślnej funkcji `myFunction`. Wszystko wygląda wtedy poprawnie,
> zapisuje się bez błędu, ale Apps Script widzi tylko funkcje najwyższego
> poziomu — a `doGet` jest wtedy schowany w środku `myFunction`.
> Przy wdrożeniu zobaczysz „Nie znaleziono funkcji skryptu: doGet".
>
> **Sprawdź po wklejeniu:**
> - pierwsza linia pliku to `/**`, a nie `function myFunction() {`
> - ostatnia linia to pojedyncze `}`
> - lista przy przycisku **Uruchom** pokazuje kilka pozycji: `doGet`,
>   `sprawdz`, `pobierzDane_`. Jeśli widnieje tam samo `myFunction` —
>   kod jest zagnieżdżony, skasuj wszystko i wklej jeszcze raz.

Jeśli projekt jest zupełnie pusty, można równie dobrze wkleić kod do
istniejącego `Kod.gs` — efekt będzie ten sam.

## Krok 2. Sprawdź, czy skrypt widzi dane

1. Na górze edytora, przy przycisku **Uruchom**, wybierz z listy funkcję
   **`sprawdz`**.
2. Kliknij **Uruchom**. (Jeśli na liście jest więcej funkcji, wybierz
   właśnie `sprawdz` — nie uruchamiaj przez pomyłkę makr importujących.)
3. Google poprosi o zgodę: **Sprawdź uprawnienia → wybierz swoje konto →**
   **Zaawansowane → Przejdź do…(nazwa projektu) → Zezwól**.
   To normalne — skrypt należy do Ciebie i czyta tylko ten jeden arkusz.
4. Na dole pojawi się dziennik z listą zakładek i liczbą wierszy.
   Jeśli widzisz swoje rundy — działa.

## Krok 3. Opublikuj jako aplikację internetową

1. Prawy górny róg: **Wdróż → Nowe wdrożenie**.
2. Przy „Wybierz typ" kliknij zębatkę i wybierz **Aplikacja internetowa**.
3. Ustaw:
   - **Opis**: cokolwiek, np. `wyniki dla strony`
   - **Wykonaj jako**: **Ja** (Twoje konto)
   - **Kto ma dostęp**: **Wszyscy**
4. Kliknij **Wdróż**, a potem **Autoryzuj dostęp**, jeśli zapyta.
5. Skopiuj **adres URL aplikacji internetowej**. Kończy się na `/exec`.
6. **Sprawdź od razu**: wklej ten adres w nowej karcie przeglądarki.
   Powinien pokazać się tekst zaczynający się od `{"title":`. Jeśli
   zamiast tego widzisz „Nie znaleziono funkcji skryptu: doGet",
   zajrzyj niżej — to najczęstsza pułapka i naprawia się w kilkanaście
   sekund.

> **„Kto ma dostęp: Wszyscy" nie oznacza, że ktokolwiek zobaczy Twój
> arkusz ani uruchomi Twoje makra.** Pod tym adresem działa wyłącznie
> funkcja `doGet`, która tylko czyta i oddaje wyniki. Makra importujące
> (`Results`, `Makrobeznazwy1` i pozostałe) nie są stamtąd osiągalne:
> uruchamia się je wyłącznie z okna dialogowego wewnątrz arkusza, a takiego
> okna ten adres nie serwuje.
>
> Przy autoryzacji Google wyliczy uprawnienia dla **całego projektu**, więc
> jeśli są w nim makra pokazujące okienka, na liście zgód pojawi się też
> „wyświetlanie i uruchamianie zawartości w Arkuszach". To normalne i wynika
> z sąsiedztwa makr, nie z tego skryptu.

## Krok 4. Wklej adres do strony

W pliku `assets/js/config.js` znajdź sekcję `championships` i uzupełnij
wpis swoich mistrzostw:

```js
{
  id: 'wrc',
  label:  'EA Sports WRC',
  season: { pl: 'Sezon 15', en: 'Season 15' },
  sheetUrl: 'https://docs.google.com/spreadsheets/d/…/edit',
  source: { type: 'apps', url: 'TU_WKLEJ_ADRES_KOŃCZĄCY_SIĘ_NA_/exec' }
}
```

Usuń też z tego wpisu linijkę `demo: true`, jeśli tam jest — od tej pory
strona pokazuje prawdziwe dane.

Odśwież stronę wyników. Powinna pokazać zakładki z arkusza.

---

## Jak to działa na co dzień

Wpisujesz wyniki w arkuszu i nic więcej nie robisz. Strona co minutę pyta
skrypt **tylko o znacznik zmiany** — kilkadziesiąt bajtów. Dopiero gdy
znacznik jest inny niż ostatnio, pobiera pełne dane i podmienia tabelę.
Dzięki temu strona jest aktualna, a arkusz nie jest odpytywany bez
potrzeby.

## Czego strona oczekuje od arkusza

Niczego sztywnego — kolumny rozpoznaje po nagłówkach. Wystarczy, że
nagłówek nazywa się którymś z tych słów (wielkość liter i polskie znaki
nie mają znaczenia):

| Co to jest | Akceptowane nagłówki |
|---|---|
| miejsce | `L.p.`, `Lp`, `Poz`, `Pos`, `Miejsce`, `#` |
| kierowca | `Kierowca`, `Driver`, `Zawodnik`, `Nick` |
| czas | `Czas`, `Time`, `Wynik` |
| punkty | `Punkty`, `Points`, `Suma` |
| zespół | `Zespół`, `Team`, `Ekipa` |
| samochód | `Samochód`, `Car`, `Auto`, `Pojazd` |
| dywizja | `Division`, `Dywizja`, `Klasa` |

Wszystkie pozostałe kolumny z nazwą (np. `Pkt.`, `PS`, `1. LAT`) pokażą
się w tabeli jako dodatkowe kolumny liczbowe — nic nie ginie.

Dywizja w kolumnie **bez nagłówka** też zostanie rozpoznana, jeśli
w środku są wartości typu `PSR1`, `PSR2`, `Rookie`.

## Zakładki, których strona nie pokaże

- ukryte w Arkuszach Google (prawy klik na zakładkę → Ukryj),
- zaczynające się od podkreślenia, np. `_obliczenia`,
- wymienione w liście `POMIJAJ` na górze pliku `Strona.gs`.

Domyślnie pomijane są **`nick`**, **`overall points`** i
**`division points`** — pierwszy zawiera powiązanie pseudonimu z imieniem
i nazwiskiem, dwa pozostałe to arkusze pomocnicze makra importującego.
Sprawdź, czy w Twoim arkuszu nazywają się tak samo; jeśli nie, dopisz je
do listy przed wdrożeniem.

## Gdy coś nie działa

**Strona pokazuje „Nie udało się pobrać wyników".**
Otwórz skopiowany adres `/exec` w przeglądarce. Powinien wyświetlić się
tekst zaczynający się od `{"title":`. Jeśli zamiast tego widzisz prośbę
o zalogowanie, wróć do kroku 3 i sprawdź ustawienie **Kto ma dostęp:
Wszyscy**.

**„Nie znaleziono funkcji skryptu: doGet".**
To najczęstszy błąd i nie ma nic wspólnego z samym kodem. Adres `/exec`
nie serwuje tego, co masz w edytorze — serwuje **zapisaną wersję**
z chwili wdrożenia. Jeśli wdrożenie powstało zanim wkleiłeś ten plik,
albo po wklejeniu nie zrobiłeś nowej wersji, pod tym adresem wciąż jest
stary kod bez `doGet`.

Napraw tak:

1. **Wdróż → Zarządzaj wdrożeniami**
2. Przy aktywnym wdrożeniu kliknij **ołówek** (edytuj)
3. Pole **Wersja** przestaw z „1" na **Nowa wersja**
4. **Wdróż**

Adres `/exec` się **nie zmienia** — to ten sam link, tylko od teraz
wskazuje aktualny kod. W `config.js` nie trzeba nic poprawiać.

Jeśli to nie pomogło, sprawdź w edytorze listę funkcji przy przycisku
**Uruchom**. Powinny tam być `doGet` i `sprawdz`.

Jeśli widnieje tam **tylko `myFunction`**, to znaczy, że kod został
wklejony w środek domyślnej funkcji i wszystkie funkcje są zagnieżdżone.
Kliknij w pole z kodem, **Ctrl + A**, **Delete**, wklej plik jeszcze raz
i zapisz. Pierwsza linia musi brzmieć `/**`.

Jeśli lista funkcji jest pusta: plik nie został zapisany (kliknij
dyskietkę) albo gdzieś w projekcie jest błąd składni, przez który cały
projekt się nie wczytuje — uruchomienie `sprawdz` pokaże wtedy konkretny
komunikat.

Wygodna kontrola: **Wdróż → Testuj wdrożenia** daje adres kończący się
na `/dev`, który zawsze uruchamia najnowszy kod z edytora. Jeśli pod
`/dev` widać `{"title":`, a pod `/exec` błąd — to na pewno kwestia
wersji. Samego `/dev` nie da się użyć na stronie, bo wymaga zalogowania
na konto właściciela.

**Zmieniłem coś w `Strona.gs` i nic się nie zmieniło.**
To samo lekarstwo: **Wdróż → Zarządzaj wdrożeniami →** ołówek →
**Wersja: Nowa wersja → Wdróż**. Sam zapis w edytorze nie wystarczy —
i tak będzie po każdej przyszłej zmianie kodu.

**Wyniki aktualizują się z opóźnieniem do minuty.**
Tak ma być. Strona pyta co 60 sekund, a skrypt trzyma gotową odpowiedź
przez 25 sekund, więc w najgorszym razie mija około półtorej minuty.
Częstotliwość pytania zmienia się w `config.js` w polu `refreshMs`,
a czas przechowywania w `CACHE_SEK` na górze `Strona.gs`.

**Przez chwilę po imporcie runda pokazała się jako pusta.**
Makro importujące na moment czyści zakładkę, zanim wpisze nowe dane.
Jeśli strona trafi akurat w ten moment, pokaże „Ta runda jeszcze się nie
odbyła" — i sama się naprawi przy następnym sprawdzeniu, w ciągu minuty.

---

## Wariant zapasowy, bez Apps Script

Gdyby powyższe okazało się kłopotem, można podać sam arkusz opublikowany
jako CSV. Wtedy każdą zakładkę podaje się osobno:

1. W arkuszu: **Plik → Udostępnij → Opublikuj w internecie**.
2. Wybierz konkretną zakładkę i format **CSV**, kliknij **Opublikuj**.
3. Skopiuj adres i powtórz dla każdej zakładki.
4. W `config.js`:

```js
source: {
  type: 'pubcsv',
  url: 'dowolny-niepusty-tekst',
  tabs: [
    { name: 'Klasyfikacja generalna', url: 'https://docs.google.com/…output=csv' },
    { name: '1. Rajd Łotwy',          url: 'https://docs.google.com/…output=csv' }
  ]
}
```

Ten wariant działa tak samo dla odwiedzającego, ale wymaga ręcznego
dopisania każdej nowej rundy i nie wykrywa zmian — strona pobiera całość
przy każdym sprawdzeniu.
