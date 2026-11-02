// A pinned terminal for a personal layout. This mod is the 28px header of a column
// whose other child is a `{ "terminal": "" }` block: it shows the terminal pinned for the
// current space (a space pin, else this machine's, else everywhere's) by rewriting that
// block's one address in the layout file, and folds the column to its header when
// nothing is pinned. Props: { block: "pins-terminal", column: "pins" }.
// With props { picker: true, space, terminal } it is the Pin… popup instead (the mod's keyboard
// hub), with { mover: true } the Move… popup, with { starter: true } the Add a command dialog.
// Pins live in shared "pins.list", the picker's Start rows in "pins.starters".

import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { spaces, focused, panes, terminals, layout, theme, home, appHome, props, shared, setShared, run, hc, notify, readTextFile, writeTextFile, openOverlay, closeOverlay, nextCommand } from "herdr";
import { matchPin, upsertPin, replacedPin, paneBack, replaceBlockTerminal, startArgs, startedAddress, terminalName, needsRestart, movePinsColumn, parentOf, repairPinsColumn, pinRows, foldSizes, draggedSize, sizeKey, pickerAction, DEFAULT_STARTERS, starterFromText, addStarter, removeStarter } from "./pins.js";

const HEADER = 28;
const TAG = { space: "this space", machine: "this machine", all: "everywhere" };
const SCOPES = [["space", "Space", "⏎"], ["machine", "Machine", "m"], ["all", "All", "a"]];
// The picker's footer: key caps, then what they do.
const KEYS = [[["↑", "↓"], "choose"], [["⏎"], "space"], [["m"], "machine"], [["a"], "all"], [["u"], "unpin"], [["g"], "go"],
  [["b", "t", "r", "l"], "move"], [["n"], "new"], [["x"], "remove"], [["esc"], "close"]];
const icon = (name) => `mods/pins/icons/${name}.svg`;
// Title 28, the order note 18, three section headings 24 each, the two-row footer 46, padding 10,
// rows 30 each.
const pickerHeight = (rows) => Math.min(480, 174 + rows * 30);
const PLACES = [["bottom", "Bottom", "panel-bottom"], ["top", "Top", "panel-top"], ["right", "Right", "panel-right"], ["left", "Left", "panel-left"]];
const layoutFile = () => `${appHome()}/layouts/${shared("layout")}.json`;

function programIcon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

function currentSpace() {
  const id = focused()?.space;
  return spaces().find((s) => s.id === id) ?? spaces().find((s) => s.active) ?? null;
}

const pinList = () => /** @type {any[]} */ (shared("pins.list") ?? []);
const live = (address) => terminals().find((t) => t.address === address && t.state === "live");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A pin that took its terminal out of its tab gives it a pane back (a new tab here) when it goes.
function giveBack(pin, pins) {
  if (paneBack(pin, pins) && live(pin.terminal)) run("terminal.keep", { terminal: pin.terminal, place: "tab" });
}

function unpin(pin) {
  const next = pinList().filter((p) => !same(p, pin));
  setShared("pins.list", next);
  giveBack(pin, next);
}

// Store a pin. A terminal with a pane moves into the pins block: its pane goes (a lone pane's
// tab closes), the terminal keeps running. A replaced pin that had moved its terminal gives it
// a pane back.
async function storePin(cx, pin) {
  const pane = panes().find((p) => p.terminal === pin.terminal);
  const park = Boolean(pane) && await roomToPark(cx, pane);
  const list = pinList();
  const moved = park || list.some((p) => p.terminal === pin.terminal && p.moved);
  const next = upsertPin(list, moved ? { ...pin, moved } : pin);
  setShared("pins.list", next);
  const old = replacedPin(list, pin);
  if (old) giveBack(old, next);
  if (park) await parkKept(cx, pin.terminal);
}

