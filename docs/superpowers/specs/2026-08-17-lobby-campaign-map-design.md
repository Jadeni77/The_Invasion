# Lobby as a Campaign Map — Design

**Date:** 2026-08-17
**Status:** Approved, ready for implementation planning
**Scope:** The lobby screen only. The gameboard gets its own spec.
**Visual reference:** `docs/superpowers/reference/2026-08-17-lobby-campaign-map-mockup.html` — open it in a
browser. The owner reviewed and approved this mockup; it is the target, not an illustration of one.

## Problem

The owner's words: *"They dont look cool. It just seem like a big board with feature."* And on new
players: *"they might just think the UI is bad, which imply the game is bad as well."*

That reads as an aesthetic complaint but most of it is defects. Verified in code:

1. **`.lobby-container` is declared three times** — at lines 1, 156 and 496 of `Lobby.css`. The third
   uses the `background` **shorthand**, which resets `background-image` and `background-color`, so it
   erases the other two. The purple page nobody chose is simply the last rule standing. All three also
   set conflicting layout: `min-height` versus `height`, flex versus not, `overflow` visible versus
   hidden.
2. **The lobby's art is missing — all three images.** This is the finding that reframes everything else,
   and it surfaced during this spec's own self-review rather than the original diagnosis:

   | Selector | Referenced file | Status |
   |---|---|---|
   | `.lobby-container` | `/assets/lobby-bg.jpg` | **missing** |
   | `.game-map` | `/assets/map-bg.png` | **missing** |
   | `.level-node` | `/assets/level-node.png` | **missing** |

   `public/` contains only `vite.svg`. So the lobby was built expecting a page background, a map texture
   and a node graphic, and **none of the three has ever existed**. That is why the page falls through to
   whatever colour wins the cascade, why the map is a flat rectangle, and why the level nodes are plain
   circles.

   The screen is therefore not badly styled so much as **stripped of its art**. That changes what this
   work is: not polishing weak styling, but supplying in CSS and SVG what three absent images were meant
   to provide.

   The font guard verifies `@font-face` URLs resolve. **Nothing checks `background-image` URLs**, which is
   how three broken references sat unnoticed.
3. **`height: 100vh` with `overflow: hidden` clips the top bar** rather than letting it scroll. That is
   the cut-off header in the owner's screenshot.
4. **The board is a semantic accent used as a surface.** `.game-map` sets
   `background-color: var(--colors-accent-success)` — the confirmation/reward accent — across 800px ×
   60vh. It is why the board reads as a giant flat green rectangle, and why the dark level nodes on it
   are hard to read.
5. **The purple gradient is built from `decorative` tokens**, which are documented as explicitly
   non-semantic and exist for a rainbow connector and a portal spinner.
6. **The map overflows horizontally** and the overflow is clipped, so levels 15 through 17 and their
   names are unreachable.
7. **Three stacked chrome blocks** — player bar, energy panel, resource pills — consume roughly a third
   of the height before the map begins.

The visual-direction work that preceded this made the lobby *consistent*. Consistency is not craft: a
uniformly flat screen is coherent and still dead. What is missing is materiality — depth, texture,
framing, a focal point, and a background that is a place rather than a fill.

## Direction: a campaign map you advance across

The owner chose this over a war-table reframing and over a cleaned-up diagram. The path already winds,
has boss markers, chests and zones — the structure is sound. It reads as a flowchart because it is dark
circles on a flat accent-green rectangle with no depth.

Regions gain progressive character as you advance: settled ground, then ashlands, then scorched reach.
Distance along the path becomes escalation.

**Everything here is CSS and SVG. No art assets are required and none should be invented.**

## Composition

The mockup is the reference; this section states the intent so the implementation is not a pixel copy.

**Filling the space** was the one correction the owner asked for after seeing the first mockup: *"there
are a lot of empty spaces."* Four things address it, and all four matter:

| Layer | Occupies | Purpose |
|---|---|---|
| Ridgeline silhouettes | top ~44% of each region, two passes | depth; fills what was dead sky |
| The route | full height, high vertical amplitude | converts vertical emptiness into path |
| Scenery props | between nodes, mid-ground | fills horizontal gaps, gives regions identity |
| Foreground band | bottom ~22% | frames the composition; nearer reads darker |

A vignette over the whole terrain, and a soft seam rather than a hard edge between regions.

**The props in the mockup are emoji as a stand-in.** They prove placement and density. Real props
should be simple SVG shapes so they take their colour from the token layer — emoji cannot be
recoloured and would reintroduce a second palette.

**Honest ceiling:** CSS and SVG buy material — depth, layering, grain. They will not look painted. This
layer structure is where illustrated regions would drop in later if wanted.

## The map pans

The terrain is wider than its viewport, and opens **centred on the next playable level**. Unreached
regions existing off-screen is the point — that is the difference between a journey and a diagram.

`overflow` moves off the page container and onto the map viewport, which is what un-clips the top bar.

## Nodes

Three states that are **visually distinct**, not three shades of the same circle: completed, available,
locked. Raised surface, thick outline, display font. The available node draws the eye.

Boss nodes read as fortified rather than merely red. Chests are landmarks on the route.

## Top chrome

The three stacked blocks compact into one band, giving the reclaimed third of the screen to the map.
Player identity, the icon buttons, energy and resources all fit one row.

## Out of scope

- **The gameboard.** Its problems are compositional rather than structural — a single lane in an empty
  brown void, a base that is a small yellow rectangle, a raw 1px red line and a white selection box
  that both read as debug artifacts. Different diagnosis, own spec.
- **Painted art**, and any prop needing a sourced asset.
- **What stars mean.** They are computed, stored and displayed already; whether earning them should
  reward more is game design.
- **Unlock flows** — the two `MapLayout` TODOs.

## Testing

**jsdom has no layout engine or rasteriser.** No test here can confirm the lobby looks good; that is the
owner's eyes against the committed mockup. Stating that plainly is part of the spec, because five
previous rounds of this project produced tests that implied coverage they did not have.

Mechanically testable, and required:

| Test | Asserts |
|---|---|
| One container rule | `.lobby-container` is declared exactly once |
| **Every CSS `url()` resolves** | No stylesheet references a file that does not exist — closes the gap that let **three** broken references sit unnoticed, and the twelfth scope failure of its kind in this project |
| Node states differ | Completed, available and locked resolve to distinct declared colours |
| Node and label contrast | Text on nodes and region labels passes the existing WCAG guard |
| Opening offset | The map's initial scroll centres the next playable level, not level 1 |
| No accent as surface | `.game-map` and the region backdrops do not use an `accent-*` token as their background |
| Chrome is one band | The player, energy and resource blocks share a single container |

The `url()` guard is the durable one. Eleven guards have been found in this project that did not guard,
and **every one failed on scope rather than on matching logic** — each scanned too narrow a set. Derive
its file list from the source tree, the way `Frontend/src/test/sourceFiles.js` already does, not from a
hand-written list.

## Success criteria

1. The lobby reads as a place being advanced across, not a board with features on it.
2. No dead space that neither route, terrain, scenery nor framing occupies.
3. `.lobby-container` is declared once, and the page background is deliberate.
4. No stylesheet references a missing file — all three broken image references are resolved or removed.
5. Level numbers are legible, and the next playable level is obvious without reading.
6. The top bar is never clipped.
7. Every level and the endless portal is reachable.
8. No semantic accent token is used as a page-scale surface.
9. The full test suite passes.
