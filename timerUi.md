# Timer UI (`timerui.riv`) – implementace na web

Dokument je určený pro agenta / vývojáře, který má vložit tento Rive prvek
do jednoduché webové stránky. Popisuje vyexportovaný soubor `timerui.riv`:
jaký runtime použít, jaké má soubor rozhraní (artboard, state machine,
view model), hotový HTML příklad a známá úskalí.

---

## 1. Co prvek dělá

Kruhový minutník (vizuál podobný kuchyňské minutce):

- Ciferník 260 × 260 px s 60 minutovými a 4 hlavními ryskami, červená
  ryska = ukazatel nastaveného času.
- Uživatel **chytne a táhne červený ukazatel** po obvodu ciferníku a nastaví
  0–60 minut (přichytává se po celých minutách; přes 12. hodinu se zastaví na
  0 nebo 60, nepřetočí se).
- Uprostřed je text `MM:SS` (font Major Mono Display).
- Po puštění ukazatele se čas zaokrouhlí na celé minuty a **odpočet se
  spustí automaticky** (logika běží uvnitř `.riv` v Luau skriptu). Ukazatel
  se během odpočtu posouvá zpět k nule. Na `00:00` se odpočet zastaví.

Veškerá interakce (drag, odpočet, formátování textu) je uvnitř souboru.
Web jen zobrazí canvas, volitelně nastaví čas / barvy a poslouchá změny.

---

## 2. Rozhraní souboru

| Položka | Hodnota |
|---|---|
| Artboard | jediný, **bez jména** (výchozí) – v runtime ho nespecifikujte |
| Velikost artboardu | 265 × 265 (čtverec) |
| State machine | `State Machine 1` (je i výchozí) |
| View model | `ViewModel1`, výchozí instance – stačí `autoBind: true` |
| Rive eventy | žádné (stav se čte přes view model) |

### View model `ViewModel1`

| Vlastnost | Typ | Výchozí | Význam | Web smí |
|---|---|---|---|---|
| `time` | number | `0` | Zbývající čas **v sekundách** (0–3600). Skript ho každý snímek snižuje, dokud je > 0 a ukazatel není držen. | číst, zapisovat |
| `isHandleGrabbed` | boolean | `false` | `true`, když uživatel drží ukazatel (nastavuje state machine). | jen číst |
| `backgroundColor` | color | `FF282828` | Barva kruhového ciferníku. | zapisovat |
| `marks60Color` | color | `FFFFFFFF` | Barva 60 malých rysek. | zapisovat |
| `marks4Color` | color | `FFFFFFFF` | Barva 4 hlavních rysek. | zapisovat |
| `artboardColor` | color | `00282828` | Pozadí artboardu za kruhem (výchozí průhledné). | zapisovat |
| `handleColor` | color | `FFD22D2D` | Barva rysky ukazatele (výchozí červená). | zapisovat |
| `sourceX`, `sourceY`, `rotation` | number | – | Interní (pozice ukazatele, úhel). **Nezapisovat.** | nesahat |

Barvy jsou 32bit ARGB integer: `0xAARRGGBB`, např. `0xFF1E90FF`.

### Chování `time` z pohledu webu

- Zápis `vmi.number('time').value = 300` → zobrazí `05:00`, ukazatel skočí
  na 5 min a **hned začne odpočet**.
- Zápis `0` → zastaví / vynuluje.
- Během držení ukazatele (`isHandleGrabbed === true`) skript `time` přepisuje
  podle pozice ukazatele – zápisy z webu v tu dobu nemají smysl.
- Pauza v souboru **není** – z webu nejde odpočet pozastavit (jen nastavit
  nový čas nebo vynulovat).
- Konec odpočtu nemá event – detekujte přechod `time` z > 0 na 0 (příklad níže).

---

## 3. Runtime

Soubor obsahuje **Luau skripty** (logika ukazatele a odpočtu, formátování
času, klonování rysek) a **Rive Text**. Runtime je proto musí podporovat.

- Balíček: **`@rive-app/webgl2`** (doporučený, plná podpora Luau skriptů,
  textu i layoutu; skripty podporuje od verze 2.34.0). Aktuální verze na
  npm: `2.44.0`.
- **Nepoužívat `@rive-app/canvas-lite`** – neobsahuje skriptovací engine ani
  text. Zastaralé `@rive-app/webgl` také ne.
- Stránku je nutné servírovat přes HTTP (`file://` neumí načíst `.riv`/WASM),
  např. `npx serve .` nebo `python -m http.server`.

---

## 4. Minimální implementace (čisté HTML, CDN)

Struktura:

```text
index.html
timerui.riv     <- vyexportovaný soubor
```

`index.html`:

