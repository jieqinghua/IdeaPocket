import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { metrics, radius, spacing, type, useAppTheme } from '../theme';

export default function ThemeEditor({ mode, item = {}, notes = [], onCancel, onSave }) {
  const theme = useAppTheme(); const styles = createStyles(theme);
  const [title, setTitle] = useState(item.title || '');
  const [scope, setScope] = useState(item.scope || '');
  const [summary, setSummary] = useState(item.summary || '');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const picking = mode === 'create' || mode === 'members';
  const choices = useMemo(() => notes.filter((note) => !note.deletedAt && !note.welcome && !note.demo &&
    (mode !== 'members' || !item.noteIds?.includes(note.id)) &&
    (!query.trim() || note.text.toLowerCase().includes(query.trim().toLowerCase()))), [notes, item.noteIds, mode, query]);
  const heading = { create: '创建主题', members: '加入笔记', scope: '编辑主题范围', summary: '编辑摘要', title: '修改主题名称' }[mode];
  const canSave = mode === 'create' ? !!title.trim() && selected.size > 0 : mode === 'members' ? selected.size > 0
    : !!({ title, scope, summary }[mode] || '').trim();
  const fields = <>
    {(mode === 'create' || mode === 'title') && <TextInput accessibilityLabel="主题名称" placeholder="主题名称" placeholderTextColor={theme.inkMuted}
      autoFocus value={title} onChangeText={setTitle} maxLength={80} style={styles.input} />}
    {(mode === 'create' || mode === 'scope') && <TextInput accessibilityLabel="主题范围" placeholder="包含什么？哪些内容归入其他主题？" placeholderTextColor={theme.inkMuted}
      autoFocus={mode === 'scope'} value={scope} onChangeText={setScope} multiline maxLength={1200} style={[styles.input, styles.multiline]} />}
    {mode === 'summary' && <TextInput accessibilityLabel="主题摘要" autoFocus value={summary} onChangeText={setSummary} multiline maxLength={3000} style={[styles.input, styles.summary]} />}
  </>;
  const pickerHeader = <View>
    {fields}
    <Text style={styles.hint}>{mode === 'create' ? '至少选择一条笔记；创建后默认由你决定成员。' : '选择要加入的笔记，已有成员不在列表中。'}</Text>
    <TextInput accessibilityLabel="搜索可加入的笔记" placeholder="搜索笔记" placeholderTextColor={theme.inkMuted} value={query} onChangeText={setQuery} style={styles.input} />
  </View>;
  return <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.panel}>
        <Text style={styles.heading}>{heading}</Text>
        {picking ? <FlatList data={choices} keyExtractor={(note) => note.id} keyboardShouldPersistTaps="handled" style={styles.choices}
          ListHeaderComponent={pickerHeader} ListEmptyComponent={<Text style={styles.hint}>没有可选择的笔记</Text>}
          renderItem={({ item: note }) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected.has(note.id) }}
            accessibilityLabel={`选择笔记：${note.text.slice(0, 40)}`} style={[styles.choice, selected.has(note.id) && styles.selected]}
            onPress={() => setSelected((current) => { const next = new Set(current); if (next.has(note.id)) next.delete(note.id); else next.add(note.id); return next; })}>
            <Text style={styles.text} numberOfLines={3}>{note.text}</Text>
            {selected.has(note.id) && <Text style={styles.action}>已选择</Text>}
          </Pressable>} />
          : <ScrollView keyboardShouldPersistTaps="handled" style={styles.form}>{fields}</ScrollView>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="取消主题修改" onPress={onCancel} style={styles.button}><Text style={styles.action}>取消</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="保存主题修改" accessibilityState={{ disabled: !canSave }} disabled={!canSave} style={[styles.button, !canSave && styles.disabled]}
            onPress={() => onSave({ title: title.trim(), scope: scope.trim(), summary: summary.trim(), ids: [...selected] })}>
            <Text style={styles.action}>{picking ? `保存（${selected.size} 条）` : '保存'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const createStyles = (theme) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.page, backgroundColor: theme.scrim || 'rgba(0,0,0,0.45)' },
  panel: { maxHeight: '90%', padding: spacing.page, borderRadius: radius.card, backgroundColor: theme.surface },
  heading: { ...type.sectionTitle, color: theme.ink, marginBottom: spacing.sm, fontWeight: '700' },
  input: { ...type.content, color: theme.ink, borderColor: theme.cardLine, borderWidth: 1, borderRadius: radius.control, padding: spacing.sm, minHeight: metrics.minTouch, marginBottom: spacing.sm },
  multiline: { minHeight: 90, maxHeight: 140, textAlignVertical: 'top' }, summary: { minHeight: 180, maxHeight: 320, textAlignVertical: 'top' },
  hint: { ...type.auxiliary, color: theme.inkSoft, marginBottom: spacing.sm },
  choices: { maxHeight: 450, flexGrow: 0, flexShrink: 1 },
  form: { flexGrow: 0, flexShrink: 1 },
  choice: { padding: spacing.sm, marginBottom: spacing.xs, borderWidth: 1, borderColor: theme.cardLine, borderRadius: radius.control },
  selected: { borderColor: theme.brand, backgroundColor: theme.accentSoft },
  text: { ...type.content, color: theme.ink }, action: { ...type.content, color: theme.brand, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  button: { minHeight: metrics.minTouch, minWidth: 70, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm }, disabled: { opacity: 0.4 },
});
