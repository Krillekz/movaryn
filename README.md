# Movaryn

**Better ideas. Better movesets. Built for creators.**

Movaryn is a focused creative workshop for people who invent custom character movesets for arena and
battleground games — Jujutsu Shenanigans (JJS), The Strongest Battlegrounds (TSB), and similar
Roblox-era combat games. It pairs a moveset-aware AI chat with a structured image workflow, so an
idea, a kit and its concept art can be developed in one place.

It is not a generic chatbot with a game skin:

- **Constraints are requirements.** Exact move counts, "no counters", "easy to build", one-word names and
  custom formats are carried into every reply for the project.
- **Moves are described as sequences** — start, contact, reaction, end — not as adjectives.
- **Mechanics are labelled honestly.** The AI must say when it cannot verify that a Skill Builder
  feature exists instead of inventing one.
- **Names do not repeat.** Every move name in the conversation and project is sent as an avoid-list.
- **An idea library starts the work.** Twelve moveset sparks, eight constraint packs and ten art
  presets, searchable, insertable into the composer or the art brief.
- **A local kit check.** Duplicate names, overused words, described sequences, roles and repeated
  openings are checked in the app, with no provider request.
- **A character brief and opt-in research.** Series, version, abilities to keep or avoid, and a stated
  canon/original/mixed mode travel with the project. Research keeps only facts with a named source and
  says so when it finds none; successful lookups are cached on this device for reuse, and the latest
  reply shows the brief's facts with their sources.
- **A local kit sandbox and comparison.** Estimated start-up, active and recovery windows, a
  counterplay read and a transparent scorecard, plus a comparison of up to five saved kits under one
  preset that can be saved with the project.
- **Cross-game remapping.** Rewrites range and cooldown language for another game, lists every change
  and flags what does not fit.
- **Local versions and share links.** Snapshots you can restore, and a read-only kit encoded in a link.
- **Local accounts with their own workspaces.** Create a username and password for this installation;
  the account lives in Movaryn's user-data folder, outside the install directory. Each account opens a
  separate local workspace, and guest chats can be copied in deliberately. Passwords are scrypt-hashed
  and sessions are stored as hashes. This is not cloud sync, and there is no email recovery.
- **Encrypted account backups.** Back up one account and its workspace into a single file encrypted in
  the browser with AES-GCM and a passphrase derived through PBKDF2. Restoring first previews the account
  name, checks that the username is unused by every local account, shows its chat, project, notebook
  and version counts, and warns when the backup was created by a newer Movaryn version, with a link to
  the latest release; only then does it create the account and switch to the workspace. The backup
  passphrase is separate from the account password and cannot be recovered.
- **A design system, not just a theme toggle.** Six accent palettes, plain/grid/glow atmospheres, three
  corner styles, a serif or sans reading face, six curated looks and a compact sidebar — with a live
  preview in Settings → Appearance.
- **Layout and reply controls.** Settings → Layout & replies sets a Focus, Classic or Studio layout,
  reading width and message spacing across chat, composer and notebook, plus concise/balanced/detailed
  replies, prose/mixed/bullet formatting and optional design-choice explanations.
- **A notebook for your sources.** Paste sources into local notebooks, ask grounded questions that cite
  them, and generate a briefing, FAQ, timeline or study guide as a saved note. Sources leave the device
  only when you ask. Open it from the sidebar, palette or `Ctrl/⌘ + Shift + N`.
- **House rules.** Preferences set in Settings → Prompts travel with every chat, next to the project
  brief.
- **A command palette.** Ctrl/⌘ K searches chats, projects and saved moves, and runs the app's
  actions, from a new chat to any Settings tab.
- **Notes and a roadmap.** What's New opens inside the app once per version, the public roadmap lists
  what is in progress, planned and already shipped, and Settings → About can check GitHub for a newer
  release on demand.
- **Images are separate outputs** with their own brief, prompt and revisions. Nothing is generated
  automatically after a moveset.

Everything is stored on your device. Provider keys live only on the local API server.

---

## Download

Windows builds are attached to the repository's Releases page:

