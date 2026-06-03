// Tarteel Whisper-tiny fine-tuned on Quran recitation, ONNX-exported by omartariq612.
// Loaded once per browser tab via @huggingface/transformers; cached in IndexedDB after first
// download (~90MB at q4 quantization). All inference runs in-browser.

const MODEL_ID = "omartariq612/tarteel-ai-whisper-tiny-ar-quran-onnx";

export type LoadStatus =
  | { kind: "idle" }
  | { kind: "loading"; progress: number; file?: string }
  | { kind: "ready" }
  | { kind: "error"; message: string };

type Pipeline = (
  input: Float32Array,
  opts?: Record<string, unknown>
) => Promise<{ text?: string } | { text?: string }[]>;

let pipelinePromise: Promise<Pipeline> | null = null;
let cached: Pipeline | null = null;

export async function loadWhisper(
  onStatus?: (s: LoadStatus) => void
): Promise<Pipeline> {
  if (cached) {
    onStatus?.({ kind: "ready" });
    return cached;
  }
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      onStatus?.({ kind: "loading", progress: 0 });
      const { pipeline } = await import("@huggingface/transformers");
      const pipe = (await pipeline(
        "automatic-speech-recognition",
        MODEL_ID,
        {
          dtype: "q4",
          progress_callback: (data: unknown) => {
            const d = data as {
              status?: string;
              progress?: number;
              file?: string;
            };
            if (d.status === "progress" || d.status === "downloading") {
              onStatus?.({
                kind: "loading",
                progress: Math.round(d.progress ?? 0),
                file: d.file,
              });
            }
          },
        }
      )) as unknown as Pipeline;
      cached = pipe;
      onStatus?.({ kind: "ready" });
      return pipe;
    })().catch((err: unknown) => {
      pipelinePromise = null;
      const message = err instanceof Error ? err.message : "Model load failed";
      onStatus?.({ kind: "error", message });
      throw err;
    });
  }
  return pipelinePromise;
}

export async function transcribe(
  audioBlob: Blob,
  options?: { onStatus?: (s: LoadStatus) => void }
): Promise<string> {
  const pipe = await loadWhisper(options?.onStatus);
  const audioData = await blobToMono16k(audioBlob);
  const out = await pipe(audioData, {
    language: "ar",
    task: "transcribe",
    chunk_length_s: 30,
  });
  const result = Array.isArray(out) ? out[0] : out;
  return (result?.text ?? "").trim();
}

async function blobToMono16k(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const Ctx =
    typeof window !== "undefined"
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)
      : null;
  if (!Ctx) throw new Error("AudioContext not available in this environment");
  const ctx = new Ctx({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    return decoded.getChannelData(0);
  } finally {
    void ctx.close();
  }
}

export function isWhisperLoaded(): boolean {
  return cached !== null;
}
