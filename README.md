# Cue Script

**Every part in Shakespeare, as the players had it.**

Elizabethan actors never received a whole play. Each got a *part*: their own
speeches, each preceded by a *cue* (the last few words of the speech before).
Cue Script makes that part for any of the 1,433 speaking roles in 37 plays, then
helps you learn it.

- **Read**: your lines and cues, as a parchment roll. A slider sets the cue
  length, from the authentic one word to the whole preceding speech.
- **Rehearse**: your lines are inked over. Uncover them a word, a line, or a
  speech at a time, with optional first-letter hints.
- **Run lines**: a candle-lit stage that steps through cue → your line, and can
  read each cue aloud (each scene partner gets their own voice).
- **Print**: clean, ink-only sides for the rehearsal room.
- Daylight and candlelight themes, keyboard shortcuts, and a phone-friendly layout.

| | |
| --- | --- |
| ![Home](docs/screenshots/home.jpg) | ![Dramatis personae](docs/screenshots/playbill.jpg) |
| ![Cue script](docs/screenshots/cue-script.jpg) | ![Rehearse](docs/screenshots/rehearse.jpg) |
| ![Run lines](docs/screenshots/run-lines.jpg) | ![Candlelight](docs/screenshots/candlelight.jpg) |

## Getting started

```bash
npm install
npm run dev      # first run fetches the Folger TEI texts and builds the play data
```

Other scripts:

| command          | what it does                                                      |
| ---------------- | ----------------------------------------------------------------- |
| `npm run data`   | regenerate `src/lib/data/` from the TEI texts (pinned commit)     |
| `npm test`       | unit tests for the cue-script builder                             |
| `npm run check`  | type-check                                                        |
| `npm run build`  | prerender the whole site (≈1,500 pages) to `build/`               |

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.
In the repo settings, set **Pages → Source** to **GitHub Actions**.

## How it fits together

```
TEI XML ──► source adapter ──► normalized Play JSON ──► buildPart() ──► UI
             src/lib/sources/   src/lib/play/types.ts    src/lib/play/part.ts
```

- **`src/lib/play/types.ts`**: the normalized `Play` format: scenes, speeches,
  lines (with Folger line numbers, verse/prose, shared-line fragments, songs),
  stage directions, and characters with stats and on-stage presence. Everything
  downstream sees only this format.
- **`src/lib/sources/folger-tei.ts`**: the adapter for Folger TEI Simple. It runs
  against any DOM (`DOMParser` in the browser, `@xmldom/xmldom` in Node).
- **`src/lib/play/part.ts`**: a pure function that turns a `Play` and a character
  into the part: cues (the whole preceding speech is kept, so the UI can trim it
  freely), the character's speeches, and the stage directions that involve them.
  It also produces the rehearsal sequence.
- **Routes**: `/` (search and shelves), `/[play]` (dramatis personae),
  `/[play]/[character]` (the cue script). All pages are prerendered.

### Future: other script sources and uploads

This is the reason for the adapter / normalized-format split. To add a source:

1. Write `src/lib/sources/<name>.ts` that returns a `Play`. Possible sources:
   another edition's TEI, a plain-text script ("NAME. line…"), or Fountain.
2. For **uploads**, run the adapter in the browser on the user's file. Then pass
   the resulting `Play` to `buildPart()` and render with the existing
   components, with no server needed. The user's play could be stored in
   IndexedDB and get a client-side route such as `/my/<id>/<character>`.

## Credits & licence of the texts

The play texts are from [Folger Shakespeare](https://www.folger.edu/explore/shakespeares-works/),
ed. Barbara A. Mowat & Paul Werstine, © Folger Shakespeare Library. They are
licensed [CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/), so the
site must stay non-commercial and keep the attribution. The TEI Simple files
come through [DraCor](https://dracor.org/shake). The idea comes from the Folger's
[parts tool](https://www.folgerdigitaltexts.org/).
