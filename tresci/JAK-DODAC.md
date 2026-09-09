# Jak dodać artykuł albo regulamin

Jeden dokument to jeden folder: plik z tekstem i obrazy obok niego.
Nic więcej nie trzeba — po wysłaniu na GitHub strona składa się sama.

```
tresci/
  artykuly/
    2026-05-30-rajd-sardynii/
      tekst.md
      Podium PSR1.jpg
      Zibiman na 3. odcinku.jpg
  regulaminy/
    wrc-sezon-15/
      tekst.md
```

Nazwa folderu staje się adresem: `projectsimracing.pl/artykuly/rajd-sardynii/`.
Data z początku nazwy (`2026-05-30-`) jest z adresu wycinana, a służy do
ustawienia kolejności — najnowsze na górze.

## Nagłówek pliku

Na samej górze `tekst.md`, między liniami z trzema myślnikami. Wszystko
jest opcjonalne — czego nie podasz, skrypt dobierze sam.

```
---
tytul: Rajd Sardynii — finał Sezonu 14.
data: 2026-05-30
opis: Zdanie, które pojawi się na kafelku listy.
miniatura: Podium PSR1.jpg
seria: wrc
pdf: podsumowanie.pdf
ukryty: nie
---
```

| Pole | Czego nie podasz | Skrypt weźmie |
|---|---|---|
| `tytul` | pierwszy nagłówek z tekstu | |
| `data` | datę z nazwy folderu | |
| `opis` | pierwszy akapit | |
| `miniatura` | pierwszy obraz w folderze | |
| `seria` | nic — plakietka po prostu się nie pokaże | |
| `pdf` | nic — przycisk „Pobierz PDF" się nie pokaże | |
| `ukryty` | `tak` chowa dokument, nie kasując go | |

## Tekst

Zwykły Markdown:

```markdown
## Śródtytuł

Akapit. Można **pogrubić**, dać *kursywę* albo [odnośnik](https://…).

- punkt listy
- drugi punkt

1. lista numerowana
2. drugi punkt

> Cytat albo wyróżnione zdanie.

| Miejsce | Punkty |
|---|---|
| 1. | 25 |
| 2. | 18 |
```

Pusta linia oddziela akapity. Nagłówki najwyższego poziomu (`##`) trafiają
do spisu treści z boku — pojawia się, gdy są przynajmniej trzy.

## Obrazy

```markdown
![](Podium PSR1.jpg)
```

Obraz dostaje cienką ramkę, a nad nią ucięty z obu stron równoległobok
z tytułem. **Tytuł to nazwa pliku bez rozszerzenia** — plik
`Podium PSR1.jpg` podpisze się jako „Podium PSR1". Chcesz inny podpis:

```markdown
![Zibiman na trzecim odcinku](Zibiman na 3. odcinku.jpg)
```

Obrazy, których nie wstawisz w tekst, dokleją się na końcu dokumentu.
Skrypt przerabia je na WebP w dwóch szerokościach, więc możesz wrzucać
pliki prosto z gry — nikt nie będzie ściągał kilkunastu megabajtów.

## Poprawianie i usuwanie

Wszystko dzieje się w folderze dokumentu — nie ma żadnej bazy danych,
w której coś mogłoby zostać.

- **Poprawka:** zmieniasz `tekst.md`, uruchamiasz budowanie, wysyłasz.
  Na GitHubie możesz to zrobić bez pobierania czegokolwiek: wchodzisz
  w plik, klikasz ołówek, poprawiasz, „Commit changes" — automat sam
  przebuduje stronę.
- **Ukrycie:** `ukryty: tak` w nagłówku pliku. Dokument znika z listy,
  ale zostaje w repozytorium i wraca po zmianie na `nie`.
- **Usunięcie:** kasujesz folder dokumentu. Przy kolejnym budowaniu
  znika też jego strona — skrypt za każdym razem tworzy `artykuly/`
  i `regulamin/` od nowa, więc nic po nim nie zostaje.
- **Zmiana nazwy folderu** zmienia adres strony. Jeśli link był już
  gdzieś wysłany, lepiej nazwy nie ruszać.

Pomyłka w opublikowanym artykule to więc poprawka pliku i jedno
wysłanie — a nie grzebanie w gotowej stronie.

## Kalendarz

Terminarz to jeden plik: `tresci/kalendarz.md`. Nagłówek zaczyna nową
serię, a identyfikator w klamrach musi się zgadzać z listą mistrzostw:

```markdown
## EA Sports WRC · Sezon 15 {wrc}

| # | Runda | Start | Koniec | Wyniki |
|---|---|---|---|---|
| 1 | Rajd Łotwy | 2026-09-17 20:00 | | 1. LAT |
| 2 | Tydzień Le Mans | 2026-10-05 20:00 | 2026-10-12 22:00 | |
```

- **Start** przyjmuje `2026-09-17 20:00` albo `17.09.2026 20:00`.
  Sama data bez godziny znaczy 20:00. Pusto = „termin wkrótce".
- **Koniec** wypełniasz tylko przy wydarzeniach dłuższych niż wieczór.
  Wtedy przez cały ten czas strona pokazuje „Trwa teraz", odliczanie
  idzie do końca wydarzenia, a obok pojawia się linijka „Następna
  runda: … za X dni". W kalendarzu taka runda ma zakres dat
  („7–14 września") i zieloną plakietkę.
- **Wyniki** to dokładna nazwa zakładki w arkuszu — dzięki temu
  przycisk „Wyniki rundy" prowadzi prosto do właściwej tabeli.

Godziny podajesz w polskim czasie; strona przelicza je na strefę
czasową czytelnika.

## Skąd się biorą strony artykułów i regulaminów

Plik `.md` nie jest stroną — stronę składa z niego skrypt. Dopóki go nie
uruchomisz, adresy `/artykuly/` i `/regulamin/` nie istnieją i serwer
odpowie „Cannot GET /artykuly/". Wystarczy jedno polecenie:

```
python3 narzedzia/buduj.py
```

Powstają wtedy foldery `artykuly/` i `regulamin/` **obok `index.html`**,
razem z terminarzem (`assets/js/kalendarz.js`) i mapą strony,
razem ze stroną każdego dokumentu i mapą strony. Od tej chwili lokalny
podgląd (Live Server, `python3 -m http.server`, cokolwiek) wygląda
dokładnie tak jak strona w internecie — z działającymi odnośnikami.

Skrypt ma też własny podgląd, jeżeli wygodniej:

```
python3 narzedzia/buduj.py --serwuj      # http://localhost:8000
```

Wygenerowane foldery są w `.gitignore`, bo na GitHubie robi je automat —
nie trzeba ich wysyłać. Po zmianie w `.md` uruchamiasz skrypt jeszcze raz.

## Publikacja

Wysyłasz zmiany na GitHub i tyle — automat (`.github/workflows/strona.yml`)
buduje stronę i publikuje ją. W ustawieniach repozytorium
**Settings → Pages** źródłem musi być **GitHub Actions**.

## Stary PDF

Masz dokument tylko w PDF-ie? Jednorazowy import:

```
python3 narzedzia/pdf-na-md.py "Regulamin WRC.pdf"
```

Powstanie folder z `tekst.md` i obrazami. Trzeba go przejrzeć: PDF nie
wie, co było listą, a co tabelą, więc parę rzeczy zwykle wymaga
poprawki. Obrazom warto zmienić nazwy — nazwa pliku jest podpisem.
Od tego momentu dokument żyje jako `.md` i nikt już nie musi zgadywać.
