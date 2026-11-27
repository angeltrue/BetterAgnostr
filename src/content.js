import panelCss from "./ui/panel.css";
import pageCss from "./ui/page.css";
import glubFlairCss from "./ui/glub-flair.css";
import { flairClass, flairFxInner, flairHasFx, flairLimit, flairName, flairOverlayInner, flairVars, lightningStrikeMarkup } from "./lib/glub-flair.js";
import { EMOJI_GROUPS } from "./lib/emojis.js";
import {
  CLIENT_PRESETS,
  COLORS,
  COLOR_NAMES,
  FLAIRS,
  FMT_MAX,
  RICH_MAX,
  KIND_GROUPS,
  TEMPLATE_PRESETS,
  escapeHtml,
  getTagValue,
  hasFormat,
  isValidFlair,
  kindGroup,
  normalizeTemplate,
  parseGlubMeta,
  renderFormatHtml,
  renderLineHtml,
  stateClass,
  stateStyle,
  stripFormat,
  tokenize,
} from "./lib/glub.js";
import {
  KIND_POLICIES,
  STORAGE_KEY,
  STRIPPABLE_TAGS,
  clone,
  effectiveBuild,
  mergeSettings,
  normalizeSettings,
} from "./lib/settings.js";
import { VERSION } from "./lib/version.js";

const api = globalThis.browser ?? globalThis.chrome;
const NATIVE_NOTIFICATIONS_KEY = "agnostr:v2:notifications";
const NATIVE_NOTIFICATIONS_BACKUP = "betterAgnostr.nativeNotifications.v1";
const NATIVE_SETTINGS_KEY = "agnostr:v2:settings";
const NATIVE_SETTINGS_BACKUP = "betterAgnostr.nativeSettings.v1";
const SETTINGS_BACKUP_KEY = "betterAgnostr.settings.backup.v1";
const CHIME_LOCK_KEY = "betterAgnostr.lastChime.v1";
const toastCooldowns = new Map();
const NATIVE_SOUND_OWNERS_KEY = "betterAgnostr.nativeSoundOwners.v1";
const NATIVE_SOUND_OWNER_TTL = 12 * 60 * 60 * 1000;
const TAB_ID = (() => {
  try {
    const key = "betterAgnostr.tabId.v1";
    const existing = globalThis.sessionStorage.getItem(key);
    if (existing) return existing;
    const next = `tab-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}-${Date.now()}`;
    globalThis.sessionStorage.setItem(key, next);
    return next;
  } catch {
    return `tab-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}-${Date.now()}`;
  }
})();

function readSettingsBackup() {
  try {
    const raw = localStorage.getItem(SETTINGS_BACKUP_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return saved?.settings && typeof saved.settings === "object" ? saved.settings : null;
  } catch {
    return null;
  }
}

function writeSettingsBackup(settings) {
  try {
    localStorage.setItem(
      SETTINGS_BACKUP_KEY,
      JSON.stringify({ version: 1, savedAt: Date.now(), settings }),
    );
  } catch {}
}

function nativeSoundOwners() {
  try {
    const raw = JSON.parse(localStorage.getItem(NATIVE_SOUND_OWNERS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    const cutoff = Date.now() - NATIVE_SOUND_OWNER_TTL;
    return raw.filter((owner) => owner && typeof owner.id === "string" && Number(owner.at) >= cutoff);
  } catch {
    return [];
  }
}

function writeNativeSoundOwners(owners) {
  try {
    if (!owners.length) localStorage.removeItem(NATIVE_SOUND_OWNERS_KEY);
    else localStorage.setItem(NATIVE_SOUND_OWNERS_KEY, JSON.stringify(owners));
  } catch {}
}

function setNativeSoundFlag(key, backupKey, enabled) {
  try {
    const raw = localStorage.getItem(key);
    let current = {};
    try {
      current = raw ? JSON.parse(raw) : {};
    } catch {
      current = {};
    }
    if (!current || typeof current !== "object") current = {};
    if (enabled === null) delete current.soundEnabled;
    else current.soundEnabled = enabled;
    if (enabled === null && !Object.keys(current).length) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(current));
    if (enabled === null) localStorage.removeItem(backupKey);
  } catch {}
}

function captureNativeSound(key, backupKey) {
  try {
    // Keep only the boolean we actually replace. Restoring a whole settings
    // object used to roll back unrelated notification changes made meanwhile.
    if (localStorage.getItem(backupKey) !== null) return;
    const raw = localStorage.getItem(key);
    let present = false;
    let value = true;
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && Object.prototype.hasOwnProperty.call(parsed, "soundEnabled")) {
        present = true;
        value = parsed.soundEnabled !== false;
      }
    } catch {}
    localStorage.setItem(backupKey, JSON.stringify({ present, value: value === true }));
  } catch {}
}

function restoreNativeSound(key, backupKey) {
  try {
    const backup = localStorage.getItem(backupKey);
    if (backup === null) return;
    const saved = JSON.parse(backup);
    setNativeSoundFlag(key, backupKey, saved?.present ? saved.value !== false : null);
  } catch {
    try {
      localStorage.removeItem(backupKey);
    } catch {}
  }
}

function claimNativeSounds() {
  const owners = nativeSoundOwners();
  const ours = owners.some((owner) => owner.id === TAB_ID);
  captureNativeSound(NATIVE_NOTIFICATIONS_KEY, NATIVE_NOTIFICATIONS_BACKUP);
  captureNativeSound(NATIVE_SETTINGS_KEY, NATIVE_SETTINGS_BACKUP);
  setNativeSoundFlag(NATIVE_NOTIFICATIONS_KEY, NATIVE_NOTIFICATIONS_BACKUP, false);
  setNativeSoundFlag(NATIVE_SETTINGS_KEY, NATIVE_SETTINGS_BACKUP, false);
  if (!ours) owners.push({ id: TAB_ID, at: Date.now() });
  writeNativeSoundOwners(owners);
}

function releaseNativeSounds() {
  const owners = nativeSoundOwners().filter((owner) => owner.id !== TAB_ID);
  writeNativeSoundOwners(owners);
  if (owners.length) return;
  restoreNativeSound(NATIVE_NOTIFICATIONS_KEY, NATIVE_NOTIFICATIONS_BACKUP);
  restoreNativeSound(NATIVE_SETTINGS_KEY, NATIVE_SETTINGS_BACKUP);
}

function overrideNativeSounds() {
  claimNativeSounds();
}

function restoreNativeSounds() {
  releaseNativeSounds();
}

const FONT_PRESETS = [
  { id: "default", label: "Agnostr default" },
  { id: "inter", label: "Inter", stack: "Inter, system-ui, sans-serif" },
  { id: "jetbrains", label: "JetBrains Mono", stack: "'JetBrains Mono', ui-monospace, monospace", mono: true },
  { id: "plex", label: "IBM Plex Sans", stack: "'BA IBM Plex Sans', 'IBM Plex Sans', sans-serif" },
  { id: "atkinson", label: "Atkinson Hyperlegible", stack: "'BA Atkinson', 'Atkinson Hyperlegible', sans-serif" },
  { id: "lexend", label: "Lexend", stack: "'BA Lexend', Lexend, sans-serif" },
  { id: "source-serif", label: "Source Serif 4", stack: "'BA Source Serif', 'Source Serif 4', Georgia, serif" },
  { id: "plex-serif", label: "IBM Plex Serif", stack: "'BA Plex Serif', 'IBM Plex Serif', Georgia, serif" },
  { id: "merriweather", label: "Merriweather", stack: "'BA Merriweather', Merriweather, Georgia, serif" },
  { id: "crimson", label: "Crimson Pro", stack: "'BA Crimson', 'Crimson Pro', Georgia, serif" },
  { id: "spectral", label: "Spectral", stack: "'BA Spectral', Spectral, Georgia, serif" },
  { id: "noto-serif", label: "Noto Serif", stack: "'BA Noto Serif', 'Noto Serif', Georgia, serif" },
  { id: "baskerville", label: "Libre Baskerville", stack: "'BA Baskerville', 'Libre Baskerville', Georgia, serif" },
  { id: "noto", label: "Noto Sans", stack: "'Noto Sans', system-ui, sans-serif" },
  { id: "source", label: "Source Sans 3", stack: "'Source Sans 3', 'Source Sans Pro', sans-serif" },
  { id: "fira", label: "Fira Sans", stack: "'Fira Sans', system-ui, sans-serif" },
  { id: "ubuntu", label: "Ubuntu", stack: "Ubuntu, system-ui, sans-serif" },
  { id: "custom", label: "Custom font" },
];


import {
  ALL_THEMES,
  GLUB_THEMES,
  buildThemeCss,
  themeById,
  themeSwatch,
} from "./lib/themes.js";
import {
  CLICK_SOUNDS,
  MESSAGE_SOUNDS,
  playClickSound,
  playMessageSound,
  previewSound,
  unlockAudio,
} from "./lib/sounds.js";

const state = {
  settings: normalizeSettings({}),
  pageToken: `ba-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}-${Date.now()}`,
  pageReady: false,
  helloAttempts: 0,
  enabledReady: false,
  status: null,
  events: new Map(),
  aliases: new Map(),
  logs: [],
  pending: new Map(),
  host: null,
  shadow: null,
  ui: {},
  activeTab: "studio",
  viewer: null,
  viewerRequestSeq: 0,
  review: null,
  reviewQueue: [],
  modalOpen: null,
  modalReturnFocus: null,
  logFilter: "",
  buildError: "",
  buildStale: false,
  buildFetching: false,
  lastOutgoingId: null,
  decoratedRows: new Set(),
  richApplied: new WeakMap(),
  betterPeers: new Map(),
  peerClients: new Map(),
  emojiCategory: "smileys",
  lastBetterClients: 0,
  betterClientsTimer: null,
  lastBitchatReplace: 0,
  bitchatTimer: null,
  lastCallMaintenance: 0,
  callMaintenanceTimer: null,
  settingsEpoch: 0,
  fontCssSignature: "",
  enhancePending: false,
  obfCache: [],
  obfNextScan: 0,
  pageObserver: null,
  pageObserverStart: null,
  pendingLookups: new Set(),
  enhanceTimer: null,
  saveTimer: null,
  toasts: new Set(),
  verified: new Map(),
  entities: new Map(),
  restoreMap: new WeakMap(),
  richObservers: new WeakMap(),
  richRoots: new Set(),
  richRepairing: new WeakSet(),
  repairingRows: new WeakSet(),
  logRenderTimer: null,
  themeStyle: null,
  pageStyle: null,
  callObserver: null,
  sendSeq: 0,
  pageSeen: new Set(),
  settingsBetterActive: false,
  aboutActive: false,
  settingsModalOpen: false,
  betterTab: "line",
  betterPreviewSig: "",
  settingsTimer: null,
  contextTarget: null,
  customAction: null,
  seenChimeIds: new Set(),
  ownEventIds: new Set(),
  agnostrActiveThemeCard: null,
  lastChimeAt: 0,
  lastUiSoundAt: 0,
  soundUnlocked: false,
  themeCssSignature: "",
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function h(value) {
  return escapeHtml(String(value ?? ""));
}
const EMOJI_DOM_RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\u20E3|[\u{1F3FB}-\u{1F3FF}])?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?)*)/gu;

const OBF_BUCKETS = [
  "0123456789",
  "abcdefghijklmnopqrstuvwxyz",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ".,;:!?'\"`",
  "@#$%^&*()_+-=[]{}<>/\\|~",
];

function obfGlyph(ch) {
  for (const bucket of OBF_BUCKETS) if (bucket.includes(ch)) return bucket[Math.floor(Math.random() * bucket.length)];
  return ch;
}

const obfBursts = new WeakMap();

function startObfBurst(real, now) {
  const candidates = [];
  const chars = [...real];
  for (let i = 0; i < chars.length; i++) {
    if (OBF_BUCKETS.some((bucket) => bucket.includes(chars[i]))) candidates.push(i);
  }
  if (!candidates.length) return null;
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const count = Math.min(2, 1 + (Math.random() < 0.3 ? 1 : 0), candidates.length);
  return { indices: candidates.slice(0, count), until: now + 280 + Math.random() * 200 };
}

function tickObfuscation() {
  if (document.hidden) return;
  const now = performance.now();
  // Scan on a slow clock even when the cache is empty. The old condition also
  // re-queried whenever the cache was empty, turning this into a 10 Hz full-document
  // query on every page with no obfuscated text.
  if (now >= state.obfNextScan) {
    state.obfCache = [...document.querySelectorAll(".fmtObf")];
    if (state.shadow) state.obfCache.push(...state.shadow.querySelectorAll(".fmtObf"));
    state.obfNextScan = now + 1200;
  }
  const els = state.obfCache.filter((el) => el.isConnected);
  state.obfCache = els;
  if (!els.length) return;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  for (const el of els) {
    if (el.dataset.obfText == null) el.dataset.obfText = el.textContent || "";
    const real = el.dataset.obfText;
    if (!real) continue;
    if (still) {
      // Prefer readable text for reduced-motion users instead of freezing a
      // permanently scrambled string that screen readers and users cannot parse.
      if (el.textContent !== real) el.textContent = real;
      el.dataset.obfStatic = "1";
      continue;
    }
    let burst = obfBursts.get(el);
    if (!burst) {
      if (Math.random() >= 0.01) {
        if (el.textContent !== real) el.textContent = real;
        continue;
      }
      burst = startObfBurst(real, now);
      if (!burst) continue;
      obfBursts.set(el, burst);
    }
    if (now >= burst.until) {
      obfBursts.delete(el);
      if (el.textContent !== real) el.textContent = real;
      continue;
    }
    const chars = [...real];
    for (const index of burst.indices) chars[index] = obfGlyph(chars[index]);
    const next = chars.join("");
    if (el.textContent !== next) el.textContent = next;
  }
}


function handleGlobalClickSound(event) {
  if (!state.settings.sounds.clickEnabled || state.settings.sounds.click === "off") return;
  const path = event.composedPath?.() || [];
  const isPreview = path.some(
    (el) =>
      el instanceof Element &&
      (el.matches('[data-action^="preview-"]') || el.matches('[data-ba-settings-action^="preview-"]')),
  );
  if (isPreview) return;
  const interactive = path.some(
    (el) =>
      el instanceof Element &&
      el.matches('button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], select, .ag-set-nav-item, .ag-ctx-item, .ag-rail-tile, .ag-msg-act-btn'),
  );
  if (!interactive) return;
  if (Date.now() - state.lastUiSoundAt < 45) return;
  state.lastUiSoundAt = Date.now();
  playClickSound(state.settings.sounds.click, state.settings.sounds.volume);
}

function getPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

function short(value, len = 10) {
  const s = String(value || "");
  return s.length > len ? `${s.slice(0, len)}…` : s;
}

function kindLabel(kind) {
  if (kind === 20000) return "chat";
  if (kind === 20001) return "presence";
  if (kind === 23333) return "named chat";
  if (kind === 1) return "note";
  if (kind === 0) return "profile";
  if (kind === 3) return "contacts";
  if (kind === 7) return "reaction";
  if (kind === 5) return "deletion";
  if (kind === 4) return "dm";
  if (kind === 13) return "seal";
  if (kind === 14) return "dm";
  if (kind === 1059) return "gift wrap";
  if (kind === 25050) return "call signal";
  return `kind ${kind}`;
}

function timeLabel(ts) {
  try {
    return new Date(ts < 1e12 ? ts * 1000 : ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function dateLabel(ts) {
  try {
    return new Date(ts < 1e12 ? ts * 1000 : ts).toLocaleString();
  } catch {
    return "";
  }
}

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return String(url || "");
  }
}

function debounceSave() {
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(persistSettings, 180);
}

async function persistSettings() {
  try {
    await api.storage.local.set({ [STORAGE_KEY]: state.settings });
    // Only advance the backup after the authoritative write succeeds. The old
    // order let a failed extension-storage write leave a newer backup that was
    // then ignored on the next load.
    writeSettingsBackup(state.settings);
  } catch (err) {
    console.warn("[Better Agnostr] could not save settings", err);
  }
}

function broadcastConfig() {
  sendPage("config", { settings: JSON.stringify(state.settings) });
}

function updateSettings(mutator, { broadcast = true, sync = true } = {}) {
  const next = clone(state.settings);
  mutator(next);
  state.settings = normalizeSettings(next);
  state.settingsEpoch += 1;
  state.lastBetterClients = 0;
  state.lastCallMaintenance = 0;
  debounceSave();
  if (broadcast) broadcastConfig();
  if (sync) {
    syncInputs();
    syncDynamic();
    applyTheme();
    applyCallCss();
    ensureToolbars();
    applyShortcutVisibility();
    scheduleEnhance();
    scheduleSettingsSync();
  }
}

function markSettingsDirty() {
  debounceSave();
  broadcastConfig();
}

// ---------------------------------------------------------------------------
// Page bridge
// ---------------------------------------------------------------------------

function sendPage(type, payload = {}, id) {
  state.sendSeq += 1;
  const envelope = { __ba: true, dir: "ui", token: state.pageToken, seq: state.sendSeq, type, payload, id };
  try {
    window.postMessage(envelope, location.origin);
  } catch {}
}

function askPage(type, payload = {}, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const id = `ba-req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const timer = window.setTimeout(() => {
      state.pending.delete(id);
      resolve(null);
    }, timeoutMs);
    state.pending.set(id, (value) => {
      window.clearTimeout(timer);
      resolve(value);
    });
    sendPage(type, payload, id);
  });
}

function hello() {
  if (state.pageReady) return;
  state.helloAttempts += 1;
  sendPage("hello", { settings: JSON.stringify(state.settings) });
  if (state.helloAttempts < 120) window.setTimeout(hello, 250);
}

async function refreshBuild(force = false) {
  if (state.buildFetching) return;
  state.buildFetching = true;
  try {
    const res = await api.runtime.sendMessage({ type: "getGlubBuild", force });
    if (res?.build) {
      state.buildStale = !!res.stale;
      state.buildError = res.stale && res.error ? `Using cached build: ${res.error}` : "";
      const nextBuild = String(res.build);
      const changed = state.settings.glub.build !== nextBuild;
      state.settings.glub.build = nextBuild;
      state.settings.glub.buildFetchedAt = Number(res.fetchedAt) || Date.now();
      if (changed) markSettingsDirty();
      syncDynamic();
    } else if (res?.error) {
      state.buildStale = false;
      state.buildError = String(res.error);
      syncDynamic();
    }
  } catch (err) {
    state.buildError = err instanceof Error ? err.message : String(err);
    syncDynamic();
  } finally {
    state.buildFetching = false;
  }
}

function handlePageMessage(event) {
  if (event.source && event.source !== window && event.source !== window.wrappedJSObject) return;
  if (event.origin && event.origin !== location.origin) return;
  const data = event?.data;
  if (!data || data.__ba !== true || data.dir !== "page") return;
  if (!data.token || data.token !== state.pageToken) return;
  if (data.seq != null) {
    const key = `${data.token || ""}:seq:${data.seq}`;
    if (state.pageSeen.has(key)) return;
    state.pageSeen.add(key);
    if (state.pageSeen.size > 300) {
      const first = state.pageSeen.values().next().value;
      if (first) state.pageSeen.delete(first);
    }
  }
  handlePageData(data);
}

function handlePageData(data) {
  if (!data.token || data.token !== state.pageToken) return;
  if (!state.enabledReady || state.settings.enabled === false) return;

  if (data.id && state.pending.has(data.id)) {
    const fn = state.pending.get(data.id);
    state.pending.delete(data.id);
    fn(data.payload);
    return;
  }

  switch (data.type) {
    case "ready":
      state.pageReady = true;
      sendPage("config", { settings: state.settings });
      askPage("getRecent", { limit: 300 }).then((res) => {
        if (res?.events) {
          for (const ev of res.events) rememberEvent(ev);
          scheduleEnhance();
          renderRelaySoon();
        }
      });
      refreshBuild(false);
      break;
    case "status": {
      const previous = state.status || {};
      state.status = data.payload || {};
      if (
        previous.pubkey !== state.status.pubkey ||
        previous.signerHooked !== state.status.signerHooked ||
        previous.signMode !== state.status.signMode ||
        previous.nip07Patched !== state.status.nip07Patched ||
        previous.eventCount !== state.status.eventCount
      ) {
        scheduleEnhance();
      }
      if (state.status.build) {
        // The page's build value comes from our config, so only copy it when we
        // have nothing better cached.
        if (!state.settings.glub.build) {
          state.settings.glub.build = state.status.build;
          state.settings.glub.buildFetchedAt = state.status.buildFetchedAt || Date.now();
          void persistSettings();
        }
      }
      syncFooter();
      syncBuildBadges();
      scheduleSettingsSync();
      if (state.activeTab === "relay") renderRelay();
      break;
    }
    case "logs": {
      const logs = data.payload?.logs || [];
      appendLogs(logs);
      break;
    }
    case "recent": {
      const events = data.payload?.events || [];
      for (const ev of events) rememberEvent(ev);
      scheduleEnhance();
      renderRelaySoon();
      break;
    }
    case "event": {
      const ev = data.payload?.event;
      if (ev) rememberEvent(ev);
      break;
    }
    case "alias": {
      if (data.payload?.from && data.payload?.to) {
        state.aliases.set(data.payload.from, data.payload.to);
        if (state.aliases.size > 1000) {
          const first = state.aliases.keys().next().value;
          if (first) state.aliases.delete(first);
        }
        scheduleEnhance();
      }
      break;
    }
    case "notice":
      toast(data.payload?.level || "info", data.payload?.title || "Better Agnostr", data.payload?.detail || "");
      break;
    case "build": {
      // The page asks for a live build stamp. The request id is on the envelope.
      const reqId = data.id;
      refreshBuild(!!data.payload?.force)
        .then(() => {
          const build = effectiveBuild(state.settings);
          sendPage(
            "response",
            { build, fetchedAt: state.settings.glub.buildFetchedAt, error: state.buildError, stale: state.buildStale },
            reqId,
          );
        })
        .catch((err) => {
          sendPage("response", { build: effectiveBuild(state.settings), fetchedAt: state.settings.glub.buildFetchedAt, error: String(err), stale: state.buildStale }, reqId);
        });
      break;
    }
    case "review": {
      const proposed = data.payload?.proposed;
      if (!proposed || typeof proposed !== "object" || !Array.isArray(proposed.tags)) {
        if (data.id) sendPage("response", { action: "cancel" }, data.id);
        break;
      }
      queueReview(data.payload || {}, data.id);
      break;
    }
    case "verified": {
      if (state.viewer?.event?.id) {
        state.verified.set(state.viewer.event.id, data.payload);
        if (state.verified.size > 500) {
          const first = state.verified.keys().next().value;
          if (first) state.verified.delete(first);
        }
        if (state.viewer.tab === "verify") renderViewer();
      }
      break;
    }
    case "entities": {
      if (state.viewer?.event?.id) {
        state.entities.set(state.viewer.event.id, data.payload || {});
        if (state.entities.size > 500) {
          const first = state.entities.keys().next().value;
          if (first) state.entities.delete(first);
        }
        renderViewer();
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Event data
// ---------------------------------------------------------------------------

function isValidEventShape(ev) {
  return (
    ev &&
    typeof ev === "object" &&
    typeof ev.id === "string" &&
    /^[0-9a-f]{64}$/i.test(ev.id) &&
    typeof ev.pubkey === "string" &&
    (ev._reconstructed ? true : /^[0-9a-f]{64}$/i.test(ev.pubkey)) &&
    Number.isFinite(ev.kind) &&
    Number.isFinite(ev.created_at) &&
    typeof ev.content === "string" &&
    Array.isArray(ev.tags)
  );
}

function rememberEvent(ev) {
  if (!isValidEventShape(ev)) return false;
  const existing = state.events.get(ev.id);
  let changed = false;
  if (!existing) {
    state.events.set(ev.id, ev);
    changed = true;
  } else if (existing._reconstructed && !ev._reconstructed) {
    state.events.set(ev.id, ev);
    changed = true;
  }
  if (ev.pubkey && Array.isArray(ev.tags)) {
    const pubkey = String(ev.pubkey).toLowerCase();
    if (isBetterClient(ev)) {
      state.betterPeers.set(pubkey, eventHandle(ev));
      if (state.betterPeers.size > 2000) {
        const first = state.betterPeers.keys().next().value;
        if (first) state.betterPeers.delete(first);
      }
    }
    const client = String(getTagValue(ev.tags, "client") || "").trim();
    if (client) {
      const at = Number(ev.created_at) || 0;
      const previous = state.peerClients.get(pubkey);
      if (!previous || at >= previous.at) state.peerClients.set(pubkey, { name: client, at });
      if (state.peerClients.size > 2000) {
        const first = state.peerClients.keys().next().value;
        if (first) state.peerClients.delete(first);
      }
    }
  }
  // Bound memory.
  const cap = Math.max(100, Math.min(5000, Number(state.settings.inspector?.maxEvents) || 1500));
  if (state.events.size > cap) {
    const first = state.events.keys().next().value;
    if (first) state.events.delete(first);
  }
  return changed;
}

function eventById(id) {
  if (!id) return null;
  if (state.events.has(id)) return state.events.get(id);
  const alias = state.aliases.get(id);
  if (alias && state.events.has(alias)) return state.events.get(alias);
  return null;
}

function appendLogs(logs) {
  if (!Array.isArray(logs) || !logs.length) return;
  const internalKinds = new Set([25050, 25051, 25052, 25053, 25054, 25055, 25058, 25059, 30078]);
  let changed = false;
  for (const log of logs) {
    if (!log || typeof log !== "object") continue;
    if (log.event && rememberEvent(log.event)) changed = true;
    if (log.dir === "out" && log.eventId) {
      state.ownEventIds.add(log.eventId);
      if (!internalKinds.has(log.kind)) state.lastOutgoingId = log.eventId;
    }
    if (log.dir === "in" && log.event && isValidEventShape(log.event)) handleIncomingAlert(log.event);
  }
  state.logs.push(...logs);
  if (state.logs.length > 300) state.logs.splice(0, state.logs.length - 300);
  if (state.ownEventIds.size > 2000) {
    const first = state.ownEventIds.values().next().value;
    if (first) state.ownEventIds.delete(first);
  }
  if (changed) scheduleEnhance();
  renderRelaySoon();
  syncLastOutgoing();
}

function isMentionEvent(event) {
  if (!event) return false;
  const own = String(state.status?.pubkey || "").toLowerCase();
  if (own) {
    for (const tag of event.tags || []) {
      if (Array.isArray(tag) && tag[0] === "p" && String(tag[1] || "").toLowerCase() === own) return true;
    }
  }
  const name = String(state.status?.nickname || "").toLowerCase();
  if (!name) return false;
  const tag = own ? own.slice(-4) : "";
  const content = String(event.content || "").toLowerCase();
  const needles = [`@${name}`, ...(tag ? [`@${name}#${tag}`] : [])];
  for (const needle of needles) {
    let start = content.indexOf(needle);
    while (start !== -1) {
      const before = start === 0 ? "" : content[start - 1];
      const end = start + needle.length;
      const after = content[end] || "";
      if (!/[a-z0-9_]/i.test(before) && !/[a-z0-9_]/i.test(after)) return true;
      start = content.indexOf(needle, start + 1);
    }
  }
  return false;
}

function alertKind(event) {
  const kind = Number(event?.kind);
  if (kind === 20000 || kind === 23333) return isMentionEvent(event) ? "mention" : "chat";
  if (kind === 4 || kind === 14 || kind === 1059) return "dm";
  if (kind >= 25050 && kind <= 25059) return "call";
  return "";
}

function alertAllowed(kind, events) {
  if (kind === "dm") return events.dm !== false;
  if (kind === "call") return events.calls === true && !state.settings.privacy.calls.disable;
  if (kind === "chat" || kind === "mention") {
    if (events.chat === false) return false;
    if (events.mentionOnly && kind !== "mention") return false;
    return true;
  }
  return false;
}

function handleIncomingAlert(event) {
  if (!event) return;
  const kind = alertKind(event);
  if (!kind) return;
  const events = state.settings.sounds.events || {};
  if (!alertAllowed(kind, events)) return;
  if (state.seenChimeIds.has(event.id) || state.ownEventIds.has(event.id)) return;
  const age = Math.floor(Date.now() / 1000) - Number(event.created_at || 0);
  if (!Number.isFinite(age) || age < -10 || age > 15) return;
  const own = state.status?.pubkey?.toLowerCase();
  if (own && String(event.pubkey || "").toLowerCase() === own) return;
  state.seenChimeIds.add(event.id);
  const now = Date.now();
  if (now - state.lastChimeAt < 350) return;
  try {
    const shared = Number(localStorage.getItem(CHIME_LOCK_KEY) || 0);
    if (now - shared < 350) return;
    localStorage.setItem(CHIME_LOCK_KEY, String(now));
  } catch {}
  state.lastChimeAt = now;
  if (state.seenChimeIds.size > 1000) {
    const first = state.seenChimeIds.values().next().value;
    if (first) state.seenChimeIds.delete(first);
  }
  const sounds = state.settings.sounds;
  if (sounds.messageEnabled && sounds.message !== "off") {
    playMessageSound(sounds.message, sounds.volume);
  }
}

function renderRelaySoon() {
  if (state.activeTab !== "relay") return;
  window.clearTimeout(state.logRenderTimer);
  state.logRenderTimer = window.setTimeout(renderRelay, 120);
}

// ---------------------------------------------------------------------------
// Host / shell
// ---------------------------------------------------------------------------

function ensureHost() {
  if (state.host) return;
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", ensureHost, { once: true });
    return;
  }
  const host = document.createElement("div");
  host.id = "better-agnostr-host";
  host.setAttribute("data-better-agnostr", "1");
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  state.host = host;
  state.shadow = shadow;

  const style = document.createElement("style");
  style.textContent = panelCss;
  shadow.appendChild(style);
  const flairStyle = document.createElement("style");
  flairStyle.textContent = glubFlairCss;
  shadow.appendChild(flairStyle);

  const shell = document.createElement("div");
  shell.innerHTML = shellHtml();
  shadow.appendChild(shell);
  state.ui = { shell };

  injectPageStyles();
  wireShell();
  buildDynamicParts();
  syncInputs();
  syncDynamic();
  applyTheme();
  applyCallCss();
  updatePanelVisibility();
}

