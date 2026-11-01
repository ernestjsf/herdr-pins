# Pins

A pinned terminal pane for a personal Herdr layout. A pin ties a terminal to
one space, one machine or everywhere; the pane shows the terminal pinned for the
current space and follows as spaces change. The everyday use is lazygit pinned
to each repo's space. The mod is the pane's 28px header; the terminal is a plain
layout block whose address the mod rewrites in the layout file.


## What you see

A column in the layout (the README puts it under the tabs: the `main` block and
it in a column, 8px gap), 240px tall, `background`, radius 10, 1px `border`,
`accent` border while the focus is inside. Top to bottom:

- **Header**, 28px, the mod. One row, 10px side padding, 8px gaps, 12px type, on
  `background`:
  - a 13px pin icon, `accent` when something is pinned here, else `dim`;
  - nothing pinned: `Nothing pinned here` in `dim`, truncated;
  - pinned: the program's icon at 14px (the app's program table: `svg` tinted
    `dim` when `tint`, else `image`), its name (`terminals()`' `program.name`, else
    the pin's `name`) medium weight in `foreground`, at most 220px, truncated;
    the terminal's live folder (`foreground.cwd`, else `cwd`; `~` for home,
    `~/…` under it) in `dim`, filling the row, truncated; the scope tag: 18px
    tall, 6px side padding, radius 5, `accent` at 12% (`accent` + `1f`) behind
    10.5px medium `accent` text, `this space`, `this machine` or `everywhere`;
  - a pinned terminal that is no longer live: the name in `dim` and `t7 has
    ended` where the folder goes;
  - a kept program that came back as something else (see Restart): a Restart
    button (refresh icon);
  - under the pointer only, at the right: **Pin…** (pin icon), **Move…** (move
    icon), and **Unpin** (pin-off icon) when something is pinned. Header buttons are 20px tall, 6px
    side padding, 4px gap, radius 5, 12px icon and 11px label in `muted`;
    `hover` behind and `foreground` under the pointer.
- **The terminal**, a layout block `{ "terminal": "<address>" }`, the rest of the
  column. With nothing (live) pinned the column is 28px and the block 0px, with
  no terminal in it (address `""`): only the header shows. It is never hidden.
- **In a row** (moved right or left) the folded column is a 28px-wide strip: the
  header is then only the pin icon, centered, and a click on it opens Pin…. Below
  it the strip is empty (the block is 0px).
- An empty address draws Herdr's placeholder card in the block: at 0px it does not
  show, which is why the block is resized to 0px and not only the column.

**The Move… popup** is 160 × 130 at the pointer, on `popover`, 5px padding,
12.8px type: four 30px rows, **Bottom**, **Top**, **Right**, **Left**, each a 13px
Lucide panel icon in `muted` and the label in `foreground`, radius 7, `hover` under
the pointer. Esc closes it.

**The picker** is a 440px popup at the pointer, its height 48 + 30 per row
(at most 440), on `popover`, 5px padding, 12.8px type:

- A 28px title line, 8px left padding, 11px `dim`: `Pin in <space name>: for this
  space, this machine, or all` (`Starting…` while a Start runs), and a close
  button (x icon, 12px, radius 4, `hover` under the pointer).
- Rows, 30px, 8px side padding, 8px gaps, radius 7, `hover` under the pointer,
  scrolling past the popup's height:
  - **Start lazygit here** and **Start a shell here**, each with a 13px play icon
    in `muted`, then the space's current folder at 11px `dim`;
  - then one row per terminal pane in the space's tabs (`panes()` with a
    `terminal`, in that order): its program icon at 14px (an empty 14px slot
    when none), its name as the pane header names it (an agent's or shell's
    program name, else the title, else the program's name, else `shell`), at
    most 150px, in `foreground`, and its live folder at 11px `dim`.
  - At the right of every row three buttons: **Space**, **Machine**, **All**:
    20px tall, 6px side padding, radius 5, 1px `border`, 11px `muted`;
    `selected` behind and `foreground` text under the pointer.


## How it behaves

**Pins** are kept in `shared("pins.list")`, an array of `{ terminal, scope:
"space" | "machine" | "all", space, machine, folder, argv, name }`. `terminal` is
the address (`t7`, or `machine/t7` for another machine). `space` is the space's
id, `machine` its machine (null for this computer), `folder` its `SpaceInfo.folder`
(the folder Herdr gives it, not where its shell is now), recorded for every scope.
`argv` is the program a Start ran (`["lazygit"]`), null for a shell or a picked
terminal; `name` a label (`argv[0]`, else the row's name).

**The match** for a space: a space pin whose `space` is the space's id, or (the
id gone, as after a core restart might do) whose `machine` and `folder` equal the
space's; else a machine pin whose `machine` equals the space's machine (null is
this computer); else an everywhere pin. The first in list order wins within a
kind. The current space is `spaces()`' entry for `focused().space` (the active
space if that is missing).

