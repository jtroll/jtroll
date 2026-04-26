# JTroll 3.0 — Handoff to Claude Design

A self-contained briefing so you can pick up where Cowork mode left off. Upload this file (and the Figma URL) into a fresh Claude Design project to get rolling.

---

## The project

JTroll 3.0 is the single-page personal portfolio site for **J.T. Trollman** — design leader currently at SoFi, formerly Cruise, Meta, and IDEO. The site lives at jtroll.com (currently serving the older 2.0); this refresh is being designed in Figma and hand-coded.

**Design intent:** intentionally single-page — secondary pages are off the table for now. Sections in order: Hero → Featured Writing → Recent Work → About → Speaking, Teaching & Mentoring → Photos → Contact.

**Tagline:** "Practically speaking, I try to solve meaningful problems for people."

---

## Key files and locations

- **Figma source:** https://www.figma.com/design/72wwhIeATWGjeoszE9TimZ/JTroll-3.0?node-id=2883-3
- **Live HTML:** `C:\Users\jtrol\Dropbox\Sites\JTroll\jtroll\index.html` — the active source, git-tracked, deployed via GitHub Pages
- **Live CSS:** `C:\Users\jtrol\Dropbox\Sites\JTroll\jtroll\css\master.css` — custom styles + Tachyons utilities
- **Image assets:** `C:\Users\jtrol\Dropbox\Sites\JTroll\jtroll\images\` — includes the `SoFi images/` subfolder
- **Archive (historical):** `C:\Users\jtrol\Dropbox\Sites\JTroll\archive\` — old 2.0 site, source PSDs, Sketch files, raw asset bank, prior HTML snapshots, 2020 zip backup

The folder was recently reorganized: a single canonical source-of-truth (`jtroll/`) replaced the prior split between `JTroll 3.0/` (working source) and `jtroll/` (deployed but stale). Everything from 3.0 + 3.1 was merged into `jtroll/`.

---

## Tech stack

- HTML5 markup, Tachyons utility CSS framework + custom `master.css`
- jQuery 3.2.1 (already loaded; powers header-shadow, smooth-scroll, and the About disclosure)
- Archivo + Archivo Black via Google Fonts
- Color tokens:
  - `#001C2F` ink (textprimary)
  - `#687B88` muted gray (textsecondary)
  - `#D1293D` JTroll red (textred)
  - `#A92626` darker red (hover)
  - `#FBF7F7` reddish background
  - `#FFFFFF` white

---

## Design critique — summary

The full critique was completed in Cowork. Highlights:

### What works
- Tagline is honest, specific, and on-brand
- 3D avatar character adds warmth and personality
- Recent Work has strong visual variety
- Photos section humanizes the portfolio
- Clean, restrained aesthetic

### Critical issues (open)
- **No primary CTA in the hero.** Visitor has to invent their own path between social icons, Featured Writing, and Recent Work. Pick one action ("See recent work" / "Read my writing") and elevate it.
- **Navigation lacks orientation aids on a 10,291-pixel page.** No sticky nav or back-to-top — visitors get lost after the first fold.

### Moderate issues (open)
- **Section density** — every section lives on one page; structure could be sharper.
- **Card consistency** — Featured Writing, Recent Work, and Speaking use different sizes, captions, and aspect ratios.
- **Photos section** uses tall vertical portraits that feel stylistically apart from the rest of the site.

### Resolved
- ~~About section was a wall of prose~~ — refactored into a short intro with a Read-more disclosure (see "What's been done" below).

### Visual hierarchy notes
- Tagline + avatar correctly draw the eye first ✓
- Recent Work has the strongest visuals but sits *below* Featured Writing — consider reordering
- Reading flow through the page could be tightened

### Accessibility (preliminary, desktop-only review)
- Body text contrast looks fine
- Nav text appears small — verify on real devices
- Touch targets need 44×44px minimum on mobile
- Long-form prose would benefit from tighter measure (~65–75 chars) and more generous line-height

---

## What's been done

### About section — short version + Read-more disclosure ✅

The About section was a single ~450-word block. Now:

**1. Default-visible bio shortened to ~130 words**, preserving the strongest line ("greatest amount of good I can manage") and the SoFi → Cruise → Meta arc.

**2. Read-more disclosure** that expands inline to reveal the full version, organized into two subsections:
- "The work, in more detail" — SoFi (with "why I joined" framing), Cruise, full Meta history (neural interfaces, Community Incubator, Events/Local with Yelp/pandemic context, Community Integrity, early Android/News Feed/stickers)
- "Outside the day job" — MADA, startups, plus a Bay Area life paragraph

**Implementation specifics:**

- HTML: `<div class="about" data-expanded="false">` wrapper containing the short intro, a `<div id="about-more" class="about__more" aria-hidden="true">` collapsed block, and a `<button data-about-toggle aria-expanded="false" aria-controls="about-more">` toggle.
- CSS (in `master.css`, lines 432–514): smooth height animation via `grid-template-rows: 0fr → 1fr`, custom toggle button using `#D1293D` red, arrow rotation, label swap, `prefers-reduced-motion` and `@media print` rules.
- JS (inline at bottom of `index.html`): jQuery handler that flips `aria-expanded`, `data-expanded`, and `aria-hidden`. On collapse, smooth-scrolls back to the About anchor (420ms duration synced to the CSS transition).

The copy was voice-edited by J.T. — no AI-tone artifacts remain.

---

## Current About copy (live in `index.html`)

### Default-visible short version (~130 words)

