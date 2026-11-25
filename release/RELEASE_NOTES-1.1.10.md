# Better Agnostr 1.1.10 — Rainbow, stars, and client labels

**This hotfix fixes flair-coloured rainbow text, expands the stars flair, and makes BA and spoofed-client labels consistent in chat.**

## Line effects

- Flair-coloured `&g` rainbow no longer falls back to white.
- Rainbow motion now runs left-to-right.
- Flair-coloured rainbows have stronger contrast against the row background.
- Emoji glyphs keep their own colours under rainbow and colour effects.
- Username obfuscation remains supported.

## Stars flair

- The star field now extends across the full message row.
- Each trigger can spawn 1–3 shooting stars at different positions.
- Shooting stars appear randomly and fade out after their run.

## Badges and client spoofing

- The BA plaque is reapplied on every chat refresh, so it no longer disappears after a re-render.
- Known Better Agnostr peers keep the BA plaque in chat even when their current event has a different client tag.
- Unknown spoofed client tags now appear as a small chat plaque.
- Known BA peers who spoof show **BA · client**.
- Profile, People, and chat badges now use the same known-peer checks.

## Settings persistence

- Better Agnostr now mirrors settings to a local backup on agnostr.com.
- If extension storage is cleared or the extension ID changes during an update, settings are restored automatically.
- The Chromium manifest uses a stable key, so replacing the unpacked folder keeps the same extension ID.

## Release packaging

- Firefox and Chromium builds are published together in this single release entry.
- Chromium remains a pre-release build; Firefox remains unsigned.

## Downloads

- `better-agnostr-1.1.10.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.1.10.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.1.10-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
