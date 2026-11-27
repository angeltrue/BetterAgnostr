const api = globalThis.browser ?? globalThis.chrome;
const STORAGE_KEY = "betterAgnostr.settings.v1";

try {
  const version = api.runtime.getManifest().version;
  const el = document.getElementById("extensionVersion");
  if (el) el.textContent = `v${version}`;
} catch {}

async function activeTab() {
  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0] || null;
  } catch {
    return null;
  }
}

async function refresh() {
  const tab = await activeTab();
  const isAgnostr = /^https:\/\/agnostr\.com\//i.test(tab?.url || "");
  let enabled = true;
  try {
    const stored = await api.storage.local.get(STORAGE_KEY);
    enabled = stored?.[STORAGE_KEY]?.enabled !== false;
  } catch {}
  document.getElementById("enabled").checked = enabled;
  document.getElementById("openPanel").disabled = !isAgnostr || !enabled;
  document.getElementById("syncBuild").disabled = !enabled;
  document.getElementById("subtitle").textContent = !isAgnostr
    ? "open agnostr.com to use the in-page panel"
    : !enabled
      ? "paused globally"
      : "connected to this tab";

  if (!isAgnostr || !tab?.id || !enabled) return;
  try {
    const res = await api.tabs.sendMessage(tab.id, { type: "getPageState" });
    const status = res?.status || {};
    const signer = document.getElementById("signer");
    if (status.signerHooked) signer.textContent = status.signMode || "attached";
    else if (status.nip07Patched) signer.textContent = "NIP-07";
    else signer.textContent = "waiting";
    document.getElementById("build").textContent = res?.build ? res.build.slice(0, 10) : "not synced";
    document.getElementById("events").textContent = String(status.eventCount ?? "—");
  } catch {
    document.getElementById("subtitle").textContent = "reload the page to attach";
  }
}

document.getElementById("openPanel").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  try {
    await api.tabs.sendMessage(tab.id, { type: "openStudio", tab: "studio" });
  } catch {}
  window.close();
});

document.getElementById("enabled").addEventListener("change", async (event) => {
  const enabled = !!event.target.checked;
  try {
    const stored = await api.storage.local.get(STORAGE_KEY);
    const settings = stored?.[STORAGE_KEY] || {};
    await api.storage.local.set({ [STORAGE_KEY]: { ...settings, enabled } });
    const tabs = await api.tabs.query({ url: "https://agnostr.com/*" });
    for (const tab of tabs || []) {
      if (tab?.id) Promise.resolve(api.tabs.reload(tab.id)).catch(() => {});
    }
  } catch {}
  window.close();
});

document.getElementById("openSite").addEventListener("click", async () => {
  try {
    await api.tabs.create({ url: "https://agnostr.com/" });
  } catch {}
  window.close();
});

document.getElementById("syncBuild").addEventListener("click", async () => {
  const btn = document.getElementById("syncBuild");
  btn.disabled = true;
  btn.textContent = "syncing…";
  try {
    const res = await api.runtime.sendMessage({ type: "getGlubBuild", force: true });
    document.getElementById("build").textContent = res?.build ? res.build.slice(0, 10) : "failed";
  } catch {
    document.getElementById("build").textContent = "failed";
  } finally {
    btn.disabled = false;
    btn.textContent = "sync glub build";
  }
});

refresh();