> I'm a design leader focused on 0–1 product work in both hardware/software and pure software environments — making hard new things real and useful at scale.
>
> Currently I'm senior director of design for one of SoFi's three business units, covering AI-in-product, membership, growth, premium features and personal finance. Before this I led design for Cruise's ridehail consumer experience, and spent 10 years at Meta — most recently building the experience design org for neural interfaces in their AR division.
>
> I'm invested most in products that do the greatest amount of good I can manage — human connection, underserved communities, trust & safety, public information, and creating access to the previously inaccessible. I've also co-founded two startups, advised others, and spent a few years at IDEO.

### Read-more expansion

#### The work, in more detail

> I joined SoFi because it's a company uniquely positioned to create a powerful AI-in-product experience that creates groundbreaking access to the right information & products to help you in your personal finance journey. In a world with increasing divides between the haves and have-nots, I've found meaning in giving everyday people power at their fingertips previously only available to the wealthy. I spend my days at the intersection of AI, primary navigation, membership, 0–1 premium feature creation, growth, and personal finance management tools — the places where small design decisions compound into either real help or real frustration for the people we serve.
>
> In 2023 I briefly served as head of product design for Cruise's ridehail consumer experiences, covering roughly 80% of their business. I joined with the goal of helping scale to 13 new cities in the next year, supporting three novel car platforms, all interior and exterior vehicle user experiences, and our full phone app experiences.
>
> My decade at Meta was my longest chapter. I concluded with 2.5 years as head of experience design for a line of new "neural interfaces" products in the AR division — work that affected around 2,000 cross-functional employees, with 5 teams I built directly. Together we pushed the boundaries of novel input technology and filed over 12 patents in unique user interfaces.
>
> Earlier at Meta I supported multiple "0–1" product teams within Facebook App's Community Incubator group, and was a product lead for Meta's company-wide design education initiatives. Before that I supported Facebook's Events products and Local app, helping people spend more time with close friends and family in the real world. Our standalone Facebook Local app (and sibling tab within the Facebook app) had greater retention and stickiness than Yelp in the US, just before the pandemic hit… and killed global local discovery intent for the next three years. Those were interesting times.
>
> For years prior I was design lead on the Community Integrity team, building some of the industry's first mature social content moderation and help products — everything from AI/ML chatbot technology to redesigning our reporting and help center tools. Going further back: I was one of two designers to create Facebook's first Android design & navigation system in service of better emerging-market support, and worked on News Feed and expression products. (I was the first to ship rich comments like stickers. Remember those?)

#### Outside the day job

> I've spoken both domestically and internationally about a number of issues I care about. After the 2016 US election I became the founding designer for Make America Dinner Again, a passion project to facilitate understanding across the political divide. We grew to over 12 chapters nationwide, and were covered everywhere from The New York Times to the BBC to The Blaze. Somehow both Oprah and Glenn Beck love us.
>
> Before all that I co-founded two startups in social media/creation and local discovery (B4UGO and Happiness Engines), piloted a small design consultancy, and tinkered on countless side projects with friends. I've also acted as an advisor and strategist for startups, and worked alongside great folks at IDEO for some years.
>
> I live in the Bay Area with my family, and outside of software tinkering I love woodworking, autocross, backpacking, and talking way more than is reasonable about automotive history and cartography.

---

## Suggested next directions in Claude Design

Pick whichever feels most useful — these are the open priorities:

1. **Hero variants with a primary CTA** — generate 4–5 alternate hero layouts that incorporate a clear primary action while preserving the tagline and avatar.
2. **Unified card system** — design one or two standardized card components that work across Featured Writing, Recent Work, and Speaking.
3. **Sticky / mini-nav explorations** — alternatives for navigation persistence on a long page.
4. **Photos section integration** — reconcile the vertical portrait style with the rest of the site's visual language.
5. **Mobile-first audit** — current Figma is desktop-only (1440×10291); generate the mobile counterparts.

The About section is fully resolved (copy, structure, and interaction) so it doesn't need work — but you could ask Claude Design for visual variants on how the Read-more disclosure animates or where the toggle sits, if you want to explore.

---

## Starting prompt to paste into Claude Design

```
I'm bringing my personal portfolio site over from Cowork. Single-page intentionally — I don't want secondary pages.

Figma: https://www.figma.com/design/72wwhIeATWGjeoszE9TimZ/JTroll-3.0
Tech: HTML5 + Tachyons + jQuery + Archivo. Color tokens: #001C2F ink,
#687B88 muted, #D1293D red, #FBF7F7 reddish background.

I've already attached this handoff doc plus my current index.html and
master.css for context. The About section is fully done — copy edited
in my voice and shipped to the live files.

Top open priorities from my critique:
1. Hero needs a primary CTA — no clear "do this next" right now.
2. The 10,291-pixel page lacks sticky nav / wayfinding.
3. Card systems vary across Featured Writing / Recent Work / Speaking
   and could be unified.

Let's start with: [pick one — e.g., "5 hero variants with primary CTAs"
or "a unified card component system" or "sticky nav explorations"]
```

---

## Files to upload alongside this doc

When you start the Claude Design project, drop these in too:

- `jtroll/index.html` — current live markup
- `jtroll/css/master.css` — current live styles
- A screenshot of the current desktop frame (or just paste the Figma URL — Claude Design pulls from Figma directly)
- Optionally: representative images from `jtroll/images/` (the 3D avatar `jt_avatar_3d.png`, the SoFi imagery folder, project shots) so Claude Design can see the visual asset library.
