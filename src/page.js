import { verifyEvent } from "nostr-tools/pure";
import { npubEncode, noteEncode, neventEncode } from "nostr-tools/nip19";
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
    postSeq: 0,
  };

  const preparedEvents = new WeakSet();
  const nip07Wrappers = new WeakMap();

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

  function setConfig(settings) {
    const old = state.settings;
    state.settings = normalizeSettings(mergeSettings(state.settings, settings || {}));
    const enabled = state.settings.enabled !== false;
    const wasActive = state.active;
    state.active = enabled;
    if (enabled) {
      window.WebSocket = BetterWebSocket;
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
      post("recent", { events: state.eventOrder.slice(-limit).map((id) => state.events.get(id)).filter(Boolean) }, data.id);
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

  function flushLogs() {
    state.logTimer = null;
    if (!state.logBatch.length) return;
    const batch = state.logBatch.splice(0, state.logBatch.length);
    state.logs.push(...batch);
    trimLogs();
    if (state.settings.inspector.paused) {
      // The inspector can be paused, but incoming events must still reach the
      // content script for chimes and the event store.
      const incoming = batch.filter((log) => log.dir === "in" && log.event);
      if (incoming.length) post("logs", { logs: incoming.slice(-200) });
      return;
    }
    for (let i = 0; i < batch.length; i += 200) {
      post("logs", { logs: batch.slice(i, i + 200) });
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

  function handleIncomingFrame(data, url) {
    if (!state.active) return;
    if (typeof data !== "string") return;
    let frame;
    try {
      frame = JSON.parse(data);
    } catch {
      return;
    }
    if (!Array.isArray(frame)) return;
    const type = frame[0];
    if (type === "EVENT") {
      const ev = frame[2];
      if (isValidEvent(ev)) {
        if (!state.verifiedIncoming.has(ev.id)) {
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
        rememberEvent(ev, { dir: "in", relay: url });
        pushFrameLog({ dir: "in", relay: url, type, eventId: ev.id, kind: ev.kind, event: ev, summary: summarizeEvent(ev) });
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
      pushFrameLog({ dir: "out", relay: url, type: "EVENT", eventId: ev.id, kind: ev.kind, event: ev, summary: summarizeEvent(ev) });
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

  function prepareIncomingData(data) {
    if (!state.active) return { drop: false, data, translated: false };
    if (typeof data !== "string") return { drop: false, data, translated: false };
    let frame;
    try {
      frame = JSON.parse(data);
    } catch {
      return { drop: false, data, translated: false };
    }
    if (!Array.isArray(frame)) return { drop: false, data, translated: false };
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
      const prepared = prepareIncomingData(data);
      if (prepared.drop) return;
      if (!seenFrames.has(event)) {
        seenFrames.add(event);
        handleIncomingFrame(data, url);
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
        handleIncomingFrame(event?.data, url);
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
      notice("warning", "Call blocked", "Calling is disabled in Better Agnostr privacy settings.");
      return;
    }

    // Signed frames cannot be rewritten safely without the app's signer. The
    // pre-sign NIP-07 adapter is the only rewrite path; if a teleport tag still
    // reaches this point, block the event rather than re-signing it here.
    if (state.settings.privacy.omitTeleport && hasTeleportTag(ev.tags)) {
      pushFrameLog({
        dir: "out",
        relay: url,
        type: "BLOCKED_TELEPORT",
        eventId: ev.id,
        kind: ev.kind,
        summary: "outgoing teleport tag blocked by Better Agnostr",
      });
      notice("warning", "Teleport tag blocked", "The message was not sent because the teleport tag could not be removed before signing.");
      return;
    }

    handleOutgoingFrame(data, url);
    sendRaw(ws, data);
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
    if (!state.pubkey && !state.npub) return;
    state.pubkey = "";
    state.npub = "";
    publishStatus();
  }

  function patchNip07() {
    const provider = nip07Provider();
    if (!provider) {
      clearNip07Identity();
      if (state.nip07Patched || state.signMode !== "none") {
        state.nip07Patched = false;
        state.signMode = "none";
        publishStatus();
      }
      return false;
    }
    if (state.nip07Provider !== provider) {
      state.nip07Provider = provider;
      state.nip07IdentityAt = 0;
      state.pubkey = "";
      state.npub = "";
    }
    state.nip07Patched = true;
    state.signMode = "nip-07";
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
    state.signMode = "none";
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
    post("status", {
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
      relays: relaySnapshot(),
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

  function stopActiveWork() {
    if (state.statusTimer !== null) {
      window.clearInterval(state.statusTimer);
      state.statusTimer = null;
    }
    if (state.nip07Timer !== null) {
      window.clearInterval(state.nip07Timer);
      state.nip07Timer = null;
    }
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
    if (state.statusTimer === null) {
      state.statusTimer = window.setInterval(publishStatus, 2500);
    }
    state.callObserver = new MutationObserver(() => applyCallPolicy());
    try {
      state.callObserver.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
    publishStatus();
  }

})();
