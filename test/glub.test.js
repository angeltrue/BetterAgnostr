import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidFlair,
  normalizeTemplate,
  renderFormatHtml,
  renderLineHtml,
  stripFormat,
  stripTrackingParams,
  tokenize,
} from "../src/lib/glub.js";
import { flairFxInner, flairLimit, flairName } from "../src/lib/glub-flair.js";

test("literal ampersands are escaped exactly once", () => {
  assert.equal(renderFormatHtml("A & B"), "A &amp; B");
  const bold = renderFormatHtml("&l A & B");
  assert.match(bold, /A &amp; B/);
  assert.doesNotMatch(bold, /&amp;amp;/);
});

test("URL query strings are not consumed as colour codes", () => {
  const url = "https://youtu.be/x?t=30&list=abc";
  assert.equal(stripFormat(url), url);
  assert.equal(tokenize(url).some((token) => token.t === "code"), false);
  assert.match(renderFormatHtml(url), /href="https:\/\/youtu\.be\/x\?t=30&amp;list=abc"/);
});

test("formatting codes still tokenize", () => {
  const tokens = tokenize("&l&ghello&r!");
  assert.equal(tokens.filter((token) => token.t === "code").length, 3);
  assert.equal(stripFormat("&l&ghello&r!"), "hello!");
});

test("templates without {msg} receive the body", () => {
  assert.equal(normalizeTemplate("&b{name}"), "&b{name} {msg}");
  assert.equal(normalizeTemplate("&b{name}: {msg}"), "&b{name}: {msg}");
  assert.equal(
    renderLineHtml("&l{name}: {msg}", { name: "ada", msgHtml: renderFormatHtml("hi & bye") }),
    '<span style="font-weight:700;">ada: hi &amp; bye</span>',
  );
});

test("tracking parameters are removed without rewriting the path", () => {
  assert.equal(
    stripTrackingParams("https://example.com/path?utm_source=x&a=1#frag"),
    "https://example.com/path?a=1#frag",
  );
  assert.equal(stripTrackingParams("https://example.com?utm_source=x"), "https://example.com");
  assert.equal(stripTrackingParams("https://example.com/story?ref=feed"), "https://example.com/story");
});

test("flair aliases and limits stay available to the UI", () => {
  assert.equal(flairName("plasma"), "plume");
  assert.equal(flairName("circuit"), "bitcoin");
  assert.equal(flairLimit("aurora"), 6);
  assert.equal(flairLimit("matrix"), 4);
  assert.equal(flairLimit("sol"), 0);
  assert.equal(isValidFlair("plasma"), true);
  assert.equal(isValidFlair("nonsense"), false);
});


test("run-spread particles keep their fixed size and gain vertical positions", () => {
  const fire = flairFxInner("fire", { spread: true });
  const bubbles = flairFxInner("bubbles", { spread: true });
  assert.match(fire, /--e-y:/);
  assert.match(bubbles, /--b-y:/);
  assert.match(fire, /--e-size:\dpx/);
  assert.match(bubbles, /--b-size:\dpx/);
  assert.doesNotMatch(flairFxInner("fire"), /--e-y:/);
  assert.doesNotMatch(flairFxInner("bubbles"), /--b-y:/);
});
