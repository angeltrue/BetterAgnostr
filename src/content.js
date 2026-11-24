import panelCss from "./ui/panel.css";
import pageCss from "./ui/page.css";
import glubFlairCss from "./ui/glub-flair.css";
import { flairClass, flairFxInner, flairHasFx, flairOverlayInner, flairVars, lightningStrikeMarkup } from "./lib/glub-flair.js";
import { EMOJI_GROUPS } from "./lib/emojis.js";
import {
  CLIENT_PRESETS,
  COLORS,
  COLOR_NAMES,
  FLAIRS,
  FMT_MAX,
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
  normalizeSettings,
} from "./lib/settings.js";

const api = globalThis.browser ?? globalThis.chrome;

const FONT_PRESETS = [
  { id: "default", label: "Agnostr default" },
  { id: "inter", label: "Inter", stack: "Inter, system-ui, sans-serif" },
  { id: "jetbrains", label: "JetBrains Mono", stack: "'JetBrains Mono', ui-monospace, monospace", mono: true },
  { id: "plex", label: "IBM Plex Sans", stack: "'BA IBM Plex Sans', 'IBM Plex Sans', sans-serif" },
  { id: "atkinson", label: "Atkinson Hyperlegible", stack: "'BA Atkinson', 'Atkinson Hyperlegible', sans-serif" },
  { id: "lexend", label: "Lexend", stack: "'BA Lexend', Lexend, sans-serif" },
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
  review: null,
  reviewQueue: [],
  logFilter: "",
  buildError: "",
  buildFetching: false,
  lastOutgoingId: null,
  decoratedRows: new Set(),
  richApplied: new WeakMap(),
  betterPeers: new Map(),
  emojiTarget: null,
  emojiCategory: "smileys",
  suppressEmojiHide: false,
  pendingLookups: new Set(),
  enhanceTimer: null,
  saveTimer: null,
  toasts: new Set(),
  verified: new Map(),
  entities: new Map(),
  restoreMap: new WeakMap(),
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

function obfuscateText(real, rate) {
  const chars = [...real];
  if (rate >= 1) return chars.map(obfGlyph).join("");
  if (Math.random() > 0.32) return real;
  const candidates = [];
  for (let i = 0; i < chars.length; i++) {
    if (OBF_BUCKETS.some((bucket) => bucket.includes(chars[i]))) candidates.push(i);
  }
  if (!candidates.length) return real;
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const count = Math.min(2, 1 + (Math.random() < 0.3 ? 1 : 0), candidates.length);
  for (let i = 0; i < count; i++) {
    const index = candidates[i];
    chars[index] = obfGlyph(chars[index]);
  }
  return chars.join("");
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
  const els = [...document.querySelectorAll(".fmtObf")];
  if (state.shadow) els.push(...state.shadow.querySelectorAll(".fmtObf"));
  if (!els.length) return;
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const now = performance.now();
  for (const el of els) {
    if (el.dataset.obfText == null) el.dataset.obfText = el.textContent || "";
    const real = el.dataset.obfText;
    if (!real) continue;
    if (still) {
      if (!el.dataset.obfStatic) {
        el.textContent = obfuscateText(real, 1);
        el.dataset.obfStatic = "1";
      }
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
    window.postMessage(envelope, "*");
  } catch {}
  try {
    document.dispatchEvent(new CustomEvent("ba-ui", { detail: JSON.stringify(envelope) }));
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
      state.buildError = res.stale && res.error ? `Using cached build: ${res.error}` : "";
      state.settings.glub.build = String(res.build);
      state.settings.glub.buildFetchedAt = Number(res.fetchedAt) || Date.now();
      markSettingsDirty();
      syncDynamic();
    } else if (res?.error) {
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
  const data = event?.data;
  if (!data || data.__ba !== true || data.dir !== "page") return;
  if (data.seq != null) {
    const key = `seq:${data.seq}`;
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
  if (data.token && data.token !== state.pageToken) return;

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
    case "status":
      state.status = data.payload || {};
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
            { build, fetchedAt: state.settings.glub.buildFetchedAt, error: state.buildError },
            reqId,
          );
        })
        .catch((err) => {
          sendPage("response", { build: effectiveBuild(state.settings), fetchedAt: state.settings.glub.buildFetchedAt, error: String(err) }, reqId);
        });
      break;
    }
    case "review": {
      queueReview(data.payload || {}, data.id);
      break;
    }
    case "verified": {
      if (state.viewer?.event?.id) {
        state.verified.set(state.viewer.event.id, data.payload);
        if (state.viewer.tab === "verify") renderViewer();
      }
      break;
    }
    case "entities": {
      if (state.viewer?.event?.id) {
        state.entities.set(state.viewer.event.id, data.payload || {});
        renderViewer();
      }
      break;
    }
    default:
      break;
  }
}

function handlePageCustomEvent(event) {
  try {
    const data = typeof event.detail === "string" ? JSON.parse(event.detail) : event.detail;
    if (!data || data.__ba !== true || data.dir !== "page") return;
    if (data.seq != null) {
      const key = `seq:${data.seq}`;
      if (state.pageSeen.has(key)) return;
      state.pageSeen.add(key);
      if (state.pageSeen.size > 300) {
        const first = state.pageSeen.values().next().value;
        if (first) state.pageSeen.delete(first);
      }
    }
    handlePageData(data);
  } catch {}
}

// ---------------------------------------------------------------------------
// Event data
// ---------------------------------------------------------------------------

function rememberEvent(ev) {
  if (!ev || typeof ev.id !== "string") return;
  if (!state.events.has(ev.id)) state.events.set(ev.id, ev);
  if (ev.pubkey && Array.isArray(ev.tags) && isBetterClient(ev)) {
    state.betterPeers.set(String(ev.pubkey).toLowerCase(), eventHandle(ev));
  }
  // Bound memory.
  if (state.events.size > 3000) {
    const first = state.events.keys().next().value;
    if (first) state.events.delete(first);
  }
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
  const internalKinds = new Set([25050, 25055, 25058, 25059, 30078]);
  for (const log of logs) {
    if (log.event) rememberEvent(log.event);
    if (log.dir === "out" && log.eventId) {
      state.ownEventIds.add(log.eventId);
      if (!internalKinds.has(log.kind)) state.lastOutgoingId = log.eventId;
    }
    if (log.dir === "in" && log.event) maybeChime(log.event);
  }
  state.logs.push(...logs);
  if (state.logs.length > 700) state.logs.splice(0, state.logs.length - 700);
  if (state.ownEventIds.size > 2000) {
    const first = state.ownEventIds.values().next().value;
    if (first) state.ownEventIds.delete(first);
  }
  scheduleEnhance();
  renderRelaySoon();
  syncLastOutgoing();
  scheduleSettingsSync();
}

function isMentionEvent(event) {
  if (!event) return false;
  const own = String(state.status?.pubkey || "").toLowerCase();
  if (own) {
    for (const tag of event.tags || []) {
      if (Array.isArray(tag) && tag[0] === "p" && String(tag[1] || "").toLowerCase() === own) return true;
    }
  }
  const name = state.status?.nickname || "";
  const tag = own ? own.slice(-4) : "";
  const content = String(event.content || "");
  if (name && content.toLowerCase().includes(`@${name.toLowerCase()}`)) return true;
  if (name && tag && content.toLowerCase().includes(`@${name.toLowerCase()}#${tag}`)) return true;
  return false;
}