```html
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Minutka</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #1a1a1a;
      font-family: system-ui, sans-serif;
      color: #fff;
    }
    .timer {
      width: min(80vw, 360px);
      aspect-ratio: 1 / 1;
    }
    .timer canvas {
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
    }
  </style>
</head>
<body>
  <div>
    <div class="timer"><canvas id="timer-canvas"></canvas></div>
    <p>
      <button data-min="1">1 min</button>
      <button data-min="5">5 min</button>
      <button data-min="10">10 min</button>
      <button id="reset">Stop</button>
    </p>
    <p id="status"></p>
  </div>

  <script src="https://unpkg.com/@rive-app/webgl2@2.44.0"></script>
  <script>
    const canvas = document.getElementById('timer-canvas');
    const statusEl = document.getElementById('status');

    const r = new rive.Rive({
      src: 'timerui.riv',
      canvas,
      autoplay: true,
      stateMachines: 'State Machine 1',
      autoBind: true,
      layout: new rive.Layout({
        fit: rive.Fit.Contain,
        alignment: rive.Alignment.Center,
      }),
      onLoad: () => {
        r.resizeDrawingSurfaceToCanvas();

        const vmi = r.viewModelInstance;
        const time = vmi.number('time');
        const grabbed = vmi.boolean('isHandleGrabbed');

        let last = time.value;
        time.on(() => {
          const v = time.value;
          if (last > 0 && v <= 0 && !grabbed.value) {
            statusEl.textContent = 'Hotovo!';
          } else if (v > 0) {
            statusEl.textContent = '';
          }
          last = v;
        });

        grabbed.on(() => {
          statusEl.textContent = grabbed.value ? 'Nastavuji…' : '';
        });

        document.querySelectorAll('button[data-min]').forEach((btn) => {
          btn.addEventListener('click', () => {
            time.value = Number(btn.dataset.min) * 60;
          });
        });
        document.getElementById('reset').addEventListener('click', () => {
          time.value = 0;
        });
      },
      onLoadError: (e) => console.error('Rive load error', e),
    });

    window.addEventListener('resize', () => r.resizeDrawingSurfaceToCanvas());
  </script>
</body>
</html>
```

Změna barev (kdykoliv po `onLoad`):

```js
const vmi = r.viewModelInstance;
vmi.color('backgroundColor').value = 0xFF102030;
vmi.color('marks60Color').value = 0x99FFFFFF;
vmi.color('marks4Color').rgb(255, 200, 0);
vmi.color('handleColor').value = 0xFF2DD27A;
vmi.color('artboardColor').value = 0x00000000;
```

---

## 5. Varianta s bundlerem (Vite apod.)

```bash
npm install @rive-app/webgl2@2.44.0
```

```js
import { Rive, Layout, Fit, Alignment } from '@rive-app/webgl2';

const r = new Rive({
  src: '/timerui.riv',
  canvas: document.getElementById('timer-canvas'),
  autoplay: true,
  stateMachines: 'State Machine 1',
  autoBind: true,
  layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  onLoad: () => r.resizeDrawingSurfaceToCanvas(),
});

// při odstranění komponenty (SPA):
// r.cleanup();
```

`.riv` dejte do složky se statickými soubory (`public/`).

React: existuje `@rive-app/react-webgl2` s hooky `useRive`,
`useViewModelInstance`, `useViewModelInstanceNumber` atd. – stejné názvy
vlastností jako v tabulce výše.

---

## 6. Kontrolní seznam po implementaci

1. Stránka běží přes HTTP, v konzoli prohlížeče nejsou chyby.
2. Vykreslí se tmavý kruh s ryskami a text `00:00`.
3. Tažením červené rysky se mění text po minutách (`01:00`, `02:00` …).
4. Po puštění se spustí odpočet (`04:59`, `04:58` …) a ryska se posouvá.
5. Tlačítka nastaví čas a odpočet běží.
6. Na `00:00` se zobrazí stav „Hotovo!“.
7. Ostrost na retina displeji (pokud je rozmazané, chybí
   `resizeDrawingSurfaceToCanvas()`).

---

## 7. Úskalí a poznámky

- **Neuvádějte jméno artboardu** – artboard nemá jméno; runtime vezme výchozí.
- **`Fit.Contain`, ne `Fit.Layout`.** Artboard má pevnou geometrii 265 × 265
  (ryskové uzly jsou umístěné absolutně na střed 130,130); `Fit.Layout` by
  artboard roztahoval na rozměr canvasu a mohl by rozbít rozložení. Velikost
  řiďte CSS rozměrem čtvercového kontejneru.
- **Canvas musí mít CSS velikost** (jinak má 300 × 150 a prvek je malý /
  deformovaný v rámci contain).
- **Ovládání myší/dotykem** zajišťuje runtime sám (listenery ve state
  machine). `touch-action: none` na canvasu zabrání scrollování stránky při
  tažení na mobilu.
- **Odpočet běží ve snímkové smyčce Rive** (`requestAnimationFrame`). Na
  skryté záložce prohlížeč smyčku tlumí/pozastaví, takže odpočet může na
  pozadí zpomalit nebo stát (pravděpodobné chování, neověřeno). Pokud je
  přesnost kritická, držte zdroj pravdy v JS (`Date.now()`) a `time` z webu
  přepisujte.
- **Fonty jsou zabalené v souboru** – web nemusí nic dalšího načítat.
- Web neposlouchá Rive eventy ani state machine inputy – soubor používá
  **pouze data binding** (view model).
