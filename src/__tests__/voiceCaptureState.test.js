import {
  INITIAL_VOICE_STATE,
  shouldShowCaptureButton,
  voiceCaptureReducer,
} from '../voiceCaptureState';

test('语音正常流程保持在连续状态机中', () => {
  const recording = voiceCaptureReducer(INITIAL_VOICE_STATE, { type: 'RECORDING' });
  const transcribing = voiceCaptureReducer(recording, {
    type: 'TRANSCRIBING',
    uri: 'file:///a.aac',
  });
  const success = voiceCaptureReducer(transcribing, { type: 'SUCCESS' });

  expect(recording.phase).toBe('recording');
  expect(transcribing).toMatchObject({ phase: 'transcribing', retryUri: 'file:///a.aac' });
  expect(success.phase).toBe('success');
});

test('识别失败保留录音用于重试，关闭后回到 idle', () => {
  const failed = voiceCaptureReducer(INITIAL_VOICE_STATE, {
    type: 'ERROR',
    error: '网络失败',
    uri: 'file:///a.aac',
  });

  expect(failed).toMatchObject({
    phase: 'error',
    error: '网络失败',
    retryUri: 'file:///a.aac',
  });
  expect(voiceCaptureReducer(failed, { type: 'RESET' })).toBe(INITIAL_VOICE_STATE);
});

test('录音阶段持续保留主按钮以接收移动和松手事件', () => {
  expect(shouldShowCaptureButton(false, 'idle')).toBe(true);
  expect(shouldShowCaptureButton(false, 'recording')).toBe(true);
  expect(shouldShowCaptureButton(false, 'transcribing')).toBe(false);
  expect(shouldShowCaptureButton(false, 'success')).toBe(false);
  expect(shouldShowCaptureButton(true, 'recording')).toBe(false);
});
