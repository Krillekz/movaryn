# Update log

## 2.2.5 — Check for updates from About

- **A manual update check.** Settings → About now has a **Check for updates** action. It reads the
  latest published GitHub release and compares its version with the running build.
- **Clear outcomes.** The tab shows whether this build is up to date, a newer release is available,
  this build is ahead of the latest public release, or the check could not be completed.
- **One action when an update exists.** An available release shows **Open release**, which opens the
  GitHub release page in the system browser; nothing downloads or installs automatically.
- **Offline and rate-limit handling.** A failed check explains that GitHub could not be reached or was
  rate-limited and offers **Open the latest release** as a manual fallback.

### Notes

- The check runs only when the button is pressed. No account or workspace data is sent; the only request
  is to GitHub's public latest-release endpoint.
- GitHub's unauthenticated API can rate-limit repeated checks. The dialog reports that rather than
  claiming the app is current.

## 2.2.4 — Open the latest release from the backup warning

- **The newer-backup warning now has an action.** A new **Open the latest release** link sits inside the
  warning and opens the project's latest GitHub release in the default browser.
- **No automatic download or install.** The link only opens the release page; the user still chooses
  whether to download, and restore remains available in the current build.
- **Consistent external links.** The warning uses the same external-link handling as the update log and
  roadmap, so the desktop app sends it to the system browser instead of opening it in-app.

### Notes

- The link follows GitHub's `releases/latest` redirect, so it always points at the newest published
  release rather than a hard-coded version.
- There is still no network request until the link is pressed or the existing username check runs.

## 2.2.3 — Warn when a backup is from a newer Movaryn

- **Version-aware restore preview.** The preview compares the Movaryn version that created the backup
  with the version currently running and shows a warning when the backup is newer.
- **The warning is honest but not a block.** Restore stays available, because the backup may still be
  usable, but the preview recommends updating first and says newer fields may otherwise be ignored.
- **No false alarms for older or unreadable versions.** Older backups restore without a warning, and a
  version that cannot be parsed is treated as unknown rather than newer.

### Notes

- The comparison is a numeric major.minor.patch check. Development builds report their real build
  version, so a local build can legitimately be older than the backup it is inspecting.
- Encrypted backups remain local files; this release adds no network request beyond the existing
  account-service username check.

## 2.2.2 — Check the restore username against every account

- **The restore preview now checks the whole installation.** After unlocking a backup, Movaryn asks
  the local account service whether the backup's username is already in use by any account, not just
  the one currently signed in.
- **Clear preview states.** The dialog shows **Checking**, **Available** or **Already taken**. A taken
  username disables **Restore and switch** before anything is created; an available name enables it.
- **Offline is explicit.** If the account service cannot answer, the preview says the username could
  not be checked and leaves server-side validation in place instead of pretending the name is free.
- **Minimal disclosure.** The new check returns only a boolean for the requested username; it does not
  expose the installation's account list.

### Notes

- The check is still subject to the local account-service rate limit, and an offline service cannot
  complete a restore anyway.
- The preview remains read-only: checking a username creates no account, workspace or session.

## 2.2.1 — Preview an account restore before switching

- **Restoring a backup is now two steps.** Enter the file and passphrase, then review a preview of the
  account and workspace before anything changes. The current account and workspace stay open until you
  press **Restore and switch**.
- **The preview shows what is inside.** Display name and username, backup date and Movaryn version, and
  counts for chats, projects, notebooks and saved versions. It also reports research facts and whether
  workspace settings are included.
- **Clearer recovery controls.** A same-username warning disables the restore button when the signed-in
  account already uses that name, and **Choose another file** returns to the file form and clears the
  selected file and passphrase.
- **Safe failure handling.** Duplicate usernames and invalid backup data still stop before the account
  is created, and failures after creation are surfaced as a toast because the dialog closes during the
  workspace switch.

### Notes

- The preview can compare the username against the currently signed-in account only. Conflicts with
  another local account are still rejected by the server before any switch.
