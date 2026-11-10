# Sneak peeks

Early looks at what is being built next. These are previews, not release notes — scope, wording and timing can change.

## Movaryn: Phase 2

In design · No release date

Phase 2 targets the two things that slow a kit down most: the model not knowing who you are talking
about, and the wait before a useful answer appears.

### Research before invention

Mentioning an obscure anime or manga character should not make a model pattern-match a name and
invent abilities. Phase 2 adds an explicit research step before the first draft:

- An optional lookup checks the character's series, powers, weapons and silhouette, and shows where
  each fact came from.
- If the character cannot be verified, Movaryn says so and asks for the series or a short description
  instead of guessing.
- **Follow canon** and **Original kit** are separate paths: one respects known abilities, the other
  uses the design as a starting point and labels what was invented.
- A character brief is saved with the project, so a later chat does not re-litigate who the character
  is.
- Research is opt-in and server-side: no silent web requests, no key in the browser, and the app still
  works with no lookup configured.

### A faster path to the first move

- Shorter setup before the kit, with no restating the brief back at you.
- The first move streams before the rest of the answer is finished, so something usable is on screen
  sooner.
- A **Quick kit** path drafts one coherent pass first, then offers depth on request instead of
  opening with an essay.
- Clear progress states while a lookup runs, so waiting has a reason and an end.

### What Phase 2 will not do

- Invent canon for a character it cannot verify.
- Scrape or upload anything silently.
- Promise a date before the work is real.

The roadmap is updated as this moves.

## Movaryn: Character briefs

In design · No release date

Today each chat starts from whatever the model thinks it remembers, so a name can mean one thing in
the first reply and something else after a restart. A character brief makes that understanding
explicit, project-scoped and editable.

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

The roadmap tracks this work alongside Phase 2.
