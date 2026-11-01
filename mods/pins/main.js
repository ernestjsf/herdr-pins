// A pinned terminal for a personal layout. This mod is the 28px header of a column
// whose other child is a `{ "terminal": "" }` block: it shows the terminal pinned for the
// current space (a space pin, else this machine's, else everywhere's) by rewriting that
// block's one address in the layout file, and folds the column to its header when
// nothing is pinned. Props: { block: "pins-terminal", column: "pins" }.
// With props { picker: true, space } it is the Pin… popup instead, with { mover: true } the
// Move… popup. Pins live in shared "pins.list".

import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, focused, panes, terminals, layout, theme, home, appHome, props, shared, setShared, run, hc, notify, readTextFile, writeTextFile, openOverlay, closeOverlay, nextCommand } from "herdr";
import { matchPin, upsertPin, replacedPin, paneBack, replaceBlockTerminal, startArgs, startedAddress, terminalName, needsRestart, movePinsColumn, parentOf } from "./pins.js";

const HEADER = 28;
const TAG = { space: "this space", machine: "this machine", all: "everywhere" };
const SCOPES = [["space", "Space"], ["machine", "Machine"], ["all", "All"]];
const icon = (name) => `mods/pins/icons/${name}.svg`;
const pickerHeight = (rows) => Math.min(440, 48 + rows * 30);
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

