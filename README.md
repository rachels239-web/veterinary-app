# VetApp

Clinical calculators for dogs and cats — fluid therapy, constant rate infusions,
CPR doses, nutrition, transfusion and unit conversion.

Built to run from a phone home screen or a laptop browser, offline, with no
account and no server. Nothing you enter leaves the device.

> **This is a calculation aid.** Every figure should be checked before
> administration, and clinical judgement always overrides a calculator.

## Running it

The app has **no build step**. Open `index.html` through any web server:

```bash
npm run serve      # http://localhost:8080
npm test           # run the formula tests
npm run icons      # regenerate the PWA icons
```

## Putting it on your phone

Once deployed (see below), open the URL and:

- **iPhone** — Share → Add to Home Screen
- **Android** — menu → Install app / Add to Home Screen

It then opens full screen with its own icon and works with no signal.

## Deploying

Pushing to `main` runs the tests and publishes to GitHub Pages automatically.
Enable it once, under **Settings → Pages → Source: GitHub Actions**.

Free GitHub Pages requires a public repository. If you later want it private,
Cloudflare Pages and Netlify both deploy private repos on their free tiers —
point them at this repo with no build command and `/` as the output directory.

## Adding things

Everything clinical lives in `src/data/` as plain JavaScript. You can edit these
files directly in GitHub's web editor from your phone; the change is live within
about a minute.

### A new CRI drug

`src/data/cri-drugs.js` — copy a block and change it:

```js
{
  id: 'dexmedetomidine',
  name: 'Dexmedetomidine',
  defaultStockId: 'dexmed-0.5',
  displayUnit: 'mcg/kg/hr',
  species: {
    dog: { load: 0.001, rate: 0.001, range: [0.0005, 0.003] },
    cat: { load: 0.001, rate: 0.001, range: [0.0005, 0.003] },
  },
  provenance: 'Where these numbers came from',
  notes: 'Anything you want shown under the drug picker.',
}
```

Rates are always stored as **mg/kg/hr** and loading doses as **mg/kg**, whatever
unit you display them in — so 1 µg/kg/hr is `0.001`. The app converts for display.
Add the product to `src/data/concentrations.js` first if it is not there.

### A new combination protocol

`src/data/cri-protocols.js` — name the component drugs and the rates:

```js
{
  id: 'mlk-lowdose',
  name: 'MLK (post-op)',
  longName: 'Reduced-rate MLK for recovery',
  species: ['dog'],
  components: [
    { drug: 'methadone', load: null, rate: 0.1 },
    { drug: 'lidocaine', load: null, rate: 1.5 },
    { drug: 'ketamine', load: null, rate: 0.3 },
  ],
  provenance: 'House protocol',
}
```

Omit `load` or `rate` to fall back to the drug's own default for that species.
`load: null` means no loading dose.

### A new stock concentration

`src/data/concentrations.js` — one line, `mgPerMl` in mg per mL. A 2% solution
is 20 mg/mL; the converter screen will do that arithmetic for you.

### Guideline constants

`src/data/aaha.js` and `src/data/recover2024.js` hold the published figures, each
with a `verified` flag and a note on where it came from.

## What needs checking

Two things were deliberately left incomplete rather than guessed at:

- **AAHA Table 11 (potassium)** — `POTASSIUM.table11` in `src/data/aaha.js` is
  `null`. The potassium calculator works dose-driven (you set mEq/kg/hr, capped
  at 0.5) until the table is transcribed from the primary source.
- **Doses marked `verified: false`** — naloxone, flumazenil, atipamezole and
  calcium gluconate in `src/data/recover2024.js`, and the fentanyl and
  butorphanol CRI ranges. These are conventional figures that were not confirmed
  against the primary documents. They are flagged in the interface too.

## Sources

- [2024 AAHA Fluid Therapy Guidelines for Dogs and Cats](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/) — J Am Anim Hosp Assoc 2024;60(4):131–163
- [2024 RECOVER Guidelines](https://recoverinitiative.org/2024-guidelines/) — Burkitt-Creedon et al., J Vet Emerg Crit Care 2024, doi:10.1111/vec.13391

## Layout

```
index.html            app shell
css/app.css           all styling, light and dark
sw.js                 offline support (network-first, cache fallback)
src/core/             formatting, units, safety checks, patient state, history
src/calc/             the calculations, each returning results plus worked steps
src/data/             drugs, protocols, stock concentrations, guideline constants
src/ui/               screens and shared components
test/                 one test file per calculation module
tools/                icon generator and dev server
```

Every calculation returns its own `steps`, which is what the "show the
calculation" panel renders — the formula in words, then the same formula with
the patient's numbers substituted in.
