import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import NoteCard from '../components/NoteCard';
import { heatOf, isComposted } from '../heat';
import { matchesNoteQuery } from '../search';
import { loadMeta, saveMeta } from '../storage';
import { theme } from '../theme';

export default function CompostScreen({ store, onOpenNote }) {
  const now = Date.now();
  const [q, setQ] = useState('');
  const [activeActionsNoteId, setActiveActionsNoteId] = useState(null);
  const query = q.trim().toLowerCase();
  const hasDemo = store.notes.some((note) => note.demo);

  const loadDemo = async () => {
    store.seedDemo();
    const meta = await loadMeta();
    saveMeta({ ...meta, sproutDismissed: null });
  };

  const composted = store.notes
    .filter((n) => isComposted(n, now))
    .filter((n) => matchesNoteQuery(n, query))
    .sort((a, b) => heatOf(b, now) - heatOf(a, now));

  return (
    <View
      style={styles.flex}
      onTouchStart={() => {
        if (activeActionsNoteId) setActiveActionsNoteId(null);
      }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>堆肥</Text>
        <Text style={styles.sub}>淡出了视野，但没丢。一浇水就活过来。</Text>
        {__DEV__ && (
          <Pressable
            style={styles.demoButton}
            onPress={hasDemo ? store.clearDemo : loadDemo}
          >
            <Ionicons
              name={hasDemo ? 'trash-outline' : 'flask-outline'}
              size={14}
              color={theme.accent}
            />
            <Text style={styles.demoButtonText}>
              {hasDemo ? '清除演示数据' : '载入演示数据'}
            </Text>
          </Pressable>
        )}
      </View>
      <TextInput
        style={styles.search}
        value={q}
        onChangeText={setQ}
        placeholder="在土里翻找…"
        placeholderTextColor={theme.inkSoft}
      />
      <FlatList
        contentContainerStyle={composted.length ? styles.list : styles.emptyWrap}
        data={composted}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NoteCard
            note={item}
            onDelete={store.remove}
            onOpenDetail={onOpenNote}
            actionsOpen={activeActionsNoteId === item.id}
            onActionsOpen={() => setActiveActionsNoteId(item.id)}
            onActionsClose={() => setActiveActionsNoteId(null)}
          />
        )}
        keyboardShouldPersistTaps="handled"
        onTouchStart={() => {
          if (activeActionsNoteId) setActiveActionsNoteId(null);
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query ? '土里没找到这个。' : '堆肥还是空的。\n\n记点东西，让时间替你筛选。'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: theme.ink },
  sub: { fontSize: 13, color: theme.inkSoft, marginTop: 2 },
  demoButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingVertical: 4,
  },
  demoButtonText: { color: theme.accent, fontSize: 12, fontWeight: '600' },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    color: theme.ink,
    fontSize: 15,
  },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: { color: theme.inkSoft, fontSize: 15, lineHeight: 24, textAlign: 'center' },
});
