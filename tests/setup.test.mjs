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