**One pin per scope and target**: pinning to a space that has a space pin
replaces it in place (the same for a machine, and for everywhere); otherwise the
pin is appended.

**Showing it**, on every render (Herdr re-renders on space and focus changes),
the header works out what the block should show: the match's address if that
terminal is in `terminals()` with `state` `live`, else nothing. Only when that
differs from what it last asked for:

- nothing: `layout.resize` the column to 28px and the block to 0px, then write
  `""` as the block's address (as below), so no live terminal is squeezed to 0px;
- an address: read the shown layout's file (`<appHome>/layouts/<shared("layout")>.json`),
  replace the `"terminal": "…"` value inside the object whose `"id"` is the block's
  id (whatever the key order; strings with braces or escaped quotes don't
  confuse it), and write it back with `writeTextFile(path, next, text)` only if
  it changed. A refused write (the file changed in between) reads again and
  retries once. Then resize the block to `weight: 1` and the column to its open
  height. If the wanted address changed meanwhile, the older task stops before
  writing or resizing.
- No `layout.hide`/`layout.show` (see Watch out). One exception: when `layout()`
  shows the block `hidden` (an older version folded with hide), it is shown once.
- The open height is the column's `size.px` in the layout file, read on each
  unfold (240 if missing or not above 28), so editing the file is the one knob.

Nothing else in the file is touched by the swap: no reformatting, no reordering. The window
reloads the edited layout by itself.

**The header**: a click on the row focuses the terminal block
(`pane.focus {terminal}`) when the pinned terminal is live. Pin… opens the
picker for the current space (`openOverlay({ mod: "pins", kind: "popup",
props: { picker: true, space } })`); Unpin removes the matched pin (by value)
from the list. Neither ends any terminal.

**Moving a pane in**: storing a pin (a picker row for a terminal, or the `pin` key)
first looks for the terminal's pane. When its tab has other panes, the pin is stored
with `moved: true` and the pane goes: `run("terminal.park", {terminal})`, then the
mod polls `hc get` (300 ms, at most 3 s) until `keep` is false (park applied) and
runs `hc keep <address>` (a `machine/t9` address works as is). A tab's only pane is
not parked: park closes the tab, and the last tab closes the space. A pin for a
terminal that another pin already moved is `moved` too. When a pin goes (Unpin, or
replaced by a pin for the same scope and target) and it was `moved` and no pin left
shows that terminal, the terminal gets a pane again if it is live:
`run("terminal.keep", {terminal, place: "tab"})`, a new tab in the current space.
Start rows never had a pane and are unchanged.

**Moving the column**: `movePinsColumn(tree, where)` takes the `pins` node out (a
`main-column`/`main-row` wrapper left with one child is replaced by it) and wraps
the block with `content.tab: "active"` in `{ id: "main-column", type: "column",
gap: 8 }` (bottom: pins after, top: before) or `{ id: "main-row", type: "row",
gap: 8 }` (right: after, left: before). The pins node is kept whole, `size.px`
included (a height in a column, a width in a row). The mod reads the layout file,
moves, and writes `JSON.stringify(_, null, 2)` with `writeTextFile(path, text,
expected)`, retrying once on a refused write; nothing to do when it is already
there; a toast when the file has no pins column or tab block. Then it sets shared
`pins.place` = `{ layout, where, at }`. The header knows it is in a row from its
parent's type in the file (read on start) or a later `pins.place` for its layout.
The fold's clicks (`layout.resize` on `pins-terminal` and `pins`) survive a move:
they belong to the ids.

