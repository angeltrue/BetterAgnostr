# Better Agnostr 1.3.3 — animated flair edges

**Fixes the remaining flair cutoff that appeared while effects were animating.**

## Flairs

- Flaired layers now extend past the message row and fade over a wider band into the gap between messages, instead of clipping animated particles, curtains, embers, rain, and shooting stars at the row edge.
- The actual row remains fully covered; only the space outside it fades.
- Shooting-star positioning was adjusted for the taller flair layer.
- Static row-to-row seam fixes from 1.3.2 remain in place.

## Notes

- Aurora is otherwise unchanged.
- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.3.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.3.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.3-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
