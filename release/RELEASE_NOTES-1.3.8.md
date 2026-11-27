# Better Agnostr 1.3.8 — crash hotfix

**Fixes two paths that could drive the browser to a crash on busy chats.**

## Fixed

- Replaced the rain FX `200vh` clip with a bounded per-row clip. The oversized paint area could allocate enormous compositor surfaces and crash the browser in chats with many rain-flaired messages.
- Added a re-entrancy guard and ignored self-generated badge mutations in the People-list observer, preventing it from repeatedly triggering itself.
- Flair behavior is otherwise unchanged from 1.3.7.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.8.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.8.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.8-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