**Restart**: after a core restart a kept terminal comes back as a shell. When the
pin has an `argv` and the live terminal's `foreground.argv[0]` (else `argv[0]`)
differs from it by file name (`/opt/homebrew/bin/lazygit` matches `lazygit`), the
header offers Restart, which runs `hc send <terminal> <argv joined by spaces>`.

**The picker**: a scope button pins its row. A Start row first starts the
program in the space's current folder (its first tab pane's live folder, else
`SpaceInfo.folder`): `hc run --bg --keep --no-parent --outlive-parent --no-notify
--name <name> --cwd <folder> [--on <machine>] --json [-- <argv…>]`, no argv for the
shell (hc then starts that machine's shell). The name is `pin-<program>-<folder's
last part>-<4 characters of the time in base 36>`, lowercased, other characters
as `-`, at most 32. With `--on`, core 0.1.15 prints the
`address` already prefixed (`omarchy/t10`; older cores printed it bare):
`startedAddress(address, machine)` adds `<machine>/` only when there is no `/`. A failed start toasts `Couldn't start it` with
hc's error and pins nothing. The popup closes after a pick.

**Keys**, through `nextCommand()` in the header copy (not the picker's):
`pin` pins `focused().terminal` to the current space (scope space, no argv, its
program's name as the label, moving its pane in as above); `unpin` removes the
current match; `pick` opens the picker; `move:<where>` moves the column (a
`pins.move:right` key delivers `move:right`). Hiding and
showing the column is Herdr's `layout.toggle:pins`, bound in keys.json.

Programs only start from a Start or Restart click.


## Setup

`setup.mjs` (Node, stdlib only; `node setup.mjs [--layout <name>] [--height <px>]
[--place bottom|top|right|left] [--dry-run]`) does the install in one step, because Herdr's `place` auto-dock does
not help here: on a shipped layout it docks nothing, and on a personal one it wraps
the whole window root in a column, spanning the sidebar. `mod.json` keeps
`place: "none"`.

1. Home is `$HERDR_APP_HOME`, else `~/.config/herdr-app`. Symlink `mods/pins` to
   `<home>/mods/pins` if nothing is there (another thing there is kept, with a
   message); then `herdr-app check` must pass.
2. Layout: `--layout`, else `shared.json`'s `layout`, else `main`. `main`, `terminals`
   and `win98` are shipped: clone with `layout.clone` as `my-<name>` (an existing one is
   used as it is) and wait up to 5 s for the file.
3. In the personal layout's JSON: a node with id `pins` means done. Else the README's
   pins column is added and moved to `--place` (default bottom) with `movePinsColumn`:
   `insertPinsColumn(tree, { height, place })`. No such block: fail, add it by hand. The file is
   backed up to `<name>.json.before-pins` (unless that exists) and rewritten with
   `JSON.stringify(_, null, 2)`, so a hand-formatted layout loses its formatting.
4. `layout.switch` if the window is not on that layout.

The pure parts (`insertPinsColumn`, `movePinsColumn`, `pinsPlace`, `pinsColumn`, `isShipped`) are in `pins.js`, tested in
`tests/setup.test.mjs` against `tests/fixtures/main.json`, a copy of the shipped `main`.
`--dry-run` makes no symlink, clone, write or switch.


## Built from

- `mods/pins/`, `mod.json` `{ "place": "none", "title": "Pins" }`: it docks
  nowhere by itself; a layout block puts it in.
- `main.js`: one `View` with two roles: the header (props `{ block =
  "pins-terminal", column = "pins" }`) and the picker (`props().picker`, with
  `space`). Helpers copied from Herdr's mods: `place(s)` from `menu`, the folder
  and program-icon helpers from `pane`.
- `pins.js`, no herdr import: `matchPin(pins, space)`, `upsertPin(pins, pin)`,
  `blockTerminal(text, blockId)`, `replaceBlockTerminal(text, blockId, address)`
  (one pass over the text tracking strings and the open objects; the same text
  when the block is missing or already shows the address), `startArgs({ folder,
  machine, argv, name })`, `terminalName(what, folder, suffix)`,
  `needsRestart(pin, term)`, `startedAddress(address, machine)`, `replacedPin(pins, pin)`, `paneBack(pin, pins)`,
  `parentOf(node, id)`, `pinsPlace(tree)`, `movePinsColumn(tree, where)`. The mod
  runtime has no `structuredClone`: copy trees with a JSON round trip.
- `icons/`: Lucide `pin`, `pin-off`, `play`, `refresh`, `x`, `move`, `panel-bottom`,
  `panel-top`, `panel-right`, `panel-left`, with
  `LICENSE-lucide.txt`.
- `setup.mjs` at the repo root (see Setup).
- `tests/pins.test.mjs`, `tests/setup.test.mjs` (node:test) and `tests/fixtures/layout.json`, a clone of
  Herdr's `main` with the pins column.


## Watch out

- Icons don't paint when `mods/pins` is a symlink to a folder outside
  `~/.config/herdr-app` (as `setup.mjs` makes it); a real copy paints them. The
  folded strip on the right or left is only an icon, so it looks empty then.
- Herdr's own save of a layout file drops every node hidden by a click and then
  unwraps each container left with one child. Seen once on `my-main`: the hidden
  `pins-terminal` was dropped, `pins` unwrapped into `pins-header`, and the
  shipped `panel` column (one child) unwrapped too. Hence the fold never hides
  anything. The `panel` unwrap comes from Herdr's own layout and the mod can't
  prevent it; nor can it stop `layout.toggle:pins` from hiding the whole column.
  Recovery: `setup.mjs` keeps the layout as it was before the column as
  `<name>.json.before-pins`; copy it back and run setup again.
- Never `layout.set`. In Herdr 0.1.11 it drops nodes from the tree and then
  keeps rewriting the layout file from its memory copy until the window
  restarts. Editing the file is the supported path.
- `<mod>.<command>` reaches shown copies only. A hidden column's header gets no
  key commands, so a `pins.toggle` could hide the column but never show it
  again: use `layout.toggle:pins`.
- A copy that isn't drawn doesn't render: with the screen locked or the window
  hidden, nothing swaps until it draws again (timers and `nextCommand` still run).
- `hc run --name` must be unique among live terminals: hence the time suffix.
- `layout.resize` is a click, kept in `layouts/.state/`, not in the file. The
  column's `min` must allow 28px or the fold stops at the minimum.
- `SpaceInfo.folder` is where a space's new terminals start, which may not be
  where its shell is now; the match's fallback compares that field, and the
  Start rows use the live folder.
- A popup's tasks end when it closes: the picker awaits the start and the pin
  before closing itself.


## Done when

- `node --test tests/` passes: the match's priorities and list order, the
  folder fallback (and not on another machine), machine null vs a name, one pin
  per scope and target, the address swap in the fixture (only that line;
  identical text when equal or missing; a mod block has none), several terminal
  blocks with the id after the content, braces and escaped quotes in strings,
  `hc run` arguments here, `--on` and for a shell, terminal names, Restart, the
  pin a pin replaces and when a pane comes back, and the column moved to all four
  places (round trips, the same tree when already there, null cases, every other
  node intact).
- `herdr-app check ~/.config/herdr-app/mods/pins` passes and `herdr-app status`
  shows `"errors": []` on the layout with the column.
- In a space with no pin the column is its header, `Nothing pinned here`.
- Pin… → Start lazygit here → Space: `hc ls` shows a live `pin-lazygit-…`
  terminal in that folder, the layout file differs from before in that one
  `terminal` value, and the pane shows lazygit under a header naming it with
  `this space`. Another space folds the column; back, lazygit again.
- A terminal pinned with All shows in every space without its own pin; a space
  pin still wins in its space.
- `herdr-app do pins.pin` pins the focused terminal to this space;
  `pins.unpin` brings back what showed before.
- In a tab with two panes, `pins.pin` on one: it leaves the tab, the pins block
  shows it tagged `this space`, `hc get` says `keep: true`. `pins.unpin`: it is a
  tab of its own in the current space.
- `pins.move:right` puts the column beside the tab area; `pins.move:bottom` puts it
  back, and the layout file is as before (key order of the wrapper aside). Folded
  on the right it is a 28px strip with the pin icon.
- `node setup.mjs --layout terminals --place right` on a fresh clone puts the
  column right of the tab area.
