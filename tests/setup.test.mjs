// setup.mjs's pure pieces. fixtures/main.json is Herdr's shipped main layout.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as P from "../mods/pins/pins.js";

const main = JSON.parse(readFileSync(new URL("fixtures/main.json", import.meta.url), "utf8"));
const find = (n, id) => (n.id === id ? n : (n.children ?? []).map((c) => find(c, id)).find(Boolean));

test("insertPinsColumn: the pins column goes under the tab block, in a wrapper column", () => {
  const out = P.insertPinsColumn(main, { height: 300 });
  const wrap = find(out, "main-column");
  assert.deepEqual(wrap.children.map((c) => c.id), ["main", "pins"]);
  assert.equal(wrap.gap, 8);
  assert.equal(wrap.children[1].size.px, 300);
  assert.deepEqual(find(out, "work-body").children.map((c) => c.id), ["main-column", "panel"]);
  assert.deepEqual(find(out, "pins-header").content, { mod: "pins", props: { block: "pins-terminal" } });
});

test("insertPinsColumn: every other node is intact and the input is untouched", () => {
  const before = structuredClone(main);
  const out = P.insertPinsColumn(main);
  assert.deepEqual(main, before);
  const body = find(out, "work-body");
  body.children[0] = find(out, "main");
  assert.deepEqual(out, main);
});

test("insertPinsColumn: a layout that has pins is returned as it is", () => {
  const once = P.insertPinsColumn(main);
  assert.equal(P.insertPinsColumn(once), once);
});

test("insertPinsColumn: null without a tab block", () => {
  const bare = { id: "root", type: "column", children: [{ id: "a", type: "block", content: { mod: "tabs" } }] };
  assert.equal(P.insertPinsColumn(bare), null);
});

test("isShipped: Herdr's own layouts only", () => {
  for (const n of ["main", "terminals", "win98"]) assert.equal(P.isShipped(n), true);
  for (const n of ["my-main", "pins-test"]) assert.equal(P.isShipped(n), false);
});

// The pins column under the tab area of the shipped main, as setup puts it.
const placed = P.insertPinsColumn(main);
const ids = (n) => (n.children ?? []).map((c) => c.id);
// The tree with the pins column and its wrapper gone: what must not change in a move.
const rest = (tree) => {
  const t = structuredClone(tree);
  const strip = (n) => {
    n.children = n.children?.flatMap((c) => (c.id === "pins" ? [] : /^main-(column|row)$/.test(c.id) ? c.children.filter((k) => k.id !== "pins") : [c]));
    n.children?.forEach(strip);
  };
  strip(t);
  return t;
};

test("movePinsColumn: the four places beside the tab block", () => {
  const cases = { bottom: ["main-column", "column", ["main", "pins"]], top: ["main-column", "column", ["pins", "main"]], right: ["main-row", "row", ["main", "pins"]], left: ["main-row", "row", ["pins", "main"]] };
  for (const [where, [id, type, order]] of Object.entries(cases)) {
    const out = P.movePinsColumn(placed, where);
    const wrap = find(out, id);
    assert.equal(wrap.type, type, where);
    assert.equal(wrap.gap, 8, where);
    assert.deepEqual(ids(wrap), order, where);
    assert.deepEqual(ids(find(out, "work-body")), [id, "panel"], where);
    assert.equal(P.pinsPlace(out), where);
    // The column itself is untouched, size included.
    assert.deepEqual(find(out, "pins"), find(placed, "pins"));
    assert.deepEqual(rest(out), rest(placed), where);
  }
});

test("movePinsColumn: round trips and the input is untouched", () => {
  const before = structuredClone(placed);
  for (const where of ["top", "right", "left"]) {
    const there = P.movePinsColumn(placed, where);
    assert.deepEqual(P.movePinsColumn(there, "bottom"), placed, where);
  }
  const r = P.movePinsColumn(placed, "right");
  assert.deepEqual(P.movePinsColumn(r, "left"), P.movePinsColumn(placed, "left"));
  assert.deepEqual(P.movePinsColumn(P.movePinsColumn(r, "top"), "right"), r);
  assert.deepEqual(placed, before);
});

test("movePinsColumn: the same tree when it is already there", () => {
  assert.equal(P.movePinsColumn(placed, "bottom"), placed);
  const r = P.movePinsColumn(placed, "right");
  assert.equal(P.movePinsColumn(r, "right"), r);
});

test("movePinsColumn: a column placed by hand elsewhere moves beside the tab block", () => {
  const hand = structuredClone(main);
  hand.children.push(P.pinsColumn(300));
  const out = P.movePinsColumn(hand, "right");
  assert.deepEqual(ids(find(out, "main-row")), ["main", "pins"]);
  assert.equal(find(out, "pins").size.px, 300);
  assert.deepEqual(ids(out), ids(main));
});

