// The mod's pure logic. fixtures/layout.json is a real personal layout (a clone of
// Herdr's main) with the pins column added under the tabs. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as P from "../mods/pins/pins.js";

const layout = readFileSync(new URL("fixtures/layout.json", import.meta.url), "utf8");

const here = { id: "sp1", machine: null, folder: "/home/me/app" };
const remote = { id: "omarchy/sp2", machine: "omarchy", folder: "/home/me/app" };
const pin = (scope, terminal, more = {}) => ({ terminal, scope, space: null, machine: null, folder: null, argv: null, name: terminal, ...more });

test("matchPin: space beats machine beats all, whatever the list order", () => {
  const all = pin("all", "t1");
  const machine = pin("machine", "t2");
  const space = pin("space", "t3", { space: "sp1", folder: "/home/me/app" });
  assert.equal(P.matchPin([all, machine, space], here), space);
  assert.equal(P.matchPin([all, machine], here), machine);
  assert.equal(P.matchPin([all], here), all);
  assert.equal(P.matchPin([], here), null);
  assert.equal(P.matchPin(null, here), null);
  assert.equal(P.matchPin([all], null), null);
});

test("matchPin: the first in list order wins within a priority", () => {
  const a = pin("all", "t1");
  const b = pin("all", "t2");
  assert.equal(P.matchPin([a, b], here), a);
  const s1 = pin("space", "t3", { space: "sp1" });
  const s2 = pin("space", "t4", { space: "sp1" });
  assert.equal(P.matchPin([a, s1, s2], here), s1);
});

test("matchPin: a space pin falls back to machine + folder when the id is gone", () => {
  const old = pin("space", "t3", { space: "sp-gone", folder: "/home/me/app" });
  assert.equal(P.matchPin([old], here), old);
  assert.equal(P.matchPin([old], { ...here, folder: "/home/me/other" }), null);
  // Same folder on another machine is another place.
  assert.equal(P.matchPin([old], remote), null);
  const there = pin("space", "omarchy/t9", { space: "sp-gone", machine: "omarchy", folder: "/home/me/app" });
  assert.equal(P.matchPin([there], remote), there);
  assert.equal(P.matchPin([there], here), null);
});

test("matchPin: machine null is this computer, a name is that machine", () => {
  const local = pin("machine", "t2", { machine: null });
  const omarchy = pin("machine", "omarchy/t9", { machine: "omarchy" });
  assert.equal(P.matchPin([local, omarchy], here), local);
  assert.equal(P.matchPin([local, omarchy], remote), omarchy);
  assert.equal(P.matchPin([omarchy], here), null);
  assert.equal(P.matchPin([local], remote), null);
});

test("upsertPin: one pin per scope and target", () => {
  const s1 = pin("space", "t3", { space: "sp1" });
  const s2 = pin("space", "t4", { space: "sp2" });
  const a = pin("all", "t1");
  assert.deepEqual(P.upsertPin([s1, a], s2), [s1, a, s2]);
  const again = pin("space", "t9", { space: "sp1" });
  assert.deepEqual(P.upsertPin([s1, a, s2], again), [again, a, s2]);
  const a2 = pin("all", "t8");
  assert.deepEqual(P.upsertPin([s1, a], a2), [s1, a2]);
  const m = pin("machine", "t5", { machine: "omarchy" });
  assert.deepEqual(P.upsertPin([pin("machine", "t6")], m), [pin("machine", "t6"), m]);
  assert.deepEqual(P.upsertPin(null, a), [a]);
});

test("replaceBlockTerminal: swaps only that block's address in a real layout", () => {
  assert.equal(P.blockTerminal(layout, "pins-terminal"), "");
  const out = P.replaceBlockTerminal(layout, "pins-terminal", "t66");
  assert.equal(P.blockTerminal(out, "pins-terminal"), "t66");
  assert.equal(out, layout.replace('"terminal": ""', '"terminal": "t66"'));
  assert.deepEqual(JSON.parse(out), JSON.parse(layout.replace('"terminal": ""', '"terminal": "t66"')));
  const back = P.replaceBlockTerminal(out, "pins-terminal", "");
  assert.equal(back, layout);
  assert.equal(P.replaceBlockTerminal(out, "pins-terminal", "omarchy/t9"), layout.replace('"terminal": ""', '"terminal": "omarchy/t9"'));
});

