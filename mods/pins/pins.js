// The mod's logic without the app: which pin a space shows, how the layout file's
// one terminal address is swapped, and how a pinned program is started. Run: node --test tests/

const RANK = { space: 0, machine: 1, all: 2 };

// The pin a space shows: a space pin first (by id, else by machine + folder when
// the id is gone), then this machine's, then everywhere's; list order within each.
export function matchPin(pins, space) {
  if (!space) return null;
  const fits = (p) =>
    p.scope === "space" ? p.space === space.id || (p.machine === space.machine && p.folder === space.folder)
    : p.scope === "machine" ? p.machine === space.machine
    : p.scope === "all";
  let best = null;
  for (const p of pins ?? []) if (fits(p) && (!best || RANK[p.scope] < RANK[best.scope])) best = p;
  return best;
}

// What a pin is pinned to: one pin per (scope, target).
function target(p) {
  return p.scope === "space" ? `space:${p.space}` : p.scope === "machine" ? `machine:${p.machine}` : "all";
}

// The list with `pin` added, in place of an earlier pin for the same scope and target.
export function upsertPin(pins, pin) {
  const list = pins ?? [];
  const at = list.findIndex((p) => target(p) === target(pin));
  return at < 0 ? [...list, pin] : list.map((p, i) => (i === at ? pin : p));
}

// The pin that `pin` would replace: the one for the same scope and target, or null.
export function replacedPin(pins, pin) {
  return (pins ?? []).find((p) => target(p) === target(pin)) ?? null;
}

// A pin taken out of the list (unpinned or replaced) gets its pane back when pinning moved
// it out of its tab and no pin left in `pins` still shows that terminal.
export function paneBack(pin, pins) {
  return Boolean(pin?.moved) && !(pins ?? []).some((p) => p.terminal === pin.terminal);
}

// Where the block's `"terminal": "<address>"` value sits in the layout text: inside the
// object that has `"id": "<blockId>"`, whatever the key order. Null when absent.
function terminalValue(text, blockId) {
  const starts = [];
  let owner = -1; // depth of the object that has the id
  let idEnd = -1; // just past the last `"id"` string, to see `"id": "<blockId>"`
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      const s = text.slice(i + 1, j);
      if (owner < 0 && s === blockId && idEnd >= 0 && /^\s*:\s*$/.test(text.slice(idEnd, i))) owner = starts.length;
      idEnd = s === "id" ? j + 1 : -1;
      i = j;
    } else if (c === "{") starts.push(i);
    else if (c === "}") {
      const start = starts.pop();
      if (owner === starts.length + 1) {
        const m = /"terminal"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text.slice(start, i));
        if (!m) return null;
        const at = start + m.index + m[0].length - m[1].length - 1;
        return { at, end: at + m[1].length, value: m[1] };
      }
    }
  }
  return null;
}

// The address the block shows now, or null when the text has no such terminal block.
export function blockTerminal(text, blockId) {
  return terminalValue(text, blockId)?.value ?? null;
}

// The layout text with that block's terminal address replaced; nothing else changes.
// The same text when the address is already that, or the block isn't there.
export function replaceBlockTerminal(text, blockId, address) {
  const v = terminalValue(text, blockId);
  if (!v || v.value === address) return text;
  return text.slice(0, v.at) + JSON.stringify(address).slice(1, -1) + text.slice(v.end);
}

// `hc run` arguments for a kept terminal that outlives the mod: a program (argv) or,
// with no argv, that machine's shell. Prints {"address": "t66", ...}.
export function startArgs({ folder, machine, argv, name }) {
  return [
    "run", "--bg", "--keep", "--no-parent", "--outlive-parent", "--no-notify",
    "--name", name, "--cwd", folder,
    ...(machine ? ["--on", machine] : []),
    "--json",
    ...(argv?.length ? ["--", ...argv] : []),
  ];
}

// The address `hc run --json` printed, as the app names it: `<machine>/t9` for another
// machine. Core 0.1.15 prints it with the prefix already; older cores printed it bare.
export function startedAddress(address, machine) {
  return machine && !address.includes("/") ? `${machine}/${address}` : address;
}

