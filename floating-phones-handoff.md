# Floating Project Objects — Handoff

A self-contained briefing so a fresh Cowork instance on another computer can pick up where this conversation left off. Drop this doc into a new Cowork chat (along with the live `index.html` if useful) and start from "Suggested next directions" below.

---

## The vision

Replace the static project PNGs in the Recent Work section of jtroll.com with subtly animated "floating" objects that represent each project. The animations should be restrained — this is a portfolio, not a demo reel.

**Object per project:**

- Projects 1, 4, 5, 6, 7, 8 → a floating phone with a subtly animated version of that project's UI on the screen
- Project 2 (Cruise) → a 3D rendition of the Cruise vehicle
- Project 3 → a 3D rendition of the arm device (see `images/arm_extended.png` in the workspace for reference)
- Project 9 → a 3D plate
- Project 10 → TBD

**Motion:**

- Each object floats gently up and down (small amplitude, slow period)
- Each object rotates very subtly on its Y axis, back and forth, over several seconds
- All objects sit against a darker shade of the existing `#FBF7F7` paper background

For phones, the UI on the screen subtly animates (loops a small piece of the product's story — typing into search, a notification arriving, a card flipping, etc.).

---

## Recommended toolchain

After exploring the options, the recommended path is:

**For 3D objects (car, arm, plate, phone shells):** Spline. Purpose-built for "3D object embedded in a website, gently animated, exported to web." Far easier than Three.js for this use case. Free tier likely sufficient for a portfolio.

**For UI inside phone screens:** Real HTML + Framer Motion (or CSS keyframes for simpler cases). Don't render the UI inside the 3D scene — overlay an HTML element with matching CSS perspective transforms.

**For the phone Y-axis rotation:** CSS `perspective` + `transform: rotateY()` on the phone container, animated with CSS keyframes. The "rotation" is faked but at subtle amplitudes (±5–8°) it reads as 3D. This means you don't need a 3D engine for the phones at all — and the real HTML UI on the "screen" rotates along with it natively.

**Skip Rive.** It's a great tool and the right long-term bet for runtime animation, but for this specific use case (subtle Y rotation + tiny UI loops) it doesn't earn its keep. Pure HTML + CSS + a tiny bit of JS gets you there with tools you already know.

### Why not Lottie / Rive / Three.js / React Three Fiber?

- **Lottie:** Designed as an AE export format, not a true runtime. Not interactive. Not the right modern bet.
- **Rive:** Better than Lottie, but fundamentally 2D vector. You'd be faking the 3D rotation anyway, so the extra tool isn't worth the licensing or learning curve for this scope.
- **R3F/Three.js:** Full control, but real dev work. Overkill for "rotating phone with HTML UI on the screen." Use it later if Spline becomes limiting for the 3D objects.

### Why Spline for the non-phone objects?

- Web export is good
- Idle animations (rotation, float) can be authored visually
- The "find a Sketchfab/CGTrader model, import to Spline, set up idle animation, export to web" pipeline is the shortest path
- Free tier is generous

### For the 3D source models (car, arm, plate)

Don't bother with AI 2D→3D extraction unless you've already tried Sketchfab/CGTrader/TurboSquid and come up empty. The Cruise vehicle has a recognizable silhouette but doesn't need to be *exactly* that model — a similar self-driving pod will read correctly. Same for the arm and plate. Pay for a model if needed; it's a fraction of the time-cost of AI extraction + cleanup.

If models aren't available, fallback AI tools (in approximate quality order as of May 2026): Rodin (Hyper3D), Meshy, Tripo3D, Luma AI Genie.

---

## What's been built

### `experiments/floating-phone-local.html`

A working preview of the rotating-phone component with the Facebook Local search flow animating inside. Open it directly in any browser. The artifact demonstrates:

- CSS-perspective Y-axis rotation (±7° over 14s, eased)
- Vertical float (±7px over 7s, desynced from rotation so it doesn't feel mechanical)
- Darker paper background panel (`#EFE4E1` — a tuned darker shade of `#FBF7F7`)
- Drop shadows that follow the floating motion
- Three Local UI states cycling on a loop:
  - **State A (default landing):** stylized SF map with pins (Market Street, The Chapel, Mission Bowling, Tartine Manufactory), "San Francisco / Hayes Valley" header, Create/Calendar/Your Places chips, Your Upcoming Events (Kendrick Lamar / Warfield), Find Things To Do divider, iOS tab bar with notification badge. Includes a subtle "tap pulse" on the search area before transitioning.
  - **State B (typeahead):** small map preview at top, white search field with letter-by-letter typing of "br", suggestion rows for Breakfast Places, Brolognese, Brava Theater Center, Brasilia Lecture, Brunch Places, Brockhampton. Suggestions stagger-in.
  - **State C (results):** map with multiple "br" matches, search bar overlay, All/Places/Events/Movies/Lists tab nav, three result cards (Bray's Kitchen, Brek Fusion, Brockhampton at DNA) that stagger-in.

Everything is hand-built HTML/CSS/SVG — no external dependencies, no images. The map is stylized SVG (yellow main roads on a sand background), not a real Mapbox tile, because it loads instantly and matches the restrained aesthetic of the rest of the site.

### What's faked vs. real in the preview

- **Faked:** Map is stylized SVG, not live tiles. Pin icons are typographic glyphs (▲ ■ ♪ etc.) as placeholders for proper SVG icons. The "3D rotation" is CSS perspective, not WebGL.
- **Real:** All typography hierarchy, status bar, tab bar, card layouts, typing animation, list-item stagger, tap-pulse, drop shadow that tracks the float.

### Known things to tune before shipping

- Rotation amplitude (currently ±7°, easy to dial up or down)
- Float amplitude and speed
- Beat lengths between states (currently 3.4–3.8s each)
- Exact darker-paper shade (`#EFE4E1` is a candidate; `#E8D9D5` is slightly darker)
- Whether a caption appears below the object, or whether it's inline with existing Recent Work card metadata
- Replace placeholder glyph pins with proper SVG icons
- Possibly add a very faint reflection / contact shadow under the phone for grounding

---

## Figma source references

**Portfolio Figma (main site):** https://www.figma.com/design/72wwhIeATWGjeoszE9TimZ/JTroll-3.0?node-id=2883-3

**Trollman Portfolio 2026 (Local prototype):** https://www.figma.com/design/myNEwzQ0vWgDD6nBAi4Yro/Trollman-Portfolio-2026

The Local prototype frame containing all 12 search states is at node `8917-43005`. Individual state node IDs:

- `8917:42994` — 01 Default
- `8917:43006` — 02 Search Null
- `8930:58372` — 03 Keyboard Down
- `8918:48254` — 04 Location Bar
- `8930:59523` — 06 Unified Typeahead
- `8930:61065` — 07 Null
- `8930:62416` — 08 High Confidence
- `8930:65581` — 11 Event Permalink
- `8938:68992` — 13 String Search All
- `8938:70838` — 14 String Search All Up
- `8938:73180` — 15 String Search Places
- `8938:77079` — 16 String Search Events

The preview uses states 01, 06, and 13 — the tightest 3-frame story that conveys what Local does (browse map → typeahead → results).

For other projects, JT also has Campus screens in Figma (location TBD when this picks back up).

---

## Existing portfolio context

The portfolio site lives at `C:\Users\jtrol\Dropbox\Sites\JTroll\jtroll\` and is deployed via GitHub Pages to jtroll.com. Full context is in `JTroll-3.0-handoff.md` in the same folder.

Relevant color tokens (already in `master.css`):

- `#001C2F` ink (text primary)
- `#687B88` muted gray (text secondary)
- `#D1293D` JTroll red (accent)
- `#A92626` darker red (hover)
- `#FBF7F7` paper background (current Recent Work section uses this)
- `#FFFFFF` white

The darker-paper shade for the floating-object panel should be a *noticeable but quiet* darker version of `#FBF7F7`. Current candidate: `#EFE4E1`.

Tech stack: HTML5 + Tachyons + jQuery + Archivo. No build pipeline.

---

## Suggested next directions

Pick whichever feels most useful — open priorities in rough order of impact:

1. **Refine the Local preview to portfolio-ready quality.** Replace glyph pins with proper SVG icons, possibly source/swap to a real iOS keyboard graphic for state B, tune rotation/float amplitudes, add a soft contact shadow under the phone.

2. **Build the Campus floating phone next.** JT has the Figma for Campus. Same pattern as Local — three UI states cycling, same `<FloatingPhone>` wrapper. Confirms the wrapper is genuinely reusable.

3. **Wire one floating-phone into the live `index.html`.** Slot it into the Recent Work section where the current static PNG sits, match the existing card sizing, and verify it doesn't break the desktop or mobile layouts.

4. **Spline test for project 2 (Cruise).** Source a Cruise-like 3D vehicle model from Sketchfab, import to Spline, author the idle rotation + float, embed in a parallel `experiments/floating-cruise.html`. This proves the Spline pipeline before committing to it for the remaining 3D projects.

5. **Decide on caption / metadata placement.** Does each floating object have its own title/caption, or does it sit inside a card structure that handles that? Affects how the wrapper component is parameterized.

6. **Mobile sizing audit.** The current preview is sized for desktop (280px wide phone). On mobile, the floating object needs to scale down — possibly to ~220px — and the rotation amplitude might need to reduce to feel right at smaller sizes.

7. **Performance check on a real device.** CSS perspective + drop-shadow + 9 simultaneous floating objects could be heavy. May need `content-visibility: auto` or to pause animations off-screen via `IntersectionObserver`.

---

## Starting prompt to paste into the new Cowork chat

```
I'm continuing a portfolio project from another Cowork instance.

Read floating-phones-handoff.md in this folder for the full context —
vision, recommended toolchain, what's been built, Figma references,
and suggested next directions.

The working preview from the last session is at
experiments/floating-phone-local.html — open it in a browser to see
the current craft level.

The portfolio itself is the index.html and master.css in this folder,
deployed to jtroll.com via GitHub Pages.

Let's start with: [pick a direction from the handoff, e.g.
"refine the Local preview", "build the Campus floating phone next",
or "Spline test for the Cruise vehicle"]
```
