# Better Agnostr Chromium 1.1.9 — pre-release

**Chromium port at feature parity with Firefox 1.1.9: native notifications stay intact, native message chimes are replaced by Better Agnostr sounds, line effects are fixed, and custom actions are upgraded.**

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

## Install

1. Download and unzip `better-agnostr-1.1.9-chromium.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder.
5. Open or reload <https://agnostr.com/>.

This is a pre-release and is not signed by the Chrome Web Store. It requires Chromium 148 or newer. The Firefox build remains on `main`.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main-chromium/CHANGELOG.md
