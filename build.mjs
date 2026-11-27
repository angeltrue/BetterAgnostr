import { build } from "esbuild";
import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const src = path.join(root, "src");

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "icons"), { recursive: true });
await mkdir(path.join(dist, "fonts"), { recursive: true });

const common = {
  bundle: true,
  format: "iife",
  target: ["firefox128"],
  platform: "browser",
  sourcemap: false,
  legalComments: "none",
  loader: { ".css": "text" },
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: [path.join(src, "page.js")],
  outfile: path.join(dist, "page.js"),
  minify: false,
});

await build({
  ...common,
  entryPoints: [path.join(src, "content.js")],
  outfile: path.join(dist, "content.js"),
  minify: false,
});

await build({
  ...common,
  entryPoints: [path.join(src, "background.js")],
  outfile: path.join(dist, "background.js"),
  minify: false,
});

await cp(path.join(src, "fonts"), path.join(dist, "fonts"), { recursive: true });
await cp(path.join(src, "manifest.json"), path.join(dist, "manifest.json"));
await cp(path.join(src, "popup.html"), path.join(dist, "popup.html"));
await cp(path.join(src, "popup.css"), path.join(dist, "popup.css"));
await cp(path.join(src, "popup.js"), path.join(dist, "popup.js"));

// Icons are pre-rendered and committed so builds do not depend on ImageMagick.
for (const size of [16, 32, 48, 128]) {
  await cp(
    path.join(src, "icons", `icon-${size}.png`),
    path.join(dist, "icons", `icon-${size}.png`),
  );
}

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(src, "manifest.json"), "utf8"));
if (pkg.version !== manifest.version) {
  throw new Error(`Version mismatch: package.json ${pkg.version} != manifest.json ${manifest.version}`);
}
const readme = await readFile(path.join(root, "README.md"), "utf8").catch(() => "");
if (readme) await writeFile(path.join(dist, "README.md"), readme);

const zipName = `better-agnostr-${pkg.version}.zip`;
const zipPath = path.join(root, zipName);
try {
  await rm(zipPath, { force: true });
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: dist });
  await cp(zipPath, zipPath.replace(/\.zip$/, ".xpi"));
  console.log(`\nPackaged ${zipName} and ${zipName.replace(/\.zip$/, ".xpi")}`);
} catch (err) {
  console.warn("Could not create zip:", err.message);
}

console.log(`\nUnpacked extension: ${dist}`);
