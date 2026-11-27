# Better Agnostr 1.3.2 — scalable flairs and seamless rows

**Flairs now fill the message they belong to, and stars stay readable on the light theme.**

## Flairs

- Rebuilt the stars flair as a repeating starfield that scales with row height. Long messages and image messages keep getting stars instead of stopping after two bands.
- Added an ink-black base and light text inside the stars flair, so it no longer disappears or washes out on Agnostr’s default white theme.
- Softened the top and bottom edges of every flaired message layer. Consecutive flaired messages no longer show a hard cutoff line where one row ends.
- Kept the existing stars/shooting-star animation, intensity, and flair limits.

## Notes

- Aurora is otherwise unchanged.
- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.2.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.2.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.2-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
