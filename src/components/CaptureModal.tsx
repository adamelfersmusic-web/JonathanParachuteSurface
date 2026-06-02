import { useState } from "react";
import { VaultApi } from "../api";
import {
  capturePath,
  extractHashtags,
  formatElapsed,
  memoFilename,
  useVoiceCapture,
  voiceNoteContent,
} from "../capture";

// Quick capture: type a thought (with #hashtags) and/or record a voice memo.
// Voice memos upload to storage, attach to a fresh capture/voice note, and are
// transcribed server-side. Text becomes a capture/text note; #hashtags become
// tags. Built to be the fastest thing in the app to open, dump into, and close.
export function CaptureModal({
  api,
  onClose,
  onSaved,
}: {
  api: VaultApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState("capture");
  const [saving, setSaving] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const voice = useVoiceCapture();

  const hasAudio = voice.phase.kind === "have-audio";
  const recording = voice.phase.kind === "recording" || voice.phase.kind === "requesting";
  const canSave = !saving && !recording && (text.trim().length > 0 || hasAudio);

  function uniq(list: string[]): string[] {
    return [...new Set(list.filter(Boolean))];
  }

  async function handleSave() {
    setError(null);
    const at = new Date();
    const base = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const fromText = extractHashtags(text);
    const path = capturePath(at);

    try {
      if (voice.phase.kind === "have-audio") {
        const allTags = uniq([...base, ...fromText, "capture/voice"]);
        const filename = memoFilename(voice.phase.mimeType, at);
        setSaving("Uploading audio…");
        const up = await api.uploadStorage(voice.phase.blob, filename);
        setSaving("Creating note…");
        const note = await api.createNote({
          path,
          content: voiceNoteContent(text, at),
          tags: allTags,
        });
        setSaving("Queuing transcription…");
        await api.addAttachment(note.id, {
          path: up.path,
          mimeType: up.mimeType,
          transcribe: true,
        });
      } else {
        const allTags = uniq([...base, ...fromText, "capture/text"]);
        setSaving("Saving…");
        await api.createNote({ path, content: text.trim(), tags: allTags });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(null);
    }
  }

  return (
    <>
      <div className="panel-scrim" onClick={saving ? undefined : onClose} />
      <div className="capture-modal" role="dialog" aria-label="Capture">
        <header className="capture-head">
          <span className="capture-title">Capture</span>
          <button className="ghost" onClick={onClose} aria-label="Close" disabled={!!saving}>
            ✕
          </button>
        </header>

        {error && <div className="error-box">{error}</div>}

        <textarea
          className="capture-text"
          placeholder="What's on your mind?  #hashtags become tags."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          spellCheck
        />

        <div className="capture-voice">
          {voice.phase.kind === "idle" && (
            <button className="ghost record-btn" onClick={voice.start}>
              <span className="rec-dot" /> Record voice
            </button>
          )}
          {voice.phase.kind === "requesting" && (
            <span className="muted">Requesting microphone…</span>
          )}
          {voice.phase.kind === "denied" && (
            <div className="voice-denied">
              <span>{voice.phase.message}</span>
              <button className="ghost tiny" onClick={voice.start}>
                Try again
              </button>
            </div>
          )}
          {voice.phase.kind === "recording" && (
            <button className="record-btn recording" onClick={voice.stop}>
              <span className="rec-dot pulsing" /> Stop · {formatElapsed(voice.elapsedMs)}
            </button>
          )}
          {voice.phase.kind === "have-audio" && (
            <div className="voice-preview">
              <audio controls src={voice.phase.url} />
              <div className="voice-preview-actions">
                <span className="hint">Transcribes automatically on save</span>
                <button className="ghost tiny" onClick={voice.discard}>
                  Re-record
                </button>
              </div>
            </div>
          )}
        </div>

        <label className="capture-tags">
          Tags <span className="hint">comma-separated · voice/text added automatically</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} spellCheck={false} />
        </label>

        <div className="capture-actions">
          <button onClick={handleSave} disabled={!canSave}>
            {saving ?? "Capture"}
          </button>
          <button className="ghost" onClick={onClose} disabled={!!saving}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
