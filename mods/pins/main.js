// A pinned terminal for a personal layout. This mod is the 28px header of a column
// whose other child is a `{ "terminal": "" }` block: it shows the terminal pinned for the
// current space (a space pin, else this machine's, else everywhere's) by rewriting that
// block's one address in the layout file, and folds the column to its header when
// nothing is pinned. Props: { block: "pins-terminal", column: "pins" }.
// With props { picker: true, space } it is the Pin… popup instead.
// Pins live in shared "pins.list"; the column's open height in "pins.height".

import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, focused, panes, terminals, theme, home, appHome, props, shared, setShared, run, hc, notify, readTextFile, writeTextFile, openOverlay, closeOverlay, nextCommand } from "herdr";
import { matchPin, upsertPin, replaceBlockTerminal, startArgs, terminalName, needsRestart } from "./pins.js";

const HEADER = 28;
const TAG = { space: "this space", machine: "this machine", all: "everywhere" };
const SCOPES = [["space", "Space"], ["machine", "Machine"], ["all", "All"]];
const icon = (name) => `mods/pins/icons/${name}.svg`;

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
const unpin = (pin) => setShared("pins.list", pinList().filter((p) => !same(p, pin)));

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
    if (props()?.picker) return;
    cx.spawn(async (cx) => {
      for (;;) {
        this.command(await nextCommand());
        cx.notify();
      }
    });
  }

  get block() { return props()?.block ?? "pins-terminal"; }
  get column() { return props()?.column ?? "pins"; }

  command(c) {
    const s = currentSpace();
    if (c === "unpin") {
      const m = matchPin(pinList(), s);
      if (m) unpin(m);
    } else if (c === "pin") {
      const t = focused()?.terminal;
      if (!t || !s) return;
      setShared("pins.list", upsertPin(pinList(), { terminal: t, scope: "space", space: s.id, machine: s.machine, folder: s.folder, argv: null, name: live(t)?.program?.name ?? t }));
    }
  }

  // Show `want` in the block, or fold the column to its header (null). Runs when the match changes.
  sync(cx, want) {
    if (want === this.want) return;
    this.want = want;
    if (!want) {
      run("layout.hide", { id: this.block });
      run("layout.resize", { id: this.column, px: HEADER });
      return;
    }
    cx.spawn(async () => {
      const path = `${appHome()}/layouts/${shared("layout")}.json`;
      await this.write(path, want);
      const px = await this.height(path);
      if (this.want !== want) return;
      run("layout.show", { id: this.block });
      run("layout.resize", { id: this.column, px });
    });
  }

  // Swap the block's address in the layout file; the window follows within a second.
  // A stale snapshot rejects: read again and retry once.
  async write(path, want) {
    for (let i = 0; i < 2; i++) {
      const text = await readTextFile(path);
      if (text == null || this.want !== want) return;
      const next = replaceBlockTerminal(text, this.block, want);
      if (next === text) return;
      try {
        await writeTextFile(path, next, text);
        return;
      } catch {}
    }
  }

  // The column's open height: its size in the layout file, read once.
  async height(path) {
    let px = shared("pins.height");
    if (typeof px === "number") return px;
    try { px = findNode(JSON.parse(await readTextFile(path)), this.column)?.size?.px; } catch {}
    px = typeof px === "number" && px > HEADER ? px : 240;
    setShared("pins.height", px);
    return px;
  }

  button(t, id, iconName, label, onClick) {
    return h_flex().id(id).flex_none().h(20).px(6).gap(4).items_center().rounded(5)
      .text_size(11).text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(); })
      .child(svg(icon(iconName)).size(12).flex_none())
      .child(label);
  }

  openPicker(s) {
    if (!s) return;
    const rows = 2 + this.paneRows(s).length;
    openOverlay({ mod: "pins", props: { picker: true, space: s.id }, kind: "popup", width: 440, height: Math.min(440, 48 + rows * 30) });
  }

  render(cx) {
    if (props()?.picker) return this.renderPicker();
    const t = theme();
    const s = currentSpace();
    const pin = matchPin(pinList(), s);
    const term = pin && live(pin.terminal);
    this.sync(cx, term ? pin.terminal : null);
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
      terminal = s.machine ? `${s.machine}/${address}` : address;
    }
    setShared("pins.list", upsertPin(pinList(), { terminal, scope, space: s.id, machine: s.machine, folder: s.folder, argv: row.argv ?? null, name: row.argv?.[0] ?? row.label }));
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
    return v_flex().id("pins-picker").size_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .child(h_flex().h(28).flex_none().pl(8).items_center().text_size(11).text_color(t.dim)
        .child(div().flex_1().truncate().child(this.busy ? "Starting…" : `Pin in ${s?.name ?? "this space"}: for this space, this machine, or all`))
        .child(div().id("pins-close").p(4).rounded(4).hover((st) => st.bg(t.hover).text_color(t.foreground))
          .on_click(() => closeOverlay(props().overlay)).child(svg(icon("x")).size(12))))
      .child(v_flex().id("pins-rows").flex_1().min_h(0).overflow_y_scrollbar().children(rows.map(row)));
  }
}