function maybeChime(event) {
  const sounds = state.settings.sounds;
  if (!sounds.messageEnabled || sounds.message === "off") return;
  if (!event) return;
  const kind = event.kind;
  const events = sounds.events || {};
  const isChat = kind === 20000 || kind === 23333;
  const isDm = kind === 4 || kind === 14 || kind === 1059;
  const isCall = kind === 25050;
  if (isChat) {
    if (!events.chat) return;
    if (events.mentionOnly && !isMentionEvent(event)) return;
  } else if (isDm) {
    if (!events.dm) return;
  } else if (isCall) {
    if (!events.calls || state.settings.privacy.calls.disable) return;
  } else {
    return;
  }
  if (state.seenChimeIds.has(event.id) || state.ownEventIds.has(event.id)) return;
  const age = Math.floor(Date.now() / 1000) - Number(event.created_at || 0);
  if (!Number.isFinite(age) || age < -10 || age > 15) return;
  const own = state.status?.pubkey?.toLowerCase();
  if (own && String(event.pubkey || "").toLowerCase() === own) return;
  if (Date.now() - state.lastChimeAt < 350) return;
  state.lastChimeAt = Date.now();
  state.seenChimeIds.add(event.id);
  if (state.seenChimeIds.size > 1000) {
    const first = state.seenChimeIds.values().next().value;
    if (first) state.seenChimeIds.delete(first);
  }
  playMessageSound(sounds.message, sounds.volume);
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

function shellHtml() {
  return `
  <div class="ba-modal-wrap" data-modal="viewer" aria-hidden="true">
    <div class="ba-modal-backdrop" data-close-modal="viewer"></div>
    <div class="ba-modal" role="dialog" aria-modal="true" aria-label="Event details">
      <div data-role="viewer-content"></div>
    </div>
  </div>
  <div class="ba-modal-wrap" data-modal="review" aria-hidden="true">
    <div class="ba-modal-backdrop" data-close-modal="review"></div>
    <div class="ba-modal small" role="dialog" aria-modal="true" aria-label="Review outgoing event">
      <div data-role="review-content"></div>
    </div>
  </div>
  <div class="ba-modal-wrap" data-modal="action" aria-hidden="true">
    <div class="ba-modal-backdrop" data-close-modal="action"></div>
    <div class="ba-modal small" role="dialog" aria-modal="true" aria-label="Custom action">
      <div data-role="action-content"></div>
    </div>
  </div>
  <div class="ba-toasts" data-role="toasts"></div>
  <button type="button" class="ba-fab" data-action="open-panel" aria-label="Open Better Agnostr settings">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>
      <path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z"/>
    </svg>
  </button>`;
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
  if (!state.pageStyle) {
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

function applyTheme() {
  const head = document.head || document.documentElement;
  if (!head) return;
  if (!state.themeStyle) {
    state.themeStyle = document.getElementById("ba-theme-css");
    if (!state.themeStyle) {
      state.themeStyle = document.createElement("style");
      state.themeStyle.id = "ba-theme-css";
      head.appendChild(state.themeStyle);
    }
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
  if (!/^(https?:|moz-extension:|data:font)/i.test(value)) return "";
  return value;
}

function applyFont() {
  const head = document.head || document.documentElement;
  if (!head) return;
  let style = document.getElementById("ba-font-css");
  if (!style) {
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
`;
  let extra = "";
  let stack = family.stack || "";
  if (f.family === "custom") {
    const customFamily = String(f.customFamily || "").replace(/["'{};]/g, "").trim();
    const url = safeFontUrl(f.customUrl);
    if (url) {
      extra = `@font-face{font-family:"BA Custom";src:url(${JSON.stringify(url)});font-style:normal;font-display:swap}`;
      stack = `"BA Custom"${customFamily ? `, "${customFamily}"` : ""}, sans-serif`;
    } else if (customFamily) {
      stack = `"${customFamily}", sans-serif`;
    }
  }
  if (!stack) {
    style.textContent = bundled;
    return;
  }
  const vars = family.mono
    ? `--font-sans: ${stack} !important; --font-mono: ${stack} !important;`
    : `--font-sans: ${stack} !important;`;
  style.textContent = `${bundled}
${extra}
html:root{${vars}}`;
}

function applyCallCss() {
  const calls = state.settings.privacy.calls;
  document.documentElement.classList.toggle("ba-calls-hidden", !!(calls.disable && calls.hideUi));
  document.documentElement.classList.toggle("ba-hide-locate", state.settings.privacy.hideLocate !== false);
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

function removeCallMenuItems() {
  const calls = state.settings.privacy.calls;
  if (!calls.disable) return;
  for (const label of document.querySelectorAll(".ag-ctx-item-label")) {
    if (!/^(start |join |answer )?(voice|video) call$/i.test(label.textContent?.trim() || "")) continue;
    const item = label.closest(".ag-ctx-item");
    if (!item) continue;
    item.disabled = true;
    item.classList.add("ba-call-disabled");
    if (calls.hideUi) item.style.display = "none";
  }
}

function hideCallUi() {
  const calls = state.settings.privacy.calls;
  if (!calls.disable) {
    for (const el of document.querySelectorAll("[data-ba-call-ui-hidden]")) {
      el.style.removeProperty("display");
      delete el.dataset.baCallUiHidden;
    }
    return;
  }
  for (const el of document.querySelectorAll(
    '[class*="ag-call-"], [class*="ag-geo-call-"], [class*="ag-srv-voice-"], [class*="ag-srv-discord-voice-"]',
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.closest(".ag-settings-modal, .ba-better-overlay, .ba-about-overlay")) continue;
    el.style.display = "none";
    el.dataset.baCallUiHidden = "1";
  }
}

function applyCallButtons() {
  const calls = state.settings.privacy.calls;
  const blocked = !!calls.disable;
  for (const btn of document.querySelectorAll("button")) {
    if (btn.closest(".ag-settings-modal")) continue;
    const text = `${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""} ${btn.title || ""}`.replace(/\s+/g, " ").trim();
    if (!/^(?:start |join |answer )?(?:voice|video) call$/i.test(text)) continue;
    btn.disabled = blocked;
    btn.classList.toggle("ba-call-disabled", blocked);
    if (blocked) {
      if (btn.classList.contains("ag-sheet-action-btn") || calls.hideUi) {
        btn.style.display = "none";
        btn.dataset.baCallHidden = "1";
      }
    } else {
      if (btn.dataset.baCallHidden === "1") {
        btn.style.removeProperty("display");
        delete btn.dataset.baCallHidden;
      }
      btn.classList.remove("ba-call-disabled");
    }
  }
}

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
    <textarea class="ag-input ba-set-css" data-ba-setting="theme.customCss" spellcheck="false" rows="4" placeholder="html:root { --accent: #ff4ecd; }">${h(state.settings.theme.customCss)}</textarea>
    <div class="ba-set-note">Injected after the selected theme. Use html:root for variable overrides.</div>
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


function betterSettingsPaneHtml() {
  const tabs = [
    ["line", "Line"],
    ["client", "Client"],
    ["general", "General"],
  ];
  return `<div class="ba-settings-shell" data-ba-better-pane="1">
    <div class="ba-set-tabs" role="tablist" aria-label="Better Agnostr sections">
      ${tabs.map(([id, label]) => `<button type="button" class="ba-set-tab${state.betterTab === id ? " is-active" : ""}" data-ba-better-tab="${id}" role="tab">${label}</button>`).join("")}
    </div>
    <div class="ba-set-content" data-ba-better-content></div>
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
      <input class="ag-input ba-set-template" data-ba-setting="studio.template" maxlength="200" spellcheck="false" autocomplete="off" value="${h(template)}" placeholder="&l{name}&7{tag}&f: {msg}">
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
        <button type="button" class="ba-set-flair${!state.settings.studio.flair ? " active" : ""}" data-ba-flair-choice="">none</button>
        ${FLAIRS.map((f) => `<button type="button" class="ba-set-flair${state.settings.studio.flair === f.name ? " active" : ""}${f.gated ? " gated" : ""}" data-ba-flair-choice="${f.name}" title="${h(f.description)}">${h(f.label)}</button>`).join("")}
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
      <input class="ag-input" data-ba-setting="client.name" maxlength="64" spellcheck="false" autocomplete="off" value="${h(state.settings.client.name)}">
      <div class="ba-set-chips">
        ${CLIENT_PRESETS.map((name) => `<button type="button" class="ba-set-chip" data-ba-client-preset="${h(name)}">${h(name)}</button>`).join("")}
      </div>
    </div>
    <div class="ag-set-group">
      <span class="ag-set-label">Per event type</span>
      <div class="ba-set-policies">
        ${KIND_GROUPS.map((g) => `<div class="ba-set-policy">
          <span>${h(g.label)}</span>
          <select class="ag-input ba-set-select" data-ba-client-policy="${g.id}">
            ${KIND_POLICIES.map((p) => `<option value="${p}"${policies[g.id] === p ? " selected" : ""}>${p}</option>`).join("")}
          </select>
        </div>`).join("")}
      </div>
      <div class="ba-set-note">Applied when an event is signed.</div>
    </div>`;
}

function betterGeneralHtml() {
  return `
    <div class="ag-set-group">
      ${baToggle("ui.showButton", "Show settings shortcut", "Sparkle button in the conversation footer")}
      ${baToggle("ui.showVoiceMemo", "Voice memo button")}
    </div>
    <div class="ag-set-group">
      <span class="ag-set-label">Custom action</span>
      <input class="ag-input" data-ba-setting="actions.custom" maxlength="60" value="${h(state.settings.actions.custom)}" placeholder="boops">
    </div>
`;
}

function renderBetterTabContent(modal) {
  const content = modal.querySelector("[data-ba-better-content]");
  if (!content) return;
  if (state.betterTab === "line") content.innerHTML = betterLineHtml();
  else if (state.betterTab === "client") content.innerHTML = betterClientHtml();
  else content.innerHTML = betterGeneralHtml();
  for (const tab of modal.querySelectorAll("[data-ba-better-tab]")) {
    tab.classList.toggle("is-active", tab.getAttribute("data-ba-better-tab") === state.betterTab);
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
  const template = s.studio.template;
  const flair = s.studio.flair;
  const name = state.status?.nickname || "you";
  const tag = (state.status?.pubkey || "a1b2c3d4").slice(-4);
  const msg = PREVIEW_MESSAGE;
  const avatar = previewAvatarSrc();
  const sig = JSON.stringify([template, flair, msg, name, tag, avatar, s.studio.enabled, s.studio.reduceMotion]);
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

function openProfileByNpub(npub, nickname = "") {
  const value = String(npub || "").trim();
  if (!value) return;
  const modal = document.querySelector(".ag-settings-modal");
  modal?.querySelector(".ag-sheet-close-btn")?.click();
  window.setTimeout(async () => {
    const res = await askPage("inspectPeer", { npub: value, nickname }, 3000);
    if (res?.ok) return;
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
  const version = manifest.version || "1.0.1";
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
        <a href="https://github.com/hinsley/Agnostr" target="_blank" rel="noreferrer">github.com/hinsley/Agnostr</a>
      </div>
      <div class="ba-about-credit">
        <span class="ba-about-credit-name">Better Agnostr</span>
        <span class="ba-about-credit-line">by <a class="ba-about-angel" href="#dm=npub1t9kl0mq3f8pesupc9nqndpq389af4czsk7nnpvr5g6kg9hyenxvssjs0yk" data-ba-angel-link data-npub="npub1t9kl0mq3f8pesupc9nqndpq389af4czsk7nnpvr5g6kg9hyenxvssjs0yk">Angel</a></span>
        <a href="https://github.com/angeltrue/BetterAgnostr" target="_blank" rel="noreferrer">github.com/angeltrue/BetterAgnostr</a>
      </div>
    </div>
  </div>`;
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
  overlay.innerHTML = aboutPaneHtml();
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
  syncThemeCards(modal);
  const status = modal.querySelector("[data-ba-status]");
  if (status) {
    const st = state.status || {};
    const signer = st.signerHooked ? st.signMode || "hooked" : st.nip07Patched ? "nip-07" : "waiting";
    status.textContent = `Signer: ${signer} · ${state.events.size} events captured · glub ${effectiveBuild(state.settings) || "build missing"}`;
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
    ${baToggle("privacy.omitTeleport", "Omit teleport tag")}
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

function nativeSoundsHtml() {
  const sounds = state.settings.sounds;
  const events = sounds.events || {};
  return `<div class="ag-set-group ba-native-group" data-ba-native="sounds">
    <span class="ag-set-label">Better Agnostr sounds</span>
    <div class="ba-set-field"><span>Message chime</span><select class="ag-input ba-set-select" data-ba-setting="sounds.message">${optionsHtml(MESSAGE_SOUNDS, sounds.message)}</select></div>
    <div class="ba-set-field"><span>UI click</span><select class="ag-input ba-set-select" data-ba-setting="sounds.click">${optionsHtml(CLICK_SOUNDS, sounds.click)}</select></div>
    <div class="ba-set-field"><span>Volume</span><input class="ba-set-range" type="range" min="0" max="1" step="0.05" data-ba-setting="sounds.volume" value="${h(String(sounds.volume))}"></div>
    <div class="ba-native-checks">
      <label class="ba-native-check"><input type="checkbox" data-ba-setting="sounds.events.chat"${events.chat ? " checked" : ""}><span>Chat</span></label>
      <label class="ba-native-check"><input type="checkbox" data-ba-setting="sounds.events.mentionOnly"${events.mentionOnly ? " checked" : ""}><span>Mentions only</span></label>
      <label class="ba-native-check"><input type="checkbox" data-ba-setting="sounds.events.dm"${events.dm ? " checked" : ""}><span>DMs</span></label>
      <label class="ba-native-check"><input type="checkbox" data-ba-setting="sounds.events.calls"${events.calls ? " checked" : ""}><span>Call invites</span></label>
      <label class="ba-native-check"><input type="checkbox" data-ba-setting="sounds.clickEnabled"${sounds.clickEnabled ? " checked" : ""}><span>UI clicks</span></label>
    </div>
    <div class="ba-native-actions">
      <button type="button" class="ag-btn ag-btn-secondary ag-btn-sm" data-ba-settings-action="preview-message-sound">Test chime</button>
      <button type="button" class="ag-btn ag-btn-secondary ag-btn-sm" data-ba-settings-action="preview-click-sound">Test click</button>
    </div>
  </div>`;
}

function injectNativePrivacy(modal) {
  const stack = modal.querySelector(".ag-set-pane-stack");
  if (!stack || stack.querySelector("[data-ba-native='privacy']")) return;
  const holder = document.createElement("div");
  holder.innerHTML = nativePrivacyHtml();
  const group = holder.firstElementChild;
  const broadcast = [...stack.querySelectorAll(".ag-set-toggle-card")].find((el) =>
    el.textContent?.includes("Broadcast Agnostr client"),
  );
  if (broadcast) broadcast.after(group);
  else stack.prepend(group);
}

function injectNativeSounds(modal) {
  const stack = modal.querySelector(".ag-set-pane-stack");
  if (!stack) return;
  const row = [...modal.querySelectorAll(".ag-set-notif-row, .ag-set-toggle-card")].find((el) => {
    const title = el.querySelector(".ag-set-notif-row-title, .ag-set-toggle-title")?.textContent?.trim();
    return title === "Message chimes";
  });
  const nativeInput = row?.querySelector("input[type=checkbox]");
  if (nativeInput instanceof HTMLInputElement) {
    if (state.settings.sounds.messageEnabled !== nativeInput.checked) {
      state.settings.sounds.messageEnabled = nativeInput.checked;
      debounceSave();
    }
    if (!nativeInput.dataset.baBound) {
      nativeInput.dataset.baBound = "1";
      nativeInput.addEventListener("change", () => {
        state.settings.sounds.messageEnabled = nativeInput.checked;
        debounceSave();
      });
    }
  }
  if (stack.querySelector("[data-ba-native='sounds']")) return;
  const holder = document.createElement("div");
  holder.innerHTML = nativeSoundsHtml();
  const group = holder.firstElementChild;
  const soundGroup = [...stack.querySelectorAll(".ag-set-group")].find((g) =>
    g.querySelector(".ag-set-label")?.textContent?.includes("Sound, Ringtone"),
  );
  if (soundGroup) soundGroup.after(group);
  else stack.appendChild(group);
  syncNativeChimeState();
}

function injectAppearanceExtras(modal) {
  const stack = modal.querySelector(".ag-set-pane-stack");
  if (!stack) return;
  const agnThemeGrid = [...modal.querySelectorAll(".ag-set-theme-grid")].find((g) => !g.classList.contains("ba-glub-theme-grid"));
  if (agnThemeGrid) {
    let themeGroup = stack.querySelector("[data-ba-settings-group='themes']");
    if (!themeGroup) {
      const holder = document.createElement("div");
      holder.innerHTML = glubThemeGroupHtml();
      themeGroup = holder.firstElementChild;
      const anchor = agnThemeGrid.closest(".ag-set-group") || agnThemeGrid;
      anchor.after(themeGroup);
    }
    let cssGroup = stack.querySelector("[data-ba-settings-group='css']");
    if (!cssGroup) {
      const holder = document.createElement("div");
      holder.innerHTML = customCssGroupHtml();
      cssGroup = holder.firstElementChild;
      themeGroup.after(cssGroup);
    }
    let fontGroup = stack.querySelector("[data-ba-settings-group='font']");
    if (!fontGroup) {
      const holder = document.createElement("div");
      holder.innerHTML = `<div class="ag-set-group" data-ba-settings-group="font">
        <span class="ag-set-label">Font</span>
        <div class="ba-set-field"><span>Family</span><select class="ag-input ba-set-select" data-ba-setting="font.family">
          ${FONT_PRESETS.map((f) => `<option value="${f.id}"${state.settings.font.family === f.id ? " selected" : ""}>${h(f.label)}</option>`).join("")}
        </select></div>
        <div class="ba-set-field"><span>Custom family</span><input class="ag-input" data-ba-setting="font.customFamily" maxlength="80" value="${h(state.settings.font.customFamily)}" placeholder="installed family name"></div>
        <div class="ba-set-field"><span>Custom URL</span><input class="ag-input" data-ba-setting="font.customUrl" maxlength="500" value="${h(state.settings.font.customUrl)}" placeholder="https://…/font.woff2"></div>
        <div class="ba-set-note">IBM Plex, Atkinson Hyperlegible, and Lexend are bundled.</div>
      </div>`;
      fontGroup = holder.firstElementChild;
      cssGroup.after(fontGroup);
    }
    syncSettingsFields(modal);
  }
}

function shootStar(el) {
  if (typeof el.animate !== "function") return;
  const layer = el.parentElement;
  const row = layer?.closest(".ag-msg-row") || layer;
  if (!row) return;
  const line = row.querySelector(".ag-msg-rich") || row.querySelector(".ag-msg-content") || row;
  const rowRect = row.getBoundingClientRect();
  const lineRect = line.getBoundingClientRect();
  const w = Math.max(40, lineRect.width);
  const h = Math.max(12, lineRect.height);
  const offsetX = Math.max(0, lineRect.left - rowRect.left);
  const offsetY = Math.max(0, lineRect.top - rowRect.top);
  const starW = 44;
  const angle = 6 + Math.random() * 12;
  const x0 = offsetX + 2;
  const x1 = offsetX + Math.max(starW + 1, Math.min(w - starW - 1, w * 0.62));
  const y0 = offsetY + 2 + Math.random() * Math.max(1, h * 0.18);
  const drop = Math.min(
    Math.max(2, h - 4),
    Math.abs(x1 - x0) * Math.tan((angle * Math.PI) / 180) * 0.3,
  );
  const y1 = Math.min(offsetY + h - 2, y0 + drop);
  const rot = `rotate(${angle.toFixed(1)}deg)`;
  el.animate(
    [
      { transform: `translate3d(${x0.toFixed(1)}px, ${y0.toFixed(1)}px, 0) ${rot}`, opacity: 0 },
      { opacity: 0.95, offset: 0.2 },
      { opacity: 0.85, offset: 0.7 },
      { transform: `translate3d(${x1.toFixed(1)}px, ${y1.toFixed(1)}px, 0) ${rot}`, opacity: 0 },
    ],
    { duration: 420 + Math.random() * 280, easing: "cubic-bezier(.2,.65,.3,1)" },
  );
}

function visibleFxTargets(selector) {
  const out = [];
  for (const el of document.querySelectorAll(selector)) {
    const row = el.parentElement;
    if (!row || row.classList.contains("flairQuiet")) continue;
    const rect = row.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) out.push(el);
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

function syncNativeChimeState() {
  const modal = document.querySelector(".ag-settings-modal");
  if (!modal) return;
  const row = [...modal.querySelectorAll(".ag-set-notif-row, .ag-set-toggle-card")].find((el) => {
    const title = el.querySelector(".ag-set-notif-row-title, .ag-set-toggle-title")?.textContent?.trim();
    return title === "Message chimes";
  });
  const input = row?.querySelector("input[type=checkbox]");
  if (!(input instanceof HTMLInputElement)) return;
  if (state.settings.sounds.messageEnabled !== input.checked) {
    state.settings.sounds.messageEnabled = input.checked;
    broadcastConfig();
    debounceSave();
  }
}

function flairTickerTick() {
  syncNativeChimeState();
  if (document.hidden || state.settings.studio.reduceMotion || state.settings.studio.renderInAgnostr === false) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const stars = visibleFxTargets(".flair-stars > .flairFx");
  if (stars.length && Math.random() < 0.13) shootStar(stars[Math.floor(Math.random() * stars.length)]);
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

function syncSettingsIntegration() {
  if (state.settings.enabled === false) return;
  const modal = document.querySelector(".ag-settings-modal");
  if (!modal) {
    state.settingsModalOpen = false;
    state.settingsBetterActive = false;
    state.aboutActive = false;
    return;
  }
  if (!state.settingsModalOpen) {
    state.settingsModalOpen = true;
    state.settingsBetterActive = false;
    state.aboutActive = false;
  }
  const nav = ensureBetterNav(modal);
  const aboutNav = ensureAboutNav(modal);
  if (!nav || !aboutNav) return;
  if (state.aboutActive) {
    for (const item of modal.querySelectorAll(".ag-set-nav-item")) item.classList.toggle("active", item === aboutNav);
    state.settingsBetterActive = false;
    hideBetterSettingsPane(modal);
    renderAboutPane(modal);
    return;
  }
  if (state.settingsBetterActive) {
    for (const item of modal.querySelectorAll(".ag-set-nav-item")) item.classList.toggle("active", item === nav);
    hideAboutPane(modal);
    renderBetterSettingsPane(modal);
    return;
  }
  nav.classList.remove("active");
  aboutNav.classList.remove("active");
  hideBetterSettingsPane(modal);
  hideAboutPane(modal);
  const title = modal.querySelector(".ag-set-detail-title")?.textContent?.trim();
  if (title === "Appearance") injectAppearanceExtras(modal);
  else if (title === "Privacy & Trust") injectNativePrivacy(modal);
  else if (title === "Notifications") injectNativeSounds(modal);
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
    const target = event.target;
    if (!(target instanceof Element)) return;
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
      const rowId = emojiTrigger.getAttribute("data-ba-row-id");
      if (rowId) {
        const ev = eventById(rowId);
        state.contextTarget = { id: rowId, event: ev, mention: ev ? eventHandle(ev) : "" };
      }
      openEmojiPicker(emojiTrigger, emojiTrigger.getAttribute("data-ba-emoji-trigger"));
      const nativePopover = emojiTrigger.closest(".ag-emoji-popover");
      if (nativePopover) {
        const actions = nativePopover.closest(".ag-msg-actions");
        const reactBtn = actions?.querySelector('[aria-label="Add reaction"]');
        state.suppressEmojiHide = true;
        reactBtn?.click();
        nativePopover.style.display = "none";
        actions?.classList.remove("picker-open");
      }
      return;
    }
    if (state.suppressEmojiHide) {
      state.suppressEmojiHide = false;
    } else if (!target.closest(".ba-emoji-popover") && !target.closest("[data-ba-emoji-trigger]")) {
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
      openProfileByNpub(angel.getAttribute("data-npub"), "Angel");
      return;
    }
    const action = target.closest("[data-ba-settings-action]")?.getAttribute("data-ba-settings-action");
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      handleSettingsAction(action);
      return;
    }
    const nav = target.closest(".ag-set-nav-item");
    if (nav && !nav.hasAttribute("data-ba-settings-nav") && !nav.hasAttribute("data-ba-about-nav")) {
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
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const nativeChimeRow = target.closest(".ag-set-notif-row, .ag-set-toggle-card");
    if (
      nativeChimeRow &&
      target.matches('input[type="checkbox"]') &&
      nativeChimeRow.textContent?.includes("Message chimes")
    ) {
      state.settings.sounds.messageEnabled = target.checked;
      broadcastConfig();
      debounceSave();
      return;
    }
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
        state.viewer.tab = viewerTab.getAttribute("data-viewer-tab");
        renderViewer();
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
      const tag = state.review.payload?.proposed?.tags?.[index];
      const name = tag?.[0];
      if (!name) return;
      if (target.checked) state.review.selected.add(name);
      else state.review.selected.delete(name);
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

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.review) finishReview("cancel");
      else if (state.customAction) closeActionModal();
      else if (state.viewer) closeViewer();
      else closePanel();
    }
  });
}

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
        askPage("verify", { event: state.viewer.event }).then((res) => {
          if (res) {
            state.verified.set(state.viewer.event.id, res);
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

function composerTextarea() {
  return document.querySelector(".ag-composer-input");
}

function insertInto(input, text) {
  if (!input) {
    toast("warning", "No target field", "Open a chat composer or the line-format field first.");
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
    fmt: state.settings.studio.enabled ? state.settings.studio.template : "",
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
    if (status.signerHooked) signer.textContent = `signer: ${status.signMode || "hooked"}`;
    else if (status.nip07Patched) signer.textContent = "signer: nip-07";
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
    if (status.signMode) parts.push(status.signMode);
    parts.push(status.signerHooked ? "signer linked" : "signer waiting");
    if (b()) parts.push(`glub ${b().slice(0, 7)}`);
    sub.textContent = parts.join(" · ");
  }
  const dot = root.querySelector("[data-role='header-dot']");
  if (dot) {
    dot.className = "ba-status-dot";
    if (status.signerHooked && b()) dot.classList.add("ok");
    else if (status.signerHooked || b()) dot.classList.add("warn");
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
  const map = { studio: "line", line: "line", client: "client", general: "general", theme: "general" };
  return map[tab] || "line";
}

function findNativeSettingsButton() {
  const candidates = [...document.querySelectorAll("button")].filter(
    (b) =>
      !b.closest(".ba-composer-bar") &&
      !b.hasAttribute("data-ba-settings-shortcut") &&
      !b.hasAttribute("data-ba-settings-opener") &&
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
    const signer = status.signerHooked ? `${status.signMode || "hooked"}` : status.nip07Patched ? "nip-07" : "waiting";
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

function scheduleEnhance() {
  if (state.enhanceTimer !== null) return;
  state.enhanceTimer = window.setTimeout(() => {
    state.enhanceTimer = null;
    enhanceAll();
  }, 90);
}

function replaceBitchatText() {
  if (!document.body) return;
  const blocked = ".ag-msg-rich, .ag-msg-content, .ag-chat-row-preview, .ag-msg-preview, .ag-conv-preview, .ag-composer, textarea, input, pre, code, script, style";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(blocked)) return NodeFilter.FILTER_REJECT;
      return /Bitchat/.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) node.nodeValue = (node.nodeValue || "").replace(/Bitchat/g, "Chat");
  for (const el of document.querySelectorAll("[title], [aria-label], [placeholder]")) {
    if (el.closest(blocked)) continue;
    for (const attr of ["title", "aria-label", "placeholder"]) {
      const value = el.getAttribute(attr);
      if (value && value.includes("Bitchat")) el.setAttribute(attr, value.replace(/Bitchat/g, "Chat"));
    }
  }
  if (document.title.includes("Bitchat")) document.title = document.title.replace(/Bitchat/g, "Chat");
}

function enhanceAll() {
  if (!document.body) return;
  removeCallMenuItems();
  applyCallButtons();
  hideCallUi();
  markLocateButtons();
  ensureHeaderButtons();
  ensureSuiteButton();
  ensureToolbars();
  ensureComposerEmoji();
  enhanceEmojiReactionPopover();
  decorateRows();
  enhanceContextMenu();
  markBetterClients();
  replaceBitchatText();
  if (document.querySelector(".ag-suite-popover")) positionSuitePopover();
}

function applyShortcutVisibility() {
  const show = state.settings.ui.showButton !== false;
  document.documentElement.classList.toggle("ba-hide-rail-shortcut", !show);
  for (const node of document.querySelectorAll("[data-ba-rail], .ba-rail-slot")) node.remove();
  ensureHeaderButtons();
  const fab = state.shadow?.querySelector(".ba-fab");
  if (fab) fab.style.display = show ? "" : "none";
}

function positionSuitePopover() {
  const pop = document.querySelector(".ag-suite-popover");
  const trigger = [...document.querySelectorAll("[data-ba-suite-trigger]")].find((el) => el.getClientRects().length);
  if (!pop || !trigger) return;
  const rect = trigger.getBoundingClientRect();
  const box = pop.getBoundingClientRect();
  const margin = 10;
  let left = rect.right - box.width;
  if (left < margin) left = rect.left;
  left = Math.max(margin, Math.min(left, window.innerWidth - box.width - margin));
  let top = rect.bottom + 8;
  if (top + box.height > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - box.height - margin);
  }
  pop.style.position = "fixed";
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
  pop.style.right = "auto";
  pop.style.bottom = "auto";
  pop.style.transform = "none";
}

function scheduleSuitePosition() {
  positionSuitePopover();
  window.requestAnimationFrame(positionSuitePopover);
  window.setTimeout(positionSuitePopover, 80);
  window.setTimeout(positionSuitePopover, 220);
}

function ensureHeaderButtons() {
  const visible = (el) => el instanceof HTMLElement && el.getClientRects().length > 0;
  const workspace = document.querySelector(".ag-app")?.dataset.workspace || "";
  let target = null;
  if (workspace === "agora") target = document.querySelector(".ag-agora-header-actions");
  else if (workspace === "mail") target = document.querySelector(".ag-amail-top-actions");
  else if (workspace === "wallet") target = document.querySelector(".ag-wallet-stage-header");
  if (!visible(target)) {
    for (const selector of [".ag-conv-header-actions", ".ag-agora-header-actions", ".ag-amail-top-actions", ".ag-wallet-stage-header"]) {
      target = [...document.querySelectorAll(selector)].find(visible) || null;
      if (target) break;
    }
  }
  if (target) {
    for (const trigger of document.querySelectorAll("[data-ba-suite-trigger]")) {
      if (!target.contains(trigger)) trigger.remove();
    }
    if (!target.querySelector("[data-ba-suite-trigger]")) {
      const suite = document.createElement("button");
      suite.type = "button";
      suite.className = "ag-circle-btn ba-suite-trigger";
      suite.setAttribute("data-ba-suite-trigger", "1");
      suite.title = "Agnostr Suite";
      suite.setAttribute("aria-label", "Agnostr Suite");
      suite.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg>';
      suite.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        document.querySelector(".ag-rail-brand")?.click();
        scheduleSuitePosition();
      });
      if (target.matches(".ag-wallet-stage-header, .ag-amail-top-actions")) target.append(suite);
      else target.prepend(suite);
    }
  }

  ensureFooterControls();
}

function ensureFooterControls() {
  const profile = document.querySelector(".ag-profile-bar-btn");
  if (!profile) return;
  const profileFooter = profile.closest(".ag-conv-footer");
  if (!profileFooter) return;
  const hiddenActions = profileFooter.querySelector(".ag-conv-footer-actions");
  if (hiddenActions) hiddenActions.style.display = "none";
  let controls = profileFooter.querySelector(":scope > .ba-footer-controls");
  if (!controls) {
    controls = document.createElement("div");
    controls.className = "ba-footer-controls";
    profile.after(controls);
  }
  let settings = controls.querySelector("[data-ba-settings-opener]");
  if (!settings) {
    settings = document.createElement("button");
    settings.type = "button";
    settings.className = "ag-circle-btn ag-dock-icon-btn ba-native-settings-btn";
    settings.setAttribute("data-ba-settings-opener", "1");
    settings.title = "Settings";
    settings.setAttribute("aria-label", "Settings");
    settings.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    settings.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openAgnostrSettings("Profile");
    });
    controls.append(settings);
  }
  let shortcut = controls.querySelector("[data-ba-settings-shortcut]");
  const show = state.settings.ui.showButton !== false;
  if (!show) {
    shortcut?.remove();
    return;
  }
  if (!shortcut) {
    shortcut = document.createElement("button");
    shortcut.type = "button";
    shortcut.className = "ag-circle-btn ag-dock-icon-btn ba-settings-shortcut";
    shortcut.setAttribute("data-ba-settings-shortcut", "1");
    shortcut.title = "Better Agnostr settings";
    shortcut.setAttribute("aria-label", "Better Agnostr settings");
    shortcut.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z"/></svg>';
    shortcut.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openBetterSettings(state.betterTab || "line");
    });
    controls.append(shortcut);
  }
  for (const old of document.querySelectorAll("[data-ba-settings-shortcut]")) {
    if (!controls.contains(old)) old.remove();
  }
}

function ensureSuiteButton() {
  const footer = document.querySelector(".ag-suite-footer");
  for (const old of document.querySelectorAll("[data-ba-suite-better]")) old.remove();
  for (const btn of document.querySelectorAll(".ag-suite-util-btn")) {
    if (btn.hasAttribute("data-ba-suite-better")) {
      btn.remove();
      continue;
    }
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
  const prev = footer.previousElementSibling;
  if (prev?.classList.contains("ag-suite-divider")) prev.style.removeProperty("display");
  if (document.querySelector(".ag-suite-popover")) scheduleSuitePosition();
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
  state.emojiTarget = null;
}

function positionEmojiPicker(anchor) {
  const pop = emojiPicker();
  pop.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const box = pop.getBoundingClientRect();
  const margin = 10;
  let left = Math.min(rect.left, window.innerWidth - box.width - margin);
  left = Math.max(margin, left);
  let top = rect.bottom + 7;
  if (top + box.height > window.innerHeight - margin) top = Math.max(margin, rect.top - box.height - 7);
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

function openEmojiPicker(anchor, target) {
  state.emojiTarget = target;
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
  positionEmojiPicker(anchor);
}

function insertEmoji(emoji) {
  const target = state.emojiTarget;
  if (target === "composer") {
    insertInto(composerTextarea(), emoji);
  } else if (target === "reaction") {
    const context = state.contextTarget;
    if (!context?.id) {
      toast("warning", "No message target", "Right-click a message first.");
      return;
    }
    sendPage("react", {
      id: context.id,
      pubkey: context.event?.pubkey || "",
      geohash: getTagValue(context.event?.tags, "g") || "",
      emoji,
    });
    closeContextMenu();
  }
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
    button.title = "Insert emoji";
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" x2="9.01" y1="9" y2="9"></line><line x1="15" x2="15.01" y1="9" y2="9"></line></svg>';
    const voice = right.querySelector('button[aria-label="Record voice memo"], button[title="Record voice memo"]');
    if (voice) voice.before(button);
    else right.prepend(button);
  }
}

function applyVoiceMemoVisibility() {
  const show = state.settings.ui.showVoiceMemo !== false;
  for (const btn of document.querySelectorAll(
    '.ag-composer-dock button[aria-label="Record voice memo"], .ag-composer-dock button[title="Record voice memo"]',
  )) {
    btn.style.display = show ? "" : "none";
  }
}

function ensureToolbars() {
  applyVoiceMemoVisibility();
  for (const dock of document.querySelectorAll(".ag-composer-dock")) {
    for (const old of dock.querySelectorAll(":scope > .ba-composer-bar")) old.remove();
    let head = dock.querySelector(":scope > .ba-composer-head");
    if (!head) {
      head = document.createElement("div");
      head.className = "ba-composer-head";
      head.innerHTML = `
        <button type="button" class="ba-composer-toggle" data-ba-format-toggle="1" title="Formatting" aria-label="Toggle formatting bar">Aa</button>
        <div class="ba-composer-bar">
          <button type="button" data-code="&l" title="Bold">B</button>
          <button type="button" data-code="&o" title="Italic" style="font-style:italic">I</button>
          <button type="button" data-code="&n" title="Underline" style="text-decoration:underline">U</button>
          <button type="button" data-code="&m" title="Strikethrough" style="text-decoration:line-through">S</button>
          <button type="button" data-code="&k" title="Obfuscate">K</button>
          <button type="button" data-code="&g" title="Rainbow">G</button>
          <button type="button" data-code="&r" title="Reset">R</button>
          <button type="button" class="ba-color-toggle" data-action="toggle-colors" title="Colors" aria-label="Colors"></button>
          <div class="ba-color-popover" hidden>
            ${Object.entries(COLORS)
              .map(
                ([code, value]) =>
                  `<button type="button" data-color="${code}" title="&amp;${code} · ${COLOR_NAMES[code]}" style="background:${value}"></button>`,
              )
              .join("")}
          </div>
        </div>`;
      head.addEventListener("mousedown", (event) => {
        if (event.target.closest("button")) event.preventDefault();
      });
      dock.prepend(head);
    }
    const bar = head.querySelector(".ba-composer-bar");
    if (bar) bar.hidden = state.settings.studio.showComposerToolbar === false;
  }
}

function enhanceEmojiReactionPopover() {
  for (const pop of document.querySelectorAll(".ag-emoji-popover")) {
    if (pop.querySelector("[data-ba-emoji-trigger='reaction']")) continue;
    const actions = pop.closest(".ag-msg-actions");
    const row = actions?.closest(".ag-msg-row");
    const id = row?.id?.startsWith("msg-") ? row.id.slice(4) : "";
    const more = document.createElement("button");
    more.type = "button";
    more.className = "ag-emoji-more ba-emoji-more";
    more.setAttribute("data-ba-emoji-trigger", "reaction");
    more.setAttribute("data-ba-row-id", id);
    more.setAttribute("aria-label", "More reactions");
    more.title = "More reactions";
    more.textContent = "＋";
    pop.appendChild(more);
  }
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
    decorateRow(row, ev);
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
    openViewer(id, "json");
  });
  if (actions) actions.prepend(button);
  else row.appendChild(button);
}