- **Movaryn-Setup-x.y.z.exe** — installer, per-user, no administrator prompt.
- **Movaryn-Portable-x.y.z.exe** — one self-contained file, nothing installed.

The builds are not code-signed, so Windows SmartScreen shows "Unknown publisher" the first time
(More info → Run anyway). No provider key is bundled: create `%APPDATA%/Movaryn/provider.env` with the
same variables as `.env.example` (at minimum `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`), then launch the app.

---

## Quick start

Requires **Node.js 20.19+** (tested on Node 24).

```bash
# 1. Install
npm install

# 2. Configure a provider (see the next section)
cp .env.example .env      # Windows: copy .env.example .env

# 3. Run the web app + API together
npm run dev               # http://localhost:5173
```

The app opens with or without a provider. Without a key the AI features are clearly marked as requiring
configuration — nothing is faked.

### Minimum `.env`

```env
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=your-key
AI_MODEL=gpt-4.1-mini

IMAGE_API_KEY=your-key
IMAGE_MODEL=gpt-image-1
```

Or use Cloudflare's free daily image allowance instead of an OpenAI-shaped image host:

```env
IMAGE_PROVIDER=cloudflare
IMAGE_ACCOUNT_ID=your-cloudflare-account-id
IMAGE_API_KEY=your-api-token-with-workers-ai-access
```

Any OpenAI-compatible endpoint works: OpenAI, an Azure gateway, OpenRouter, Together, the Freebuff API,
or a local server (Ollama, LM Studio, vLLM). Streaming, image input and image generation are optional and
can be switched off per provider.

---

## Configuration

All values are read by the API server (`server/config.ts`) and never exposed to the browser.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | API port. Vite proxies `/api` here in development. |
| `MOVARYN_DATA_DIR` | Electron user-data folder, else `%APPDATA%/Movaryn` or `~/.movaryn` | Where local accounts (`accounts.json`) are stored, outside the install directory. |
| `HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` on a container host. |
| `AI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible base URL, without trailing slash. |
| `AI_API_KEY` | — | Chat key. Required for chat. |
| `AI_MODEL` | `gpt-4.1-mini` | Default chat model. |
| `AI_STREAM` | `true` | Set `false` if the provider cannot stream. |
| `AI_VISION` | `true` | Set `false` if the model rejects image inputs. |
| `AI_TIMEOUT_MS` | `180000` | Upstream chat timeout. |
| `AI_RESEARCH` | `true` | Allow the opt-in `/api/research` character lookup. |
| `IMAGE_BASE_URL` | falls back to `AI_BASE_URL` | Image API base URL. |
| `IMAGE_API_KEY` | falls back to `AI_API_KEY` | Image key. |
| `IMAGE_PROVIDER` | auto | `openai` (any `/images/generations` host) or `cloudflare` (Workers AI). Falls back to `cloudflare` when `IMAGE_ACCOUNT_ID` is set. |
| `IMAGE_ACCOUNT_ID` | — | Cloudflare account ID. Required for `cloudflare`; `CLOUDFLARE_ACCOUNT_ID` also works. |
| `IMAGE_MODEL` | — (`cloudflare`: `@cf/black-forest-labs/flux-1-schnell`) | Image model. On OpenAI-shaped hosts, images stay disabled until this is set, so a chat-only provider cannot offer a button that fails. |
| `IMAGE_QUALITY` | — | `low`, `medium`, `high`, `auto`; sent only when set. |
| `IMAGE_SIZE` | — | Force one size (e.g. `1024x1024`); otherwise aspect ratio decides. |
| `IMAGE_REFERENCE` | `true` | Allow uploaded references via `/images/edits`. |
| `IMAGE_TIMEOUT_MS` | `240000` | Upstream image timeout. |
| `ALLOWED_ORIGINS` | — | Comma-separated origins for cross-origin use. Empty = same-origin only. |
| `VITE_API_BASE_URL` | — | **Public** API URL for a separately hosted frontend. Never a key. |

`AI_BASE_URL` / `IMAGE_BASE_URL` are validated as HTTP(S). If a provider does not support a feature,
Movaryn reports the failure instead of pretending it worked.

### Provider notes

- **OpenAI** — `gpt-4.1-mini` for chat and `gpt-image-1` for images is a sensible low-cost start.
  `dall-e-3` also works; aspect-to-size mapping adapts to the model name.
- **Freebuff API** — set `AI_BASE_URL=https://freebuff.com/api/v1/paid` and use your own key. Image
  support depends on the account's model access.