// Whether parking this pane leaves its space alive. The last pane of a space's last tab would
// close the space: give the space a shell tab first (in its live folder), and wait up to 2 s
// for it to show. It didn't: don't park, the pane stays where it is.
async function roomToPark(cx, pane) {
  const s = spaces().find((x) => x.tabs.some((t) => t.id === pane.tab));
  if (!s) return false;
  if (s.tabs.length > 1 || panes().filter((p) => p.tab === pane.tab).length > 1) return true;
  run("tab.new", { space: s.id, folder: place(s) });
  for (let i = 0; i < 20; i++) {
    await cx.sleep(100);
    if ((spaces().find((x) => x.id === s.id)?.tabs.length ?? 0) > 1) return true;
  }
  notify({ title: "The pane stays in its tab", body: `${s.name} got no new tab to keep it open`, level: "error" });
  return false;
}

// terminal.park removes the pane and, once the core applies it, turns keep off: wait for that
// (at most 3 s), then turn keep back on so the terminal outlives a core loss like a tab's does.
async function parkKept(cx, terminal) {
  run("terminal.park", { terminal });
  for (let i = 0; i < 10; i++) {
    await cx.sleep(300);
    const r = await hc(["get", terminal]).catch(() => null);
    try { if (JSON.parse(r.stdout).keep === false) break; } catch {}
  }
  await hc(["keep", terminal]).catch(() => {});
}

// Move the column beside the tab area in the layout file. A structural edit, so the file is
// rewritten whole (2-space JSON); the window reloads it and the clicks (the fold) follow the ids.
async function moveColumn(where) {
  const layout = shared("layout");
  const path = layoutFile();
  for (let i = 0; i < 2; i++) {
    const text = await readTextFile(path);
    if (text == null) return;
    let tree;
    try { tree = JSON.parse(text); } catch { return; }
    const next = movePinsColumn(tree, where);
    if (!next) return notify({ title: "Couldn't move the pins column", body: `${layout} has no pins column next to a tab area`, level: "error" });
    if (next === tree) return;
    try {
      await writeTextFile(path, JSON.stringify(next, null, 2) + "\n", text);
      setShared("pins.place", { layout, where, at: Date.now() });
      return;
    } catch {}
  }
}

// The layout file's text, with the pins column rebuilt first when Herdr's own save dropped part
// of it (see repairPinsColumn). Null when there is no file. A refused write means another copy
// changed the file meanwhile: read it again.
async function readRepaired(path) {
  const text = await readTextFile(path);
  if (text == null) return null;
  let tree;
  try { tree = JSON.parse(text); } catch { return text; }
  const fixed = repairPinsColumn(tree);
  if (fixed === tree) return text;
  const next = JSON.stringify(fixed, null, 2) + "\n";
  try { await writeTextFile(path, next, text); } catch { return readTextFile(path); }
  // Only a rebuilt column is news; the pin button coming back is quiet.
  if (!findNode(tree, "pins")) notify({ title: "Pins column repaired after a Herdr layout save", level: "info" });
  return next;
}