function eventHandle(ev) {
  const name = getTagValue(ev.tags, "n") || `agnon${String(ev.pubkey || "").slice(-4)}`;
  return `@${String(name).toLowerCase()}#${String(ev.pubkey || "").slice(-4).toLowerCase()}`;
}

function isBetterClient(ev) {
  const client = String(getTagValue(ev.tags, "client") || "").trim();
  return /^(betteragnostr|better-agnostr|better agnostr)$/i.test(client);
}

function markRowAvatar(row, better) {
  if (!(row instanceof HTMLElement)) return;
  row.classList.toggle("ba-better-client", better);
  for (const img of row.querySelectorAll(".ag-stream-avatar, .ag-msg-avatar-btn img, .ag-profile-avatar")) {
    img.classList.toggle("ag-avatar-better", better);
  }
}

function markBetterClients() {
  const ownPubkey = String(state.status?.pubkey || "").toLowerCase();
  const ownBetter =
    state.settings.client.name.trim().toLowerCase() === "betteragnostr" &&
    state.settings.client.policies.chat === "spoof";
  for (const row of document.querySelectorAll(".ag-users-row")) {
    const handle = row.querySelector(".ag-users-name")?.textContent?.trim().toLowerCase() || "";
    const known = handle && [...state.betterPeers.values()].includes(handle);
    const own = handle.includes(`#${ownPubkey.slice(-4)}`);
    const better = (known || (own && ownBetter));
    for (const img of row.querySelectorAll(".ag-users-avatar, img")) img.classList.toggle("ag-avatar-better", better);
  }
  if (ownBetter) {
    for (const img of document.querySelectorAll(".ag-conv-footer .ag-profile-avatar, .ag-set-profile-hero .ag-set-avatar-lg")) {
      img.classList.add("ag-avatar-better");
    }
  }
}