- **OpenRouter / Together** — chat works; image endpoints vary. If the provider exposes only
  `/images/generations`, set `IMAGE_REFERENCE=false` and reference images will be described instead of
  conditioned.
- **Cloudflare Workers AI** — the free plan includes 10,000 neurons per day (roughly 50–200 FLUX.1
  schnell images, resetting at 00:00 UTC) with no card. Set `IMAGE_PROVIDER=cloudflare`,
  `IMAGE_ACCOUNT_ID`, and `IMAGE_API_KEY` to an API token with Workers AI access. FLUX.1 schnell
  always returns a square image, so Movaryn crops around the subject to the aspect ratio chosen in the brief,
  and it cannot condition on a reference, so reference conditioning is reported as disabled rather
  than pretended.
- **Ollama / LM Studio** — chat works with a local base URL. They generally do not provide an
  OpenAI-compatible image endpoint, so image generation will correctly report "not configured".

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (tsx watch) + Vite dev server on :5173 |
| `npm run dev:api` | API only, on :8787 |
| `npm run dev:web` | Vite only |
| `npm run typecheck` | Strict TypeScript for frontend and server |
| `npm run build` | Typecheck → Vite build → compile the API to `server-dist/` |
| `npm run build:app` | Vite build of the browser version into `site/app/` |
| `npm start` | Serve the built app + API from one Node process |
| `npm run electron:dev` | Vite + Electron (Electron starts the API itself on :8787) |
| `npm run electron:start` | Build, then launch the Electron shell |
| `npm run package:win` | Windows installer + portable exe in `release/` |
| `npm run package:dir` | Unpacked app in `release/win-unpacked/` for inspection |
| `npm run icon` | Regenerate `build/icon.png` from the favicon |
| `npm run mock:provider` | Local test provider for pipeline checks (never used by default) |

---

## How the product works

### Moveset behaviour

`shared/systemPrompt.ts` is the product's core. It encodes the rules the brief calls for:

- exact counts and explicit prohibitions are binding;
- descriptions follow start → action → contact → end → recovery;
- mechanics are tagged `[Confirmed]`, `[Likely]` or `[Custom]` only where buildability matters;
- the default "dash punch + ground slam + projectile + counter + explosion ultimate" kit is banned;
- names avoid a list of overused words and must not repeat project names;
- rejected ideas get a different mechanic, not a rename;
- the default response format is used for full kits and dropped for lists, single moves or custom formats.

A **project brief** is injected as a separate, clearly delimited system block:
character, game, theme, description, constraints, saved moves, and the avoid-list. Project data is treated
as user data, not as instructions that can change the assistant's role.

### Long conversations

The client sends the last N turns verbatim (`contextWindow`, default 24) plus a **condensed project
memory** for older turns. Memory is generated in the background after a reply completes, with the
previous summary included so constraints survive repeated compression. If summarization fails, recent
turns are still sent — the conversation never stops because of an app-imposed message limit.

Messages are rendered in a window of 120 with a "Show earlier messages" control, so very long chats do not
freeze the interface.

### Reading a moveset

`shared/moveset.ts` parses assistant replies into sections and moves. It only switches to the rich moveset
view when the text really is a moveset (a move section, or labelled descriptions, or at least two described
moves). Every move gets a copy button, the whole reply gets "Copy moveset", and every reply can be viewed
as raw text. The same parser powers "Save moves" and the name avoid-list.

### Kit tools

Each project has a **Kit tools** panel with four tabs:

- **Brief** — series, version, abilities to keep or avoid, a canon/original/mixed mode, and opt-in
  research that keeps only facts with a named source. Successful lookups are cached locally and can be
  reused before asking the provider again.
