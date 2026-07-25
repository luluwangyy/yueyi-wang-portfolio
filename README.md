# Personal Portfolio

Plain HTML/CSS/JS — no build step, no framework. Open the folder in VS Code
and use the **Live Server** extension (right-click `index.html` → "Open with
Live Server") to preview with auto-reload.

## Structure

```
index.html              Home: hero intro + scrolled project grid (6 projects)
about.html               About page
projects/
  creative-destruction.html
  the-roro.html
  audiovisual.html
  urbansky.html
  ai-storytelling.html
  generative-disco.html
css/
  reset.css              Minimal base reset
  style.css              All design tokens, layout, and animation
js/
  main.js                Scroll-reveal, scroll-cue, and media-fallback behavior
assets/
  images/<project-slug>/  Photos — one subfolder per project
  videos/<project-slug>/  Videos — one subfolder per project
```

## How navigation works

- **Logo** → `index.html#top` (hero section)
- **Projects** (nav) → `index.html#projects` (scrolls there smoothly;
  jumps straight there if you're on another page)
- **About** → `about.html`
- Each **project card** → its own page in `projects/`
- Each project page ends with two **Related Project** boxes linking to two
  other projects

Page-to-page transitions cross-fade automatically in Chrome/Edge via the
`@view-transition` rule in `style.css` — no JS router needed.

## Adding your photos and videos

Every `<img>`/`<video>` on the site points at a specific file path. Save your
media using the **exact filenames** below and drop them in the matching
folder — nothing else needs to change, they'll appear automatically. Until a
file exists, that slot just shows the plain muted box (a small script in
`main.js` hides the broken image/video icon for you).

If a photo isn't a `.jpg`, or a video isn't a `.mp4`, just tell me the format
you have and I'll update the `src`/`type` in that page.

Every project also supports an optional **`cover.mp4`** (~3 seconds, muted,
looping) — on the homepage grid it fades in and autoplays on hover over the
card, replacing the static `cover.jpg`. It only loads when hovered
(`preload="none"`), so it adds no load time to the initial page visit, and if
it's missing the card just shows the static cover as normal.

| Project | File to save | Goes in |
|---|---|---|
| **Creative Destruction** | `cover.jpg`, `cover.mp4` (hover preview) | `assets/images/…` / `assets/videos/creative-destruction/` |
| | `part1-installation.mp4` (+ poster `part1-installation.jpg`) | video → `assets/videos/creative-destruction/`, poster → `assets/images/creative-destruction/` |
| | `part2-robotic-performance.mp4` (+ poster `part2-robotic-performance.jpg`) | same pattern as above |
| **The Roro** | `cover.jpg`, `cover.mp4` (hover preview) | `assets/images/…` / `assets/videos/the-roro/` |
| | `01-cad-design.jpg` | `assets/images/the-roro/` |
| | `02-3d-printing.jpg` | `assets/images/the-roro/` |
| | `03-assembly.jpg` | `assets/images/the-roro/` |
| | `04-gait-programming.mp4` (+ poster `04-gait-programming.jpg`) | video → `assets/videos/the-roro/`, poster → `assets/images/the-roro/` |
| | `05-final-product.jpg` | `assets/images/the-roro/` |
| **Audiovisual** | `cover.jpg`, `cover.mp4` (hover preview) | `assets/images/…` / `assets/videos/audiovisual/` |
| | `performance.mp4` (+ poster `performance.jpg`) | video → `assets/videos/audiovisual/`, poster → `assets/images/audiovisual/` |
| **UrbanSky** | `cover.jpg`, `cover.mp4` (hover preview) | `assets/images/…` / `assets/videos/urbansky/` |
| | `demo.mp4` (+ poster `demo.jpg`) | video → `assets/videos/urbansky/`, poster → `assets/images/urbansky/` |
| **AI & Storytelling** | `cover.jpg` (also the video poster), `cover.mp4` (hover preview) | `assets/images/…` / `assets/videos/ai-storytelling/` |
| | `demo.mp4` | `assets/videos/ai-storytelling/` |
| **Generative Disco** | `cover.jpg`, `cover.mp4` (hover preview) | `assets/images/…` / `assets/videos/generative-disco/` |

Note: **The Roro**'s build-timeline steps (CAD design, 3D printing, assembly,
final product) don't have written descriptions yet — the source content only
gave the phase names, and per the "don't invent placeholder copy" rule I left
those captions out rather than making something up. Send over a line for each
step whenever you're ready and I'll drop them in.

## Customize

- `#` social links (GitHub, Instagram) in the footer still need real URLs

### Design decisions worth knowing about

- **Fonts**: General Sans (Fontshare) — bold/black weights for headlines,
  regular/medium for body. Loaded in each page's `<head>`.
- **Color**: pure white background, near-black text, no color accent —
  fully monochrome to match the reference look.
- **Tags**: plain uppercase text separated by `·`, not colored pill badges.
- **Project boxes**: subtly rounded corners (`--radius: 8px`), no number
  overlay.
- **Photos/videos are never filtered or tinted** — no CSS `filter`, no
  overlay gradient on top of real media, per project rules. They render
  exactly as supplied.
- **Project detail pages**: the big cover image/video comes first, then the
  title/role/year block, then the description (which spans the same width
  as the media, not a narrow text column).
- **Related Projects**: the six project pages form a single loop
  (Creative Destruction → The Roro → Audiovisual → UrbanSky →
  AI & Storytelling → Generative Disco → back to Creative Destruction),
  with Previous/Next links at the bottom of each page.
- **Motion**: CSS-only — hero fades in on load, project cards reveal on
  scroll, cards lift slightly on hover, everything presses down slightly on
  click/tap. Disabled automatically for `prefers-reduced-motion`.

## Next steps (optional, not done yet)

- Drop in real photos/videos per the table above
- Write the five short captions for The Roro's build timeline
- Add real GitHub/Instagram links in the footer
- Add a favicon