function modalWrap(which) {
  return state.shadow?.querySelector(`[data-modal='${which}']`) || null;
}

function modalFocusable(wrap) {
  if (!wrap) return [];
  return [...wrap.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el instanceof HTMLElement && !el.hidden && el.getAttribute("aria-hidden") !== "true");
}

function setModalOpen(which, open) {
  const wrap = modalWrap(which);
  if (!wrap) return;
  if (open && state.modalOpen && state.modalOpen !== which) setModalOpen(state.modalOpen, false);
  wrap.hidden = !open;
  wrap.classList.toggle("is-open", open);
  wrap.setAttribute("aria-hidden", open ? "false" : "true");
  if ("inert" in wrap) wrap.inert = !open;
  if (open) {
    wrap.removeAttribute("inert");
    state.modalOpen = which;
    state.modalReturnFocus = document.activeElement;
    window.requestAnimationFrame(() => {
      if (state.modalOpen !== which) return;
      const dialog = wrap.querySelector("[role='dialog']");
      const first = modalFocusable(wrap)[0];
      if (first instanceof HTMLElement) first.focus();
      else if (dialog instanceof HTMLElement) {
        dialog.setAttribute("tabindex", "-1");
        dialog.focus();
      }
    });
  } else {
    wrap.setAttribute("inert", "");
    if (state.modalOpen === which) state.modalOpen = null;
    const target = state.modalReturnFocus;
    state.modalReturnFocus = null;
    if (target instanceof HTMLElement && target.isConnected) {
      try {
        target.focus({ preventScroll: true });
      } catch {}
    }
  }
}

function trapModalKey(event) {
  if (!state.modalOpen) return false;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    if (state.modalOpen === "review") finishReview("cancel");
    else if (state.modalOpen === "action") closeActionModal();
    else if (state.modalOpen === "viewer") closeViewer();
    return true;
  }
  if (event.key !== "Tab") return false;
  const wrap = modalWrap(state.modalOpen);
  const items = modalFocusable(wrap);
  if (!items.length) {
    event.preventDefault();
    return true;
  }
  const active = state.shadow?.activeElement || document.activeElement;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && (active === first || !items.includes(active))) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || !items.includes(active))) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

function shellHtml() {
  return `
  <div class="ba-modal-wrap" data-modal="viewer" aria-hidden="true" hidden>
    <div class="ba-modal-backdrop" data-close-modal="viewer"></div>
    <div class="ba-modal" role="dialog" aria-modal="true" aria-label="Event details">
      <div data-role="viewer-content"></div>
    </div>
  </div>
  <div class="ba-modal-wrap" data-modal="review" aria-hidden="true" hidden>
    <div class="ba-modal-backdrop" data-close-modal="review"></div>
    <div class="ba-modal small" role="dialog" aria-modal="true" aria-label="Review outgoing event">
      <div data-role="review-content"></div>
    </div>
  </div>
  <div class="ba-modal-wrap" data-modal="action" aria-hidden="true" hidden>
    <div class="ba-modal-backdrop" data-close-modal="action"></div>
    <div class="ba-modal small" role="dialog" aria-modal="true" aria-label="Custom action">
      <div data-role="action-content"></div>
    </div>
  </div>
  <div class="ba-toasts" data-role="toasts" role="status" aria-live="polite" aria-atomic="false"></div>
`;
}

// ---------------------------------------------------------------------------
// Page styles
// ---------------------------------------------------------------------------

function injectPageStyles() {
  const head = document.head || document.documentElement;
  if (!document.getElementById("ba-glub-flair-css")) {
    const flairStyle = document.createElement("style");
    flairStyle.id = "ba-glub-flair-css";
    flairStyle.textContent = glubFlairCss;
    head.appendChild(flairStyle);
  }
  if (!state.pageStyle || !state.pageStyle.isConnected) {
    const existing = document.getElementById("ba-page-css");
    if (existing) state.pageStyle = existing;
    else {
      const style = document.createElement("style");
      style.id = "ba-page-css";
      style.textContent = pageCss;
      head.appendChild(style);
      state.pageStyle = style;
    }
  }
  applyTheme();
}

function applyRainbowStyle() {
  const mode = state.settings.studio.rainbowStyle === "bright" ? "bright" : "glub";
  document.documentElement.dataset.baRainbow = mode;
  if (state.host) state.host.dataset.baRainbow = mode;
}

function applyUiPreferences() {
  document.documentElement.classList.toggle(
    "ba-hide-notification-button",
    state.settings.appearance?.hideNotificationButton === true,
  );
}

function applyTheme() {
  const head = document.head || document.documentElement;
  if (!head) return;
  if (!state.themeStyle || !state.themeStyle.isConnected) {
    state.themeCssSignature = "";
    state.themeStyle = document.getElementById("ba-theme-css");
    if (!state.themeStyle) {
      state.themeStyle = document.createElement("style");
      state.themeStyle.id = "ba-theme-css";
      head.appendChild(state.themeStyle);
    }
  }
  applyRainbowStyle();
  applyUiPreferences();
  if (state.themeStyle.parentNode === head && head.lastElementChild !== state.themeStyle) {
    // Keep BA's custom CSS behind late-injected app stylesheets.
    head.appendChild(state.themeStyle);
  }
  const theme = themeById(state.settings.theme.preset);
  const themeCss = theme ? buildThemeCss(theme) : "";
  if (theme) document.documentElement.dataset.baTheme = theme.id;
  else delete document.documentElement.dataset.baTheme;
  const next = `${themeCss}\n${state.settings.theme.customCss || ""}`;
  if (next !== state.themeCssSignature) {
    state.themeStyle.textContent = next;
    state.themeCssSignature = next;
  }
  applyFont();
}

function safeFontUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (!/^(https:|moz-extension:|chrome-extension:|data:font)/i.test(value)) return "";
  return value;
}

function applyFont() {
  const head = document.head || document.documentElement;
  if (!head) return;
  let style = document.getElementById("ba-font-css");
  if (!style || !style.isConnected) {
    state.fontCssSignature = "";
    style = document.createElement("style");
    style.id = "ba-font-css";
    head.appendChild(style);
  }
  const f = state.settings.font;
  const family = FONT_PRESETS.find((p) => p.id === f.family) || FONT_PRESETS[0];
  const bundled = `
@font-face{font-family:"BA IBM Plex Sans";src:url("${api.runtime.getURL("fonts/plex-400.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"BA IBM Plex Sans";src:url("${api.runtime.getURL("fonts/plex-600.woff2")}") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"BA Atkinson";src:url("${api.runtime.getURL("fonts/atkinson-400.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"BA Atkinson";src:url("${api.runtime.getURL("fonts/atkinson-700.woff2")}") format("woff2");font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:"BA Lexend";src:url("${api.runtime.getURL("fonts/lexend-400.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"BA Lexend";src:url("${api.runtime.getURL("fonts/lexend-600.woff2")}") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"BA Source Serif";src:url("${api.runtime.getURL("fonts/source-serif-400.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"BA Source Serif";src:url("${api.runtime.getURL("fonts/source-serif-600.woff2")}") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"BA Plex Serif";src:url("${api.runtime.getURL("fonts/plex-serif-400.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"BA Plex Serif";src:url("${api.runtime.getURL("fonts/plex-serif-600.woff2")}") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"BA Merriweather";src:url("${api.runtime.getURL("fonts/merriweather-400.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"BA Merriweather";src:url("${api.runtime.getURL("fonts/merriweather-600.woff2")}") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"BA Crimson";src:url("${api.runtime.getURL("fonts/crimson-400.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"BA Crimson";src:url("${api.runtime.getURL("fonts/crimson-600.woff2")}") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"BA Spectral";src:url("${api.runtime.getURL("fonts/spectral-400.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"BA Spectral";src:url("${api.runtime.getURL("fonts/spectral-600.woff2")}") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"BA Noto Serif";src:url("${api.runtime.getURL("fonts/noto-serif-400.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"BA Noto Serif";src:url("${api.runtime.getURL("fonts/noto-serif-600.woff2")}") format("woff2");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"BA Baskerville";src:url("${api.runtime.getURL("fonts/baskerville-400.woff2")}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"BA Baskerville";src:url("${api.runtime.getURL("fonts/baskerville-700.woff2")}") format("woff2");font-weight:700;font-style:normal;font-display:swap}
`;
  let extra = "";
  let stack = family.stack || "";
  if (f.family === "custom") {
    const customFamily = String(f.customFamily || "").replace(/[\\"'{};\r\n]/g, "").trim();
    const url = safeFontUrl(f.customUrl);
    if (url) {
      extra = `@font-face{font-family:"BA Custom";src:url(${JSON.stringify(url)});font-style:normal;font-display:swap}`;
      stack = `"BA Custom"${customFamily ? `, "${customFamily}"` : ""}, sans-serif`;
    } else if (customFamily) {
      stack = `"${customFamily}", sans-serif`;
    }
  }
  const css = !stack
    ? bundled
    : `${bundled}
${extra}
html:root{${family.mono ? `--font-sans: ${stack} !important; --font-mono: ${stack} !important;` : `--font-sans: ${stack} !important;`}}`;
  if (css === state.fontCssSignature) return;
  state.fontCssSignature = css;
  style.textContent = css;
}

function applyCallCss() {
  const calls = state.settings.privacy.calls;
  document.documentElement.classList.toggle("ba-calls-hidden", !!(calls.disable && calls.hideUi));
  document.documentElement.classList.toggle("ba-hide-locate", state.settings.privacy.hideLocate !== false);
  document.documentElement.classList.toggle("ba-hide-timestamps", state.settings.privacy.hideTimestamps === true);
  removeCallMenuItems();
  applyCallButtons();
  hideCallUi();
  markLocateButtons();
}

function markLocateButtons() {
  const hide = state.settings.privacy.hideLocate !== false;
  for (const btn of document.querySelectorAll("button")) {
    if (!(btn instanceof HTMLElement)) continue;
    const label = `${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""} ${btn.title || ""}`;
    if (/locate me|locate my area/i.test(label)) {
      btn.classList.toggle("ba-locate-hidden", hide);
    }
  }
}

function isCallControlText(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return /(?:^|\b)(?:(?:start|join|answer|leave|end)\s+(?:(?:voice|video)\s+)?call|(?:voice|video)\s+call)\b|voice lounge|chat group call/i.test(value);
}

function removeCallMenuItems() {
  const calls = state.settings.privacy.calls;
  if (!calls.disable) {
    for (const item of document.querySelectorAll("[data-ba-call-disabled]")) {
      if (!(item instanceof HTMLElement)) continue;
      item.disabled = false;
      item.style.display = item.dataset.baCallDisplay || "";
      delete item.dataset.baCallDisplay;
      delete item.dataset.baCallDisabled;
    }
    return;
  }
  for (const label of document.querySelectorAll(".ag-ctx-item-label")) {
    if (!isCallControlText(label.textContent)) continue;
    const item = label.closest(".ag-ctx-item");
    if (!item) continue;
    item.disabled = true;
    item.dataset.baCallDisabled = "1";
    if (calls.hideUi) {
      if (item.dataset.baCallDisplay === undefined) item.dataset.baCallDisplay = item.style.display;
      item.style.display = "none";
    }
  }
}

function hideCallUi() {
  const calls = state.settings.privacy.calls;
  if (!calls.disable || !calls.hideUi) {
    for (const el of document.querySelectorAll("[data-ba-call-ui-hidden]")) {
      el.style.display = el.dataset.baCallDisplay || "";
      delete el.dataset.baCallDisplay;
      delete el.dataset.baCallUiHidden;
    }
    return;
  }
  for (const el of document.querySelectorAll(
    '[class*="ag-call-"], [class*="ag-geo-call-"], [class*="ag-srv-voice-"], [class*="ag-srv-discord-voice-"]',
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.closest(".ag-settings-modal, .ba-better-overlay, .ba-about-overlay")) continue;
    if (el.dataset.baCallDisplay === undefined) el.dataset.baCallDisplay = el.style.display;
    el.style.display = "none";
    el.dataset.baCallUiHidden = "1";
  }
  for (const section of document.querySelectorAll(".ag-sheet-section")) {
    const title = section.querySelector(".ag-sheet-section-title")?.textContent || "";
    if (!section.querySelector(".ag-sheet-call-card") && !/group call|voice call|video call/i.test(title)) continue;
    if (section.dataset.baCallDisplay === undefined) section.dataset.baCallDisplay = section.style.display;
    section.style.display = "none";
    section.dataset.baCallUiHidden = "1";
  }
}

function applyCallButtons() {
  const calls = state.settings.privacy.calls;
  const blocked = !!calls.disable;
  for (const btn of document.querySelectorAll("button")) {
    if (btn.closest(".ag-settings-modal")) continue;
    const text = `${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""} ${btn.title || ""}`.replace(/\s+/g, " ").trim();
    if (!isCallControlText(text)) continue;
    if (blocked) {
      btn.disabled = true;
      btn.dataset.baCallDisabled = "1";
      btn.classList.add("ba-call-disabled");
    } else if (btn.dataset.baCallDisabled === "1") {
      btn.disabled = false;
      delete btn.dataset.baCallDisabled;
      btn.classList.remove("ba-call-disabled");
    }
    if (blocked) {
      if (calls.hideUi) {
        if (btn.dataset.baCallDisplay === undefined) btn.dataset.baCallDisplay = btn.style.display;
        btn.style.display = "none";
        btn.dataset.baCallHidden = "1";
      }
    } else if (btn.dataset.baCallHidden === "1") {
      btn.style.display = btn.dataset.baCallDisplay || "";
      delete btn.dataset.baCallDisplay;
      delete btn.dataset.baCallHidden;
    }
  }
}

function blockCallControlClick(event) {
  if (!state.enabledReady || state.settings.enabled === false) return;
  if (!state.settings.privacy.calls.disable) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const control = target.closest("button, a, [role='button'], .ag-ctx-item, .ag-sheet-action-btn");
  if (!control) return;
  const text = `${control.textContent || ""} ${control.getAttribute("aria-label") || ""} ${control.title || ""}`;
  if (!isCallControlText(text)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

document.addEventListener("click", blockCallControlClick, true);
document.addEventListener("pointerdown", blockCallControlClick, true);

// ---------------------------------------------------------------------------
// Agnostr settings integration
// ---------------------------------------------------------------------------

const CHECK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';

const PREVIEW_MESSAGE = "The sky above the port was the color of television, tuned to a dead channel.";


function themeCardHtml(theme) {
  const [bg, surface, accent] = themeSwatch(theme);
  const active = state.settings.theme.preset === theme.id;
  return `<button type="button" class="ag-set-theme-card${active ? " active" : ""}" data-ba-glub-theme="${theme.id}" aria-pressed="${active ? "true" : "false"}">
    <div class="ag-set-theme-swatch" style="background-color:${bg};">
      <span class="ag-set-swatch-rail" style="background-color:${surface};">
        <span class="ag-set-swatch-pill" style="background-color:${accent};"></span>
        <span class="ag-set-swatch-line" style="background-color:${surface};"></span>
      </span>
      <span class="ag-set-swatch-stream">
        <span class="ag-set-swatch-row" style="background-color:${surface};"></span>
        <span class="ag-set-swatch-row short" style="background-color:${surface};"></span>
      </span>
    </div>
    <div class="ag-set-theme-info">
      <span class="ag-set-theme-name">${h(theme.label)}</span>
      <span class="ag-set-theme-tag">${h(theme.description)}</span>
    </div>
    ${active ? `<span class="ag-set-theme-check" aria-hidden="true">${CHECK_ICON}</span>` : ""}
  </button>`;
}

function glubThemeGroupHtml() {
  return `<div class="ag-set-group ba-glub-theme-group" data-ba-settings-group="themes">
    <span class="ag-set-label">Glub.chat themes</span>
    <div class="ag-set-theme-grid ba-glub-theme-grid" role="group" aria-label="Choose a Glub.chat theme">
      ${GLUB_THEMES.map(themeCardHtml).join("")}
    </div>
  </div>`;
}

function customCssGroupHtml() {
  return `<div class="ag-set-group ba-glub-css-group" data-ba-settings-group="css">
    <div class="ba-set-label-row"><span class="ag-set-label">Better Agnostr custom CSS</span><button type="button" class="ba-set-link" data-ba-settings-action="reset-css">clear</button></div>
    <textarea class="ag-input ba-set-css" data-ba-setting="theme.customCss" aria-label="Better Agnostr custom CSS" spellcheck="false" rows="4" placeholder="html:root { --accent: #ff4ecd; }">${h(state.settings.theme.customCss)}</textarea>
    <div class="ba-set-note">Injected after the selected theme. Use html:root for variable overrides.</div>
  </div>`;
}

function rainbowStyleGroupHtml() {
  const glub = state.settings.studio.rainbowStyle !== "bright";
  return `<div class="ag-set-group" data-ba-settings-group="rainbow">
    <label class="ag-set-toggle-card ba-set-toggle">
      <div class="ag-set-toggle-copy">
        <span class="ag-set-toggle-title">Glub rainbow</span>
        <span class="ag-set-toggle-desc">Use glub.chat's rainbow palette and motion; off switches to the bright rainbow</span>
      </div>
      <input class="ag-switch" type="checkbox" data-ba-rainbow-toggle${glub ? " checked" : ""}>
    </label>
  </div>`;
}

function baToggle(path, title, desc = "") {
  const checked = !!getPath(state.settings, path);
  return `<label class="ag-set-toggle-card ba-set-toggle">
    <div class="ag-set-toggle-copy">
      <span class="ag-set-toggle-title">${h(title)}</span>
      ${desc ? `<span class="ag-set-toggle-desc">${h(desc)}</span>` : ""}
    </div>
    <input class="ag-switch" type="checkbox" data-ba-setting="${path}"${checked ? " checked" : ""}>
  </label>`;
}


function interfaceGroupHtml() {
  return `<div class="ag-set-group" data-ba-settings-group="interface">
    ${baToggle("appearance.hideNotificationButton", "Hide notification button", "Remove the Alerts button from the rail and mobile tab bar")}
  </div>`;
}

function betterSettingsPaneHtml() {
  const tabs = [
    ["line", "Line"],
    ["client", "Client"],
  ];
  return `<div class="ba-settings-shell" data-ba-better-pane="1">
    <div class="ba-set-tabs" role="tablist" aria-label="Better Agnostr sections">
      ${tabs.map(([id, label]) => `<button type="button" class="ba-set-tab${state.betterTab === id ? " is-active" : ""}" data-ba-better-tab="${id}" id="ba-tab-${id}" role="tab" aria-selected="${state.betterTab === id ? "true" : "false"}" aria-controls="ba-tabpanel-${id}" tabindex="${state.betterTab === id ? "0" : "-1"}">${label}</button>`).join("")}
    </div>
    <div class="ba-set-content" data-ba-better-content role="tabpanel" id="ba-tabpanel-${state.betterTab}" aria-labelledby="ba-tab-${state.betterTab}"></div>
  </div>`;
}

function betterLineHtml() {
  const template = state.settings.studio.template;
  return `
    <div class="ba-set-preview" data-ba-settings-preview></div>

    <div class="ag-set-group">
      ${baToggle("studio.enabled", "Apply line & flair", "Outgoing chat messages")}
      ${baToggle("studio.applyRich", "Convert & codes", "Keep plaintext in content")}
    </div>

    <div class="ag-set-group">
      <div class="ba-set-label-row">
        <span class="ag-set-label">Line format</span>
        <span class="ba-set-count" data-ba-template-count></span>
      </div>
      <input class="ag-input ba-set-template" data-ba-setting="studio.template" aria-label="Line format template" maxlength="200" spellcheck="false" autocomplete="off" value="${h(template)}" placeholder="&l{name}&7{tag}&f: {msg}">
      <div class="ba-set-chips">
        <button type="button" class="ba-set-chip" data-ba-template-placeholder="{name}">{name}</button>
        <button type="button" class="ba-set-chip" data-ba-template-placeholder="{tag}">{tag}</button>
        <button type="button" class="ba-set-chip" data-ba-template-placeholder="{msg}">{msg}</button>
      </div>
      <div class="ba-set-colors">
        ${Object.entries(COLORS)
          .map(([code, color]) => `<button type="button" class="ba-set-swatch" data-ba-template-code="&${code}" title="&amp;${code}" style="background:${color}">${code}</button>`)
          .join("")}
      </div>
      <div class="ba-set-tools">
        ${[["&l", "B", "bold"], ["&o", "I", "italic"], ["&n", "U", "underline"], ["&m", "S", "strike"], ["&k", "K", "obfuscate"], ["&g", "G", "rainbow"], ["&r", "R", "reset"]]
          .map(([code, label, title]) => `<button type="button" class="ba-set-tool" data-ba-template-code="${code}" title="${title}">${label}</button>`)
          .join("")}
      </div>
      <div class="ba-set-chips">
        ${TEMPLATE_PRESETS.map((p) => `<button type="button" class="ba-set-chip" data-ba-template-preset="${h(p.value)}">${h(p.label)}</button>`).join("")}
      </div>
    </div>

    <div class="ag-set-group">
      <span class="ag-set-label">Flair</span>
      <div class="ba-set-flairs">
        <button type="button" class="ba-set-flair${!state.settings.studio.flair ? " active" : ""}" data-ba-flair-choice="" aria-pressed="${!state.settings.studio.flair ? "true" : "false"}">none</button>
        ${FLAIRS.map((f) => `<button type="button" class="ba-set-flair${state.settings.studio.flair === f.name ? " active" : ""}${f.gated ? " gated" : ""}" data-ba-flair-choice="${f.name}" aria-pressed="${state.settings.studio.flair === f.name ? "true" : "false"}" title="${h(f.description)}">${h(f.label)}</button>`).join("")}
      </div>
    </div>

    <div class="ag-set-group">
      ${baToggle("studio.showComposerToolbar", "Composer formatting bar")}
      ${baToggle("studio.renderInAgnostr", "Render flair in Agnostr")}
      ${baToggle("studio.renderRichInAgnostr", "Render rich text in Agnostr")}
      ${baToggle("studio.reduceMotion", "Reduce motion")}
    </div>`;
}

function betterClientHtml() {
  const policies = state.settings.client.policies;
  return `
    <div class="ag-set-group">
      <span class="ag-set-label">Client tag</span>
      <input class="ag-input" data-ba-setting="client.name" aria-label="Client tag" maxlength="64" spellcheck="false" autocomplete="off" value="${h(state.settings.client.name)}">
      <div class="ba-set-chips">
        ${CLIENT_PRESETS.map((name) => `<button type="button" class="ba-set-chip" data-ba-client-preset="${h(name)}">${h(name)}</button>`).join("")}
      </div>
    </div>
    <div class="ag-set-group">
      <span class="ag-set-label">Per event type</span>
      <div class="ba-set-policies">
        ${KIND_GROUPS.map((g) => `<div class="ba-set-policy">
          <span>${h(g.label)}</span>
          <select class="ag-input ba-set-select" data-ba-client-policy="${g.id}" aria-label="${h(g.label)} client policy">
            ${KIND_POLICIES.map((p) => `<option value="${p}"${policies[g.id] === p ? " selected" : ""}>${p}</option>`).join("")}
          </select>
        </div>`).join("")}
      </div>
      <div class="ba-set-note">Applied when an event is signed.</div>
    </div>`;
}

function renderBetterTabContent(modal) {
  const content = modal.querySelector("[data-ba-better-content]");
  if (!content) return;
  if (state.betterTab === "client") content.innerHTML = betterClientHtml();
  else content.innerHTML = betterLineHtml();
  content.id = `ba-tabpanel-${state.betterTab}`;
  content.setAttribute("aria-labelledby", `ba-tab-${state.betterTab}`);
  for (const tab of modal.querySelectorAll("[data-ba-better-tab]")) {
    const active = tab.getAttribute("data-ba-better-tab") === state.betterTab;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.tabIndex = active ? 0 : -1;
  }
  state.betterPreviewSig = "";
  if (state.betterTab === "line") renderBetterPreview(modal);
}

function previewAvatarSrc() {
  const img = document.querySelector(".ag-conv-footer .ag-profile-avatar, .ag-profile-avatar");
  if (img && img.tagName === "IMG" && img.getAttribute("src")) return img.getAttribute("src");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="hsl(258,30%,14%)"/><rect x=".75" y=".75" width="38.5" height="38.5" rx="9.25" fill="none" stroke="hsla(300,75%,60%,.32)"/><rect x="8" y="8" width="6" height="6" rx="1.5" fill="hsl(258,82%,60%)"/><rect x="17" y="8" width="6" height="6" rx="1.5" fill="hsl(300,82%,66%)"/><rect x="26" y="8" width="6" height="6" rx="1.5" fill="hsl(258,82%,60%)"/><rect x="8" y="17" width="6" height="6" rx="1.5" fill="hsl(300,82%,66%)"/><rect x="17" y="17" width="6" height="6" rx="1.5" fill="hsl(258,82%,60%)"/><rect x="26" y="17" width="6" height="6" rx="1.5" fill="hsl(300,82%,66%)"/><rect x="8" y="26" width="6" height="6" rx="1.5" fill="hsl(258,82%,60%)"/><rect x="17" y="26" width="6" height="6" rx="1.5" fill="hsl(300,82%,66%)"/><rect x="26" y="26" width="6" height="6" rx="1.5" fill="hsl(258,82%,60%)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function previewRowHtml({ name, tag, avatar, line, flair, reduceMotion = false }) {
  const flairClasses = flair ? flairClass(flair) : "";
  const flairStyle = flair ? flairStyleVars(flairVars(flair)) : "";
  const fx = flair && flairHasFx(flair) ? `<span class="flairFx" aria-hidden="true">${flairFxInner(flair)}</span>` : "";
  const overlay = flair ? flairOverlayInner(flair) : "";
  return `<div class="ba-set-preview-row ${flairClasses}${reduceMotion ? " flairQuiet" : ""}" style="${flairStyle}">
      <img class="ba-set-preview-avatar" src="${h(avatar)}" alt="">
      <span class="ba-set-preview-main">
        <span class="ba-set-preview-meta"><span class="ba-set-preview-name">${h(name)}</span><span class="ba-set-preview-tag">#${h(tag)}</span></span>
        <span class="ba-set-preview-line">${line}</span>
      </span>
      ${fx}${overlay}
    </div>`;
}

function previewBlockHtml(options) {
  return `<div class="ba-set-preview">${previewRowHtml(options)}</div>`;
}

function renderBetterPreview(modal) {
  const el = modal.querySelector("[data-ba-settings-preview]");
  if (!el) return;
  const s = state.settings;
  const template = s.studio.enabled ? s.studio.template : "";
  const flair = s.studio.enabled ? s.studio.flair : "";
  const name = state.status?.nickname || "you";
  const tag = (state.status?.pubkey || "a1b2c3d4").slice(-4);
  const msg = PREVIEW_MESSAGE;
  const avatar = previewAvatarSrc();
  const sig = JSON.stringify([template, flair, msg, name, tag, avatar, s.studio.enabled, s.studio.reduceMotion, s.studio.rainbowStyle]);
  if (sig === state.betterPreviewSig) return;
  state.betterPreviewSig = sig;
  const msgHtml = renderFormatHtml(msg);
  let line;
  try {
    line = renderLineHtml(template, { name, tag, msgHtml, msgText: msg });
  } catch {
    line = h(msg);
  }
  el.innerHTML = previewBlockHtml({
    name,
    tag,
    avatar,
    line: line || h(msg),
    flair,
    reduceMotion: s.studio.reduceMotion,
  });
  const count = modal.querySelector("[data-ba-template-count]");
  if (count) count.textContent = `${template.length}/200${template.includes("{msg}") ? "" : " · {msg} appended"}`;
}


function syncBetterSettings(modal) {
  for (const el of modal.querySelectorAll("[data-ba-setting]")) {
    const path = el.getAttribute("data-ba-setting");
    const value = getPath(state.settings, path);
    if (el === document.activeElement) continue;
    if (el.type === "checkbox") el.checked = !!value;
    else el.value = value ?? "";
  }
  for (const el of modal.querySelectorAll("[data-ba-client-policy]")) {
    const group = el.getAttribute("data-ba-client-policy");
    el.value = state.settings.client.policies[group] || "leave";
  }
  for (const el of modal.querySelectorAll("[data-ba-strip-tag]")) {
    el.checked = state.settings.privacy.stripTags.includes(el.getAttribute("data-ba-strip-tag"));
  }
  for (const el of modal.querySelectorAll("[data-ba-review-group]")) {
    el.checked = state.settings.privacy.reviewGroups.includes(el.getAttribute("data-ba-review-group"));
  }
  for (const el of modal.querySelectorAll("[data-ba-flair-choice]")) {
    const active = (el.getAttribute("data-ba-flair-choice") || "") === (state.settings.studio.flair || "");
    el.classList.toggle("active", active);
    el.setAttribute("aria-pressed", active ? "true" : "false");
  }
  const count = modal.querySelector("[data-ba-template-count]");
  if (count) {
    const template = state.settings.studio.template;
    count.textContent = `${template.length}/200${template.includes("{msg}") ? "" : " · {msg} appended"}`;
  }
  if (state.betterTab === "line") renderBetterPreview(modal);
}

function scheduleSettingsSync() {
  if (state.settingsTimer !== null) return;
  state.settingsTimer = window.setTimeout(() => {
    state.settingsTimer = null;
    syncSettingsIntegration();
  }, 70);
}

function ensureBetterNav(modal) {
  const navList = modal.querySelector(".ag-set-nav-list");
  if (!navList) return null;
  let nav = navList.querySelector("[data-ba-settings-nav]");
  if (nav) return nav;
  const appearance = [...navList.querySelectorAll(".ag-set-nav-item")].find((b) => b.textContent.includes("Appearance"));
  const source = appearance || navList.querySelector(".ag-set-nav-item");
  if (!source) return null;
  nav = source.cloneNode(true);
  nav.classList.remove("active");
  nav.removeAttribute("aria-current");
  nav.removeAttribute("id");
  nav.removeAttribute("aria-controls");
  nav.removeAttribute("aria-describedby");
  nav.setAttribute("data-ba-settings-nav", "1");
  const icon = nav.querySelector(".ag-set-nav-icon");
  if (icon) {
    icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z"/></svg>';
  }
  const label = nav.querySelector(".ag-set-nav-label");
  if (label) label.textContent = "Better Agnostr";
  const sub = nav.querySelector(".ag-set-nav-sub");
  if (sub) sub.textContent = "Line, flair & client";
  nav.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.settingsBetterActive = true;
    state.aboutActive = false;
    syncSettingsIntegration();
  });
  source.after(nav);
  return nav;
}

function nativeSettingsNav(modal) {
  const items = [
    ...modal.querySelectorAll(
      ".ag-set-nav-list .ag-set-nav-item:not([data-ba-settings-nav]):not([data-ba-about-nav])",
    ),
  ];
  return items.find((item) => !item.classList.contains("active")) || items[0] || null;
}

// On mobile Agnostr's settings modal starts on the nav list and only shows the
// detail pane after a native nav item click. Our cloned nav items have no React
// handler, so open the native detail view first, then render our pane into it.
function enterSettingsMobileDetail(modal) {
  if (!window.matchMedia?.("(max-width: 867px)")?.matches) return false;
  if (!modal.classList.contains("mobile-menu")) return false;
  if (modal.dataset.baMobileEntering === "1") return true;
  const native = nativeSettingsNav(modal);
  if (!native) return false;
  const better = state.settingsBetterActive;
  const about = state.aboutActive;
  modal.dataset.baMobileEntering = "1";
  native.click();
  let tries = 0;
  const fail = () => {
    state.settingsBetterActive = false;
    state.aboutActive = false;
    delete modal.dataset.baMobileEntering;
    modal.classList.remove("ba-better-active", "ba-about-active");
    scheduleSettingsSync();
  };
  const check = () => {
    if (!modal.isConnected) {
      fail();
      return;
    }
    if (!modal.classList.contains("mobile-menu")) {
      delete modal.dataset.baMobileEntering;
      state.settingsBetterActive = better;
      state.aboutActive = about;
      syncSettingsIntegration();
      return;
    }
    tries += 1;
    if (tries < 30) window.setTimeout(check, 30);
    else fail();
  };
  window.setTimeout(check, 20);
  return true;
}

function ensureAboutNav(modal) {
  const navList = modal.querySelector(".ag-set-nav-list");
  if (!navList) return null;
  let nav = navList.querySelector("[data-ba-about-nav]");
  if (nav) {
    if (nav.nextElementSibling) navList.appendChild(nav);
    return nav;
  }
  const better = navList.querySelector("[data-ba-settings-nav]");
  const source = better || navList.querySelector(".ag-set-nav-item");
  if (!source) return null;
  nav = source.cloneNode(true);
  nav.classList.remove("active");
  nav.removeAttribute("aria-current");
  nav.removeAttribute("id");
  nav.removeAttribute("aria-controls");
  nav.removeAttribute("aria-describedby");
  nav.removeAttribute("data-ba-settings-nav");
  nav.setAttribute("data-ba-about-nav", "1");
  const icon = nav.querySelector(".ag-set-nav-icon");
  if (icon) {
    icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
  }
  const label = nav.querySelector(".ag-set-nav-label");
  if (label) label.textContent = "About";
  const sub = nav.querySelector(".ag-set-nav-sub");
  if (sub) sub.textContent = "Version & credits";
  nav.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.aboutActive = true;
    state.settingsBetterActive = false;
    syncSettingsIntegration();
  });
  navList.appendChild(nav);
  return nav;
}