- Backups remain local files encrypted with the backup passphrase. There is no cloud storage and no
  passphrase recovery.

## 2.2.0 — Account workspaces, encrypted backups, more looks

- **Each account gets its own workspace.** Conversations, projects, notebooks, versions, research and
  design settings now live in a separate local database per account. Guest work stays in the guest
  workspace, so signing in no longer mixes one person's chats with another's on the same installation.
- **Bring existing work with you.** When an account's workspace is empty, the account dialog offers to
  copy the guest workspace into it. The copy is deliberate and the guest workspace is left untouched.
- **Encrypted account backups.** Sign in, open Account → Backup & restore, and create one file holding
  the account credential and its workspace. The file is encrypted in the browser with AES-GCM using a
  passphrase strengthened with PBKDF2; the passphrase is separate from the account password and has no
  recovery path.
- **Restore on another installation.** Restore a backup from the signed-out account dialog. Movaryn
  recreates the local account, signs it in and opens the backed-up workspace. Existing accounts with
  the same username are reported instead of overwritten.
- **More curated looks.** Signature, Arcade, Quiet, Atlas, Ember and Mint combine theme, accent,
  atmosphere, corners and reading face in one click. A new **Compact sidebar** setting narrows the
  conversation rail without collapsing it.
- **Clearer data boundaries.** Settings → Data now says it deletes the current workspace only, and the
  export is labelled as this workspace's data. The account and privacy copy describes per-account
  workspaces, local-only storage and the encrypted backup path.

### Notes

- Workspaces are still local-first. Accounts do not sync between devices; encrypted backups are the
  supported way to move one deliberately.
- Deleting an account removes its local sign-in and its workspace database. The guest workspace and
  other accounts are untouched. Create an encrypted backup first if you want to keep a copy.
- The account backup contains a password hash, not the password itself, but the encrypted file is only
  as strong as the backup passphrase. Keep it somewhere safe.

## 2.1.0 — Local accounts, and a studio that looks like yours

- **Local accounts.** Create a username and password for this installation, sign in, edit your display
  name, change your password, sign out, or delete the account. Passwords are stored only as salted scrypt
  hashes and sessions as SHA-256 token hashes, in `accounts.json` inside Movaryn's user-data folder —
  outside the install directory, so the same credentials keep working after updates.
- **A 30-day session that survives restarts.** The app remembers your local session (the token is in
  local storage), and password changes rotate every existing session. Signing out or deleting the
  account does not delete conversations, projects or notebooks.
- **Account entry points.** A profile chip at the bottom of the sidebar, a Settings → Account tab, and
  command-palette actions. Register or sign in without an email address.
- **Design system in Settings → Appearance.** Six accent palettes (Violet, Emerald, Amber, Rose, Sky,
  Mono), three background atmospheres (Plain, Grid, Glow), Sharp/Soft/Round corners, a sans or serif
  reading face, and a Reduce motion switch. Quick looks apply a coordinated set in one click, and a
  live preview shows the result before you close Settings.
- **Design is consistent.** Accent, atmosphere, corners and reading font apply across chat, composer,
  notebook and dialogs; the choices are stored with the local workspace and survive relaunches.
- **Smaller changes.** The sidebar shows the signed-in identity, account and design tabs appear in the
  command palette, and the Data & privacy copy now explains what a local account does and does not do.

### Notes

- A local account is an identity layer in this release: it does **not** sync work between devices and
  does **not** partition one local workspace from another. Account-scoped workspaces arrived in 2.2.0.
- There is no email recovery. If the password is lost, the account can be deleted and recreated, but the
  old password cannot be recovered.
- Account files stay on this machine. No analytics, no telemetry and no cloud upload.

## 2.0.0 — Your layout, your reply style, and a notebook for your sources

- **New Settings → Layout & replies tab.** Choose **Focus** (narrow, compact), **Classic** (standard,
  comfortable) or **Studio** (wide, spacious), or set reading width and message spacing yourself. The
  change applies to chat, the composer and the notebook, and is remembered on this device.
