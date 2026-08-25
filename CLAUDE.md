# Rack — gym workout tracker

## What this is

A personal workout tracker for one user (Waabis). Web app, added to the iPhone
home screen. No build step and no npm dependencies. Three static files:

- `index.html` — the whole app, still readable end to end
- `sw.js` — service worker: offline shell and clean updates
- `manifest.json` — home-screen install metadata

Supabase (cloud backup) is loaded from a CDN `<script>` tag, not bundled.

Live at: https://waabis.github.io/GymTracker/ (GitHub Pages, `main` branch, root)

## Deploying

**Bump `CACHE` in `sw.js` whenever `index.html` changes.** Changing `sw.js` is
what tells a phone there is a new version; without a bump, phones keep serving
the cached old app forever and your change never lands.

Testing the service worker needs a real server — it will not register over
`file://`. `.claude/launch.json` runs one: `python3 -m http.server 8765`.

## Non-negotiable constraints

These come from real use, not preference. Don't quietly trade them away.

1. **Works with no signal.** Gyms are basements. Any feature that needs the
   network to complete a set log is wrong.
2. **Fast to log.** Two taps per set, one-handed, sweaty fingers. Big touch
   targets. Never shrink the steppers to fit more on screen. One deliberate
   exception, made on 6 Aug 2026: weight, reps and Log set now share a single
   row, so the −/+ buttons are 40px wide instead of 52. Their height is still
   52, so each is a 40×52 target. Below 370px wide even that does not fit and
   the Log button drops to its own row. If this feels bad in the gym, undo it —
   the row is one grid-template-columns line.
3. **Never lose an in-progress workout.** Persist on every change, not on
   "finish".
4. **No browser pop-ups.** `alert()`, `confirm()` and `prompt()` are banned —
   they are unreliable in iOS standalone home-screen apps. Use in-app inputs and
   two-tap confirmations instead. This has already caused one bug.
5. **No build step, as few files as possible.** The user is not a full-time
   developer and values being able to read the whole app. This was "single
   file" until Phase 2 — a service worker *cannot* be inlined in HTML, it has
   to be its own file at its own URL. That was a real technical forcing
   function, not a preference. Hold the same bar for any further file: it has
   to be impossible to do otherwise, not merely tidier.

## Current state

Everything below already exists. Three bottom tabs — **Workout**, **Routines**,
**History** — plus an exercise catalog nested inside Routines. Every screen is
a full page; the trend chart is the app's only modal.

**Workout tab**

- Pick a routine and start. Each routine card carries its own colour, the same
  one the Routines tab gives it.
- Log a set: weight, reps and a tick button share **one row** (see constraint
  2). −/+ steppers, 2.5 kg and 1 rep.
- First set of each exercise pre-fills from what you lifted last session; every
  set after that pre-fills from the set before it.
- "Last time: 50kg×5, …" under each exercise, from its previous session.
- Logged sets listed and numbered; tap × on one to delete it.
- **Rest timer** per exercise, in the title row: a pill of `− m:ss +`, default
  120s, ±30s independently per exercise. Starts itself when a set is logged,
  turns amber while running and stays amber at 0:00. State is carried by
  colour, not words. Visual only, no sound — the app never uses
  alert/confirm/prompt.
- **Plate calculator** under the weight, for exercises tagged Barbell only:
  "20 kg bar + 25 · 20 · 2.5 per side", updating as you type or tap ±. Assumes
  a 20 kg bar and 25/20/15/10/5/2.5/1.25 plates, both hard-coded — no settings
  screen. Says so when the number is under the bar or cannot be made exactly.
- **Workout clock** in the header, `hh:mm:ss`, ticking every second.
- **Trend icon** on any exercise with history opens a bottom-sheet modal: two
  hand-rolled SVG charts, total volume and Epley-estimated 1RM per workout,
  live-updating as you log.
- **"+ Add an exercise"** at the bottom opens the routines' own picker with
  `view.id === '@active'`. It lands in that session only, never in the routine.
  While that picker is open the nav reads Workout, not Routines.
