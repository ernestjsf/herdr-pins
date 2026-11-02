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

test("matchPin: a space pin matches its space's id only, never another space in the same folder", () => {
  const p = pin("space", "t3", { space: "sp1", folder: "/home/me/app" });
  assert.equal(P.matchPin([p], here), p);
  assert.equal(P.matchPin([p], { ...here, id: "sp9" }), null);
  const old = pin("space", "t3", { space: "sp-gone", folder: "/home/me/app" });
  assert.equal(P.matchPin([old], here), null);
  const there = pin("space", "omarchy/t9", { space: "omarchy/sp2", machine: "omarchy", folder: "/home/me/app" });
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

test("startedAddress: the machine prefix once, whatever hc printed", () => {
  assert.equal(P.startedAddress("t66", null), "t66");
  assert.equal(P.startedAddress("t10", "omarchy"), "omarchy/t10");
  assert.equal(P.startedAddress("omarchy/t10", "omarchy"), "omarchy/t10");
});

test("replacedPin: the pin at the same scope and target, else null", () => {
  const s1 = pin("space", "t3", { space: "sp1" });
  const a = pin("all", "t1");
  assert.equal(P.replacedPin([s1, a], pin("space", "t9", { space: "sp1" })), s1);
  assert.equal(P.replacedPin([s1, a], pin("all", "t9")), a);
  assert.equal(P.replacedPin([s1, a], pin("space", "t9", { space: "sp2" })), null);
  assert.equal(P.replacedPin(null, a), null);
});

test("paneBack: only a moved pin, and only when no pin left shows its terminal", () => {
  const moved = pin("space", "t3", { space: "sp1", moved: true });
  const other = pin("all", "t1");
  assert.equal(P.paneBack(moved, [other]), true);
  assert.equal(P.paneBack(moved, []), true);
  assert.equal(P.paneBack(moved, null), true);
  // Pinned again (or still pinned elsewhere): it stays in the pins block.
  assert.equal(P.paneBack(moved, [pin("machine", "t3")]), false);
  assert.equal(P.paneBack(pin("space", "t3", { space: "sp1" }), []), false);
  assert.equal(P.paneBack(null, []), false);
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

test("pickerAction: arrows wrap, letters pick a scope or an action, others do nothing", () => {
  assert.deepEqual(P.pickerAction("down", { at: 0, count: 3 }), { do: "move", at: 1 });
  assert.deepEqual(P.pickerAction("down", { at: 2, count: 3 }), { do: "move", at: 0 });
  assert.deepEqual(P.pickerAction("up", { at: 0, count: 3 }), { do: "move", at: 2 });
  assert.deepEqual(P.pickerAction("up", { at: 2, count: 3 }), { do: "move", at: 1 });
  assert.deepEqual(P.pickerAction("enter", { at: 1, count: 3 }), { do: "pin", scope: "space" });
  assert.deepEqual(P.pickerAction("m", { at: 1, count: 3 }), { do: "pin", scope: "machine" });
  assert.deepEqual(P.pickerAction("a", { at: 1, count: 3 }), { do: "pin", scope: "all" });
  assert.deepEqual(P.pickerAction("u", { at: 1, count: 3 }), { do: "unpin" });
  assert.deepEqual(P.pickerAction("g", { at: 1, count: 3 }), { do: "go" });
  assert.deepEqual(P.pickerAction("b", { at: 1, count: 3 }), { do: "place", where: "bottom" });
  assert.deepEqual(P.pickerAction("t", { at: 1, count: 3 }), { do: "place", where: "top" });
  assert.deepEqual(P.pickerAction("r", { at: 1, count: 3 }), { do: "place", where: "right" });
  assert.deepEqual(P.pickerAction("l", { at: 1, count: 3 }), { do: "place", where: "left" });
  assert.deepEqual(P.pickerAction("n", { at: 1, count: 3 }), { do: "add" });
  assert.deepEqual(P.pickerAction("x", { at: 1, count: 3 }), { do: "remove" });
  assert.deepEqual(P.pickerAction("escape", { at: 1, count: 3 }), { do: "close" });
  // A chord with a modifier is someone else's key.
  assert.equal(P.pickerAction("cmd-m", { at: 1, count: 3 }), null);
  assert.equal(P.pickerAction("shift-b", { at: 1, count: 3 }), null);
  assert.equal(P.pickerAction("q", { at: 1, count: 3 }), null);
  assert.equal(P.pickerAction("down", { at: 0, count: 0 }), null);
});

test("starterFromText: the first word (without its path) names it, whitespace splits it", () => {
  assert.deepEqual(P.starterFromText("  htop  "), { label: "htop", argv: ["htop"] });
  assert.deepEqual(P.starterFromText("/opt/homebrew/bin/btop --utf-force"), { label: "btop", argv: ["/opt/homebrew/bin/btop", "--utf-force"] });
  assert.deepEqual(P.starterFromText("npm  run\tdev"), { label: "npm", argv: ["npm", "run", "dev"] });
  assert.equal(P.starterFromText("   "), null);
  assert.equal(P.starterFromText(undefined), null);
});

test("addStarter / removeStarter: the defaults when unset, no duplicate commands, remove by value", () => {
  assert.deepEqual(P.DEFAULT_STARTERS, [{ label: "lazygit", argv: ["lazygit"] }, { label: "shell", argv: null }]);
  const htop = { label: "htop", argv: ["htop"] };
  const once = P.addStarter(undefined, htop);
  assert.deepEqual(once, [...P.DEFAULT_STARTERS, htop]);
  assert.equal(P.addStarter(once, { label: "htop", argv: ["htop"] }), once);
  assert.deepEqual(P.addStarter([], htop), [htop]);
  assert.deepEqual(P.removeStarter(once, { label: "lazygit", argv: ["lazygit"] }), [{ label: "shell", argv: null }, htop]);
  assert.deepEqual(P.removeStarter(undefined, P.DEFAULT_STARTERS[1]), [P.DEFAULT_STARTERS[0]]);
  assert.deepEqual(P.removeStarter([htop], P.DEFAULT_STARTERS[1]), [htop]);
});

test("pinRows: space pins in space order, then machine, then all; labels, showing and ended", () => {
  const spaces = [{ id: "sp1", name: "herdr-devices" }, { id: "sp2", name: "sportspots" }];
  const terms = [
    { address: "t74", state: "live", program: { name: "lazygit" }, foreground: { cwd: "/p/choosy" }, cwd: "/p" },
    { address: "t9", state: "live", program: { name: "zsh" }, cwd: "/home" },
    { address: "t73", state: "finished", program: { name: "zsh" }, cwd: "/x" },
  ];
  const all = pin("all", "t9", { name: "shell" });
  const mach = pin("machine", "omarchy/t2", { machine: "omarchy", name: "htop", folder: "/srv" });
  const local = pin("machine", "t9", { name: "zsh" });
  const s2 = pin("space", "t74", { space: "sp2", name: "lazygit", folder: "/p/choosy" });
  const s1 = pin("space", "t73", { space: "sp1", name: "zsh", folder: "/p/ai" });
  const gone = pin("space", "t5", { space: "sp-closed", name: "vim", folder: "/q" });
  const rows = P.pinRows([all, mach, s2, gone, local, s1], spaces, terms, s2);
  assert.deepEqual(rows.map((r) => r.pin), [s1, s2, gone, mach, local, all]);
  assert.deepEqual(rows.map((r) => r.tag), ["herdr-devices", "sportspots", "closed space", "omarchy", "this computer", "everywhere"]);
  assert.deepEqual(rows.map((r) => r.name), ["zsh", "lazygit", "vim", "htop", "zsh", "zsh"]);
  assert.deepEqual(rows.map((r) => r.folder), ["/p/ai", "/p/choosy", "/q", "/srv", "/home", "/home"]);
  assert.deepEqual(rows.map((r) => r.ended), [true, false, true, true, false, false]);
  assert.deepEqual(rows.map((r) => r.showing), [false, true, false, false, false, false]);
  assert.deepEqual(rows.map((r) => r.address), ["t73", "t74", "t5", "omarchy/t2", "t9", "t9"]);
});

test("pinRows: empty or missing list, and nothing showing", () => {
  assert.deepEqual(P.pinRows([], [], [], null), []);
  assert.deepEqual(P.pinRows(undefined, [], [], null), []);
  const a = pin("all", "t1");
  assert.equal(P.pinRows([a], [], [], null)[0].showing, false);
  // The showing pin is matched by value: shared state hands out fresh copies.
  assert.equal(P.pinRows([a], [], [], { ...a })[0].showing, true);
});

test("foldSizes: a sliver by default, the header when revealed or set to header, never 0px", () => {
  const sliver = { column: { px: 8 }, header: { px: 7 }, block: { px: 1 } };
  const header = { column: { px: 29 }, header: { px: 28 }, block: { px: 1 } };
  assert.deepEqual(P.foldSizes({}), sliver);
  assert.deepEqual(P.foldSizes({ fold: "sliver" }), sliver);
  assert.deepEqual(P.foldSizes({ fold: "nonsense" }), sliver);
  assert.deepEqual(P.foldSizes({ fold: "sliver", revealed: true }), header);
  assert.deepEqual(P.foldSizes({ fold: "header" }), header);
  assert.deepEqual(P.foldSizes({ fold: "header", revealed: true }), header);
  // In a row the header fills the strip, so all of it can be hovered.
  assert.deepEqual(P.foldSizes({ row: true }), { column: { px: 8 }, header: { weight: 1 }, block: { px: 1 } });
  assert.deepEqual(P.foldSizes({ row: true, revealed: true }), { column: { px: 29 }, header: { weight: 1 }, block: { px: 1 } });
});