// A name hc accepts (1-32 of a-z 0-9 - _), unique enough: pin-<what>-<folder>-<suffix>.
export function terminalName(what, folder, suffix) {
  const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const base = folder?.split("/").filter(Boolean).pop();
  return `pin-${slug(what)}-${slug(base) || "home"}`.slice(0, 31 - suffix.length) + "-" + suffix;
}

// A kept program came back as a shell (after a core restart): offer Restart.
export function needsRestart(pin, term) {
  if (!pin?.argv?.length || !term) return false;
  const name = (a) => String(a ?? "").split("/").pop();
  const now = term.foreground?.argv ?? term.argv;
  return name(now?.[0]) !== name(pin.argv[0]);
}

// ---- setup.mjs: putting the pins column into a personal layout ----

// Herdr rewrites these on every start, so they can't hold the column.
const SHIPPED = ["main", "terminals", "win98"];
export const isShipped = (name) => SHIPPED.includes(name);

// The README's column: a 28px header (the mod) over the terminal block the mod rewrites.
export function pinsColumn(height = 360) {
  return {
    id: "pins", type: "column", size: { px: height }, min: 28, max: 700,
    background: "background", radius: 10, border: { width: 1, color: "border" },
    focus: { border: { width: 1, color: "accent" } },
    children: [
      { id: "pins-header", type: "block", size: { px: 28 }, content: { mod: "pins", props: { block: "pins-terminal" } } },
      { id: "pins-terminal", type: "block", content: { terminal: "" } },
    ],
  };
}

const hasId = (n, id) => n.id === id || (n.children ?? []).some((c) => hasId(c, id));

// The node whose children hold `id`, or null.
export function parentOf(node, id) {
  for (const c of node.children ?? []) {
    if (c.id === id) return node;
    const hit = parentOf(c, id);
    if (hit) return hit;
  }
  return null;
}

// Where the pins column sits beside the tab block: "bottom", "top", "right", "left", else null.
export function pinsPlace(tree) {
  const p = parentOf(tree, "pins");
  if (p?.children.length !== 2 || !p.children.some((c) => c.content?.tab === "active")) return null;
  const first = p.children[0].id === "pins";
  return p.type === "row" ? (first ? "left" : "right") : p.type === "column" ? (first ? "top" : "bottom") : null;
}

// The wrapper each place puts around the tab block, and whether pins comes first.
const PLACES = {
  bottom: ["main-column", "column", false], top: ["main-column", "column", true],
  right: ["main-row", "row", false], left: ["main-row", "row", true],
};

// A copy of the layout tree with the pins column moved beside the tab block (the block showing
// `tab: "active"`): under it, over it, right or left of it, in a `main-column` or `main-row`
// wrapper (gap 8). The wrapper it leaves is replaced by its one remaining child. The same tree
// when it is already there; null when there is no pins column, no tab block or no such place.
export function movePinsColumn(tree, where) {
  const place = PLACES[where];
  if (!place) return null;
  if (pinsPlace(tree) === where) return tree;
  const out = JSON.parse(JSON.stringify(tree)); // no structuredClone in the mod runtime
  const parent = parentOf(out, "pins");
  if (!parent) return null;
  const pins = parent.children.splice(parent.children.findIndex((c) => c.id === "pins"), 1)[0];
  if (/^main-(column|row)$/.test(parent.id) && parent.children.length === 1) {
    const up = parentOf(out, parent.id);
    if (up) up.children[up.children.indexOf(parent)] = parent.children[0];
  }
  const [id, type, first] = place;
  const wrap = (node) => {
    const kids = node.children ?? [];
    const at = kids.findIndex((c) => c.content?.tab === "active");
    if (at < 0) return kids.some(wrap);
    kids[at] = { id, type, gap: 8, children: first ? [pins, kids[at]] : [kids[at], pins] };
    return true;
  };
  return wrap(out) ? out : null;
}

// A copy of the layout tree with the pins column added beside the tab area (`place`, default
// under it). The same tree when `pins` is already there; null when there is no tab block.
export function insertPinsColumn(tree, { height = 360, place = "bottom" } = {}) {
  if (hasId(tree, "pins")) return tree;
  if (!tree.children) return null;
  return movePinsColumn({ ...tree, children: [...tree.children, pinsColumn(height)] }, place);
}
