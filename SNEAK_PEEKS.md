# Sneak peeks

Early looks at what is being built next. These are previews, not release notes — scope, wording and timing can change. Phases are themes, not dates. Phases 2–5 shipped a first pass in 1.7.0; these entries now describe the direction and what is still to come.

## Movaryn: Phase 2

First pass shipped in 1.7.0 · still evolving

Phase 2 goes after the two things that slow a kit down most: the model not knowing who you are talking
about, and the wait before a usable answer.

### The big change: it finds out who the character is

Mentioning an obscure anime or manga character should not make a model pattern-match a name and invent
abilities. Phase 2 puts an explicit research step before the first draft:

- An optional lookup checks the character's series, powers, weapons and silhouette, and shows the
  source the model named for each fact. Sources are labelled unverified until you check them.
- If the character cannot be verified, Movaryn says so and asks for the series or a short description
  instead of guessing.
- **Follow canon** and **Original kit** are separate paths: one respects known abilities, the other
  uses the design as a starting point and labels what was invented.
- Research is opt-in and server-side: no silent web requests, no key in the browser, and the app still
  works with no lookup configured.

### Also in this phase

- Shorter setup before the kit, with no restating the brief back at you.
- The first move streams before the rest of the answer is finished, so something usable is on screen
  sooner.
- A **Quick kit** path drafts one coherent pass, then offers depth on request instead of opening with
  an essay.
- Clear progress states while a lookup runs, so waiting has a reason and an end.
- A character brief saved with the project, so later chats keep the same understanding.

### What it will not do

- Invent canon for a character it cannot verify.
- Scrape or upload anything silently.
- Promise a date before the work is real.

## Movaryn: Phase 3

First pass shipped in 1.7.0 · still evolving

Phase 3 changes what a kit is for: instead of only describing a fight, the kit can be tried before it
is built.

### The big change: a sandbox that runs the kit

A local simulation plays the saved moves against simple archetypes and reports what the text actually
implies:

- Startup, active and recovery windows are estimated from the move sequence and drawn as a timeline.
- Common answers are tested — sidestep, block, counter, ranged poke — and summarised in a short
  counterplay report.
- A kit can be tuned in the sandbox before it is exported, using the same limits the selected game
  enforces.

### Also in this phase

- Frame-data table export alongside Markdown, CSV and JSON.
- Matchup notes attached to a kit and carried into later drafts.
- A read-only kit link that renders the moves and the counterplay report.
- Sandbox presets per game, so JJS and TSB timings do not share one assumption.

### What it will not do

- Claim to be the real game's netcode or physics.
- Present estimated windows as measured frame data.
- Upload a kit anywhere without an explicit action.

## Movaryn: Phase 4

First pass shipped in 1.7.0 · still evolving

Phase 4 treats a good kit as portable: the idea should survive a change of game.

### The big change: one kit, remapped to another game

- A saved kit can be translated into another supported format, with each move rewritten to that
  game's rules rather than copied across.
- The remap shows what changed and why: range, cooldown, resource cost and move count.
- Moves that cannot exist in the target game are flagged with a buildable alternative instead of being
  dropped quietly.

### Also in this phase

- Rule packs that describe a game's limits once and apply them to every project.
- Balance scorecards comparing damage, range and commitment across a kit.
- Import from CSV and clipboard, so old sheets do not have to be retyped.
- A printable project sheet with the brief, moves, art prompts and kit check.

### What it will not do

- Pretend a remap is a drop-in replacement for the original kit.
- Invent mechanics for a game it has no rules for.
- Replace the user's own balance judgement.

## Movaryn: Phase 5

First pass shipped in 1.7.0 · still evolving

Phase 5 changes where the workshop lives. The 1.7.0 first pass adds local version history and
read-only share links; cloud accounts and cross-device sync are still ahead.

### The big change: an optional synced workspace

- Projects can follow you between machines with an account, while local-only projects keep working
  untouched.
- Share links open a read-only kit in the browser, with no install and no provider key.
- Collaborators can comment on moves instead of copying the whole project.

### Also in this phase

- Version history per project, with restore.
- A browser-first layout that works on a phone for reading and commenting.
- Team projects with shared house rules.
- Account-free export stays, so a project can leave at any time.

### What it will not do

- Move existing local projects to a server without asking.
- Require an account to use the app.
- Put provider keys anywhere but your own machine.

## Movaryn: Character briefs

First pass shipped in 1.7.0 · still evolving

A closer look at the brief that Phase 2 introduces. Today each chat starts from whatever the model
thinks it remembers, so a name can mean one thing in the first reply and something else after a
restart. A character brief makes that understanding explicit, project-scoped and editable.

### One brief per character

- A short brief records the series, which version of the character is meant, the abilities worth
  keeping and the ones to avoid.
- **Follow canon**, **Original kit** and **Mixed** are stated modes, not an unspoken assumption. The
  mode appears on the kit, so a reader can tell what was respected and what was invented.
- The brief is captured before drafting, and every later reply in the project reuses it — including
  after a restart or a new chat.
- Every line the model wrote can be edited or replaced. The brief belongs to the project, and the app
  never quietly overwrites it.

### Where the facts come from

- Facts are labelled: carried in the brief, taken from a lookup with a source, or invented for an
  original kit.
- Switching from **Follow canon** to **Original kit** keeps the brief and starts a fresh draft
  instead of rewriting the earlier one.
- If the brief and a lookup disagree, Movaryn shows the conflict and asks which one wins rather than
  picking silently.
- No brief is required to start. Without one, the app asks the questions it would otherwise guess at.

### What this will not do

- Treat a lookup as canon when it cannot cite a source.
- Lock a project to one interpretation forever.
- Hide the canon-or-original choice inside a prompt you cannot see.