- Discard or Finish, both two-tap. Finish drops any entry with no sets logged.
- The other two tabs stay usable mid-workout; a banner on them leads back.

**Routines tab**

- List of routines, each with a deterministic colour (stripe + name) shared
  with the Workout tab.
- **"+ New routine"** → its own screen for the name → Save lands you inside the
  new routine, where you add exercises.
- Inside a routine: add exercises from the catalog, remove one, set a target
  set count (default 4), start the workout.
- **Delete from the list** — × on the row, which becomes Cancel / Tap to
  confirm. Same on the routine's own screen.
- **"Manage exercises"** leads to the catalog.

**Exercises (catalog)**

- Master list, seeded with 20 on first run, grouped by body part, searchable.
- Every routine and workout references a catalog id, never a name, so renaming
  an exercise keeps its entire history.
- **"+ New exercise"** → its own screen: name, body part, equipment, Save.
  Untouched pick-lists fall back to Other. The picker keeps a faster inline
  "create and add" for mid-flow use.
- Rename, retag or delete an exercise from its own screen; delete straight from
  the list row too. Deletes are soft — the row hides, its id keeps owning all
  history.

**History tab**

- Past workouts, newest first, expandable to the individual sets. Total kg
  lifted per workout, and how long it took. Delete a workout.
- **Calendar icon** next to the title opens a month view in the same
  bottom-sheet modal the trend chart uses. A day you trained is a filled
  circle in that routine's colour, so a month reads as a pattern of which
  routine, not just whether. Monday-first, today is a ring, the month's
  workout count and total kg sit under the grid with a colour key. Tapping a
  day closes the sheet and opens that workout in the list behind it, scrolled
  to. Opens on the month of your newest workout, not always this one. Prev/next
  arrows; next stops at the current month. Read-only — no editing from here.
- **"Copy last 7 days"** copies the week as plain text, to paste into a chat
  and ask for feedback. Not CSV or JSON on purpose: `60x8` says in four
  characters what `{"w":60,"r":8}` spends fourteen on, it reads the same to
  you as to whatever you paste it into, and a week is ~500 bytes.
  Clipboard, not a file download — `<a download>` is unreliable in an iOS
  standalone home-screen app. Falls back to the old textarea/execCommand
  trick if `clipboard.writeText` is refused, and reports either outcome in
  the button itself (never a pop-up).

**Backup and offline**

- Supabase, optional and never blocking. Logged out, everything still works and
  a quiet banner offers login.
- Service worker caches the app shell, the font and the Supabase library. Cold
  opens with no signal. A new version announces itself with an in-app banner
  rather than reloading under you.

Data model, one JSON blob in `localStorage` under key `rack.v1`:

```
{
  exercises: [{ id, name, bodyPart, equipment, deleted, updatedAt, dirty }],
  routines:  [{ id, name, deleted, updatedAt, dirty,
                exercises: [{ id, exerciseId, name, sets }] }],
  workouts:  [{ id, routineId, routineName, startedAt, endedAt,
                deleted, updatedAt, dirty,
                entries: [{ exerciseId, name, target, sets: [{ w, r }] }] }],
  active:    null | { ...in-progress workout... },
  syncCursor: 0, seeded: false
}
```

`w` is kg, `r` is reps. `active` is the in-progress workout, saved on every
change and deliberately **never synced** — it is local to one device.

The `name` on routine slots and workout entries is a **display fallback only**;
always resolve through `exName(exerciseId, name)` so renames propagate. Seeded
exercises use deterministic ids (`seed:<slug>`) with `updatedAt: 1`, so every
device generates identical ids and merges instead of duplicating, and any real
edit always wins the merge.

