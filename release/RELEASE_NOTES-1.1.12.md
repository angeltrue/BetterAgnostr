# Better Agnostr 1.1.12 — Native sound effects off

**This hotfix disables Agnostr's separate Sound Effects engine, which was still producing default incoming-message sounds.**

## Fixed

- Disabled Agnostr's **Sound Effects** engine while Better Agnostr is active.
- Stopped default native sounds for incoming messages, mentions, DMs, sends, and UI navigation.
- Hid the native **Appearance → Audio → Sound Effects** control.
- Preserved the native sound-effects value and restored it when Better Agnostr is paused.
- Native notifications, ringtone, vibration, and lock-screen previews remain unchanged.
- Better Agnostr chimes, UI clicks, volume, and chime triggers remain the active sound system.

## Downloads

- `better-agnostr-1.1.12.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.1.12.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.1.12-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
