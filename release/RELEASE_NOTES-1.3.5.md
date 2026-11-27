# Better Agnostr 1.3.5 — rain loops and animated star bands

**Fixes rain popping/artifacts and gives the stars flair more than two animated rows.**

## Flairs

- Rain drops now spawn invisible above the message, enter at the top edge, fall through the row, and fade out at the bottom. The loop no longer pops or fades in inside the message.
- Rain is clipped above and horizontally at the row while still extending below it, preventing phantom droplets and splashes outside the message.
- The stars flair now has six independently timed animated star bands in addition to the full-height repeating field. It no longer animates only two rows.
- Existing same-flair joining, scalable starfield, dark star card, and animated FX extension remain in place.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.5.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.5.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.5-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