function findNode(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

const starterList = () => /** @type {any[]} */ (shared("pins.starters") ?? DEFAULT_STARTERS);

// The picker's rows, in three sections. Start new: the starters, then Add a command…. Pin an open
// terminal: the focused one first (when it isn't the one pinned here), then the space's other tab
// terminals, each named by its tab ("2 · Claude Code") so two alike stay apart. Pins: every pin
// (see pinRows), or one "No pins yet" row.
function pickerRows(s, terminal) {
  const start = "Start new", open = "Pin an open terminal", pinned = "Pins";
  const pins = pinRows(pinList(), spaces(), terminals(), matchPin(pinList(), s));
  const tabName = new Map(spaces().flatMap((x) => x.tabs.map((c) => [c.id, c.name])));
  const paneRow = (p) => {
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    return { section: open, terminal: p.terminal, name, label: `${tabName.get(p.tab)} · ${name}`, program: p.program, cwd: p.cwd };
  };
  const tabs = new Set((s?.tabs ?? []).map((c) => c.id));
  const focusedPane = terminal && terminal !== matchPin(pinList(), s)?.terminal && panes().find((p) => p.terminal === terminal);
  const self = focusedPane ? paneRow(focusedPane) : null;
  const own = panes().filter((p) => p.terminal && p.terminal !== self?.terminal && tabs.has(p.tab)).map(paneRow);
  return [
    ...starterList().map((st) => ({ section: start, starter: st, argv: st.argv, name: st.argv ? st.label : "shell", label: st.argv ? `Start ${st.label} here` : "Start a shell here" })),
    { section: start, add: true, label: "Add a command…" },
    ...(self ? [{ ...self, self: true, label: `Pin this pane · ${self.label}` }] : []),
    ...own,
    ...(pins.length ? pins.map((r) => ({ section: pinned, pinned: r })) : [{ section: pinned, empty: true, label: "No pins yet" }]),
  ];
}

// Herdr's pane.go keys don't leave a layout terminal block, so "go" is a toggle: from a pane to
// the pinned terminal, from the pinned terminal back to the pane that last had focus.
let lastPane = null;
function atPinned(s) {
  const f = focused(), m = matchPin(pinList(), s);
  return Boolean(f && m && !f.pane && f.terminal === m.terminal);
}
function goPinned(s, { atPin, back }) {
  const m = matchPin(pinList(), s);
  if (atPin) { if (back) run("pane.focus", { pane: back }); }
  else if (m && live(m.terminal)) run("pane.focus", { terminal: m.terminal });
}

function openPicker(spaceId, terminal, kind) {
  const s = spaces().find((x) => x.id === spaceId);
  if (s) openOverlay({ mod: "pins", props: { picker: true, space: spaceId, terminal, atPin: atPinned(s), back: lastPane }, kind, width: 480, height: pickerHeight(pickerRows(s, terminal).length) });
}

function openStarter(spaceId, terminal) {
  openOverlay({ mod: "pins", props: { starter: true, space: spaceId, terminal }, kind: "dialog", width: 420, height: 214 });
}

export default class Pins extends View {
  init(_props, cx) {
    this.hovered = false;
    this.want = undefined; // the address the block shows; null: folded to the header
    if (props()?.button) return;
    if (props()?.starter) this.initStarter(cx);
    if (props()?.picker || props()?.mover || props()?.starter) {
      this.at = props().mover ? 0 : -1; // the highlighted row; -1: not chosen yet
      this.hoverRow = -1;
      this.handle = cx.focus_handle();
      if (!props().starter) this.handle.focus();
      return;
    }
    // In a row the folded column is a 28px-wide strip: the file says where it is, a later move
    // in this window says it through shared "pins.place".
    this.placedAt = shared("pins.place")?.at;
    cx.spawn(async (cx) => {
      try { this.row = parentOf(JSON.parse(await readRepaired(layoutFile())), this.column)?.type === "row"; } catch {}
      cx.notify();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        await this.command(await nextCommand(), cx);
        cx.notify();
      }
    });
  }

  get block() { return props()?.block ?? "pins-terminal"; }
  get column() { return props()?.column ?? "pins"; }
  // This header's own block: the column's child that shows this mod.
  get header() { return findNode(layout(), this.column)?.children?.find((c) => c.content?.mod === "pins")?.id ?? "pins-header"; }



  async command(c, cx) {
    const s = currentSpace();
    const move = /^move[:-](bottom|top|right|left)$/.exec(c);
    if (c === "unpin") {
      const m = matchPin(pinList(), s);
      if (m) unpin(m);
    } else if (c === "pick") {
      this.openPicker(s, "dialog");
    } else if (c === "add") {
      if (s) openStarter(s.id, focused()?.terminal);
    } else if (c === "pin") {
      const t = focused()?.terminal;
      if (!t || !s) return;
      await storePin(cx, { terminal: t, scope: "space", space: s.id, machine: s.machine, folder: s.folder, argv: null, name: live(t)?.program?.name ?? t });
    } else if (move) {
      await moveColumn(move[1]);
    } else if (c === "move") {
      openOverlay({ mod: "pins", props: { mover: true }, kind: "dialog", width: 160, height: 130 });
    } else if (c === "focus") {
      goPinned(s, { atPin: atPinned(s), back: lastPane });
    }
  }

  // Show `want` in the block, or fold the column (null) to `fold`'s sizes (see foldSizes).
  // The fold is resizes alone: Herdr's own layout save drops a node that is hidden or 0px and
  // unwraps what is left, so nothing is ever hidden or 0px. Folded, the block shows no terminal:
  // its address is "", so no live terminal is squeezed to 1px.
  // Only an unfold (from folded, or the first render) sizes the column: to the size kept for this
  // layout and orientation (a drag, see remember), else the file's. One address for another
  // writes the address and nothing else, so a dragged size stays.
  sync(cx, want, fold, row) {
    const prev = this.want;
    if (want !== prev) {
      this.want = want;
      this.folded = null;
      // An older version hid the block: show it once, or it stays hidden.
      if (findNode(layout(), this.block)?.hidden) run("layout.show", { id: this.block });
      this.remembering = !want && Boolean(prev); // keep the open size before folding
      cx.spawn(async (cx) => {
        if (this.remembering) {
          await this.remember(row);
          this.remembering = false;
          cx.notify(); // the next render folds
        }
        const path = layoutFile();
        await this.write(path, want);
        if (!want || prev) return;
        const px = this.keptSize(row) ?? await this.height(path);
        if (this.want !== want) return;
        run("layout.resize", { id: this.header, px: HEADER });
        run("layout.resize", { id: this.block, weight: 1 });
        run("layout.resize", { id: this.column, px });
      });
    }
    // Open: keep a drag when layout() shows one (cheap; no write unless it changed). Never
    // clears: a layout() that shows only the file can't tell a drag from none.
    if (want) {
      const px = findNode(layout(), this.column)?.size?.px;
      if (typeof px === "number" && px > HEADER + 1 && px !== this.filePx) this.keep(row, px, this.filePx);
      return;
    }
    // Folded: resize only when the sizes change (pins.fold changed, or the column was unfolded).
    const key = JSON.stringify(fold);
    if (this.remembering || key === this.folded) return;
    this.folded = key;
    run("layout.resize", { id: this.column, ...fold.column });
    run("layout.resize", { id: this.header, ...fold.header });
    run("layout.resize", { id: this.block, ...fold.block });
  }

  // Swap the block's address in the layout file ("" when folded); the window follows within a
  // second. A stale snapshot rejects: read again and retry once.
  async write(path, want) {
    for (let i = 0; i < 2; i++) {
      const text = await readRepaired(path);
      if (text == null || this.want !== want) return;
      const next = replaceBlockTerminal(text, this.block, want ?? "");
      if (next === text) return;
      try {
        await writeTextFile(path, next, text);
        return;
      } catch {}
    }
  }

  // The column's open size in the layout file (240 when it has none), so that is the knob for
  // a size nobody dragged.
  async height(path) {
    let px;
    try { px = findNode(JSON.parse(await readTextFile(path)), this.column)?.size?.px; } catch {}
    this.filePx = typeof px === "number" && px > HEADER ? px : 240;
    return this.filePx;
  }

  keptSize(row) {
    return /** @type {any} */ (shared("pins.size"))?.[sizeKey(shared("layout"), row)] ?? null;
  }

  // Keep `px` as this layout's size for this orientation in shared "pins.size". A size equal to
  // the file's clears it, so editing the file is the knob again.
  keep(row, px, filePx) {
    if (!px || !filePx) return;
    const key = sizeKey(shared("layout"), row);
    const all = /** @type {any} */ (shared("pins.size")) ?? {};
    const next = px === filePx ? undefined : px;
    if (all[key] === next) return;
    const { [key]: _, ...rest } = all;
    setShared("pins.size", next === undefined ? rest : { ...rest, [key]: next });
  }

  // Before folding: the column's size now (a drag), from layout() or else the click state file
  // (layouts/.state, read only, never written), kept for the next unfold.
  async remember(row) {
    const filePx = await this.height(layoutFile());
    let statePx;
    try { statePx = JSON.parse(await readTextFile(`${appHome()}/layouts/.state/${shared("layout")}.json`)).nodes?.[this.column]?.size?.px; } catch {}
    this.keep(row, draggedSize({ layoutPx: findNode(layout(), this.column)?.size?.px, filePx, statePx }), filePx);
  }

  button(t, id, iconName, label, onClick) {
    return h_flex().id(id).flex_none().h(20).px(6).gap(4).items_center().rounded(5)
      .text_size(11).text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(); })
      .child(svg(icon(iconName)).size(12).flex_none())
      .child(label);
  }

  // From the header: a popup at the pointer. From a key: a centered dialog. The focused
  // terminal is read now: once the popup has the keyboard, focus is the popup's.
  openPicker(s, kind = "popup") {
    if (s) openPicker(s.id, focused()?.terminal, kind);
  }

  render(cx) {
    if (props()?.button) return this.renderButton();
    if (props()?.picker) return this.renderPicker();
    if (props()?.starter) return this.renderStarter();
    if (props()?.mover) return this.renderMover();
    const t = theme();
    const s = currentSpace();
    if (focused()?.pane) lastPane = focused().pane;
    const pin = matchPin(pinList(), s);
    const term = pin && live(pin.terminal);
    const placed = shared("pins.place");
    const row = placed && placed.at !== this.placedAt && placed.layout === shared("layout") ? placed.where === "right" || placed.where === "left" : Boolean(this.row);
    // Nothing pinned here: a sliver that draws only its background (the pin button floats over
    // the tab area instead), or with shared "pins.fold" "header" the folded header. A pin whose
    // terminal ended keeps the header, to say so.
    const fold = pin || shared("pins.fold") === "header" ? "header" : "sliver";
    this.sync(cx, term ? pin.terminal : null, foldSizes(fold), row);
    if (!term && fold === "sliver") return div().id("pins-head").size_full().bg(t.background);
    // Folded in a row: a 29px-wide strip, too narrow for text. The pin icon; a click opens Pin….
    if (row && !term) {
      return h_flex().id("pins-head").size_full().justify_center().items_center().bg(t.background)
        .on_click(() => this.openPicker(s))
        .child(svg(icon("pin")).size(13).flex_none().text_color(pin ? t.accent : t.dim));
    }
    const pic = term && programIcon(term.program, 14, t.dim);
    // Herdr draws no focus border on a layout terminal block, so the header shows it.
    const hasFocus = Boolean(term) && focused()?.terminal === pin.terminal && !focused()?.pane;
    return h_flex()
      .id("pins-head")
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .border_b(hasFocus ? 2 : 1)
      .border_color(hasFocus ? t.accent : t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => { if (term) run("pane.focus", { terminal: pin.terminal }); })
      .child(svg(icon("pin")).size(13).flex_none().text_color(pin ? t.accent : t.dim))
      .when(!pin, (el) => el.child(div().flex_1().truncate().text_color(t.dim).child("Nothing pinned here")))
      .when(Boolean(pin), (el) => el
        .when(Boolean(pic), (el) => el.child(pic))
        .child(div().flex_none().truncate().max_w(220).font_medium().text_color(term ? t.foreground : t.dim).child(term?.program?.name || pin.name || pin.terminal))
        .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(term ? folder(term.foreground?.cwd ?? term.cwd) : `${pin.terminal} has ended`))
        .child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.accent + "1f").text_size(10.5).font_medium().text_color(t.accent).child(TAG[pin.scope]))
        .when(needsRestart(pin, term), (el) => el.child(this.button(t, "pins-restart", "refresh", "Restart", () => hc(["send", pin.terminal, pin.argv.join(" ")])))))
      .when(this.hovered, (el) => el
        .child(this.button(t, "pins-pick", "pin", "Pin…", () => this.openPicker(s)))
        .child(this.button(t, "pins-move", "move", "Move…", () => openOverlay({ mod: "pins", props: { mover: true }, kind: "popup", width: 160, height: 130 })))
        .when(Boolean(pin), (el) => el.child(this.button(t, "pins-unpin", "pin-off", "Unpin", () => unpin(pin)))));
  }

  // The pin button, floating over the tab area (see PINS_BUTTON): while no pin shows for this
  // space, a 24px pin that opens Pin… as a dialog. Otherwise nothing, so Herdr draws no frame.
  renderButton() {
    const t = theme();
    const s = currentSpace();
    const pin = matchPin(pinList(), s);
    if (pin && live(pin.terminal)) return div();
    return div().id("pins-button").size(24).flex().items_center().justify_center().rounded(6).cursor_pointer()
      .text_color(t.dim).hover((st) => st.text_color(t.accent))
      .on_click(() => { if (s) openPicker(s.id, focused()?.terminal, "dialog"); })
      .child(svg(icon("pin")).size(14));
  }

  // Pin a row for a scope, starting its program first when it is a Start row.
  async pick(spaceId, row, scope, cx) {
    const s = spaces().find((x) => x.id === spaceId);
    if (!s || this.busy) return;
    let terminal = row.terminal;
    if (!terminal) {
      this.busy = true;
      cx.notify();
      const cwd = place(s);
      const name = terminalName(row.name, cwd, Date.now().toString(36).slice(-4));
      const r = await hc(startArgs({ folder: cwd, machine: s.machine, argv: row.argv, name })).catch((e) => ({ code: 1, stdout: "", stderr: String(e) }));
      this.busy = false;
      let address = null;
      try { address = JSON.parse(r.stdout).address; } catch {}
      if (r.code !== 0 || !address) {
        notify({ title: "Couldn't start it", body: (r.stderr || r.stdout).trim(), level: "error" });
        return;
      }
      terminal = startedAddress(address, s.machine);
    }
    await storePin(cx, { terminal, scope, space: s.id, machine: s.machine, folder: s.folder, argv: row.argv ?? null, name: row.name });
  }

  // The Move… popup: where the column goes beside the tab area. ↑/↓ and Enter, b t r l, Esc.
  renderMover() {
    const t = theme();
    const go = (where, cx) => cx.spawn(async () => {
      await moveColumn(where);
      closeOverlay(props().overlay);
    });
    return v_flex().id("pins-mover").track_focus(this.handle).w_full().p(5).bg(t.popover).text_size(12.8)
      .on_key_down((e, cx) => {
        const a = pickerAction(e.keystroke, { at: this.at, count: PLACES.length });
        if (a?.do === "move") this.at = a.at;
        else if (a?.do === "pin" && a.scope === "space") go(PLACES[this.at][0], cx);
        else if (a?.do === "place") go(a.where, cx);
        else if (a?.do === "close") closeOverlay(props().overlay);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .children(PLACES.map(([where, label, iconName], i) => h_flex().id(`pins-move-${where}`).h(30).flex_none().px(8).gap(8).items_center().rounded(7)
        .text_color(t.foreground).when(i === this.at, (el) => el.bg(t.hover)).hover((st) => st.bg(t.hover))
        .on_click((_e, cx) => go(where, cx))
        .child(svg(icon(iconName)).size(13).flex_none().text_color(t.muted))
        .child(label)));
  }

  // What a picker key or click does to the highlighted row (`this.at`); see pickerAction.
  act(a, rows, cx) {
    const p = props(), r = rows[this.at];
    const s = spaces().find((x) => x.id === p.space);
    if (a.do === "move") this.at = a.at;
    else if (a.do === "close") closeOverlay(p.overlay);
    else if (a.do === "add" || (r?.add && a.do === "pin" && a.scope === "space")) {
      closeOverlay(p.overlay);
      openStarter(p.space, p.terminal);
    } else if (r?.pinned && a.do === "pin") {
      // Enter on a pin: show its space (a space pin whose space is open), then close.
      if (a.scope !== "space") return;
      closeOverlay(p.overlay);
      const to = r.pinned.pin;
      if (to.scope === "space" && spaces().some((x) => x.id === to.space)) run("space.select", { id: to.space });
    } else if (r?.pinned && a.do === "remove") unpin(r.pinned.pin);
    else if (a.do === "pin" && r && !r.add && !r.empty) {
      cx.spawn(async (cx) => {
        await this.pick(p.space, r, a.scope, cx);
        closeOverlay(p.overlay);
      });
    } else if (a.do === "remove" && r?.starter) setShared("pins.starters", removeStarter(starterList(), r.starter));
    else if (a.do === "unpin") {
      const m = matchPin(pinList(), s);
      if (m) unpin(m);
      closeOverlay(p.overlay);
    } else if (a.do === "go") {
      closeOverlay(p.overlay);
      goPinned(s, { atPin: p.atPin, back: p.back });
    } else if (a.do === "place") cx.spawn(async () => {
      await moveColumn(a.where);
      closeOverlay(p.overlay);
    });
  }

  renderPicker() {
    const t = theme();
    const s = spaces().find((x) => x.id === props().space);
    const rows = pickerRows(s, props().terminal);
    if (this.at < 0) this.at = Math.max(0, rows.findIndex((r) => r.self));
    this.at = Math.min(this.at, rows.length - 1);
    const choose = (i, a) => (_e, cx) => { cx.stop_propagation(); this.at = i; this.act(a, rows, cx); cx.notify(); };
    const heading = (text) => div().h(24).flex_none().px(8).flex().items_end().pb(4).text_size(11).font_semibold().text_color(t.dim).child(text);
    const shell = (i) => h_flex().id(`pins-row-${i}`).h(30).flex_none().px(8).gap(8).items_center().rounded(7)
      .when(i === this.at, (el) => el.bg(t.hover)).hover((st) => st.bg(t.hover))
      .on_hover((on, cx) => { if (on) this.hoverRow = i; else if (this.hoverRow === i) this.hoverRow = -1; cx.notify(); })
      .on_click(choose(i, { do: "pin", scope: "space" }));
    const dim = (text) => div().flex_none().text_size(11).text_color(t.dim).child(text);
    // The × on the highlighted or hovered starter or pin.
    const showsX = (i) => i === this.at || i === this.hoverRow;
    const removeButton = (i) => div().id(`pins-${i}-remove`).flex_none().p(4).rounded(4)
      .text_color(t.dim).hover((st) => st.bg(t.selected).text_color(t.foreground))
      .on_click(choose(i, { do: "remove" })).child(svg(icon("x")).size(11));
    const pinRow = ({ pinned: r }, i) => shell(i)
      .child(svg(icon("pin")).size(13).flex_none().text_color(r.showing ? t.accent : t.dim))
      .child(div().flex_none().max_w(120).truncate().px(6).h(18).flex().items_center().rounded(5).bg(t.accent + "1f").text_size(10.5).font_medium().text_color(t.accent).child(r.tag))
      .child(div().flex_none().max_w(120).truncate().text_color(t.foreground).child(r.name))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(folder(r.folder)))
      .when(r.ended, (el) => el.child(dim("ended")))
      .child(dim(r.address))
      .when(showsX(i), (el) => el.child(removeButton(i)));
    const row = (r, i) => r.empty ? shell(i).child(div().text_color(t.dim).child(r.label)) : r.pinned ? pinRow(r, i) : shell(i)
      .child(r.terminal ? (programIcon(r.program, 14, t.muted) ?? div().w(14).flex_none()) : svg(icon(r.add ? "plus" : "play")).size(13).flex_none().text_color(t.muted))
      .child(div().flex_none().max_w(r.self ? 230 : 170).truncate().text_color(t.foreground).child(r.label))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(r.add ? "" : folder(r.terminal ? r.cwd : s && place(s))))
      .when(Boolean(r.terminal), (el) => el.child(dim(r.terminal)))
      .when(Boolean(r.starter) && showsX(i), (el) => el.child(removeButton(i)))
      .when(!r.add, (el) => el.children(SCOPES.map(([scope, label, key]) => h_flex().id(`pins-${i}-${scope}`).flex_none().h(20).px(6).gap(4).items_center().rounded(5)
        .border_1().border_color(t.border).text_size(11).text_color(t.muted)
        .hover((st) => st.bg(t.selected).text_color(t.foreground))
        .on_click(choose(i, { do: "pin", scope }))
        .child(div().text_color(t.dim).child(key))
        .child(label))));
    const body = rows.flatMap((r, i) => [...(i === 0 || rows[i - 1].section !== r.section ? [heading(r.section)] : []), row(r, i)]);
    const cap = (k) => div().flex_none().h(15).px(3).flex().items_center().rounded(3).border_1().border_color(t.border).text_size(10.5).text_color(t.dim).child(k);
    return v_flex().id("pins-picker").track_focus(this.handle).w_full().h(pickerHeight(rows.length)).min_h(0).p(5).bg(t.popover).text_size(12.8)
      .on_key_down((e, cx) => {
        const a = pickerAction(e.keystroke, { at: this.at, count: rows.length });
        if (!a) return;
        cx.stop_propagation();
        this.act(a, rows, cx);
        cx.notify();
      })
      .child(h_flex().h(28).flex_none().pl(8).items_center().text_size(11).text_color(t.dim)
        .child(div().flex_1().truncate().child(this.busy ? "Starting…" : `Pin in ${s?.name ?? "this space"}: for this space, this machine, or all`))
        .child(div().id("pins-close").p(4).rounded(4).hover((st) => st.bg(t.hover).text_color(t.foreground))
          .on_click(() => closeOverlay(props().overlay)).child(svg(icon("x")).size(12))))
      .child(div().h(18).flex_none().pl(8).truncate().text_size(11).text_color(t.dim).child("Shows the space pin, else the machine pin, else the everywhere pin."))
      .child(v_flex().id("pins-rows").flex_1().min_h(0).overflow_y_scrollbar().children(body))
      .child(h_flex().h(46).flex_none().px(8).pt(6).flex_wrap().content_start().gap_x(10).gap_y(4).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .children(KEYS.map(([keys, word]) => h_flex().flex_none().gap(3).items_center().children(keys.map(cap)).child(word))));
  }

  // The Add a command dialog: one line, Enter adds it to the Start rows and reopens the picker.
  initStarter(cx) {
    this.input = InputState.new({ value: "" });
    this.input.on("change", (_e, cx) => cx.notify());
    this.input.on("submit", () => this.saveStarter());
    this.inputFocused = true;
    this.input.on("focus", (_e, cx) => { this.inputFocused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.inputFocused = false; cx.notify(); });
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
  }

  saveStarter() {
    const p = props();
    const st = starterFromText(this.input.value());
    if (!st) return;
    setShared("pins.starters", addStarter(starterList(), st));
    closeOverlay(p.overlay);
    openPicker(p.space, p.terminal, "dialog");
  }

  renderStarter() {
    const t = theme();
    const p = props();
    const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).items_center().rounded(8)
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium().cursor_pointer()
      .hover((st) => st.opacity(0.88)).on_click(action).child(text);
    return v_flex().id("pins-starter").track_focus(this.handle).w_full().min_h(0).p(18).bg(t.popover).text_color(t.foreground)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().child("Add a command"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(div().pt(16).pb(7).text_size(11.5).text_color(t.dim).child("Command"))
      .child(Input.new(this.input).h(36).px(10).rounded(9).border_1().border_color(this.inputFocused ? t.accent : t.input).bg(t.background).text_size(12.8).text_color(t.foreground))
      .child(div().pt(6).text_size(11.5).text_color(t.dim).child("Starts in the space's folder, split on spaces: htop, npm run dev"))
      .child(h_flex().pt(20).gap(8).justify_end()
        .child(button("pins-starter-cancel", "Cancel", false, () => closeOverlay(p.overlay)))
        .child(button("pins-starter-add", "Add", true, () => this.saveStarter())));
  }
}
