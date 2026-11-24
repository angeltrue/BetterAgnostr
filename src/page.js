import { finalizeEvent, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { decode, npubEncode, noteEncode, neventEncode } from "nostr-tools/nip19";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import {
  CHAT_KINDS,
  NOTE_KINDS,
  buildGlubTag,
  getTagValue,
  hasFormat,
  isValidFlair,
  kindGroup,
  parseGlubMeta,
  sanitizeTemplate,
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

(() => {
  if (window.__betterAgnostrPage) return;
  Object.defineProperty(window, "__betterAgnostrPage", { value: true, configurable: false });

  const MAX_EVENTS = 2000;
  const MAX_LOGS = 300;
  const state = {
    token: null,
    configReady: false,
    configWaiters: [],
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
    nip07Patched: false,
    signMode: "auto",
    pubkey: "",
    npub: "",
    signerScanTimer: null,
    statusTimer: null,
    pending: new Map(),
    requestSeq: 0,
    reviewSeq: 0,
    screenshotMode: false,
    buildPromise: null,
    buildRequestedAt: 0,
    startedAt: Date.now(),
    callDrops: 0,
    preparedCount: 0,
    postSeq: 0,
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
      window.postMessage(envelope, "*");
    } catch {}
    try {
      document.dispatchEvent(new CustomEvent("ba-page", { detail: JSON.stringify(envelope) }));
    } catch {}
  }

  function notice(level, title, detail = "") {
    post("notice", { level, title, detail });
  }

  function setConfig(settings) {
    const old = state.settings;
    state.settings = normalizeSettings(mergeSettings(state.settings, settings || {}));
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
      state.token = data.token || state.token;
      setConfig(parseSettingsPayload(data.payload?.settings));
      publishStatus();
      post("ready", { version: "1.1.4" });
      start();
      return;
    }
    if (data.token && state.token && data.token !== state.token) return;
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
    if (data.type === "inspectPeer") {
      const payload = data.payload || {};
      let pubkey = String(payload.pubkey || "").toLowerCase();
      let npub = String(payload.npub || "");
      if (!pubkey && npub) {
        try {
          const decoded = decode(npub);
          if (decoded?.type === "npub" && typeof decoded.data === "string") pubkey = decoded.data.toLowerCase();
        } catch {}
      }
      if (!pubkey) {
        if (data.id) post("response", { ok: false, error: "Invalid npub." }, data.id);
        return;
      }
      if (!npub) {
        try {
          npub = npubEncode(pubkey);
        } catch {}
      }
      const fn = findInspectPeerFn();
      if (!fn) {
        if (data.id) post("response", { ok: false, error: "Profile opener not found." }, data.id);
        return;
      }
      const context = findAppContext();
      let peer = null;
      try {
        peer = context?.getPeerByPubkey?.(pubkey) || null;
      } catch {}
      if (!peer) {
        peer = context?.peers?.find?.((p) => String(p?.pubkey || "").toLowerCase() === pubkey) || null;
      }
      if (!peer) {
        peer = context?.servers?.members?.find?.((p) => String(p?.pubkey || "").toLowerCase() === pubkey) || null;
      }
      const nickname = String(payload.nickname || peer?.nickname || "").trim();
      const displayHandle = peer?.displayHandle || (nickname ? `@${nickname}#${pubkey.slice(-4)}` : `@anon${pubkey.slice(-4)}#${pubkey.slice(-4)}`);
      const safePeer = {
        ...(peer || {}),
        pubkey,
        npub,
        nickname: nickname || peer?.nickname || "",
        displayHandle,
        lastSeenAt: Number(peer?.lastSeenAt) || Math.floor(Date.now() / 1000),
        isOnline: !!peer?.isOnline,
        isSelf: false,
        isTeleported: !!peer?.isTeleported,
        isMeshBridge: !!peer?.isMeshBridge,
        isBlocked: !!peer?.isBlocked,
        isTrusted: !!peer?.isTrusted,
        messageCount: Number(peer?.messageCount) || 0,
        channels: Array.isArray(peer?.channels) ? peer.channels : [],
      };
      try {
        fn(safePeer);
        if (data.id) post("response", { ok: true }, data.id);
        else post("notice", { level: "success", title: "Profile opened", detail: displayHandle });
      } catch (err) {
        if (data.id) post("response", { ok: false, error: err instanceof Error ? err.message : String(err) }, data.id);
      }
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
    const key = data.seq != null ? `seq:${data.seq}` : null;
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
    const data = event.data;
    if (!data || data.__ba !== true || data.dir !== "ui") return;
    handleUiEnvelope(data);
  });

  document.addEventListener("ba-ui", (event) => {
    try {
      const data = typeof event.detail === "string" ? JSON.parse(event.detail) : event.detail;
      handleUiEnvelope(data);
    } catch {}
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
      while (state.eventOrder.length > MAX_EVENTS) {
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
    try {
      const idx = JSON.parse(localStorage.getItem("agnostr:v2:msg_index") || "[]");
      if (Array.isArray(idx)) {
        for (const geo of idx) {
          const key = `agnostr:v2:msgs:${geo}`;
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          if (!Array.isArray(list)) continue;
          const hit = list.find((m) => m && m.id === id);
          if (!hit) continue;
          out.pubkey = String(hit.pubkey || hit.senderPubkey || "").toLowerCase();
          out.created_at = Number(hit.createdAt) || 0;
          out.kind = 20000;
          out.content = String(hit.content || "");
          const stored = Array.isArray(hit.tags) ? hit.tags.filter(Array.isArray).map((t) => t.map(String)) : [];
          out.tags = stored;
          const has = (name) => stored.some((t) => t[0] === name);
          if (!has("g")) out.tags.push(["g", geo]);
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
      const threads = JSON.parse(localStorage.getItem("agnostr:v2:dm_threads") || "[]");
      if (Array.isArray(threads)) {
        for (const thread of threads) {
          if (!thread || !Array.isArray(thread.messages)) continue;
          const hit = thread.messages.find((m) => m && m.id === id);
          if (!hit) continue;
          out.pubkey = String(hit.senderPubkey || hit.pubkey || "").toLowerCase();
          out.created_at = Number(hit.createdAt) || Math.floor(Number(hit.orderMs || 0) / 1000);
          out.kind = 4;
          out.content = String(hit.content || "");
          out.tags = Array.isArray(hit.tags) ? hit.tags.filter(Array.isArray).map((t) => t.map(String)) : [];
          if (!out.tags.some((t) => t[0] === "p")) out.tags.push(["p", String(thread.peerPubkey || "")]);
          if (hit.protocol && !out.tags.some((t) => t[0] === "t")) out.tags.push(["t", `agnostr-${hit.protocol}`]);
          return out;
        }
      }
    } catch {
      return null;
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
    if (state.settings.inspector.paused) {
      // Still keep a small history for the inspector, but don't stream to the UI.
      state.logs.push(...batch);
      trimLogs();
      return;
    }
    state.logs.push(...batch);
    trimLogs();
    post("logs", { logs: batch.slice(-200) });
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

  function isCallEvent(ev) {
    if (!ev || typeof ev !== "object") return false;
    if (ev.kind === 25050) return true;
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
      state.callDrops += 1;
      pushFrameLog({
        dir: "in",
        relay: "filtered",
        type: "BLOCKED_CALL",
        eventId: frame[2]?.id,
        kind: frame[2]?.kind,
        summary: "incoming call signal blocked by Better Agnostr",
      });
      return { drop: true, data, translated: false };
    }
    const translated = translateOkFrame(frame);
    if (translated !== frame) {
      return { drop: false, data: JSON.stringify(translated), translated: true };
    }
    return { drop: false, data, translated: false };
  }

  function wrapListener(fn, ws, url, seenFrames) {
    if (typeof fn !== "function") return fn;
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
      const s = state.sockets.get(ws);
      if (s) s.status = "open";
      state.relays.set(url, { ...(state.relays.get(url) || {}), url, status: "open", lastMessageAt: Date.now(), error: "" });
      pushFrameLog({ dir: "sys", relay: url, type: "OPEN", summary: "socket open" });
      publishStatus();
    });
    nativeAdd.call(ws, "close", (event) => {
      const s = state.sockets.get(ws);
      if (s) s.status = "closed";
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

  function sendRaw(ws, data) {
    try {
      nativeSend.call(ws, data);
    } catch (err) {
      pushFrameLog({ dir: "sys", relay: state.sockets.get(ws)?.url || "", type: "SEND_ERROR", summary: String(err?.message || err) });
    }
  }

  function handleSend(ws, data, url) {
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

    // Last-mile guard: if a signing path bypasses the normal prepare step and a
    // teleport tag survives, remove it before the signed frame reaches a relay.
    if (state.settings.privacy.omitTeleport && hasTeleportTag(ev.tags)) {
      const cleaned = { ...ev, tags: stripTeleportTags(ev.tags) };
      const resigned = resignEvent(cleaned);
      if (resigned) {
        state.aliases.set(ev.id, resigned.id);
        state.aliasReverse.set(resigned.id, ev.id);
        sendRaw(ws, JSON.stringify(["EVENT", resigned]));
        rememberEvent(resigned, { dir: "out", relay: url });
        pushFrameLog({
          dir: "out",
          relay: url,
          type: "EVENT",
          eventId: resigned.id,
          kind: resigned.kind,
          event: resigned,
          aliasOf: ev.id,
          summary: summarizeEvent(resigned),
        });
        post("alias", { from: ev.id, to: resigned.id });
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
      notice("warning", "Teleport tag blocked", "The message was not sent because the teleport tag could not be removed before signing.");
      return;
    }

    handleOutgoingFrame(data, url);

    if (state.signerHooked) {
      rememberEvent(ev, { dir: "out", relay: url });
      sendRaw(ws, data);
      return;
    }

    // Fallback for pages where the signer hook could not be attached. This path
    // re-signs with the local key if possible. It can change the event id, so the
    // alias map keeps the app's own message rows and OK responses coherent.
    (async () => {
      let prepared;
      let signed = ev;
      try {
        prepared = await prepareOutgoing(ev, { source: "socket-fallback" });
        if (prepared !== ev) {
          signed = resignEvent(prepared);
          if (signed) {
            state.aliases.set(ev.id, signed.id);
            state.aliasReverse.set(signed.id, ev.id);
            sendRaw(ws, JSON.stringify(["EVENT", signed]));
            rememberEvent(signed, { dir: "out", relay: url });
            pushFrameLog({
              dir: "out",
              relay: url,
              type: "EVENT",
              eventId: signed.id,
              kind: signed.kind,
              event: signed,
              aliasOf: ev.id,
              summary: summarizeEvent(signed),
            });
            post("alias", { from: ev.id, to: signed.id });
            return;
          }
        }
      } catch (err) {
        notice("error", "Outgoing event blocked", err instanceof Error ? err.message : String(err));
        return;
      }
      sendRaw(ws, JSON.stringify(["EVENT", signed]));
    })();
  }

  // ---------------------------------------------------------------------------
  // Signer hook
  // ---------------------------------------------------------------------------

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
    if (root instanceof Map) {
      let i = 0;
      for (const value of root.values()) {
        if (i++ > 40) break;
        const found = deepFindIdentityManager(value, depth - 1, seen);
        if (found) return found;
      }
      return null;
    }
    if (root instanceof Set) {
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
      const value = hook.memoizedState;
      const found = deepFindIdentityManager(value, 5, new Set());
      if (found) return found;
      hook = hook.next;
    }
    const child = inspectFiber(fiber.child, seen, depth + 1);
    if (child) return child;
    return inspectFiber(fiber.sibling, seen, depth + 1);
  }

  function findIdentityManager() {
    if (state.signerInstance && objectLooksLikeIdentityManager(state.signerInstance)) return state.signerInstance;
    const containers = [];
    const root = document.getElementById("root");
    if (root) containers.push(root);
    const nodes = document.querySelectorAll("body > div, body > main");
    for (const n of nodes) {
      if (containers.length > 6) break;
      containers.push(n);
    }
    for (const container of containers) {
      try {
        const keys = Object.keys(container);
        for (const key of keys) {
          if (key.startsWith("__reactContainer$")) {
            const found = inspectFiber(container[key], new Set(), 0);
            if (found) return found;
          }
          if (key.startsWith("__reactFiber$")) {
            let f = container[key];
            let guard = 0;
            while (f && guard++ < 200) {
              if (f.return === null) {
                const found = inspectFiber(f, new Set(), 0);
                if (found) return found;
              }
              f = f.return;
            }
          }
        }
      } catch {}
    }
    return null;
  }

  function objectLooksLikeAppContext(obj) {
    if (!obj || typeof obj !== "object") return false;
    try {
      return typeof obj.sendReaction === "function" && (Array.isArray(obj.messages) || !!obj.servers);
    } catch {
      return false;
    }
  }

  function deepFindAppContext(root, depth = 4, seen = new Set()) {
    if (!root || (typeof root !== "object" && typeof root !== "function")) return null;
    if (depth < 0 || seen.has(root)) return null;
    seen.add(root);
    if (objectLooksLikeAppContext(root)) return root;
    if (root instanceof Node || root === window || root === document) return null;
    if (root instanceof Map) {
      let i = 0;
      for (const value of root.values()) {
        if (i++ > 40) break;
        const found = deepFindAppContext(value, depth - 1, seen);
        if (found) return found;
      }
      return null;
    }
    if (root instanceof Set) {
      let i = 0;
      for (const value of root.values()) {
        if (i++ > 40) break;
        const found = deepFindAppContext(value, depth - 1, seen);
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
      const found = deepFindAppContext(value, depth - 1, seen);
      if (found) return found;
    }
    return null;
  }

  function inspectFiberForApp(fiber, seen, depth) {
    if (!fiber || seen.has(fiber) || depth > 24) return null;
    seen.add(fiber);
    const props = fiber.memoizedProps;
    if (props && typeof props === "object") {
      for (const value of Object.values(props)) {
        if (objectLooksLikeAppContext(value)) return value;
        if (value && typeof value === "object") {
          const nested = deepFindAppContext(value, 4, new Set());
          if (nested) return nested;
        }
      }
    }
    const stateNode = fiber.stateNode;
    if (stateNode && typeof stateNode === "object") {
      if (objectLooksLikeAppContext(stateNode)) return stateNode;
      const nested = deepFindAppContext(stateNode, 4, new Set());
      if (nested) return nested;
    }
    let hook = fiber.memoizedState;
    let guard = 0;
    while (hook && guard < 80) {
      guard += 1;
      const value = hook.memoizedState;
      const found = deepFindAppContext(value, 5, new Set());
      if (found) return found;
      hook = hook.next;
    }
    const child = inspectFiberForApp(fiber.child, seen, depth + 1);
    if (child) return child;
    return inspectFiberForApp(fiber.sibling, seen, depth + 1);
  }

  function findAppContext() {
    const containers = [];
    const root = document.getElementById("root");
    if (root) containers.push(root);
    const nodes = document.querySelectorAll("body > div, body > main");
    for (const n of nodes) {
      if (containers.length > 6) break;
      containers.push(n);
    }
    for (const container of containers) {
      try {
        for (const key of Object.keys(container)) {
          if (key.startsWith("__reactContainer$")) {
            const found = inspectFiberForApp(container[key], new Set(), 0);
            if (found) return found;
          }
          if (key.startsWith("__reactFiber$")) {
            let f = container[key];
            let guard = 0;
            while (f && guard++ < 200) {
              if (f.return === null) {
                const found = inspectFiberForApp(f, new Set(), 0);
                if (found) return found;
              }
              f = f.return;
            }
          }
        }
      } catch {}
    }
    return null;
  }

  function findInspectPeerFn() {
    const containers = [];
    const root = document.getElementById("root");
    if (root) containers.push(root);
    for (const n of document.querySelectorAll("body > div, body > main")) {
      if (containers.length > 6) break;
      containers.push(n);
    }
    const search = (fiber, seen, depth) => {
      if (!fiber || seen.has(fiber) || depth > 26) return null;
      seen.add(fiber);
      const props = fiber.memoizedProps;
      if (props && typeof props === "object") {
        if (typeof props.onInspectPeer === "function") return props.onInspectPeer;
        if (typeof props.onInspectAuthor === "function") return props.onInspectAuthor;
        if (typeof props.onInspectSender === "function") return props.onInspectSender;
      }
      return search(fiber.child, seen, depth + 1) || search(fiber.sibling, seen, depth + 1);
    };
    for (const container of containers) {
      try {
        for (const key of Object.keys(container)) {
          if (key.startsWith("__reactContainer$")) {
            const found = search(container[key], new Set(), 0);
            if (found) return found;
          }
          if (key.startsWith("__reactFiber$")) {
            let f = container[key];
            let guard = 0;
            while (f && guard++ < 200) {
              if (f.return === null) {
                const found = search(f, new Set(), 0);
                if (found) return found;
              }
              f = f.return;
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
        return instance.getSignMode();
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
      return material?.pubkey || "";
    } catch {
      return "";
    }
  }

  function patchIdentityManager(instance) {
    if (!instance) return false;
    const proto = Object.getPrototypeOf(instance);
    if (!proto || typeof proto.signEventWithMaterial !== "function") return false;
    state.signerInstance = instance;
    state.signMode = currentSignMode(instance);
    state.pubkey = signerPubkey(instance);
    try {
      state.npub = state.pubkey ? npubEncode(state.pubkey) : "";
    } catch {
      state.npub = "";
    }
    if (proto.__baBetterAgnostrPatched) {
      state.signerHooked = true;
      publishStatus();
      return true;
    }
    const original = proto.signEventWithMaterial;
    try {
      Object.defineProperty(proto, "__baBetterAgnostrPatched", {
        value: true,
        configurable: true,
        enumerable: false,
      });
      proto.signEventWithMaterial = async function (event, material) {
        const prepared = await prepareOutgoing(event, { source: "signer" });
        const signed = await original.call(this, prepared, material);
        if (isValidEvent(signed)) rememberEvent(signed, { dir: "signed", relay: "signer" });
        return signed;
      };
      state.signerHooked = true;
      publishStatus();
      notice("success", "Signer attached", "Outgoing event tools are active.");
      return true;
    } catch (err) {
      notice("warning", "Could not attach to signer", err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  function patchNip07() {
    if (!window.nostr || typeof window.nostr.signEvent !== "function") return false;
    if (window.nostr.__baBetterAgnostrPatched) return true;
    const original = window.nostr.signEvent;
    try {
      Object.defineProperty(window.nostr, "__baBetterAgnostrPatched", { value: true, configurable: true });
      window.nostr.signEvent = async function (event) {
        const prepared = await prepareOutgoing(event, { source: "nip07" });
        return original.call(this, prepared);
      };
      state.nip07Patched = true;
      publishStatus();
      return true;
    } catch {
      return false;
    }
  }

  function scanSigner() {
    if (!state.signerHooked) {
      const found = findIdentityManager();
      if (found) patchIdentityManager(found);
    }
    patchNip07();
  }

  function startSignerWatch() {
    if (state.signerScanTimer !== null) return;
    state.signerScanTimer = window.setInterval(scanSigner, state.signerHooked ? 5000 : 900);
    scanSigner();
  }

  // ---------------------------------------------------------------------------
  // Outgoing event preparation
  // ---------------------------------------------------------------------------

  function cloneTags(tags) {
    return Array.isArray(tags) ? tags.map((t) => (Array.isArray(t) ? [...t] : t)) : [];
  }

  function markPrepared(ev) {
    try {
      Object.defineProperty(ev, "__baPrepared", { value: true, enumerable: false, configurable: true });
    } catch {}
    return ev;
  }

  function isPrepared(ev) {
    return !!ev && ev.__baPrepared === true;
  }

  async function ensureBuild(force = false) {
    const manual = state.settings.glub.manualBuild;
    if (manual) return manual;
    const cached = state.settings.glub.build;
    const age = Date.now() - Number(state.settings.glub.buildFetchedAt || 0);
    if (!force && cached && age < 2 * 60 * 1000) return cached;
    if (state.buildPromise) return state.buildPromise;
    state.buildRequestedAt = Date.now();
    state.buildPromise = (async () => {
      const res = await askUi("build", { force, current: cached }, 4500);
      if (res && res.build) {
        state.settings.glub.build = String(res.build);
        state.settings.glub.buildFetchedAt = Number(res.fetchedAt) || Date.now();
        publishStatus();
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
    if (policy === "spoof" && !settings.client.name.trim()) return;
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
    if (typeof ev.content !== "string" || !ev.content) return;
    if (!/https?:\/\//i.test(ev.content)) return;
    ev.content = stripTrackingParams(ev.content);
  }

  async function applyGlub(ev, group) {
    const settings = state.settings;
    const groupPolicy = policyForKind(settings, ev.kind);
    const wantsGlubClient =
      groupPolicy === "spoof" &&
      settings.client.name.trim().toLowerCase() === "glub.chat" &&
      !settings.privacy.stripTags.includes("client");
    if (!CHAT_KINDS.has(ev.kind) && !NOTE_KINDS.has(ev.kind) && group !== "chat" && !wantsGlubClient) return;
    const existing = parseGlubMeta(ev.tags);
    const isChat = group === "chat" && ev.kind !== 20001;
    let rich = typeof existing.rich === "string" ? existing.rich : "";
    let fmt = typeof existing.fmt === "string" ? sanitizeTemplate(existing.fmt) : "";
    let flair = typeof existing.flair === "string" && isValidFlair(existing.flair) ? existing.flair : "";

    if (settings.studio.applyRich && typeof ev.content === "string" && hasFormat(ev.content)) {
      const stripped = stripFormat(ev.content);
      if (ev.content.length <= RICH_MAX) {
        rich = ev.content;
        ev.content = stripped;
      } else {
        ev.content = stripped;
        rich = "";
        notice("warning", "Formatting skipped", "The message is too long for glub rich formatting; codes were removed.");
      }
    }

    if (settings.studio.enabled && isChat) {
      const tpl = sanitizeTemplate(settings.studio.template);
      if (tpl) fmt = tpl;
      if (settings.studio.flair && isValidFlair(settings.studio.flair)) flair = settings.studio.flair;
    }

    const needsGlub = !!(rich || fmt || flair);
    if (!needsGlub && !wantsGlubClient) return;

    const build = await ensureBuild();
    ev.tags = removeTagsByName(ev.tags, new Set(["glub"]));
    if (!build) {
      notice("warning", "Glub metadata skipped", "No live glub.chat build stamp is available yet. The message will still send, but glub.chat users will see plain text.");
      return;
    }
    const tag = buildGlubTag({ rich, fmt, flair }, build);
    if (tag) ev.tags.push(tag);
    else if (wantsGlubClient) ev.tags.push(["glub", "v", build]);
  }

  async function prepareOutgoing(original, opts = {}) {
    if (!original || typeof original !== "object") return original;
    if (state.settings.enabled === false) return original;
    if (isPrepared(original)) return original;
    await waitForConfig();
    const settings = state.settings;
    if (!settings.studio.enabled && !settings.privacy.reviewEnabled && !settings.privacy.stripTracking) {
      // Still allow client spoofing even when the studio is off.
    }
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
          source: opts.source || "signer",
        },
        180000,
      );
      if (!decision || decision.action !== "send") {
        throw new Error("Outgoing event cancelled in the Better Agnostr review dialog.");
      }
      if (Array.isArray(decision.stripTags) && decision.stripTags.length) {
        const strip = new Set(decision.stripTags);
        for (const critical of ["g", "d", "e", "p", "k", "h", "a", "q"]) strip.delete(critical);
        ev.tags = removeTagsByName(ev.tags, strip);
      }
    }

    state.preparedCount += 1;
    // A new object, so the caller can't mutate our copy; mark it so nested hooks
    // (NIP-07 wrapper inside the signer hook) do not prepare it twice.
    return markPrepared(ev);
  }

  // ---------------------------------------------------------------------------
  // Local key fallback signing
  // ---------------------------------------------------------------------------

  function readJson(key, fallback) {
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
    const settings = readJson("agnostr:v2:settings", {});
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
      signerHooked: state.signerHooked,
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
    if (state.settings.enabled === false) return;
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

  function start() {
    if (state.started) return;
    state.started = true;
    startSignerWatch();
    if (state.statusTimer === null) {
      state.statusTimer = window.setInterval(publishStatus, 2500);
    }
    const observer = new MutationObserver(() => applyCallPolicy());
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
    publishStatus();
  }

  // Expose a tiny diagnostic object for the console and for the UI's help tab.
  try {
    Object.defineProperty(window, "__betterAgnostr", {
      value: {
        state,
        findIdentityManager,
        findAppContext,
        findInspectPeerFn,
        prepareOutgoing,
        ensureBuild,
        reconstructEvent,
      },
      configurable: true,
    });
  } catch {}
})();
