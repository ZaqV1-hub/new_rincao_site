import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const standaloneRoot = path.join(projectRoot, ".next", "standalone");

async function assertDirectory(directory, label) {
  try {
    await access(directory);
  } catch {
    throw new Error(`${label} nao encontrado: ${directory}`);
  }
}

async function replaceDirectory(source, destination) {
  await assertDirectory(source, "Pasta de origem");
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

await assertDirectory(path.join(standaloneRoot, "server.js"), "Runtime standalone");
await replaceDirectory(
  path.join(projectRoot, "public"),
  path.join(standaloneRoot, "public"),
);
await replaceDirectory(
  path.join(projectRoot, ".next", "static"),
  path.join(standaloneRoot, ".next", "static"),
);

console.log("Assets do standalone sincronizados.");
