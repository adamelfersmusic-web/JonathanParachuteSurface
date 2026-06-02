// Voice + text capture primitives, ported (trimmed) from the Notes reference
// app's `lib/capture`. A thin MediaRecorder wrapper, a React hook that owns the
// recording lifecycle, hashtag extraction, and path/content helpers.

import { useCallback, useEffect, useRef, useState } from "react";

// Opus-in-webm is the Chrome/Firefox default; Safari needs mp4 (AAC). All three
// extensions are on the vault's storage allowlist.
const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

function extensionFor(mimeType: string): string {
  if (mimeType.startsWith("audio/webm")) return "webm";
  if (mimeType.startsWith("audio/mp4")) return "m4a";
  if (mimeType.startsWith("audio/ogg")) return "ogg";
  return "bin";
}

export function memoFilename(mimeType: string, at = new Date()): string {
  const iso = at.toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
  return `memo-${iso}.${extensionFor(mimeType)}`;
}

// capture/YYYY/MM-DD/HH-MM-SS — keeps the inbox from becoming one flat folder.
export function capturePath(at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `capture/${at.getFullYear()}/${p(at.getMonth() + 1)}-${p(at.getDate())}/${p(
    at.getHours(),
  )}-${p(at.getMinutes())}-${p(at.getSeconds())}`;
}

// Pull `#tags` out of free text so "had an #idea today" surfaces under #idea.
// Anchored at start/whitespace so URLs like example.com/#x aren't matched.
const HASHTAG_RE = /(?:^|\s)#([a-zA-Z][\w/-]*)/g;
export function extractHashtags(content: string): string[] {
  const out = new Set<string>();
  for (const m of content.matchAll(HASHTAG_RE)) {
    const tag = (m[1] ?? "").toLowerCase().replace(/-+$/, "");
    if (tag) out.add(tag);
  }
  return [...out];
}

// Note body for a voice memo. The audio rides as an attachment (transcribed
// server-side); this is what the operator sees until the transcript lands.
export function voiceNoteContent(typed: string, at = new Date()): string {
  const lines = ["# 🎙️ Voice memo", "", `_Recorded ${at.toLocaleString()}._`, ""];
  if (typed.trim()) lines.push(typed.trim(), "");
  lines.push("_Transcript pending…_", "");
  return lines.join("\n");
}

async function requestMic(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone isn't available in this browser.");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new Error("No microphone was found on this device.");
    }
    throw new Error("Microphone access was denied. Allow it in your browser's site settings.");
  }
}

export type VoicePhase =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "denied"; message: string }
  | { kind: "recording"; startedAt: number }
  | { kind: "have-audio"; blob: Blob; mimeType: string; url: string; durationMs: number };

// Owns the MediaRecorder lifecycle, the elapsed timer, and the preview blob URL.
export function useVoiceCapture() {
  const [phase, setPhase] = useState<VoicePhase>({ kind: "idle" });
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (phase.kind !== "recording") return;
    const id = setInterval(() => setElapsedMs(Date.now() - phase.startedAt), 200);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const start = useCallback(async () => {
    setPhase({ kind: "requesting" });
    const mimeType = pickMimeType();
    if (!mimeType) {
      setPhase({ kind: "denied", message: "This browser can't record audio in a savable format." });
      return;
    }
    try {
      const stream = await requestMic();
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.start();
      recorderRef.current = rec;
      setElapsedMs(0);
      setPhase({ kind: "recording", startedAt: Date.now() });
    } catch (e) {
      setPhase({ kind: "denied", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const stop = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec || phase.kind !== "recording") return;
    const durationMs = Date.now() - phase.startedAt;
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    const blob = new Blob(chunksRef.current, { type: rec.mimeType });
    const url = URL.createObjectURL(blob);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setPhase({ kind: "have-audio", blob, mimeType: rec.mimeType, url, durationMs });
  }, [phase]);

  const discard = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setPhase({ kind: "idle" });
    setElapsedMs(0);
  }, []);

  return { phase, elapsedMs, start, stop, discard };
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
