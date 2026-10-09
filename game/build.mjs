// build.mjs — пакует src/* + shell/head.html в единый dist/neon-warden_V2.html (blob-loader, как в v1).
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const root = dirname(fileURLToPath(import.meta.url));
const ORDER = ["three","audio","menu","biomes","rooms","worldgraph","world","fx","postfx","levelbuild","enemydefs","player","mapui","debugx","main"];
const payload = {};
for (const name of ORDER) {
  let src = readFileSync(join(root, "src", name + ".js"), "utf-8");
  payload[name] = src;
}
const shell = readFileSync(join(root, "shell", "head.html"), "utf-8");
const html = shell.replace("__MODSRC__", () => JSON.stringify(payload));
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "neon-warden_V2.html"), html);
console.log("built dist/neon-warden_V2.html", (html.length / 1048576).toFixed(2), "MB");
