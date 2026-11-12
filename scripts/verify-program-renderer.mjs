import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".next/standalone");
const runtimeRequire = createRequire(path.join(root, "server.js"));
const resolved = runtimeRequire.resolve("sharp");
assert.ok(resolved.startsWith(`${root}${path.sep}`), "Sharp must be packaged inside the release");
const sharp = runtimeRequire("sharp");
const { data, info } = await sharp({ text: {
  text: "Programação · Rincão · Ônibus", font: "Rubik 24",
  fontfile: path.join(root, "public/fonts/rubik-400.ttf"), width: 800, rgba: true,
} }).png().toBuffer({ resolveWithObject: true });
assert.ok(data.length > 0 && info.width > 0 && info.height > 0, "Program PNG rendering failed");
console.log("Program PNG renderer verified in the packaged release.");