function agnostrBuildId() {
  const script = [...document.querySelectorAll("script[src]")].find((s) => /\/assets\/index-[^/]+\.js/.test(s.getAttribute("src") || ""));
  const src = script?.getAttribute("src") || "";
  const match = src.match(/index-([A-Za-z0-9_-]+)\.js/);
  return match ? match[1] : "";
}

function openProfileByNpub(npub) {
  const value = String(npub || "").trim();
  if (!value) return;
  const modal = document.querySelector(".ag-settings-modal");
  modal?.querySelector(".ag-sheet-close-btn")?.click();
  window.setTimeout(() => {
    try {
      location.hash = `dm=${value}`;
    } catch {}
    let tries = 0;
    const open = () => {
      const header = document.querySelector(".ag-header");
      const identity = document.querySelector(".ag-header-identity");
      const text = header?.innerText || "";
      if (identity && /encrypted dm|direct message|dm/i.test(text)) {
        identity.click();
        return;
      }
      tries += 1;
      if (tries < 40) window.setTimeout(open, 120);
      else toast("warning", "Profile unavailable", "Could not open the profile for that key.");
    };
    window.setTimeout(open, 450);
  }, 120);
}

function aboutPaneHtml() {
  const manifest = api.runtime.getManifest?.() || {};
  const version = manifest.version || VERSION;
  const build = agnostrBuildId();
  const appVersion = build ? `web build ${build}` : "web";
  return `<div class="ba-about-pane">
    <img class="ba-about-logo" src="https://agnostr.com/icon.svg" alt="Agnostr">
    <div class="ba-about-name">Agnostr</div>
    <div class="ba-about-version">${h(appVersion)}</div>
    <div class="ba-about-with">with Better Agnostr version ${h(version)}</div>
    <div class="ba-about-credits">
      <div class="ba-about-credit">
        <span class="ba-about-credit-name">Agnostr</span>
        <span class="ba-about-credit-line">by hinsley</span>
        <a href="https://github.com/hinsley/Agnostr" target="_blank" rel="noopener noreferrer">github.com/hinsley/Agnostr</a>
      </div>
      <div class="ba-about-credit">
        <span class="ba-about-credit-name">Better Agnostr</span>
        <span class="ba-about-credit-line">by <a class="ba-about-angel" href="#dm=npub1t9kl0mq3f8pesupc9nqndpq389af4czsk7nnpvr5g6kg9hyenxvssjs0yk" data-ba-angel-link data-npub="npub1t9kl0mq3f8pesupc9nqndpq389af4czsk7nnpvr5g6kg9hyenxvssjs0yk">Angel</a></span>
        <a href="https://github.com/angeltrue/BetterAgnostr" target="_blank" rel="noopener noreferrer">github.com/angeltrue/BetterAgnostr</a>
      </div>
    </div>
  </div>`;
}

function openExternalLink(href) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function bindAboutLinks(overlay) {
  if (overlay.dataset.baLinksBound === "1") return;
  overlay.dataset.baLinksBound = "1";
  overlay.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a[href]");
    if (!link || !overlay.contains(link)) return;
    const npub = link.getAttribute("data-npub");
    if (npub) {
      event.preventDefault();
      event.stopPropagation();
      openProfileByNpub(npub);
      return;
    }
    let url;
    try {
      url = new URL(link.getAttribute("href"), location.href);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    event.preventDefault();
    event.stopPropagation();
    openExternalLink(url.href);
  }, true);
}

function renderAboutPane(modal) {
  const body = modal.querySelector(".ag-set-detail-body");
  if (!body) return;
  let overlay = body.querySelector("[data-ba-about-overlay]");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "ba-about-overlay";
    overlay.setAttribute("data-ba-about-overlay", "1");
    body.appendChild(overlay);
  }
  bindAboutLinks(overlay);
  const manifest = api.runtime.getManifest?.() || {};
  const signature = `${manifest.version || ""}|${agnostrBuildId()}`;
  if (overlay.dataset.baAboutSignature !== signature || !overlay.querySelector(".ba-about-pane")) {
    overlay.innerHTML = aboutPaneHtml();
    overlay.dataset.baAboutSignature = signature;
  }
  overlay.hidden = false;
  modal.classList.add("ba-about-active");
  modal.classList.remove("ba-better-active");
  const better = modal.querySelector("[data-ba-better-overlay]");
  if (better) better.hidden = true;
}

function hideAboutPane(modal) {
  modal.classList.remove("ba-about-active");
  const overlay = modal.querySelector("[data-ba-about-overlay]");
  if (overlay) overlay.hidden = true;
}

function ensureThemeCheck(card, active) {
  // Native theme cards are React-owned. Do not delete their check node; hide it
  // with CSS while a Better Agnostr theme overrides the native choice.
  if (!card.hasAttribute("data-ba-glub-theme")) return;
  let check = card.querySelector(".ag-set-theme-check");
  if (active && !check) {
    check = document.createElement("span");
    check.className = "ag-set-theme-check";
    check.setAttribute("aria-hidden", "true");
    check.innerHTML = CHECK_ICON;
    card.appendChild(check);
  } else if (!active && check) {
    check.remove();
  }
}

function syncThemeCards(modal) {
  const preset = state.settings.theme.preset;
  for (const card of modal.querySelectorAll(".ag-set-theme-card")) {
    const id = card.getAttribute("data-ba-glub-theme");
    if (id) {
      const active = preset === id;
      card.classList.toggle("active", active);
      card.setAttribute("aria-pressed", active ? "true" : "false");
      ensureThemeCheck(card, active);
    } else if (preset !== "agnostr") {
      if (card.classList.contains("active")) state.agnostrActiveThemeCard = card;
      card.classList.remove("active");
      card.setAttribute("aria-pressed", "false");
      ensureThemeCheck(card, false);
    }
  }
  if (preset === "agnostr" && state.agnostrActiveThemeCard?.isConnected) {
    const card = state.agnostrActiveThemeCard;
    card.classList.add("active");
    card.setAttribute("aria-pressed", "true");
    ensureThemeCheck(card, true);
  }
}

function syncSettingsFields(modal) {
  for (const el of modal.querySelectorAll("[data-ba-setting]")) {
    const path = el.getAttribute("data-ba-setting");
    const value = getPath(state.settings, path);
    if (el === document.activeElement) continue;
    if (el.type === "checkbox") el.checked = !!value;
    else el.value = value ?? "";
  }
  for (const el of modal.querySelectorAll("[data-ba-setting-toggle]")) {
    const value = !!getPath(state.settings, el.getAttribute("data-ba-setting-toggle"));
    el.classList.toggle("is-on", value);
  }
  for (const el of modal.querySelectorAll("[data-ba-rainbow-toggle]")) {
    el.checked = state.settings.studio.rainbowStyle !== "bright";
  }
  syncThemeCards(modal);
  const status = modal.querySelector("[data-ba-status]");
  if (status) {
    const st = state.status || {};
    const signer = st.signerHooked
      ? `signer: ${st.signMode || "attached"}`
      : st.nip07Patched
        ? "rewriter: NIP-07"
        : "signer: waiting";
    status.textContent = `${signer} · ${state.events.size} events captured · glub ${effectiveBuild(state.settings) || "build missing"}`;
  }
  const build = modal.querySelector("[data-ba-build-status]");
  if (build) {
    const b = effectiveBuild(state.settings);
    build.textContent = b ? `Build: ${b}${state.settings.glub.manualBuild ? " (manual)" : " (auto)"}` : "Build: not synced";
  }
}

function optionsHtml(list, selected) {
  return list.map((item) => `<option value="${h(item.id)}"${item.id === selected ? " selected" : ""}>${h(item.label)}</option>`).join("");
}

function nativePrivacyHtml() {
  const strip = new Set(state.settings.privacy.stripTags);
  const review = new Set(state.settings.privacy.reviewGroups);
  return `<div class="ag-set-group ba-native-group" data-ba-native="privacy">
    <span class="ag-set-label">Better Agnostr</span>
    ${baToggle("privacy.hideLocate", "Hide Locate Me")}
    ${baToggle("privacy.hideTimestamps", "Hide timestamps", "Hide per-message clock times in chat")}
    ${baToggle("privacy.omitTeleport", "Omit teleport tag")}
    ${baToggle("privacy.removeVoiceMemo", "Remove voice memo")}
    ${baToggle("privacy.stripTracking", "Strip tracking parameters")}
    ${baToggle("privacy.reviewEnabled", "Review before signing")}
    ${baToggle("privacy.calls.disable", "Block calls")}
    ${baToggle("privacy.calls.hideUi", "Hide call buttons")}
    ${baToggle("privacy.calls.blockSignals", "Block call signals")}
    ${baToggle("privacy.calls.blockOutgoing", "Block outgoing calls")}
    <details class="ba-native-details">
      <summary>Tags to remove</summary>
      <div class="ba-native-checks">${STRIPPABLE_TAGS.map((t) => `<label class="ba-native-check"><input type="checkbox" data-ba-strip-tag="${h(t.name)}"${strip.has(t.name) ? " checked" : ""}><span>${h(t.label)}</span></label>`).join("")}</div>
    </details>
    <details class="ba-native-details">
      <summary>Review types</summary>
      <div class="ba-native-checks">${KIND_GROUPS.map((g) => `<label class="ba-native-check"><input type="checkbox" data-ba-review-group="${h(g.id)}"${review.has(g.id) ? " checked" : ""}><span>${h(g.label)}</span></label>`).join("")}</div>
    </details>
  </div>`;
}

function injectNativePrivacy(modal) {
  const stack = modal.querySelector(".ag-set-pane-stack") || modal.querySelector(".ag-set-detail-body");
  if (!stack || stack.querySelector("[data-ba-native='privacy']")) return;
  const holder = document.createElement("div");
  holder.innerHTML = nativePrivacyHtml();
  const group = holder.firstElementChild;
  const broadcast = [...stack.querySelectorAll(".ag-set-toggle-card, .ag-set-notif-row")].find((el) =>
    /broadcast agnostr client|share agnostr client tag/i.test(el.textContent || ""),
  );
  if (broadcast) {
    broadcast.style.display = "none";
    broadcast.setAttribute("data-ba-hidden-native-broadcast", "1");
    broadcast.after(group);
  } else {
    stack.prepend(group);
  }
}

function clearNativePrivacy(modal) {
  for (const el of modal.querySelectorAll("[data-ba-native='privacy']")) el.remove();
}

function soundsSectionHtml() {
  const sounds = state.settings.sounds;
  const events = sounds.events || {};
  const toggleRow = (title, desc, path, checked) => `
    <label class="ag-set-notif-row">
      <div class="ag-set-notif-row-copy">
        <span class="ag-set-notif-row-title">${h(title)}</span>
        <span class="ag-set-notif-row-desc">${h(desc)}</span>
      </div>
      <input class="ag-switch" type="checkbox" data-ba-setting="${h(path)}"${checked ? " checked" : ""}>
    </label>`;
  const selectRow = (title, desc, path, list, value) => `
    <div class="ag-set-notif-row">
      <div class="ag-set-notif-row-copy">
        <span class="ag-set-notif-row-title">${h(title)}</span>
        <span class="ag-set-notif-row-desc">${h(desc)}</span>
      </div>
      <select class="ag-input ba-set-select ba-notif-select" data-ba-setting="${h(path)}" aria-label="${h(title)}">${optionsHtml(list, value)}</select>
    </div>`;
  const rangeRow = (title, desc, path, value) => `
    <div class="ag-set-notif-row">
      <div class="ag-set-notif-row-copy">
        <span class="ag-set-notif-row-title">${h(title)}</span>
        <span class="ag-set-notif-row-desc">${h(desc)}</span>
      </div>
      <input class="ba-set-range ba-notif-range" type="range" min="0" max="1" step="0.05" data-ba-setting="${h(path)}" aria-label="${h(title)}" value="${h(String(value))}">
    </div>`;
  return `<section class="ag-set-section" data-ba-native="sounds">
      <div class="ag-set-section-head">
        <div class="ag-set-section-copy">
          <div class="ag-set-section-title-row"><h3 class="ag-set-section-title">Better Agnostr sounds</h3></div>
          <p class="ag-set-section-desc">These chimes and UI clicks replace Agnostr's native message chime and sound effects. Agnostr notifications, ringtone, vibration, and lock-screen previews above remain in control.</p>
        </div>
      </div>
      <div class="ag-set-card-list">
        ${toggleRow("Message chimes", "Play the selected chime for new alerts", "sounds.messageEnabled", sounds.messageEnabled !== false)}
        ${selectRow("Message chime", "Sound for new messages", "sounds.message", MESSAGE_SOUNDS, sounds.message)}
        ${rangeRow("Volume", "Chime and interface-click volume", "sounds.volume", sounds.volume)}
        ${toggleRow("UI clicks", "Play a sound for buttons and controls", "sounds.clickEnabled", sounds.clickEnabled !== false)}
        ${selectRow("UI click", "Sound for interface clicks", "sounds.click", CLICK_SOUNDS, sounds.click)}
      </div>
      <div class="ba-native-actions">
        <button type="button" class="ag-btn ag-btn-secondary ag-btn-sm" data-ba-settings-action="preview-message-sound">Test chime</button>
        <button type="button" class="ag-btn ag-btn-secondary ag-btn-sm" data-ba-settings-action="preview-click-sound">Test click</button>
      </div>
    </section>
    <section class="ag-set-section" data-ba-native="chime-triggers">
      <div class="ag-set-section-head">
        <div class="ag-set-section-copy">
          <div class="ag-set-section-title-row"><h3 class="ag-set-section-title">Chime triggers</h3></div>
          <p class="ag-set-section-desc">Choose which incoming activity plays a Better Agnostr sound.</p>
        </div>
      </div>
      <div class="ag-set-card-list">
        ${toggleRow("Direct messages", "Encrypted one-to-one chats", "sounds.events.dm", events.dm !== false)}
        ${toggleRow("Chat & rooms", "Chat and group channel messages", "sounds.events.chat", events.chat !== false)}
        ${toggleRow("Mentions only", "Limit chat sounds to @mentions and direct replies", "sounds.events.mentionOnly", events.mentionOnly === true)}
        ${toggleRow("Call invites", "Incoming call signals", "sounds.events.calls", events.calls === true)}
      </div>
    </section>`;
}

function injectNativeSounds(modal) {
  const stack = modal.querySelector(".ag-set-pane-stack") || modal.querySelector(".ag-set-detail-body");
  if (!stack) return;
  const nativeChime = [...modal.querySelectorAll(".ag-set-notif-row")].find((el) => {
    if (el.closest("[data-ba-native]")) return false;
    const text = `${el.querySelector(".ag-set-notif-row-title")?.textContent || ""} ${el.textContent || ""}`;
    return /message\s+chimes?|message\s+sounds?/i.test(text);
  });
  if (nativeChime) {
    if (nativeChime.dataset.baChimeDisplay === undefined) nativeChime.dataset.baChimeDisplay = nativeChime.style.display;
    nativeChime.style.display = "none";
    nativeChime.setAttribute("data-ba-hidden-native-chime", "1");
  }
  if (stack.querySelector("[data-ba-native='sounds']")) return;
  const anchor = [...stack.querySelectorAll("section.ag-set-section")].find((el) =>
    /sounds?\s*(?:&|and)?\s*lock\s*screen|sound\s+effects/i.test(
      el.querySelector(".ag-set-section-title")?.textContent || "",
    ),
  );
  const holder = document.createElement("div");
  holder.innerHTML = soundsSectionHtml();
  const nodes = [...holder.children];
  if (anchor) anchor.after(...nodes);
  else stack.append(...nodes);
}

function clearNativeSoundsOverride(modal) {
  const stack = modal.querySelector(".ag-set-pane-stack") || modal.querySelector(".ag-set-detail-body");
  if (!stack) return;
  for (const el of stack.querySelectorAll("[data-ba-native='sounds'], [data-ba-native='chime-triggers']")) el.remove();
  for (const el of stack.querySelectorAll("[data-ba-hidden-native-chime]")) {
    if (!(el instanceof HTMLElement)) continue;
    el.style.display = el.dataset.baChimeDisplay || "";
    delete el.dataset.baChimeDisplay;
    el.removeAttribute("data-ba-hidden-native-chime");
  }
}

function clearAppearanceExtras(modal) {
  for (const el of modal.querySelectorAll("[data-ba-hidden-native-audio]")) {
    if (!(el instanceof HTMLElement)) continue;
    el.style.display = el.dataset.baAudioDisplay || "";
    delete el.dataset.baAudioDisplay;
    el.removeAttribute("data-ba-hidden-native-audio");
  }
  for (const group of modal.querySelectorAll("[data-ba-settings-group]")) group.remove();
}

function injectAppearanceExtras(modal) {
  const stack = modal.querySelector(".ag-set-pane-stack") || modal.querySelector(".ag-set-detail-body");
  if (!stack) return;
  const audioSection = [...stack.querySelectorAll("section.ag-set-section")].find(
    (el) => el.querySelector(".ag-set-section-title")?.textContent?.trim() === "Audio",
  );
  if (audioSection) {
    if (audioSection.dataset.baAudioDisplay === undefined) audioSection.dataset.baAudioDisplay = audioSection.style.display;
    audioSection.style.display = "none";
    audioSection.setAttribute("data-ba-hidden-native-audio", "1");
  }
  const agnThemeGrid = [...modal.querySelectorAll(".ag-set-theme-grid")].find((g) => !g.classList.contains("ba-glub-theme-grid"));
  const anchor = agnThemeGrid?.closest("section.ag-set-section, .ag-set-group") || null;
  const holder = document.createElement("div");
  const ensureGroup = (id, html) => {
    let group = stack.querySelector(`[data-ba-settings-group='${id}']`);
    if (!group) {
      holder.innerHTML = html;
      group = holder.firstElementChild;
    }
    return group;
  };
  const themeGroup = ensureGroup("themes", glubThemeGroupHtml());
  const rainbowGroup = ensureGroup("rainbow", rainbowStyleGroupHtml());
  const interfaceGroup = ensureGroup("interface", interfaceGroupHtml());
  const cssGroup = ensureGroup("css", customCssGroupHtml());
  const fontGroup = ensureGroup("font", `<div class="ag-set-group" data-ba-settings-group="font">
        <span class="ag-set-label">Font</span>
        <div class="ba-set-field"><span>Family</span><select class="ag-input ba-set-select" data-ba-setting="font.family" aria-label="Font family">
          ${FONT_PRESETS.map((f) => `<option value="${f.id}"${state.settings.font.family === f.id ? " selected" : ""}>${h(f.label)}</option>`).join("")}
        </select></div>
        <div class="ba-set-field"><span>Custom family</span><input class="ag-input" data-ba-setting="font.customFamily" aria-label="Custom font family" maxlength="80" value="${h(state.settings.font.customFamily)}" placeholder="installed family name"></div>
        <div class="ba-set-field"><span>Custom URL</span><input class="ag-input" data-ba-setting="font.customUrl" aria-label="Custom font URL" maxlength="500" value="${h(state.settings.font.customUrl)}" placeholder="https://…/font.woff2"></div>
        <div class="ba-set-note">IBM Plex, Atkinson Hyperlegible, Lexend, and readable serif families are bundled.</div>
      </div>`);

  // Keep the groups together and outside React-owned native sections. The old
  // implementation created every unrelated group only when the native theme grid
  // existed, and anchored them inside the Color Theme section when it did.
  const groups = [themeGroup, rainbowGroup, interfaceGroup, cssGroup, fontGroup];
  let previous = anchor;
  for (const group of groups) {
    if (!group) continue;
    if (previous) previous.after(group);
    else stack.append(group);
    previous = group;
  }
  syncSettingsFields(modal);
}

function shootStar(el, delay = 0) {
  if (typeof el.animate !== "function") return;
  const layer = el.parentElement;
  const row = layer?.closest(".ag-msg-row") || layer;
  if (!layer || !row) return;
  const line = row.querySelector(".ag-msg-rich") || row.querySelector(".ag-msg-content") || row;
  const layerRect = layer.getBoundingClientRect();
  const lineRect = line.getBoundingClientRect();
  const offsetX = Math.max(0, lineRect.left - layerRect.left);
  const offsetY = Math.max(0, lineRect.top - layerRect.top);
  const w = Math.max(60, layerRect.width - offsetX - 4);
  const h = Math.max(12, lineRect.height);
  const star = document.createElement("span");
  star.className = "ba-shooting-star";
  star.setAttribute("aria-hidden", "true");
  star.style.width = `${(28 + Math.random() * 46).toFixed(1)}px`;
  layer.appendChild(star);
  const startX = offsetX + 4 + Math.random() * Math.max(1, w * 0.86);
  const startY = offsetY + 3 + Math.random() * Math.max(1, h - 6);
  const travel = Math.max(50, Math.min(w - (startX - offsetX) - 8, 70 + Math.random() * 300));
  const angle = 5 + Math.random() * 14;
  const endX = startX + travel;
  const endY = Math.min(offsetY + h - 2, startY + travel * Math.tan((angle * Math.PI) / 180) * 0.34);
  const rotation = `rotate(${angle.toFixed(1)}deg)`;
  const anim = star.animate(
    [
      { transform: `translate3d(${startX.toFixed(1)}px, ${startY.toFixed(1)}px, 0) ${rotation}`, opacity: 0 },
      { opacity: 0.98, offset: 0.16 },
      { opacity: 0.9, offset: 0.7 },
      { transform: `translate3d(${endX.toFixed(1)}px, ${endY.toFixed(1)}px, 0) ${rotation}`, opacity: 0 },
    ],
    {
      duration: 400 + Math.random() * 480,
      delay,
      easing: "cubic-bezier(.2,.65,.3,1)",
      fill: "both",
    },
  );
  anim.onfinish = () => star.remove();
  anim.oncancel = () => star.remove();
}

