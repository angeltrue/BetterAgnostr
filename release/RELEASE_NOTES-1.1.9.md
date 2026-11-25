# Better Agnostr 1.1.9 — Chimes, line effects, and custom actions

**This hotfix replaces Agnostr's message chime with Better Agnostr sounds, fixes line effects, simplifies the settings tabs, and upgrades custom actions.**

## Notifications & sounds

- Agnostr's native notifications, ringtone, vibration, lock-screen previews, and notification settings remain in place.
- Only the native **Message Chimes** control is replaced, with Better Agnostr's procedural chimes, UI clicks, volume, chime triggers, and test buttons.
- The Better Agnostr sound controls use Agnostr's native section and row styling.
- Native message chimes return when Better Agnostr is paused.

## Line effects

- Username obfuscation now works in line templates.
- Colour and rainbow effects no longer override emoji rendering.

## Settings

- Removed the **General** tab from Better Agnostr settings.
- Removed the obsolete shortcut-visibility setting.
- Custom-action text is configured in the custom-action dialog instead of settings.

## Custom actions

- Usernames are no longer appended automatically.
- `{user}` inserts the target and `{sender}` inserts your name; both have paste buttons in the dialog.
- `/me <text>` in the composer sends the same `* action *` format.

## Fixed

- Removed the **"X blocked message(s)"** run notices from chats while Better Agnostr is active.

## Downloads

- `better-agnostr-1.1.9.xpi` — installable package. This build is **unsigned**; Firefox Release/ESR requires Mozilla signing for permanent installation.
- `better-agnostr-1.1.9.zip` — packaged source for review or AMO signing.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
