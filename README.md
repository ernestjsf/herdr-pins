# herdr-pins

A pinned terminal pane for a personal layout in the [Herdr](https://herdr.dev)
desktop app. Pin a terminal to one space, to one machine or to everywhere, and
the pane shows the terminal pinned for the space you are in. Switch spaces and
it follows.

The everyday use: lazygit pinned to each repo's space, so the pane under your
tabs always shows git for the repo you are in.

## What you get

- A column under your tabs (or anywhere in your layout) with a 28px header and a terminal.
- The header shows the pinned terminal's program, its folder, and where it is pinned: `this space`, `this machine` or `everywhere`. Click it to focus the terminal.
- A space pin beats a machine pin, which beats an everywhere pin. With nothing pinned the column folds to its header, which says `Nothing pinned here`.
- Hover the header for **Pin…**, **Move…** and **Unpin**, or press your Pin… key. Pin… opens a list in two parts. **Start new**: **Start lazygit here**, **Start a shell here**, your own [starters](#starters), and **Add a command…**. **Pin an open terminal**: **Pin this pane** (the terminal you were in), then the other terminals in this space's tabs, each with its tab's name and address (`2 · Claude Code … t65`). Each row has three buttons: **Space**, **Machine**, **All**.
- The list works from the keyboard: ↑/↓ choose, Enter pins to this space, **m** to this machine, **a** everywhere, **u** unpins, **g** goes to the pinned terminal, **b t r l** move the column, **n** adds a command, **x** removes a starter, Esc closes. The footer lists them.
- Pinning a terminal moves it: its pane leaves the tab and the terminal shows in the pins column only. Its tab closes if the pane was alone; the space keeps a new shell tab if that was its last tab. Unpin gives it a new tab in the current space.
- **Move it**: Move… puts the column **Bottom** (under the tab area), **Top**, **Right** or **Left** of it. On the right or left the folded column is a 29px strip with the pin icon; click it for Pin….
- Start rows run the program as a kept terminal (`hc run --keep`) in the space's current folder. Nothing runs by itself: only choosing a Start row or clicking Restart starts a program.
- Pinning again to the same space (or machine, or everywhere) replaces the earlier pin there.
- A pinned terminal that has ended shows as `t7 has ended` with Unpin. Pins are never deleted on their own.
- After a core restart a kept program comes back as a plain shell. The header then offers **Restart**, which types the program's command into that shell.

## Install

Clone the repo, then from its folder:

```sh
node setup.mjs
```

`setup.mjs` copies `mods/pins` into `~/.config/herdr-app/mods/` (a copy, because Herdr
draws no icons through a symlink; a symlink there is replaced), clones the layout
you are on into `my-<name>` if it is one of Herdr's own, puts the pins column under
the tab area of that personal layout (the original is saved as
`<name>.json.before-pins`), and switches the window to it. Run it again and it says
`already set up`; after a `git pull`, run it again to update the copy. Options: `--layout <name>`, `--height <px>` (default 360; the width
on the right or left), `--place bottom|top|right|left` (default bottom),
`--key <chord>` (bind that key to Pin… for this layout; see Keys), `--dry-run` (print the plan,
write nothing).

## By hand, or somewhere else

The column is a normal layout column and can sit anywhere in a personal layout, for
example on the right. A personal layout is a file in `~/.config/herdr-app/layouts/`
that you made or cloned (`herdr-app do layout.clone '{"name":"main","as":"my-layout"}'`);
Herdr's own layouts are replaced on every start. To put the column under the tabs,
wrap the `main` block in a column and add the pins column after it:

```json
{ "id": "main-column", "type": "column", "gap": 8, "children": [
  { "id": "main", "type": "block", "content": { "tab": "active", "...": "as before" } },
  { "id": "pins", "type": "column", "size": { "px": 360 }, "min": 28, "max": 700,
    "background": "background", "radius": 10, "border": { "width": 1, "color": "border" },
    "focus": { "border": { "width": 1, "color": "accent" } },
    "children": [
      { "id": "pins-header", "type": "block", "size": { "px": 28 },
        "content": { "mod": "pins", "props": { "block": "pins-terminal" } } },
      { "id": "pins-terminal", "type": "block", "content": { "terminal": "" } }
    ] }
] }
```

Keep `"min": 28`: the mod folds the column to its 28px header and a 1px block (29px). The header's props
name the terminal block it drives (`block`, default `pins-terminal`) and the column
it folds (`column`, default `pins`).

## Keys

Shortcuts are yours: they live in `~/.config/herdr-app/keys.json`, never in the mod. One
key is all it needs, since Pin… does everything from the keyboard. `node setup.mjs --key
cmd-alt-o` adds it for your layout (only if that chord is free anywhere in the file; nothing
else changes), or merge it by hand, with your layout's name:

```json
{
  "layout:my-layout": {
    "cmd-alt-o": "pins.pick"
  }
}
```

The other commands are there for anyone who wants direct keys; bind any of them the same way:

- `pins.pick` opens the Pin… list for this space.
- `pins.pin` pins the focused terminal to this space.
- `pins.unpin` removes the pin shown for this space.
- `pins.add` opens Add a command (a new [starter](#starters)).
- `pins.move` opens the Move list; `pins.move:bottom`, `:top`, `:right`, `:left` moves the column there directly.
- `pins.focus` focuses the pinned terminal. Its header shows an accent line while it has focus, since Herdr draws no focus border on a layout terminal block.

Don't bind Herdr's `layout.toggle:pins` to hide the column: Herdr's layout save
drops hidden nodes (see RECIPE.md, Watch out). With nothing pinned the column
folds to its header on its own.

## Starters

The **Start new** rows are starters: commands the list can start in the space's current
folder and pin in one go. They live in Herdr's shared state under `pins.starters`, as
`[{ "label": "lazygit", "argv": ["lazygit"] }, { "label": "shell", "argv": null }]` (those two
until you change the list).

- Add one: **Add a command…** (or **n**, or `pins.add`), type the command, Enter. It is split
  on spaces (no quoting) and named after its first word without its path:
  `npm run dev` becomes **Start npm here**. The list opens again with it.
- Remove one: highlight it and press **x**, or click the × that shows on it. The two
  defaults can be removed too.

## lazygit in every repo

1. Open the repo's space and press your Pin… key (or hover the pins header, Pin…).
2. **Start lazygit here** → Enter (or **Space**).
3. Do the same in each repo's space. Spaces without a pin fold the column, or show
   an everywhere pin if you made one (a shell in `~` pinned to **All** is handy).

lazygit runs as a kept terminal named `pin-lazygit-<folder>-<id>`. Unpinning leaves
it running; end it with `hc kill <address>`.

## How it works

Herdr has no command to swap one terminal in a layout, so the mod edits your layout
file: when the space changes it reads the file, replaces the one `"terminal": "…"`
value inside the `pins-terminal` block and writes it back only if the address changed
(the write is refused if the file changed in between; it reads again and retries once).
Nothing else in the file changes. The window picks the edit up within a second.
Folding resizes the terminal block to 1px (the column to its header and that 1px) and
sets its address to `""`; Herdr keeps the sizes as clicks, not in your file. Nothing is
hidden and nothing is 0px: when Herdr saves a layout itself it drops hidden and 0px
nodes (see RECIPE.md, Watch out).

Moving the column is a structural edit: the mod rewrites the whole layout file as
2-space JSON with the column (and its `main-column` or `main-row` wrapper) moved,
so a hand-formatted layout loses its formatting. The fold and sizes follow the ids.

Moving a pane into the column is Herdr's `terminal.park` (the pane goes, the
terminal keeps running) then `hc keep` again, since park turns core keep off. Parking a
space's last pane would close the space, so the mod first opens a shell tab there
(`tab.new`, in the space's live folder) and parks only once it shows (within 2 s; else the
pane stays and a toast says so).

If Herdr's own layout save drops part of the column anyway, the mod puts it back the
next time it reads the file (a toast says so), and `node setup.mjs` does the same.

Pins live in Herdr's shared state under `pins.list`. The column opens at the
`size.px` in your layout file: raise it there. lazygit wants about 360 px.

## Limits

- The mod edits your layout file's one `terminal` value. Use a personal layout, and
  expect that value to change in version control if you keep your layouts there.
- A space pin belongs to that space's id. Two spaces in the same folder are two places,
  each with its own pin; a space closed and made again is a new space.
- After a core restart a kept program is a plain shell until you click Restart.
- Terminals on another machine (`omarchy/t9`) can be pinned; the block draws them
  like local ones.
- Dragging the column's height is not remembered across a fold: it opens again
  at the `size.px` from your layout file.
- Move… only places the column beside the tab area. Anywhere else: edit the file.
- Folded on the right or left with nothing pinned, the strip offers Pin… only; pin
  something (or use `pins.move:<where>`) to reach Move….
- Built on Herdr 0.1.11, macOS.

## Development

```sh
node --test tests/
```

Stdlib only. `tests/fixtures/layout.json` is a personal layout (a `main` clone)
with the pins column added. Edit in the repo, then `node setup.mjs` updates the
installed copy and Herdr reloads it. A symlink instead of the copy draws no icons
and, in Herdr 0.1.11, does not reload on edits either (remove and recreate the link).

## License

MIT. Icons after [Lucide](https://lucide.dev) (ISC).
