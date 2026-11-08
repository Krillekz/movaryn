# Update log

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
