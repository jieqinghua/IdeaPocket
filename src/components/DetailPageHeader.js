import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { metrics, spacing, theme, type } from '../theme';

export default function DetailPageHeader({
  title,
  backLabel,
  onBack,
  rightLabel,
  rightAccessibilityLabel,
  rightDisabled = false,
  onRightPress,
  rightIcon,
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={24} color={theme.ink} />
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>{title}</Text>
      {rightLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rightAccessibilityLabel || rightLabel}
          accessibilityState={{ disabled: rightDisabled }}
          disabled={rightDisabled}
          onPress={onRightPress}
          style={({ pressed }) => [
            styles.rightButton,
            rightDisabled && styles.rightDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.rightText, rightDisabled && styles.rightTextDisabled]}>{rightLabel}</Text>
        </Pressable>
      ) : rightIcon ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rightAccessibilityLabel || rightIcon}
          onPress={onRightPress}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name={rightIcon} size={metrics.standardIcon} color={theme.ink} />
        </Pressable>
      ) : (
        <View style={styles.iconButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    backgroundColor: theme.bg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: metrics.minTouch,
    height: metrics.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...type.pageTitle,
    flex: 1,
    color: theme.ink,
    fontWeight: '600',
    textAlign: 'center',
  },
  rightButton: {
    minWidth: metrics.minTouch,
    height: metrics.minTouch,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightText: {
    ...type.content,
    color: theme.brand,
    fontWeight: '700',
  },
  rightDisabled: { opacity: 0.42 },
  rightTextDisabled: { color: theme.inkSoft },
  pressed: { opacity: 0.58 },
});