- **Shape how Movaryn answers.** Pick concise, balanced or detailed replies, choose prose, mixed or
  bullet formatting, and optionally ask for the reason and cost behind each design choice. These travel
  as a separate response-style section on every chat request; the project brief and your explicit
  request still win.
- **Notebook** — a local workspace for sources, opened from the sidebar, the command palette or
  `Ctrl/⌘ + Shift + N`. Create separate notebooks, paste up to 12 sources (120,000 characters total),
  and keep an optional reference URL without ever fetching it. Ask questions and the answer is grounded
  in those sources, citing source titles and saying plainly when the sources do not cover something.
- **Studio notes.** Generate a briefing, FAQ, timeline or study guide from the current sources. Each
  output streams into the notebook and is saved as a note with the notebook, alongside its sources and
  the conversation.
- **Smaller additions.** Notebooks are included in the JSON export and the Data & privacy list, the
  command palette has entries for the notebook and Layout & replies, and the About tab documents the
  new shortcut.

### Notes

- Notebook sources are sent to your configured provider only when you ask a question or generate a
  studio note. URLs are stored as labels, not fetched.
- Citations are model output: check the named source before treating a detail as canon.
- There are still no accounts, no cloud sync and no telemetry. Notebooks are stored in IndexedDB with
  the rest of your local workspace.

## 1.9.0 — Sources under the reply, and comparisons that stick

- **Brief sources under the latest reply.** A collapsible card lists the project's saved facts, each
  with its source and whether it came from the brief or from research. It is labelled project-level and
  says plainly that a reply may not use every fact. Research facts stay marked unverified, and **Review
  brief** opens the Brief tab.
- **Compare up to five kits.** The Compare tab now takes this project plus up to four others under one
  preset, with per-kit totals, score axes, names shared by every kit and names unique to each one.
- **Saved comparisons.** **Save comparison** stores a readable Markdown summary with the project, so the
  result survives closing the dialog; it can be removed again from the same tab.

### Notes

- Every comparison is still an estimate from the written moves under one preset, not a balance verdict.
- Source cards show saved brief facts, not a claim about what the model actually used.
- Nothing here is uploaded, and there are still no accounts or cloud sync.

## 1.8.0 — A local research cache and a kit comparison

- **Local research cache.** A successful sourced lookup is kept on this device by character, series
  and game. Reopening that brief offers **Use cached lookup** first; pressing Research again refreshes
  it from the provider. Uncertain lookups are not cached, nothing is uploaded, and clearing local data
  removes the cache.
- **Compare tab** in Kit tools. Two saved projects are read under one sandbox preset: move count,
  estimated total frames, average start-up and recovery, the five score axes, and which move names are
  shared or unique. Every number is an estimate from the written moves, not a balance verdict.
- **Read-only share link** in the project export menu, so a kit can be shared without opening History.

### Notes

- There are still **no accounts and no cloud sync**. The cache and comparisons are local.
- Cached facts keep their named source and stay labelled unverified. The cache never invents a source.

## 1.7.0 — Character research, a kit sandbox, remapping and local history

- **Character brief** per project: series, which version, abilities to keep and avoid, and a stated
  **Follow canon / Original kit / Mixed** mode. The brief is sent with every chat in the project, so a
  restart or a new chat keeps the same understanding of the character.
- **Opt-in character research** in Kit tools → Brief. It asks the configured chat provider for facts
  that come with a named source, keeps only those, and lists each source beside the fact. If nothing
  sourced comes back, Movaryn says so and leaves the brief alone instead of guessing. Sources are
  model-provided and labelled unverified; open them before treating a detail as canon.
- **Quick kit** toggle in the composer: one coherent pass, first move first, no preamble and no
  restating the brief. The first move still streams before the rest of the answer is finished.
