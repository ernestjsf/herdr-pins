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
  column. Never hidden and never 0px (see Watch out).
- **The fold**, with nothing (live) pinned here, by `foldSizes(fold)`: a
  **sliver**, the column 8px, the header 7px and the block 1px with no terminal in
  it (address `""`); the header draws only its `background`. Shared `pins.fold`
  `"header"` folds to the **header** instead: the column 29px, the header 28px,
  the block 1px, the header as below (`Nothing pinned here`, Pin…, Move… under the
  pointer). A pin whose terminal has ended keeps the header too, to show `t7 has
  ended` and Unpin. Unfolding
  resizes the header to 28px, the block to weight 1 and the column to its file
  size. The header finds its own block id as the column's child showing this mod.
  The column's `min` in the file must be 8 or less.
- **In a row** (moved right or left) the header fold is a 29px-wide strip: the
  header is then only the pin icon, centered, and a click on it opens Pin….
- **The pin button**: a floating block on the tab block (`"floating": [{ "id":
  "pins-button", "content": { "mod": "pins", "props": { "button": true } },
  "edge": "bottom", "align": "end" }]`); Herdr draws its frame, people drag it and
  Herdr keeps the spot. While no pin shows for the current space it is a 24px pin
  icon (14px, `dim`, `accent` under the pointer, radius 6); a click opens Pin… as a
  dialog. While a pin shows it renders an empty `div()`, so no frame shows.
- An empty address draws Herdr's placeholder card in the block: at 1px it does not
  show, which is why the block is resized to 1px and not only the column.

**The Move… popup** is 160 × 130 at the pointer, on `popover`, 5px padding,
12.8px type: four 30px rows, **Bottom**, **Top**, **Right**, **Left**, each a 13px
Lucide panel icon in `muted` and the label in `foreground`, radius 7, `hover` under
the pointer. ↑/↓ move a `hover` highlight (Bottom first), Enter moves the column there,
**b t r l** move it directly, Esc closes it.

**The picker** is a 480px popup at the pointer (a centered dialog from a key), its
height 174 + 30 per row (at most 480), on `popover`, 5px padding, 12.8px type:

- A 28px title line, 8px left padding, 11px `dim`: `Pin in <space name>: for this
  space, this machine, or all` (`Starting…` while a Start runs), and a close
  button (x icon, 12px, radius 4, `hover` under the pointer).
- Under it, an 18px line, 8px left padding, 11px `dim`: `Shows the space pin, else
  the machine pin, else the everywhere pin.`
