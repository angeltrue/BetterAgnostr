# Better Agnostr 1.1.15 — Sonar rings, exact Glub rainbow, Appearance toggle

**This hotfix fixes the sonar ring artifact, restores the CRT scanlines, makes the Glub rainbow match glub.chat exactly, and moves the rainbow switch into Appearance.**

## Fixed

- Sonar: the CRT scanline glass is back. The large thin cross came from the ring layer itself: Chromium mis-rasterizes a box-shadow on a scaled border-radius element, and the 2px border can clip during scaling. The glow is now a gradient pseudo-element and each ring is promoted to its own compositing layer, so the cross no longer appears.
- Glub rainbow now uses glub.chat's own implementation: a 90° gradient scrolling to 200% over 6 seconds, with no screen blend and no white glow.
- Flair-specific rainbow palettes use the same 90° axis in Glub mode.
- Rain's rainbow wildcard flows vertically again, exactly as it does on glub.chat.
- Bright keeps the previous high-contrast 270° rainbow with its screen blend and soft white glow.
- Emoji colours remain untouched in both rainbow styles.

## Appearance

- Moved the rainbow choice out of **Better Agnostr → Line** and into **Appearance → Glub rainbow**.
- Replaced the chip selector with the same inline toggle switch used by the rest of Settings.
- On is Glub (default); off is Bright. The choice stays on this device.
- Aurora is unchanged.

## Downloads

- `better-agnostr-1.1.15.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.1.15.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.1.15-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
