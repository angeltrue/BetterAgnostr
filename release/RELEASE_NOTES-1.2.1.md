# Better Agnostr 1.2.1 — Plaques, Chrome rainbow, fonts, warnings

**This hotfix removes client names from plaques, hardens rainbow painting in Chromium, replaces the busy serif fonts, renames Bitchat to Chat in the UI, and makes the README warnings impossible to miss.**

## Fixed

- Plaques now say **BA** or nothing. They no longer append another client name, and ordinary users of other clients no longer get a client-name plaque in chat. Profile client pills are unchanged.
- Rainbow text in Chromium now forces transparent descendant fills and keeps the animated background on its own paint layer. This targets the cases where Chrome stopped painting clipped gradient text.
- Every visible Bitchat label in the UI is now **Chat**.

## Fonts

- Removed Playfair Display, Cormorant Garamond, Lora, Literata, Fraunces, and Instrument Serif.
- Added readable replacements: **Source Serif 4**, **IBM Plex Serif**, **Merriweather**, **Crimson Pro**, **Spectral**, and **Noto Serif**.
- Kept **Libre Baskerville**.
- Existing font settings that pointed at removed families migrate to the default font.

## Docs

- README warnings made much larger, louder, and deliberately obnoxious.
- README kept compressed outside the warnings.
- Aurora unchanged.
- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.2.1.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.2.1.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.2.1-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