function decorateRow(row, ev) {
  const meta = parseGlubMeta(ev.tags);
  const hasGlub = !!(meta.rich || meta.fmt || meta.flair || meta.v) || getTagValue(ev.tags, "client")?.toLowerCase() === "glub.chat";
  const better = isBetterClient(ev);
  if (better && ev.pubkey) state.betterPeers.set(ev.pubkey.toLowerCase(), eventHandle(ev));
  markRowAvatar(row, better);

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
  return Object.keys(out).length ? out : null;
}

function applyLineClasses(el, prefix, vis, row) {
  if (!el) return;
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
  if (!vis) return;
  const ns = prefix === "ba-line-name" ? "name" : "msg";
  if (vis.color) row.style.setProperty(`--ba-line-${ns}-color`, vis.color);
  else row.style.removeProperty(`--ba-line-${ns}-color`);
  if (vis.underline || vis.strike) {
    const deco = [vis.underline ? "underline" : "", vis.strike ? "line-through" : ""].filter(Boolean).join(" ");
    row.style.setProperty(`--ba-line-${ns}-deco`, deco);
  } else {
    row.style.removeProperty(`--ba-line-${ns}-deco`);
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
}

function flairStyleVars(vars) {
  return Object.entries(vars || {})
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

function applyFlair(row, ev, flair) {
  if (!isValidFlair(flair)) {
    clearFlair(row);
    return;
  }
  const layer = row.querySelector(":scope > .ba-flair-layer");
  const hasFx = !flairHasFx(flair) || !!layer?.querySelector(":scope > .flairFx");
  const hasScan = !flairOverlayInner(flair) || !!layer?.querySelector(":scope > .flairScan");
  const vars = flairVars(flair);
  const hasVars = Object.keys(vars).every((k) => row.style.getPropertyValue(k));
  const quiet = !!state.settings.studio.reduceMotion;
  if (row.dataset.baFlair === flair && row.classList.contains("flair") && layer && hasFx && hasScan && hasVars) {
    row.classList.toggle("flairQuiet", quiet);
    layer.classList.toggle("flairQuiet", quiet);
    return;
  }
  clearFlair(row);
  const classes = flairClass(flair).split(" ").filter(Boolean);
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

function applyRichText(row, ev, meta) {
  const root = row.querySelector(".ag-msg-rich");
  if (!root) return;
  const previous = state.richApplied.get(root);
  if (previous && previous.id === ev.id && previous.html === root.innerHTML) return;
  const rich = meta.rich;
  if (!rich || typeof rich !== "string") return;
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
    state.richApplied.set(root, { id: ev.id, html: root.innerHTML });
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
    state.richApplied.set(root, { id: ev.id, html: root.innerHTML });
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
  state.richApplied.delete(root);
  if (!root.dataset.baRich) return;
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
  let ev = eventById(id);
  if (!ev && state.pageReady) {
    const res = await askPage("getEvent", { id });
    if (res?.event) {
      ev = res.event;
      rememberEvent(ev);
    }
  }
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
  const wrap = state.shadow?.querySelector("[data-modal='viewer']");
  wrap?.classList.add("is-open");
  wrap?.setAttribute("aria-hidden", "false");
}

function closeViewer() {
  const wrap = state.shadow?.querySelector("[data-modal='viewer']");
  wrap?.classList.remove("is-open");
  wrap?.setAttribute("aria-hidden", "true");
  state.viewer = null;
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
        `<button type="button" class="ba-modal-tab${id === tab ? " is-active" : ""}" data-viewer-tab="${id}">${label}</button>`,
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
    const rows = state.logs
      .filter((log) => log.eventId === event.id)
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
    <div class="ba-modal-tabs">${tabButtons}</div>
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
  state.reviewQueue.push({ payload, requestId });
  if (!state.review) openNextReview();
}

function openNextReview() {
  const next = state.reviewQueue.shift();
  if (!next) return;
  state.review = { ...next, selected: new Set(), timer: null };
  renderReview();
  const wrap = state.shadow?.querySelector("[data-modal='review']");
  wrap?.classList.add("is-open");
  wrap?.setAttribute("aria-hidden", "false");
  state.review.timer = window.setTimeout(() => finishReview("cancel"), 170000);
}

function finishReview(action, scrub = false) {
  if (!state.review) return;
  const review = state.review;
  window.clearTimeout(review.timer);
  const payload =
    action === "send"
      ? { action: "send", stripTags: scrub ? [...review.selected] : [] }
      : { action: "cancel" };
  sendPage("response", payload, review.requestId);
  state.review = null;
  const wrap = state.shadow?.querySelector("[data-modal='review']");
  wrap?.classList.remove("is-open");
  wrap?.setAttribute("aria-hidden", "true");
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
    const value = tag?.slice(1).join(" ").slice(0, 90) || "";
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
        <div class="ba-modal-sub">${h(payload.group || kindGroup(proposed.kind))} · check a tag to remove it before signing</div>
      </div>
      <div class="ba-modal-space"></div>
      <button type="button" class="ba-icon-btn" data-action="review-cancel" aria-label="Cancel">✕</button>
    </div>
    <div class="ba-modal-body">
      <div class="ba-warning">This event is paused before signing. Nothing has left your client yet.</div>
      <div class="ba-meta-grid">
        <div class="ba-meta-cell"><div class="ba-meta-k">kind</div><div class="ba-meta-v">${h(proposed.kind)} · ${h(kindLabel(proposed.kind))}</div></div>
        <div class="ba-meta-cell"><div class="ba-meta-k">content</div><div class="ba-meta-v">${h(String(proposed.content || "").slice(0, 80))}</div></div>
        <div class="ba-meta-cell"><div class="ba-meta-k">source</div><div class="ba-meta-v">${h(payload.source || "signer")}</div></div>
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
    const target = event.target;
    if (!(target instanceof Element)) return;
    const bar = target.closest(".ba-composer-bar");
    if (!bar) return;
    const colorToggle = target.closest("[data-action='toggle-colors']");
    if (colorToggle) {
      event.preventDefault();
      event.stopPropagation();
      const pop = bar.querySelector(".ba-color-popover");
      if (pop) pop.hidden = !pop.hidden;
      return;
    }
    const codeBtn = target.closest("[data-code]");
    if (codeBtn) {
      event.preventDefault();
      event.stopPropagation();
      insertInto(composerTextarea(), codeBtn.getAttribute("data-code") || "");
      return;
    }
    const color = target.closest("[data-color]");
    if (color) {
      event.preventDefault();
      event.stopPropagation();
      insertInto(composerTextarea(), `&${color.getAttribute("data-color")}`);
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
  const make = (kind, icon, label, title) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ag-ctx-item";
    btn.setAttribute("data-ba-action", kind);
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
  const reactions = menu.querySelector(".ag-ctx-reactions");
  if (reactions && !reactions.querySelector("[data-ba-emoji-trigger='reaction']")) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "ag-ctx-react-btn ba-emoji-more";
    more.setAttribute("data-ba-emoji-trigger", "reaction");
    more.setAttribute("aria-label", "More reactions");
    more.title = "More reactions";
    more.textContent = "＋";
    reactions.append(more);
  }
  const divider = document.createElement("div");
  divider.className = "ag-ctx-divider";
  divider.setAttribute("data-ba-actions", "1");
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
  const ta = document.querySelector(".ag-composer-input");
  if (!(ta instanceof HTMLTextAreaElement) || ta.disabled) {
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
  let tries = 0;
  const send = () => {
    const btn = document.querySelector(".ag-composer-send-btn");
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
  if (sendComposerText(text)) closePanel();
}

function formatActionText(raw, mention) {
  const cleaned = String(raw || "").replace(/^\*+|\*+$/g, "").trim();
  if (!cleaned) return "";
  const core = cleaned.includes("{user}") ? cleaned.replace(/\{user\}/g, mention) : `${cleaned} ${mention}`;
  return `* ${core} *`;
}

function closeActionModal() {
  const wrap = state.shadow?.querySelector("[data-modal='action']");
  wrap?.classList.remove("is-open");
  wrap?.setAttribute("aria-hidden", "true");
  state.customAction = null;
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
      <div class="ba-hint" style="margin-top:5px">Use <code class="ba-code">{user}</code> in your text, or it is appended automatically.</div>
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
    const preview = formatActionText(raw, mention);
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
  state.customAction = { text: state.settings.actions.custom || "boops" };
  renderCustomAction();
  const wrap = state.shadow?.querySelector("[data-modal='action']");
  wrap?.classList.add("is-open");
  wrap?.setAttribute("aria-hidden", "false");
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
  const body = formatActionText(raw, target.mention);
  if (!body) return;
  closeActionModal();
  if (sendComposerText(body)) closePanel();
}

document.addEventListener("contextmenu", captureContextTarget, true);
document.addEventListener(
  "click",
  (event) => {
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

function toast(level, title, detail = "") {
  const root = state.shadow;
  if (!root) return;
  const container = root.querySelector("[data-role='toasts']");
  if (!container) return;
  const node = document.createElement("div");
  node.className = `ba-toast ${level}`;
  node.innerHTML = `<div><div class="ba-toast-title">${h(title)}</div>${detail ? `<div class="ba-toast-detail">${h(detail)}</div>` : ""}</div>`;
  container.appendChild(node);
  const timer = window.setTimeout(() => {
    node.remove();
    state.toasts.delete(timer);
  }, level === "error" ? 7000 : 4200);
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
  const extensionVersion = api.runtime.getManifest?.().version || "1.0.1";
  el.innerHTML = `
    <div class="ba-kv"><span>extension</span><span>${h(extensionVersion)}</span></div>
    <div class="ba-kv"><span>page bridge</span><span>${state.pageReady ? "ready" : "waiting"}</span></div>
    <div class="ba-kv"><span>sign mode</span><span>${h(status.signMode || "unknown")}</span></div>
    <div class="ba-kv"><span>signer hooked</span><span>${status.signerHooked ? "yes" : "no"}</span></div>
    <div class="ba-kv"><span>nip-07 wrapper</span><span>${status.nip07Patched ? "yes" : "no"}</span></div>
    <div class="ba-kv"><span>pubkey</span><span>${h(short(status.pubkey || "", 20))}</span></div>
    <div class="ba-kv"><span>glub build</span><span>${h(effectiveBuild(state.settings) || "missing")}</span></div>
    <div class="ba-kv"><span>events in memory</span><span>${state.events.size}</span></div>
    <div class="ba-kv"><span>relay frames</span><span>${state.logs.length}</span></div>
    <div class="ba-kv"><span>review queue</span><span>${state.reviewQueue.length}</span></div>`;
}

function copyDiagnostics() {
  const status = state.status || {};
  const text = [
    `Better Agnostr ${api.runtime.getManifest?.().version || "1.0.1"}`, 
    `url: ${location.href}`,
    `page bridge: ${state.pageReady}`,
    `sign mode: ${status.signMode}`,
    `signer hooked: ${status.signerHooked}`,
    `nip07 wrapped: ${status.nip07Patched}`,
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
  const observer = new MutationObserver(() => {
    scheduleEnhance();
    scheduleSettingsSync();
    if (state.settings.privacy.calls.disable && state.settings.privacy.calls.hideUi) removeCallMenuItems();
  });
  try {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  } catch {}
  scheduleEnhance();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  try {
    const stored = await api.storage.local.get(STORAGE_KEY);
    state.settings = normalizeSettings(stored?.[STORAGE_KEY] || {});
  } catch {
    state.settings = normalizeSettings({});
  }
  state.activeTab = state.settings.ui.activeTab || "studio";
  state.betterTab = state.settings.ui.betterTab || "line";
  state.settings.ui.panelOpen = false;

  window.addEventListener("message", handlePageMessage);
  document.addEventListener("ba-page", handlePageCustomEvent);
  if (state.settings.enabled === false) {
    hello();
    return;
  }
  document.addEventListener("pointerdown", () => {
    if (!state.soundUnlocked) {
      state.soundUnlocked = true;
      unlockAudio();
    }
  }, { capture: true, passive: true });
  document.addEventListener("click", handleGlobalClickSound, true);
  window.setInterval(tickObfuscation, 70);
  window.setInterval(flairTickerTick, 1500);
  ensureHost();
  observePage();
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
