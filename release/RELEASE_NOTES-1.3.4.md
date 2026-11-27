# Better Agnostr 1.3.4 — joined flairs, instant Chat labels, theme consistency

**Same-flair messages now connect into one effect, Chat labels stop flashing, and BA dialogs follow the active theme.**

## Fixed

- Rows with the same flair now remove the edge fade between them, extend across the gap, and square off shared corners. The fade only appears at the outer ends of a run.
- Grouped messages and normal consecutive messages both connect correctly.
- Different flairs still fade separately at their boundaries.
- Bitchat labels are replaced synchronously in the DOM mutation observer, before the next paint, so they no longer flash before becoming Chat.
- Removed the CSS custom-property cycle that forced event-viewer and custom-action dialog text to use the dark fallback on light themes. Both now follow the active Agnostr theme.

## Notes

- The 1.3.2 scalable starfield and dark star card remain.
- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.4.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.4.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.4-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
