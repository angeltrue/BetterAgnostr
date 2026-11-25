# Better Agnostr 1.1.14 — Rainbow styles, aurora, sonar, selection fix

**This hotfix adds a selectable Glub/Bright rainbow, reworks aurora into northern lights, fixes the sonar cross artifact, and stops rainbow colours resetting when a message is selected.**

## Rainbow styles

- Added a **Rainbow style** chooser under **Better Agnostr → Line**.
- **Glub** is the default and matches glub.chat: the original palette, no screen blend, no white glow, and right-to-left motion.
- **Bright** keeps the 1.1.11 reworked rainbow: brighter colours, screen blend, white glow, and left-to-right motion.
- The choice stays on this device and is not added to outgoing events.
- Both message previews follow the selected style.
- Emoji keep their own colours in both styles.

## Fixed

- Rainbow colours no longer reset when selecting and deselecting a message. React can rewrite a row's classes while leaving BA's data attributes behind; rows are now re-decorated instead of being skipped, and the flair rainbow fallback stays rainbow rather than becoming a solid colour.
- Sonar no longer shows a large thin cross in the middle of its rings. The scanline overlay that produced it is replaced with a soft radial scope glow.
- Aurora is rebuilt from scratch. It now has layered curtains with vertical rays, folds, a star field, and independent sway and breathing cycles instead of two flat gradient sheets.

## Downloads

- `better-agnostr-1.1.14.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.1.14.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.1.14-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