function visibleFxTargets(selector) {
  const out = [];
  for (const el of document.querySelectorAll(selector)) {
    const row = el.parentElement;
    if (!row || row.classList.contains("flairQuiet")) continue;
    const rect = row.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    out.push(el);
  }
  return out;
}

function rollFxTargets(selector, chance, run, maxPerTick) {
  const targets = visibleFxTargets(selector);
  if (!targets.length) return;
  const start = (Math.random() * targets.length) | 0;
  let fired = 0;
  for (let i = 0; i < targets.length && fired < maxPerTick; i++) {
    if (Math.random() >= chance) continue;
    run(targets[(start + i) % targets.length]);
    fired += 1;
  }
}

function circuitSurge(el) {
  if (typeof el.animate !== "function") return;
  if (el.dataset.surging === "1") return;
  const bits = el.querySelectorAll(".cirSeg, .cirCoinWrap");
  if (!bits.length) return;
  el.dataset.surging = "1";
  const travel = 620 + Math.random() * 560;
  const p = 1.45 + Math.random() * 0.95;
  const lit = 165 + Math.random() * 120;
  const peak = 0.5 + Math.random() * 0.42;
  let last = null;
  let lastEnd = -1;
  for (const bit of bits) {
    const t = Math.max(0, Math.min(1.05, parseFloat(bit.style.getPropertyValue("--t")) || 0));
    const delay = Math.max(0, travel * Math.pow(t, p) + (Math.random() * 46 - 23));
    const coin = bit.classList.contains("cirCoinWrap");
    const dur = coin ? lit * 3.8 : lit;
    const top = coin ? Math.min(0.68, peak * 1.5) : peak;
    const anim = bit.animate(
      coin
        ? [{ opacity: 0 }, { opacity: top, offset: 0.12 }, { opacity: top * 0.72, offset: 0.4 }, { opacity: top * 0.3, offset: 0.72 }, { opacity: 0 }]
        : [{ opacity: 0 }, { opacity: top, offset: 0.22 }, { opacity: top * 0.45, offset: 0.5 }, { opacity: 0 }],
      { duration: dur, delay, easing: "linear" },
    );
    if (delay + dur > lastEnd) {
      lastEnd = delay + dur;
      last = anim;
    }
  }
  const done = () => {
    el.dataset.surging = "";
  };
  if (last) {
    last.onfinish = done;
    last.oncancel = done;
  } else done();
}

function flairStrike(el) {
  if (typeof el.animate !== "function") return;
  const row = el.parentElement;
  if (!row) return;
  el.insertAdjacentHTML("beforeend", lightningStrikeMarkup(row.clientWidth, row.clientHeight));
  const strike = el.lastElementChild;
  const anim = strike.animate(
    [
      { opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 0.25, offset: 0.3 },
      { opacity: 0.9, offset: 0.46 },
      { opacity: 0.15, offset: 0.66 },
      { opacity: 0 },
    ],
    { duration: 260 + Math.random() * 170, easing: "linear" },
  );
  anim.onfinish = () => strike.remove();
  anim.oncancel = () => strike.remove();
}

function flairTickerTick() {
  if (document.hidden || state.settings.studio.reduceMotion || state.settings.studio.renderInAgnostr === false) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const stars = visibleFxTargets(".flair-stars > .flairFx");
  if (stars.length && Math.random() < 0.34) {
    const count = Math.min(stars.length, 1 + Math.floor(Math.random() * 3));
    const used = new Set();
    for (let i = 0; i < count; i++) {
      let index = Math.floor(Math.random() * stars.length);
      let guard = 0;
      while (used.has(index) && guard < stars.length) {
        index = (index + 1) % stars.length;
        guard += 1;
      }
      used.add(index);
      shootStar(stars[index], Math.random() * 1600);
    }
  }
  rollFxTargets(".flair-lightning > .flairFx", 0.13, flairStrike, 3);
  rollFxTargets(".flair-bitcoin > .flairFx", 0.3, circuitSurge, 4);
}

function renderBetterSettingsPane(modal) {
  const body = modal.querySelector(".ag-set-detail-body");
  if (!body) return;
  let overlay = body.querySelector("[data-ba-better-overlay]");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "ba-better-overlay";
    overlay.setAttribute("data-ba-better-overlay", "1");
    overlay.innerHTML = betterSettingsPaneHtml();
    body.appendChild(overlay);
  }
  overlay.hidden = false;
  modal.classList.remove("ba-about-active");
  modal.classList.add("ba-better-active");
  hideAboutPane(modal);
  for (const tab of modal.querySelectorAll("[data-ba-better-tab]")) {
    tab.classList.toggle("is-active", tab.getAttribute("data-ba-better-tab") === state.betterTab);
  }
  if (!overlay.querySelector("[data-ba-better-content]")?.firstElementChild) renderBetterTabContent(modal);
  syncBetterSettings(modal);
}

function hideBetterSettingsPane(modal) {
  modal.classList.remove("ba-better-active");
  const overlay = modal.querySelector("[data-ba-better-overlay]");
  if (overlay) overlay.hidden = true;
}

function hideNativeBroadcastClient(modal) {
  for (const card of modal.querySelectorAll(".ag-set-toggle-card, .ag-set-notif-row")) {
    if (!/broadcast agnostr client|share agnostr client tag/i.test(card.textContent || "")) continue;
    card.style.display = "none";
    card.setAttribute("data-ba-hidden-native-broadcast", "1");
    const input = card.querySelector('input[type="checkbox"]');
    if (input instanceof HTMLInputElement && input.checked) {
      // The native toggle can be recreated by React. Clicking an already-off
      // checkbox is harmless, and the click guard prevents a second toggle.
      if (card.dataset.baBroadcastToggle !== "1") {
        card.dataset.baBroadcastToggle = "1";
        input.click();
      }
    }
  }
}

function syncSettingsMobileTitle(modal, title) {
  const section = modal.querySelector(".ag-set-mobile-section");
  if (!section || !title) return;
  const label = section.querySelector(".ag-set-mobile-title");
  if (label) {
    if (label.textContent !== title) label.textContent = title;
  } else {
    const textNode = [...section.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && (node.nodeValue || "").trim(),
    );
    if (textNode) textNode.nodeValue = title;
    else if (!section.children.length) section.textContent = title;
    else section.setAttribute("aria-label", title);
  }
  const back = modal.querySelector(".ag-set-mobile-back, .ag-sheet-back-btn, [data-close-modal]");
  back?.setAttribute("aria-label", `Back from ${title}`);
}

function settingsModalTitle(modal) {
  return (
    modal.querySelector(".ag-set-detail-title")?.textContent?.trim() ||
    modal.querySelector(".ag-set-mobile-title")?.textContent?.trim() ||
    modal.getAttribute("aria-label")?.trim() ||
    ""
  );
}

function syncSettingsIntegration() {
  if (state.settings.enabled === false) return;
  const modal = document.querySelector(".ag-settings-modal");
  if (!modal) {
    state.settingsModalOpen = false;
    state.settingsBetterActive = false;
    state.aboutActive = false;
    return;
  }
  hideNativeBroadcastClient(modal);
  if (!state.settingsModalOpen) {
    state.settingsModalOpen = true;
    state.settingsBetterActive = false;
    state.aboutActive = false;
  }
  const nav = ensureBetterNav(modal);
  const aboutNav = ensureAboutNav(modal);
  if (!nav || !aboutNav) {
    // The new Alerts shortcut opens the Notifications pane as a direct detail
    // sheet with no nav list. Treat it exactly like the Settings → Notifications
    // pane so the Better Agnostr sound controls appear inline there too.
    state.settingsBetterActive = false;
    state.aboutActive = false;
    modal.classList.remove("ba-better-active", "ba-about-active");
    hideBetterSettingsPane(modal);
    hideAboutPane(modal);
    const title = settingsModalTitle(modal);
    if (/appearance/i.test(title)) injectAppearanceExtras(modal);
    else clearAppearanceExtras(modal);
    if (/privacy|trust/i.test(title)) injectNativePrivacy(modal);
    else clearNativePrivacy(modal);
    if (/notif|alert/i.test(title)) injectNativeSounds(modal);
    else clearNativeSoundsOverride(modal);
    syncThemeCards(modal);
    return;
  }
  if (state.settingsBetterActive || state.aboutActive) {
    if (enterSettingsMobileDetail(modal)) return;
  }
  if (state.aboutActive) {
    for (const item of modal.querySelectorAll(".ag-set-nav-item")) item.classList.toggle("active", item === aboutNav);
    state.settingsBetterActive = false;
    syncSettingsMobileTitle(modal, "About");
    hideBetterSettingsPane(modal);
    renderAboutPane(modal);
    return;
  }
  if (state.settingsBetterActive) {
    for (const item of modal.querySelectorAll(".ag-set-nav-item")) item.classList.toggle("active", item === nav);
    syncSettingsMobileTitle(modal, "Better Agnostr");
    hideAboutPane(modal);
    renderBetterSettingsPane(modal);
    return;
  }
  nav.classList.remove("active");
  aboutNav.classList.remove("active");
  hideBetterSettingsPane(modal);
  hideAboutPane(modal);
  const title = settingsModalTitle(modal);
  syncSettingsMobileTitle(modal, title);
  if (/appearance/i.test(title)) injectAppearanceExtras(modal);
  else clearAppearanceExtras(modal);
  if (/privacy|trust/i.test(title)) injectNativePrivacy(modal);
  else clearNativePrivacy(modal);
  if (/notif|alert/i.test(title)) injectNativeSounds(modal);
  else clearNativeSoundsOverride(modal);
  syncThemeCards(modal);
}

function openAgnostrSettings(navLabel = "Appearance") {
  closePanel();
  const settingsBtn = findNativeSettingsButton();
  if (!settingsBtn) {
    toast("warning", "Settings not found", "Open Agnostr settings from the suite menu.");
    return;
  }
  settingsBtn.click();
  window.setTimeout(() => {
    const items = [...document.querySelectorAll(".ag-settings-modal .ag-set-nav-item")];
    const item = items.find((b) => b.textContent.includes(navLabel));
    if (item) {
      state.settingsBetterActive = false;
      item.click();
    }
    scheduleSettingsSync();
  }, 120);
}

function handleSettingsAction(action) {
  switch (action) {
    case "open-panel":
    case "open-studio":
      openBetterSettings("line");
      break;
    case "open-client":
      openBetterSettings("client");
      break;
    case "open-appearance":
      state.settingsBetterActive = false;
      {
        const items = [...document.querySelectorAll(".ag-settings-modal .ag-set-nav-item")];
        const item = items.find((b) => !b.hasAttribute("data-ba-settings-nav") && b.textContent.includes("Appearance"));
        item?.click();
      }
      scheduleSettingsSync();
      break;
    case "open-settings-page":
      openAgnostrSettings("Appearance");
      break;
    case "sync-build":
      refreshBuild(true);
      break;
    case "reset-css":
      updateSettings((s) => {
        s.theme.customCss = "";
      });
      applyTheme();
      scheduleSettingsSync();
      break;
    case "preview-message-sound":
      previewSound("message", state.settings.sounds.message, state.settings.sounds.volume);
      break;
    case "preview-click-sound":
      previewSound("click", state.settings.sounds.click, state.settings.sounds.volume);
      break;
    case "copy-diagnostics":
      copyDiagnostics();
      break;
    default:
      break;
  }
}

// Settings pane events. These live on the page, outside the shadow UI.
document.addEventListener(
  "click",
  (event) => {
    if (!state.enabledReady || state.settings.enabled === false) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const suiteBetter = target.closest("[data-ba-suite-better]");
    if (suiteBetter) {
      event.preventDefault();
      event.stopPropagation();
      openBetterSettings(state.betterTab || "line");
      window.setTimeout(() => {
        document.querySelector(".ag-suite-backdrop .ag-suite-close")?.click();
      }, 0);
      return;
    }
    const emojiTab = target.closest("[data-ba-emoji-tab]");
    if (emojiTab) {
      event.preventDefault();
      event.stopPropagation();
      state.emojiCategory = emojiTab.getAttribute("data-ba-emoji-tab") || "smileys";
      const pop = emojiPicker();
      pop.innerHTML = emojiPickerBodyHtml();
      pop.hidden = false;
      if (state.emojiAnchor) positionEmojiPicker(state.emojiAnchor);
      return;
    }
    const emojiItem = target.closest("[data-ba-emoji]");
    if (emojiItem) {
      event.preventDefault();
      event.stopPropagation();
      insertEmoji(emojiItem.getAttribute("data-ba-emoji") || "");
      return;
    }
    const emojiTrigger = target.closest("[data-ba-emoji-trigger]");
    if (emojiTrigger) {
      event.preventDefault();
      event.stopPropagation();
      openEmojiPicker(emojiTrigger);
      return;
    }
    if (!target.closest(".ba-emoji-popover") && !target.closest("[data-ba-emoji-trigger]")) {
      hideEmojiPicker();
    }
    const formatToggle = target.closest("[data-ba-format-toggle]");
    if (formatToggle) {
      event.preventDefault();
      event.stopPropagation();
      updateSettings((s) => {
        s.studio.showComposerToolbar = s.studio.showComposerToolbar === false;
      });
      return;
    }
    const betterTab = target.closest("[data-ba-better-tab]");
    if (betterTab) {
      event.preventDefault();
      state.betterTab = betterTab.getAttribute("data-ba-better-tab");
      state.settings.ui.betterTab = state.betterTab;
      debounceSave();
      const modal = document.querySelector(".ag-settings-modal");
      if (modal) {
        for (const t of modal.querySelectorAll("[data-ba-better-tab]")) t.classList.toggle("is-active", t === betterTab);
        renderBetterTabContent(modal);
        syncBetterSettings(modal);
      }
      return;
    }
    const flairChoice = target.closest("[data-ba-flair-choice]");
    if (flairChoice) {
      event.preventDefault();
      const flair = flairChoice.getAttribute("data-ba-flair-choice") || "";
      updateSettings((s) => {
        s.studio.flair = flair;
      });
      const modal = document.querySelector(".ag-settings-modal");
      if (modal) {
        state.betterPreviewSig = "";
        syncBetterSettings(modal);
      }
      return;
    }
    const templatePreset = target.closest("[data-ba-template-preset]");
    if (templatePreset) {
      event.preventDefault();
      const input = document.querySelector('.ag-settings-modal [data-ba-setting="studio.template"]');
      if (input instanceof HTMLInputElement) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, templatePreset.getAttribute("data-ba-template-preset") || "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
      return;
    }
    const templateCode = target.closest("[data-ba-template-code]");
    if (templateCode) {
      event.preventDefault();
      const input = document.querySelector('.ag-settings-modal [data-ba-setting="studio.template"]');
      insertInto(input, templateCode.getAttribute("data-ba-template-code") || "");
      return;
    }
    const templatePlaceholder = target.closest("[data-ba-template-placeholder]");
    if (templatePlaceholder) {
      event.preventDefault();
      const input = document.querySelector('.ag-settings-modal [data-ba-setting="studio.template"]');
      insertInto(input, templatePlaceholder.getAttribute("data-ba-template-placeholder") || "");
      return;
    }
    const clientPreset = target.closest("[data-ba-client-preset]");
    if (clientPreset) {
      event.preventDefault();
      updateSettings((s) => {
        s.client.name = clientPreset.getAttribute("data-ba-client-preset") || "";
      });
      const modal = document.querySelector(".ag-settings-modal");
      if (modal) syncBetterSettings(modal);
      return;
    }
    const logRow = target.closest("[data-ba-log-index]");
    if (logRow) {
      event.preventDefault();
      const log = state.logs[Number(logRow.getAttribute("data-ba-log-index"))];
      if (log?.eventId) openViewer(log.eventId, log.event ? "json" : "relay");
      return;
    }

    const themeCard = target.closest("[data-ba-glub-theme]");
    if (themeCard) {
      event.preventDefault();
      event.stopPropagation();
      const id = themeCard.getAttribute("data-ba-glub-theme");
      updateSettings((s) => {
        s.theme.preset = id;
      });
      applyTheme();
      syncSettingsIntegration();
      return;
    }
    const agnTheme = target.closest(".ag-set-theme-card");
    if (agnTheme && !agnTheme.hasAttribute("data-ba-glub-theme")) {
      state.agnostrActiveThemeCard = agnTheme;
      if (state.settings.theme.preset !== "agnostr") {
        updateSettings((s) => {
          s.theme.preset = "agnostr";
        });
        applyTheme();
      }
      return;
    }
    const angel = target.closest("[data-ba-angel-link]");
    if (angel) {
      event.preventDefault();
      event.stopPropagation();
      openProfileByNpub(angel.getAttribute("data-npub"));
      return;
    }
    const action = target.closest("[data-ba-settings-action]")?.getAttribute("data-ba-settings-action");
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      handleSettingsAction(action);
      return;
    }
    const settingsBack = target.closest(".ag-settings-modal .ag-sheet-back-btn");
    if (settingsBack) {
      state.settingsBetterActive = false;
      state.aboutActive = false;
      scheduleSettingsSync();
    }
    const nav = target.closest(".ag-set-nav-item");
    if (nav && !nav.hasAttribute("data-ba-settings-nav") && !nav.hasAttribute("data-ba-about-nav")) {
      const modal = nav.closest(".ag-settings-modal");
      if (modal?.dataset.baMobileEntering === "1") return;
      state.settingsBetterActive = false;
      state.aboutActive = false;
      scheduleSettingsSync();
    }
  },
  true,
);

document.addEventListener(
  "input",
  (event) => {
    if (!state.enabledReady || state.settings.enabled === false) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const path = target.getAttribute("data-ba-setting");
    if (!path) return;
    if (target.type === "checkbox") return;
    updateSettings((s) => setPath(s, path, target.value), { sync: false });
    if (path === "theme.customCss") {
      applyTheme();
      scheduleSettingsSync();
    }
    if (path === "font.customFamily" || path === "font.customUrl") {
      state.settings.font.family = "custom";
      debounceSave();
      broadcastConfig();
      const fontSelect = document.querySelector('.ag-settings-modal [data-ba-setting="font.family"]');
      if (fontSelect) fontSelect.value = "custom";
    }
    if (path.startsWith("font.")) applyFont();
    if (path.startsWith("studio.") || path.startsWith("sounds.") || path.startsWith("client.") || path.startsWith("font.") || path === "glub.manualBuild") {
      scheduleSettingsSync();
    }
  },
  true,
);

document.addEventListener(
  "change",
  (event) => {
    if (!state.enabledReady || state.settings.enabled === false) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches("[data-ba-strip-tag]")) {
      const name = target.getAttribute("data-ba-strip-tag");
      updateSettings((s) => {
        const set = new Set(s.privacy.stripTags);
        if (target.checked) set.add(name);
        else set.delete(name);
        s.privacy.stripTags = [...set];
      });
      return;
    }
    if (target.matches("[data-ba-rainbow-toggle]")) {
      updateSettings((s) => {
        s.studio.rainbowStyle = target.checked ? "glub" : "bright";
      });
      return;
    }
    if (target.matches("[data-ba-review-group]")) {
      const name = target.getAttribute("data-ba-review-group");
      updateSettings((s) => {
        const set = new Set(s.privacy.reviewGroups);
        if (target.checked) set.add(name);
        else set.delete(name);
        s.privacy.reviewGroups = [...set];
      });
      return;
    }
    if (target.matches("[data-ba-client-policy]")) {
      const group = target.getAttribute("data-ba-client-policy");
      updateSettings((s) => {
        s.client.policies[group] = target.value;
      });
      return;
    }
    const path = target.getAttribute("data-ba-setting");
    if (!path) return;
    const value = target.type === "checkbox" ? target.checked : target.value;
    updateSettings((s) => setPath(s, path, value), { sync: true });
    if (path === "theme.customCss") applyTheme();
    if (path.startsWith("sounds.") || path === "glub.manualBuild") scheduleSettingsSync();
  },
  true,
);

// ---------------------------------------------------------------------------
// Shell wiring
// ---------------------------------------------------------------------------

function wireShell() {
  const root = state.shadow;
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const backdrop = target.closest("[data-role='backdrop']");
    if (backdrop) {
      closePanel();
      return;
    }

    const tab = target.closest("[data-tab]");
    if (tab) {
      switchTab(tab.dataset.tab);
      return;
    }

    const closeModal = target.closest("[data-close-modal]");
    if (closeModal) {
      const which = closeModal.getAttribute("data-close-modal");
      if (which === "viewer") closeViewer();
      if (which === "review") finishReview("cancel");
      if (which === "action") closeActionModal();
      return;
    }

    const toggle = target.closest("[data-toggle]");
    if (toggle) {
      const path = toggle.dataset.toggle;
      const current = !!getPath(state.settings, path);
      updateSettings((s) => setPath(s, path, !current));
      return;
    }

    const action = target.closest("[data-action]")?.getAttribute("data-action");
    if (action) {
      handleAction(action);
      return;
    }

    const flair = target.closest("[data-flair-choice]");
    if (flair) {
      const name = flair.getAttribute("data-flair-choice");
      updateSettings((s) => {
        s.studio.flair = name;
      });
      return;
    }

    const preset = target.closest("[data-template-preset]");
    if (preset) {
      const value = preset.getAttribute("data-template-preset") || "";
      updateSettings((s) => {
        s.studio.template = value;
      });
      return;
    }

    const placeholder = target.closest("[data-placeholder]");
    if (placeholder) {
      insertInto(templateInput(), placeholder.getAttribute("data-placeholder") || "");
      return;
    }

    const fmt = target.closest("[data-code]");
    if (fmt) {
      insertInto(templateInput(), fmt.getAttribute("data-code") || "");
      return;
    }

    const color = target.closest("[data-color]");
    if (color) {
      const code = color.getAttribute("data-color") || "";
      if (target.closest("[data-role='colors']")) insertInto(templateInput(), `&${code}`);
      else insertInto(composerTextarea(), `&${code}`);
      return;
    }

    const clientPreset = target.closest("[data-client-preset]");
    if (clientPreset) {
      const value = clientPreset.getAttribute("data-client-preset") || "";
      updateSettings((s) => {
        s.client.name = value;
      });
      return;
    }

    const theme = target.closest("[data-theme-preset]");
    if (theme) {
      const value = theme.getAttribute("data-theme-preset") || "agnostr";
      updateSettings((s) => {
        s.theme.preset = value;
      });
      return;
    }

    const viewerTab = target.closest("[data-viewer-tab]");
    if (viewerTab) {
      if (state.viewer) {
        const tab = viewerTab.getAttribute("data-viewer-tab");
        state.viewer.tab = tab;
        renderViewer();
        window.requestAnimationFrame(() => {
          const next = state.shadow?.querySelector(`[data-viewer-tab='${tab}']`);
          if (next instanceof HTMLElement) next.focus({ preventScroll: true });
        });
      }
      return;
    }

    const logRow = target.closest("[data-log-index]");
    if (logRow) {
      const index = Number(logRow.getAttribute("data-log-index"));
      const log = state.logs[index];
      if (log?.eventId) openViewer(log.eventId, log.event ? "json" : "relay");
      return;
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches("[data-setting]")) {
      const path = target.getAttribute("data-setting");
      let value = target.value;
      if (target.type === "checkbox") value = target.checked;
      updateSettings((s) => setPath(s, path, value), { sync: false });
      if (path === "studio.template") {
        syncStudioMeta();
        renderPreview();
        renderClientPreview();
      }
      if (path === "client.name") renderClientPreview();
      if (path === "theme.customCss") applyTheme();
      if (path === "glub.manualBuild") {
        syncBuildBadges();
        renderPreview();
        renderClientPreview();
      }
      return;
    }
    if (target.matches("[data-role='log-filter']")) {
      state.logFilter = target.value;
      renderRelay();
      return;
    }
    if (target.matches("[data-policy-group]")) {
      const group = target.getAttribute("data-policy-group");
      const value = target.value;
      updateSettings((s) => {
        s.client.policies[group] = value;
      });
      renderClientPreview();
      return;
    }
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches("[data-setting]")) {
      const path = target.getAttribute("data-setting");
      const value = target.type === "checkbox" ? target.checked : target.value;
      updateSettings((s) => setPath(s, path, value), { sync: false });
      if (path === "theme.customCss") {
        applyTheme();
        scheduleSettingsSync();
      }
      if (path.startsWith("sounds.")) scheduleSettingsSync();
      return;
    }
    if (target.matches("[data-review-tag]")) {
      if (!state.review) return;
      const index = Number(target.getAttribute("data-review-tag"));
      if (!Number.isInteger(index)) return;
      if (target.checked) state.review.selected.add(index);
      else state.review.selected.delete(index);
      return;
    }
    if (target.matches("[data-strip-tag]")) {
      const name = target.getAttribute("data-strip-tag");
      updateSettings((s) => {
        const set = new Set(s.privacy.stripTags);
        if (target.checked) set.add(name);
        else set.delete(name);
        s.privacy.stripTags = [...set];
      });
    }
    if (target.matches("[data-review-group]")) {
      const name = target.getAttribute("data-review-group");
      updateSettings((s) => {
        const set = new Set(s.privacy.reviewGroups);
        if (target.checked) set.add(name);
        else set.delete(name);
        s.privacy.reviewGroups = [...set];
      });
    }
  });

}

document.addEventListener(
  "keydown",
  (event) => {
    if (trapModalKey(event)) return;
    if (event.key === "Escape" && !state.modalOpen && state.settings.ui.panelOpen) {
      closePanel();
    }
  },
  true,
);

