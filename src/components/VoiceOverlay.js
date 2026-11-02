import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';
import { type, useAppTheme } from '../theme';
import {
  appendWaveformSample,
  meteringToAmplitude,
  mirrorWaveformSamples,
  WAVEFORM_SAMPLE_COUNT,
  waveformBarOpacity,
} from '../voiceWaveform';

// 底部饱和、向上淡出的穹顶形渐变：录音用品牌蓝，上滑取消用危险红；色值取自主题规范。
// strength 压低整体浓度，让文字和波形落在渐变里仍然清楚。
const maskTones = (theme) => ({
  record: { color: theme.brand, strength: 0.78, ink: theme.onBrand },
  cancel: {
    color: theme.destructive,
    strength: theme.mode === 'dark' ? 0.55 : 0.42,
    ink: theme.mode === 'dark' ? theme.ink : theme.destructive,
  },
});
const MASK_STOPS = [[0, 1], [0.45, 0.92], [0.66, 0.62], [0.84, 0.22], [1, 0]];

// 几何参数必须用百分比：react-native-svg 的 Android 实现会把绝对数值的 cy 再乘以 ry/rx，
// 导致渐变中心被推到屏幕外、遮罩整体偏低。
function GradientMask({ id, color, strength }) {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="110%" rx="110%" ry="60%">
          {MASK_STOPS.map(([offset, opacity]) => (
            <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity * strength} />
          ))}
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function Waveform({ samples, color }) {
  const width = 280;
  const height = 56;
  const center = height / 2;
  const bars = mirrorWaveformSamples(samples);
  const gap = width / Math.max(1, bars.length - 1);

  return (
    <Svg width="100%" height={height} viewBox={`-2 0 ${width + 4} ${height}`}>
      {bars.map((amplitude, index) => {
        const x = index * gap;
        const halfBar = 3.5 + amplitude * 24;
        return (
          <Line
            key={index}
            x1={x}
            x2={x}
            y1={center - halfBar}
            y2={center + halfBar}
            stroke={color}
            strokeOpacity={waveformBarOpacity(index, bars.length)}
            strokeWidth={2.4}
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
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const tones = maskTones(theme);
  const [samples, setSamples] = useState(() => Array(WAVEFORM_SAMPLE_COUNT).fill(0));
  const [rendered, setRendered] = useState(false);
  const visiblePhaseRef = useRef(phase);
  const visibleCancelRef = useRef(canceling);
  const onHiddenRef = useRef(onHidden);
  const { height: viewportHeight } = useWindowDimensions();
  const presence = useRef(new Animated.Value(0)).current;
  const cancelProgress = useRef(new Animated.Value(0)).current;
  // 退场期间冻结阶段与颜色，避免松手后红色遮罩先闪回蓝色再消失。
  if (visible) {
    visiblePhaseRef.current = phase;
    visibleCancelRef.current = canceling;
  }
  const displayCanceling = !!visibleCancelRef.current;

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
    const animation = Animated.timing(cancelProgress, {
      toValue: displayCanceling ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [cancelProgress, displayCanceling]);

  useEffect(() => {
    let animation;
    presence.stopAnimation();
    if (visible) {
      setRendered(true);
      cancelProgress.setValue(visibleCancelRef.current ? 1 : 0);
      animation = Animated.timing(presence, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    } else if (rendered) {
      animation = Animated.timing(presence, {
        toValue: 0,
        duration: 180,
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
  }, [cancelProgress, presence, visible]);

  if (!visible && !rendered) return null;
  const maskRise = presence.interpolate({ inputRange: [0, 1], outputRange: [viewportHeight * 0.18, 0] });
  const contentRise = presence.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const ink = displayCanceling ? tones.cancel.ink : tones.record.ink;
  const recognizing = visiblePhaseRef.current === 'recognizing';

  return (
    <Animated.View style={[styles.overlay, { opacity: presence }]} pointerEvents="none">
      <View style={styles.wash} />
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: maskRise }] }]}>
        {/* 两层都是半透明渐变，蓝层必须同步淡出，否则红层叠在蓝层上会混成紫色。 */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, cancelProgress) }]}>
          <GradientMask id="voice-mask-record" color={tones.record.color} strength={tones.record.strength} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: cancelProgress }]}>
          <GradientMask id="voice-mask-cancel" color={tones.cancel.color} strength={tones.cancel.strength} />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: contentRise }] }]}>
        {recognizing ? (
          <View style={styles.hintSlot}>
            <ActivityIndicator size="large" color={tones.record.ink} />
            <Text style={[styles.hintTxt, styles.loadingText, { color: tones.record.ink }]}>识别中</Text>
          </View>
        ) : (
          <>
            <View style={styles.hintSlot}>
              <Animated.Text
                style={[styles.hintTxt, { color: tones.record.ink, opacity: Animated.subtract(1, cancelProgress) }]}
              >
                松手发送，上滑取消
              </Animated.Text>
              <Animated.Text
                style={[styles.hintTxt, styles.hintStacked, { color: tones.cancel.ink, opacity: cancelProgress }]}
              >
                松手取消
              </Animated.Text>
            </View>
            <View style={styles.waveform}>
              <Waveform samples={samples} color={ink} />
            </View>
          </>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    // HomeHeader 在 Android 上有 elevation，必须提升遮罩层才能覆盖顶部 tabs。
    elevation: 50,
  },
  // 半透明底色压低背后卡片的干扰，顶部保持接近页面底色。
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.mode === 'dark' ? theme.bg : theme.surface,
    opacity: theme.mode === 'dark' ? 0.86 : 0.8,
  },
  // 文字和波形贴近底部，落在渐变最浓的区域内，而不是浅色的屏幕中部。
  hintSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 150,
    alignItems: 'center',
  },
  hintTxt: {
    ...type.content,
    fontWeight: '500',
    letterSpacing: 1,
    textAlign: 'center',
  },
  hintStacked: { position: 'absolute', top: 0, left: 0, right: 0 },
  loadingText: { marginTop: 16 },
  waveform: {
    position: 'absolute',
    bottom: 72,
    alignSelf: 'center',
    width: '72%',
    maxWidth: 320,
  },
});
