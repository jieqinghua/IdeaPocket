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
