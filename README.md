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
- Hover the header for **Pin…** and **Unpin**. Pin… opens a list: **Start lazygit here**, **Start a shell here**, then the terminals in this space's tabs. Each row has three buttons: **Space**, **Machine**, **All**.
- Start rows run the program as a kept terminal (`hc run --keep`) in the space's current folder. Nothing runs by itself: only a Start or Restart click starts a program.
- Pinning again to the same space (or machine, or everywhere) replaces the earlier pin there.
- A pinned terminal that has ended shows as `t7 has ended` with Unpin. Pins are never deleted on their own.
- After a core restart a kept program comes back as a plain shell. The header then offers **Restart**, which types the program's command into that shell.

## Install

Copy (or symlink) `mods/pins` into `~/.config/herdr-app/mods/` and run
`herdr-app check ~/.config/herdr-app/mods/pins`.

Then add the column to a personal layout, that is, a file in
`~/.config/herdr-app/layouts/` that you made or cloned (`herdr-app do layout.clone
'{"name":"main","as":"my-layout"}'`). Herdr's own layouts are replaced on every
start. To put it under the tabs of a `main` clone, wrap the `main` block in a
column and add the pins column after it:

```json
{ "id": "main-column", "type": "column", "gap": 8, "children": [
  { "id": "main", "type": "block", "content": { "tab": "active", "...": "as before" } },
  { "id": "pins", "type": "column", "size": { "px": 240 }, "min": 28, "max": 700,
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
    "cmd-alt-j": "layout.toggle:pins"
  }
}
```

- `pins.pin` pins the focused terminal to this space.
- `pins.unpin` removes the pin shown for this space.
- `layout.toggle:pins` hides or shows the whole column. It is Herdr's own command,
  not the mod's, because a hidden mod gets no key commands and could not show
  the column again.

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
Folding uses `layout.hide` on the terminal block and `layout.resize` on the column,
which Herdr keeps as clicks, not in your file.

Pins live in Herdr's shared state under `pins.list`; the column's open height
(read once from your layout file) under `pins.height`.

## Limits

- The mod edits your layout file's one `terminal` value. Use a personal layout, and
  expect that value to change in version control if you keep your layouts there.
- A space pin remembers the space's id and, in case the id changes after a core
  restart, its machine and folder (the folder Herdr gives the space, not where
  its shell is now).
- After a core restart a kept program is a plain shell until you click Restart.
- Terminals on another machine (`omarchy/t9`) can be pinned: the mod writes their
  address into the layout and Herdr accepts it. Whether the block draws a remote
  terminal is untested.
- Dragging the column's height is not remembered across a fold: it opens again
  at the height from your layout file.
- Built on Herdr 0.1.11, macOS. The swap, fold and pins were checked through the layout file and Herdr's click state; the header and picker have not been seen on screen yet.

## Development

```sh
node --test tests/
```

Stdlib only. `tests/fixtures/layout.json` is a personal layout (a `main` clone)
with the pins column added. Symlinking `mods/pins` into Herdr does not hot-reload
on edits; remove and recreate the link to reload.

## License

MIT. Icons after [Lucide](https://lucide.dev) (ISC).