- Three sections, each under a 24px heading (11px semibold `dim`, 8px left padding),
  scrolling past the popup's height. Rows are 30px, 8px side padding, 8px gaps,
  radius 7, `hover` behind the highlighted row and under the pointer:
  - **Start new**: one row per starter (shared `pins.starters`, else lazygit and
    shell): `Start <label> here` (`Start a shell here` when `argv` is null), a 13px
    play icon in `muted`, then the space's current folder at 11px `dim`. The
    highlighted or hovered starter shows a × (11px x icon, `dim`, radius 4) before
    the scope buttons. Then **Add a command…** with a 13px plus icon, no folder and no
    scope buttons.
  - **Pin an open terminal**: **Pin this pane · <tab> · <name>** for the terminal
    focused when the picker opened (passed in its props, since the popup takes the
    keyboard), unless it is the one pinned here; then one row per other terminal
    pane in the space's tabs (`panes()` with a `terminal`, in that order),
    `<tab name> · <name>`: its program icon at 14px (an empty 14px slot when none),
    the name as the pane header names it (an agent's or shell's program name, else
    the title, else the program's name, else `shell`), at most 170px (230px for Pin
    this pane), in `foreground`, its live folder at 11px `dim`, and its address
    (`t65`) at 11px `dim` at the end.
  - **Pins**: every pin in `pins.list`, as `pinRows(pins, spaces(), terminals(),
    match)` orders and labels them: space pins in space order (a closed space's
    after them), then machine pins, then everywhere's, list order within each. A
    13px pin icon, `accent` for the pin showing now (the match, by value) and `dim`
    for the rest; a tag like the header's (at most 120px): the space's name
    (`closed space` when it is gone), the machine or `this computer`, or
    `everywhere`; the program (the live terminal's name, else the pin's `name`, at
    most 120px) in `foreground`; the folder (live, else the pin's) at 11px `dim`;
    `ended` at 11px `dim` when the terminal isn't live; the address at 11px `dim`;
    the × when highlighted or hovered. No scope buttons. With no pins, one `dim`
    row: `No pins yet`.
  - At the right of every Start and open-terminal row three buttons, each its key in
    `dim` then its word, 4px apart: **⏎ Space**, **m Machine**, **a All**: 20px tall,
    6px side padding, radius 5, 1px `border`, 11px `muted`; `selected` behind and
    `foreground` text under the pointer.
- A 46px footer, 1px `border` above, 8px side and 6px top padding, 11px `dim`: key
  caps, each a chip (15px tall, 3px side padding, radius 3, 1px `border`, 10.5px
  `dim`) followed 3px later by its word, in groups 10px apart that wrap to a second
  row (4px between rows): [↑][↓] choose, [⏎] space, [m] machine, [a] all, [u] unpin,
  [g] go, [b][t][r][l] move, [n] new, [x] remove, [esc] close.

**Add a command** is a 420 × 214 dialog on `popover`, 18px padding, drawn like
Herdr's prompt: the title, `Esc` at 11px `dim`, a `Command` label, a 36px input
(accent border while focused), the hint `Starts in the space's folder, split on spaces:
htop, npm run dev`, then **Cancel** and **Add**.


## How it behaves

**Pins** are kept in `shared("pins.list")`, an array of `{ terminal, scope:
"space" | "machine" | "all", space, machine, folder, argv, name }`. `terminal` is
the address (`t7`, or `machine/t7` for another machine). `space` is the space's
id, `machine` its machine (null for this computer), `folder` its `SpaceInfo.folder`
(the folder Herdr gives it, not where its shell is now), recorded for every scope
for display only: the match never compares it.
`argv` is the program a Start ran (`["lazygit"]`), null for a shell or a picked
terminal; `name` a label (`argv[0]`, else the row's name).

**The match** for a space: a space pin whose `space` is the space's id (ids have held
across app and core restarts; a folder fallback made spaces sharing a folder, such as
several in `~`, share pins); else a machine pin whose `machine` equals the space's machine (null is
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

- nothing: `layout.resize` the column, header and block to the fold's sizes (see
  The fold; again whenever those change), then write `""` as the block's address
  (as below), so no live terminal is squeezed to 1px;
- an address: read the shown layout's file (`<appHome>/layouts/<shared("layout")>.json`),
  replace the `"terminal": "…"` value inside the object whose `"id"` is the block's
  id (whatever the key order; strings with braces or escaped quotes don't
  confuse it), and write it back with `writeTextFile(path, next, text)` only if
  it changed. A refused write (the file changed in between) reads again and
  retries once. Only when this unfolds the column (the last wanted was nothing, or
  this is the first render): resize the header to 28px, the block to `weight: 1` and
  the column to its open size. One address for another writes the address and
  resizes nothing, so a drag stays. If the wanted address changed meanwhile, the
  older task stops before writing or resizing.
- No `layout.hide`/`layout.show` (see Watch out). One exception: when `layout()`
  shows the block `hidden` (an older version folded with hide), it is shown once.
- The open size is the one kept in shared `pins.size` under `sizeKey(layout, row)`
  (`my-main:column` or `my-main:row`), else the column's `size.px` in the layout
  file, read on each unfold (240 if missing or not above 28).
- Keeping a drag: before folding (the fold waits for it), `draggedSize({ layoutPx,
  filePx, statePx })` takes the column's size from `layout()` when it differs from
  the file's (it carries the drag), else from `layouts/.state/<layout>.json`
  `nodes.pins.size.px` (read with `readTextFile`, never written), else the file's;
  a folded size (29px or less) never counts. It is kept, or cleared when it equals
  the file's. While open, each render also keeps a size `layout()` shows that
  differs from the file's (compared first; no write when it is already kept).

Nothing else in the file is touched by the swap: no reformatting, no reordering. The window
reloads the edited layout by itself.

**The header**: a click on the row focuses the terminal block
(`pane.focus {terminal}`) when the pinned terminal is live. Pin… opens the
picker for the current space (`openOverlay({ mod: "pins", kind: "popup",
props: { picker: true, space } })`); Unpin removes the matched pin (by value)
from the list. Neither ends any terminal.

