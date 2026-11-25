# Better Agnostr 1.1.13 — Badge rendering, profile clients, timestamps

**This hotfix fixes plaque rendering under line effects, corrects the client shown in peer profiles, and adds optional timestamp hiding.**

## Fixed

- BA and spoofed-client plaques now render normally when the username uses rainbow, colour, obfuscation, or flair effects.
- Plaque text fill, shadow, clipping, and animation are reset so the badge stays visible.
- Peer profile client pills now follow the event's client tag.
- Spoofed client values appear in the profile pill.
- Better Agnostr clients show a BA-styled **BetterAgnostr** pill.

## Privacy

- Added **Hide timestamps** under **Privacy & Trust → Better Agnostr**.
- Disabled by default.
- Hides per-message clock times in chat while keeping date dividers.

## Downloads

- `better-agnostr-1.1.13.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.1.13.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.1.13-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
