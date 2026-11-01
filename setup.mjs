#!/usr/bin/env node
// One-step setup: node setup.mjs [--layout <name>] [--height <px>] [--place bottom|top|right|left] [--key <chord>] [--dry-run]
import { execFileSync } from "node:child_process";
import { copyFileSync, constants, cpSync, existsSync, lstatSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addKey, insertPinsColumn, isShipped, repairPinsColumn } from "./mods/pins/pins.js";

const say = (s) => console.log(s);
const fail = (s) => { console.error(`setup: ${s}`); process.exit(1); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const app = (...args) => execFileSync("herdr-app", args, { encoding: "utf8" });

const usage = "usage: node setup.mjs [--layout <name>] [--height <px>] [--place bottom|top|right|left] [--key <chord>] [--dry-run]";
const PLACES = ["bottom", "top", "right", "left"];
let asked, key, height = 360, place = "bottom", dry = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--dry-run") dry = true;
  else if (argv[i] === "--layout" && argv[i + 1]) asked = argv[++i];
  else if (argv[i] === "--height" && argv[i + 1]) height = Number(argv[++i]);
  else if (argv[i] === "--place" && PLACES.includes(argv[i + 1])) place = argv[++i];
  else if (argv[i] === "--key" && argv[i + 1]) key = argv[++i];
  else fail(`bad argument ${argv[i]}\n${usage}`);
}
if (!Number.isInteger(height) || height < 28 || height > 700) fail("--height must be a whole number from 28 to 700");

const home = process.env.HERDR_APP_HOME || join(homedir(), ".config", "herdr-app");
const repoMod = join(dirname(fileURLToPath(import.meta.url)), "mods", "pins");
const modDir = join(home, "mods", "pins");
const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
const note = dry ? "would " : "";

// 2. the mod, as a copy: Herdr draws no icons through a symlink. Run again after a pull to update it.
// Files Herdr writes into the folder (jsconfig.json, gpui-kit.d.ts) are kept.
const HERDR_WRITES = ["jsconfig.json", "gpui-kit.d.ts"];
const linked = isLink(modDir);
const update = !linked && existsSync(modDir);
if (linked) {
  say(`${note}replace the symlink at ${modDir} with a copy (Herdr draws no icons through a symlink)`);
  if (!dry) unlinkSync(modDir);
}
if (!dry) cpSync(repoMod, modDir, { recursive: true, force: true, filter: (src, dest) => !(HERDR_WRITES.includes(basename(src)) && existsSync(dest)) });
say(dry ? `would ${update ? "update" : "copy"} the mod at ${modDir}` : `${update ? "updated" : "copied"} the mod to ${modDir}`);
try { app("check", dry ? repoMod : modDir); say("herdr-app check: ok"); }
catch (e) { fail(`herdr-app check failed\n${e.stdout ?? ""}${e.stderr ?? ""}`); }

// 3. the layout
let picked = asked;
if (!picked) {
  try { picked = JSON.parse(readFileSync(join(home, "shared.json"), "utf8")).layout; } catch {}
}
picked ||= "main";
const name = isShipped(picked) ? `my-${picked}` : picked;
const file = (n) => join(home, "layouts", `${n}.json`);
const exists = existsSync(file(name));
if (isShipped(picked) && !exists) {
  say(`${note}clone ${picked} as ${name}`);
  if (!dry) {
    try { app("do", "layout.clone", JSON.stringify({ name: picked, as: name })); } catch (e) { fail(`layout.clone failed: ${e.stderr || e.message}`); }
    for (let i = 0; i < 50 && !existsSync(file(name)); i++) await wait(100);
    if (!existsSync(file(name))) fail(`${file(name)} did not appear within 5 s`);
  }
} else if (!existsSync(file(name))) fail(`no layout named ${name} in ${join(home, "layouts")}`);
else if (isShipped(picked)) say(`using existing ${name}`);

// 4. the column (a dry run of a not-yet-cloned layout reads the shipped file)
const source = existsSync(file(name)) ? file(name) : file(picked);
const text = readFileSync(source, "utf8");
const parsed = JSON.parse(text);
// Herdr's own save can drop the column's terminal block and leave the header loose: rebuild it.
const tree = repairPinsColumn(parsed);
if (tree !== parsed) {
  say(`${dry ? "would repair" : "repaired"} the pins column in ${name} (a Herdr layout save dropped its terminal block)`);
  if (!dry) writeFileSync(file(name), JSON.stringify(tree, null, 2) + "\n");
}
const next = insertPinsColumn(tree, { height, place });
if (next === tree) { say(`${name}: already set up (move the column with Move… in its header)`); await keys(); process.exit(0); }
if (!next) fail(`${name} has no block with content.tab "active"; add the column by hand (see README)`);
say(`${note}add the pins column (${height}px) ${{ bottom: "under", top: "over", right: "right of", left: "left of" }[place]} the tab area of ${name}`);
if (!dry) {
  try { copyFileSync(file(name), `${file(name)}.before-pins`, constants.COPYFILE_EXCL); say(`backed up to ${name}.json.before-pins`); } catch (e) { if (e.code !== "EEXIST") throw e; }
  writeFileSync(file(name), JSON.stringify(next, null, 2) + "\n");
}

// 5. the window
let now;
try { now = JSON.parse(app("status")).layout; } catch {}
if (now === name) say(`window already on ${name}`);
else if (now === undefined) say("could not read the window's layout; switch with: herdr-app do layout.switch '{\"name\":\"" + name + "\"}'");
else {
  say(`${note}switch the window from ${now} to ${name}`);
  if (!dry) app("do", "layout.switch", JSON.stringify({ name }));
}

await keys();

// 6. the one key, only when asked: `--key <chord>` binds it to pins.pick for this layout, unless the
// chord is bound anywhere in keys.json. Nothing else in the file changes.
async function keys() {
  if (!key) return say("no keys changed; to open Pin… with a key: node setup.mjs --key cmd-alt-o");
  const path = join(home, "keys.json"), error = join(home, "keys.error");
  if (existsSync(error)) fail(`Herdr rejects ${path} already (see ${error}); fix it first`);
  let text = "{}";
  try { text = readFileSync(path, "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; }
  let parsed;
  try { parsed = JSON.parse(text); } catch { fail(`${path} is not valid JSON; add "${key}": "pins.pick" by hand`); }
  const section = `layout:${name}`;
  const next = addKey(parsed, section, key, "pins.pick");
  if (!next) return say(`${key} is already bound in keys.json; no keys changed`);
  say(`${note}bind ${key} to pins.pick under "${section}" in keys.json`);
  if (dry) return;
  writeFileSync(path, JSON.stringify(next, null, 2) + "\n");
  await wait(1500); // Herdr reads it at once and writes keys.error when it rejects it
  if (existsSync(error)) {
    writeFileSync(path, text);
    fail(`Herdr rejected the key (${readFileSync(error, "utf8").trim()}); keys.json is back as it was`);
  }
}