- **Sandbox** — estimated start-up, active and recovery windows from the saved moves and a per-game
  preset, a counterplay read, a scorecard and matchup notes.
- **Remap** — a transparent conversion of range and cooldown language to another game, with every
  change listed and a new project created rather than overwriting the original.
- **Compare** — this kit plus up to four others read under one preset: frame totals, score axes, and
  shared or unique move names. The readable summary can be saved with the project. Estimates only.
- **History** — local snapshots with restore, and a read-only share link encoded in the URL fragment.

Nothing in Kit tools is uploaded, and the sandbox never presents an estimate as measured frame data.

### Image workflow

1. The brief collects subject, character details, outfit, pose, framing, angle, background, lighting,
   style, palette, aspect and an optional reference image.
2. `shared/imagePrompt.ts` converts that into a detailed prompt **without inventing scenery, effects or
   extra props**. Empty background means a plain backdrop, not a battlefield.
3. "Show prompt" exposes the exact text, editable before generating.
4. The server sends it to `/images/generations`, or `/images/edits` when a reference image is present and
   the provider supports it.
5. If edits fail, the server retries from the written brief and tells the user the reference could not be
   applied. No silent downgrade.
6. Generated images support regenerate, revise (same brief, changed pose/background/angle/style), copy
   prompt, download and save to project.

Nothing is generated automatically after a moveset.

### Projects

A project holds the character brief, constraints, saved moves, reference images, concept art and its
chats. Every chat assigned to the project sends that brief. This is deliberately lighter than a document
system: a project is a brief plus its outputs.

---

## Architecture

```
.
├─ index.html
├─ src/                        React + TypeScript frontend
│  ├─ App.tsx                  shell, hydration, theme, health polling, shortcuts
│  ├─ components/
│  │  ├─ Sidebar.tsx           search, projects, chat history, rename/delete
│  │  ├─ ChatView.tsx          header, banner, message window, export, lightbox
│  │  ├─ MessageItem.tsx       user/assistant messages, edit, errors, images
│  │  ├─ MovesetView.tsx       sections, move cards, per-move copy, raw toggle
│  │  ├─ Composer.tsx          auto-grow input, attachments, paste, drag & drop, stop
│  │  ├─ ImageBriefDialog.tsx  structured image brief + prompt preview
│  │  ├─ SettingsDialog.tsx    provider status, models, theme, data, about
│  │  ├─ ProjectDrawer.tsx     project brief, moves, art, references, chats
│  │  └─ Welcome.tsx           starter cards
│  ├─ store/useApp.ts          conversations, projects, settings, UI state (Zustand)
│  └─ lib/                     API client (SSE), chat engine, IndexedDB, image reading
├─ server/                     Express API — the only place keys are used
│  ├─ index.ts                 routes, SSE, rate limit, CORS, static serving
│  ├─ config.ts                env parsing and validation
│  ├─ validate.ts              request validation and normalisation
│  ├─ errors.ts                typed errors + safe upstream mapping
│  └─ providers/openai.ts      streaming chat, image generation, image edits
├─ shared/                     types, system prompt, image prompt builder, moveset parser
├─ electron/                   hardened main process + minimal preload
└─ scripts/mock-provider.mjs   local test fixture
```

The frontend never holds provider credentials. It calls only `/api/health`, `/api/chat`, `/api/image`,
`/api/research` and `/api/summarize`.

---

## Security model

- **No keys in the client.** Nothing is read from `VITE_*` except the public API URL. Inspect `dist/` and
  you will find no provider key path — the frontend has no key handling at all.
- **Server-only config.** `.env` is git-ignored; `.env.example` contains placeholders only.
- **Input validation.** Message count, content length, image data URLs, project fields, model names and
  prompt length are validated before anything reaches a provider.
- **Error hygiene.** Upstream error bodies are truncated and redacted, and never include the key.
- **Rate limiting.** 45 requests/minute per client by default (`RATE_LIMIT_PER_MINUTE`).
- **CORS is closed by default.** Cross-origin calls require `ALLOWED_ORIGINS`.
- **Security headers.** `nosniff`, no-referrer, frame denial, permissions policy, and a restrictive CSP on
  the statically served build.