test("replaceBlockTerminal: the same text when equal or when the block is missing", () => {
  assert.equal(P.replaceBlockTerminal(layout, "pins-terminal", ""), layout);
  assert.equal(P.replaceBlockTerminal(layout, "nope", "t1"), layout);
  assert.equal(P.replaceBlockTerminal(layout, "pins-header", "t1"), layout); // a mod block has no terminal
  assert.equal(P.blockTerminal(layout, "nope"), null);
});

test("replaceBlockTerminal: several terminal blocks, any key order, ids elsewhere", () => {
  const text = `{
  "id": "root", "type": "row", "children": [
    { "id": "left", "type": "block", "content": { "terminal": "t1" } },
    { "type": "block", "content": { "terminal": "t2" }, "id": "pins-terminal" },
    { "id": "right",
      "type": "block",
      "content": {"terminal":"t3"}, "name": "pins-terminal" }
  ]
}
`;
  assert.equal(P.blockTerminal(text, "pins-terminal"), "t2");
  assert.equal(P.blockTerminal(text, "right"), "t3");
  const out = P.replaceBlockTerminal(text, "pins-terminal", "t66");
  assert.equal(out, text.replace('"terminal": "t2"', '"terminal": "t66"'));
  const out2 = P.replaceBlockTerminal(text, "right", "omarchy/t9");
  assert.equal(out2, text.replace('"terminal":"t3"', '"terminal":"omarchy/t9"'));
  assert.equal(P.replaceBlockTerminal(text, "left", "t1"), text);
});

test("replaceBlockTerminal: braces and quotes inside strings don't confuse it", () => {
  const text = `{"children":[{"id":"a","name":"x \\" } { \\"id\\": \\"b\\"","content":{"terminal":"t1"}},{"id":"b","content":{"terminal":"t2"}}]}`;
  assert.equal(P.blockTerminal(text, "a"), "t1");
  assert.equal(P.blockTerminal(text, "b"), "t2");
  assert.equal(P.replaceBlockTerminal(text, "b", "t9"), text.replace('"terminal":"t2"', '"terminal":"t9"'));
});

test("startArgs: a kept local program", () => {
  assert.deepEqual(P.startArgs({ folder: "/home/me/app", machine: null, argv: ["lazygit"], name: "pin-lazygit-app-x1" }), [
    "run", "--bg", "--keep", "--no-parent", "--outlive-parent", "--no-notify",
    "--name", "pin-lazygit-app-x1", "--cwd", "/home/me/app", "--json", "--", "lazygit",
  ]);
});

test("startArgs: on another machine, and a shell when there is no argv", () => {
  assert.deepEqual(P.startArgs({ folder: "/srv/api", machine: "omarchy", argv: ["lazygit"], name: "n" }), [
    "run", "--bg", "--keep", "--no-parent", "--outlive-parent", "--no-notify",
    "--name", "n", "--cwd", "/srv/api", "--on", "omarchy", "--json", "--", "lazygit",
  ]);
  assert.deepEqual(P.startArgs({ folder: "/srv/api", machine: null, argv: null, name: "n" }).slice(-2), ["/srv/api", "--json"]);
});

test("terminalName: what hc accepts, at most 32 characters", () => {
  assert.equal(P.terminalName("lazygit", "/home/me/herdr-devices", "k3"), "pin-lazygit-herdr-devices-k3");
  assert.equal(P.terminalName("shell", "", "k3"), "pin-shell-home-k3");
  const long = P.terminalName("lazygit", "/x/A Very Long Folder Name.With dots", "k3z9");
  assert.ok(long.length <= 32 && /^[a-z0-9_-]+$/.test(long) && long.endsWith("-k3z9"), long);
});

test("needsRestart: only a pinned program that came back as something else", () => {
  const lg = pin("space", "t3", { argv: ["lazygit"] });
  assert.equal(P.needsRestart(lg, { foreground: { argv: ["/opt/homebrew/bin/lazygit"] } }), false);
  assert.equal(P.needsRestart(lg, { foreground: { argv: ["/bin/zsh", "-l"] } }), true);
  assert.equal(P.needsRestart(lg, { argv: ["/bin/zsh", "-l"] }), true);
  assert.equal(P.needsRestart(pin("all", "t1"), { foreground: { argv: ["/bin/zsh"] } }), false);
  assert.equal(P.needsRestart(lg, null), false);
});
