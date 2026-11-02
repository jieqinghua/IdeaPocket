export const WAVEFORM_SAMPLE_COUNT = 42;
export const MIN_METERING_DB = -72;
export const MAX_METERING_DB = 3;
const AMPLITUDE_EXPONENT = 1.65;

export function meteringToAmplitude(metering) {
  if (!Number.isFinite(metering)) return 0;
  const normalized = Math.max(
    0,
    Math.min(1, (metering - MIN_METERING_DB) / (MAX_METERING_DB - MIN_METERING_DB))
  );
  return Math.pow(normalized, AMPLITUDE_EXPONENT);
}

export function appendWaveformSample(samples, amplitude, limit = WAVEFORM_SAMPLE_COUNT) {
  const safeAmplitude = Number.isFinite(amplitude)
    ? Math.max(0, Math.min(1, amplitude))
    : 0;
  return [...samples, safeAmplitude].slice(-limit);
}

export function buildWaveformPoints(samples, width = 288, height = 72) {
  const values = samples.length ? samples : [0];
  const center = height / 2;
  const maxDisplacement = height * 0.42;
  const denominator = Math.max(1, values.length - 1);

  return values.map((amplitude, index) => {
    const x = (index / denominator) * width;
    const direction = index % 4 < 2 ? -1 : 1;
    const y = center + direction * amplitude * maxDisplacement;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export const WAVEFORM_BAR_COUNT = 43;
const EDGE_FADE_BARS = 8;

// 最新音量放在正中，历史样本向两侧对称扩散，避免实时音量落在两端渐隐区里。
export function mirrorWaveformSamples(samples, barCount = WAVEFORM_BAR_COUNT) {
  const middle = Math.floor(barCount / 2);
  const last = samples.length - 1;
  return Array.from({ length: barCount }, (_, index) => {
    const value = samples[last - Math.abs(index - middle)];
    return Number.isFinite(value) ? value : 0;
  });
}

export function waveformBarOpacity(index, count, fadeBars = EDGE_FADE_BARS) {
  const edgeDistance = Math.min(index, count - 1 - index);
  if (edgeDistance >= fadeBars) return 1;
  return 0.15 + 0.85 * (Math.max(0, edgeDistance) / fadeBars);
}
