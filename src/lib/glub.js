// Glub.chat wire compatibility helpers.
//
// Glub stores its own metadata in a single `glub` tag with key/value pairs:
//   ["glub", "rich", "...", "fmt", "...", "flair", "...", "v", "<build>"]
//
// The `v` field is a build gate: glub.chat only renders glub metadata whose build
// matches the build currently served by glub.chat. If we stamp a stale build the
// whole event is dropped, so callers must pass the live build.

export const GLUB_TAG = "glub";
export const GLUB_VERSION_FIELD = "v";
export const GLUB_CLIENT_TAG = "glub.chat";

export const CHAT_KINDS = new Set([20000, 23333]);
export const NOTE_KINDS = new Set([1]);

export const COLORS = {
  "0": "#48484f",
  "1": "#4a5bd6",
  "2": "#3fb950",
  "3": "#2dd4bf",
  "4": "#e5484d",
  "5": "#c74ddb",
  "6": "#f0a020",
  "7": "#a0a0a8",
  "8": "#6e6e78",
  "9": "#5b8dff",
  a: "#55ff77",
  b: "#55ffff",
  c: "#ff6a6a",
  d: "#ff77ff",
  e: "#ffe45e",
  f: "#ffffff",
};

export const COLOR_NAMES = {
  "0": "black",
  "1": "dark blue",
  "2": "dark green",
  "3": "dark aqua",
  "4": "dark red",
  "5": "dark purple",
  "6": "gold",
  "7": "gray",
  "8": "dark gray",
  "9": "blue",
  a: "green",
  b: "aqua",
  c: "red",
  d: "light purple",
  e: "yellow",
  f: "white",
};

const FORMATS = new Set(["l", "m", "n", "o"]);
const OBFUSCATE = "k";
const RAINBOW = "g";
const RESET = "r";

export const FMT_MAX = 200;
export const RICH_MAX = 8000;

export const FLAIRS = [
  { name: "fire", label: "fire", description: "rising embers and a warm glow" },
  { name: "lightning", label: "lightning", description: "electric arcs across the line" },
  { name: "stars", label: "stars", description: "a slow twinkling starfield" },
  { name: "rain", label: "rain", description: "falling drops and a cool wash" },
  { name: "plume", label: "plume", description: "soft smoke plumes drifting upward" },
  { name: "neon", label: "neon", description: "a pulsing neon frame" },
  { name: "matrix", label: "matrix", description: "falling green glyph columns" },
  { name: "sonar", label: "sonar", description: "expanding radar rings" },
  { name: "fireflies", label: "fireflies", description: "drifting glowing motes" },
  { name: "bubbles", label: "bubbles", description: "bright bubbles floating up" },
  { name: "aurora", label: "aurora", description: "flowing polar light" },
  { name: "bitcoin", label: "bitcoin", description: "orange coins and sparks" },
  { name: "glitch", label: "glitch", description: "RGB tears and screen noise" },
  { name: "sol", label: "sol", description: "golden solar rays (glub.chat NIP-05 only)", gated: true },
];

export const FLAIR_NAMES = new Set(FLAIRS.map((f) => f.name));

export const TEMPLATE_PRESETS = [
  { label: "Classic", value: "&l{name}&7{tag}&f: {msg}" },
  { label: "Brackets", value: "&b[cool]&f<{name}&7{tag}&f> &b» &g{msg}" },
  { label: "Bold name", value: "&b&l<{name}> &r{msg}" },
  { label: "Neon", value: "&d▸ &f{name}&8{tag} &d:: &f{msg}" },
  { label: "Rainbow", value: "&g{name}&f{tag} &7» &f{msg}" },
  { label: "Terminal", value: "&a{name}&8@&a{tag}&7 > &f{msg}" },
  { label: "Minimal", value: "&7{name}&8{tag} &f{msg}" },
];

export const SNIPPETS = [
  { label: "rainbow", value: "&g" },
  { label: "bold", value: "&l" },
  { label: "italic", value: "&o" },
  { label: "underline", value: "&n" },
  { label: "strike", value: "&m" },
  { label: "obfuscate", value: "&k" },
  { label: "reset", value: "&r" },
];

function isCodeChar(ch) {
  return (
    Object.prototype.hasOwnProperty.call(COLORS, ch) ||
    FORMATS.has(ch) ||
    ch === OBFUSCATE ||
    ch === RAINBOW ||
    ch === RESET
  );
}

export function tokenize(raw) {
  const s = String(raw || "");
  const tokens = [];
  let text = "";
  const flush = () => {
    if (text) {
      tokens.push({ t: "text", v: text });
      text = "";
    }
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "&" && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === "&") {
        text += "&";
        i += 2;
        continue;
      }
      if (isCodeChar(next)) {
        flush();
        tokens.push({ t: "code", c: next });
        i += 2;
        continue;
      }
    }
    text += ch;
    i++;
  }
  flush();
  return tokens;
}

