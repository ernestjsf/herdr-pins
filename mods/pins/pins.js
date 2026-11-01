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
