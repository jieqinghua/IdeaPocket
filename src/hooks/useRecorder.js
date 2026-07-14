// 封装 expo-audio 录音：权限、开始/停止、时长、是否在录。
import { useEffect, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

// 使用 Expo 的 iOS m4a 预设。iOS 模拟器并不稳定支持强制的 16 kHz 单声道录音配置；
// 服务端转写可以直接接收 m4a，无需在客户端降采样。
const VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    extension: '.aac',
    outputFormat: 'aac_adts',
    audioEncoder: 'aac',
  },
};

export function useRecorder() {
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder, 80);
  const [hasPermission, setHasPermission] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        setHasPermission(status.granted);
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      } catch (e) {
        console.warn('audio init failed', e?.message);
        setHasPermission(false);
      }
    })();
  }, []);

  const prepareAudioSession = async () => {
    // 不依赖首次渲染时的异步初始化，避免用户刚打开 App 就按住时抢在会话配置前录音。
    const status = await AudioModule.requestRecordingPermissionsAsync();
    setHasPermission(status.granted);
    if (!status.granted) throw new Error('未授予麦克风权限');
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  };

  const start = async () => {
    await prepareAudioSession();
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  // 停止并返回音频文件 uri（调用方决定保留还是丢弃）
  const stop = async () => {
    await recorder.stop();
    return recorder.uri;
  };

  return {
    start,
    stop,
    isRecording: state.isRecording,
    durationMillis: state.durationMillis ?? 0,
    metering: state.metering ?? -60,
    hasPermission,
  };
}