export function stripFormat(raw) {
  let out = "";
  for (const tok of tokenize(raw)) if (tok.t === "text") out += tok.v;
  return out;
}

export function hasFormat(raw) {
  return stripFormat(raw) !== String(raw || "");
}

const BLANK = {
  color: null,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  obf: false,
  rainbow: false,
};

function applyCode(state, c) {
  if (c === RESET) return { ...BLANK };
  if (Object.prototype.hasOwnProperty.call(COLORS, c)) {
    return { ...BLANK, color: COLORS[c] };
  }
  const next = { ...state };
  if (c === "l") next.bold = true;
  else if (c === "o") next.italic = true;
  else if (c === "n") next.underline = true;
  else if (c === "m") next.strike = true;
  else if (c === OBFUSCATE) next.obf = true;
  else if (c === RAINBOW) {
    next.rainbow = true;
    next.color = null;
  }
  return next;
}

export function stateStyle(state) {
  let style = "";
  if (!state.rainbow && state.color) style += `color:${state.color};-webkit-text-fill-color:${state.color};`;
  if (state.bold) style += "font-weight:700;";
  if (state.italic) style += "font-style:italic;";
  const deco = [];
  if (state.underline) deco.push("underline");
  if (state.strike) deco.push("line-through");
  if (deco.length) style += `text-decoration:${deco.join(" ")};`;
  return style;
}

export function stateClass(state) {
  const cls = [];
  if (state.rainbow) cls.push("fmtRainbow");
  if (state.obf) cls.push("fmtObf");
  return cls.join(" ");
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMOJI_RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\u20E3|[\u{1F3FB}-\u{1F3FF}])?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?)*)/gu;

function emojiHtml(text) {
  const source = String(text ?? "");
  let html = "";
  let last = 0;
  EMOJI_RE.lastIndex = 0;
  for (const match of source.matchAll(EMOJI_RE)) {
    const index = match.index ?? 0;
    if (index > last) html += escapeHtml(source.slice(last, index));
    html += `<span class="fmtEmoji">${escapeHtml(match[0])}</span>`;
    last = index + match[0].length;
  }
  if (last < source.length) html += escapeHtml(source.slice(last));
  return html || escapeHtml(source);
}

function richText(raw) {
  const source = String(raw ?? "");
  let html = "";
  let last = 0;
  EMOJI_RE.lastIndex = 0;
  for (const match of source.matchAll(EMOJI_RE)) {
    const index = match.index ?? 0;
    if (index > last) html += linkify(escapeHtml(source.slice(last, index)));
    html += `<span class="fmtEmoji">${escapeHtml(match[0])}</span>`;
    last = index + match[0].length;
  }
  if (last < source.length) html += linkify(escapeHtml(source.slice(last)));
  return html;
}

function linkify(text) {
  // text is already HTML-escaped. Only touch obvious http(s) URLs.
  return text.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const clean = url.replace(/[.,!?;:]+$/, "");
    const tail = url.slice(clean.length);
    return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${tail}`;
  });
}

/**
 * Turn raw &-coded text into safe HTML.
 * bodyFn receives already-escaped plaintext and must return safe HTML.
 */
export function renderFormatHtml(raw, { bodyFn = richText } = {}) {
  let state = { ...BLANK };
  let html = "";
  for (const tok of tokenize(raw)) {
    if (tok.t === "code") {
      state = applyCode(state, tok.c);
      continue;
    }
    const inner = bodyFn(escapeHtml(tok.v));
    const style = stateStyle(state);
    const cls = stateClass(state);
    if (!style && !cls) {
      html += inner;
      continue;
    }
    const attrs = `${cls ? ` class="${cls}"` : ""}${style ? ` style="${style}"` : ""}${state.obf ? ` data-obf-text="${escapeHtml(tok.v)}"` : ""}`;
    html += `<span${attrs}>${inner}</span>`;
  }
  return html;
}

export function sanitizeTemplate(raw) {
  const s = String(raw || "").replace(/[\r\n\t]+/g, " ").trim();
  return s && s.length <= FMT_MAX ? s : "";
}

export function normalizeTemplate(raw) {
  const tpl = sanitizeTemplate(raw);
  if (!tpl) return "";
  return tpl.includes("{msg}") ? tpl : `${tpl} {msg}`;
}

export function renderLineHtml(template, { name = "you", tag = "#a1b2", msgHtml = "hello", msgText = "" } = {}) {
  const tpl = normalizeTemplate(template);
  if (!tpl) return msgHtml;
  const cleanTag = `#${String(tag).replace(/^#/, "")}`;
  const safeParts = {
    "{name}": emojiHtml(name),
    "{tag}": `<span class="ba-line-tag">${emojiHtml(cleanTag)}</span>`,
    "{msg}": msgHtml,
  };
  const plainParts = { "{name}": name, "{tag}": cleanTag, "{msg}": msgText || "hello" };
  let state = { ...BLANK };
  let html = "";
  for (const tok of tokenize(tpl)) {
    if (tok.t === "code") {
      state = applyCode(state, tok.c);
      continue;
    }
    let inner = escapeHtml(tok.v).replace(/\{(name|tag|msg)\}/g, (m) => safeParts[m] ?? m);
    const style = stateStyle(state);
    const cls = stateClass(state);
    if (style || cls) {
      const obfText = tok.v.replace(/\{(name|tag|msg)\}/g, (m) => plainParts[m] ?? m);
      inner = `<span${cls ? ` class="${cls}"` : ""}${style ? ` style="${style}"` : ""}${state.obf ? ` data-obf-text="${escapeHtml(obfText)}"` : ""}>${inner}</span>`;
    }
    html += inner;
  }
  return html;
}