- **Kit sandbox** (Kit tools → Sandbox): estimates start-up, active and recovery windows from the
  written moves and a per-game preset (JJS, TSB or a general arena), draws the timeline, tests
  sidestep, block, counter and ranged poke, and reports what the kit does not cover. Every window is
  labelled estimated, never measured.
- **Matchup notes** saved with the project and sent with chats.
- **Cross-game remap** (Kit tools → Remap): rewrites range and cooldown language for the target game,
  lists every change, flags moves that do not fit the target's move count, and warns about mechanics
  with no equivalent. It creates a new project and never overwrites the original.
- **Local version history** (Kit tools → History): save a snapshot of the brief and moves, restore it
  later, and keep up to 25 per project. A snapshot of the current state is saved before a restore.
- **Read-only share links**: a kit can be encoded into a link fragment and opened in the browser with
  no account, no upload and no provider key. The kit travels in the link, not through a server.
- **Frame-data export** (CSV and Markdown) and a **printable project sheet** (HTML) with the brief,
  moves, sandbox estimates, scorecard and matchup notes.

### Notes

- There are still **no accounts and no cloud sync**. Version history and share links are local-first;
  a shared kit is a snapshot in the URL, not a live document.
- Research uses the chat provider you configured. It does not browse the web, and it cannot verify a
  source for you.
- Sandbox windows are design estimates. They are not the game's frame data.

## 1.6.0 — A command palette, release notes in the app and a roadmap

- **Command palette** on Ctrl/⌘ K, plus a search button in the chat header. It searches chats,
  projects and saved moves, and runs actions: new chat, new project, the idea library, concept art,
  any Settings tab, theme, sidebar, data export, What's New and the roadmap. Arrow keys move,
  Enter opens, Esc closes.
- **What's New inside the app** opens once per version and any time afterwards. It shows the newest
  three releases from the same `CHANGELOG.md` as the public update log, with links to the full log
  and the roadmap.
- **Public roadmap** with Now, Next, Later and Shipped columns, linked from the site navigation,
  footer, About tab and What's New dialog.
- **Copy a kit check report** as plain text, so a review can be pasted into a builder's notes.
- Settings remembers which tab you were on, and the palette can jump straight to Provider, Prompts,
  Data or About instead of always opening the first tab.

### Fixed

- The local API now **rejects requests from origins outside `ALLOWED_ORIGINS`** with a 403. Before,
  a third-party page could still make the server spend provider credits even though it could not read
  the response.
- A reply stream that closes **without the server's done event** is now reported as truncated instead
  of being treated as a finished answer.
- Local saves now resolve **after the IndexedDB transaction commits**, so closing or reloading right
  after a change cannot silently drop the last write.
- The About tab and data exports show the **real build version** when the API is offline; they used to
  fall back to `1.0.0`.
- The idea library **resets its search and tab** when reopened, and its footer counts no longer say
  "1 sparks".
- The startup screen no longer stays on "Opening your workspace…" forever if saved data cannot be
  read — it starts a clean session and says so.

## 1.5.0 — An idea library, a kit check and house rules

- **Idea library** with three tabs: 12 moveset sparks, 8 constraint packs and 10 art presets. Search
  it, roll a random spark, send a constraint straight into the composer, or apply an art preset to
  the concept-art brief. Open it from the welcome screen, the composer's lightbulb button or the art
  dialog.
- **Style presets** in the concept-art brief fill style, palette, lighting, camera angle and
  background in one click, from ink manga to neon cyber and stylised 3D.
- **Kit check** reviews a reply locally: duplicate names, overused words, how many moves describe a
  real sequence, whether start/contact/recovery is mentioned, role coverage and repeated opening
  words. No provider request, no invented score.
- **Review kit** drafts a structured critique for the current reply — three weak points, one fix
  each, and only the moves that need rewriting.
- **House rules** in the new Settings → Prompts tab: preferences such as naming style, build
  difficulty and required gameplan are sent with every chat, alongside the project brief rather
  than replacing it.
- **Stronger prompt core**: kit architecture guidance (one way in, one extension, one finish, a real
  weakness), a power budget, and a silent self-check before every answer.
