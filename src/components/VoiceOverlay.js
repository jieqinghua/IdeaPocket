import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { shadow, theme, type } from '../theme';
import {
  appendWaveformSample,
  meteringToAmplitude,
  WAVEFORM_SAMPLE_COUNT,
} from '../voiceWaveform';

function fmt(ms) {
  const s = Math.floor((ms || 0) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Waveform({ samples, canceling }) {
  const color = canceling ? theme.wilting : theme.brand;
  const width = 300;
  const height = 96;
  const center = height / 2;
  const gap = width / Math.max(1, samples.length - 1);

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {samples.map((amplitude, index) => {
        const x = index * gap;
        const halfBar = 3 + amplitude * 43;
        return (
          <Line
            key={index}
            x1={x}
            x2={x}
            y1={center - halfBar}
            y2={center + halfBar}
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

// 纯展示层；pointerEvents=none，让按住手势继续由下方 FAB 接管（避免打断录音手势）。
export default function VoiceOverlay({
  visible,
  phase = 'recording',
  duration,
  metering,
  canceling,
  onHidden,
}) {
  const [samples, setSamples] = useState(() => Array(WAVEFORM_SAMPLE_COUNT).fill(0));
  const [rendered, setRendered] = useState(false);
  const visiblePhaseRef = useRef(phase);
  const onHiddenRef = useRef(onHidden);
  const { height: viewportHeight } = useWindowDimensions();
  const sheetHeight = Math.max(420, viewportHeight * 0.56);
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  if (visible) visiblePhaseRef.current = phase;

  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  useEffect(() => {
    if (!visible) {
      setSamples(Array(WAVEFORM_SAMPLE_COUNT).fill(0));
      return;
    }
    setSamples((current) => appendWaveformSample(current, meteringToAmplitude(metering)));
  }, [duration, metering, visible]);

  useEffect(() => {
    let animation;
    translateY.stopAnimation();
    if (visible) {
      setRendered(true);
      translateY.setValue(sheetHeight);
      animation = Animated.timing(translateY, {
        toValue: 0,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    } else if (rendered) {
      animation = Animated.timing(translateY, {
        toValue: sheetHeight,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      });
    }
    animation?.start(({ finished }) => {
      if (finished && !visible) {
        setRendered(false);
        onHiddenRef.current?.();
      }
    });
    return () => animation?.stop();
  }, [sheetHeight, translateY, visible]);

  if (!visible && !rendered) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.sheet,
          { height: sheetHeight, transform: [{ translateY }] },
          canceling && styles.sheetCancel,
        ]}
      >
        {visiblePhaseRef.current === 'recognizing' ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={theme.brand} />
            <Text style={styles.loadingText}>识别中</Text>
          </View>
        ) : (
          <>
            <View style={styles.handle} />
            <Text style={[styles.timer, canceling && styles.timerCancel]}>{fmt(duration)}</Text>
            <View style={styles.waveform}>
              <Waveform samples={samples} canceling={canceling} />
            </View>
            <Text style={[styles.hintTxt, canceling && styles.hintTxtCancel]}>
              {canceling ? '松开取消' : '松开记录 · 上滑取消'}
            </Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.overlaySoft,
    zIndex: 50,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.surface,
    alignItems: 'center',
    ...shadow.sheet,
  },
  sheetCancel: { backgroundColor: theme.destructiveSoft },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  loadingText: {
    ...type.auxiliary,
    color: theme.ink,
    fontWeight: '600',
    marginTop: 16,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.inkMuted,
  },
  timer: {
    ...type.pageTitle,
    color: theme.brand,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    marginTop: 34,
  },
  timerCancel: { color: theme.wilting },
  waveform: { width: '100%', maxWidth: 320, marginTop: 18 },
  hintTxt: {
    ...type.auxiliary,
    color: theme.inkSoft,
    fontWeight: '600',
    marginTop: 24,
  },
  hintTxtCancel: { color: theme.wilting, fontWeight: '600' },
});
