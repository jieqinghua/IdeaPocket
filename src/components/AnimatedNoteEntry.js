import { useLayoutEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export const NEW_NOTE_ANIMATION_MS = 540;

export default function AnimatedNoteEntry({ animate, children }) {
  const scale = useRef(new Animated.Value(animate ? 0.68 : 1)).current;
  const opacity = useRef(new Animated.Value(animate ? 0.35 : 1)).current;

  useLayoutEffect(() => {
    if (!animate) {
      scale.setValue(1);
      opacity.setValue(1);
      return undefined;
    }
    // The entry can already be mounted while the list scrolls back to the top.
    // Reset here so a later false → true transition still plays from its start.
    scale.setValue(0.68);
    opacity.setValue(0.35);
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