// Store a pin. A terminal whose tab has other panes moves into the pins block: its pane goes,
// the terminal keeps running. A lone pane stays: parking it closes its tab, and the last tab
// closes the space. A replaced pin that had moved its terminal gives it a pane back.
async function storePin(cx, pin) {
  const list = pinList();
  const pane = panes().find((p) => p.terminal === pin.terminal);
  const park = Boolean(pane) && panes().filter((p) => p.tab === pane.tab).length > 1;
  const moved = park || list.some((p) => p.terminal === pin.terminal && p.moved);
  const next = upsertPin(list, moved ? { ...pin, moved } : pin);
  setShared("pins.list", next);
  const old = replacedPin(list, pin);
  if (old) giveBack(old, next);
  if (park) await parkKept(cx, pin.terminal);
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

function findNode(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

export default class Pins extends View {
  init(_props, cx) {
    this.hovered = false;
    this.want = undefined; // the address the block shows; null: folded to the header
    if (props()?.picker || props()?.mover) return;
    // In a row the folded column is a 28px-wide strip: the file says where it is, a later move
    // in this window says it through shared "pins.place".
    this.placedAt = shared("pins.place")?.at;
    cx.spawn(async (cx) => {
      try { this.row = parentOf(JSON.parse(await readTextFile(layoutFile())), this.column)?.type === "row"; } catch {}
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

  async command(c, cx) {
    const s = currentSpace();
    const move = /^move[:-](bottom|top|right|left)$/.exec(c);
    if (c === "unpin") {
      const m = matchPin(pinList(), s);
      if (m) unpin(m);
    } else if (c === "pick") {
      this.openPicker(s, "dialog");
    } else if (c === "pin") {
      const t = focused()?.terminal;
      if (!t || !s) return;
      await storePin(cx, { terminal: t, scope: "space", space: s.id, machine: s.machine, folder: s.folder, argv: null, name: live(t)?.program?.name ?? t });
    } else if (move) {
      await moveColumn(move[1]);
    }
  }

  // Show `want` in the block, or fold the column to its header (null). Runs when the match changes.
  // The fold is resizes alone: Herdr's own layout save drops nodes hidden by a click and unwraps
  // what is left, so the block is never hidden. Folded, the column is 28px and the block 0px
  // (in a row the column is a strip and the block would fill it), with no terminal in it: its
  // address is "", so no live terminal is squeezed to nothing.
  sync(cx, want) {
    if (want === this.want) return;
    this.want = want;
    // An older version hid the block: show it once, or it stays hidden.
    if (findNode(layout(), this.block)?.hidden) run("layout.show", { id: this.block });
    if (!want) {
      run("layout.resize", { id: this.column, px: HEADER });
      run("layout.resize", { id: this.block, px: 0 });
    }
    cx.spawn(async () => {
      const path = layoutFile();
      await this.write(path, want);
      if (!want) return;
      const px = await this.height(path);
      if (this.want !== want) return;
      run("layout.resize", { id: this.block, weight: 1 });
      run("layout.resize", { id: this.column, px });
    });
  }

  // Swap the block's address in the layout file ("" when folded); the window follows within a
  // second. A stale snapshot rejects: read again and retry once.
  async write(path, want) {
    for (let i = 0; i < 2; i++) {
      const text = await readTextFile(path);
      if (text == null || this.want !== want) return;
      const next = replaceBlockTerminal(text, this.block, want ?? "");
      if (next === text) return;
      try {
        await writeTextFile(path, next, text);
        return;
      } catch {}
    }
  }

  // The column's open height: its size in the layout file, so that is the one knob.
  async height(path) {
    let px;
    try { px = findNode(JSON.parse(await readTextFile(path)), this.column)?.size?.px; } catch {}
    return typeof px === "number" && px > HEADER ? px : 240;
  }

  button(t, id, iconName, label, onClick) {
    return h_flex().id(id).flex_none().h(20).px(6).gap(4).items_center().rounded(5)
      .text_size(11).text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(); })
      .child(svg(icon(iconName)).size(12).flex_none())
      .child(label);
  }

  // From the header: a popup at the pointer. From a key: a centered dialog.
  openPicker(s, kind = "popup") {
    if (!s) return;
    openOverlay({ mod: "pins", props: { picker: true, space: s.id }, kind, width: 440, height: pickerHeight(2 + this.paneRows(s).length) });
  }

  render(cx) {
    if (props()?.picker) return this.renderPicker();
    if (props()?.mover) return this.renderMover();
    const t = theme();
    const s = currentSpace();
    const pin = matchPin(pinList(), s);
    const term = pin && live(pin.terminal);
    this.sync(cx, term ? pin.terminal : null);
    const placed = shared("pins.place");
    const row = placed && placed.at !== this.placedAt && placed.layout === shared("layout") ? placed.where === "right" || placed.where === "left" : this.row;
    // Folded in a row: a 28px-wide strip, too narrow for text. The pin icon; a click opens Pin….
    if (row && !term) {
      return h_flex().id("pins-head").size_full().justify_center().items_center().bg(t.background)
        .on_click(() => this.openPicker(s))
        .child(svg(icon("pin")).size(13).flex_none().text_color(pin ? t.accent : t.dim));
    }
    const pic = term && programIcon(term.program, 14, t.dim);
    return h_flex()
      .id("pins-head")
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
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

  // The live terminals of a space's tabs, for the picker.
  paneRows(s) {
    const tabs = new Set(s.tabs.map((c) => c.id));
    return panes().filter((p) => p.terminal && tabs.has(p.tab)).map((p) => ({
      terminal: p.terminal,
      label: ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell",
      program: p.program,
      cwd: p.cwd,
    }));
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
      const name = terminalName(row.argv?.[0] ?? "shell", cwd, Date.now().toString(36).slice(-4));
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
    await storePin(cx, { terminal, scope, space: s.id, machine: s.machine, folder: s.folder, argv: row.argv ?? null, name: row.argv?.[0] ?? row.label });
  }

  // The Move… popup: where the column goes beside the tab area. Esc closes it.
  renderMover() {
    const t = theme();
    return v_flex().id("pins-mover").w_full().p(5).bg(t.popover).text_size(12.8)
      .children(PLACES.map(([where, label, iconName]) => h_flex().id(`pins-move-${where}`).h(30).flex_none().px(8).gap(8).items_center().rounded(7)
        .text_color(t.foreground).hover((st) => st.bg(t.hover))
        .on_click((_e, cx) => cx.spawn(async () => {
          await moveColumn(where);
          closeOverlay(props().overlay);
        }))
        .child(svg(icon(iconName)).size(13).flex_none().text_color(t.muted))
        .child(label)));
  }

  renderPicker() {
    const t = theme();
    const s = spaces().find((x) => x.id === props().space);
    const rows = [
      { label: "Start lazygit here", argv: ["lazygit"] },
      { label: "Start a shell here", argv: null },
      ...(s ? this.paneRows(s) : []),
    ];
    const row = (r, i) => h_flex().id(`pins-row-${i}`).h(30).flex_none().px(8).gap(8).items_center().rounded(7)
      .hover((st) => st.bg(t.hover))
      .child(r.terminal ? (programIcon(r.program, 14, t.muted) ?? div().w(14).flex_none()) : svg(icon("play")).size(13).flex_none().text_color(t.muted))
      .child(div().flex_none().max_w(150).truncate().text_color(t.foreground).child(r.label))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(folder(r.terminal ? r.cwd : s && place(s))))
      .children(SCOPES.map(([scope, label]) => div().id(`pins-${i}-${scope}`).flex_none().h(20).px(6).flex().items_center().rounded(5)
        .border_1().border_color(t.border).text_size(11).text_color(t.muted)
        .hover((st) => st.bg(t.selected).text_color(t.foreground))
        .on_click((_e, cx) => cx.spawn(async (cx) => {
          await this.pick(props().space, r, scope, cx);
          closeOverlay(props().overlay);
        }))
        .child(label)));
    return v_flex().id("pins-picker").w_full().h(pickerHeight(rows.length)).min_h(0).p(5).bg(t.popover).text_size(12.8)
      .child(h_flex().h(28).flex_none().pl(8).items_center().text_size(11).text_color(t.dim)
        .child(div().flex_1().truncate().child(this.busy ? "Starting…" : `Pin in ${s?.name ?? "this space"}: for this space, this machine, or all`))
        .child(div().id("pins-close").p(4).rounded(4).hover((st) => st.bg(t.hover).text_color(t.foreground))
          .on_click(() => closeOverlay(props().overlay)).child(svg(icon("x")).size(12))))
      .child(v_flex().id("pins-rows").flex_1().min_h(0).overflow_y_scrollbar().children(rows.map(row)));
  }
}