test("movePinsColumn: null without a pins column, a tab block or a known place", () => {
  assert.equal(P.movePinsColumn(main, "right"), null);
  const bare = { id: "root", type: "column", children: [P.pinsColumn()] };
  assert.equal(P.movePinsColumn(bare, "right"), null);
  assert.equal(P.movePinsColumn(placed, "middle"), null);
});

test("pinsPlace: null when the column is not beside the tab block", () => {
  assert.equal(P.pinsPlace(main), null);
  const hand = structuredClone(main);
  hand.children.push(P.pinsColumn());
  assert.equal(P.pinsPlace(hand), null);
});

test("insertPinsColumn: place puts the column right, left, top or bottom", () => {
  for (const where of ["bottom", "top", "right", "left"]) {
    const out = P.insertPinsColumn(main, { place: where });
    assert.equal(P.pinsPlace(out), where);
    assert.deepEqual(out, P.movePinsColumn(placed, where));
  }
});

test("addKey: adds the chord to the section, keeps everything else", () => {
  const keys = { global: { "cmd-t": "tab.new" }, terminal: { "alt-left": "send:\u001bb" }, "layout:my-main": { "cmd-g": "tabs-graph.graph" } };
  const before = structuredClone(keys);
  const out = P.addKey(keys, "layout:my-main", "cmd-alt-o", "pins.pick");
  assert.deepEqual(out, { ...before, "layout:my-main": { "cmd-g": "tabs-graph.graph", "cmd-alt-o": "pins.pick" } });
  assert.deepEqual(keys, before);
  assert.deepEqual(P.addKey({}, "layout:my-x", "cmd-alt-o", "pins.pick"), { "layout:my-x": { "cmd-alt-o": "pins.pick" } });
});

test("addKey: null when the chord is bound in any section", () => {
  const keys = { global: { "cmd-alt-o": "app.palette" }, "layout:my-main": {} };
  assert.equal(P.addKey(keys, "layout:my-main", "cmd-alt-o", "pins.pick"), null);
  assert.equal(P.addKey({ "layout:other": { "cmd-alt-o": "pins.pick" } }, "layout:my-main", "cmd-alt-o", "pins.pick"), null);
});

// fixtures/broken.json is my-main after Herdr's own save dropped the 0px pins-terminal and
// unwrapped pins into a loose pins-header in main-row (2 Nov 2026).
const broken = JSON.parse(readFileSync(new URL("fixtures/broken.json", import.meta.url), "utf8"));

test("repairPinsColumn: a loose header becomes the column again, in its place", () => {
  const before = structuredClone(broken);
  const out = P.repairPinsColumn(broken);
  assert.deepEqual(broken, before);
  assert.deepEqual(ids(find(out, "main-row")), ["main", "pins"]);
  assert.deepEqual(ids(find(out, "pins")), ["pins-header", "pins-terminal"]);
  assert.deepEqual(find(out, "pins-header").content, { mod: "pins", props: { block: "pins-terminal" } });
  assert.deepEqual(find(out, "pins-terminal").content, { terminal: "" });
  assert.equal(find(out, "pins").size.px, 360);
  assert.equal(P.pinsPlace(out), "right");
  // Nothing else changed.
  const back = structuredClone(out);
  find(back, "main-row").children[1] = find(broken, "pins-header");
  assert.deepEqual(back, broken);
});

test("repairPinsColumn: the same tree when the column is whole or there is no header", () => {
  assert.equal(P.repairPinsColumn(placed), placed);
  assert.equal(P.repairPinsColumn(main), main);
  const repaired = P.repairPinsColumn(broken);
  assert.equal(P.repairPinsColumn(repaired), repaired);
});

test("repairPinsColumn: a header left alone in its wrapper keeps the wrapper", () => {
  const header = { id: "pins-header", type: "block", size: { px: 28 }, content: { mod: "pins", props: { block: "pins-terminal" } } };
  const tree = { id: "root", type: "row", children: [{ id: "main", type: "block", content: { tab: "active" } }, { id: "main-column", type: "column", gap: 8, children: [header] }] };
  const out = P.repairPinsColumn(tree);
  assert.deepEqual(ids(find(out, "main-column")), ["pins"]);
  assert.deepEqual(ids(find(out, "pins")), ["pins-header", "pins-terminal"]);
});

test("repairPinsColumn: a block that survived elsewhere moves into the column, never twice", () => {
  const t = structuredClone(broken);
  find(t, "work-body").children.push({ id: "pins-terminal", type: "block", content: { terminal: "t9" } });
  const out = P.repairPinsColumn(t);
  assert.deepEqual(ids(find(out, "pins")), ["pins-header", "pins-terminal"]);
  assert.equal(find(out, "pins-terminal").content.terminal, "t9");
  assert.deepEqual(ids(find(out, "work-body")), ["main-row", "panel-body"]);
});
