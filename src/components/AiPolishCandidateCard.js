import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { metrics, radius, spacing, theme, type } from '../theme';

const ENTER_DURATION = 280;
const REDUCED_MOTION_DURATION = 120;

export default function AiPolishCandidateCard({
  text,
  reduceMotion,
  onCancel,
  onConfirm,
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 8)).current;
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.99)).current;

  useEffect(() => {
    const duration = reduceMotion ? REDUCED_MOTION_DURATION : ENTER_DURATION;
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion, scale, translateY]);

  return (
    <Animated.View
      accessibilityLabel="AI 润色候选稿"
      style={[styles.glow, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      <LinearGradient
        colors={['rgba(117,185,255,0.62)', 'rgba(161,143,255,0.58)', 'rgba(221,198,255,0.42)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.border}
      >
        <View style={styles.card}>
          <Text style={styles.text}>{text}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="取消 AI 润色结果"
              onPress={onCancel}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>取消</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="替换原文为 AI 润色结果"
              onPress={onConfirm}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>替换原文</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    marginBottom: spacing.lg,
    borderRadius: radius.card,
    shadowColor: '#8A7CF5',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  border: {
    padding: 1,
    borderRadius: radius.card,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.card - 1,
    backgroundColor: theme.surface,
  },
  text: {
    ...type.detailBody,
    color: theme.ink,
  },
  actions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    minHeight: metrics.minTouch,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F4FA',
  },
  secondaryText: {
    ...type.content,
    color: theme.ink,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    minHeight: metrics.minTouch,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.brand,
  },
  primaryText: {
    ...type.content,
    color: theme.onBrand,
    fontWeight: '700',
  },
  pressed: { opacity: 0.62 },
});
