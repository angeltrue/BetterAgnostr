# Better Agnostr 1.3.6 — flair polish and concrete UI fixes

**Rain now runs through consecutive messages, star density scales down on small rows, and the remaining neon/aurora seams and plaque hacks are replaced.**

## Flairs

- Rain drops continue into the next same-flair message instead of stopping at each row boundary.
- Star bands scale with message height: fewer animated bands on small messages, the full set on tall messages.
- Joined neon rows share one tube color and remove the shared border/glow edge.
- Joined aurora rows no longer fade at their shared boundary, removing the cut line while keeping the outer-run fade.

## UI

- BA plaques are now real `.ba-client-badge` elements with an accessible label, not generated content.
- Native settings controls are injected synchronously when the dialog renders, avoiding the visible pop-in.
- Rail/tab Chat labels have a static CSS fallback so Bitchat does not flash before the adapter updates the DOM.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.6.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.6.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.6-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
