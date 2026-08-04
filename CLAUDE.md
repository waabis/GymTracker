# Rack — gym workout tracker

## What this is

A personal workout tracker for one user (Waabis). Web app, added to the iPhone
home screen. Currently a single self-contained `index.html` with no build step,
no dependencies, and no backend.

Live at: https://waabis.github.io/GymTracker/ (GitHub Pages, `main` branch, root)

## Non-negotiable constraints

These come from real use, not preference. Don't quietly trade them away.

1. **Works with no signal.** Gyms are basements. Any feature that needs the
   network to complete a set log is wrong.
2. **Fast to log.** Two taps per set, one-handed, sweaty fingers. Big touch
   targets. Never shrink the steppers to fit more on screen.
3. **Never lose an in-progress workout.** Persist on every change, not on
   "finish".
4. **No browser pop-ups.** `alert()`, `confirm()` and `prompt()` are banned —
   they are unreliable in iOS standalone home-screen apps. Use in-app inputs and
   two-tap confirmations instead. This has already caused one bug.
5. **Single file, no build step**, until there's a concrete reason to change.
   The user is not a full-time developer and values being able to read the
   whole app.

## Current state (end of Phase 1)

Implemented in `index.html`:

- **Routines** — create a named routine, add/remove exercises
- **Train** — pick a routine, log weight + reps per set, running timer,
  delete a set, discard or finish the workout
- **History** — past workouts, expandable detail, total kg lifted, delete

Data model, stored as one JSON blob in `localStorage` under key `rack.v1`:

```
{
  routines: [{ id, name, exercises: [{ id, name }] }],
  workouts: [{ id, routineId, routineName, startedAt, endedAt,
               entries: [{ name, sets: [{ w, r }] }] }],
  active:   null | { id, routineId, routineName, startedAt, entries: [...] }
}
```

`w` is weight in kg, `r` is reps. `active` is the in-progress workout, saved on
every change so nothing is lost if the app is closed mid-session.

UI: dark, industrial. Safety-yellow accent (`#F0B429`) on near-black
(`#17191A`), Archivo from Google Fonts, tabular numerals. Bottom tab bar for
thumb reach. Weight/reps use −/+ steppers (2.5kg and 1 rep) and pre-fill from
the previous set.

## Roadmap

Phase 1 — log a set, routines, history — **done**
Phase 2 — service worker + manifest: full offline, clean updates on push
Phase 3 — show last session's performance inline under each exercise
Phase 4 — use it for two weeks, change nothing, then fix what actually annoys
Phase 5 — cloud sync (Supabase leading) for backup and cross-device
Phase 6 — charts: weight over time per exercise, personal bests

Later, only if wanted: rest timer, plate calculator, export, cardio.

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
