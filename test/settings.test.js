import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_SETTINGS, mergeSettings, normalizeSettings } from "../src/lib/settings.js";

test("malformed sections do not throw and fall back to defaults", () => {
  const samples = [
    { font: "x" },
    { studio: null },
    { privacy: "x" },
    { client: 5 },
    { glub: "x" },
    { ui: "x" },
    { privacy: { calls: null }, sounds: { events: "x" } },
  ];
  for (const sample of samples) {
    const settings = normalizeSettings(sample);
    assert.equal(settings.font.family, "default");
    assert.equal(settings.privacy.calls.disable, true);
    assert.equal(settings.sounds.events.chat, true);
    assert.equal(settings.ui.activeTab, "studio");
  }
});

test("enabled false survives normalization", () => {
  assert.equal(normalizeSettings({ enabled: false }).enabled, false);
  assert.equal(normalizeSettings({ enabled: true }).enabled, true);
});

test("partial popup writes merge without dropping unknown saved fields", () => {
  const base = normalizeSettings({ theme: { preset: "matrix-neo" }, client: { name: "Tester" } });
  const merged = normalizeSettings(mergeSettings(base, { enabled: false }));
  assert.equal(merged.enabled, false);
  assert.equal(merged.theme.preset, "matrix-neo");
  assert.equal(merged.client.name, "Tester");
});

test("default settings remain a complete schema", () => {
  const settings = normalizeSettings(DEFAULT_SETTINGS);
  assert.equal(settings.schema, 4);
  assert.equal(settings.preview, undefined);
  assert.equal(typeof settings.studio.template, "string");
  assert.ok(Array.isArray(settings.privacy.stripTags));
});