- More starter cards: a rival duo, a buildable rewrite and a boss plus counter-kit.

## 1.4.6 — Prompts you edit are kept

- Prompt-only text is remembered per project, separately for concept art and the character card.
  Close the dialog, switch chats or restart the app and your edited prompt is still there.

## 1.4.5 — Copy the card's art prompt

- The character card has **Generate art** and **Prompt only** tabs. Prompt only builds the card's
  art prompt from the saved character brief, ready to edit and paste into any image generator.

## 1.4.4 — Find the art you saved

- Concept art in a project has a filter now, matching saved moves: search the prompts, narrow by
  aspect ratio with chips, and get a clear empty state when nothing matches.

## 1.4.3 — Read the prompt behind saved art

- Every concept art tile in a project now has a collapsed Prompt note that expands to the full text,
  so saved artwork can be understood and reproduced without copying it blind.

## 1.4.2 — Copy a prompt from saved art

- Concept art tiles in a project now have a copy action beside download, so saved artwork can be
  reproduced elsewhere. Tiles without a saved prompt show no button.

## 1.4.1 — Copy the prompt from an old image

- Image messages in a chat now copy the prompt rebuilt from the saved brief, aspect ratio included,
  instead of relying on the provider's echo (which can be empty).
- The expandable prompt panel has its own copy button, and the row button disables itself when there is
  nothing to copy.

## 1.4.0 — Credits, and prompts you can take elsewhere

- Settings has a Credits tab naming Raevik, who Movaryn is designed and built by.
- Concept art has two modes now. **Generate image** works as before. **Prompt only** takes the same
  brief and hands back a finished prompt, aspect ratio included, to paste into Midjourney, DALL·E,
  Stable Diffusion or any other generator. Nothing is sent anywhere in that tab, so it works even with
  no image provider configured.
- Random in Prompt only fills the form instead of spending a generation.

## 1.3.1 — The whole theme, not half of it

- The character/theme header above a moveset no longer cuts a long theme off with an ellipsis. It wraps
  to as many lines as it needs, so the full sentence stays readable.

## 1.3.0 — Random ideas and character cards

- A Random button in the concept art dialog rolls a complete character brief — subject, outfit,
  pose, setting, lighting, palette and style — and generates it in one press. Every field comes from
  a visible bank, so you can read, edit and reuse the prompt instead of guessing what a model invented.
- Character cards: under any generated moveset, “Character card” composes a 1600 × 1000 PNG with the
  character on the right and the name, game, theme and moves on the left. The text is drawn on your
  device, so move names are always spelled exactly as saved. Download the card, or save it into the
  project’s concept art.

## 1.2.0 — Movesets that come back in

- Import a moveset from the project workspace as JSON or CSV. JSON accepts Movaryn's own export, the
  older project-shaped export and a bare move array; CSV copes with quoted commas, embedded newlines
  and header variants, and also works without a header row.
- Imported moves merge by name, so re-importing updates rather than duplicates. Blank brief fields are
  filled from the file, and unusable rows are reported instead of silently dropped.

## 1.1.0 — Movesets that leave the app

- Export a project's moveset as a Markdown design sheet, a CSV table for spreadsheets or engine import,
  or a JSON backup that keeps the brief fields. Available from the project workspace.
- Filter saved moves by text or by purpose, and see at a glance how many moves still lack a purpose.
- Concept art downloads now use the real file type and a readable name instead of a timestamped `.png`,
  and saved project art can be downloaded from the workspace.

## 1.0.5 — Image generation stops failing on stale settings

- An image model left in settings from an OpenAI-style setup (such as `gpt-image-1`) no longer overrides
  the configured Cloudflare model, which made Workers AI answer `No route for that URI`.
- Cloudflare no longer borrows `AI_API_KEY` when its own token is missing, which turned a missing
  `IMAGE_API_KEY` into a confusing 401 from another service.
- A wrong `IMAGE_MODEL` now names the model and the expected Workers AI form instead of a bare route error.

