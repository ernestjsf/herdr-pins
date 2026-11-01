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
- Hover the header for **Pin…**, **Move…** and **Unpin**. Pin… opens a list: **Start lazygit here**, **Start a shell here**, then the terminals in this space's tabs. Each row has three buttons: **Space**, **Machine**, **All**.
- Pinning a terminal from a tab that has other panes moves it: its pane leaves the tab and the terminal shows in the pins column only. Unpin gives it a new tab in the current space. A terminal that is its tab's only pane stays where it is (moving it would close the tab).
- **Move it**: Move… puts the column **Bottom** (under the tab area), **Top**, **Right** or **Left** of it. On the right or left the folded column is a 28px strip with the pin icon; click it for Pin….
- Start rows run the program as a kept terminal (`hc run --keep`) in the space's current folder. Nothing runs by itself: only a Start or Restart click starts a program.
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
`--dry-run` (print the plan, write nothing).

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

Keep `"min": 28`: the mod folds the column to its 28px header. The header's props
name the terminal block it drives (`block`, default `pins-terminal`) and the column
it folds (`column`, default `pins`).

## Keys

None by default. To add some, merge this into `~/.config/herdr-app/keys.json`, with
your layout's name:

```json
{
  "layout:my-layout": {
    "cmd-alt-p": "pins.pin",
    "cmd-alt-u": "pins.unpin",
    "cmd-alt-o": "pins.pick",
    "cmd-alt-m": "pins.move",
    "cmd-alt-g": "pins.focus"
  }
}
```

- `pins.pin` pins the focused terminal to this space.
- `pins.unpin` removes the pin shown for this space.
- `pins.pick` opens the Pin… list for this space.
- `pins.move` opens the Move list; `pins.move:bottom`, `:top`, `:right`, `:left` moves the column there directly.
- `pins.focus` focuses the pinned terminal. Its header shows an accent line while it has focus, since Herdr draws no focus border on a layout terminal block.

Don't bind Herdr's `layout.toggle:pins` to hide the column: Herdr's layout save
drops hidden nodes (see RECIPE.md, Watch out). With nothing pinned the column
folds to its 28 px header on its own.

## lazygit in every repo

1. Open the repo's space and hover the pins header.
2. Pin… → **Start lazygit here** → **Space**.
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
Folding resizes the column to 28px and the terminal block to 0px and sets its address
to `""`; Herdr keeps the sizes as clicks, not in your file. Nothing is hidden: when
Herdr saves a layout itself it drops hidden nodes (see RECIPE.md, Watch out).

Moving the column is a structural edit: the mod rewrites the whole layout file as
2-space JSON with the column (and its `main-column` or `main-row` wrapper) moved,
so a hand-formatted layout loses its formatting. The fold and sizes follow the ids.

Moving a pane into the column is Herdr's `terminal.park` (the pane goes, the
terminal keeps running) then `hc keep` again, since park turns core keep off.

Pins live in Herdr's shared state under `pins.list`. The column opens at the
`size.px` in your layout file: raise it there. lazygit wants about 360 px.

## Limits

- The mod edits your layout file's one `terminal` value. Use a personal layout, and
  expect that value to change in version control if you keep your layouts there.
- A space pin remembers the space's id and, in case the id changes after a core
  restart, its machine and folder (the folder Herdr gives the space, not where
  its shell is now).
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
