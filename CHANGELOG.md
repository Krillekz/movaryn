# Update log

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