**Moving a pane in**: storing a pin (a picker row for a terminal, or the `pin` key)
first looks for the terminal's pane. A terminal with a pane always moves; the pin is
stored with `moved: true` and the pane goes (a lone pane's tab closes with it). When
the pane is the only pane of its space's only tab, parking it would close the space:
first `run("tab.new", { space, folder: place(space) })`, then poll `spaces()` every
100 ms for up to 2 s until the space has two tabs. If it never does, the pin is stored
without `moved`, the pane stays, and a toast says `The pane stays in its tab`. Then: `run("terminal.park", {terminal})`, then the
mod polls `hc get` (300 ms, at most 3 s) until `keep` is false (park applied) and
runs `hc keep <address>` (a `machine/t9` address works as is). A pin for a
terminal that another pin already moved is `moved` too. When a pin goes (Unpin, or
replaced by a pin for the same scope and target) and it was `moved` and no pin left
shows that terminal, the terminal gets a pane again if it is live:
`run("terminal.keep", {terminal, place: "tab"})`, a new tab in the current space.
Start rows never had a pane and are unchanged.

**Repair**: Herdr's own save can drop the folded block and leave the header loose
(see Watch out). `repairPinsColumn(tree)`: when a block shows this mod
(`content.mod: "pins"`) and no node has the column's id (the header's `props.column`,
default `pins`), the header is replaced, where it stands, by `pinsColumn()` (360px)
with the header itself and the terminal block (`props.block`, default
`pins-terminal`; moved in when it survived elsewhere, else `{ "terminal": "" }`). A
wrapper the header was alone in stays. It also puts the pin button back on the tab
block when it is gone (`addPinsButton`; never a second one). Same tree otherwise. The
header runs it on start (the read that finds whether it is in a row) and on every read
for a swap, before anything else: when it changed the tree it writes the file (2-space
JSON, the expected-text check as usual; a refused write reads again) and, when the
column itself was missing, toasts `Pins column repaired after a Herdr layout save`.

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

**The picker's keys** (`on_key_down` on its focus handle, focused in `init`; the
whole chord, `e.keystroke`, so cmd-m is not m), as `pickerAction(keystroke, { at,
count })` in `pins.js` decides: ↑/↓ move the highlight over the rows (wrapping; the
headings are not rows), Enter pins the highlighted row to this space, **m** to this
machine, **a** everywhere, **u** unpins the current match, **g** closes and focuses the
pinned terminal, **b t r l** move the column and close, **n** opens Add a command,
**x** removes the highlighted starter, or the highlighted pin (as Unpin does, giving a
moved pane back), Esc closes. On Add a command… Enter opens the dialog and the scope keys
do nothing. On a pin Enter closes and, for a space pin whose space is open, shows it
(`space.select {id}`); **m** and **a** do nothing. On `No pins yet` nothing does. The highlight starts on Pin this pane, else the
first row. A click on a row is Enter on it; a scope button or × is that key on its row.

**Starters**: `pins.starters` is `[{ label, argv }]`. Add a command splits the text on
whitespace (no quoting) into `argv` and names it after the first word without its path
(`starterFromText`); `addStarter` appends it unless a starter with the same `argv`
is there; `removeStarter` drops the ones with that `argv`. Both start from the defaults
when the key is unset. Enter in the dialog saves, closes it and opens the picker again
(as a dialog) for the same space and terminal; Esc or Cancel closes it.

