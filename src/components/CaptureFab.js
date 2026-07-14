import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Animated, KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useRecorder } from '../hooks/useRecorder';
import { transcribe } from '../lib/stt';
import CaptureBar from './CaptureBar';
import VoiceOverlay from './VoiceOverlay';
import VoiceWaveformIcon from './VoiceWaveformIcon';
import { metrics, radius, shadow, spacing, theme, type } from '../theme';

const HOLD_MS = 240; // 按住超过这个时长才进入录音；更短的判为"点击"
const CANCEL_DY = -70; // 上滑超过该距离 → 取消
const MIN_RECORD_MS = 600; // 太短的录音视为误触，丢弃
export default function CaptureFab({ onSubmit, onOverlayChange, presentationOpacity = 1 }) {
  const recorder = useRecorder();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [recording, setRecording] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [retryAudioUri, setRetryAudioUri] = useState(null);

  const holdTimer = useRef(null);
  const startedRef = useRef(false);
  const pressActiveRef = useRef(false);
  const cancelRef = useRef(false);
  const startY = useRef(0);
  const startedAtRef = useRef(0);
  const sourceRef = useRef('text');
  const pendingVoiceNoteRef = useRef('');

  useEffect(() => {
    onOverlayChange?.(recording || busy || closing);
  }, [busy, closing, onOverlayChange, recording]);

  useEffect(() => () => {
    clearTimeout(holdTimer.current);
    onOverlayChange?.(false);
  }, [onOverlayChange]);

  const openComposer = (text, source) => {
    sourceRef.current = source;
    setComposerText(text);
    setComposerOpen(true);
  };
  const closeComposer = () => {
    setComposerOpen(false);
    setComposerText('');
    setVoiceError('');
    setRetryAudioUri(null);
  };

  const transcribeAudio = async (uri) => {
    if (!uri) {
      setBusy(false);
      setVoiceError('没有找到录音文件，请重新录制');
      openComposer('', 'voice');
      return;
    }
    setBusy(true);
    setClosing(false);
    setVoiceError('');
    try {
      const { text } = await transcribe(uri);
      const recognizedText = text?.trim();
      if (!recognizedText) throw new Error('没有识别到文字，请重试或直接打字');
      setRetryAudioUri(null);
      pendingVoiceNoteRef.current = recognizedText;
      setBusy(false);
      setClosing(true);
    } catch (err) {
      setRetryAudioUri(uri);
      setVoiceError(err?.message || '转写失败，请重试或直接打字');
      openComposer('', 'voice');
      setBusy(false);
      setClosing(false);
    }
  };

  const handleOverlayHidden = () => {
    const recognizedText = pendingVoiceNoteRef.current;
    if (!recognizedText) return;
    pendingVoiceNoteRef.current = '';
    onSubmit(recognizedText, 'voice');
    setClosing(false);
  };

  const grant = (e) => {
    pressActiveRef.current = true;
    startY.current = e.nativeEvent.pageY;
    cancelRef.current = false;
    startedRef.current = false;
    setCanceling(false);
    holdTimer.current = setTimeout(async () => {
      try {
        await recorder.start();
        if (!pressActiveRef.current) {
          await recorder.stop().catch(() => {});
          return;
        }
        startedRef.current = true;
        startedAtRef.current = Date.now();
        setRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch (err) {
        startedRef.current = false;
        setVoiceError(err?.message || '麦克风不可用，可直接打字记录');
        openComposer('', 'text');
      }
    }, HOLD_MS);
  };

  const move = (e) => {
    if (!startedRef.current) return;
    const dy = e.nativeEvent.pageY - startY.current;
    const c = dy < CANCEL_DY;
    if (c !== cancelRef.current) {
      cancelRef.current = c;
      setCanceling(c);
    }
  };

  const release = async () => {
    pressActiveRef.current = false;
    clearTimeout(holdTimer.current);
    if (!startedRef.current) {
      openComposer('', 'text'); // 点击 → 文字输入
      return;
    }
    const tooShort = Date.now() - startedAtRef.current < MIN_RECORD_MS;
    const shouldTranscribe = !cancelRef.current && !tooShort;
    startedRef.current = false;
    if (shouldTranscribe) setBusy(true);
    setRecording(false);
    let uri;
    try {
      uri = await recorder.stop();
    } catch {}
    if (cancelRef.current || tooShort) {
      setCanceling(false);
      return; // 取消 / 太短 → 丢弃
    }
    await transcribeAudio(uri);
  };

  const terminate = async () => {
    cancelRef.current = true;
    setCanceling(true);
    await release();
  };

  const showMainButton = !composerOpen && !busy && !closing;

  return (
    <>
      <VoiceOverlay
        visible={recording || busy}
        phase={busy ? 'recognizing' : 'recording'}
        duration={recorder.durationMillis}
        metering={recorder.metering}
        canceling={canceling}
        onHidden={handleOverlayHidden}
      />

      {composerOpen && (
        <KeyboardAvoidingView
          style={styles.composerWrap}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <Pressable style={styles.backdrop} onPress={closeComposer} />
          <CaptureBar
            initialText={composerText}
            autoFocus
            onClose={closeComposer}
            notice={voiceError}
            retrying={busy}
            onRetry={retryAudioUri ? () => transcribeAudio(retryAudioUri) : undefined}
            onSubmit={(t) => {
              setVoiceError('');
              setRetryAudioUri(null);
              onSubmit(t, sourceRef.current);
            }}
          />
        </KeyboardAvoidingView>
      )}

      {showMainButton && (
        <Animated.View style={[styles.bottomFade, { opacity: presentationOpacity }]} pointerEvents="none">
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="bottom-button-fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.bg} stopOpacity={0} />
                <Stop offset="1" stopColor={theme.bg} stopOpacity={0.75} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#bottom-button-fade)" />
          </Svg>
        </Animated.View>
      )}

      {showMainButton && (
        <Animated.View
          accessibilityRole="button"
          accessibilityLabel="按住记录，轻点可文字输入"
          accessibilityHint="长按开始录音，上滑取消"
          style={[styles.fab, recording && styles.fabRec, canceling && styles.fabCancel, { opacity: presentationOpacity }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={grant}
          onResponderMove={move}
          onResponderRelease={release}
          onResponderTerminate={terminate}
        >
          <VoiceWaveformIcon size={metrics.standardIcon} color={theme.onBrand} />
          <Text style={styles.fabLabel}>
            {canceling ? '松开取消' : recording ? '松开完成' : '按住记录'}
          </Text>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 128,
    zIndex: 10,
  },
  fab: {
    ...shadow.floating,
    position: 'absolute',
    alignSelf: 'center',
    bottom: spacing.xl,
    width: 200,
    height: metrics.standardButton,
    borderRadius: radius.pill,
    backgroundColor: theme.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    zIndex: 20,
  },
  fabRec: { backgroundColor: theme.brandPressed, transform: [{ scale: 1.03 }], zIndex: 60 },
  fabCancel: { backgroundColor: theme.wilting },
  fabLabel: {
    ...type.content,
    color: theme.onBrand,
    fontWeight: '700',
  },
  composerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 40,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },
});
