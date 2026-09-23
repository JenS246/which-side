# Which Side?

**A quick civil-case logic game**

Which Side? is a short browser-based deduction game for college classrooms. Players use visible clues to assign sixteen illustrated characters to the Plaintiff Team or Defendant Team. Each supported assignment reveals another clue.

This is an original, standalone project. It does not use or modify the In Evidence repository.

## How it works

- Eight handcrafted puzzles with a visible 1-to-8 difficulty ramp: guided links, paired deductions, row/column intersections, corners, neighbors, cross-board counts, linked systems, and a multi-clue finale
- Deterministic in-browser solver that accepts a choice only when the visible clues establish it
- Specific feedback for contradictory choices and neutral feedback when more information is needed
- Hints, undo, reset, optional timer, local progress, and spoiler-free share results
- A fixed 4-by-4 board at desktop and phone widths
- Original generated editorial portraits stored locally in the repository
- No backend, accounts, analytics, or external services

Puzzle data lives in `src/puzzles.js`. The shared constraint solver and validation helpers live in `src/engine.js`. Interface behavior lives in `src/app.js`.

## Run locally

Requires Python 3 for the simple local server and Node.js for validation.

```bash
npm run serve
```

Open <http://localhost:4173>.

## Validate and test

```bash
npm run check
```

The validator enumerates all 65,536 possible team assignments for every puzzle. It confirms:

- exactly one solution exists;
- the intended solution is that unique solution;
- each clue uses a supported type and defined board term;
- the intended path never stalls;
- every state reachable by choosing any currently supported move still has a supported next move;
- all sixteen characters and all clues are reachable.

The launch set is deliberately ordered. Case 1 teaches same/opposite links; later cases remove direct clues and combine row, column, corner, and neighbor constraints. The two challenge cases require linked clue systems rather than a single clue chain.

The unit tests also cover supported, unsupported, and contradictory choices.

## Deployment

The production site is published with GitHub Pages from the `main` branch through `.github/workflows/pages.yml`.

- Source: <https://github.com/JenS246/which-side>
- Live game: <https://jens246.github.io/which-side/>

No backend, database, private data, or secrets are used. Browser progress is stored only in `localStorage` under `which-side-progress-v2`. The storage version was advanced when the launch puzzles were redesigned so older assignments cannot conflict with the new solutions.

## Accessibility

All controls use native keyboard-accessible elements, visible focus rings, descriptive labels, and text plus color for team state. Motion is limited to feedback transitions and disabled under `prefers-reduced-motion`. The palette supports light and dark system themes.

## Artwork

The sixteen-character portrait sheet was generated specifically for this project with OpenAI's built-in image generation tool using this final prompt summary:

> A precise 4-by-4 sprite sheet of sixteen diverse adult civil-litigation team members in a contemporary hand-drawn realistic-cartoon style. Expressive black and cobalt brush-pen outlines, loose construction marks, marker hatching, cool backgrounds, and flat screen-printed cobalt, chartreuse, tangerine, raspberry, lavender, and mint inks. A strict pose matrix mixes direct gazes, true profiles, downward looks, eyes-closed expressions, strong opposing head tilts, an over-the-shoulder view, and varied shoulder angles. No text, logos, police, gavels, scales, or team-coded styling.

The asset is stored at `assets/portrait-grid.png` and is cropped into individual cards with CSS background positioning.
