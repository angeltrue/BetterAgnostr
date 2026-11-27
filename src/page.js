import { finalizeEvent, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { decode, npubEncode, noteEncode, neventEncode } from "nostr-tools/nip19";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { flairName } from "./lib/glub-flair.js";
import {
  CHAT_KINDS,
  NOTE_KINDS,
  buildGlubTag,
  getTagValue,
  hasFormat,
  kindGroup,
  normalizeTemplate,
  parseGlubMeta,
  stripFormat,
  stripTrackingParams,
  RICH_MAX,
} from "./lib/glub.js";
import {
  effectiveBuild,
  isReviewKind,
  mergeSettings,
  normalizeSettings,
  policyForKind,
} from "./lib/settings.js";
import { VERSION } from "./lib/version.js";

(() => {
  if (window.__betterAgnostrPage) return;
  Object.defineProperty(window, "__betterAgnostrPage", { value: true, configurable: false });

  const MAX_EVENTS = 2000;
  const MAX_LOGS = 300;
  const state = {
    token: null,
    configReady: false,
    configWaiters: [],
    active: false,
    started: false,
    callObserver: null,
    settings: normalizeSettings({}),
    events: new Map(),
    eventOrder: [],
    aliases: new Map(),
    aliasReverse: new Map(),
    logs: [],
    logBatch: [],
    logTimer: null,
    sockets: new Map(),
    relays: new Map(),
    signerHooked: false,
    signerInstance: null,
    signerMode: "auto",
    signerScanTimer: null,
    signerScanDelay: 500,
    signerWatchStarted: false,
    signerNoticeShown: false,
    noticeTimes: new Map(),
    nip07Patched: false,
    nip07Provider: null,
    nip07IdentityAt: 0,
    signMode: "none",
    pubkey: "",
    npub: "",
    nip07Timer: null,
    statusTimer: null,
    pending: new Map(),
    requestSeq: 0,
    reviewSeq: 0,
    screenshotMode: false,
    buildPromise: null,
    buildRequestedAt: 0,
    buildStale: false,
    startedAt: Date.now(),
    callDrops: 0,
    preparedCount: 0,
    verifiedIncoming: new Set(),
    peerIndex: new Map(),
    lastStatusSignature: "",
    postSeq: 0,
  };

  const preparedEvents = new WeakSet();
  const nip07Wrappers = new WeakMap();
  const signerPatches = new Map();
  const parsedFrames = new WeakMap();

  // Better Agnostr owns message chimes while it is active. Leave native
  // notifications, ringtone, and vibration intact.
  const NATIVE_NOTIFICATIONS_KEY = "agnostr:v2:notifications";
  const NATIVE_SETTINGS_KEY = "agnostr:v2:settings";
  const nativeStorageSetItem = globalThis.Storage.prototype.setItem;

  function forceNativeSoundOff(raw) {
    try {
      const value = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!value || typeof value !== "object") return raw;
      return JSON.stringify({ ...value, soundEnabled: false });
    } catch {
      return raw;
    }
  }

  globalThis.Storage.prototype.setItem = function setItem(key, value) {
    if (state.active && (key === NATIVE_NOTIFICATIONS_KEY || key === NATIVE_SETTINGS_KEY)) {
      value = forceNativeSoundOff(value);
    }
    return nativeStorageSetItem.call(this, key, value);
  };

  const NativeWebSocket = window.WebSocket;
  const nativeAdd = NativeWebSocket.prototype.addEventListener;
  const nativeRemove = NativeWebSocket.prototype.removeEventListener;
  const nativeSend = NativeWebSocket.prototype.send;
  const onMessageDescriptor = Object.getOwnPropertyDescriptor(NativeWebSocket.prototype, "onmessage");

  // ---------------------------------------------------------------------------
  // UI bridge
  // ---------------------------------------------------------------------------

  function uid() {
    state.requestSeq += 1;
    return `ba-${Date.now().toString(36)}-${state.requestSeq.toString(36)}`;
  }

  function post(type, payload = {}, id) {
    if (!state.token) return;
    state.postSeq += 1;
    const envelope = { __ba: true, dir: "page", token: state.token, seq: state.postSeq, type, payload, id };
    try {
      window.postMessage(envelope, location.origin);
    } catch {}
  }

  function notice(level, title, detail = "") {
    post("notice", { level, title, detail });
  }

  function noticeThrottled(key, level, title, detail = "", cooldownMs = 15000) {
    const now = Date.now();
    const last = Number(state.noticeTimes.get(key) || 0);
    if (now - last < cooldownMs) return;
    state.noticeTimes.set(key, now);
    if (state.noticeTimes.size > 50) {
      const first = state.noticeTimes.keys().next().value;
      if (first) state.noticeTimes.delete(first);
    }
    notice(level, title, detail);
  }

  function setConfig(settings) {
    const old = state.settings;
    state.settings = normalizeSettings(mergeSettings(state.settings, settings || {}));
    const enabled = state.settings.enabled !== false;
    const wasActive = state.active;
    state.active = enabled;
    if (enabled) {
      window.WebSocket = BetterWebSocket;
      if (state.started) kickSignerScan();
    } else {
      window.WebSocket = NativeWebSocket;
      if (wasActive) stopActiveWork();
    }
    if (!state.configReady) {
      state.configReady = true;
      const waiters = state.configWaiters.splice(0);
      for (const w of waiters) w();
    }
    applyCallPolicy();
    if (old?.glub?.build !== state.settings.glub.build) publishStatus();
  }

  function waitForConfig(timeoutMs = 1800) {
    if (state.configReady) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      state.configWaiters.push(finish);
      window.setTimeout(finish, timeoutMs);
    });
  }

  function askUi(type, payload, timeoutMs = 10000) {
    return new Promise((resolve) => {
      const id = uid();
      const timer = window.setTimeout(() => {
        state.pending.delete(id);
        resolve(null);
      }, timeoutMs);
      state.pending.set(id, (value) => {
        window.clearTimeout(timer);
        resolve(value);
      });
      post(type, payload, id);
    });
  }

  function resolvePending(id, payload) {
    const fn = state.pending.get(id);
    if (!fn) return;
    state.pending.delete(id);
    fn(payload);
  }

  function parseSettingsPayload(value) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  }

  async function handleUiData(data) {
    if (!data || data.__ba !== true || data.dir !== "ui") return;
    if (data.type === "hello") {
      if (!data.token) return;
      if (state.token && data.token !== state.token) return;
      state.token = String(data.token);
      setConfig(parseSettingsPayload(data.payload?.settings));
      publishStatus();
      post("ready", { version: VERSION });
      if (state.active) start();
      return;
    }
    if (data.token !== state.token) return;
    if (data.type === "config") {
      setConfig(parseSettingsPayload(data.payload?.settings));
      return;
    }
    if (data.type === "response" && data.id) {
      resolvePending(data.id, data.payload);
      return;
    }
    if (data.type === "getEvent") {
      const ev = findEvent(data.payload?.id);
      const result = ev || reconstructEvent(data.payload?.id) || null;
      post("event", { event: result, reconstructed: !ev && !!result }, data.id);
      return;
    }
    if (data.type === "getRecent") {
      const limit = Math.min(500, Math.max(1, Number(data.payload?.limit) || 100));
      post(
        "recent",
        {
          events: state.eventOrder.slice(-limit).map((id) => state.events.get(id)).filter(Boolean),
          peers: [...state.peerIndex.values()].slice(-2000),
        },
        data.id,
      );
      return;
    }
    if (data.type === "getLogs") {
      const limit = Math.min(600, Math.max(1, Number(data.payload?.limit) || 300));
      post("logs", { logs: state.logs.slice(-limit) }, data.id);
      return;
    }
    if (data.type === "verify") {
      const ev = data.payload?.event;
      let ok = false;
      let error = "";
      try {
        ok = verifyEvent(ev);
        if (!ok) error = "Signature or id does not verify.";
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      post("verified", { ok, error, eventId: ev?.id }, data.id);
      return;
    }
    if (data.type === "entities") {
      const payload = data.payload || {};
      const out = {};
      try {
        if (payload.pubkey) out.npub = npubEncode(payload.pubkey);
        if (payload.id) {
          out.note = noteEncode(payload.id);
          out.nevent = neventEncode({ id: payload.id, author: payload.pubkey, kind: payload.kind });
        }
      } catch {}
      post("entities", out, data.id);
      return;
    }
    if (data.type === "reconstruct") {
      post("reconstructed", { event: reconstructEvent(data.payload?.id) }, data.id);
      return;
    }
    if (data.type === "ping") {
      post("pong", { now: Date.now() }, data.id);
    }
  }

  const uiSeen = new Set();
  function handleUiEnvelope(data) {
    if (!data || data.__ba !== true || data.dir !== "ui") return;
    if (data.type !== "hello" && data.token !== state.token) return;
    const key = data.seq != null ? `${data.token || ""}:seq:${data.seq}` : null;
    if (key) {
      if (uiSeen.has(key)) return;
      uiSeen.add(key);
      if (uiSeen.size > 200) {
        const first = uiSeen.values().next().value;
        if (first) uiSeen.delete(first);
      }
    }
    handleUiData(data);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin && event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.__ba !== true || data.dir !== "ui") return;
    handleUiEnvelope(data);
  });

  // ---------------------------------------------------------------------------
  // Event store
  // ---------------------------------------------------------------------------

  function isValidEvent(ev) {
    return (
      ev &&
      typeof ev === "object" &&
      typeof ev.id === "string" &&
      /^[0-9a-f]{64}$/i.test(ev.id) &&
      typeof ev.pubkey === "string" &&
      /^[0-9a-f]{64}$/i.test(ev.pubkey) &&
      Number.isFinite(ev.kind) &&
      Number.isFinite(ev.created_at) &&
      typeof ev.content === "string" &&
      Array.isArray(ev.tags)
    );
  }

  function rememberEvent(ev) {
    if (!isValidEvent(ev)) return;
    const existing = state.events.get(ev.id);
    if (!existing) {
      state.events.set(ev.id, ev);
      state.eventOrder.push(ev.id);
      const cap = Math.max(100, Math.min(5000, Number(state.settings.inspector?.maxEvents) || MAX_EVENTS));
      while (state.eventOrder.length > cap) {
        const old = state.eventOrder.shift();
        if (old) state.events.delete(old);
      }
    }
    const peer = peerSummary(ev);
    if (peer && peer.pubkey) {
      const pubkey = String(peer.pubkey).toLowerCase();
      const previous = state.peerIndex.get(pubkey);
      if (!previous || peer.at >= previous.at) state.peerIndex.set(pubkey, peer);
      while (state.peerIndex.size > 2000) {
        const first = state.peerIndex.keys().next().value;
        if (!first) break;
        state.peerIndex.delete(first);
      }
    }
  }

  function findEvent(id) {
    if (!id) return null;
    const direct = state.events.get(id);
    if (direct) return direct;
    const alias = state.aliases.get(id);
    if (alias) return state.events.get(alias) || null;
    return null;
  }

  function cloneEventForStorage(ev) {
    return {
      ...ev,
      tags: (ev.tags || []).map((t) => [...t]),
    };
  }

  function reconstructEvent(id) {
    if (!id || !/^[0-9a-f]{64}$/i.test(id)) return null;
    const out = { id, pubkey: "", created_at: 0, kind: 0, tags: [], content: "", sig: "", _reconstructed: true };
    let idx = [];
    try {
      idx = JSON.parse(localStorage.getItem("agnostr:v2:msg_index") || "[]");
    } catch {
      idx = [];
    }
    if (Array.isArray(idx)) {
      for (const geo of idx.slice(0, 100)) {
        let list = [];
        try {
          list = JSON.parse(localStorage.getItem(`agnostr:v2:msgs:${geo}`) || "[]");
        } catch {
          continue;
        }
        if (!Array.isArray(list)) continue;
        const hit = list.slice(0, 5000).find((m) => m && m.id === id);
        if (!hit) continue;
        out.pubkey = String(hit.pubkey || hit.senderPubkey || "").toLowerCase();
        out.created_at = Number(hit.createdAt) || 0;
        out.kind = Number.isFinite(Number(hit.kind)) ? Number(hit.kind) : 20000;
        out.content = String(hit.content || "");
        out.tags = Array.isArray(hit.tags) ? hit.tags.filter(Array.isArray).map((t) => t.map(String)) : [];
        const has = (name) => out.tags.some((t) => t[0] === name);
        if (!has("g")) out.tags.push(["g", String(geo)]);
        if (hit.nickname && !has("n")) out.tags.push(["n", String(hit.nickname)]);
        if (hit.clientName && !has("client")) out.tags.push(["client", String(hit.clientName)]);
        if (hit.replyTo?.id && !has("e")) {
          out.tags.push(["e", String(hit.replyTo.id), "", "reply"]);
          if (hit.replyTo.pubkey) out.tags.push(["p", String(hit.replyTo.pubkey)]);
        }
        if (hit.imageAttachment?.url) out.tags.push(["imeta", `url ${hit.imageAttachment.url}`]);
        if (hit.voiceMemo?.url) out.tags.push(["imeta", `url ${hit.voiceMemo.url}`, "m audio/webm"]);
        return out;
      }
    }
    let threads = [];
    try {
      threads = JSON.parse(localStorage.getItem("agnostr:v2:dm_threads") || "[]");
    } catch {
      threads = [];
    }
    if (Array.isArray(threads)) {
      for (const thread of threads.slice(0, 100)) {
        if (!thread || !Array.isArray(thread.messages)) continue;
        const hit = thread.messages.slice(0, 5000).find((m) => m && m.id === id);
        if (!hit) continue;
        out.pubkey = String(hit.senderPubkey || hit.pubkey || "").toLowerCase();
        out.created_at = Number(hit.createdAt) || Math.floor(Number(hit.orderMs || 0) / 1000);
        out.kind = Number.isFinite(Number(hit.kind)) ? Number(hit.kind) : 4;
        out.content = String(hit.content || "");
        out.tags = Array.isArray(hit.tags) ? hit.tags.filter(Array.isArray).map((t) => t.map(String)) : [];
        if (!out.tags.some((t) => t[0] === "p")) out.tags.push(["p", String(thread.peerPubkey || "")]);
        if (hit.protocol && !out.tags.some((t) => t[0] === "t")) out.tags.push(["t", `agnostr-${hit.protocol}`]);
        return out;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Relay inspector
  // ---------------------------------------------------------------------------

  function scheduleLogFlush() {
    if (state.logTimer !== null) return;
    state.logTimer = window.setTimeout(flushLogs, 120);
  }

  function compactLog(log) {
    if (!log.event) return log;
    if (log.dir === "in" && ALERT_KINDS.has(Number(log.kind))) return log;
    const rest = { ...log };
    delete rest.event;
    return rest;
  }

  function flushLogs() {
    state.logTimer = null;
    if (!state.logBatch.length) return;
    const batch = state.logBatch.splice(0, state.logBatch.length);
    state.logs.push(...batch);
    trimLogs();
    if (state.settings.inspector.paused) {
      // The inspector can be paused, but alert events must still reach the
      // content script for chimes and banners.
      const incoming = batch.filter((log) => log.dir === "in" && log.event);
      if (incoming.length) post("logs", { logs: incoming.slice(-200) });
      return;
    }
    const sendable = batch.length > 300 ? batch.slice(-300) : batch;
    for (let i = 0; i < sendable.length; i += 200) {
      post("logs", { logs: sendable.slice(i, i + 200).map(compactLog) });
    }
  }

  function trimLogs() {
    if (state.logs.length > MAX_LOGS) state.logs.splice(0, state.logs.length - MAX_LOGS);
  }

  function pushFrameLog(entry) {
    state.logBatch.push({ ts: Date.now(), ...entry });
    scheduleLogFlush();
  }

  function summarizeEvent(ev) {
    return `kind ${ev.kind} · ${ev.id.slice(0, 8)}… · ${ev.content.slice(0, 48).replace(/\s+/g, " ")}`;
  }

  function peerSummary(ev) {
    const name = getTagValue(ev.tags, "n");
    const client = getTagValue(ev.tags, "client");
    if (!name && !client) return null;
    return {
      pubkey: ev.pubkey,
      name: String(name || ""),
      client: String(client || ""),
      at: Number(ev.created_at) || 0,
    };
  }

  function parseFrame(data, sourceEvent) {
    if (sourceEvent && parsedFrames.has(sourceEvent)) return parsedFrames.get(sourceEvent);
    let frame;
    try {
      frame = JSON.parse(data);
    } catch {
      return null;
    }
    if (!Array.isArray(frame)) return null;
    if (sourceEvent) parsedFrames.set(sourceEvent, frame);
    return frame;
  }

  function handleIncomingFrame(data, url, sourceEvent) {
    if (!state.active) return;
    if (typeof data !== "string") return;
    const frame = parseFrame(data, sourceEvent);
    if (!frame) return;
    const type = frame[0];
    if (type === "EVENT") {
      const ev = frame[2];
      if (isValidEvent(ev)) {
        const mustVerify = ALERT_KINDS.has(Number(ev.kind));
        if (mustVerify && !state.verifiedIncoming.has(ev.id)) {
          let valid = false;
          try {
            valid = verifyEvent(ev);
          } catch {}
          state.verifiedIncoming.add(ev.id);
          if (state.verifiedIncoming.size > 2000) {
            const first = state.verifiedIncoming.values().next().value;
            if (first) state.verifiedIncoming.delete(first);
          }
          if (!valid) {
            pushFrameLog({
              dir: "in",
              relay: url,
              type: "INVALID_SIGNATURE",
              eventId: ev.id,
              kind: ev.kind,
              summary: "incoming event failed signature verification",
            });
            return;
          }
        }
        const calls = state.settings.privacy.calls;
        if (calls.disable && calls.blockSignals && isCallEvent(ev)) {
          state.callDrops += 1;
          pushFrameLog({
            dir: "in",
            relay: url,
            type: "BLOCKED_CALL",
            eventId: ev.id,
            kind: ev.kind,
            summary: "incoming call signal blocked by Better Agnostr",
          });
          return;
        }
        rememberEvent(ev);
        const log = { dir: "in", relay: url, type, eventId: ev.id, kind: ev.kind, summary: summarizeEvent(ev) };
        const peer = peerSummary(ev);
        if (peer) log.peer = peer;
        // Keep the full event only where the UI needs it for a chime/banner.
        // All other events are fetched on demand from the page store.
        if (mustVerify) log.event = ev;
        pushFrameLog(log);
      }
      return;
    }
    if (type === "OK" || type === "NOTICE" || type === "EOSE" || type === "CLOSED" || type === "AUTH") {
      pushFrameLog({
        dir: "in",
        relay: url,
        type,
        eventId: type === "OK" ? frame[1] : undefined,
        summary:
          type === "OK"
            ? `${frame[2] ? "accepted" : "rejected"} ${String(frame[1] || "").slice(0, 10)}… ${frame[3] || ""}`.trim()
            : type === "NOTICE"
              ? String(frame[1] || "").slice(0, 180)
              : String(frame[1] || "").slice(0, 120),
        data: frame,
      });
    }
  }

  function handleOutgoingFrame(data, url) {
    if (typeof data !== "string") return;
    let frame;
    try {
      frame = JSON.parse(data);
    } catch {
      return;
    }
    if (!Array.isArray(frame)) return;
    if (frame[0] === "EVENT" && isValidEvent(frame[1])) {
      const ev = frame[1];
      rememberEvent(ev, { dir: "out", relay: url });
      const log = { dir: "out", relay: url, type: "EVENT", eventId: ev.id, kind: ev.kind, summary: summarizeEvent(ev) };
      const peer = peerSummary(ev);
      if (peer) log.peer = peer;
      pushFrameLog(log);
      return;
    }
    pushFrameLog({
      dir: "out",
      relay: url,
      type: String(frame[0] || "?"),
      summary:
        frame[0] === "REQ"
          ? `${frame[1]} · ${JSON.stringify(frame[2] || []).slice(0, 140)}`
          : frame[0] === "AUTH"
            ? `AUTH kind ${frame[1]?.kind ?? "?"}`
            : JSON.stringify(frame).slice(0, 160),
      data: frame,
    });
  }

  const CALL_KINDS = new Set([25050, 25051, 25052, 25053, 25054, 25055, 25058, 25059]);
  // Only events that can trigger a notification are verified on the hot path.
  // Everything else is verified on demand when the viewer asks for it.
  const ALERT_KINDS = new Set([20000, 23333, 4, 14, 1059, ...CALL_KINDS]);

  function isCallEvent(ev) {
    if (!ev || typeof ev !== "object") return false;
    if (CALL_KINDS.has(Number(ev.kind))) return true;
    const t = getTagValue(ev.tags, "t");
    return typeof t === "string" && t.toLowerCase().startsWith("agnostr-call");
  }

  function translateOkFrame(frame) {
    if (!Array.isArray(frame) || frame[0] !== "OK") return frame;
    const newId = frame[1];
    const oldId = state.aliasReverse.get(newId);
    if (!oldId) return frame;
    return ["OK", oldId, frame[2], frame[3]];
  }

  function prepareIncomingData(data, sourceEvent) {
    if (!state.active) return { drop: false, data, translated: false };
    if (typeof data !== "string") return { drop: false, data, translated: false };
    const isEvent = data.startsWith('["EVENT"');
    const isOk = data.startsWith('["OK"');
    if (!isEvent && !isOk) return { drop: false, data, translated: false };
    const frame = parseFrame(data, sourceEvent);
    if (!frame) return { drop: false, data, translated: false };
    const calls = state.settings.privacy.calls;
    if (calls.disable && calls.blockSignals && frame[0] === "EVENT" && isCallEvent(frame[2])) {
      // handleIncomingFrame logs/counts this once for every socket frame; the
      // per-listener wrapper must only drop it here.
      return { drop: true, data, translated: false };
    }
    const translated = translateOkFrame(frame);
    if (translated !== frame) {
      return { drop: false, data: JSON.stringify(translated), translated: true };
    }
    return { drop: false, data, translated: false };
  }

  function wrapListener(listener, ws, url, seenFrames) {
    const fn =
      typeof listener === "function"
        ? listener
        : listener && typeof listener.handleEvent === "function"
          ? listener.handleEvent.bind(listener)
          : null;
    if (!fn) return null;
    const wrapped = function (event) {
      let data = event?.data;
      let translated = false;
      const prepared = prepareIncomingData(data, event);
      if (prepared.drop) return;
      if (!seenFrames.has(event)) {
        seenFrames.add(event);
        handleIncomingFrame(data, url, event);
      }
      if (prepared.translated) {
        data = prepared.data;
        translated = true;
      }
      if (translated) {
        let copy;
        try {
          copy = new MessageEvent("message", {
            data,
            origin: event.origin || "",
            lastEventId: event.lastEventId || "",
            source: event.source || null,
            ports: event.ports ? [...event.ports] : [],
          });
        } catch {
          copy = event;
        }
        return fn.call(this, copy);
      }
      return fn.call(this, event);
    };
    return wrapped;
  }

  function instrumentSocket(ws, url) {
    if (!ws || state.sockets.has(ws)) return;
    state.sockets.set(ws, { url, status: "connecting", openedAt: 0, lastMessageAt: 0 });
    state.relays.set(url, { url, status: "connecting", lastMessageAt: 0, error: "" });
    const seenFrames = new WeakSet();
    nativeAdd.call(ws, "message", (event) => {
      if (!seenFrames.has(event)) {
        seenFrames.add(event);
        handleIncomingFrame(event?.data, url, event);
      }
    });

    nativeAdd.call(ws, "open", () => {
      if (!state.active) return;
      const s = state.sockets.get(ws);
      if (s) s.status = "open";
      state.relays.set(url, { ...(state.relays.get(url) || {}), url, status: "open", lastMessageAt: Date.now(), error: "" });
      pushFrameLog({ dir: "sys", relay: url, type: "OPEN", summary: "socket open" });
      publishStatus();
    });
    nativeAdd.call(ws, "close", (event) => {
      state.sockets.delete(ws);
      if (!state.active) return;
      if (state.relays.size > 100) {
        const first = state.relays.keys().next().value;
        if (first) state.relays.delete(first);
      }
      state.relays.set(url, {
        ...(state.relays.get(url) || {}),
        url,
        status: "closed",
        error: `closed ${event?.code ?? ""} ${event?.reason || ""}`.trim(),
      });
      pushFrameLog({ dir: "sys", relay: url, type: "CLOSE", summary: `${event?.code ?? ""} ${event?.reason || ""}`.trim() });
      publishStatus();
    });
    nativeAdd.call(ws, "error", () => {
      if (!state.active) return;
      state.relays.set(url, { ...(state.relays.get(url) || {}), url, status: "error", error: "socket error" });
      pushFrameLog({ dir: "sys", relay: url, type: "ERROR", summary: "socket error" });
      publishStatus();
    });

    // Wrap addEventListener for message listeners so call signals can be dropped
    // and OK responses translated, before the app sees them.
    const listenerMap = new WeakMap();
    ws.addEventListener = function (type, listener, options) {
      if (type !== "message" || !listener) return nativeAdd.call(this, type, listener, options);
      let wrapped = listenerMap.get(listener);
      if (!wrapped) {
        wrapped = wrapListener(listener, this, url, seenFrames);
        if (!wrapped) return nativeAdd.call(this, type, listener, options);
        listenerMap.set(listener, wrapped);
      }
      return nativeAdd.call(this, type, wrapped, options);
    };
    ws.removeEventListener = function (type, listener, options) {
      if (type === "message" && listener) {
        const wrapped = listenerMap.get(listener);
        if (wrapped) return nativeRemove.call(this, type, wrapped, options);
      }
      return nativeRemove.call(this, type, listener, options);
    };

    if (onMessageDescriptor?.set) {
      let current = null;
      Object.defineProperty(ws, "onmessage", {
        configurable: true,
        enumerable: true,
        get() {
          return current;
        },
        set(fn) {
          current = typeof fn === "function" ? fn : null;
          onMessageDescriptor.set.call(ws, current ? wrapListener(current, ws, url, seenFrames) : null);
        },
      });
    }

    ws.send = function (data) {
      handleSend(this, data, url);
    };
  }

  function BetterWebSocket(url, protocols) {
    const ws = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
    instrumentSocket(ws, String(url));
    return ws;
  }
  BetterWebSocket.prototype = NativeWebSocket.prototype;
  Object.setPrototypeOf(BetterWebSocket, NativeWebSocket);
  for (const key of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
    try {
      Object.defineProperty(BetterWebSocket, key, { value: NativeWebSocket[key], enumerable: true });
    } catch {}
  }
  window.WebSocket = BetterWebSocket;
  // If no content script ever completes the handshake (extension disabled or
  // not injected), do not leave the page wrapped for its whole lifetime.
  window.setTimeout(() => {
    if (!state.configReady && window.WebSocket === BetterWebSocket) window.WebSocket = NativeWebSocket;
  }, 4000);

  function sendRaw(ws, data) {
    try {
      nativeSend.call(ws, data);
    } catch (err) {
      if (state.active) {
        pushFrameLog({ dir: "sys", relay: state.sockets.get(ws)?.url || "", type: "SEND_ERROR", summary: String(err?.message || err) });
      }
    }
  }

  function handleSend(ws, data, url) {
    if (!state.active) {
      sendRaw(ws, data);
      return;
    }
    if (typeof data !== "string") {
      sendRaw(ws, data);
      return;
    }
    let frame;
    try {
      frame = JSON.parse(data);
    } catch {
      sendRaw(ws, data);
      return;
    }
    if (!Array.isArray(frame) || frame[0] !== "EVENT" || !isValidEvent(frame[1])) {
      handleOutgoingFrame(data, url);
      sendRaw(ws, data);
      return;
    }

    const ev = frame[1];
    const calls = state.settings.privacy.calls;
    if (calls.disable && calls.blockOutgoing && isCallEvent(ev)) {
      state.callDrops += 1;
      pushFrameLog({
        dir: "out",
        relay: url,
        type: "BLOCKED_CALL",
        eventId: ev.id,
        kind: ev.kind,
        summary: "outgoing call signal blocked by Better Agnostr",
      });
      noticeThrottled(
        "call-blocked",
        "warning",
        "Call blocked",
        "Calling is disabled in Better Agnostr privacy settings.",
        20000,
      );
      return;
    }

    // Last-mile guard for a signing path that bypasses the pre-sign hook. If the
    // local key belongs to this event, strip the teleport tag and re-sign it.
    if (state.settings.privacy.omitTeleport && hasTeleportTag(ev.tags)) {
      const cleaned = { ...ev, tags: stripTeleportTags(ev.tags) };
      (async () => {
        let prepared;
        try {
          prepared = await prepareOutgoing(cleaned, { source: "socket-teleport" });
        } catch (err) {
          noticeThrottled(
            "teleport-blocked",
            "error",
            "Teleport tag blocked",
            err instanceof Error ? err.message : String(err),
            20000,
          );
          return;
        }
        const resigned = await resignPrepared(prepared);
        if (resigned) {
          sendResigned(ws, url, ev, resigned);
          return;
        }
        pushFrameLog({
          dir: "out",
          relay: url,
          type: "BLOCKED_TELEPORT",
          eventId: ev.id,
          kind: ev.kind,
          summary: "outgoing teleport tag blocked by Better Agnostr",
        });
        noticeThrottled(
          "teleport-blocked",
          "warning",
          "Teleport tag blocked",
          "The message was not sent because the signer could not remove the teleport tag before signing.",
          20000,
        );
      })();
      return;
    }

    if (state.signerHooked) {
      handleOutgoingFrame(data, url);
      sendRaw(ws, data);
      return;
    }

    // Fallback when the signer hook could not be attached. The event is already
    // signed, so only send it unchanged if no BA transform is needed; otherwise
    // re-sign with the matching local key or fail closed.
    (async () => {
      let prepared;
      try {
        prepared = await prepareOutgoing(ev, { source: "socket-fallback" });
      } catch (err) {
        noticeThrottled(
          "outgoing-blocked",
          "error",
          "Outgoing event blocked",
          err instanceof Error ? err.message : String(err),
          10000,
        );
        return;
      }
      if (!state.active) {
        sendRaw(ws, data);
        return;
      }
      if (sameOutgoing(ev, prepared)) {
        handleOutgoingFrame(data, url);
        sendRaw(ws, data);
        return;
      }
      const signed = await resignPrepared(prepared);
      if (signed) {
        sendResigned(ws, url, ev, signed);
        return;
      }
      pushFrameLog({
        dir: "out",
        relay: url,
        type: "BLOCKED_NO_SIGNER",
        eventId: ev.id,
        kind: ev.kind,
        summary: "outgoing event was blocked because the signer was unavailable",
      });
      noticeThrottled(
        "no-signer",
        "error",
        "Could not send message",
        "Better Agnostr could not apply its outgoing changes because the signer was unavailable. Reload the page and try again.",
        15000,
      );
    })();
  }

  // ---------------------------------------------------------------------------
  // Agnostr signer adapter
  // ---------------------------------------------------------------------------
  //
  // Agnostr keeps its IdentityManager inside React. There is no public hook, so
  // discovery still walks the React internals, but only until it finds a signer
  // and with backoff afterwards. The wrapper is the only place that rewrites an
  // event before the app signs it; local-key re-signing is a fallback for the
  // last-mile socket path.

  function objectLooksLikeIdentityManager(obj) {
    if (!obj || typeof obj !== "object") return false;
    try {
      return (
        typeof obj.signEvent === "function" &&
        typeof obj.signEventWithMaterial === "function" &&
        typeof obj.getMasterKeyMaterial === "function"
      );
    } catch {
      return false;
    }
  }

  function deepFindIdentityManager(root, depth = 4, seen = new Set()) {
    if (!root || (typeof root !== "object" && typeof root !== "function")) return null;
    if (depth < 0 || seen.has(root)) return null;
    seen.add(root);
    if (objectLooksLikeIdentityManager(root)) return root;
    if (root instanceof Node || root === window || root === document) return null;
    if (root instanceof Map || root instanceof Set) {
      let i = 0;
      for (const value of root.values()) {
        if (i++ > 40) break;
        const found = deepFindIdentityManager(value, depth - 1, seen);
        if (found) return found;
      }
      return null;
    }
    let keys = [];
    try {
      keys = Object.keys(root).slice(0, 80);
    } catch {
      return null;
    }
    for (const key of keys) {
      if (key.startsWith("__") || key === "window" || key === "document" || key === "parent" || key === "ownerDocument") continue;
      let value;
      try {
        value = root[key];
      } catch {
        continue;
      }
      const found = deepFindIdentityManager(value, depth - 1, seen);
      if (found) return found;
    }
    return null;
  }

  function inspectFiber(fiber, seen, depth) {
    if (!fiber || seen.has(fiber) || depth > 24) return null;
    seen.add(fiber);
    const props = fiber.memoizedProps;
    if (props && typeof props === "object") {
      for (const value of Object.values(props)) {
        if (objectLooksLikeIdentityManager(value)) return value;
        if (value && typeof value === "object") {
          const nested = deepFindIdentityManager(value, 3, new Set());
          if (nested) return nested;
        }
      }
    }
    const stateNode = fiber.stateNode;
    if (stateNode && typeof stateNode === "object") {
      if (objectLooksLikeIdentityManager(stateNode)) return stateNode;
      const nested = deepFindIdentityManager(stateNode, 3, new Set());
      if (nested) return nested;
    }
    let hook = fiber.memoizedState;
    let guard = 0;
    while (hook && guard < 80) {
      guard += 1;
      const found = deepFindIdentityManager(hook.memoizedState, 5, new Set());
      if (found) return found;
      hook = hook.next;
    }
    return inspectFiber(fiber.child, seen, depth + 1) || inspectFiber(fiber.sibling, seen, depth + 1);
  }

  function findIdentityManager() {
    if (state.signerInstance && objectLooksLikeIdentityManager(state.signerInstance)) return state.signerInstance;
    const containers = [];
    const root = document.getElementById("root");
    if (root) containers.push(root);
    for (const node of document.querySelectorAll("body > div, body > main")) {
      if (containers.length > 6) break;
      containers.push(node);
    }
    for (const container of containers) {
      try {
        for (const key of Object.keys(container)) {
          if (key.startsWith("__reactContainer$")) {
            const found = inspectFiber(container[key], new Set(), 0);
            if (found) return found;
          }
          if (key.startsWith("__reactFiber$")) {
            let fiber = container[key];
            let guard = 0;
            while (fiber && guard++ < 200) {
              if (fiber.return === null) {
                const found = inspectFiber(fiber, new Set(), 0);
                if (found) return found;
              }
              fiber = fiber.return;
            }
          }
        }
      } catch {}
    }
    return null;
  }

  function currentSignMode(instance) {
    if (instance?.getSignMode) {
      try {
        const mode = instance.getSignMode();
        if (mode === "auto" || mode === "local" || mode === "extension") return mode;
      } catch {}
    }
    try {
      const raw = localStorage.getItem("agnostr:v2:sign_mode");
      if (raw === "auto" || raw === "local" || raw === "extension") return raw;
    } catch {}
    return "auto";
  }

  function signerPubkey(instance) {
    try {
      const material = instance?.getMasterKeyMaterial?.();
      const pubkey = String(material?.pubkey || "").toLowerCase();
      return /^[0-9a-f]{64}$/.test(pubkey) ? pubkey : "";
    } catch {
      return "";
    }
  }

  function patchIdentityManager(instance) {
    if (!instance) return false;
    const target = Object.prototype.hasOwnProperty.call(instance, "signEventWithMaterial")
      ? instance
      : Object.getPrototypeOf(instance);
    if (!target || typeof target.signEventWithMaterial !== "function") return false;
    state.signerInstance = instance;
    state.signerMode = currentSignMode(instance);
    const pubkey = signerPubkey(instance);
    if (pubkey) {
      state.pubkey = pubkey;
      try {
        state.npub = npubEncode(pubkey);
      } catch {
        state.npub = "";
      }
    }
    const existing = signerPatches.get(target);
    if (existing && target.signEventWithMaterial === existing.wrapped) {
      state.signerHooked = true;
      state.signMode = state.signerMode;
      publishStatus();
      return true;
    }
    const original = target.signEventWithMaterial;
    const wrapped = async function (event, material) {
      const prepared = await prepareOutgoing(event, { source: "signer" });
      const signed = await original.call(this, prepared, material);
      if (isValidEvent(signed)) {
        const pubkey = String(signed.pubkey || "").toLowerCase();
        if (pubkey && pubkey !== state.pubkey) {
          state.pubkey = pubkey;
          try {
            state.npub = npubEncode(pubkey);
          } catch {
            state.npub = "";
          }
        }
        rememberEvent(signed, { dir: "signed", relay: "signer" });
      }
      return signed;
    };
    try {
      target.signEventWithMaterial = wrapped;
      if (target.signEventWithMaterial !== wrapped) {
        Object.defineProperty(target, "signEventWithMaterial", {
          value: wrapped,
          configurable: true,
          writable: true,
        });
      }
      signerPatches.set(target, { original, wrapped });
      state.signerHooked = true;
      state.signMode = state.signerMode;
      publishStatus();
      if (!state.signerNoticeShown) {
        state.signerNoticeShown = true;
        notice("success", "Signer attached", "Outgoing event tools are active.");
      }
      return true;
    } catch (err) {
      state.signerHooked = false;
      noticeThrottled(
        "signer-patch",
        "warning",
        "Could not attach to signer",
        err instanceof Error ? err.message : String(err),
        60000,
      );
      return false;
    }
  }

  function unpatchSigner() {
    for (const [target, record] of signerPatches) {
      try {
        if (target.signEventWithMaterial === record.wrapped) target.signEventWithMaterial = record.original;
      } catch {}
    }
    signerPatches.clear();
    state.signerHooked = false;
    state.signerInstance = null;
    state.signerMode = "auto";
    state.signMode = state.nip07Patched ? "nip-07" : "none";
    if (!state.nip07Patched) {
      state.pubkey = "";
      state.npub = "";
    }
    publishStatus();
  }

  function scanSigner() {
    if (state.signerInstance && objectLooksLikeIdentityManager(state.signerInstance)) {
      patchIdentityManager(state.signerInstance);
    } else {
      state.signerHooked = false;
      const found = findIdentityManager();
      if (found) patchIdentityManager(found);
    }
    patchNip07();
  }

  function queueSignerScan(delayMs = 500) {
    if (state.signerScanTimer !== null) return;
    const delay = Math.max(250, Math.min(15000, Number(delayMs) || 500));
    state.signerScanTimer = window.setTimeout(() => {
      state.signerScanTimer = null;
      scanSigner();
      const next = state.signerHooked || state.nip07Patched
        ? 15000
        : Math.min(15000, Math.max(900, Math.round(state.signerScanDelay * 1.7)));
      state.signerScanDelay = next;
      queueSignerScan(next);
    }, delay);
  }

  function startSignerWatch() {
    if (state.signerWatchStarted) {
      kickSignerScan();
      return;
    }
    state.signerWatchStarted = true;
    state.signerScanDelay = 500;
    scanSigner();
    queueSignerScan(500);
  }

  function kickSignerScan() {
    if (!state.signerWatchStarted) {
      startSignerWatch();
      return;
    }
    if (state.signerScanTimer !== null) {
      window.clearTimeout(state.signerScanTimer);
      state.signerScanTimer = null;
    }
    state.signerScanDelay = 500;
    scanSigner();
    queueSignerScan(700);
  }

  function stopSignerWatch() {
    if (state.signerScanTimer !== null) {
      window.clearTimeout(state.signerScanTimer);
      state.signerScanTimer = null;
    }
    state.signerWatchStarted = false;
    state.signerScanDelay = 500;
    unpatchSigner();
  }

  // ---------------------------------------------------------------------------
  // NIP-07 rewrite adapter
  // ---------------------------------------------------------------------------
  //
  // Better Agnostr no longer discovers or implements an Agnostr signer. The only
  // pre-sign integration is the standard NIP-07 provider, if the page exposes one.
  // Upstream native signer support can replace this adapter without restoring the
  // React-fiber/local-key code that used to live here.

  function nip07Provider() {
    try {
      const provider = window.nostr;
      return provider && typeof provider.signEvent === "function" ? provider : null;
    } catch {
      return null;
    }
  }

  async function refreshNip07Identity(provider) {
    if (state.signerHooked) return;
    if (!provider || typeof provider.getPublicKey !== "function") return;
    const now = Date.now();
    if (now - state.nip07IdentityAt < 30000) return;
    state.nip07IdentityAt = now;
    try {
      const pubkey = String((await provider.getPublicKey()) || "").trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(pubkey)) return;
      if (pubkey === state.pubkey) return;
      state.pubkey = pubkey;
      try {
        state.npub = npubEncode(pubkey);
      } catch {
        state.npub = "";
      }
      publishStatus();
    } catch {}
  }

  function clearNip07Identity() {
    state.nip07IdentityAt = 0;
    if (state.signerHooked) return;
    if (!state.pubkey && !state.npub) return;
    state.pubkey = "";
    state.npub = "";
    publishStatus();
  }

  function patchNip07() {
    const provider = nip07Provider();
    if (!provider) {
      clearNip07Identity();
      if (state.nip07Patched || (!state.signerHooked && state.signMode !== "none")) {
        state.nip07Patched = false;
        state.signMode = state.signerHooked ? state.signerMode : "none";
        publishStatus();
      }
      return false;
    }
    if (state.nip07Provider !== provider) {
      state.nip07Provider = provider;
      state.nip07IdentityAt = 0;
      if (!state.signerHooked) {
        state.pubkey = "";
        state.npub = "";
      }
    }
    state.nip07Patched = true;
    state.signMode = state.signerHooked ? state.signerMode : "nip-07";
    void refreshNip07Identity(provider);
    // A provider can be replaced by another extension after our wrapper lands.
    // Keep one wrapper per provider object and re-install it when a page swaps
    // the function out.
    const original = provider.signEvent;
    const existing = nip07Wrappers.get(provider);
    if (existing && existing.original === original && provider.signEvent === existing.wrapped) return true;
    const wrapped = async function (...args) {
      const prepared = await prepareOutgoing(args[0], { source: "nip07" });
      args[0] = prepared;
      return original.apply(this, args);
    };
    try {
      provider.signEvent = wrapped;
      nip07Wrappers.set(provider, { original, wrapped });
      publishStatus();
      return true;
    } catch {
      state.nip07Patched = false;
      state.signMode = "none";
      publishStatus();
      return false;
    }
  }

  function unpatchNip07() {
    const provider = nip07Provider();
    const record = provider ? nip07Wrappers.get(provider) : null;
    if (provider && record && provider.signEvent === record.wrapped) {
      try {
        provider.signEvent = record.original;
      } catch {}
    }
    if (provider) nip07Wrappers.delete(provider);
    state.nip07Provider = null;
    state.nip07Patched = false;
    state.signMode = state.signerHooked ? state.signerMode : "none";
    clearNip07Identity();
  }

  function startNip07Watch() {
    if (state.nip07Timer !== null) return;
    state.nip07Timer = window.setInterval(patchNip07, 2000);
    patchNip07();
  }

  // ---------------------------------------------------------------------------
  // Outgoing event preparation
  // ---------------------------------------------------------------------------

  function cloneTags(tags) {
    return Array.isArray(tags) ? tags.map((t) => (Array.isArray(t) ? [...t] : t)) : [];
  }

  function markPrepared(ev) {
    if (ev && typeof ev === "object") preparedEvents.add(ev);
    return ev;
  }

  function isPrepared(ev) {
    return !!ev && typeof ev === "object" && preparedEvents.has(ev);
  }

  async function ensureBuild(force = false) {
    const manual = state.settings.glub.manualBuild;
    if (manual) return manual;
    const cached = state.settings.glub.build;
    const age = Date.now() - Number(state.settings.glub.buildFetchedAt || 0);
    if (!force && cached && !state.buildStale && age < 2 * 60 * 1000) return cached;
    if (state.buildPromise) return state.buildPromise;
    state.buildRequestedAt = Date.now();
    state.buildPromise = (async () => {
      const res = await askUi("build", { force, current: cached }, 4500);
      if (res && res.build) {
        state.buildStale = !!res.stale;
        state.settings.glub.build = String(res.build);
        state.settings.glub.buildFetchedAt = Number(res.fetchedAt) || Date.now();
        publishStatus();
        if (res.stale) {
          notice("warning", "Glub build is stale", "glub.chat could not be refreshed; metadata was not added so the message is not rejected by glub.chat.");
          return "";
        }
        return state.settings.glub.build;
      }
      if (res?.error) notice("warning", "Glub build sync failed", String(res.error));
      return state.settings.glub.build || "";
    })();
    try {
      return await state.buildPromise;
    } finally {
      state.buildPromise = null;
    }
  }

  function removeTagsByName(tags, names) {
    return tags.filter((t) => !Array.isArray(t) || !names.has(t[0]));
  }

  function isTeleportTag(tag) {
    return Array.isArray(tag) && tag[0] === "t" && String(tag[1] || "").trim().toLowerCase() === "teleport";
  }

  function hasTeleportTag(tags) {
    return Array.isArray(tags) && tags.some(isTeleportTag);
  }

  function stripTeleportTags(tags) {
    return tags.filter((tag) => !isTeleportTag(tag));
  }

  function applyClientPolicy(ev) {
    const settings = state.settings;
    let policy = policyForKind(settings, ev.kind);
    if (settings.privacy.stripTags.includes("client")) policy = "strip";
    if (policy === "leave") return;
    if (policy === "spoof" && !settings.client.name.trim()) policy = "strip";
    if (
      policy === "spoof" &&
      settings.client.name.trim().toLowerCase() === "glub.chat" &&
      !effectiveBuild(settings)
    ) {
      // A glub.chat client tag without the matching glub build makes glub.chat
      // hide the event. Leave the original tag alone until the build is known.
      return;
    }
    ev.tags = removeTagsByName(ev.tags, new Set(["client"]));
    if (policy === "strip" || !settings.client.name) return;
    ev.tags.push(["client", settings.client.name.slice(0, 64)]);
  }

  function applyPrivacyTags(ev) {
    if (state.settings.privacy.omitTeleport) {
      ev.tags = stripTeleportTags(ev.tags);
    }
    const strip = new Set(state.settings.privacy.stripTags);
    if (!strip.size) return;
    // Never strip the routing/delivery-critical tags.
    for (const critical of ["g", "d", "e", "p", "k", "h", "a", "q"]) strip.delete(critical);
    ev.tags = removeTagsByName(ev.tags, strip);
  }

  function applyTrackingStrip(ev) {
    if (!state.settings.privacy.stripTracking) return;
    // Encrypted and protocol events can contain opaque URL-looking bytes. Only
    // rewrite human-readable chat/note payloads.
    if (!CHAT_KINDS.has(ev.kind) && !NOTE_KINDS.has(ev.kind)) return;
    if (typeof ev.content === "string" && /https?:\/\//i.test(ev.content)) {
      ev.content = stripTrackingParams(ev.content);
    }
    if (Array.isArray(ev.tags)) {
      ev.tags = ev.tags.map((tag) =>
        Array.isArray(tag)
          ? tag.map((value) =>
              typeof value === "string" && /https?:\/\//i.test(value) ? stripTrackingParams(value) : value,
            )
          : tag,
      );
    }
  }

  async function applyGlub(ev, group) {
    const settings = state.settings;
    const groupPolicy = policyForKind(settings, ev.kind);
    const wantsGlubClient =
      groupPolicy === "spoof" &&
      settings.client.name.trim().toLowerCase() === "glub.chat" &&
      !settings.privacy.stripTags.includes("client");
    if (!CHAT_KINDS.has(ev.kind) && !NOTE_KINDS.has(ev.kind) && group !== "chat") return;
    const existing = parseGlubMeta(ev.tags);
    const isChat = group === "chat" && ev.kind !== 20001;
    let rich = typeof existing.rich === "string" && existing.rich.length <= RICH_MAX ? existing.rich : "";
    if (rich && state.settings.privacy.stripTracking) rich = stripTrackingParams(rich);
    let fmt = typeof existing.fmt === "string" ? normalizeTemplate(existing.fmt) : "";
    let flair = flairName(existing.flair);

    let richSource = "";
    let stripCodes = false;
    if (settings.studio.applyRich && typeof ev.content === "string" && hasFormat(ev.content)) {
      if (ev.content.length <= RICH_MAX) richSource = ev.content;
      else {
        stripCodes = true;
        notice("warning", "Formatting skipped", "The message is too long for glub rich formatting; formatting codes will be removed only if metadata can be attached.");
      }
    }

    if (settings.studio.enabled && isChat) {
      const tpl = normalizeTemplate(settings.studio.template);
      if (tpl) fmt = tpl;
      if (settings.studio.flair) flair = flairName(settings.studio.flair) || flair;
    }

    const needsGlub = !!(rich || richSource || stripCodes || fmt || flair);
    if (!needsGlub && !wantsGlubClient) return;

    const build = await ensureBuild();
    if (!build) {
      // Keep any existing metadata and formatting codes instead of deleting them
      // before we know whether a replacement can be built.
      notice("warning", "Glub metadata skipped", "No live glub.chat build stamp is available yet. The message will still send, but glub.chat users will see plain text.");
      return;
    }
    const tag = buildGlubTag({ rich: richSource || rich, fmt, flair }, build);
    if (tag) {
      rich = richSource || rich;
      if (richSource) ev.content = stripFormat(richSource);
      else if (stripCodes) ev.content = stripFormat(ev.content);
      ev.tags = removeTagsByName(ev.tags, new Set(["glub"]));
      ev.tags.push(tag);
    } else if (wantsGlubClient) {
      ev.tags = removeTagsByName(ev.tags, new Set(["glub"]));
      ev.tags.push(["glub", "v", build]);
    } else if (stripCodes) {
      // No metadata could be attached; keep the original codes so the message
      // does not lose formatting for no reason.
      notice("warning", "Formatting kept", "The message is too long for glub rich formatting; codes were left in place.");
    }
  }

  async function prepareOutgoing(original, opts = {}) {
    if (!original || typeof original !== "object") return original;
    if (!state.active) return original;
    if (isPrepared(original)) return original;
    await waitForConfig();
    if (!state.active) throw new Error("Better Agnostr is disabled.");
    const settings = state.settings;
    const ev = {
      kind: original.kind,
      created_at: original.created_at,
      tags: cloneTags(original.tags),
      content: typeof original.content === "string" ? original.content : String(original.content ?? ""),
    };
    // Preserve non-enumerable extra fields? Signers only need the four fields.
    if (original.pubkey) ev.pubkey = original.pubkey;

    const group = kindGroup(ev.kind);
    const calls = settings.privacy.calls;
    if (calls.disable && calls.blockOutgoing && isCallEvent(ev)) {
      throw new Error("Calling is disabled in Better Agnostr privacy settings.");
    }

    applyTrackingStrip(ev);
    await applyGlub(ev, group);
    applyPrivacyTags(ev);
    applyClientPolicy(ev, group);

    if (isReviewKind(settings, ev.kind)) {
      const decision = await askUi(
        "review",
        {
          original: cloneEventForStorage(original),
          proposed: cloneEventForStorage(ev),
          group,
          source: opts.source || "provider",
        },
        180000,
      );
      if (!decision || decision.action !== "send") {
        throw new Error("Outgoing event cancelled in the Better Agnostr review dialog.");
      }
      if (Array.isArray(decision.stripTagIndexes) && decision.stripTagIndexes.length) {
        const strip = new Set(decision.stripTagIndexes.map(Number).filter(Number.isInteger));
        const critical = new Set(["g", "d", "e", "p", "k", "h", "a", "q"]);
        ev.tags = ev.tags.filter((tag, index) => !strip.has(index) || critical.has(tag?.[0]));
      }
      if (Array.isArray(decision.stripTags) && decision.stripTags.length) {
        const strip = new Set(decision.stripTags);
        for (const critical of ["g", "d", "e", "p", "k", "h", "a", "q"]) strip.delete(critical);
        ev.tags = removeTagsByName(ev.tags, strip);
      }
    }

    if (!state.active) throw new Error("Better Agnostr was disabled while preparing the event.");
    state.preparedCount += 1;
    // A new object, so the caller can't mutate our copy; mark it so nested hooks
    // (NIP-07 wrapper inside the signer hook) do not prepare it twice.
    return markPrepared(ev);
  }

  // ---------------------------------------------------------------------------
  // Local key fallback signing
  // ---------------------------------------------------------------------------
  //
  // Used only when the signer hook could not be attached. It never signs an
  // event for a different pubkey, and it fails closed instead of sending an
  // event whose privacy transforms could not be applied.

  function readLocalJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function secretFromRaw(raw) {
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim();
    try {
      if (trimmed.toLowerCase().startsWith("nsec1")) {
        const decoded = decode(trimmed);
        return decoded?.type === "nsec" && decoded.data instanceof Uint8Array ? decoded.data : null;
      }
      if (/^[0-9a-f]{64}$/i.test(trimmed)) {
        const bytes = hexToBytes(trimmed.toLowerCase());
        getPublicKey(bytes);
        return bytes;
      }
    } catch {}
    return null;
  }

  function localKeys() {
    const signModeRaw = localStorage.getItem("agnostr:v2:sign_mode");
    const signMode = signModeRaw === "local" || signModeRaw === "extension" || signModeRaw === "auto" ? signModeRaw : "auto";
    const settings = readLocalJson("agnostr:v2:settings", {});
    const perGeohashIdentity = !!settings.perGeohashIdentity;
    let master = null;
    if (signMode === "local") {
      master = secretFromRaw(localStorage.getItem("agnostr:v2:local_secret") || "");
    } else if (signMode === "auto") {
      master = secretFromRaw(localStorage.getItem("agnostr:v2:device_seed") || "");
    }
    return { signMode, perGeohashIdentity, master };
  }

  function deriveGeohashSecret(seed, geohash) {
    const normalized = String(geohash || "").trim().replace(/^#+/, "").toLowerCase();
    const geo = utf8ToBytes(normalized);
    for (let counter = 0; counter < 10; counter++) {
      const info = new Uint8Array(geo.length + 4);
      info.set(geo, 0);
      new DataView(info.buffer).setUint32(geo.length, counter, false);
      const candidate = hmac(sha256, seed, info);
      try {
        getPublicKey(candidate);
        return candidate;
      } catch {}
    }
    return sha256(concatBytes(seed, geo));
  }

  function keyForEvent(ev) {
    const { signMode, perGeohashIdentity, master } = localKeys();
    if (signMode === "extension" || !master) return null;
    const geohash = getTagValue(ev.tags, "g");
    if (signMode === "auto" && perGeohashIdentity && geohash) {
      const derived = deriveGeohashSecret(master, geohash);
      try {
        if (getPublicKey(derived) === ev.pubkey) return derived;
      } catch {}
    }
    try {
      if (getPublicKey(master) === ev.pubkey) return master;
    } catch {}
    return null;
  }

  function resignEvent(ev) {
    if (!ev || typeof ev !== "object") return null;
    const key = keyForEvent(ev);
    if (!key) return null;
    try {
      const unsigned = {
        kind: ev.kind,
        created_at: ev.created_at || Math.floor(Date.now() / 1000),
        tags: cloneTags(ev.tags),
        content: ev.content,
      };
      return finalizeEvent(unsigned, key);
    } catch {
      return null;
    }
  }

  async function resignPrepared(prepared) {
    const local = resignEvent(prepared);
    if (local) return local;
    const provider = nip07Provider();
    if (!provider) return null;
    const expected = String(prepared?.pubkey || "").toLowerCase();
    if (!expected || (state.pubkey && expected !== state.pubkey)) return null;
    try {
      const signed = await provider.signEvent(prepared);
      return isValidEvent(signed) && String(signed.pubkey || "").toLowerCase() === expected ? signed : null;
    } catch {
      return null;
    }
  }

  function sameOutgoing(a, b) {
    if (!a || !b) return false;
    return (
      a.kind === b.kind &&
      a.created_at === b.created_at &&
      a.content === b.content &&
      JSON.stringify(a.tags || []) === JSON.stringify(b.tags || [])
    );
  }

  function rememberAlias(from, to) {
    if (!from || !to || from === to) return;
    state.aliases.set(from, to);
    state.aliasReverse.set(to, from);
    if (state.aliases.size > 1000) {
      const first = state.aliases.keys().next().value;
      if (first) state.aliases.delete(first);
    }
    if (state.aliasReverse.size > 1000) {
      const first = state.aliasReverse.keys().next().value;
      if (first) state.aliasReverse.delete(first);
    }
    post("alias", { from, to });
  }

  function sendResigned(ws, url, original, signed) {
    rememberAlias(original.id, signed.id);
    sendRaw(ws, JSON.stringify(["EVENT", signed]));
    rememberEvent(signed, { dir: "out", relay: url });
    pushFrameLog({
      dir: "out",
      relay: url,
      type: "EVENT",
      eventId: signed.id,
      kind: signed.kind,
      aliasOf: original.id,
      summary: summarizeEvent(signed),
      peer: peerSummary(signed),
    });
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  function relaySnapshot() {
    return [...state.relays.values()].map((r) => ({ ...r }));
  }

  function publishStatus() {
    const build = effectiveBuild(state.settings);
    let nickname = "";
    try {
      nickname = localStorage.getItem("agnostr:v2:nickname") || "";
    } catch {}
    const relays = relaySnapshot();
    // High-frequency counters (events, logs, sockets) are intentionally not
    // part of the change key. Otherwise every relay event would force a full
    // structured-clone status message even when nothing actionable changed.
    const signature = [
      state.signerHooked,
      state.signerMode,
      state.nip07Patched,
      state.signMode,
      state.pubkey,
      state.npub,
      nickname,
      build,
      state.settings.glub.buildFetchedAt,
      state.settings.privacy.calls.disable,
      relays.map((relay) => `${relay.url}:${relay.status}:${relay.lastMessageAt}`).join("|"),
    ].join("~");
    if (signature === state.lastStatusSignature) return;
    state.lastStatusSignature = signature;
    post("status", {
      signerHooked: state.signerHooked,
      signerMode: state.signerMode,
      nip07Patched: state.nip07Patched,
      signMode: state.signMode,
      pubkey: state.pubkey,
      npub: state.npub,
      nickname,
      build,
      buildFetchedAt: state.settings.glub.buildFetchedAt,
      eventCount: state.events.size,
      logCount: state.logs.length,
      socketCount: state.sockets.size,
      relays,
      callDrops: state.callDrops,
      preparedCount: state.preparedCount,
      startedAt: state.startedAt,
      callsDisabled: state.settings.privacy.calls.disable,
    });
  }

  function applyCallPolicy() {
    if (!state.active) return;
    const calls = state.settings.privacy.calls;
    if (!calls.disable) return;
    // Remove call items that are already open in Agnostr's context menu.
    try {
      for (const label of document.querySelectorAll(".ag-ctx-item-label")) {
        if (/^(voice|video) call$/i.test(label.textContent?.trim() || "")) {
          label.closest(".ag-ctx-item")?.remove();
        }
      }
    } catch {}
  }

  function callMenuAdded(records) {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (
          node.matches(".ag-ctx-menu, .ag-ctx-item-label") ||
          node.querySelector(".ag-ctx-menu, .ag-ctx-item-label")
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function stopActiveWork() {
    stopStatusTimer();
    if (state.nip07Timer !== null) {
      window.clearInterval(state.nip07Timer);
      state.nip07Timer = null;
    }
    stopSignerWatch();
    unpatchNip07();
    for (const resolve of state.pending.values()) resolve(null);
    state.pending.clear();
    state.callObserver?.disconnect();
    state.callObserver = null;
    state.started = false;
  }

  function start() {
    if (state.started || !state.active) return;
    state.started = true;
    startNip07Watch();
    startSignerWatch();
    startStatusTimer();
    state.callObserver = new MutationObserver((records) => {
      if (!callMenuAdded(records)) return;
      applyCallPolicy();
    });
    try {
      state.callObserver.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
    publishStatus();
  }

  function startStatusTimer() {
    if (state.statusTimer !== null || document.hidden) return;
    state.statusTimer = window.setInterval(publishStatus, 2500);
  }

  function stopStatusTimer() {
    if (state.statusTimer === null) return;
    window.clearInterval(state.statusTimer);
    state.statusTimer = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopStatusTimer();
      return;
    }
    if (state.started && state.active) {
      startStatusTimer();
      publishStatus();
    }
  });

})();
