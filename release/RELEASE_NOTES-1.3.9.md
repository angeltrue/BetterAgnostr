# Better Agnostr 1.3.9 — People badge loop hotfix

**Fixes the Firefox slowdown caused by the People-list BA badge observer.**

## Fixed

- The badge text (`BA`) was being included in the display handle used by the People-list matcher. That made the observer remove and re-add the badge continuously, which could trigger Firefox’s “Better Agnostr is slowing down Firefox” warning.
- Handle and client-label lookups now strip the badge text before matching.
- The bounded rain clip and flair behavior from 1.3.8 remain unchanged.

## Notes

- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.9.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.9.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.9-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
