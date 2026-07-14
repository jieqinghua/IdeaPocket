import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme, type } from '../theme';

const TABS = [
  { key: 'stream', label: '记', icon: '🌱' },
  { key: 'compost', label: '堆肥', icon: '🌫️' },
  { key: 'sprout', label: '冒芽', icon: '🌿' },
];

export default function TabBar({ tab, onChange }) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const active = t.key === tab;
        return (
          <Pressable key={t.key} style={styles.tab} onPress={() => onChange(t.key)}>
            <Text style={[styles.icon, { opacity: active ? 1 : 0.35 }]}>{t.icon}</Text>
            <Text style={[styles.label, { color: active ? theme.ink : theme.inkSoft }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.surface,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20, marginBottom: 2 },
  label: { ...type.auxiliary },
});