**The picker**: a scope button pins its row. A Start row first starts the
program in the space's current folder (its first tab pane's live folder, else
`SpaceInfo.folder`): `hc run --bg --keep --no-parent --outlive-parent --no-notify
--name <name> --cwd <folder> [--on <machine>] --json [-- <argv…>]`, no argv for the
shell (hc then starts that machine's shell). The name is `pin-<starter label>-<folder's
last part>-<4 characters of the time in base 36>`, lowercased, other characters
as `-`, at most 32. With `--on`, core 0.1.15 prints the
`address` already prefixed (`omarchy/t10`; older cores printed it bare):
`startedAddress(address, machine)` adds `<machine>/` only when there is no `/`. A failed start toasts `Couldn't start it` with
hc's error and pins nothing. The popup closes after a pick.

**Keys** are the person's, in `keys.json`; the mod binds none. The README recommends
one, `"cmd-alt-o": "pins.pick"`, and `setup.mjs --key` adds it. Commands, through
`nextCommand()` in the header copy (not the picker's): `pick` opens the picker;
`pin` pins `focused().terminal` to the current space (scope space, no argv, its
program's name as the label, moving its pane in as above); `unpin` removes the
current match; `focus` focuses the pinned terminal; `add` opens Add a command;
`move` opens Move…; `move:<where>` moves the column (a `pins.move:right` key
delivers `move:right`). There is no hide command: Herdr's
save drops hidden nodes, and the fold already shrinks the column to its header.

Programs only start from a Start row (a click or its key) or a Restart click.


## Setup

`setup.mjs` (Node, stdlib only; `node setup.mjs [--layout <name>] [--height <px>]
[--place bottom|top|right|left] [--key <chord>] [--dry-run]`) does the install in one step, because Herdr's `place` auto-dock does
not help here: on a shipped layout it docks nothing, and on a personal one it wraps
the whole window root in a column, spanning the sidebar. `mod.json` keeps
`place: "none"`.

1. Home is `$HERDR_APP_HOME`, else `~/.config/herdr-app`. Copy `mods/pins` to
   `<home>/mods/pins` (recursive, files overwritten, Herdr's own `jsconfig.json` and
   `gpui-kit.d.ts` kept when there): `copied`, or `updated` when a copy was there.
   A symlink there is replaced by the copy, with a message: Herdr draws no icons
   through it. Then `herdr-app check` must pass.
2. Layout: `--layout`, else `shared.json`'s `layout`, else `main`. `main`, `terminals`
   and `win98` are shipped: clone with `layout.clone` as `my-<name>` (an existing one is
   used as it is) and wait up to 5 s for the file.
3. In the personal layout's JSON: first `repairPinsColumn` (see Repair), written back
   when it changed anything, with `repaired the pins column…` (the column was
   missing) or `added the pin button…` (an install from before the button). Then a node with id `pins` means done. Else the README's
   pins column is added and moved to `--place` (default bottom) with `movePinsColumn`:
   `insertPinsColumn(tree, { height, place })`, which also floats the pin button. No such block: fail, add it by hand. The file is
   backed up to `<name>.json.before-pins` (unless that exists) and rewritten with
   `JSON.stringify(_, null, 2)`, so a hand-formatted layout loses its formatting.
4. `layout.switch` if the window is not on that layout.
5. Keys, also when the layout was already set up: without `--key`, one line
   suggesting `--key cmd-alt-o` and no change. With it: stop if `keys.error` exists
   (Herdr rejects the file already). `addKey(keys, "layout:<name>", chord,
   "pins.pick")` returns the file with the chord added to that section, or null
   when the chord is bound in any section (then nothing changes, and it says so).
   It writes `JSON.stringify(_, null, 2)`, waits 1.5 s, and if `keys.error` appeared
   writes the old text back and fails. Exact spelling only: `cmd-shift-]` and
   `cmd-}` count as different chords.

The pure parts (`insertPinsColumn`, `movePinsColumn`, `pinsPlace`, `pinsColumn`, `isShipped`, `addKey`) are in `pins.js`, tested in
`tests/setup.test.mjs` against `tests/fixtures/main.json`, a copy of the shipped `main`, and `tests/fixtures/broken.json`,
`my-main` as Herdr's save left it (the header loose in `main-row`).
`--dry-run` makes no copy, clone, write or switch.


## Built from

- `mods/pins/`, `mod.json` `{ "place": "none", "title": "Pins" }`: it docks
  nowhere by itself; a layout block puts it in.
- `main.js`: one `View` with four roles: the header (props `{ block =
  "pins-terminal", column = "pins" }`), the picker (`props().picker`, with `space`
  and `terminal`), Move… (`props().mover`) and Add a command (`props().starter`,
  with `space` and `terminal`; `InputState`/`Input` from `gpui-base` as Herdr's
  `prompt` mod uses them: focused on open and again after 600 ms). Helpers copied from Herdr's mods: `place(s)` from `menu`, the folder
  and program-icon helpers from `pane`.
- `pins.js`, no herdr import: `matchPin(pins, space)`, `upsertPin(pins, pin)`,
  `blockTerminal(text, blockId)`, `replaceBlockTerminal(text, blockId, address)`
  (one pass over the text tracking strings and the open objects; the same text
  when the block is missing or already shows the address), `startArgs({ folder,
  machine, argv, name })`, `terminalName(what, folder, suffix)`,
  `needsRestart(pin, term)`, `startedAddress(address, machine)`, `replacedPin(pins, pin)`, `paneBack(pin, pins)`,
  `parentOf(node, id)`, `pinsPlace(tree)`, `movePinsColumn(tree, where)`,
  `pickerAction(key, { at, count })`, `DEFAULT_STARTERS`, `starterFromText(text)`,
  `addStarter(list, starter)`, `removeStarter(list, starter)`, `addKey(keys,
  section, chord, command)`, `repairPinsColumn(tree)`, `pinRows(pins, spaces, terminals, current)`, `foldSizes(fold)`, `PINS_BUTTON`,
  `addPinsButton(tree)`, `draggedSize({ layoutPx, filePx, statePx })`, `sizeKey(layout,
  row)`. The mod
  runtime has no `structuredClone`: copy trees with a JSON round trip.
- `icons/`: Lucide `pin`, `pin-off`, `play`, `plus`, `refresh`, `x`, `move`, `panel-bottom`,
  `panel-top`, `panel-right`, `panel-left`, with
  `LICENSE-lucide.txt`.
- `setup.mjs` at the repo root (see Setup).
- `tests/pins.test.mjs`, `tests/setup.test.mjs` (node:test) and `tests/fixtures/layout.json`, a clone of
  Herdr's `main` with the pins column.


## Watch out

- Icons don't paint when `mods/pins` is a symlink to a folder outside
  `~/.config/herdr-app`; a real copy paints them. Hence setup copies. Through a
  symlink the folded strip on the right or left would look empty.
- Herdr's own save of a layout file drops every node that is hidden by a click
  **or sized 0px**, and then unwraps each container left with one child. Seen twice
  on `my-main`: once with the block hidden, once (00:23 on 2 Nov) with it folded to
  0px. Each time `pins-terminal` was dropped, `pins` unwrapped into `pins-header`
  (loose in `main-row`), and the shipped `panel` column (one child) unwrapped too.
  Hence the fold never hides anything and never goes below 1px. The `panel` unwrap
  comes from Herdr's own layout and the mod can't prevent it. The README tells
  people not to bind `layout.toggle:pins` for the same reason.
- Never `layout.set`. In Herdr 0.1.11 it drops nodes from the tree and then
  keeps rewriting the layout file from its memory copy until the window
  restarts. Editing the file is the supported path.
- `<mod>.<command>` reaches shown copies only. A hidden column's header gets no
  key commands, so a `pins.toggle` could hide the column but never show it
  again. That, and the save bug above, is why there is no toggle.
- A copy that isn't drawn doesn't render: with the screen locked or the window
  hidden, nothing swaps until it draws again (timers and `nextCommand` still run).
- `hc run --name` must be unique among live terminals: hence the time suffix.
- `layout.resize` is a click, kept in `layouts/.state/`, not in the file. The
  column's `min` must allow 8px or the fold stops at the minimum (`pinsColumn()`
  writes 8).
- `SpaceInfo.folder` is where a space's new terminals start, which may not be
  where its shell is now; the Start rows use the live folder.
- A popup's tasks end when it closes: the picker awaits the start and the pin
  before closing itself.


## Done when

- `node --test tests/` passes: the match's priorities and list order, a
  space pin by id only (not another space in the same folder), machine null vs a name, one pin
  per scope and target, the address swap in the fixture (only that line;
  identical text when equal or missing; a mod block has none), several terminal
  blocks with the id after the content, braces and escaped quotes in strings,
  `hc run` arguments here, `--on` and for a shell, terminal names, Restart, the
  pin a pin replaces and when a pane comes back, and the column moved to all four
  places (round trips, the same tree when already there, null cases, every other
  node intact), the picker's key mapping, starters from text and the list's add
  and remove, `addKey` (adds, refuses a chord bound in any section, keeps the
  rest), and `repairPinsColumn` on the broken `my-main` (the column back under
  `main-row`, nothing else changed; a whole tree untouched; a lone header keeps its
  wrapper; a surviving block moves in once), and the Pins rows (order, labels,
  `ended`, the one showing, an empty list), the fold's sizes (sliver, header, never
  0px), and the pin button (added on insert, kept by every move, put back by the
  repair, never twice), and which size a fold keeps (`draggedSize`, `sizeKey`).
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
- A lone pane in a space with two tabs: `pins.pin` closes its tab. The lone pane of
  a space's only tab: the space gets a new shell tab and stays; the pane moves.
- `herdr-app do pins.pick` shows both sections, Pin this pane highlighted, and the
  footer; `pins.add` shows Add a command with the input focused.
- `node setup.mjs --key cmd-alt-o` adds that one line under `layout:<name>` and
  nothing else (`diff` the file); again, it says the chord is bound; `keys.error`
  is absent.
- `pins.move:right` puts the column beside the tab area; `pins.move:bottom` puts it
  back, and the layout file is as before (key order of the wrapper aside). Folded
  on the right it is an 8px sliver, and with `pins.fold` `"header"` a 29px strip
  with the pin icon.
- With nothing pinned the pin button floats at the bottom right of the tab area;
  with a pin showing it is gone.
- `node setup.mjs --layout terminals --place right` on a fresh clone puts the
  column right of the tab area.