UI: light. White background, cool blue-grey cards, amber accent (`#F5A900`).
Each tab owns a colour — Workout amber, Routines blue, History green — carried
through its nav pill, eyebrow labels and chevrons via a `--section` variable.
Archivo from Google Fonts, tabular numerals. Weight/reps use −/+ steppers
(2.5 kg and 1 rep) and pre-fill from the previous set. Each routine also owns a
deterministic colour from its id (`routineColor()`), used wherever that routine
appears. Deleting anything is a two-tap confirm in place, never a pop-up.

## Roadmap

Phase 1 — log a set, routines, history — **done**
Phase 2 — service worker + manifest: full offline, clean updates — **done**
Phase 3 — show last session's performance inline under each exercise — **done**
Phase 5 — cloud sync (Supabase) for backup and cross-device — **done**
Exercise catalog — master list with stable ids — **done** (unblocked Phase 6)
Phase 6 — trend charts (volume, estimated 1RM) per exercise — **done**,
built ahead of Phase 4 at the user's explicit request; flagged at the time.

Phase 4 — **in progress since 6 Aug 2026**: use it, then fix what actually
annoys. Nothing left on the roadmap to build ahead of.

What real use has already asked for and got, all on 6 Aug 2026 — the pattern
is small friction fixes, not features:

- Rest timer made a proper control and moved into the exercise title row;
  a decorative clock icon that did nothing was removed.
- Log button became a tick, inline with weight and reps.
- Workout clock in `hh:mm:ss` instead of "14 min".
- Creating an exercise or a routine moved from an inline box at the foot of a
  list onto its own screen.
- Delete a routine or an exercise straight from its list row.
- Routine colours carried onto the Workout tab.
- Tab bar sat closer to the bottom edge in standalone.
- Plate calculator under the weight on barbell exercises.
- Month calendar of workouts, opened from the History tab (25 Aug 2026).

Known gaps, ranked by how likely they are to bite:

1. ~~No way to change a workout once started~~ — **done**: "+ Add an exercise"
   at the bottom of a running workout opens the same picker the routines use,
   and adds to that session only. Still cannot *swap* or reorder, and cannot
   remove an added exercise — one with nothing logged against it is dropped
   when you finish, so a mistap costs a card on screen, not bad data.
2. **Backup can fail silently** — a failed sync shows only a small corner
   badge. No "last backed up" you can actually see.
3. **Cannot fix a set after finishing** — only deleting the whole workout.
4. Cannot rename a routine or reorder its exercises. (Deleting one, from the
   list or from its own screen, does work.)

Later, only if wanted: cardio. (Plate calculator — done 6 Aug 2026. Workout
length in History and a plain-text weekly export — done 24 Aug 2026; export
covers the last 7 days only, and there is no share-sheet/file path yet
because copy-and-paste was the whole point.)

### Phase 5 design, already decided

Keep a **full local replica** of all history on the phone — every read (charts,
"last time", PRs) hits local, so everything works offline. The cloud is durable
storage and backup, not the read path. Ten years of lifting is roughly 5 MB.

Sync: client-generated UUIDs as primary keys, an outbox of unsynced rows pushed
in one batch, server upserts (so a retry after a lost response is a no-op), and
a `last_synced_at` cursor for pulls. Last-write-wins on `updated_at`.

**Do not add a sync framework** (PowerSync, ElectricSQL, Replicache,
WatermelonDB). They solve multi-user concurrent editing, which cannot happen
here — one user, one device at a time, append-only rows. Hand-rolling this is
~150 lines and less work than learning any of them.

Known trap for later: `navigator.onLine` returns true on captive-portal wifi and
dead connections. Treat it as a hint to attempt a sync, never as proof of
connectivity. Background Sync API does not exist on iOS Safari — sync on app
foreground, on the `online` event, and after each write.

## Working style

- The user is a product manager, not a developer. Explain in plain terms, keep
  it short, skip the jargon.
- Be objective and push back when something is a bad idea. Honest cost-benefit
  beats optimism.
- Ship the smallest thing that works, then use it, then improve it. Don't build
  ahead of real need.
- Commit with messages that say what changed and why — this history is the
  point.
