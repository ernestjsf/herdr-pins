#!/usr/bin/env node
// One-step setup: node setup.mjs [--layout <name>] [--height <px>] [--dry-run]
import { execFileSync } from "node:child_process";
import { copyFileSync, constants, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { insertPinsColumn, isShipped } from "./mods/pins/pins.js";

const say = (s) => console.log(s);
const fail = (s) => { console.error(`setup: ${s}`); process.exit(1); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const app = (...args) => execFileSync("herdr-app", args, { encoding: "utf8" });

const usage = "usage: node setup.mjs [--layout <name>] [--height <px>] [--dry-run]";
let asked, height = 360, dry = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--dry-run") dry = true;
  else if (argv[i] === "--layout" && argv[i + 1]) asked = argv[++i];
  else if (argv[i] === "--height" && argv[i + 1]) height = Number(argv[++i]);
  else fail(`bad argument ${argv[i]}\n${usage}`);
}
if (!Number.isInteger(height) || height < 28 || height > 700) fail("--height must be a whole number from 28 to 700");

const home = process.env.HERDR_APP_HOME || join(homedir(), ".config", "herdr-app");
const repoMod = join(dirname(fileURLToPath(import.meta.url)), "mods", "pins");
const modLink = join(home, "mods", "pins");
const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
const note = dry ? "would " : "";

// 2. the mod
if (!existsSync(modLink) && !isLink(modLink)) {
  say(`${note}symlink ${modLink} -> ${repoMod}`);
  if (!dry) { mkdirSync(dirname(modLink), { recursive: true }); symlinkSync(repoMod, modLink); }
} else if (realpathSync(modLink) === realpathSync(repoMod)) say(`mod already linked at ${modLink}`);
else say(`${modLink} is something else; keeping it`);
try { app("check", existsSync(modLink) ? modLink : repoMod); say("herdr-app check: ok"); }
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
const tree = JSON.parse(text);
const next = insertPinsColumn(tree, { height });
if (next === tree) { say(`${name}: already set up`); process.exit(0); }
if (!next) fail(`${name} has no block with content.tab "active"; add the column by hand (see README)`);
say(`${note}add the pins column (${height}px) under the tab area of ${name}`);
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
