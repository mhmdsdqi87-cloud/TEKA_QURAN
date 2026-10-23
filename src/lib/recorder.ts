"use client";

/**
 * موتور ضبط تلاوت — captures PCM از میکروفون انتخابی، هر ۶ ثانیه یک فایل
 * WAV 16kHz تولید و تحویل می‌دهد تا به سرویس ASR فرستاده شود.
 */

export type RecorderState = "idle" | "requesting" | "recording" | "paused" | "stopped";

interface RecorderOptions {
  chunkMs?: number;
  onChunk: (base64Wav: string, durationSec: number) => void;
  onError: (message: string) => void;
  onLevel?: (rms: number) => void;
}

const TARGET_RATE = 16000;

function encodeWav(samples: Int16Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    view.setInt16(offset, samples[i], true);
  }
  return new Uint8Array(buffer);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]
    );
  }
  return btoa(binary);
}

function resampleTo16k(input: Float32Array, srcRate: number): Float32Array {
  if (srcRate === TARGET_RATE) return input;
  const ratio = srcRate / TARGET_RATE;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = srcIdx - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export class RecitationRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private pending: Float32Array[] = [];
  private pendingLen = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private chunkMs: number;
  private onChunk: RecorderOptions["onChunk"];
  private onError: RecorderOptions["onError"];
  private onLevel?: RecorderOptions["onLevel"];
  private lastLevelAt = 0;
  private deviceLabel: string | null = null;

  state: RecorderState = "idle";
  deviceId: string | undefined = undefined;

  constructor(opts: RecorderOptions) {
    this.chunkMs = opts.chunkMs ?? 6000;
    this.onChunk = opts.onChunk;
    this.onError = opts.onError;
    this.onLevel = opts.onLevel;
  }

  /** شروع ضبط با میکروفون مشخص */
  async start(deviceId?: string): Promise<void> {
    this.state = "requesting";
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      const track = this.stream.getAudioTracks()[0];
      this.deviceLabel = track?.label ?? null;

      const Ctor: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.sink = this.ctx.createGain();
      this.sink.gain.value = 0;
      this.sink.connect(this.ctx.destination);

      const supportsWorklet = typeof this.ctx.audioWorklet !== "undefined";
      if (supportsWorklet) {
        await this.ctx.audioWorklet.addModule("/worklets/recorder-worklet.js");
        this.worklet = new AudioWorkletNode(this.ctx, "rec-pcm-collector");
        this.worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
          this.pushSamples(e.data);
        };
        this.source.connect(this.worklet);
        this.worklet.connect(this.sink);
      } else {
        // فالبک ScriptProcessor
        this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = (e) => {
          this.pushSamples(new Float32Array(e.inputBuffer.getChannelData(0)));
        };
        this.source.connect(this.processor);
        this.processor.connect(this.sink);
      }

      this.state = "recording";
      this.timer = setInterval(() => this.flush(), this.chunkMs);
    } catch (err) {
      this.state = "idle";
      const e = err as DOMException;
      if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
        this.onError("دسترسی به میکروفون داده نشد. لطفاً از تنظیمات مرورگر اجازه دهید.");
      } else if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
        this.onError("هیچ میکروفونی پیدا نشد. اتصال میکروفون را بررسی کنید.");
      } else {
        this.onError("خطا در شروع ضبط: " + (e?.message ?? "نامشخص"));
      }
      this.cleanup();
      throw err;
    }
  }

  private pushSamples(samples: Float32Array) {
    if (this.state !== "recording") return;
    this.pending.push(samples);
    this.pendingLen += samples.length;
    if (this.onLevel) {
      const now = performance.now();
      if (now - this.lastLevelAt > 120) {
        this.lastLevelAt = now;
        let sum = 0;
        const step = Math.max(1, Math.floor(samples.length / 128));
        let n = 0;
        for (let i = 0; i < samples.length; i += step) {
          sum += samples[i] * samples[i];
          n++;
        }
        this.onLevel(Math.sqrt(sum / Math.max(1, n)));
      }
    }
  }

  private flush() {
    if (this.pendingLen === 0 || !this.ctx) return;
    const merged = new Float32Array(this.pendingLen);
    let off = 0;
    for (const p of this.pending) {
      merged.set(p, off);
      off += p.length;
    }
    this.pending = [];
    this.pendingLen = 0;

    // سطح صدا خیلی کم؟ (سکوت) → نفرست
    let sum = 0;
    for (let i = 0; i < merged.length; i++) sum += merged[i] * merged[i];
    const rms = Math.sqrt(sum / merged.length);
    if (rms < 0.0035) return;

    const rate = this.ctx.sampleRate;
    const resampled = resampleTo16k(merged, rate);
    const pcm = floatToInt16(resampled);
    const wav = encodeWav(pcm, TARGET_RATE);
    const b64 = bytesToBase64(wav);
    const durationSec = Math.round((resampled.length / TARGET_RATE) * 10) / 10;
    try {
      this.onChunk(b64, durationSec);
    } catch {
      /* consumer error مسئولیت خودش است */
    }
  }

  /** مکث موقت */
  pause() {
    if (this.state !== "recording") return;
    this.flush();
    this.state = "paused";
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = false));
  }

  /** ادامهٔ ضبط */
  resume() {
    if (this.state !== "paused") return;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = true));
    this.state = "recording";
  }

  /** توقف نهایی و تحویل آخرین قطعه */
  async stop(): Promise<void> {
    if (this.state === "recording") this.flush();
    this.state = "stopped";
    this.cleanup();
  }

  private cleanup() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try {
      this.worklet?.port.close();
      this.worklet?.disconnect();
      this.processor?.disconnect();
      this.source?.disconnect();
      this.sink?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.worklet = null;
    this.processor = null;
    this.source = null;
    this.sink = null;
    this.stream = null;
    this.ctx = null;
    this.pending = [];
    this.pendingLen = 0;
  }

  get label(): string | null {
    return this.deviceLabel;
  }
}

/** لیست میکروفون‌ها (بعد از گرفتن مجوز) */
export async function listMicrophones(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  } catch {
    return [];
  }
}
