# Better Agnostr 1.3.1 — signer restoration and UI fixes

**Restores the signer path so teleport-tagged messages send again, and fixes the notification, viewer, Chat-label, and font issues from 1.3.0.**

## Signer

- Restored Agnostr's signer hook and the local-key fallback that 1.3.0 removed.
- Discovery is bounded: it backs off instead of walking React at sub-second intervals forever, caches the found instance, and re-checks cheaply.
- Last-mile teleport protection now strips the tag and re-signs with the matching local key; NIP-07 is used as a second fallback when the provider owns the event pubkey.
- If no signer can be reached and a transform is still required, the send is blocked instead of silently sending the original event.

## Fixed

- Call-blocked warnings are rate-limited instead of repeating for every call signal.
- Better Agnostr toasts now follow Agnostr's native toast layout, size, icon, and desktop/mobile placement.
- Removed Agnostr's transient “Image Safety Classifier ready / Running locally via WASM” notification.
- Fixed event viewer scrolling for JSON, tags, Glub previews, and long relay/verify panels.
- Expanded Bitchat → Chat replacement across new rail, drawer, room-switcher, call, and toast labels, including attributes and React text updates.
- Prevented Libre Baskerville and other serif fonts from clipping descenders in the left rail (“Agora”, “Agwallet”) and mobile labels.
- Kept Firefox and Chromium downloads in one release entry.

## Notes

- Aurora is unchanged.
- Firefox and Chromium builds remain in one release entry.

## Downloads

- `better-agnostr-1.3.1.xpi` — Firefox installable package. **Unsigned**; permanent installation in Firefox Release/ESR requires Mozilla signing.
- `better-agnostr-1.3.1.zip` — Firefox package for review or AMO signing.
- `better-agnostr-1.3.1-chromium.zip` — Chromium unpacked pre-release.

Full changelog: https://github.com/angeltrue/BetterAgnostr/blob/main/CHANGELOG.md
