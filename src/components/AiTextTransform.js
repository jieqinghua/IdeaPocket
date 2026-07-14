import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { AI_TEXT_PHASE } from '../aiTextTransition';
import { theme, type } from '../theme';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
const SWEEP_WIDTH = 156;
const SWEEP_DURATION = 1250;
const SWEEP_PAUSE = 420;
const REVEAL_DURATION = 220;
const REDUCED_MOTION_DURATION = 120;
const RECOVERY_DURATION = 180;

export default function AiTextTransform({
  phase,
  sourceText,
  reduceMotion,
  onRevealComplete,
  onRecoveryComplete,
}) {
  const sweepProgress = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const [containerSize, setContainerSize] = useState({ width: 360, height: 112 });

  useEffect(() => {
    if (phase !== AI_TEXT_PHASE.PROCESSING) return undefined;
    overlayOpacity.setValue(1);
    sweepProgress.setValue(0);
    if (reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepProgress, {
          toValue: 1,
          duration: SWEEP_DURATION,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(SWEEP_PAUSE),
      ]),
      { resetBeforeIteration: true }
    );
    loop.start();
    return () => loop.stop();
  }, [overlayOpacity, phase, reduceMotion, sweepProgress]);

  useEffect(() => {
    if (phase !== AI_TEXT_PHASE.REVEALING) return undefined;
    const animation = Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: reduceMotion ? REDUCED_MOTION_DURATION : REVEAL_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onRevealComplete?.();
    });
    return () => animation.stop();
  }, [onRevealComplete, overlayOpacity, phase, reduceMotion]);

  useEffect(() => {
    if (phase !== AI_TEXT_PHASE.ERROR) return undefined;
    const animation = Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: reduceMotion ? REDUCED_MOTION_DURATION : RECOVERY_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onRecoveryComplete?.();
    });
    return () => animation.stop();
  }, [onRecoveryComplete, overlayOpacity, phase, reduceMotion]);

  const diagonal = Math.hypot(containerSize.width, containerSize.height);
  const sweepHeight = Math.max(240, diagonal * 0.9);
  const translateX = sweepProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, containerSize.width + SWEEP_WIDTH * 2],
  });
  const translateY = sweepProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, containerSize.height + sweepHeight * 0.82],
  });

  return (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setContainerSize({ width, height });
      }}
      style={styles.container}
    >
      <Text style={styles.text}>{sourceText}</Text>
      <Animated.View
        accessibilityLiveRegion={phase === AI_TEXT_PHASE.PROCESSING ? 'polite' : 'none'}
        accessibilityLabel={phase === AI_TEXT_PHASE.PROCESSING ? 'AI 正在润色笔记' : undefined}
        pointerEvents="none"
        style={[styles.overlay, { opacity: overlayOpacity }]}
      >
        {!reduceMotion && (
          <AnimatedLinearGradient
            colors={[
              'rgba(255,255,255,0)',
              'rgba(255,255,255,0.1)',
              'rgba(255,255,255,0.84)',
              'rgba(255,255,255,0.1)',
              'rgba(255,255,255,0)',
            ]}
            locations={[0, 0.22, 0.5, 0.78, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.sweep,
              {
                height: sweepHeight,
                top: -sweepHeight * 0.72,
                transform: [{ translateX }, { translateY }, { rotate: '45deg' }],
              },
            ]}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    minHeight: 112,
    overflow: 'hidden',
  },
  text: {
    ...type.detailBody,
    color: theme.ink,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: 'rgba(247,248,252,0.5)',
  },
  sweep: {
    position: 'absolute',
    left: -SWEEP_WIDTH,
    width: SWEEP_WIDTH,
    borderRadius: 999,
  },
});
