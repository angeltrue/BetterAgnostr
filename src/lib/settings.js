import { FMT_MAX, kindGroup } from "./glub.js";
import { flairName } from "./glub-flair.js";
import { GLUB_THEMES } from "./themes.js";
import { CLICK_SOUNDS, MESSAGE_SOUNDS } from "./sounds.js";

export const STORAGE_KEY = "betterAgnostr.settings.v1";

export const KIND_POLICIES = ["leave", "spoof", "strip"];

export const DEFAULT_SETTINGS = {
  schema: 4,
  enabled: true,
  studio: {
    enabled: true,
    template: "&b&l<{name}> &r{msg}",
    flair: "aurora",
    applyRich: true,
    showComposerToolbar: false,
    renderInAgnostr: true,
    renderRichInAgnostr: true,
    reduceMotion: false,
    rainbowStyle: "glub",
  },
  client: {
    name: "BetterAgnostr",
    policies: {
      chat: "spoof",
      note: "leave",
      reaction: "leave",
      dm: "leave",
      profile: "leave",
      other: "leave",
    },
  },
  privacy: {
    stripTags: [],
    stripTracking: true,
    hideLocate: true,
    hideTimestamps: false,
    omitTeleport: true,
    removeVoiceMemo: true,
    reviewEnabled: false,
    reviewGroups: ["chat"],
    calls: {
      disable: true,
      hideUi: true,
      blockSignals: true,
      blockOutgoing: true,
    },
  },
  theme: {
    preset: "agnostr",
    customCss: "",
  },
  appearance: {
    hideNotificationButton: false,
  },
  sounds: {
    message: "macintosh",
    click: "model-m",
    volume: 0.55,
    messageEnabled: true,
    clickEnabled: true,
    events: {
      chat: true,
      mentionOnly: false,
      dm: true,
      calls: true,
    },
  },
  font: {
    family: "default",
    customFamily: "",
    customUrl: "",
  },
  actions: {
    custom: "boops",
  },
  glub: {
    build: "",
    buildFetchedAt: 0,
    manualBuild: "",
    autoSync: true,
  },
  inspector: {
    paused: false,
    maxEvents: 1500,
  },
  ui: {
    activeTab: "studio",
    betterTab: "line",
    firstRun: true,
    panelOpen: false,
  },
};

export const STRIPPABLE_TAGS = [
  { name: "client", label: "client", detail: "which app sent the event" },
  { name: "n", label: "n (nickname)", detail: "the display name attached to chat messages" },
  { name: "lud16", label: "lud16", detail: "your lightning address" },
  { name: "t", label: "t (topic)", detail: "teleport and other topic markers" },
  { name: "expiration", label: "expiration", detail: "the event's self-delete time" },
  { name: "nonce", label: "nonce", detail: "proof-of-work nonce and target" },
  { name: "emoji", label: "emoji", detail: "custom emoji declarations" },
  { name: "r", label: "r (reference)", detail: "external URL references" },
];

const PRESET_IDS = new Set(["agnostr", ...GLUB_THEMES.map((t) => t.id)]);
const MESSAGE_IDS = new Set(MESSAGE_SOUNDS.map((s) => s.id));
const CLICK_IDS = new Set(CLICK_SOUNDS.map((s) => s.id));

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function section(value, fallback) {
  return isObject(value) ? value : clone(fallback);
}

export function mergeSettings(base, patch) {
  if (!isObject(base)) return clone(patch);
  const out = clone(base);
  if (!isObject(patch)) return out;
  for (const [key, value] of Object.entries(patch)) {
    if (isObject(value) && isObject(out[key])) out[key] = mergeSettings(out[key], value);
    else out[key] = value;
  }
  return out;
}

