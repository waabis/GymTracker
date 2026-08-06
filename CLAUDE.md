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

Three bottom tabs — **Workout**, **Routines**, **History** — plus an exercise
catalog nested inside Routines.

- **Exercises** — master list, seeded with 20 on first run. Every routine and
  workout references a catalog id, never a name, so renaming an exercise keeps
  its entire history. Body part and equipment are fixed pick-lists.
- **Routines** — named list of exercises picked from the catalog, each with a
  target set count (default 4).
- **Workout** — log weight + reps per set, running timer, "last time" shown
  under each exercise, delete a set, discard or finish. The first set of each
  exercise pre-fills from what you lifted last session, not a fixed 20 kg.
  The other two tabs stay usable during a workout; a banner on them leads
  back. A trend icon on any exercise with history opens a bottom-sheet modal
  (the app's only modal — everything else is a full page) with two hand-rolled
  SVG charts: total volume and Epley-estimated 1RM per workout, live-updating
  as you log. A rest timer per exercise (default 120s, ±30s independently per
  exercise) starts automatically when a set is logged and shows "Rest done"
  once it elapses — visual only, no sound, since the app never uses
  alert/confirm/prompt.
- **History** — past workouts, expandable detail, total kg lifted, delete.
- **Backup** — Supabase, optional and never blocking. Logged out, everything
  still works and a quiet banner offers login.
- **Offline** — service worker caches the app shell, the font and the Supabase
  library. Cold opens with no signal.

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
(2.5 kg and 1 rep) and pre-fill from the previous set.

## Roadmap

Phase 1 — log a set, routines, history — **done**
Phase 2 — service worker + manifest: full offline, clean updates — **done**
Phase 3 — show last session's performance inline under each exercise — **done**
Phase 5 — cloud sync (Supabase) for backup and cross-device — **done**
Exercise catalog — master list with stable ids — **done** (unblocked Phase 6)
Phase 6 — trend charts (volume, estimated 1RM) per exercise — **done**,
built ahead of Phase 4 at the user's explicit request; flagged at the time.

Phase 4 — **next, for real this time**: use it for two weeks, change nothing,
then fix what actually annoys. Nothing left on the roadmap to build ahead of.

Known gaps, ranked by how likely they are to bite, for when Phase 4 says so:

1. **No way to change a workout once started** — if a machine is taken you
   cannot add or swap an exercise mid-session, so you log it under the wrong
   exercise, which is exactly what the catalog exists to prevent.
2. **Backup can fail silently** — a failed sync shows only a small corner
   badge. No "last backed up" you can actually see.
3. **Cannot fix a set after finishing** — only deleting the whole workout.
4. Cannot rename a routine or reorder its exercises.

Later, only if wanted: plate calculator, export, cardio.

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
