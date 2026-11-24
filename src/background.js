const BUILD_KEY = "betterAgnostr.glubBuild.v1";
const CACHE_MS = 2 * 60 * 1000;
const MAX_STALE_MS = 6 * 60 * 60 * 1000;

async function readCache() {
  try {
    const obj = await browser.storage.local.get(BUILD_KEY);
    const cached = obj?.[BUILD_KEY];
    if (cached && typeof cached.build === "string") return cached;
  } catch {}
  return null;
}

async function writeCache(value) {
  try {
    await browser.storage.local.set({ [BUILD_KEY]: value });
  } catch {}
}

async function fetchBuild() {
  const res = await fetch("https://glub.chat/", {
    cache: "no-store",
    credentials: "omit",
    redirect: "follow",
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) throw new Error(`glub.chat returned HTTP ${res.status}`);
  const html = await res.text();
  const match =
    html.match(/data-build="([^"]+)"/i) ||
    html.match(/data-build='([^']+)'/i) ||
    html.match(/"build"\s*:\s*"([^"]+)"/i);
  const build = match?.[1]?.trim();
  if (!build || !/^[a-zA-Z0-9._-]{3,64}$/.test(build)) {
    throw new Error("Could not find a build stamp in the glub.chat page.");
  }
  return build;
}

async function getGlubBuild({ force = false } = {}) {
  const cached = await readCache();
  const age = cached ? Date.now() - Number(cached.fetchedAt || 0) : Infinity;
  if (!force && cached && age < CACHE_MS) {
    return { build: cached.build, fetchedAt: cached.fetchedAt, cached: true };
  }
  try {
    const build = await fetchBuild();
    const value = { build, fetchedAt: Date.now() };
    await writeCache(value);
    return { build, fetchedAt: value.fetchedAt, cached: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (cached && age < MAX_STALE_MS) {
      return {
        build: cached.build,
        fetchedAt: cached.fetchedAt,
        cached: true,
        stale: true,
        error: message,
      };
    }
    return { build: "", fetchedAt: 0, error: message };
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== "object") return undefined;
  if (message.type === "getGlubBuild") {
    return getGlubBuild({ force: !!message.force }).catch((err) => ({
      build: "",
      fetchedAt: 0,
      error: String(err),
    }));
  }
  if (message.type === "warmGlubBuild") {
    return getGlubBuild({ force: false }).catch(() => null);
  }
  return undefined;
});

browser.runtime.onInstalled.addListener(() => {
  getGlubBuild({ force: true }).catch(() => {});
  try {
    browser.alarms.create("betterAgnostr.glubBuild", { periodInMinutes: 10 });
  } catch {}
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "betterAgnostr.glubBuild") {
    getGlubBuild({ force: true }).catch(() => {});
  }
});

// Also refresh on browser startup if an alarm was missed.
browser.runtime.onStartup.addListener(() => {
  getGlubBuild({ force: false }).catch(() => {});
});
