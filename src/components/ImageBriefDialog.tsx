import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ClipboardCopy,
  Dices,
  Eye,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import type { AspectRatio, Framing, ImagePromptSpec, Project, Settings } from '../../shared/types';
import { ASPECT_RATIOS, FRAMING_OPTIONS } from '../../shared/types';
import { buildImagePrompt } from '../../shared/imagePrompt';
import { useApp } from '../store/useApp';
import { generateConceptImage } from '../lib/chatEngine';
import { readImageFile } from '../lib/image';
import { randomImageSpec } from '../lib/imageRandom';
import { Modal } from './ui/Modal';
import { copyText, cx } from '../lib/utils';

function defaultSpec(project: Project | null, settings: Settings): ImagePromptSpec {
  return {
    subject: project?.name ? `${project.name}${project.theme ? ` — ${project.theme}` : ''}` : '',
    details: project?.description ?? '',
    outfit: '',
    pose: '',
    framing: 'full-body',
    angle: '',
    setting: '',
    lighting: '',
    style: settings.lastImageStyle || '',
    palette: '',
    avoid: '',
    aspect: settings.aspect,
    reference: project?.references?.[0],
  };
}

export function ImageBriefDialog() {
  const brief = useApp((state) => state.ui.imageBrief);
  const settings = useApp((state) => state.settings);
  const provider = useApp((state) => state.provider);
  const close = useApp((state) => state.closeImageBrief);
  const updateSettings = useApp((state) => state.updateSettings);
  const updateProject = useApp((state) => state.updateProject);
  const openSettings = useApp((state) => state.openSettings);
  const pushToast = useApp((state) => state.pushToast);

  const project = useApp((state) => {
    const conversationId = brief.conversationId ?? state.activeId;
    const conversation = conversationId ? state.conversations[conversationId] : null;
    return conversation?.projectId ? state.projects[conversation.projectId] : null;
  });

  const [spec, setSpec] = useState<ImagePromptSpec>(() => defaultSpec(null, settings));
  const [showPrompt, setShowPrompt] = useState(false);
  const [override, setOverride] = useState('');
  const [overrideDirty, setOverrideDirty] = useState(false);
  const [externalDraft, setExternalDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [tab, setTab] = useState<'generate' | 'prompt'>('generate');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!brief.open) return;
    setSpec(brief.spec ?? defaultSpec(project, settings));
    setShowPrompt(false);
    setOverride('');
    setOverrideDirty(false);
    setExternalDraft(project?.prompts?.art ?? null);
    setError(null);
    setBusy(false);
    setTab('generate');
    setCopied(false);
    // Re-initialise only when the dialog opens or targets a different brief.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.open, brief.spec, brief.messageId]);

  const generated = useMemo(() => buildImagePrompt(spec), [spec]);
  const promptValue = overrideDirty ? override : generated;
  const imageReady = Boolean(provider?.image.configured);
  const promptTab = tab === 'prompt';
  const externalPrompt = useMemo(
    () => (overrideDirty ? override : `${generated} Aspect ratio: ${spec.aspect}.`).trim(),
    [overrideDirty, override, generated, spec.aspect],
  );
  const copyValue = promptTab ? (externalDraft ?? externalPrompt) : promptValue;

  const rememberPrompt = (text: string) => {
    if (!project) return;
    updateProject(project.id, {
      prompts: { ...project.prompts, art: text.trim() ? text : undefined },
    });
  };

  const update = <K extends keyof ImagePromptSpec>(key: K, value: ImagePromptSpec[K]) => {
    setSpec((current) => ({ ...current, [key]: value }));
  };

  const addReference = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const attachment = await readImageFile(file);
      update('reference', attachment);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'That image could not be read.');
    } finally {
      setReading(false);
    }
  };

  const submit = async (candidate?: ImagePromptSpec) => {
    if (busy) return;
    const active = candidate ?? spec;
    if (!active.subject.trim()) {
      setError('Describe what should be pictured — even one line is enough.');
      return;
    }
    const prompt = (
      !candidate && overrideDirty && override.trim() ? override : buildImagePrompt(active)
    ).trim();
    if (!prompt) {
      setError('The image prompt is empty. Add a subject or write a prompt.');
      return;
    }
    setBusy(true);
    setError(null);
    const finalSpec: ImagePromptSpec = { ...active, promptOverride: prompt };
    const ok = await generateConceptImage(
      finalSpec,
      brief.messageId
        ? { conversationId: brief.conversationId, messageId: brief.messageId }
        : { conversationId: brief.conversationId },
    );
    setBusy(false);
    if (ok) {
      updateSettings({
        lastImageStyle: active.style?.trim() ?? '',
        aspect: active.aspect,
      });
      close();
    }
  };

  const rollRandom = () => {
    if (busy || reading || (!imageReady && !promptTab)) return;
    const next = randomImageSpec({
      aspect: spec.aspect,
      framing: spec.framing,
      style: settings.lastImageStyle || undefined,
    });
    setSpec(next);
    setOverride('');
    setOverrideDirty(false);
    setShowPrompt(false);
    setError(null);
    // In prompt-only mode a roll fills the form so the user can read and edit it first.
    if (promptTab) return;
    void submit(next);
  };

  const copyPrompt = async () => {
    const text = copyValue.trim();
    if (!text) return;
    const ok = await copyText(text);
    if (!ok) {
      setError('The clipboard is unavailable here. Select the prompt text and copy it manually.');
      return;
    }
    setError(null);
    setCopied(true);
    pushToast('Prompt copied — paste it into any image generator.', 'success');
    window.setTimeout(() => setCopied(false), 1_800);
  };

  return (
    <Modal
      open={brief.open}
      onClose={close}
      title={brief.mode === 'revise' ? 'Revise concept art' : 'Concept art'}
      description={
        promptTab
          ? 'Fill in the brief and copy a finished prompt. Nothing is sent anywhere in this tab.'
          : 'Movaryn turns this brief into a detailed, consistent image prompt. Nothing is generated until you press the button.'
      }
      width="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-ink-faint">
            {spec.aspect} · {spec.framing.replace('-', ' ')}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={rollRandom}
              disabled={busy || reading || (!imageReady && !promptTab)}
              title={
                promptTab
                  ? 'Roll a random character brief into the form'
                  : 'Roll a random character brief and generate it straight away'
              }
            >
              <Dices size={15} />
              Random
            </button>
            <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>
              Cancel
            </button>
            {promptTab ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void copyPrompt()}
                disabled={reading || !spec.subject.trim()}
              >
                {copied ? <Check size={15} /> : <ClipboardCopy size={15} />}
                {copied ? 'Copied' : 'Copy prompt'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void submit()}
                disabled={busy || !imageReady || reading}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                {busy
                  ? 'Generating…'
                  : brief.mode === 'revise'
                    ? 'Update image'
                    : 'Generate image'}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          className="flex gap-1 rounded-xl border border-line bg-panel p-1"
          role="tablist"
          aria-label="Concept art mode"
        >
          {(
            [
              { id: 'generate' as const, label: 'Generate image', icon: Wand2 },
              { id: 'prompt' as const, label: 'Prompt only', icon: ClipboardCopy },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => {
                  setTab(item.id);
                  setError(null);
                }}
                className={cx(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors',
                  tab === item.id
                    ? 'bg-surface text-ink'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>

        {!imageReady && !promptTab ? (
          <div className="rounded-xl border border-warn/30 bg-panel px-3.5 py-3 text-[12px] leading-relaxed text-ink-muted">
            <p className="font-medium text-ink">Image generation is not configured.</p>
            <p className="mt-1">
              Add <code className="rounded bg-surface px-1 font-mono text-[11px]">IMAGE_API_KEY</code> and{' '}
              <code className="rounded bg-surface px-1 font-mono text-[11px]">IMAGE_MODEL</code> to your
              server&apos;s .env, restart the API, then recheck the connection.
            </p>
            <button
              type="button"
              className="btn btn-secondary mt-2 h-7 text-[11.5px]"
              onClick={() => {
                close();
                openSettings();
              }}
            >
              Open settings
            </button>
            <button
              type="button"
              className="btn btn-ghost mt-2 ml-1.5 h-7 text-[11.5px]"
              onClick={() => setTab('prompt')}
            >
              Prompt only
            </button>
          </div>
        ) : null}

        <div>
          <label className="field-label" htmlFor="image-subject">
            What should be pictured?
          </label>
          <textarea
            id="image-subject"
            value={spec.subject}
            onChange={(event) => update('subject', event.target.value)}
            rows={2}
            placeholder="A red-cloaked scythe fighter, mid-stance, silver hair, cracked mask"
            className="field resize-y"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="image-details">
              Character details
            </label>
            <textarea
              id="image-details"
              value={spec.details ?? ''}
              onChange={(event) => update('details', event.target.value)}
              rows={2}
              placeholder="Face, hair, build, scars, mask, weapon shape"
              className="field resize-y"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="image-outfit">
              Outfit
            </label>
            <textarea
              id="image-outfit"
              value={spec.outfit ?? ''}
              onChange={(event) => update('outfit', event.target.value)}
              rows={2}
              placeholder="Layered black robes, red sash, wrapped forearms"
              className="field resize-y"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="image-pose">
              Pose
            </label>
            <input
              id="image-pose"
              value={spec.pose ?? ''}
              onChange={(event) => update('pose', event.target.value)}
              placeholder="Weight on the back foot, scythe trailing"
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="image-angle">
              Camera angle
            </label>
            <input
              id="image-angle"
              value={spec.angle ?? ''}
              onChange={(event) => update('angle', event.target.value)}
              placeholder="Low eye-level three-quarter view"
              className="field"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="field-label" htmlFor="image-framing">
              Framing
            </label>
            <select
              id="image-framing"
              value={spec.framing}
              onChange={(event) => update('framing', event.target.value as Framing)}
              className="field h-9"
            >
              {FRAMING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="image-style">
              Art style
            </label>
            <input
              id="image-style"
              value={spec.style ?? ''}
              onChange={(event) => update('style', event.target.value)}
              placeholder="Ink-heavy manga concept art"
              className="field h-9"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="image-palette">
              Palette
            </label>
            <input
              id="image-palette"
              value={spec.palette ?? ''}
              onChange={(event) => update('palette', event.target.value)}
              placeholder="Cold greys, one red accent"
              className="field h-9"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="image-setting">
              Background
            </label>
            <input
              id="image-setting"
              value={spec.setting ?? ''}
              onChange={(event) => update('setting', event.target.value)}
              placeholder="Leave empty for a plain backdrop"
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="image-lighting">
              Lighting
            </label>
            <input
              id="image-lighting"
              value={spec.lighting ?? ''}
              onChange={(event) => update('lighting', event.target.value)}
              placeholder="Overcast rim light from the left"
              className="field"
            />
          </div>
        </div>

        <div>
          <span className="field-label">Aspect ratio</span>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_RATIOS.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.hint}
                onClick={() => update('aspect', option.value as AspectRatio)}
                className={cx(
                  'rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                  spec.aspect === option.value
                    ? 'border-accent bg-accent-soft text-ink'
                    : 'border-line bg-panel text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                <span className="block text-[12px] font-medium">{option.label}</span>
                <span className="block text-[10px] opacity-70">{option.value}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="field-label">Reference image</span>
          {spec.reference ? (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2">
              <img
                src={spec.reference.dataUrl}
                alt={spec.reference.name}
                className="h-14 w-14 rounded-lg border border-line object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] text-ink">{spec.reference.name}</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-faint">
                  Sent to providers that support image edits; otherwise the written brief is used.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn shrink-0"
                onClick={() => update('reference', undefined)}
                aria-label="Remove reference image"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line bg-panel px-3 py-3 text-[12px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink">
              {reading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Upload a character reference
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  void addReference(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          )}
        </div>

        <div className="rounded-xl border border-line bg-panel px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
              <ImageIcon size={13} className="text-accent" />
              {promptTab ? 'Prompt for another generator' : 'Image prompt'}
            </span>
            <div className="flex items-center gap-1">
              {promptTab ? (
                <button
                  type="button"
                  className="btn btn-ghost h-6 px-1.5 text-[11px]"
                  onClick={() => void copyPrompt()}
                  disabled={!spec.subject.trim()}
                >
                  {copied ? <Check size={11} /> : <ClipboardCopy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              ) : (
                <>
                  {showPrompt && overrideDirty ? (
                    <button
                      type="button"
                      className="btn btn-ghost h-6 px-1.5 text-[11px]"
                      onClick={() => {
                        setOverride(generated);
                        setOverrideDirty(false);
                      }}
                    >
                      <RotateCcw size={11} />
                      Reset
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost h-6 px-1.5 text-[11px]"
                    onClick={() => {
                      if (!showPrompt && !overrideDirty) setOverride(generated);
                      setShowPrompt((value) => !value);
                    }}
                  >
                    <Eye size={11} />
                    {showPrompt ? 'Hide' : 'Show prompt'}
                  </button>
                </>
              )}
            </div>
          </div>

          {showPrompt || promptTab ? (
            <>
              <textarea
                value={copyValue}
                onChange={(event) => {
                  if (promptTab) {
                    setExternalDraft(event.target.value);
                    rememberPrompt(event.target.value);
                    return;
                  }
                  setOverride(event.target.value);
                  setOverrideDirty(true);
                }}
                rows={promptTab ? 9 : 6}
                className="field scroll-thin mt-2 resize-y font-mono text-[11.5px] leading-relaxed"
                aria-label={promptTab ? 'Prompt for another generator' : 'Image prompt'}
              />
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                {promptTab
                  ? `${copyValue.length} characters · editable · ${
                      project ? 'saved with this project · ' : ''
                    }paste into Midjourney, DALL·E, Stable Diffusion or any other generator.`
                  : `${promptValue.length} characters · this is exactly what is sent to the provider.`}
                {promptTab && !spec.subject.trim() ? ' Add a subject above to unlock copying.' : ''}
              </p>
            </>
          ) : (
            <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-faint">
              {generated}
            </p>
          )}
        </div>

        {error ? (
          <p className="rounded-lg border border-danger/30 bg-panel px-3 py-2 text-[11.5px] leading-relaxed text-danger">
            {error}
          </p>
        ) : null}

        {brief.mode === 'revise' ? (
          <p className="text-[10.5px] leading-relaxed text-ink-faint">
            Revisions keep the character details above. Change pose, background, angle or style to explore
            variations, and use Show prompt when you want to steer the model directly.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
