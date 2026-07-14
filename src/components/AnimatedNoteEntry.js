import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export const NEW_NOTE_ANIMATION_MS = 540;

export default function AnimatedNoteEntry({ animate, children }) {
  const scale = useRef(new Animated.Value(animate ? 0.68 : 1)).current;
  const opacity = useRef(new Animated.Value(animate ? 0.35 : 1)).current;

  useEffect(() => {
    if (!animate) {
      scale.setValue(1);
      opacity.setValue(1);
      return undefined;
    }
    const animation = Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: NEW_NOTE_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: NEW_NOTE_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animate, opacity, scale]);

  return <Animated.View style={{ opacity, transform: [{ scale }] }}>{children}</Animated.View>;
}