- **Electron.** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, navigation blocked,
  new windows denied, permission requests refused. Keys are passed to the forked API process through its
  environment, never through the renderer. The preload exposes only a frozen `{ isDesktop, platform,
  version }`.
- **Uploaded references** are only sent to the provider you configured, never to a third service.

---

## Deployment

### One Node host (recommended)

```bash
npm ci
npm run build
HOST=0.0.0.0 PORT=8787 npm start
```

The API serves `dist/` and `/api` from one origin. Set `AI_*` / `IMAGE_*` as host environment variables.
This is the simplest way to keep keys server-side and avoid CORS.

### Landing site and update log (GitHub Pages)

`site/` is the public Movaryn page: features, downloads and an update log whose entries are generated
from `CHANGELOG.md` by `scripts/build-site.mjs` (`npm run build:site`). It is plain HTML, CSS and JS with
no build dependencies, so it can be opened locally or published as-is.

1. Enable Pages → Source: GitHub Actions.
2. `.github/workflows/deploy-pages.yml` rebuilds `site/changelog.html` and the browser app, then publishes
   `site/` on pushes that touch the site, the app, the changelog or the generator.

The browser build is served at `https://<owner>.github.io/movaryn/app/`.

### Browser build

The browser build is the same React app without Electron. It has no server of its own: on first load it
asks for the URL of a Movaryn API (saved in `localStorage`, or passed once as `?api=https://…`) and sends
every `/api` request to that server. Provider keys stay on the server, never in the page.

1. Run the API on any Node host: `npm ci && npm run build && HOST=0.0.0.0 PORT=8787 npm start`.
2. Set `ALLOWED_ORIGINS` to the page's origin, e.g. `https://<owner>.github.io`.
3. Open the app, paste the API URL and press Connect.

Nothing about this changes the security model: the build contains no keys and no key-handling code.
Without an API URL the app shows a setup bar instead of pretending chat works.

To host the web app from your own domain instead, deploy the API to any Node host (Render, Railway, Fly.io, a VPS) with
`HOST=0.0.0.0` and `ALLOWED_ORIGINS` set, build with `VITE_API_BASE_URL=https://your-api.example.com`, and
serve `dist/` from that host or another static host. `base: './'` keeps the build portable to a
repository subpath.

### Electron desktop

```bash
npm run electron:dev     # development, Vite + Electron
npm run electron:start   # production build, then the desktop shell
```

- Development: Electron starts the API on `:8787` and loads the Vite server.
- Production: Electron forks `server-dist/server/index.js` on a free loopback port and loads the built
  frontend from the local API.
- Credentials are read from the first existing file of:
  `%APPDATA%/Movaryn/provider.env`, `<app>/.env`, or `./.env`.
  In a packaged app, put `provider.env` in the user-data folder so keys stay out of the bundle.

### Windows installer

```bash
npm run package:win     # release/Movaryn-Setup-<version>.exe + release/Movaryn-Portable-<version>.exe
npm run package:dir     # release/win-unpacked/ for a quick launch test
```

`electron-builder` bundles `dist/`, `server-dist/`, `electron/` and the production dependencies (Express,
dotenv). `asar` is intentionally disabled: the API runs in a forked Node process, which does not inherit
Electron's asar filesystem patches, so the server files must stay real files on disk.

In a packaged app the API is forked on a free loopback port and `provider.env` is read from the user-data
folder, so keys never enter the bundle. Builds are unsigned — sign them with your own certificate before
distributing widely. `release/` and `build/icon.png` are handled for you (the icon is generated from
`public/favicon.svg`).

---

## Testing

### Automated checks that ship with the project

```bash
npm run typecheck   # strict frontend + server types
npm run build       # typecheck, Vite production build, server compile
```

### Local pipeline test without a provider

```bash
node scripts/mock-provider.mjs
# in a second terminal (bash):
AI_BASE_URL=http://127.0.0.1:4010/v1 AI_API_KEY=mock AI_MODEL=mock-model \
IMAGE_API_KEY=mock IMAGE_MODEL=mock-image npm run dev:api
# in a third terminal:
npm run dev:web
```