## 1.0.4 — Crop follows the subject

- Cropping now follows the image content instead of taking a fixed centre slice: brightness-gradient
  profiles find where the subject sits, rows keep a small margin above the subject and trim surplus
  from the bottom, and the subject is centred horizontally.
- Wide and portrait concept art no longer loses the top of a head or hat, and an off-centre figure
  stays in frame. Flat frames still fall back to a centred crop.

## 1.0.3 — Aspect-accurate concept art

- Cloudflare images are center-cropped to the aspect ratio chosen in the brief, so a portrait or wide
  brief no longer shows a square inside a taller frame. JPEG output only; other formats pass through.
- Cropping uses a pure-JS codec, so the packaged app carries no native image dependency.
- If an image cannot be decoded, it is returned unchanged rather than failing the request.

## 1.0.2 — Free image generation

- Cloudflare Workers AI is now an image backend. Set `IMAGE_PROVIDER=cloudflare` with
  `IMAGE_ACCOUNT_ID` and an API token, or just set the account id and it is detected. The free plan's
  daily allowance makes concept art usable without paying an image provider.
- Existing OpenAI-compatible `/images/generations` hosts keep working unchanged.
- FLUX.1 schnell returns square images and cannot take a reference image, so the app reports that
  instead of pretending the reference was used.
- Failed quota and token errors now explain what to fix rather than surfacing a generic provider error.

## 1.0.1 — Provider honesty

- Image generation now requires `IMAGE_MODEL`. A chat-only provider (such as OpenRouter's free tier)
  reports concept art as unconfigured instead of offering a button that can only fail.
- The system prompt no longer lets a named Skill Builder node be marked `[Confirmed]`. Unverifiable
  features must be labelled `[Custom]` with a buildable alternative alongside them.
- Rename and tweak requests return only the changed move instead of re-emitting the whole kit.

## 1.0.0 — Initial release

**The workshop**

- Moveset-aware AI chat with streaming replies, a stop control and inline failure recovery.
- Project briefs (character, game, theme, description, constraints, saved moves) injected into every
  reply in that project.
- Exact-count and restriction handling, plus an automatic avoid-list of move names already used in the
  conversation or project.
- Automatic conversation memory: older turns are condensed in the background, with no app-imposed
  message cap.
- Rich moveset rendering with sections, move cards and per-move copy, plus a raw-text view for every
  reply. Copy the full moveset or a single move in one click.
- Edit-and-resend for user messages, regenerate for replies, and a searchable, collapsible chat history
  with rename and delete.

**Concept art**

- A structured image brief: subject, character details, outfit, pose, framing, camera, background,
  lighting, style, palette, aspect ratio and reference upload.
- A prompt builder that refuses to invent scenery or props, with an inspectable and editable final prompt.
- Generate, regenerate, revise, download, copy prompt, and save concept art to a project.
- Reference images are sent to providers that support image edits; when they cannot be used, the app says
  so instead of pretending.

**Workspace**

- Projects with saved moves, concept art, reference images and their own chats.
- Light and dark themes, keyboard shortcuts, accessible dialogs and focus states.
- Local-first storage in IndexedDB, JSON export, and full data deletion.
- Provider configuration entirely on the server: OpenAI-compatible chat and image endpoints, configurable
  models, quality, aspect ratios and reference support.
- Electron shell with context isolation, sandboxing and a minimal read-only preload bridge.
- GitHub Pages workflow for the static frontend with a separately hosted API.

**Desktop builds**

- Windows installer and a single-file portable exe, packaged with electron-builder and attached to
  GitHub Releases.
- A tag-driven workflow rebuilds both artifacts and attaches them to the release automatically.
- Builds are unsigned, so Windows SmartScreen shows an "unknown publisher" prompt on first launch.

**Known gaps**

- No accounts or cross-device sync.
- Reference conditioning depends on provider support for `/images/edits`.
- Installer packaging for desktop is documented but not automated.
