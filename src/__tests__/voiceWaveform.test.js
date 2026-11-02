import {
  appendWaveformSample,
  buildWaveformPoints,
  meteringToAmplitude,
  mirrorWaveformSamples,
  waveformBarOpacity,
} from '../voiceWaveform';

test('麦克风分贝会被转换为稳定的 0 到 1 振幅', () => {
  expect(meteringToAmplitude(-72)).toBe(0);
  expect(meteringToAmplitude(3)).toBe(1);
  expect(meteringToAmplitude(-60)).toBeLessThan(0.1);
  expect(meteringToAmplitude(-30)).toBeGreaterThan(0);
  expect(meteringToAmplitude(-30)).toBeLessThan(1);
  expect(meteringToAmplitude(-20)).toBeGreaterThan(meteringToAmplitude(-30));
  expect(meteringToAmplitude(-10)).toBeGreaterThan(meteringToAmplitude(-20));
  expect(meteringToAmplitude(undefined)).toBe(0);
});

test('波形只保留最近的真实音量样本', () => {
  expect(appendWaveformSample([0.1, 0.2], 0.8, 2)).toEqual([0.2, 0.8]);
  expect(appendWaveformSample([], 2, 2)).toEqual([1]);
});

test('真实音量样本会生成可渲染的折线坐标', () => {
  const points = buildWaveformPoints([0, 1, 0.5], 100, 40).split(' ');
  expect(points).toHaveLength(3);
  expect(points[0]).toBe('0.0,20.0');
  expect(points[1]).not.toBe('50.0,20.0');
  expect(points[2]).not.toBe('100.0,20.0');
});

test('最新音量显示在波形中间，并向两侧对称扩散', () => {
  expect(mirrorWaveformSamples([0.1, 0.4, 0.9], 5)).toEqual([0.1, 0.4, 0.9, 0.4, 0.1]);
  expect(mirrorWaveformSamples([0.2], 3)).toEqual([0, 0.2, 0]);
});

test('波形两端渐隐，中段保持不透明', () => {
  expect(waveformBarOpacity(0, 43)).toBeCloseTo(0.15);
  expect(waveformBarOpacity(42, 43)).toBeCloseTo(0.15);
  expect(waveformBarOpacity(4, 43)).toBeGreaterThan(waveformBarOpacity(1, 43));
  expect(waveformBarOpacity(21, 43)).toBe(1);
});