The mock streams a four-move JJS kit, returns a generated placeholder image, and deliberately does **not**
implement `/images/edits` — so you can confirm the honest reference fallback. It is a development
fixture, is never enabled by the app, and is not a substitute for real provider testing.

### Acceptance checks (from the brief)
| # | Check | How |
| --- | --- | --- |
| 1 | Exact move count | "Make a JJS character with exactly four base moves. No ultimate, no special." → four moves, no extra sections |
| 2 | Simple build | "Make the moves easy to build. No custom meshes or particles." → no mesh/particle dependencies |
| 3 | Naming format | Four one-word names in the requested braces format |
| 4 | Rejected idea | "I don't like that move" → a different mechanic, not a rename |
| 5 | Context retention | Describe a red-cloaked scythe boss, then "rename move three" → correct move, no re-asking |
| 6 | Image reference | Upload a reference, request full body → reference used when supported, notice when not |
| 7 | Honest mechanics | Ask for an unverifiable feature → stated uncertainty plus a buildable alternative |
| 8 | Long chat | Continue past the context window → memory keeps constraints, no app cap |
| 9 | Security | Search `dist/` for key patterns; check `.env` is untracked |
| 10 | Electron and web | `npm run dev`, then `npm run electron:start` |

All ten can be exercised manually against a real provider; checks 1–8 were run against the mock pipeline
to verify the app plumbing (streaming, parsing, persistence, cancellation, error surfaces) rather than
model quality.

---

## Limitations (stated plainly)

- **Accounts are local, not cloud.** Usernames and password hashes live in the Electron user-data
  folder or the API's data directory, so they survive updates. Each account has its own browser
  workspace database, but nothing syncs or signs you in on another device. Encrypted account backups
  are the deliberate transfer path; the JSON export is a read-only escape hatch for one workspace.
  There is no password or backup-passphrase recovery.
- **The Windows builds are unsigned.** SmartScreen will warn on first launch until you sign them.
- **Model quality is the provider's.** The system prompt is strong, but a weak model can still produce
  generic or unbuildable moves. Switching models is a setting, not a rebuild.
- **Reference conditioning depends on the provider.** OpenAI-style `/images/edits` is supported; providers
  without it fall back with a visible notice.
- **Mechanics knowledge is not live.** Game updates change move editors. Movaryn labels uncertainty rather
  than claiming a feature exists.
- **Research is model-based.** The lookup asks your chat provider for sourced facts; it does not browse
  the web, and a source it names may be wrong. Facts stay labelled unverified until you check them.
- **Share links are snapshots.** A shared kit is encoded in the URL fragment; it is not a live document
  and it is not synced.
- **The research cache is local.** It is keyed by character, series and game and lives in this device's
  storage; clearing site data or the app's data removes it. Only lookups that returned a sourced fact
  are cached.
- **Image prompts cannot guarantee perfect anatomy.** Revisions, prompt editing and reference images are
  the practical controls; no provider is perfect.

---

## Privacy

- Stored locally: conversations, projects, saved moves, notebooks, settings, uploaded references and
  generated images (one IndexedDB database per account plus the guest database, and `localStorage` for
  the sidebar preference and account session).
- Stored in the app data folder: local account records (salted scrypt password hashes) and hashed
  session tokens in `accounts.json`; provider credentials stay in the server's env file.
- Account backups are encrypted in the browser before download. The passphrase and decrypted contents
  are not stored by Movaryn.
- Sent to your provider: the messages you send, the project brief, recent reference images, image
  prompts, and notebook sources when you ask the notebook. Nothing else.
- Delete a chat or project to remove its records and images; Settings → Data deletes the current
  workspace only. Deleting an account removes its local sign-in and that account's workspace, leaving
  the guest workspace and other accounts untouched.
- No analytics, no telemetry and no cloud sync.

---

## Attribution

Movaryn is an independent tool and is not affiliated with Roblox, Jujutsu Shenanigans, The Strongest
Battlegrounds, or any game or studio it mentions.