function handleAction(action) {
  switch (action) {
    case "open-panel":
      openPanel(state.settings.ui.activeTab || "studio");
      break;
    case "close-panel":
      closePanel();
      break;
    case "clear-flair":
      updateSettings((s) => {
        s.studio.flair = "";
      });
      break;
    case "refresh-build":
      refreshBuild(true);
      break;
    case "inspect-last":
      if (state.lastOutgoingId) openViewer(state.lastOutgoingId);
      else toast("info", "No outgoing event yet", "Send a chat message and try again.");
      break;
    case "toggle-pause":
      updateSettings((s) => {
        s.inspector.paused = !s.inspector.paused;
      });
      if (!state.settings.inspector.paused) {
        askPage("getLogs", { limit: 500 }).then((res) => {
          if (res?.logs) appendLogs(res.logs);
        });
      }
      renderRelay();
      break;
    case "clear-logs":
      state.logs = [];
      renderRelay();
      break;
    case "reset-css":
      updateSettings((s) => {
        s.theme.customCss = "";
      });
      applyTheme();
      break;
    case "copy-diagnostics":
      copyDiagnostics();
      break;
    case "verify-event":
      if (state.viewer?.event) {
        const target = state.viewer.event;
        askPage("verify", { event: target }).then((res) => {
          if (res && state.viewer?.event?.id === target.id) {
            state.verified.set(target.id, res);
            renderViewer();
          }
        });
      }
      break;
    case "copy-json":
      if (state.viewer?.event) copyText(JSON.stringify(state.viewer.event, null, 2), "Event JSON copied");
      break;
    case "download-json":
      if (state.viewer?.event) downloadJson(state.viewer.event);
      break;
    case "copy-id":
      if (state.viewer?.event) copyText(state.viewer.event.id, "Event id copied");
      break;
    case "copy-pubkey":
      if (state.viewer?.event) copyText(state.viewer.event.pubkey, "Pubkey copied");
      break;
    case "copy-npub": {
      const entities = state.viewer?.event ? state.entities.get(state.viewer.event.id) : null;
      if (entities?.npub) copyText(entities.npub, "npub copied");
      break;
    }
    case "open-njump": {
      if (!state.viewer?.event) break;
      const entities = state.entities.get(state.viewer.event.id);
      const id = state.viewer.event.id;
      const url = entities?.nevent ? `https://njump.me/${entities.nevent}` : `https://njump.me/${id}`;
      window.open(url, "_blank", "noopener,noreferrer");
      break;
    }
    case "review-send":
      finishReview("send", false);
      break;
    case "review-scrub":
      finishReview("send", true);
      break;
    case "review-cancel":
      finishReview("cancel");
      break;
    case "action-send":
      sendCustomAction();
      break;
    case "action-insert-user":
      insertCustomActionToken("{user}");
      break;
    case "action-insert-sender":
      insertCustomActionToken("{sender}");
      break;
    case "action-cancel":
      closeActionModal();
      break;
    case "open-studio":
      openPanel("studio");
      break;
    case "open-last":
      if (state.lastOutgoingId) openViewer(state.lastOutgoingId);
      break;
    case "preview-message-sound":
      previewSound("message", state.settings.sounds.message, state.settings.sounds.volume);
      break;
    case "preview-click-sound":
      previewSound("click", state.settings.sounds.click, state.settings.sounds.volume);
      break;
    case "open-agnostr-settings":
      openAgnostrSettings("Appearance");
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Dynamic UI
// ---------------------------------------------------------------------------

function buildDynamicParts() {
  const root = state.shadow;
  if (!root) return;
  const q = (sel) => root.querySelector(sel);

  // colors
  const colors = q("[data-role='colors']");
  if (colors) {
    colors.innerHTML = Object.entries(COLORS)
      .map(
        ([code, value]) =>
          `<button type="button" class="ba-swatch" data-color="${code}" title="&amp;${code} · ${COLOR_NAMES[code]}" style="background:${value};${
            ["f", "e", "b", "a"].includes(code) ? "color:rgba(0,0,0,.65)" : "color:rgba(255,255,255,.38)"
          }">${code}</button>`,
      )
      .join("");
  }

  const actions = q("[data-role='format-actions']");
  if (actions) {
    const items = [
      ["&l", "B", "Bold"],
      ["&o", "I", "Italic"],
      ["&n", "U", "Underline"],
      ["&m", "S", "Strikethrough"],
      ["&k", "K", "Obfuscate"],
      ["&g", "G", "Rainbow gradient"],
      ["&r", "R", "Reset"],
    ];
    actions.innerHTML = items
      .map(([code, label, title]) => `<button type="button" class="ba-btn small" data-code="${code}" title="${title}">${label}</button>`)
      .join("");
  }

  const placeholders = q("[data-role='placeholders']");
  if (placeholders) {
    placeholders.innerHTML = [
      ["{name}", "{name}"],
      ["{tag}", "{tag}"],
      ["{msg}", "{msg}"],
    ]
      .map(([value, label]) => `<button type="button" class="ba-chip" data-placeholder="${value}">${label}</button>`)
      .join("");
  }

  const presets = q("[data-role='presets']");
  if (presets) {
    presets.innerHTML = TEMPLATE_PRESETS.map(
      (p) => `<button type="button" class="ba-chip" data-template-preset="${h(p.value)}">${h(p.label)}</button>`,
    ).join("");
  }

  const flairs = q("[data-role='flairs']");
  if (flairs) {
    flairs.innerHTML = FLAIRS.map(
      (f) =>
        `<button type="button" class="ba-flair-option${f.gated ? " is-gated" : ""}" data-flair-choice="${f.name}" data-preview-flair="${f.name}" title="${h(f.description)}"><span class="ba-flair-name">${h(f.label)}</span><span class="ba-flair-desc">${h(f.description)}</span></button>`,
    ).join("");
  }

  const clientPresets = q("[data-role='client-presets']");
  if (clientPresets) {
    clientPresets.innerHTML = CLIENT_PRESETS.map(
      (name) => `<button type="button" class="ba-chip" data-client-preset="${h(name)}">${h(name)}</button>`,
    ).join("");
  }

  const policies = q("[data-role='policies']");
  if (policies) {
    policies.innerHTML = KIND_GROUPS.map(
      (g) => `
      <div class="ba-policy-row">
        <div class="ba-policy-label">${h(g.label)}<small>${h(g.detail)}</small></div>
        <select class="ba-select" data-policy-group="${g.id}">
          ${KIND_POLICIES.map((p) => `<option value="${p}">${p}</option>`).join("")}
        </select>
      </div>`,
    ).join("");
  }

  const stripTags = q("[data-role='strip-tags']");
  if (stripTags) {
    stripTags.innerHTML = STRIPPABLE_TAGS.map(
      (t) =>
        `<label class="ba-check" title="${h(t.detail)}"><input type="checkbox" data-strip-tag="${t.name}"> <span>${h(t.label)}</span></label>`,
    ).join("");
  }

  const reviewGroups = q("[data-role='review-groups']");
  if (reviewGroups) {
    reviewGroups.innerHTML = KIND_GROUPS.map(
      (g) => `<label class="ba-check"><input type="checkbox" data-review-group="${g.id}"> <span>${h(g.label)}</span></label>`,
    ).join("");
  }

  const themes = q("[data-role='themes']");
  if (themes) {
    themes.innerHTML = ALL_THEMES.map((t) => {
      const colors = themeSwatch(t);
      return `<button type="button" class="ba-theme-btn" data-theme-preset="${t.id}" title="${h(t.description)}"><span class="ba-theme-swatch">${colors
        .map((c) => `<span style="background:${c}"></span>`)
        .join("")}</span><span class="ba-theme-name">${h(t.label)}</span></button>`;
    }).join("");
  }

  for (const select of root.querySelectorAll("[data-sound-kind]")) {
    const list = select.getAttribute("data-sound-kind") === "click" ? CLICK_SOUNDS : MESSAGE_SOUNDS;
    select.innerHTML = list.map((s) => `<option value="${s.id}">${h(s.label)}</option>`).join("");
  }

  const logFilter = q("[data-role='log-filter']");
  if (logFilter) logFilter.value = state.logFilter;
}

function syncInputs() {
  const root = state.shadow;
  if (!root) return;
  for (const el of root.querySelectorAll("[data-setting]")) {
    const path = el.getAttribute("data-setting");
    const value = getPath(state.settings, path);
    if (el === root.activeElement) continue;
    if (el.type === "checkbox") el.checked = !!value;
    else el.value = value ?? "";
  }
  for (const el of root.querySelectorAll("[data-toggle]")) {
    const value = !!getPath(state.settings, el.getAttribute("data-toggle"));
    el.classList.toggle("is-on", value);
    el.setAttribute("aria-pressed", value ? "true" : "false");
  }
  for (const el of root.querySelectorAll("[data-policy-group]")) {
    const group = el.getAttribute("data-policy-group");
    el.value = state.settings.client.policies[group] || "leave";
  }
  for (const el of root.querySelectorAll("[data-strip-tag]")) {
    el.checked = state.settings.privacy.stripTags.includes(el.getAttribute("data-strip-tag"));
  }
  for (const el of root.querySelectorAll("[data-review-group]")) {
    el.checked = state.settings.privacy.reviewGroups.includes(el.getAttribute("data-review-group"));
  }
}

function syncDynamic() {
  const root = state.shadow;
  if (!root) return;
  for (const el of root.querySelectorAll("[data-policy-group]")) {
    el.disabled = false;
  }
  for (const el of root.querySelectorAll("[data-flair-choice]")) {
    const name = el.getAttribute("data-flair-choice");
    el.classList.toggle("is-active", state.settings.studio.flair === name);
    el.style.setProperty("--ba-flair-tint", flairTint(name));
  }
  for (const el of root.querySelectorAll("[data-theme-preset]")) {
    el.classList.toggle("is-active", state.settings.theme.preset === el.getAttribute("data-theme-preset"));
  }
  for (const el of root.querySelectorAll("[data-client-preset]")) {
    el.classList.toggle("is-active", state.settings.client.name === el.getAttribute("data-client-preset"));
  }
  for (const el of root.querySelectorAll("[data-template-preset]")) {
    el.classList.toggle("is-active", state.settings.studio.template === el.getAttribute("data-template-preset"));
  }
  syncStudioMeta();
  renderPreview();
  renderClientPreview();
  syncFooter();
  syncBuildBadges();
  syncLastOutgoing();
  const pauseBtn = root.querySelector("[data-action='toggle-pause']");
  if (pauseBtn) pauseBtn.textContent = state.settings.inspector.paused ? "resume" : "pause";
  if (state.activeTab === "relay") renderRelay();
  if (state.activeTab === "help") renderDiagnostics();
}

function syncStudioMeta() {
  const root = state.shadow;
  if (!root) return;
  const count = root.querySelector("[data-role='fmt-count']");
  if (count) {
    const tpl = state.settings.studio.template || "";
    count.textContent = `${tpl.length}/${FMT_MAX}${tpl.includes("{msg}") ? "" : " · {msg} appended"}`;
    count.classList.toggle("warn", tpl.length > FMT_MAX * 0.9);
  }
}

function templateInput() {
  return state.shadow?.querySelector("[data-setting='studio.template']") || null;
}

function composerTextarea(scope = null) {
  const root = scope?.closest?.(".ag-composer-dock") || scope?.closest?.(".ag-composer") || document;
  let list = [...root.querySelectorAll(".ag-composer-input")];
  if (!list.length && root !== document) list = [...document.querySelectorAll(".ag-composer-input")];
  const active = document.activeElement;
  return (
    list.find((el) => el === active) ||
    list.find((el) => el instanceof HTMLTextAreaElement && !el.disabled && !el.readOnly && el.offsetParent !== null) ||
    list[0] ||
    null
  );
}

function insertInto(input, text) {
  if (!input) {
    toast("warning", "No target field", "Open a chat composer or the line-format field first.");
    return;
  }
  if ((input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) && (input.disabled || input.readOnly)) {
    toast("warning", "Field is read-only", "This field cannot be edited right now.");
    return;
  }
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + text + input.value.slice(end);
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(input, next);
    else input.value = next;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    try {
      input.setSelectionRange(start + text.length, start + text.length);
    } catch {}
    return;
  }
  input.focus();
  document.execCommand?.("insertText", false, text);
}

function flairTint(name) {
  switch (name) {
    case "fire":
      return "radial-gradient(ellipse at 50% 120%, rgba(255,94,25,.48) 0%, rgba(255,94,25,.06) 55%, transparent 75%)";
    case "lightning":
      return "linear-gradient(110deg, rgba(88,160,255,.42), rgba(160,120,255,.16) 55%, transparent)";
    case "stars":
      return "radial-gradient(ellipse at 50% 20%, rgba(129,140,248,.4), rgba(129,140,248,.05) 65%, transparent)";
    case "rain":
      return "linear-gradient(180deg, rgba(56,189,248,.12), rgba(37,99,235,.38))";
    case "plume":
      return "linear-gradient(100deg, rgba(167,139,250,.4), rgba(148,163,184,.15) 60%, transparent)";
    case "neon":
      return "linear-gradient(90deg, rgba(236,72,153,.38), rgba(34,211,238,.32))";
    case "matrix":
      return "linear-gradient(180deg, rgba(34,197,94,.35), rgba(34,197,94,.04))";
    case "sonar":
      return "radial-gradient(circle at 20% 50%, rgba(45,212,191,.42), transparent 58%)";
    case "fireflies":
      return "radial-gradient(ellipse at 40% 60%, rgba(250,204,21,.34), transparent 68%)";
    case "bubbles":
      return "linear-gradient(0deg, rgba(34,211,238,.38), transparent 66%)";
    case "aurora":
      return "linear-gradient(110deg, rgba(34,197,94,.4), rgba(56,189,248,.26), rgba(168,85,247,.4))";
    case "bitcoin":
      return "linear-gradient(90deg, rgba(247,147,26,.4), transparent 65%)";
    case "glitch":
      return "linear-gradient(90deg, rgba(239,68,68,.34), rgba(34,211,238,.26))";
    case "sol":
      return "radial-gradient(circle at 50% 50%, rgba(250,204,21,.5), rgba(250,204,21,.06) 60%, transparent 75%)";
    default:
      return "linear-gradient(135deg, transparent, rgba(255,255,255,.04))";
  }
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function renderPreview() {
  const root = state.shadow;
  if (!root) return;
  const container = root.querySelector("[data-role='preview']");
  if (!container) return;

  const build = effectiveBuild(state.settings);
  const template = state.settings.studio.template;
  const flair = state.settings.studio.flair;
  const name = state.status?.nickname || "you";
  const tag = (state.status?.pubkey || "a1b2c3d4").slice(-4);
  const msg = PREVIEW_MESSAGE;
  const avatar = previewAvatarSrc();
  const msgHtml = renderFormatHtml(msg);
  let line;
  try {
    line = renderLineHtml(template, { name, tag, msgHtml, msgText: msg });
  } catch {
    line = h(msg);
  }
  const plain = stripFormat(msg);
  const flairClasses = flair ? flairClass(flair) : "";
  const flairStyle = flair ? flairStyleVars(flairVars(flair)) : "";
  const fx = flair && flairHasFx(flair) ? `<span class="flairFx" aria-hidden="true">${flairFxInner(flair)}</span>` : "";
  const overlay = flair ? flairOverlayInner(flair) : "";
  container.innerHTML = `
    <div class="ba-preview-wrap">
      <div class="ba-preview-head">
        <span>glub.chat view</span>
        <span class="ba-preview-build ${build ? "ok" : "warn"}">${build ? `build ${h(build.slice(0, 7))}` : "build missing · glub metadata skipped"}</span>
      </div>
      <div class="ba-preview-row ${flairClasses}" style="${flairStyle}">
        <img class="ba-preview-avatar" src="${h(avatar)}" alt="">
        <span class="ba-preview-main">
          <span class="ba-preview-meta">${h(name)}#${h(tag)} · just now · ${h(flair || "no flair")}</span>
          <span class="ba-preview-line">${line || h(msg)}</span>
        </span>
        ${fx}${overlay}
      </div>
      <div class="ba-preview-native"><span class="ba-preview-native-label">native</span><span>${h(plain)}</span></div>
      <div class="ba-preview-template"><span>template</span><code>${h(template || "(none)")}</code></div>
    </div>`;
}

function renderClientPreview() {
  const root = state.shadow;
  if (!root) return;
  const pre = root.querySelector("[data-role='client-preview']");
  if (!pre) return;
  const build = effectiveBuild(state.settings);
  const policies = state.settings.client.policies;
  const meta = {
    rich: "",
    fmt: state.settings.studio.enabled ? normalizeTemplate(state.settings.studio.template) : "",
    flair: state.settings.studio.enabled ? state.settings.studio.flair : "",
  };
  const sample = {
    kind: 20000,
    tags: [["g", "dr5r"], ["n", state.status?.nickname || "you"]],
    content: "hello",
  };
  if (policies.chat === "spoof" && state.settings.client.name) {
    sample.tags.push(["client", state.settings.client.name]);
  } else if (policies.chat === "strip") {
    sample.tags = sample.tags.filter((t) => t[0] !== "client");
  }
  if (meta.fmt || meta.flair) {
    const tag = ["glub"];
    if (meta.rich) tag.push("rich", meta.rich);
    if (meta.fmt) tag.push("fmt", meta.fmt);
    if (meta.flair) tag.push("flair", meta.flair);
    if (build) tag.push("v", build);
    if (tag.length > 1) sample.tags.push(tag);
  } else if (policies.chat === "spoof" && state.settings.client.name.toLowerCase() === "glub.chat" && build) {
    sample.tags.push(["glub", "v", build]);
  }
  const lines = sample.tags.map((t) => `["${t[0]}", ${t.slice(1).map((x) => JSON.stringify(x)).join(", ")}]`).join(",\n  ");
  pre.textContent = `{
  "kind": 20000,
  "tags": [
  ${lines}
  ],
  "content": "hello"
}`;
  const clientBuild = root.querySelector("[data-role='client-build']");
  if (clientBuild) {
    clientBuild.textContent = build ? `build ${build.slice(0, 8)} · live` : "build missing";
    clientBuild.className = `ba-hint ${build ? "ok" : "warn"}`;
  }
  if (clientBuild) clientBuild.classList.add("ba-hint");
}

// ---------------------------------------------------------------------------
// Footer / build badges
// ---------------------------------------------------------------------------

function syncFooter() {
  const root = state.shadow;
  if (!root) return;
  const status = state.status || {};
  const signer = root.querySelector("[data-role='foot-signer']");
  if (signer) {
    if (status.signerHooked) signer.textContent = `signer: ${status.signMode || "attached"}`;
    else if (status.nip07Patched) signer.textContent = "rewriter: nip-07";
    else signer.textContent = "signer: waiting";
  }
  const build = root.querySelector("[data-role='foot-build']");
  if (build) {
    const b = effectiveBuild(state.settings);
    build.textContent = b ? `build: ${b.slice(0, 8)}` : "build: —";
  }
  const events = root.querySelector("[data-role='foot-events']");
  if (events) events.textContent = `${state.events.size} events`;
  const sub = root.querySelector("[data-role='header-sub']");
  if (sub) {
    const parts = [];
    parts.push(
      status.signerHooked
        ? `signer ${status.signMode || "attached"}`
        : status.nip07Patched
          ? "NIP-07 rewriter"
          : "signer waiting",
    );
    if (b()) parts.push(`glub ${b().slice(0, 7)}`);
    sub.textContent = parts.join(" · ");
  }
  const dot = root.querySelector("[data-role='header-dot']");
  if (dot) {
    dot.className = "ba-status-dot";
    if ((status.signerHooked || status.nip07Patched) && b()) dot.classList.add("ok");
    else if (status.signerHooked || status.nip07Patched || b()) dot.classList.add("warn");
    else dot.classList.add("err");
  }
}

function b() {
  return effectiveBuild(state.settings);
}

function syncBuildBadges() {
  const root = state.shadow;
  if (!root) return;
  const build = effectiveBuild(state.settings);
  const badge = root.querySelector("[data-role='build-badge']");
  if (badge) {
    if (build) {
      badge.textContent = `glub build ${build.slice(0, 8)}`;
      badge.className = "ba-hint ok";
    } else {
      badge.textContent = state.buildError ? "build sync failed" : "syncing build…";
      badge.className = `ba-hint ${state.buildError ? "err" : "warn"}`;
    }
  }
  const clientBuild = root.querySelector("[data-role='client-build']");
  if (clientBuild) {
    clientBuild.textContent = build ? `build ${build.slice(0, 8)} · live` : "build missing";
    clientBuild.className = `ba-hint ${build ? "ok" : "warn"}`;
  }
  const footBuild = root.querySelector("[data-role='foot-build']");
  if (footBuild) footBuild.textContent = build ? `build: ${build.slice(0, 8)}` : "build: —";
  const cardStatus = root.querySelector("[data-role='build-card-status']");
  if (cardStatus) {
    if (state.settings.glub.manualBuild) {
      cardStatus.textContent = `Manual override active: ${state.settings.glub.manualBuild}`;
      cardStatus.className = "ba-hint warn";
    } else if (build) {
      cardStatus.textContent = `Auto-synced build ${build}. Messages are stamped with this value.`;
      cardStatus.className = "ba-hint ok";
    } else {
      cardStatus.textContent = state.buildError || "No build stamp yet; glub metadata will be skipped.";
      cardStatus.className = `ba-hint ${state.buildError ? "err" : "warn"}`;
    }
  }
  syncFooter();
}

function syncLastOutgoing() {
  const root = state.shadow;
  if (!root) return;
  const pre = root.querySelector("[data-role='last-outgoing']");
  if (!pre) return;
  const ev = state.lastOutgoingId ? eventById(state.lastOutgoingId) : null;
  if (!ev) {
    pre.textContent = "No outgoing event captured yet.";
    return;
  }
  pre.textContent = JSON.stringify(ev, null, 2);
}

// ---------------------------------------------------------------------------
// Panel open/close/tabs
// ---------------------------------------------------------------------------

function mapBetterTab(tab) {
  const map = { studio: "line", line: "line", client: "client", general: "line", theme: "line" };
  return map[tab] || "line";
}

function findNativeSettingsButton() {
  const roots = [
    ...document.querySelectorAll(".ag-app-rail, .ag-suite-popover, .ag-suite-footer, .ag-header, header"),
  ];
  const scoped = roots.length
    ? roots.flatMap((root) => [...root.querySelectorAll("button")])
    : [...document.querySelectorAll("button")];
  const candidates = [...new Set(scoped)].filter(
    (b) =>
      !b.closest(".ba-composer-bar") &&
      !b.hasAttribute("data-ba-suite-better") &&
      /settings/i.test(`${b.getAttribute("aria-label") || ""} ${b.title || ""} ${b.textContent || ""}`),
  );
  const visible = candidates.find((b) => b.offsetParent !== null);
  if (visible) return visible;
  const hiddenNative = document.querySelector("[data-ba-hidden-native-settings]");
  if (hiddenNative) return hiddenNative;
  return candidates[0] || null;
}

function openBetterSettings(tab = "line") {
  state.betterTab = mapBetterTab(tab);
  state.settings.ui.betterTab = state.betterTab;
  debounceSave();
  state.settingsBetterActive = true;
  state.aboutActive = false;
  const modal = document.querySelector(".ag-settings-modal");
  if (modal) {
    syncSettingsIntegration();
    return;
  }
  const btn = findNativeSettingsButton();
  if (!btn) {
    toast("warning", "Settings unavailable", "Open Agnostr settings from the suite menu.");
    return;
  }
  btn.click();
  let attempts = 0;
  const finishOpen = () => {
    const m = document.querySelector(".ag-settings-modal");
    if (!m) {
      attempts += 1;
      if (attempts < 24) window.setTimeout(finishOpen, 80);
      return;
    }
    state.settingsModalOpen = true;
    state.settingsBetterActive = true;
    state.aboutActive = false;
    syncSettingsIntegration();
    ensureBetterNav(m);
    renderBetterSettingsPane(m);
  };
  window.setTimeout(finishOpen, 80);
  const age = Date.now() - Number(state.settings.glub.buildFetchedAt || 0);
  if (!state.settings.glub.build || age > 2 * 60 * 1000) refreshBuild(false);
  askPage("getRecent", { limit: 300 }).then((res) => {
    if (res?.events) {
      for (const ev of res.events) rememberEvent(ev);
      scheduleEnhance();
      scheduleSettingsSync();
    }
  });
}

function openPanel(tab) {
  openBetterSettings(tab);
}

function closePanel() {
  // The floating panel is gone; settings stay where they are.
}

function updatePanelVisibility() {
  // Legacy no-op: all settings live in Agnostr's settings modal now.
}

function switchTab() {}

// ---------------------------------------------------------------------------
// Relay inspector
// ---------------------------------------------------------------------------

function renderRelay() {
  const root = state.shadow;
  if (!root) return;
  const statusEl = root.querySelector("[data-role='relay-status']");
  const list = root.querySelector("[data-role='relay-list']");
  const info = root.querySelector("[data-role='session-info']");
  const status = state.status || {};
  if (statusEl) {
    const relays = status.relays || [];
    statusEl.innerHTML =
      relays.length > 0
        ? relays
            .slice(0, 16)
            .map(
              (r) =>
                `<span class="ba-relay-pill ${r.status === "open" ? "ok" : r.status === "error" || r.status === "closed" ? "err" : ""}" title="${h(r.error || "")}">${h(hostOf(r.url))} · ${h(r.status)}</span>`,
            )
            .join("")
        : `<span class="ba-relay-pill">no sockets observed yet</span>`;
  }
  if (info) {
    const signer = status.signerHooked
      ? status.signMode || "attached"
      : status.nip07Patched
        ? "nip-07"
        : "waiting";
    info.innerHTML = `
      <div class="ba-kv"><span>signer</span><span>${h(signer)}</span></div>
      <div class="ba-kv"><span>pubkey</span><span>${h(short(status.pubkey || "", 18))}</span></div>
      <div class="ba-kv"><span>sockets</span><span>${h(String(status.socketCount || 0))}</span></div>
      <div class="ba-kv"><span>events captured</span><span>${h(String(state.events.size))}</span></div>
      <div class="ba-kv"><span>frames logged</span><span>${h(String(state.logs.length))}</span></div>
      <div class="ba-kv"><span>blocked call signals</span><span>${h(String(status.callDrops || 0))}</span></div>`;
  }
  if (!list) return;
  const filter = state.logFilter.trim().toLowerCase();
  const filtered = [];
  for (let i = state.logs.length - 1; i >= 0 && filtered.length < 180; i--) {
    const log = state.logs[i];
    const hay = `${log.type} ${log.relay} ${log.kind ?? ""} ${log.eventId ?? ""} ${log.summary ?? ""}`.toLowerCase();
    if (filter && !hay.includes(filter)) continue;
    filtered.push([i, log]);
  }
  if (!filtered.length) {
    list.innerHTML = `<div class="ba-empty">${state.logs.length ? "No frames match the filter." : "Relay traffic will appear here as the page connects."}</div>`;
    return;
  }
  list.innerHTML = filtered
    .map(([index, log]) => {
      const dir = log.dir === "out" ? "out" : log.dir === "sys" ? "sys" : log.type?.startsWith("BLOCKED") ? "blocked" : "in";
      const arrow = dir === "out" ? "→" : dir === "sys" ? "•" : dir === "blocked" ? "×" : "←";
      return `<button type="button" class="ba-log" data-log-index="${index}" title="${h(log.summary || "")}">
        <span class="ba-log-dir ${dir}">${arrow}</span>
        <span class="ba-log-time">${h(timeLabel(log.ts))}</span>
        <span class="ba-log-summary">${h(log.summary || log.type || "")}</span>
        <span class="ba-log-type">${h(short(hostOf(log.relay), 14))}</span>
      </button>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Message row enhancements
// ---------------------------------------------------------------------------

function scheduleEnhance(force = false) {
  if (!state.enabledReady || state.settings.enabled === false) return;
  if (!force && document.hidden) {
    state.enhancePending = true;
    return;
  }
  if (state.enhanceTimer !== null) return;
  state.enhanceTimer = window.setTimeout(() => {
    state.enhanceTimer = null;
    enhanceAll();
  }, 120);
}

const CHAT_LABEL_RE = /\bBitchat\b/gi;
const CHAT_LABEL_BLOCKED = [
  ".ag-msg-rich",
  ".ag-msg-content",
  ".ag-chat-row-preview",
  ".ag-msg-preview",
  ".ag-conv-preview",
  ".ag-composer",
  ".ag-msg-author",
  ".ag-users-name",
  ".ag-peer-modal-name",
  ".ag-qp-display-name",
  "textarea",
  "input",
  "select",
  "option",
  "pre",
  "code",
  "script",
  "style",
  "[contenteditable='true']",
].join(", ");

function chatLabel(value) {
  return String(value || "").replace(CHAT_LABEL_RE, "Chat");
}

function removeTransientNativeToasts() {
  for (const toast of document.querySelectorAll(".ag-toast")) {
    const title = toast.querySelector(".ag-toast-title")?.textContent || "";
    const detail = toast.querySelector(".ag-toast-detail")?.textContent || "";
    const callsBlocked = !!state.settings.privacy.calls.disable;
    if (
      /running\s+locally\s+via\s+(?:wasm|webgpu)/i.test(detail) ||
      /image\s+safety\s+classifier.*ready/i.test(title) ||
      /\bwasm\b.*\bloaded\b|\bloaded\b.*\bwasm\b/i.test(`${title} ${detail}`) ||
      (callsBlocked && /call\s+(?:blocked|signaling failed|failed)|unable to join .*call/i.test(`${title} ${detail}`))
    ) {
      toast.remove();
    }
  }
}

// Replace the product name across UI labels and attributes, including new
// Bitchat surfaces, while leaving message bodies, names, and inputs untouched.
function replaceBitchatText() {
  if (!state.enabledReady || state.settings.enabled === false || !document.body) return;
  const now = performance.now();
  if (now - state.lastBitchatReplace < 350) {
    if (state.bitchatTimer === null) {
      state.bitchatTimer = window.setTimeout(() => {
        state.bitchatTimer = null;
        replaceBitchatText();
      }, 350 - (now - state.lastBitchatReplace));
    }
    return;
  }
  state.lastBitchatReplace = now;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!CHAT_LABEL_RE.test(node.nodeValue || "")) {
        CHAT_LABEL_RE.lastIndex = 0;
        return NodeFilter.FILTER_REJECT;
      }
      CHAT_LABEL_RE.lastIndex = 0;
      const parent = node.parentElement;
      if (!parent || parent.closest(CHAT_LABEL_BLOCKED)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) node.nodeValue = chatLabel(node.nodeValue || "");

  for (const el of document.querySelectorAll("[aria-label], [title], [placeholder], [alt]")) {
    if (!(el instanceof HTMLElement) || el.closest(CHAT_LABEL_BLOCKED)) continue;
    for (const attr of ["aria-label", "title", "placeholder", "alt"]) {
      const value = el.getAttribute(attr);
      if (value && CHAT_LABEL_RE.test(value)) {
        CHAT_LABEL_RE.lastIndex = 0;
        el.setAttribute(attr, chatLabel(value));
      }
      CHAT_LABEL_RE.lastIndex = 0;
    }
  }
  if (/\bbitchat\b/i.test(document.title)) {
    document.title = document.title.replace(CHAT_LABEL_RE, "Chat");
    CHAT_LABEL_RE.lastIndex = 0;
  }
}

function scheduleBitchatReplace(delay = 80) {
  if (state.bitchatTimer !== null) return;
  state.bitchatTimer = window.setTimeout(() => {
    state.bitchatTimer = null;
    replaceBitchatText();
  }, delay);
}

function observeChatLabels() {
  if (typeof MutationObserver !== "function" || !document.body) return;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") {
        if (CHAT_LABEL_RE.test(record.target.nodeValue || "")) {
          CHAT_LABEL_RE.lastIndex = 0;
          scheduleBitchatReplace();
          return;
        }
        CHAT_LABEL_RE.lastIndex = 0;
        continue;
      }
      if (record.type === "attributes") {
        const el = record.target;
        if (!(el instanceof Element)) continue;
        const value = el.getAttribute(record.attributeName || "");
        if (value && CHAT_LABEL_RE.test(value)) {
          CHAT_LABEL_RE.lastIndex = 0;
          scheduleBitchatReplace();
          return;
        }
        CHAT_LABEL_RE.lastIndex = 0;
        continue;
      }
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (CHAT_LABEL_RE.test(node.textContent || "") || CHAT_LABEL_RE.test(node.getAttribute("aria-label") || "") || CHAT_LABEL_RE.test(node.getAttribute("title") || "")) {
          CHAT_LABEL_RE.lastIndex = 0;
          scheduleBitchatReplace();
          return;
        }
        CHAT_LABEL_RE.lastIndex = 0;
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "title", "placeholder", "alt"],
  });
}

function maintainCallControls() {
  if (!state.enabledReady || state.settings.enabled === false) return;
  const now = Date.now();
  const elapsed = now - (state.lastCallMaintenance || 0);
  if (elapsed < 2000) {
    if (state.callMaintenanceTimer === null) {
      state.callMaintenanceTimer = window.setTimeout(() => {
        state.callMaintenanceTimer = null;
        maintainCallControls();
      }, 2000 - elapsed + 20);
    }
    return;
  }
  state.lastCallMaintenance = now;
  applyCallButtons();
  hideCallUi();
  markLocateButtons();
}

function enhanceAll() {
  if (!state.enabledReady || state.settings.enabled === false) return;
  if (!document.body) return;
  if (document.hidden) {
    state.enhancePending = true;
    return;
  }
  const observer = state.pageObserver;
  observer?.disconnect();
  try {
    // Native channel/context menus are sensitive to DOM churn. While one is open,
    // only finish the message-action menu and let the rest wait until it closes.
    if (document.querySelector(".ag-ctx-menu")) {
      enhanceContextMenu();
      return;
    }
    removeCallMenuItems();
    maintainCallControls();
    ensureSuiteButton();
    ensureToolbars();
    ensureComposerEmoji();
    decorateRows();
    cleanupRichObservers();
    enhanceContextMenu();
    markBetterClients();
    hideSelfTeleportBadges();
    removeTransientNativeToasts();
    scheduleBitchatReplace();
  } finally {
    state.pageObserverStart?.();
  }
}

function applyShortcutVisibility() {
  for (const node of document.querySelectorAll("[data-ba-rail], .ba-rail-slot")) node.remove();
  ensureSuiteButton();
}

function isGroupChatView() {
  const avatar = document.querySelector(".ag-header .ag-header-avatar.server");
  return avatar instanceof HTMLElement && avatar.getClientRects().length > 0;
}

function returnToPublicChat() {
  const railChat = document.querySelector(".ag-rail-bitchat");
  if (railChat instanceof HTMLElement) {
    railChat.click();
    return true;
  }
  const mobile = [...document.querySelectorAll(".ag-mtab-btn, .ag-mobile-tabbar button")].find((el) =>
    /(^|\s)chat(\s|$)/i.test(`${el.textContent || ""} ${el.getAttribute("aria-label") || ""}`) ||
    !!el.querySelector('svg[class*="lucide-waves"]'),
  );
  if (mobile instanceof HTMLElement) {
    mobile.click();
    return true;
  }
  const card = [...document.querySelectorAll(".ag-suite-card")].find((el) =>
    /chat/i.test(el.querySelector(".ag-suite-card-name")?.textContent || ""),
  );
  if (card instanceof HTMLElement) {
    card.click();
    return true;
  }
  return false;
}

function ensureSuiteBetter() {
  const footer = document.querySelector(".ag-suite-footer");
  if (!footer) return;
  let button = footer.querySelector("[data-ba-suite-better]");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "ag-suite-util-btn ba-suite-better";
    button.setAttribute("data-ba-suite-better", "1");
    button.title = "Better Agnostr settings";
    button.setAttribute("aria-label", "Better Agnostr settings");
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"></path><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z"></path></svg><span>Better Agnostr</span>';
    footer.append(button);
  }
  footer.classList.add("ba-suite-footer-dynamic");
}

function ensureSuiteButton() {
  const footer = document.querySelector(".ag-suite-footer");
  for (const btn of document.querySelectorAll(".ag-suite-util-btn")) {
    if (btn.hasAttribute("data-ba-suite-better")) continue;
    const text = (btn.textContent || "").trim();
    if (/^(radar map|search|better)/i.test(text)) {
      btn.style.display = "none";
      btn.setAttribute("data-ba-suite-util-hidden", "1");
    } else if (/^settings/i.test(text)) {
      btn.style.removeProperty("display");
      btn.removeAttribute("data-ba-suite-util-hidden");
    }
  }
  if (!footer) return;
  footer.style.removeProperty("display");
  ensureSuiteBetter();
  const prev = footer.previousElementSibling;
  if (prev?.classList.contains("ag-suite-divider")) prev.style.removeProperty("display");
}

function activeEmojiGroup() {
  return EMOJI_GROUPS.find((group) => group.id === state.emojiCategory) || EMOJI_GROUPS[0];
}

function emojiPickerBodyHtml() {
  const active = activeEmojiGroup();
  const tabs = EMOJI_GROUPS.map(
    (group) => `<button type="button" class="ba-emoji-tab${group.id === active.id ? " is-active" : ""}" data-ba-emoji-tab="${group.id}" title="${h(group.label)}" aria-label="${h(group.label)}">${group.icon}</button>`,
  ).join("");
  const items = active.emojis
    .map((emoji) => `<button type="button" class="ba-emoji-item" data-ba-emoji="${emoji}" aria-label="Insert ${emoji}">${emoji}</button>`)
    .join("");
  return `<div class="ba-emoji-tabs">${tabs}</div><div class="ba-emoji-grid">${items}</div>`;
}

function emojiPicker() {
  let pop = document.querySelector(".ba-emoji-popover");
  if (!pop) {
    pop = document.createElement("div");
    pop.className = "ba-emoji-popover";
    pop.setAttribute("data-ba-emoji-picker", "1");
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Emoji picker");
    pop.hidden = true;
    document.body.appendChild(pop);
  }
  if (!pop.dataset.ready) {
    pop.innerHTML = emojiPickerBodyHtml();
    pop.dataset.ready = "1";
  }
  return pop;
}

function hideEmojiPicker() {
  const pop = document.querySelector(".ba-emoji-popover");
  if (pop) pop.hidden = true;
  if (state.emojiAnchor instanceof HTMLElement) state.emojiAnchor.setAttribute("aria-expanded", "false");
  state.emojiAnchor = null;
}

function positionEmojiPicker(anchor) {
  const pop = emojiPicker();
  pop.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const box = pop.getBoundingClientRect();
  const viewport = window.visualViewport;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  const offsetTop = viewport?.offsetTop || 0;
  const margin = 10;
  let left = Math.min(rect.left, width - box.width - margin);
  left = Math.max(margin, left);
  let top = rect.bottom + 7;
  if (top + box.height > height - margin) top = Math.max(margin + offsetTop, rect.top - box.height - 7);
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

function openEmojiPicker(anchor) {
  const pop = emojiPicker();
  if (!pop.hidden) {
    const same = state.emojiAnchor === anchor;
    state.emojiAnchor = anchor;
    if (same) {
      hideEmojiPicker();
      return;
    }
  }
  state.emojiAnchor = anchor;
  anchor.setAttribute("aria-expanded", "true");
  positionEmojiPicker(anchor);
  const first = pop.querySelector(".ba-emoji-tab.is-active, .ba-emoji-item");
  if (first instanceof HTMLElement) first.focus({ preventScroll: true });
}

function insertEmoji(emoji) {
  insertInto(composerTextarea(), emoji);
  hideEmojiPicker();
}

function ensureComposerEmoji() {
  for (const right of document.querySelectorAll(".ag-composer-right")) {
    if (right.querySelector("[data-ba-emoji-trigger='composer']")) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ag-composer-icon-btn ba-emoji-btn";
    button.setAttribute("data-ba-emoji-trigger", "composer");
    button.setAttribute("aria-label", "Insert emoji");
    button.setAttribute("aria-expanded", "false");
    button.title = "Insert emoji";
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" x2="9.01" y1="9" y2="9"></line><line x1="15" x2="15.01" y1="9" y2="9"></line></svg>';
    const voice = right.querySelector('button[aria-label*="voice memo" i], button[title*="voice memo" i]');
    if (voice) voice.before(button);
    else right.prepend(button);
  }
}

function applyVoiceMemoVisibility() {
  const remove = state.settings.privacy.removeVoiceMemo !== false;
  for (const btn of document.querySelectorAll(
    '.ag-composer-dock button[aria-label*="voice memo" i], .ag-composer-dock button[title*="voice memo" i]',
  )) {
    if (!(btn instanceof HTMLElement)) continue;
    if (remove) {
      if (btn.dataset.baVoiceHidden !== "1") {
        btn.dataset.baVoiceDisplay = btn.style.display;
        btn.dataset.baVoiceHidden = "1";
      }
      btn.style.display = "none";
    } else if (btn.dataset.baVoiceHidden === "1") {
      btn.style.display = btn.dataset.baVoiceDisplay || "";
      delete btn.dataset.baVoiceHidden;
      delete btn.dataset.baVoiceDisplay;
    }
  }
}

function composerToolbarHtml() {
  const colorButtons = Object.entries(COLORS)
    .map(
      ([code, value]) =>
        `<button type="button" data-color="${code}" title="&amp;${code} · ${COLOR_NAMES[code]}" aria-label="${h(COLOR_NAMES[code])}" style="background:${value}"></button>`,
    )
    .join("");
  return `
    <button type="button" class="ba-composer-toggle" data-ba-format-toggle="1" title="Formatting" aria-label="Toggle formatting bar" aria-expanded="false">Aa</button>
    <div class="ba-composer-bar" role="toolbar" aria-label="Message formatting">
      <button type="button" data-code="&l" title="Bold" aria-label="Bold">B</button>
      <button type="button" data-code="&o" title="Italic" aria-label="Italic" style="font-style:italic">I</button>
      <button type="button" data-code="&n" title="Underline" aria-label="Underline" style="text-decoration:underline">U</button>
      <button type="button" data-code="&m" title="Strikethrough" aria-label="Strikethrough" style="text-decoration:line-through">S</button>
      <button type="button" data-code="&k" title="Obfuscate" aria-label="Obfuscate">K</button>
      <button type="button" data-code="&g" title="Rainbow" aria-label="Rainbow">G</button>
      <button type="button" data-code="&r" title="Reset" aria-label="Reset formatting">R</button>
      <button type="button" class="ba-color-toggle" data-action="toggle-colors" title="Colors" aria-label="Colors" aria-expanded="false"></button>
      <div class="ba-color-popover" hidden>${colorButtons}</div>
    </div>`;
}

function ensureToolbars() {
  applyVoiceMemoVisibility();
  for (const dock of document.querySelectorAll(".ag-composer-dock")) {
    for (const old of dock.querySelectorAll(":scope > .ba-composer-bar")) old.remove();
    let head = dock.querySelector(":scope > .ba-composer-head");
    if (!head || !head.querySelector(".ba-composer-bar")) {
      if (!head) {
        head = document.createElement("div");
        head.className = "ba-composer-head";
      }
      head.innerHTML = composerToolbarHtml();
      if (head.dataset.baWired !== "1") {
        head.dataset.baWired = "1";
        head.addEventListener("mousedown", (event) => {
          if (event.target.closest("button")) event.preventDefault();
        });
      }
      if (!head.isConnected) dock.prepend(head);
    }
    const bar = head.querySelector(".ba-composer-bar");
    const hidden = state.settings.studio.showComposerToolbar === false;
    if (bar) bar.hidden = hidden;
    const toggle = head.querySelector("[data-ba-format-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", hidden ? "false" : "true");
  }
}

// React owns the row's className. When it re-renders a row (for example when the
// message action menu opens), it can drop the classes BA added even though the
// data-* attributes survive. The normal enhance pass is deliberately debounced,
// which leaves a visible flash of unformatted text. Repair the one affected row
// synchronously from the mutation observer instead, before the next paint.
function rowDecorationIntact(row, ev) {
  if (row.dataset.baFlairSuppressed) {
    const suppressed = row.dataset.baFlairSuppressed;
    const limit = flairLimit(suppressed);
    if (limit > 0 && document.querySelectorAll(`.ag-msg-row.flair-${suppressed}`).length < limit) {
      delete row.dataset.baFlairSuppressed;
      return false;
    }
    return true;
  }
  if (!row.querySelector(".ba-json-btn, .ba-row-json-btn")) return false;
  if (row.dataset.baFlair) {
    if (!row.classList.contains("flair")) return false;
    if (!row.classList.contains(`flair-${row.dataset.baFlair}`)) return false;
    if (!row.querySelector(":scope > .ba-flair-layer")) return false;
    try {
      const expected = JSON.parse(row.dataset.baFlairVars || "{}");
      for (const [key, value] of Object.entries(expected)) {
        if (row.style.getPropertyValue(key) !== String(value)) return false;
      }
    } catch {
      return false;
    }
  }
  const rich = row.querySelector(".ag-msg-rich");
  const author = row.querySelector(".ag-msg-author");
  for (const el of [author, rich]) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.dataset.baLineRainbow === "1" && !el.classList.contains("fmtRainbow")) return false;
    const expected = String(el.dataset.baLineClasses || "").split(" ").filter(Boolean);
    if (expected.some((cls) => !el.classList.contains(cls))) return false;
  }
  const ownPubkey = String(state.status?.pubkey || "").toLowerCase();
  const ownMessage = !!ev.pubkey && String(ev.pubkey).toLowerCase() === ownPubkey;
  const expectedBetter = isBetterClient(ev) || (ownMessage && ownBetterClient());
  if (author && expectedBetter && !author.classList.contains("ba-better-name")) return false;
  if (row.dataset.baRichId && (!rich || rich.dataset.baRich !== row.dataset.baRichId)) return false;
  try {
    const expectedVars = JSON.parse(row.dataset.baLineVars || "{}");
    for (const vars of Object.values(expectedVars)) {
      for (const [key, value] of Object.entries(vars || {})) {
        if (row.style.getPropertyValue(key) !== value) return false;
      }
    }
  } catch {
    return false;
  }
  return true;
}

function repairRowNow(row) {
  if (!(row instanceof HTMLElement)) return false;
  if (state.repairingRows.has(row)) return true;
  if (!row.dataset.baDecorated && !row.dataset.baFlair && !row.querySelector(".fmtRainbow, [data-ba-line-rainbow]")) return false;
  const id = row.id?.startsWith("msg-") ? row.id.slice(4) : "";
  if (!id) return false;
  const ev = eventById(id);
  if (!ev) return false;
  if (rowDecorationIntact(row, ev)) return true;
  state.repairingRows.add(row);
  try {
    ensureRowButtons(row, id);
    markRowClientLabels(row, ev);
    decorateRow(row, ev);
    const ownPubkey = String(state.status?.pubkey || "").toLowerCase();
    row.dataset.baDecorated = `${id}:${state.settingsEpoch}:${ownPubkey}`;
  } finally {
    // Keep the row locked until the observer has drained the mutations this
    // repair just made. Releasing in this microtask would let those records
    // trigger another repair, and another, forever.
    window.setTimeout(() => state.repairingRows.delete(row), 0);
  }
  return true;
}

function decorateRows() {
  const rows = document.querySelectorAll(".ag-msg-row");
  for (const row of rows) {
    if (!(row instanceof HTMLElement)) continue;
    if (row.classList.contains("is-system")) continue;
    const id = row.id?.startsWith("msg-") ? row.id.slice(4) : "";
    if (!id) continue;
    ensureRowButtons(row, id);
    const ev = eventById(id);
    if (!ev) {
      if (!state.pendingLookups.has(id) && state.pageReady) {
        state.pendingLookups.add(id);
        askPage("getEvent", { id }, 5000).then((res) => {
          state.pendingLookups.delete(id);
          if (res?.event) {
            rememberEvent(res.event);
            scheduleEnhance();
          }
        });
      }
      continue;
    }
    const ownPubkey = String(state.status?.pubkey || "").toLowerCase();
    const signature = `${id}:${state.settingsEpoch}:${ownPubkey}`;
    if (row.dataset.baDecorated === signature && rowDecorationIntact(row, ev)) continue;
    markRowClientLabels(row, ev);
    decorateRow(row, ev);
    row.dataset.baDecorated = signature;
  }
}

function ensureRowButtons(row, id) {
  if (row.querySelector(".ba-json-btn, .ba-row-json-btn")) return;
  const actions = row.querySelector(".ag-msg-actions");
  const button = document.createElement("button");
  button.type = "button";
  button.className = actions ? "ag-msg-act-btn ba-json-btn" : "ba-row-json-btn";
  button.setAttribute("data-ba-json", id);
  button.title = "View event JSON";
  button.setAttribute("aria-label", "View event JSON");
  button.textContent = "{ }";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.blur();
    clearStuckHoverMenus(null);
    openViewer(id, "json");
  });
  if (actions) actions.prepend(button);
  else row.appendChild(button);
}

function eventHandle(ev) {
  const name = getTagValue(ev.tags, "n") || `agnon${String(ev.pubkey || "").slice(-4)}`;
  return `@${String(name).toLowerCase()}#${String(ev.pubkey || "").slice(-4).toLowerCase()}`;
}

function isBetterClientName(name) {
  return /^(betteragnostr|better-agnostr|better agnostr)$/i.test(String(name || "").trim());
}

function isBetterClient(ev) {
  return isBetterClientName(getTagValue(ev.tags, "client"));
}

function outgoingToolsReady() {
  const status = state.status;
  if (!status) return true;
  return status.signerHooked === true || status.nip07Patched === true;
}

function ownBetterClient() {
  return (
    state.settings.client.name.trim().toLowerCase() === "betteragnostr" &&
    state.settings.client.policies.chat === "spoof" &&
    outgoingToolsReady()
  );
}

function setBetterName(el, show) {
  if (el instanceof HTMLElement) el.classList.toggle("ba-better-name", !!show);
}

function knownBetterHandle(handle) {
  const value = String(handle || "").trim().toLowerCase();
  if (!value) return false;
  for (const [pubkey, known] of state.betterPeers) {
    if (known.toLowerCase() !== value) continue;
    // A peer who once used Better Agnostr but now sends from another client is
    // not a BA user on that event. Only the latest client tag decides the plaque.
    return isBetterClientName(state.peerClients.get(pubkey)?.name);
  }
  return false;
}

function markRowClientLabels(row, ev) {
  if (!(row instanceof HTMLElement) || !ev) return;
  const author = row.querySelector(".ag-msg-author");
  if (!(author instanceof HTMLElement)) return;
  const ownPubkey = String(state.status?.pubkey || "").toLowerCase();
  const ownMessage = !!ev.pubkey && String(ev.pubkey).toLowerCase() === ownPubkey;
  const better = isBetterClient(ev) || (ownMessage && ownBetterClient());
  setBetterName(author, better);
  // A plaque says BA or nothing. Never append another client's name: that made
  // ordinary users of other clients look like spoofed Better Agnostr accounts.
  author.classList.remove("ba-better-spoof", "ba-client-name");
  delete author.dataset.baClient;
}

function clientPillDisplay(raw) {
  const name = String(raw || "").trim();
  const lower = name.toLowerCase();
  if (!name) return null;
  if (lower === "agnostr") return { text: "Agnostr", cls: "ag-client-pill-agnostr" };
  if (lower === "glub.chat" || lower === "glubchat" || lower.startsWith("glub")) {
    return { text: "Glub.chat", cls: "ag-client-pill-glubchat" };
  }
  if (lower === "nymchat" || lower === "nym" || lower.includes("nymchat")) {
    return { text: "Nymchat", cls: "ag-client-pill-nymchat" };
  }
  if (/^betteragnostr$|^better-agnostr$|^better agnostr$/i.test(name)) {
    return { text: "BetterAgnostr", cls: "ba-client-pill-ba" };
  }
  const safe = name.length > 32 ? `${name.slice(0, 31)}…` : name;
  return { text: safe === lower ? `${safe.charAt(0).toUpperCase()}${safe.slice(1)}` : safe, cls: "ba-client-pill-unknown" };
}

function syncPeerClientPill(modal) {
  const pill = modal.querySelector(".ag-peer-client-pill");
  const clientRow = [...modal.querySelectorAll(".ag-key-row")].find(
    (row) => row.querySelector(".ag-key-label")?.textContent?.trim().toUpperCase() === "CLIENT",
  );
  const fallback = !pill ? clientRow?.querySelector(".ag-key-value") : null;
  if (!(pill instanceof HTMLElement) && !(fallback instanceof HTMLElement)) return;
  const hexRow = [...modal.querySelectorAll(".ag-key-row")].find(
    (row) => row.querySelector(".ag-key-label")?.textContent?.trim().toUpperCase() === "HEX PUBKEY",
  );
  const pubkey = String(hexRow?.querySelector(".ag-key-value")?.textContent || "").trim().toLowerCase();
  if (!pubkey) return;
  const ownPubkey = String(state.status?.pubkey || "").toLowerCase();
  let client = state.peerClients.get(pubkey);
  if (
    !client &&
    pubkey === ownPubkey &&
    outgoingToolsReady() &&
    state.settings.client.policies.chat === "spoof" &&
    state.settings.client.name
  ) {
    client = { name: state.settings.client.name, at: Date.now() };
  }
  if (!client) return;
  const display = clientPillDisplay(client.name);
  if (!display) return;
  const target = pill instanceof HTMLElement ? pill : fallback;
  if (!(target instanceof HTMLElement)) return;
  if (pill instanceof HTMLElement) {
    pill.textContent = display.text;
    pill.title = display.text;
    pill.setAttribute("aria-label", `Client: ${display.text}`);
    for (const cls of [...pill.classList]) {
      if (cls.startsWith("ag-client-pill-") || cls.startsWith("ba-client-pill-")) pill.classList.remove(cls);
    }
    pill.classList.add(display.cls);
    pill.dataset.baClientPill = "1";
  } else if (target.children.length === 0) {
    target.textContent = display.text;
    target.title = display.text;
    target.dataset.baClientPill = "1";
  }
}

function markBetterClients() {
  if (!state.enabledReady || state.settings.enabled === false) return;
  const now = Date.now();
  const elapsed = now - (state.lastBetterClients || 0);
  if (elapsed < 500) {
    if (state.betterClientsTimer === null) {
      state.betterClientsTimer = window.setTimeout(() => {
        state.betterClientsTimer = null;
        markBetterClients();
      }, 500 - elapsed + 20);
    }
    return;
  }
  state.lastBetterClients = now;
  const ownPubkey = String(state.status?.pubkey || "").toLowerCase();
  const ownBetter = ownBetterClient();
  for (const row of document.querySelectorAll(".ag-users-row")) {
    const handle = row.querySelector(".ag-users-name")?.textContent?.trim().toLowerCase() || "";
    const own = !!ownPubkey && handle.endsWith(`#${ownPubkey.slice(-4)}`);
    const better = knownBetterHandle(handle) || (own && ownBetter);
    const nameEl = row.querySelector(".ag-users-name");
    setBetterName(nameEl, better);
    if (nameEl instanceof HTMLElement) {
      nameEl.classList.remove("ba-better-spoof", "ba-client-name");
      delete nameEl.dataset.baClient;
    }
  }
  for (const pop of document.querySelectorAll(".ag-quick-profile-popover")) {
    setBetterName(pop.querySelector(".ag-qp-display-name"), ownBetter);
  }
  for (const modal of document.querySelectorAll(".ag-peer-modal")) {
    const badges = modal.querySelector(".ag-peer-modal-badges");
    const isSelf = [...(badges?.querySelectorAll(".ag-badge") || [])].some(
      (badge) => badge.textContent?.trim().toLowerCase() === "you",
    );
    const nameEl = modal.querySelector(".ag-peer-modal-name");
    const label = (nameEl?.textContent || "").replace(/\s+/g, "").toLowerCase();
    const better = (isSelf && ownBetter) || knownBetterHandle(label);
    setBetterName(nameEl, better);
    if (nameEl instanceof HTMLElement) {
      nameEl.classList.remove("ba-better-spoof", "ba-client-name");
      delete nameEl.dataset.baClient;
    }
    syncPeerClientPill(modal);
  }
  for (const title of document.querySelectorAll(".ag-sheet-hero-title")) {
    const label = (title.textContent || "").replace(/\s+/g, "").toLowerCase();
    const better = knownBetterHandle(label) || (!!ownPubkey && label.includes(ownPubkey.slice(-4)) && ownBetter);
    setBetterName(title, better);
  }
}

function hideSelfTeleportBadges() {
  for (const modal of document.querySelectorAll(".ag-peer-modal")) {
    const badges = modal.querySelector(".ag-peer-modal-badges");
    if (!badges) continue;
    const isSelf = [...badges.querySelectorAll(".ag-badge")].some(
      (badge) => badge.textContent?.trim().toLowerCase() === "you",
    );
    for (const badge of badges.querySelectorAll(".ag-badge")) {
      if (badge.textContent?.trim().toLowerCase() !== "teleport") continue;
      if (isSelf && state.settings.privacy.omitTeleport) {
        badge.dataset.baTeleportHidden = "1";
        badge.style.display = "none";
      } else if (badge.dataset.baTeleportHidden === "1") {
        badge.style.removeProperty("display");
        delete badge.dataset.baTeleportHidden;
      }
    }
  }
}

function clearStuckHoverMenus(hoveredRow = null) {
  if (document.querySelector(".ag-ctx-menu, .ag-rpicker, .ag-emoji-popover")) return;
  for (const row of document.querySelectorAll(".ag-msg-row.actions-open")) {
    if (row !== hoveredRow) row.classList.remove("actions-open");
  }
  for (const actions of document.querySelectorAll(".ag-msg-actions.picker-open")) {
    if (!hoveredRow || !hoveredRow.contains(actions)) actions.classList.remove("picker-open");
  }
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active.closest(".ag-msg-actions, .ba-row-json-btn") &&
    (!hoveredRow || !hoveredRow.contains(active))
  ) {
    active.blur();
  }
}

function decorateRow(row, ev) {
  const meta = parseGlubMeta(ev.tags);
  const hasGlub = !!(meta.rich || meta.fmt || meta.flair || meta.v) || getTagValue(ev.tags, "client")?.toLowerCase() === "glub.chat";
  const ownPubkey = String(state.status?.pubkey || "").toLowerCase();
  const ownMessage = !!ev.pubkey && String(ev.pubkey).toLowerCase() === ownPubkey;
  const better = isBetterClient(ev) || (ownMessage && ownBetterClient());
  if (better && ev.pubkey) state.betterPeers.set(ev.pubkey.toLowerCase(), eventHandle(ev));

  if (hasGlub && state.settings.studio.renderInAgnostr && meta.flair && isValidFlair(meta.flair)) {
    applyFlair(row, ev, meta.flair);
  } else {
    clearFlair(row);
  }

  if (hasGlub && state.settings.studio.renderRichInAgnostr && meta.rich) {
    applyRichText(row, ev, meta);
  } else {
    restoreRich(row);
  }
  applyLineStyles(row, hasGlub ? meta : {});
}

function formatStateAt(template, placeholder) {
  const tpl = normalizeTemplate(template || "");
  if (!tpl) return null;
  let st = {
    color: null,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    obf: false,
    rainbow: false,
  };
  for (const tok of tokenize(tpl)) {
    if (tok.t === "code") {
      st = nextFormatState(st, tok.c);
      continue;
    }
    if (tok.v.includes(placeholder)) return st;
  }
  return null;
}

function lineVisual(st) {
  if (!st) return null;
  const out = {};
  if (st.color) out.color = st.color;
  if (st.bold) out.bold = true;
  if (st.italic) out.italic = true;
  if (st.underline) out.underline = true;
  if (st.strike) out.strike = true;
  if (st.rainbow) out.rainbow = true;
  if (st.obf) out.obf = true;
  return Object.keys(out).length ? out : null;
}

function protectRainbowEmojis(el, enabled) {
  if (!(el instanceof HTMLElement)) return;
  if (!enabled) {
    const protectedSpans = el.querySelectorAll(".fmtEmoji[data-ba-emoji-protect='1']");
    if (!protectedSpans.length) return;
    for (const span of protectedSpans) span.replaceWith(document.createTextNode(span.textContent || ""));
    el.normalize();
    return;
  }
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const value = node.nodeValue || "";
      if (!value || node.parentElement?.closest(".fmtEmoji, pre, code, textarea, input, script, style")) return NodeFilter.FILTER_REJECT;
      EMOJI_DOM_RE.lastIndex = 0;
      return EMOJI_DOM_RE.test(value) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue || "";
    const fragment = document.createDocumentFragment();
    let last = 0;
    EMOJI_DOM_RE.lastIndex = 0;
    for (const match of text.matchAll(EMOJI_DOM_RE)) {
      const index = match.index ?? 0;
      if (index > last) fragment.append(text.slice(last, index));
      const span = document.createElement("span");
      span.className = "fmtEmoji";
      span.dataset.baEmojiProtect = "1";
      span.textContent = match[0];
      fragment.append(span);
      last = index + match[0].length;
    }
    if (last < text.length) fragment.append(text.slice(last));
    node.replaceWith(fragment);
  }
}

function applyLineClasses(el, prefix, vis, row) {
  if (!el) return;
  protectRainbowEmojis(el, !!vis?.rainbow);
  const classes = [
    `${prefix}`,
    `${prefix}-color`,
    `${prefix}-bold`,
    `${prefix}-italic`,
    `${prefix}-deco`,
  ];
  for (const cls of classes) el.classList.toggle(cls, !!vis && (cls === prefix || (cls === `${prefix}-color` ? !!vis.color : cls === `${prefix}-bold` ? !!vis.bold : cls === `${prefix}-italic` ? !!vis.italic : !!(vis.underline || vis.strike))));
  if (vis?.rainbow) {
    el.dataset.baLineRainbow = "1";
    el.classList.add("fmtRainbow");
  } else if (el.dataset.baLineRainbow) {
    el.classList.remove("fmtRainbow");
    delete el.dataset.baLineRainbow;
  }
  if (vis?.obf) {
    if (!el.classList.contains("fmtObf")) {
      el.classList.add("fmtObf");
      delete el.dataset.obfText;
      delete el.dataset.obfStatic;
      obfBursts.delete(el);
    }
  } else if (el.classList.contains("fmtObf")) {
    const real = el.dataset.obfText;
    if (real != null) el.textContent = real;
    el.classList.remove("fmtObf");
    delete el.dataset.obfText;
    delete el.dataset.obfStatic;
    obfBursts.delete(el);
  }
  // Remember the exact class set this element should have. React can replace
  // className without touching data-* attributes; this lets the fast repair path
  // notice a stripped line style without recomputing the whole row.
  const activeLineClasses = [];
  for (const cls of classes) {
    if (el.classList.contains(cls)) activeLineClasses.push(cls);
  }
  if (vis?.rainbow) activeLineClasses.push("fmtRainbow");
  if (vis?.obf) activeLineClasses.push("fmtObf");
  if (activeLineClasses.length) el.dataset.baLineClasses = activeLineClasses.join(" ");
  else delete el.dataset.baLineClasses;
  const ns = prefix === "ba-line-name" ? "name" : "msg";
  const vars = {};
  if (vis?.color) {
    row.style.setProperty(`--ba-line-${ns}-color`, vis.color);
    vars[`--ba-line-${ns}-color`] = vis.color;
  } else {
    row.style.removeProperty(`--ba-line-${ns}-color`);
  }
  if (vis?.underline || vis?.strike) {
    const deco = [vis.underline ? "underline" : "", vis.strike ? "line-through" : ""].filter(Boolean).join(" ");
    row.style.setProperty(`--ba-line-${ns}-deco`, deco);
    vars[`--ba-line-${ns}-deco`] = deco;
  } else {
    row.style.removeProperty(`--ba-line-${ns}-deco`);
  }
  try {
    const all = JSON.parse(row.dataset.baLineVars || "{}");
    if (Object.keys(vars).length) all[ns] = vars;
    else delete all[ns];
    if (Object.keys(all).length) row.dataset.baLineVars = JSON.stringify(all);
    else delete row.dataset.baLineVars;
  } catch {
    delete row.dataset.baLineVars;
  }
}

function applyLineStyles(row, meta) {
  const enabled = state.settings.studio.renderRichInAgnostr !== false;
  const fmt = enabled ? meta.fmt : "";
  const nameVis = fmt ? lineVisual(formatStateAt(fmt, "{name}")) : null;
  const msgVis = fmt ? lineVisual(formatStateAt(fmt, "{msg}")) : null;
  const author = row.querySelector(".ag-msg-author");
  const root = row.querySelector(".ag-msg-rich");
  applyLineClasses(author, "ba-line-name", nameVis, row);
  applyLineClasses(root, "ba-line-msg", msgVis, row);
}

function clearFlair(row) {
  row.classList.remove("flair", "ba-flair", "flairQuiet", "ba-flair-static");
  for (const cls of [...row.classList]) {
    if (cls.startsWith("ba-flair-") || cls.startsWith("flair-")) row.classList.remove(cls);
  }
  row.querySelectorAll(":scope > .ba-flair-layer, :scope > .flairFx, :scope > .flairScan, :scope > .ba-flair-fx").forEach((n) => n.remove());
  row.removeAttribute("data-ba-flair");
  row.removeAttribute("data-flair");
  delete row.dataset.baFlairVars;
}

function flairStyleVars(vars) {
  return Object.entries(vars || {})
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

function applyFlair(row, ev, flair) {
  flair = flairName(flair);
  if (!flair) {
    clearFlair(row);
    return;
  }
  const classes = flairClass(flair).split(" ").filter(Boolean);
  const limit = flairLimit(flair);
  if (limit > 0 && !row.classList.contains(`flair-${flair}`)) {
    const active = document.querySelectorAll(`.ag-msg-row.flair-${flair}`).length;
    if (active >= limit) {
      clearFlair(row);
      row.dataset.baFlairSuppressed = flair;
      return;
    }
    delete row.dataset.baFlairSuppressed;
  }
  const layer = row.querySelector(":scope > .ba-flair-layer");
  const hasFx = !flairHasFx(flair) || !!layer?.querySelector(":scope > .flairFx");
  const hasScan = !flairOverlayInner(flair) || !!layer?.querySelector(":scope > .flairScan");
  const hasClasses = classes.every((cls) => row.classList.contains(cls));
  const quiet = !!state.settings.studio.reduceMotion;
  let hasVars = false;
  try {
    const saved = JSON.parse(row.dataset.baFlairVars || "{}");
    const entries = Object.entries(saved);
    hasVars = entries.length === 0
      ? row.dataset.baFlairVars === "{}"
      : entries.every(([k, v]) => row.style.getPropertyValue(k) === String(v));
  } catch {}
  if (row.dataset.baFlair === flair && hasClasses && layer && hasFx && hasScan && hasVars) {
    row.classList.toggle("flairQuiet", quiet);
    layer.classList.toggle("flairQuiet", quiet);
    return;
  }
  clearFlair(row);
  const vars = flairVars(flair);
  row.dataset.baFlairVars = JSON.stringify(vars);
  for (const cls of classes) row.classList.add(cls);
  row.dataset.baFlair = flair;
  for (const [k, v] of Object.entries(vars)) row.style.setProperty(k, v);
  if (quiet) row.classList.add("flairQuiet");

  const wrap = document.createElement("span");
  wrap.className = "ba-flair-layer";
  wrap.setAttribute("aria-hidden", "true");
  for (const cls of classes) wrap.classList.add(cls);
  if (quiet) wrap.classList.add("flairQuiet");
  if (flairHasFx(flair)) {
    const fx = document.createElement("span");
    fx.className = "flairFx";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML = flairFxInner(flair);
    wrap.appendChild(fx);
  }
  const overlay = flairOverlayInner(flair);
  if (overlay) wrap.insertAdjacentHTML("beforeend", overlay);
  row.prepend(wrap);
}

function cleanupRichObservers() {
  for (const root of state.richRoots) {
    if (root.isConnected) continue;
    const observer = state.richObservers.get(root);
    observer?.disconnect();
    state.richObservers.delete(root);
    state.richRoots.delete(root);
  }
}

function ensureRichObserver(root) {
  if (state.richObservers.has(root) || typeof MutationObserver !== "function") return;
  const observer = new MutationObserver((records) => {
    if (state.richRepairing.has(root)) return;
    // Obfuscation rewrites text nodes every 100 ms. Those mutations must not
    // re-render the rich subtree or the two systems fight forever.
    const obfuscationOnly = records.length > 0 && records.every((record) => {
      const node = record.target;
      const element = node instanceof Element ? node : node?.parentElement;
      return !!element?.closest?.(".fmtObf");
    });
    if (obfuscationOnly) return;
    const row = root.closest(".ag-msg-row");
    if (!(row instanceof HTMLElement)) return;
    const id = row.id?.startsWith("msg-") ? row.id.slice(4) : "";
    if (!id) return;
    const ev = eventById(id);
    if (!ev) return;
    const meta = parseGlubMeta(ev.tags);
    if (!meta.rich) return;
    state.richRepairing.add(root);
    try {
      applyRichText(row, ev, meta);
    } finally {
      // Let the observer drain the records this repair produced before allowing
      // another pass. Releasing immediately would loop on our own innerHTML write.
      window.setTimeout(() => state.richRepairing.delete(root), 0);
    }
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  state.richObservers.set(root, observer);
  state.richRoots.add(root);
}

function applyRichText(row, ev, meta) {
  const root = row.querySelector(".ag-msg-rich");
  if (!root) return;
  const previous = state.richApplied.get(root);
  if (previous && previous.id === ev.id && previous.html === root.innerHTML) return;
  const rich = meta.rich;
  if (!rich || typeof rich !== "string") return;
  if (rich.length > RICH_MAX) return;
  if (stripFormat(rich) !== ev.content) return;
  if (!hasFormat(rich)) return;

  if (!state.restoreMap.has(root)) state.restoreMap.set(root, root.innerHTML);

  // Most chat messages are plain text, so the safest and most faithful render
  // is to build the formatted text ourselves. We only do this when the row has
  // no interactive/embedded children that React owns.
  const complex = root.querySelector("pre, code, img, audio, video, input, textarea, button, canvas, svg, .ag-codeblock, .ag-voice-player, .ag-img-card");
  const normalizedText = (root.textContent || "").replace(/\s+/g, " ").trim();
  const normalizedContent = String(ev.content || "").replace(/\s+/g, " ").trim();
  if (!complex && normalizedText === normalizedContent) {
    root.innerHTML = renderFormatHtml(rich);
    root.dataset.baRich = ev.id;
    row.dataset.baRichId = ev.id;
    state.richApplied.set(root, { id: ev.id, html: root.innerHTML, content: ev.content });
    ensureRichObserver(root);
    return;
  }

  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("pre, code, textarea, input, script, style")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);

  let st = {
    color: null,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    obf: false,
    rainbow: false,
  };
  let changed = false;
  for (const node of nodes) {
    const text = node.nodeValue || "";
    if (!text || !text.includes("&")) continue;
    const tokens = tokenize(text);
    if (!tokens.some((t) => t.t === "code")) continue;
    const frag = document.createDocumentFragment();
    for (const tok of tokens) {
      if (tok.t === "code") {
        st = nextFormatState(st, tok.c);
        continue;
      }
      if (st.color || st.bold || st.italic || st.underline || st.strike || st.obf || st.rainbow) {
        const span = document.createElement("span");
        const style = stateStyle(st);
        if (style) span.style.cssText = style;
        const cls = stateClass(st);
        if (cls) span.className = cls;
        if (st.obf) span.dataset.obfText = tok.v;
        span.textContent = tok.v;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(tok.v));
      }
    }
    node.replaceWith(frag);
    changed = true;
  }
  if (changed) {
    root.dataset.baRich = ev.id;
    row.dataset.baRichId = ev.id;
    state.richApplied.set(root, { id: ev.id, html: root.innerHTML, content: ev.content });
    ensureRichObserver(root);
  }
}

function nextFormatState(st, code) {
  const next = { ...st };
  if (code === "r") {
    return { color: null, bold: false, italic: false, underline: false, strike: false, obf: false, rainbow: false };
  }
  if (Object.prototype.hasOwnProperty.call(COLORS, code)) {
    return { color: COLORS[code], bold: false, italic: false, underline: false, strike: false, obf: false, rainbow: false };
  }
  if (code === "l") next.bold = true;
  else if (code === "o") next.italic = true;
  else if (code === "n") next.underline = true;
  else if (code === "m") next.strike = true;
  else if (code === "k") next.obf = true;
  else if (code === "g") {
    next.rainbow = true;
    next.color = null;
  }
  return next;
}

function restoreRich(row) {
  const root = row.querySelector(".ag-msg-rich");
  if (!root) return;
  const applied = state.richApplied.get(root);
  state.richApplied.delete(root);
  delete row.dataset.baRichId;
  const observer = state.richObservers.get(root);
  if (observer) {
    observer.disconnect();
    state.richObservers.delete(root);
    state.richRoots.delete(root);
  }
  if (!root.dataset.baRich) return;
  const current = (root.textContent || "").replace(/\s+/g, " ").trim();
  const expected = String(applied?.content || "").replace(/\s+/g, " ").trim();
  if (applied && expected && current !== expected) {
    // React replaced or updated the message while rich text was applied. Do not
    // overwrite its newer content with a stale snapshot.
    delete root.dataset.baRich;
    state.restoreMap.delete(root);
    return;
  }
  const original = state.restoreMap.get(root);
  if (original != null) root.innerHTML = original;
  delete root.dataset.baRich;
  state.restoreMap.delete(root);
}

// ---------------------------------------------------------------------------
// Viewer modal
// ---------------------------------------------------------------------------

async function openViewer(id, tab = "json") {
  if (!id) return;
  const request = ++state.viewerRequestSeq;
  let ev = eventById(id);
  if (!ev && state.pageReady) {
    const res = await askPage("getEvent", { id });
    if (request !== state.viewerRequestSeq) return;
    if (res?.event) {
      ev = res.event;
      rememberEvent(ev);
    }
  }
  if (request !== state.viewerRequestSeq) return;
  if (!ev) {
    toast("warning", "Event not captured", "Open or reload the channel so the extension can observe relay traffic.");
    return;
  }
  state.viewer = { id, event: ev, tab, verified: state.verified.get(ev.id) || null, entities: state.entities.get(ev.id) || null };
  if (!state.entities.has(ev.id)) {
    askPage("entities", { id: ev.id, pubkey: ev.pubkey, kind: ev.kind }).then((res) => {
      if (res && state.viewer?.event?.id === ev.id) {
        state.entities.set(ev.id, res);
        state.viewer.entities = res;
        renderViewer();
      }
    });
  }
  renderViewer();
  setModalOpen("viewer", true);
}

function closeViewer() {
  state.viewerRequestSeq += 1;
  setModalOpen("viewer", false);
  state.viewer = null;
  const container = state.shadow?.querySelector("[data-role='viewer-content']");
  if (container) container.innerHTML = "";
  clearStuckHoverMenus(null);
}

function renderViewer() {
  if (!state.viewer) return;
  const container = state.shadow?.querySelector("[data-role='viewer-content']");
  if (!container) return;
  const { event, tab } = state.viewer;
  const meta = parseGlubMeta(event.tags);
  const build = effectiveBuild(state.settings);
  const stale = !!(meta.v && build && meta.v !== build);
  const reconstructed = event._reconstructed;
  const verified = state.verified.get(event.id);
  const entities = state.entities.get(event.id) || {};

  const tabs = [
    ["json", "JSON"],
    ["tags", "Tags"],
    ...(meta.rich || meta.fmt || meta.flair ? [["glub", "Glub"]] : []),
    ["verify", "Verify"],
    ["relay", "Relay"],
  ];

  const tabButtons = tabs
    .map(
      ([id, label]) =>
        `<button type="button" class="ba-modal-tab${id === tab ? " is-active" : ""}" data-viewer-tab="${id}" role="tab" aria-selected="${id === tab ? "true" : "false"}">${label}</button>`,
    )
    .join("");

  let body = "";
  if (tab === "json") {
    body = `${reconstructed ? `<div class="ba-warning">This event was reconstructed from Agnostr's local message store; it has no signature.</div>` : ""}
      <pre class="ba-json">${highlightJson(JSON.stringify(event, null, 2))}</pre>`;
  } else if (tab === "tags") {
    const rows = (event.tags || [])
      .map(
        (t, i) =>
          `<tr><td>${i}</td><td>${h(t?.[0] ?? "")}</td><td>${h(t?.[1] ?? "")}</td><td>${h(t?.[2] ?? "")}</td><td>${h(t?.[3] ?? "")}</td></tr>`,
      )
      .join("");
    body = `<table class="ba-tags"><thead><tr><th>#</th><th>Name</th><th>Value</th><th>Relay</th><th>Marker</th></tr></thead><tbody>${
      rows || `<tr><td colspan="5" class="ba-empty">No tags.</td></tr>`
    }</tbody></table>`;
  } else if (tab === "glub") {
    body = `${stale ? `<div class="ba-warning">Build mismatch: this event says <code class="ba-code">${h(meta.v)}</code> but glub.chat currently serves <code class="ba-code">${h(build)}</code>. glub will drop it.</div>` : meta.v ? `<div class="ba-warning ok">Build ${h(meta.v)} matches the live glub.chat build.</div>` : ""}
      ${renderLinePreview(event, meta)}`;
  } else if (tab === "verify") {
    body = `
      <div class="ba-meta-grid">
        <div class="ba-meta-cell"><div class="ba-meta-k">status</div><div class="ba-meta-v">${verified ? (verified.ok ? "valid signature" : "invalid") : "not checked"}</div></div>
        <div class="ba-meta-cell"><div class="ba-meta-k">event id</div><div class="ba-meta-v">${h(event.id || "")}</div></div>
        <div class="ba-meta-cell"><div class="ba-meta-k">pubkey</div><div class="ba-meta-v">${h(event.pubkey || "")}</div></div>
        <div class="ba-meta-cell"><div class="ba-meta-k">created</div><div class="ba-meta-v">${h(dateLabel(event.created_at))}</div></div>
      </div>
      ${verified ? `<div class="ba-warning ${verified.ok ? "ok" : "err"}">${h(verified.ok ? "Signature and id verify against the event fields." : verified.error || "Verification failed.")}</div>` : `<div class="ba-hint">Click verify signature to check the event with the page's own nostr-tools build.</div>`}
      <button type="button" class="ba-btn" data-action="verify-event">verify signature</button>`;
  } else {
    const eventIds = new Set([event.id]);
    const alias = state.aliases.get(event.id);
    if (alias) eventIds.add(alias);
    for (const [from, to] of state.aliases) if (to === event.id) eventIds.add(from);
    const rows = state.logs
      .filter((log) => eventIds.has(log.eventId))
      .slice(-30)
      .reverse()
      .map(
        (log) =>
          `<div class="ba-kv"><span>${h(log.dir)} · ${h(hostOf(log.relay))}</span><span>${h(log.type)} · ${h(timeLabel(log.ts))}</span></div>`,
      )
      .join("");
    body = rows ? `<div class="ba-scrollbox">${rows}</div>` : `<div class="ba-empty">No relay frames for this event in the current session.</div>`;
  }

  container.innerHTML = `
    <div class="ba-modal-head">
      <div>
        <div class="ba-modal-title">Event</div>
        <div class="ba-modal-sub">${h(kindLabel(event.kind))} · ${h(short(event.id || "", 20))} · ${h(dateLabel(event.created_at))}</div>
      </div>
      <div class="ba-modal-space"></div>
      <button type="button" class="ba-icon-btn" data-close-modal="viewer" aria-label="Close">✕</button>
    </div>
    <div class="ba-modal-tabs" role="tablist" aria-label="Event details sections">${tabButtons}</div>
    <div class="ba-modal-body">
      <div class="ba-meta-grid">
        <div class="ba-meta-cell"><div class="ba-meta-k">kind</div><div class="ba-meta-v">${h(event.kind)} · ${h(kindLabel(event.kind))}</div></div>
        <div class="ba-meta-cell"><div class="ba-meta-k">id</div><div class="ba-meta-v">${h(short(event.id || "", 26))}</div></div>
        <div class="ba-meta-cell"><div class="ba-meta-k">pubkey</div><div class="ba-meta-v">${h(short(event.pubkey || "", 26))}</div></div>
        <div class="ba-meta-cell"><div class="ba-meta-k">created</div><div class="ba-meta-v">${h(timeLabel(event.created_at))}</div></div>
        <div class="ba-meta-cell"><div class="ba-meta-k">content</div><div class="ba-meta-v">${h(String(event.content || "").slice(0, 80))}</div></div>
      </div>
      ${body}
    </div>
    <div class="ba-modal-actions">
      <button type="button" class="ba-btn" data-action="copy-json">Copy JSON</button>
      <button type="button" class="ba-btn" data-action="download-json">Download</button>
      <button type="button" class="ba-btn" data-action="copy-id">Copy ID</button>
      <button type="button" class="ba-btn" data-action="copy-pubkey">Copy pubkey</button>
      <button type="button" class="ba-btn" data-action="copy-npub">Copy npub</button>
      <button type="button" class="ba-btn" data-action="open-njump">Open in njump</button>
      <span class="ba-space"></span>
      ${entities.npub ? `<span class="ba-hint">${h(short(entities.npub, 24))}</span>` : ""}
    </div>`;
}

function eventAvatarSrc(event) {
  const row = document.getElementById(`msg-${event.id}`);
  const img = row?.querySelector(".ag-msg-avatar-btn img, .ag-stream-avatar, .ag-profile-avatar");
  const src = img?.getAttribute("src");
  if (src) return src;
  return previewAvatarSrc();
}

function renderLinePreview(event, meta) {
  const name = getTagValue(event.tags, "n") || `agnon${String(event.pubkey || "").slice(-4)}`;
  const tag = String(event.pubkey || "").slice(-4);
  const rich = meta.rich || "";
  const msgHtml = rich && stripFormat(rich) === event.content ? renderFormatHtml(rich) : h(event.content || "");
  let line;
  try {
    line = meta.fmt ? renderLineHtml(meta.fmt, { name, tag, msgHtml, msgText: event.content || "" }) : msgHtml;
  } catch {
    line = msgHtml;
  }
  const flair = meta.flair && isValidFlair(meta.flair) ? meta.flair : "";
  return previewBlockHtml({
    name,
    tag,
    avatar: eventAvatarSrc(event),
    line,
    flair,
    reduceMotion: state.settings.studio.reduceMotion,
  });
}

function highlightJson(text) {
  const escaped = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  return escaped.replace(re, (match, str, colon, bool, nul, num) => {
    if (str) return `<span class="${colon ? "j-key" : "j-str"}">${str}</span>${colon || ""}`;
    if (bool) return `<span class="j-bool">${bool}</span>`;
    if (nul) return `<span class="j-null">${nul}</span>`;
    if (num) return `<span class="j-num">${num}</span>`;
    return match;
  });
}

// ---------------------------------------------------------------------------
// Review modal
// ---------------------------------------------------------------------------

function queueReview(payload, requestId) {
  if (!state.shadow?.querySelector("[data-role='review-content']")) {
    sendPage("response", { action: "cancel" }, requestId);
    toast("warning", "Review unavailable", "The outgoing event was cancelled because the review UI is not ready.");
    return;
  }
  if (state.reviewQueue.length >= 8) {
    sendPage("response", { action: "cancel" }, requestId);
    toast("warning", "Review queue full", "The outgoing event was cancelled; finish the open reviews and try again.");
    return;
  }
  state.reviewQueue.push({ payload, requestId });
  if (!state.review) openNextReview();
}

function reviewCountdown() {
  if (!state.review) return "review expired";
  const seconds = Math.max(0, Math.ceil((state.review.deadline - Date.now()) / 1000));
  return `${seconds}s left`;
}

function openNextReview() {
  const next = state.reviewQueue.shift();
  if (!next) return;
  state.review = { ...next, selected: new Set(), timer: null, ticker: null, deadline: Date.now() + 174000 };
  renderReview();
  setModalOpen("review", true);
  state.review.timer = window.setTimeout(() => finishReview("cancel"), 174000);
  state.review.ticker = window.setInterval(() => {
    const el = state.shadow?.querySelector("[data-role='review-timer']");
    if (el) el.textContent = reviewCountdown();
  }, 1000);
}

function finishReview(action, scrub = false) {
  if (!state.review) return;
  const review = state.review;
  window.clearTimeout(review.timer);
  if (review.ticker) window.clearInterval(review.ticker);
  const payload =
    action === "send"
      ? { action: "send", stripTagIndexes: scrub ? [...review.selected] : [] }
      : { action: "cancel" };
  sendPage("response", payload, review.requestId);
  state.review = null;
  setModalOpen("review", false);
  const container = state.shadow?.querySelector("[data-role='review-content']");
  if (container) container.innerHTML = "";
  if (state.reviewQueue.length) openNextReview();
}

function renderReview() {
  if (!state.review) return;
  const container = state.shadow?.querySelector("[data-role='review-content']");
  if (!container) return;
  const { payload } = state.review;
  const proposed = payload.proposed || {};
  const meta = parseGlubMeta(proposed.tags || []);
  const important = new Set(["g", "d", "e", "p", "k", "h", "a", "q"]);
  const tags = (proposed.tags || []).map((tag, index) => {
    const name = tag?.[0] || "";
    const value = tag?.slice(1).join(" ") || "";
    const disabled = important.has(name) || name === "glub";
    return `<label class="ba-review-tag">
      <input type="checkbox" data-review-tag="${index}" ${disabled ? "disabled" : ""}>
      <span class="ba-review-name">${h(name)}</span>
      <span class="ba-review-val">${h(value)}</span>
    </label>`;
  }).join("");

  container.innerHTML = `
    <div class="ba-modal-head">
      <div>
        <div class="ba-modal-title">review outgoing ${h(kindLabel(proposed.kind))}</div>
        <div class="ba-modal-sub">${h(payload.group || kindGroup(proposed.kind))} · check a tag to remove it before signing · <span data-role="review-timer">${h(reviewCountdown())}</span></div>
      </div>
      <div class="ba-modal-space"></div>
      <button type="button" class="ba-icon-btn" data-action="review-cancel" aria-label="Cancel">✕</button>
    </div>
    <div class="ba-modal-body">
      <div class="ba-warning">This event is paused before signing. Nothing has left your client yet.</div>
      <div class="ba-meta-grid">
        <div class="ba-meta-cell"><div class="ba-meta-k">kind</div><div class="ba-meta-v">${h(proposed.kind)} · ${h(kindLabel(proposed.kind))}</div></div>
        <div class="ba-meta-cell"><div class="ba-meta-k">content</div><div class="ba-meta-v"><pre class="ba-review-content">${h(String(proposed.content || ""))}</pre></div></div>
        ${String(payload.original?.content || "") !== String(proposed.content || "") ? `<div class="ba-meta-cell"><div class="ba-meta-k">original</div><div class="ba-meta-v"><pre class="ba-review-content">${h(String(payload.original?.content || ""))}</pre></div></div>` : ""}
        <div class="ba-meta-cell"><div class="ba-meta-k">source</div><div class="ba-meta-v">${h(payload.source || "provider")}</div></div>
      </div>
      <div class="ba-card-head" style="margin-top:4px"><span class="ba-card-title">Tags</span><span class="ba-head-space"></span><span class="ba-hint">hover to read</span></div>
      <div class="ba-scrollbox">${tags || `<div class="ba-empty">No tags.</div>`}</div>
      ${meta.rich || meta.fmt || meta.flair ? `<div style="margin-top:10px">${renderLinePreview(proposed, meta)}</div>` : ""}
    </div>
    <div class="ba-modal-actions">
      <button type="button" class="ba-btn primary" data-action="review-send">send as proposed</button>
      <button type="button" class="ba-btn" data-action="review-scrub">send with checked removals</button>
      <span class="ba-space"></span>
      <button type="button" class="ba-btn danger" data-action="review-cancel">cancel</button>
    </div>`;
}

// Review tag checkboxes are handled by the shadow-root change listener above.

// ---------------------------------------------------------------------------
// Composer toolbar wiring (delegated)
// ---------------------------------------------------------------------------

document.addEventListener(
  "click",
  (event) => {
    if (!state.enabledReady || state.settings.enabled === false) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const bar = target.closest(".ba-composer-bar");
    if (!bar) return;
    const colorToggle = target.closest("[data-action='toggle-colors']");
    if (colorToggle) {
      event.preventDefault();
      event.stopPropagation();
      const pop = bar.querySelector(".ba-color-popover");
      if (pop) {
        pop.hidden = !pop.hidden;
        colorToggle.setAttribute("aria-expanded", pop.hidden ? "false" : "true");
      }
      return;
    }
    const codeBtn = target.closest("[data-code]");
    if (codeBtn) {
      event.preventDefault();
      event.stopPropagation();
      insertInto(composerTextarea(bar), codeBtn.getAttribute("data-code") || "");
      return;
    }
    const color = target.closest("[data-color]");
    if (color) {
      event.preventDefault();
      event.stopPropagation();
      insertInto(composerTextarea(bar), `&${color.getAttribute("data-color")}`);
      return;
    }
    const action = target.closest("[data-action]")?.getAttribute("data-action");
    if (action === "open-studio") {
      event.preventDefault();
      event.stopPropagation();
      openPanel("studio");
    } else if (action === "open-last") {
      event.preventDefault();
      event.stopPropagation();
      handleAction("inspect-last");
    }
  },
  true,
);

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!state.enabledReady || state.settings.enabled === false) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".ba-composer-bar")) event.preventDefault();
    const bar = target.closest(".ba-composer-bar");
    if (!bar) {
      for (const pop of document.querySelectorAll(".ba-composer-bar .ba-color-popover:not([hidden])")) pop.hidden = true;
    }
  },
  true,
);

// ---------------------------------------------------------------------------
// Message actions: hug, slap, custom
// ---------------------------------------------------------------------------

function authorMention(row, event) {
  let text = row?.querySelector(".ag-msg-author")?.textContent?.trim() || "";
  if (/^@[^#\s]+#?[0-9a-f]{0,4}$/i.test(text)) return text.startsWith("@") ? text : `@${text}`;
  const name =
    getTagValue(event?.tags, "n") ||
    text.replace(/^@/, "").replace(/#[0-9a-f]{4}$/i, "").trim();
  const tag = event?.pubkey ? String(event.pubkey).slice(-4) : "";
  if (name) return `@${name}${tag ? `#${tag}` : ""}`;
  return text || "@friend";
}

function captureContextTarget(event) {
  if (!state.enabledReady || state.settings.enabled === false) return;
  const target = event.target;
  if (!(target instanceof Element)) {
    state.contextTarget = null;
    return;
  }
  const row = target.closest(".ag-msg-row");
  if (!(row instanceof HTMLElement) || !row.id?.startsWith("msg-")) {
    state.contextTarget = null;
    return;
  }
  const id = row.id.slice(4);
  const ev = eventById(id);
  state.contextTarget = { id, event: ev, mention: authorMention(row, ev), row };
}

function fitContextMenu(menu) {
  if (!(menu instanceof HTMLElement)) return;
  menu.style.overflowY = "auto";
  menu.style.overscrollBehavior = "contain";
  if (!menu.dataset.baWheel) {
    menu.dataset.baWheel = "1";
    menu.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
  }
  window.requestAnimationFrame(() => {
    const margin = 12;
    const viewport = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    if (rect.bottom > viewport - margin) {
      const top = Math.max(margin, viewport - margin - rect.height);
      if (top < rect.top) menu.style.top = `${top}px`;
    }
    const next = menu.getBoundingClientRect();
    menu.style.maxHeight = `${Math.max(180, viewport - Math.max(margin, next.top) - margin)}px`;
  });
}

function enhanceContextMenu() {
  const menu = document.querySelector(".ag-ctx-menu");
  if (!menu) return;
  if (menu.querySelector("[data-ba-actions]")) {
    fitContextMenu(menu);
    return;
  }
  const target = state.contextTarget;
  if (!target?.mention) return;
  const labels = [...menu.querySelectorAll(".ag-ctx-item-label")].map((el) => (el.textContent || "").trim().toLowerCase());
  const messageMenu = labels.some((label) => /^(reply|copy event id|view profile|block peer|mention\b)/.test(label));
  if (!messageMenu) return;
  const make = (kind, icon, label, title) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ag-ctx-item";
    btn.setAttribute("data-ba-action", kind);
    btn.setAttribute("role", "menuitem");
    btn.tabIndex = 0;
    btn.title = title || label;
    const iconEl = document.createElement("span");
    iconEl.className = "ag-ctx-item-icon";
    iconEl.textContent = icon;
    const labelEl = document.createElement("span");
    labelEl.className = "ag-ctx-item-label";
    labelEl.textContent = label;
    btn.append(iconEl, labelEl);
    return btn;
  };
  const divider = document.createElement("div");
  divider.className = "ag-ctx-divider";
  divider.setAttribute("data-ba-actions", "1");
  divider.setAttribute("role", "separator");
  const items = [...menu.querySelectorAll(".ag-ctx-item")];
  const last = items[items.length - 1];
  if (last) last.after(divider);
  else menu.append(divider);
  divider.after(
    make("hug", "♡", "Hug", `Hug ${target.mention}`),
    make("slap", "✋", "Slap", `Slap ${target.mention}`),
    make("custom", "✦", "Custom action…", `Send a custom action to ${target.mention}`),
  );
  fitContextMenu(menu);
}

function sendComposerText(text) {
  const ta = composerTextarea();
  if (!(ta instanceof HTMLTextAreaElement) || ta.disabled || ta.readOnly) {
    toast("warning", "Composer unavailable", "Open a channel or DM with a working composer first.");
    return false;
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(ta, text);
  else ta.value = text;
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.focus();
  try {
    ta.setSelectionRange(text.length, text.length);
  } catch {}
  const dock = ta.closest(".ag-composer-dock") || document;
  let tries = 0;
  const send = () => {
    const btn = dock.querySelector(".ag-composer-send-btn") || document.querySelector(".ag-composer-send-btn");
    if (btn instanceof HTMLElement && !btn.disabled) {
      btn.click();
      return;
    }
    tries += 1;
    if (tries < 12) {
      window.setTimeout(send, 50);
      return;
    }
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
  };
  window.setTimeout(send, 50);
  return true;
}

function closeContextMenu() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
}

function sendAction(kind) {
  const target = state.contextTarget;
  if (!target?.mention) {
    toast("warning", "No message target", "Right-click a message and choose an action.");
    return;
  }
  let text = "";
  if (kind === "hug") text = `* hugs ${target.mention} *`;
  else if (kind === "slap") text = `* slaps ${target.mention} with a large trout *`;
  else {
    openCustomAction();
    return;
  }
  closeContextMenu();
  clearStuckHoverMenus(null);
  if (sendComposerText(text)) closePanel();
}

function selfMention() {
  const name = String(state.status?.nickname || "").trim();
  const pubkey = String(state.status?.pubkey || "").trim();
  const tag = pubkey ? pubkey.slice(-4) : "";
  if (!name && !tag) return "";
  return `@${name || "you"}${tag ? `#${tag}` : ""}`;
}

function formatActionText(raw, mention, sender) {
  const cleaned = String(raw || "").replace(/^\*+|\*+$/g, "").trim();
  if (!cleaned) return "";
  const core = cleaned
    .replace(/\{user\}/g, mention || "")
    .replace(/\{sender\}/g, sender || "");
  return `* ${core} *`;
}

function insertCustomActionToken(token) {
  const input = state.shadow?.querySelector("#ba-custom-action-input");
  if (!input) return;
  insertInto(input, token);
}

function sendSlashAction(raw) {
  const match = String(raw || "").match(/^\/me\s*([\s\S]*)$/i);
  const text = match?.[1]?.trim() || "";
  if (!text) {
    toast("warning", "Nothing to send", "Write something after /me first.");
    return false;
  }
  const body = formatActionText(text, state.contextTarget?.mention || "", selfMention());
  if (!body) return false;
  return sendComposerText(body);
}

function closeActionModal() {
  setModalOpen("action", false);
  state.customAction = null;
  state.contextTarget = null;
  const container = state.shadow?.querySelector("[data-role='action-content']");
  if (container) container.innerHTML = "";
}

function renderCustomAction() {
  const container = state.shadow?.querySelector("[data-role='action-content']");
  if (!container || !state.customAction) return;
  const target = state.contextTarget;
  const action = state.customAction.text || state.settings.actions.custom || "boops";
  container.innerHTML = `
    <div class="ba-modal-head">
      <div>
        <div class="ba-modal-title">Custom action</div>
        <div class="ba-modal-sub">${h(target?.mention || "someone")}</div>
      </div>
      <div class="ba-modal-space"></div>
      <button type="button" class="ba-icon-btn" data-action="action-cancel" aria-label="Close">✕</button>
    </div>
    <div class="ba-modal-body">
      <label class="ba-label" for="ba-custom-action-input">Action</label>
      <input id="ba-custom-action-input" class="ba-input" maxlength="60" value="${h(action)}" spellcheck="false" autocomplete="off">
      <div class="ba-set-chips" style="margin-top:7px">
        <button type="button" class="ba-set-chip" data-action="action-insert-user" title="Insert the target user">{user}</button>
        <button type="button" class="ba-set-chip" data-action="action-insert-sender" title="Insert your name">{sender}</button>
      </div>
      <div class="ba-hint" style="margin-top:6px">Use <code class="ba-code">{user}</code> for the target and <code class="ba-code">{sender}</code> for your name. Nothing is appended automatically.</div>
      <div class="ba-card" style="margin-top:10px;margin-bottom:0">
        <div class="ba-card-head"><span class="ba-card-title">Preview</span></div>
        <div class="ba-preview-line" data-role="action-preview" style="font-size:13px"></div>
      </div>
    </div>
    <div class="ba-modal-actions">
      <button type="button" class="ba-btn primary" data-action="action-send">Send action</button>
      <span class="ba-space"></span>
      <button type="button" class="ba-btn" data-action="action-cancel">Cancel</button>
    </div>`;
  const input = container.querySelector("#ba-custom-action-input");
  const update = () => {
    const raw = input?.value || "";
    state.customAction.text = raw;
    const mention = target?.mention || "";
    const preview = formatActionText(raw, mention, selfMention());
    const p = container.querySelector("[data-role='action-preview']");
    if (p) p.textContent = preview;
  };
  update();
  input?.addEventListener("input", update);
  input?.focus();
  input?.select();
}

function openCustomAction() {
  if (!state.contextTarget?.mention) {
    toast("warning", "No message target", "Right-click a message first.");
    return;
  }
  closeContextMenu();
  clearStuckHoverMenus(null);
  state.customAction = { text: state.settings.actions.custom || "boops" };
  renderCustomAction();
  setModalOpen("action", true);
  window.requestAnimationFrame(() => {
    const input = state.shadow?.querySelector("#ba-custom-action-input");
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  });
}

function sendCustomAction() {
  const target = state.contextTarget;
  if (!target?.mention) {
    closeActionModal();
    return;
  }
  const raw = (state.customAction?.text || state.settings.actions.custom || "boops").trim();
  if (!raw) return;
  updateSettings((s) => {
    s.actions.custom = raw.slice(0, 60);
  });
  const body = formatActionText(raw, target.mention, selfMention());
  if (!body) return;
  closeActionModal();
  clearStuckHoverMenus(null);
  if (sendComposerText(body)) closePanel();
}

document.addEventListener(
  "click",
  (event) => {
    if (!state.enabledReady || state.settings.enabled === false) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const card = target.closest(".ag-suite-card");
    if (!card) return;
    const name = card.querySelector(".ag-suite-card-name")?.textContent?.trim().toLowerCase();
    if (name !== "chat" || !isGroupChatView()) return;
    window.setTimeout(() => returnToPublicChat(), 0);
  },
  true,
);

document.addEventListener("contextmenu", captureContextTarget, true);
document.addEventListener(
  "click",
  (event) => {
    if (!state.enabledReady || state.settings.enabled === false) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest("[data-ba-action]");
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const kind = btn.getAttribute("data-ba-action");
    if (kind === "custom") openCustomAction();
    else sendAction(kind);
  },
  true,
);
document.addEventListener(
  "mousedown",
  (event) => {
    if (!state.enabledReady || state.settings.enabled === false) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-ba-action]")) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true,
);

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

function toastIcon(level) {
  if (level === "success") {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';
  }
  if (level === "warning") {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>';
  }
  if (level === "error") {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>';
  }
  return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
}

function toast(level, title, detail = "") {
  const root = state.shadow;
  if (!root) return;
  const container = root.querySelector("[data-role='toasts']");
  if (!container) return;
  const key = `${level}:${title}:${detail}`;
  const now = Date.now();
  const cooldown = level === "error" ? 15000 : 8000;
  if (now - Number(toastCooldowns.get(key) || 0) < cooldown) return;
  toastCooldowns.set(key, now);
  if (toastCooldowns.size > 80) {
    const first = toastCooldowns.keys().next().value;
    if (first) toastCooldowns.delete(first);
  }
  for (const existing of container.querySelectorAll(".ba-toast")) {
    if (existing.dataset.baToastKey === key) return;
  }
  while (container.children.length >= 5) container.firstElementChild?.remove();
  const node = document.createElement("div");
  node.className = `ba-toast ${level}`;
  node.dataset.baToastKey = key;
  node.setAttribute("role", level === "error" ? "alert" : "status");
  node.innerHTML = `<span class="ba-toast-icon">${toastIcon(level)}</span><div class="ba-toast-copy"><div class="ba-toast-title">${h(title)}</div>${detail ? `<div class="ba-toast-detail">${h(detail)}</div>` : ""}</div><button type="button" class="ba-toast-close" aria-label="Dismiss">×</button>`;
  const close = node.querySelector(".ba-toast-close");
  let timer = null;
  const remove = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      state.toasts.delete(timer);
    }
    node.remove();
  };
  close?.addEventListener("click", remove);
  container.appendChild(node);
  timer = window.setTimeout(remove, level === "error" ? 7000 : 4200);
  state.toasts.add(timer);
}

// ---------------------------------------------------------------------------
// Clipboard / diagnostics
// ---------------------------------------------------------------------------

async function copyText(text, message = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast("success", message);
  } catch {
    toast("warning", "Clipboard unavailable", "Select and copy the text manually.");
  }
}

function downloadJson(event) {
  try {
    const blob = new Blob([JSON.stringify(event, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nostr-event-${event.id?.slice(0, 12) || "event"}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("success", "JSON downloaded");
  } catch (err) {
    toast("error", "Download failed", String(err));
  }
}

function renderDiagnostics() {
  const root = state.shadow;
  if (!root) return;
  const el = root.querySelector("[data-role='diagnostics']");
  if (!el) return;
  const status = state.status || {};
  const extensionVersion = api.runtime.getManifest?.().version || VERSION;
  el.innerHTML = `
    <div class="ba-kv"><span>extension</span><span>${h(extensionVersion)}</span></div>
    <div class="ba-kv"><span>page bridge</span><span>${state.pageReady ? "ready" : "waiting"}</span></div>
    <div class="ba-kv"><span>signer</span><span>${status.signerHooked ? h(status.signMode || "attached") : "no"}</span></div>
    <div class="ba-kv"><span>nip-07 rewriter</span><span>${status.nip07Patched ? "yes" : "no"}</span></div>
    <div class="ba-kv"><span>pubkey</span><span>${h(short(status.pubkey || "", 20))}</span></div>
    <div class="ba-kv"><span>glub build</span><span>${h(effectiveBuild(state.settings) || "missing")}</span></div>
    <div class="ba-kv"><span>events in memory</span><span>${state.events.size}</span></div>
    <div class="ba-kv"><span>relay frames</span><span>${state.logs.length}</span></div>
    <div class="ba-kv"><span>review queue</span><span>${state.reviewQueue.length}</span></div>`;
}

function copyDiagnostics() {
  const status = state.status || {};
  const text = [
    `Better Agnostr ${api.runtime.getManifest?.().version || VERSION}`,
    `url: ${location.href}`,
    `page bridge: ${state.pageReady}`,
    `signer: ${status.signerHooked ? status.signMode || "attached" : "no"}`,
    `nip07 rewriter: ${status.nip07Patched}`,
    `pubkey: ${status.pubkey}`,
    `glub build: ${effectiveBuild(state.settings)}`,
    `events: ${state.events.size}`,
    `logs: ${state.logs.length}`,
    `build error: ${state.buildError || "none"}`,
  ].join("\n");
  copyText(text, "Diagnostics copied");
}

// ---------------------------------------------------------------------------
// DOM observation
// ---------------------------------------------------------------------------

function observePage() {
  const relevantSelector = [
    ".ag-msg-row",
    ".ag-msg-actions",
    ".ag-msg-head",
    ".ag-app-rail",
    ".ag-bitchat-drawer",
    ".ag-bitchat-quickbar",
    ".ag-bitchat-globe-stage",
    ".ag-suite-footer",
    ".ag-toast-stack",
    ".ag-toast",
    ".ag-rail-srv",
    ".ag-srv-mobile-rail",
    ".ag-mobile-tabbar",
    ".ag-composer-dock",
    ".ag-composer-right",
    ".ag-suite-popover",
    ".ag-suite-footer",
    ".ag-conv-footer",
    ".ag-conv-header",
    ".ag-conv-pane",
    ".ag-header",
    ".ag-srv-discord-pane",
    ".ag-srv-pane-pane",
    ".ag-srv-mobile-split",
    ".ag-settings-modal",
    ".ag-peer-modal",
    ".ag-sheet",
    ".ag-info-sheet",
    ".ag-quick-profile-popover",
    ".ag-ctx-menu",
  ].join(",");
  const observer = new MutationObserver((records) => {
    if (document.hidden) {
      scheduleEnhance();
      return;
    }
    let relevant = false;
    let urgentCallUi = false;
    for (const record of records) {
      if (record.type === "childList") {
        const target = record.target;
        const row = target instanceof Element ? target.closest(".ag-msg-row") : null;
        if (row) {
          if (!repairRowNow(row)) {
            delete row.dataset.baDecorated;
            relevant = true;
          }
        }
        for (const node of [...record.addedNodes, ...record.removedNodes]) {
          if (!(node instanceof Element)) continue;
          if (node.matches(relevantSelector) || node.querySelector(relevantSelector)) {
            relevant = true;
            if (
              node.matches(".ag-sheet, .ag-info-sheet, .ag-ctx-menu, .ag-peer-modal") ||
              node.querySelector(".ag-sheet, .ag-info-sheet, .ag-ctx-menu, .ag-peer-modal")
            ) {
              urgentCallUi = true;
            }
            break;
          }
        }
      } else if (record.type === "attributes") {
        const el = record.target;
        if (el instanceof Element) {
          const row = el.closest(".ag-msg-row");
          if (row && repairRowNow(row)) {
            // The row was intact or has just been repaired. Hover/action class
            // churn does not need a second, full enhance pass.
            continue;
          }
        }
        if (
          el === document.documentElement ||
          el === document.body ||
          (el instanceof Element && (el.matches(relevantSelector) || el.closest(relevantSelector)))
        ) {
          relevant = true;
        }
      }
      if (relevant) break;
    }
    if (!relevant) return;
    if (urgentCallUi) {
      applyCallButtons();
      hideCallUi();
      removeCallMenuItems();
    }
    scheduleEnhance();
    scheduleSettingsSync();
    if (state.settings.privacy.calls.disable && state.settings.privacy.calls.hideUi) removeCallMenuItems();
  });
  state.pageObserver = observer;
  state.pageObserverStart = () => {
    try {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    } catch {}
  };
  state.pageObserverStart();
  scheduleEnhance();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  let storedSettings = {};
  let hadStoredSettings = false;
  try {
    const stored = await api.storage.local.get(STORAGE_KEY);
    storedSettings = stored?.[STORAGE_KEY] || {};
    hadStoredSettings = !!stored?.[STORAGE_KEY] && Object.keys(storedSettings).length > 0;
    state.settings = normalizeSettings(storedSettings);
  } catch {
    state.settings = normalizeSettings({});
  }
  const storedKeys = storedSettings && typeof storedSettings === "object" ? Object.keys(storedSettings) : [];
  const storedIsSparse = !hadStoredSettings || storedKeys.every((key) => key === "enabled" || key === "schema");
  if (storedIsSparse) {
    const backup = readSettingsBackup();
    if (backup) {
      try {
        state.settings = normalizeSettings(mergeSettings(backup, storedSettings));
        storedSettings = state.settings;
        await api.storage.local.set({ [STORAGE_KEY]: state.settings });
      } catch {
        state.settings = normalizeSettings({});
      }
    }
  } else {
    writeSettingsBackup(state.settings);
  }
  state.settingsEpoch = 1;
  if (state.settings.enabled !== false) {
    document.documentElement.classList.toggle(
      "ba-hide-notification-button",
      state.settings.appearance.hideNotificationButton === true,
    );
  }
  state.activeTab = state.settings.ui.activeTab || "studio";
  state.betterTab = state.settings.ui.betterTab || "line";
  state.settings.ui.panelOpen = false;

  api.storage.onChanged?.addListener((changes, area) => {
    if (area !== "local") return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    const before = state.settings.enabled !== false;
    const after = change.newValue?.enabled !== false;
    if (before !== after) {
      if (after) overrideNativeSounds();
      else restoreNativeSounds();
      location.reload();
      return;
    }
    if (!change.newValue || typeof change.newValue !== "object") {
      location.reload();
      return;
    }
    const incoming = normalizeSettings(mergeSettings(state.settings, change.newValue));
    incoming.ui = {
      ...incoming.ui,
      activeTab: state.settings.ui.activeTab,
      betterTab: state.settings.ui.betterTab,
      panelOpen: state.settings.ui.panelOpen,
      firstRun: state.settings.ui.firstRun,
    };
    if (JSON.stringify(incoming) === JSON.stringify(state.settings)) return;
    state.settings = incoming;
    state.settingsEpoch += 1;
    writeSettingsBackup(state.settings);
    if (!state.enabledReady || state.settings.enabled === false) return;
    syncInputs();
    syncDynamic();
    applyTheme();
    applyCallCss();
    ensureToolbars();
    applyShortcutVisibility();
    scheduleEnhance();
    scheduleSettingsSync();
  });

  state.enabledReady = true;
  if (state.settings.enabled === false) {
    restoreNativeSounds();
    return;
  }
  window.addEventListener("message", handlePageMessage);
  document.documentElement.classList.add("ba-active");
  overrideNativeSounds();
  document.addEventListener("pointerdown", () => {
    if (!state.soundUnlocked) {
      state.soundUnlocked = true;
      unlockAudio();
    }
  }, { capture: true, passive: true });
  document.addEventListener("click", handleGlobalClickSound, true);
  const runSlashAction = (event) => {
    const ta = composerTextarea();
    if (!(ta instanceof HTMLTextAreaElement) || !/^\/me\s+/i.test(ta.value)) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    return sendSlashAction(ta.value);
  };
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      const ta = event.target;
      if (!(ta instanceof HTMLTextAreaElement) || !ta.matches(".ag-composer-input")) return;
      if (!/^\/me\s+/i.test(ta.value)) return;
      runSlashAction(event);
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".ag-composer-send-btn")) return;
      runSlashAction(event);
    },
    true,
  );
  let lastHoverCleanup = 0;
  document.addEventListener(
    "pointermove",
    (event) => {
      const now = Date.now();
      if (now - lastHoverCleanup < 250) return;
      lastHoverCleanup = now;
      const target = event.target;
      const row = target instanceof Element ? target.closest(".ag-msg-row") : null;
      const active = document.activeElement;
      const hasStuckState =
        !!document.querySelector(".ag-msg-row.actions-open, .ag-msg-actions.picker-open") ||
        (active instanceof HTMLElement && !!active.closest(".ag-msg-actions"));
      if (!row && !hasStuckState) return;
      clearStuckHoverMenus(row);
    },
    { passive: true, capture: true },
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      state.enhancePending = true;
      state.pageObserver?.disconnect();
      return;
    }
    state.pageObserverStart?.();
    if (state.enhancePending) {
      state.enhancePending = false;
      scheduleEnhance(true);
    }
    replaceBitchatText();
  });
  const titleEl = document.querySelector("title");
  if (titleEl && typeof MutationObserver === "function") {
    new MutationObserver(() => {
      if (/\bbitchat\b/i.test(document.title)) replaceBitchatText();
    }).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
  window.addEventListener("resize", () => {
    scheduleEnhance();
    if (state.emojiAnchor) positionEmojiPicker(state.emojiAnchor);
  }, { passive: true });
  window.addEventListener(
    "scroll",
    () => {
      if (state.emojiAnchor) positionEmojiPicker(state.emojiAnchor);
    },
    { passive: true, capture: true },
  );
  window.visualViewport?.addEventListener("resize", () => {
    if (state.emojiAnchor) positionEmojiPicker(state.emojiAnchor);
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || state.modalOpen) return;
      const pop = document.querySelector(".ba-emoji-popover");
      if (pop && !pop.hidden) hideEmojiPicker();
    },
    true,
  );
  window.addEventListener("pagehide", () => {
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = null;
      persistSettings();
    }
    releaseNativeSounds();
  });
  window.setInterval(tickObfuscation, 100);
  window.setInterval(flairTickerTick, 1500);
  ensureHost();
  observePage();
  observeChatLabels();
  applyShortcutVisibility();
  scheduleSettingsSync();
  hello();
  refreshBuild(false);

  // Keep build reasonably fresh while the page is open.
  window.setInterval(() => {
    if (state.settings.glub.autoSync) refreshBuild(false);
  }, 4 * 60 * 1000);

  // Respond to popup / background requests.
  api.runtime.onMessage.addListener((message) => {
    if (message?.type === "openStudio") {
      openPanel(message.tab || "studio");
      return Promise.resolve({ ok: true });
    }
    if (message?.type === "getPageState") {
      return Promise.resolve({ status: state.status, build: effectiveBuild(state.settings) });
    }
    return undefined;
  });
}

init();