export function normalizeSettings(raw) {
  const source = isObject(raw) ? raw : {};
  const legacyClient = typeof source.schema !== "number" || source.schema < 2;
  const legacyToolbar = typeof source.schema !== "number" || source.schema < 3;
  const legacyPrivacy = typeof source.schema !== "number" || source.schema < 4;
  const s = mergeSettings(DEFAULT_SETTINGS, source);

  // Storage is user-writable and can be left behind by older versions. Never let
  // a primitive or null section reach the field normalizers below.
  for (const key of ["studio", "client", "privacy", "theme", "appearance", "sounds", "font", "actions", "glub", "inspector", "ui"]) {
    s[key] = section(s[key], DEFAULT_SETTINGS[key]);
  }
  s.client.policies = section(s.client.policies, DEFAULT_SETTINGS.client.policies);
  s.privacy.calls = section(s.privacy.calls, DEFAULT_SETTINGS.privacy.calls);
  s.sounds.events = section(s.sounds.events, DEFAULT_SETTINGS.sounds.events);

  if (legacyClient && s.client.name === "glub.chat") s.client.name = "BetterAgnostr";
  if (legacyToolbar) s.studio.showComposerToolbar = false;
  if (legacyPrivacy) s.privacy.omitTeleport = true;
  s.schema = 4;
  s.enabled = s.enabled !== false;

  // studio
  s.studio.enabled = s.studio.enabled !== false;
  s.studio.applyRich = s.studio.applyRich !== false;
  s.studio.showComposerToolbar = s.studio.showComposerToolbar !== false;
  s.studio.renderInAgnostr = s.studio.renderInAgnostr !== false;
  s.studio.renderRichInAgnostr = s.studio.renderRichInAgnostr !== false;
  s.studio.reduceMotion = s.studio.reduceMotion === true;
  s.studio.rainbowStyle = s.studio.rainbowStyle === "bright" ? "bright" : "glub";
  s.studio.template = String(s.studio.template || "").replace(/[\r\n\t]+/g, " ").slice(0, FMT_MAX);
  s.studio.flair = flairName(s.studio.flair);

  // client
  s.client.name = String(s.client.name || "").trim().slice(0, 64);
  if (!s.client.policies || typeof s.client.policies !== "object") s.client.policies = {};
  for (const group of ["chat", "note", "reaction", "dm", "profile", "other"]) {
    if (!KIND_POLICIES.includes(s.client.policies[group])) s.client.policies[group] = "leave";
  }

  // privacy
  if (!Array.isArray(s.privacy.stripTags)) s.privacy.stripTags = [];
  s.privacy.stripTags = [...new Set(s.privacy.stripTags.filter((t) => typeof t === "string" && /^[a-zA-Z0-9_-]+$/.test(t)))];
  s.privacy.stripTracking = s.privacy.stripTracking !== false;
  s.privacy.hideLocate = s.privacy.hideLocate !== false;
  s.privacy.hideTimestamps = s.privacy.hideTimestamps === true;
  s.privacy.omitTeleport = s.privacy.omitTeleport === true;
  s.privacy.removeVoiceMemo = s.privacy.removeVoiceMemo !== false;
  s.privacy.reviewEnabled = s.privacy.reviewEnabled === true;
  if (!Array.isArray(s.privacy.reviewGroups)) s.privacy.reviewGroups = [];
  s.privacy.reviewGroups = [...new Set(s.privacy.reviewGroups.filter((g) => ["chat", "note", "reaction", "dm", "profile", "other"].includes(g)))];
  const calls = s.privacy.calls || {};
  s.privacy.calls = {
    disable: calls.disable !== false,
    hideUi: calls.hideUi !== false,
    blockSignals: calls.blockSignals !== false,
    blockOutgoing: calls.blockOutgoing !== false,
  };

  // glub
  s.glub.build = String(s.glub.build || "").trim().slice(0, 64);
  s.glub.manualBuild = String(s.glub.manualBuild || "").trim().slice(0, 64);
  if (s.glub.manualBuild && !/^[a-zA-Z0-9._-]{3,64}$/.test(s.glub.manualBuild)) s.glub.manualBuild = "";
  s.glub.buildFetchedAt = Number.isFinite(s.glub.buildFetchedAt) ? s.glub.buildFetchedAt : 0;
  s.glub.autoSync = s.glub.autoSync !== false;

  // theme / appearance
  if (!PRESET_IDS.has(s.theme.preset)) s.theme.preset = "agnostr";
  s.theme.customCss = String(s.theme.customCss || "").slice(0, 40000);
  if (!s.appearance || typeof s.appearance !== "object") s.appearance = {};
  s.appearance.hideNotificationButton = s.appearance.hideNotificationButton === true;

  // sounds
  s.sounds.message = MESSAGE_IDS.has(s.sounds.message) ? s.sounds.message : "macintosh";
  s.sounds.click = CLICK_IDS.has(s.sounds.click) ? s.sounds.click : "model-m";
  {
    const volume = Number(s.sounds.volume);
    s.sounds.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.55;
  }
  s.sounds.messageEnabled = s.sounds.messageEnabled !== false;
  s.sounds.clickEnabled = s.sounds.clickEnabled !== false;
  if (!s.sounds.events || typeof s.sounds.events !== "object") s.sounds.events = {};
  s.sounds.events.chat = s.sounds.events.chat !== false;
  s.sounds.events.mentionOnly = s.sounds.events.mentionOnly === true;
  s.sounds.events.dm = s.sounds.events.dm !== false;
  s.sounds.events.calls = s.sounds.events.calls === true;

  // fonts
  const fontIds = new Set([
    "default", "inter", "jetbrains", "plex", "atkinson", "lexend",
    "source-serif", "plex-serif", "merriweather", "crimson", "spectral", "noto-serif", "baskerville",
    "noto", "source", "fira", "ubuntu", "custom",
  ]);
  s.font.family = fontIds.has(s.font.family) ? s.font.family : "default";
  s.font.customFamily = String(s.font.customFamily || "").trim().slice(0, 80);
  s.font.customUrl = String(s.font.customUrl || "").trim().slice(0, 500);
  s.actions.custom = String(s.actions.custom || "boops").trim().slice(0, 60) || "boops";

  // inspector
  s.inspector.maxEvents = Math.max(100, Math.min(5000, Number(s.inspector.maxEvents) || 1500));
  s.inspector.paused = s.inspector.paused === true;

  // ui
  s.ui.firstRun = s.ui.firstRun === true;
  s.ui.panelOpen = s.ui.panelOpen === true;
  delete s.ui.showVoiceMemo;
  if (!["studio", "relay", "help"].includes(s.ui.activeTab)) s.ui.activeTab = "studio";
  if (!["line", "client"].includes(s.ui.betterTab)) s.ui.betterTab = "line";

  return s;
}

export function effectiveBuild(settings) {
  return settings?.glub?.manualBuild || settings?.glub?.build || "";
}

export function policyForKind(settings, kind) {
  const group = kindGroup(kind);
  return settings?.client?.policies?.[group] || "leave";
}

export function isReviewKind(settings, kind) {
  if (!settings?.privacy?.reviewEnabled) return false;
  return settings.privacy.reviewGroups.includes(kindGroup(kind));
}
