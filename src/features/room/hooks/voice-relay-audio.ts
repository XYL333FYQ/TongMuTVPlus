/*
 * 语音服务器中转的音频编解码：麦克风采样 → 16 位 PCM 字节，收到的字节 → 播放。
 * 纯计算，不碰 React 状态（useVoiceChat 调用）。
 */

/** 中转用的采样率（降低采样率以减少数据量） */
export const RELAY_SAMPLE_RATE = 16000;

/** RMS 低于这个值当作静音，不发送 */
const SILENCE_THRESHOLD = 0.01;
/** 超过这个比例的样本接近 0，当作无效数据包 */
const NEAR_ZERO_RATIO = 0.95;
/** 播放队列最多允许堆积的时长（秒），超过就丢包追上实时 */
const MAX_QUEUE_DELAY = 0.5;

/** 一段麦克风采样编成要发出去的字节；静音或几乎全零时返回 null（不发送） */
export function encodeMicChunk(input: Float32Array): number[] | null {
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
  const rms = Math.sqrt(sum / input.length);
  if (rms < SILENCE_THRESHOLD) return null;

  // -1..1 的浮点数转成 -32768..32767 的整数
  const pcm = new Int16Array(input.length);
  let nearZero = 0;
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (Math.abs(pcm[i]) < 256) nearZero++;
  }
  if (nearZero / pcm.length > NEAR_ZERO_RATIO) return null;
  return Array.from(new Uint8Array(pcm.buffer));
}

/** 收到的字节解回 AudioBuffer 用的浮点采样 */
export function decodeRelayChunk(audioData: number[]): Float32Array {
  const int16 = new Int16Array(new Uint8Array(audioData).buffer);
  const out = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++)
    out[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
  return out;
}

/**
 * 把一段采样排进播放队列。返回下一段该接着播的时间；
 * 队列堆积超过上限时不播这一段，返回 null（调用方把队列重置到现在）。
 */
export function scheduleRelayChunk(
  audioContext: AudioContext,
  samples: Float32Array,
  sampleRate: number,
  queuedAt: number | undefined
): number | null {
  const now = audioContext.currentTime;
  let start = queuedAt ?? now;
  if (start - now > MAX_QUEUE_DELAY) return null;
  if (start < now) start = now;
  const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start(start);
  return start + samples.length / sampleRate;
}
