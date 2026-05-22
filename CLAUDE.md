# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Michael Suen's personal site — `whoismichaelsuen.com`. Pure static HTML/CSS/JS, no build step, no package manager. View source = shipped source. Don't introduce a bundler, framework, or npm tooling unless asked.

## Local dev

Serve from the project root:

```
python3 -m http.server 8080
```

(See `.claude/launch.json` — the configured port is 8080.) Open `http://localhost:8080`.

When you change `js/main.js` or `css/styles.css`, bump the `?v=` query string in `index.html` (currently `main.js?v=4`, `styles.css?v=2`) so cached browsers fetch the new file.

## Architecture

The whole page is a single `index.html` driven by two scripts and one stylesheet. The non-obvious bits:

**Parallax hero is a fixed-position scroll illusion.** `#parallax` is `position: fixed` and fills the viewport. Inside it sit ~10 stacked image layers and an `#about-layer` containing every section below the hero. None of these elements naturally produce scroll height — `js/main.js` computes a synthetic `document.body.style.height` based on `heroHeight + contentHeight` divided by the slowest layer's speed (0.8), so the page is "scrollable" even though its content is fixed-positioned. On every `scroll`, each `.parallax-layer` (and `.parallax-about`) gets a `translate3d(0, scrollY * -speed, 0)` transform from its `data-speed` attribute. Layers are disabled below 768px (`@media (max-width: 767px)`); a static `.mobile-hero-bg` shows instead.

**`IntersectionObserver` does not work here.** Because everything lives inside a fixed parent, the observer reports stale rects. `.scroll-reveal` elements are checked manually via `getBoundingClientRect()` on each scroll tick. If you add new reveal-on-scroll behavior, follow that pattern — don't reach for `IntersectionObserver`.

**Header fade is coupled to layer overlap, not scroll position.** As `scrollY` grows, the script computes where the foreground character layer's top sits relative to the header's center and fades the header to 0 over a 300px range. This means the hero text disappears as the foreground rises into it, not at a fixed scroll distance.

**Water ripple is its own animation loop.** `js/water.js` runs an independent `requestAnimationFrame` render that:
1. Loads `images/bg2-water@2x.png` and `images/bg2-buildings@2x.png`.
2. Draws the buildings flipped vertically with reduced alpha as a reflection.
3. Slices both images into 40–80 horizontal strips and offsets each strip by a sine/cosine wave whose strength ramps up toward the bottom.
The canvas (`#water-canvas`) sits inside a parallax layer with a CSS `mask-image` linear-gradient so only the lower half is visible — that's how it blends into the buildings layer above.

**Tailwind is the CDN build with an inline config.** `<script src="https://cdn.tailwindcss.com">` in `index.html`, with `tailwind.config = { ... }` defining `font-display`, `font-sans`, and the `brand` color palette (`brand-orange #ef4723`, `brand-dark #1c0806`, `brand-light`, `brand-charcoal`). Use Tailwind classes in markup; reach for `css/styles.css` only for things Tailwind can't express (the bird sprite animation, modal styles, the parallax positioning, the water canvas).

**Fonts come from Typography.com (paid CDN).** `Gotham SSm A/B` (sans) and `Sentinel SSm A/B` (display serif). Don't swap font stacks without confirming.

**"Apply as a client" form has no backend.** `js/main.js` serializes the form into a `mailto:michael@weirdo.design` link and triggers `window.location.href`. If a real submission endpoint is ever added, replace that block — don't bolt on alongside it.

## File map

- `index.html` — the entire page (hero markup, bio, "what I'm up to", testimonials, footer, modal). Tailwind config and meta tags live here too.
- `css/styles.css` — parallax layer rules, bird sprite animation (inline SVG `data:` URI), scroll-reveal placeholder, modal styles. Tailwind handles everything else.
- `js/main.js` — five IIFEs: parallax + body-height + header fade, scroll-reveal, typed-text effect (currently no `#typed-target` in the DOM, so it no-ops), apply modal, portfolio switcher (also no-ops — no `#portfolio-nav` in the DOM).
- `js/water.js` — water/reflection canvas animation (independent of `main.js`).
- `images/` — `bgN@2x.{png,webp}` parallax layers (1 = foreground, 8 = farthest back), mobile fallback, favicons, character/screen stills, `seagulls.json` (Lottie data, not currently wired up).

## Conventions

- Every raster image has a `.webp` next to its `.png` — use `<picture><source srcset="...webp" type="image/webp"><img src="...png"></picture>` for new images.
- Parallax layers are ordered back-to-front by `z-index` 1 → 11, with `data-speed` increasing roughly in lockstep (slower = farther back). `#about-layer` uses `data-speed="0.8"` so it tracks the foreground.
- The "bird-anim" elements in the birds layer use eight pre-defined `.anim1`–`.anim8` keyframe variants (different durations/delays/directions) wrapped around five `.bird1`–`.bird5` sprite scales. Reuse these classes rather than authoring new keyframes.

## Session note

`claude_code_use_powershell_tool=1` — use the PowerShell tool, not Bash, for shell commands in this repo.