export function parseGlubMeta(eventOrTags) {
  const tags = Array.isArray(eventOrTags) ? eventOrTags : eventOrTags?.tags || [];
  const out = {};
  for (const tag of tags) {
    if (!Array.isArray(tag) || tag[0] !== GLUB_TAG) continue;
    for (let i = 1; i + 1 < tag.length; i += 2) {
      const k = tag[i];
      const v = tag[i + 1];
      if (typeof k === "string" && typeof v === "string" && !(k in out)) out[k] = v;
    }
  }
  return out;
}

export function buildGlubTag(meta, build) {
  const fields = ["rich", "fmt", "flair"];
  const tag = [GLUB_TAG];
  for (const field of fields) {
    const v = meta?.[field];
    if (typeof v === "string" && v) tag.push(field, v);
  }
  if (typeof build === "string" && build) tag.push(GLUB_VERSION_FIELD, build);
  return tag.length > 1 ? tag : null;
}

export function getTag(tags, name) {
  if (!Array.isArray(tags)) return undefined;
  for (const t of tags) {
    if (Array.isArray(t) && t[0] === name) return t;
  }
  return undefined;
}

export function getTagValue(tags, name) {
  return getTag(tags, name)?.[1];
}

export function flairMeta(name) {
  return FLAIRS.find((f) => f.name === name) || null;
}

export function isValidFlair(name) {
  return FLAIR_NAMES.has(name);
}

export function randomTag(pubkey = "") {
  return String(pubkey || "a1b2c3d4").slice(-4);
}

export function kindGroup(kind) {
  if (kind === 20000 || kind === 20001 || kind === 23333) return "chat";
  if (kind === 1) return "note";
  if (kind === 5 || kind === 7) return "reaction";
  if (kind === 4 || kind === 13 || kind === 14 || kind === 1059) return "dm";
  if (kind === 0 || kind === 3) return "profile";
  return "other";
}

export const KIND_GROUPS = [
  { id: "chat", label: "Chat messages", detail: "kinds 20000, 20001, 23333" },
  { id: "note", label: "Notes & replies", detail: "kind 1" },
  { id: "reaction", label: "Reactions & deletions", detail: "kinds 5, 7" },
  { id: "dm", label: "Direct messages", detail: "kinds 4, 13, 14, 1059" },
  { id: "profile", label: "Profiles & contacts", detail: "kinds 0, 3" },
  { id: "other", label: "Everything else", detail: "all remaining kinds" },
];

export const CLIENT_PRESETS = [
  "BetterAgnostr",
  "glub.chat",
  "Agnostr",
  "Damus",
  "Amethyst",
  "Primal",
  "Coracle",
  "Snort",
  "0xChat",
  "Nostrudel",
];

// Strip common campaign/tracking parameters from http(s) links.
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "yclid",
  "si",
  "spm",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref_src",
  "ref_url",
  "vero_id",
  "oly_anon_id",
  "oly_enc_id",
  "_hsenc",
  "_hsmi",
  "mkt_tok",
]);

export function stripTrackingParams(text) {
  return String(text || "").replace(/https?:\/\/[^\s<>()]+/g, (url) => {
    try {
      const u = new URL(url);
      let changed = false;
      for (const key of [...u.searchParams.keys()]) {
        const lower = key.toLowerCase();
        if (lower.startsWith("utm_") || TRACKING_PARAMS.has(lower)) {
          u.searchParams.delete(key);
          changed = true;
        }
      }
      return changed ? u.toString() : url;
    } catch {
      return url;
    }
  });
}
