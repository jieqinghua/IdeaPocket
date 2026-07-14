import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DetailPageHeader from '../components/DetailPageHeader';
import { formatNoteDate, hasAiTidy } from '../presentation';
import { metrics, radius, shadow, spacing, theme, type } from '../theme';

export default function ThemeDetailScreen({
  theme: themeItem,
  onBack,
  onRename,
  onRemoveNote,
  onDissolve,
  onRetain,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(themeItem.title);
  const [expandedRawIds, setExpandedRawIds] = useState(new Set());

  useEffect(() => {
    setTitle(themeItem.title);
    setEditingTitle(false);
    setExpandedRawIds(new Set());
  }, [themeItem.id, themeItem.title]);

  const notes = [...themeItem.notes].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const historical = themeItem.status === 'history';

  const saveTitle = () => {
    const value = title.trim();
    if (value && value !== themeItem.title) onRename?.(themeItem.id, value);
    else setTitle(themeItem.title);
    setEditingTitle(false);
  };

  const confirmRemove = (noteId) => {
    Alert.alert('移出这条笔记？', '笔记本身不会被删除，这项调整只作用于当前主题。', [
      { text: '取消', style: 'cancel' },
      { text: '移出', style: 'destructive', onPress: () => onRemoveNote?.(themeItem.id, noteId) },
    ]);
  };

  const confirmDissolve = () => {
    Alert.alert('解散这个主题？', '所有原始笔记都会保留，后续分析会避免重新生成近似主题。', [
      { text: '取消', style: 'cancel' },
      {
        text: '解散主题',
        style: 'destructive',
        onPress: () => {
          onDissolve?.(themeItem.id);
          onBack?.();
        },
      },
    ]);
  };

  const toggleRaw = (noteId) => {
    setExpandedRawIds((current) => {
      const next = new Set(current);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <DetailPageHeader title="主题详情" backLabel="返回主题列表" onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={styles.titleRow}>
          {editingTitle ? (
            <TextInput
              autoFocus
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={saveTitle}
              maxLength={18}
              returnKeyType="done"
              style={styles.titleInput}
            />
          ) : (
            <Text style={styles.title}>{themeItem.title}</Text>
          )}
          {!historical && <Pressable
            accessibilityRole="button"
            accessibilityLabel={editingTitle ? '保存主题名称' : '修改主题名称'}
            onPress={editingTitle ? saveTitle : () => setEditingTitle(true)}
            style={styles.editButton}
          >
            <Text style={styles.editText}>{editingTitle ? '保存' : '改名'}</Text>
          </Pressable>}
        </View>
        <Text style={styles.meta}>{notes.length} 条笔记 · 更新于 {formatNoteDate(themeItem.updatedAt)}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryLabelRow}>
            <Ionicons name="sparkles" size={metrics.smallIcon} color={theme.brand} />
            <Text style={styles.summaryLabel}>AI 核心总结</Text>
          </View>
          <Text style={styles.summary}>{themeItem.summary}</Text>
        </View>

        <Text style={styles.sectionTitle}>原始笔记</Text>
        <Text style={styles.sectionHint}>按记录时间排列，所有总结都可以回到这些来源核对。</Text>

        {notes.map((note) => {
          const hasRaw = hasAiTidy(note);
          const rawExpanded = expandedRawIds.has(note.id);
          return (
            <View key={note.id} style={styles.noteCard}>
              <Text style={styles.noteText}>{note.text}</Text>
              {hasRaw && rawExpanded && (
                <View style={styles.rawPanel}>
                  <Text style={styles.rawLabel}>原始转写</Text>
                  <Text style={styles.rawText}>{note.rawText}</Text>
                </View>
              )}
              <View style={styles.noteFooter}>
                <Text style={styles.noteMeta}>
                  {formatNoteDate(note.createdAt)} · {note.source === 'voice' ? '语音' : '文字'}
                </Text>
                {hasRaw && (
                  <Pressable accessibilityRole="button" onPress={() => toggleRaw(note.id)} style={styles.inlineActionButton}>
                    <Text style={styles.inlineAction}>{rawExpanded ? '收起原文' : '查看原文'}</Text>
                  </Pressable>
                )}
                {!historical && <Pressable accessibilityRole="button" onPress={() => confirmRemove(note.id)} style={styles.inlineActionButton}>
                  <Text style={styles.removeText}>移出</Text>
                </Pressable>}
              </View>
            </View>
          );
        })}

        {historical && (
          <Pressable accessibilityRole="button" onPress={() => { onRetain?.(themeItem.id); onBack?.(); }} style={styles.retainButton}>
            <Text style={styles.retainText}>保留</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={confirmDissolve} style={styles.dissolveButton}>
          <Text style={styles.dissolveText}>解散主题</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: spacing.page, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.pageTitle, flex: 1, color: theme.ink, fontWeight: '700' },
  titleInput: { ...type.pageTitle, flex: 1, minHeight: metrics.minTouch, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: theme.accent, borderRadius: radius.control, backgroundColor: theme.surface, color: theme.ink, fontWeight: '700' },
  editButton: { minWidth: metrics.standardButton, minHeight: metrics.minTouch, alignItems: 'center', justifyContent: 'center' },
  editText: { ...type.content, color: theme.brand, fontWeight: '700' },
  meta: { ...type.auxiliary, marginTop: spacing.xs, color: theme.inkSoft },
  summaryCard: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.card, backgroundColor: theme.accentSoft },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  summaryLabel: { ...type.auxiliary, color: theme.brand, fontWeight: '700' },
  summary: { ...type.content, marginTop: spacing.sm, color: theme.ink },
  sectionTitle: { ...type.sectionTitle, marginTop: spacing.xl, color: theme.ink, fontWeight: '700' },
  sectionHint: { ...type.auxiliary, marginTop: spacing.xs, marginBottom: spacing.md, color: theme.inkSoft },
  noteCard: { ...shadow.card, marginBottom: spacing.md, padding: spacing.page, borderWidth: 0, borderRadius: radius.card, backgroundColor: theme.surface },
  noteText: { ...type.content, color: theme.ink },
  rawPanel: { marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.control, backgroundColor: theme.accentSoft },
  rawLabel: { ...type.auxiliary, color: theme.brand, fontWeight: '700' },
  rawText: { ...type.content, marginTop: spacing.xs, color: theme.ink },
  noteFooter: { minHeight: metrics.minTouch, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noteMeta: { ...type.auxiliary, flex: 1, color: theme.inkSoft },
  inlineActionButton: { minHeight: metrics.minTouch, paddingHorizontal: spacing.xxs, alignItems: 'center', justifyContent: 'center' },
  inlineAction: { ...type.auxiliary, color: theme.brand, fontWeight: '600' },
  removeText: { ...type.auxiliary, color: theme.destructive, fontWeight: '600' },
  dissolveButton: { minHeight: metrics.standardButton, marginTop: spacing.lg, borderWidth: 1, borderColor: theme.cardLine, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  dissolveText: { ...type.content, color: theme.destructive, fontWeight: '700' },
  retainButton: { minHeight: metrics.standardButton, marginTop: spacing.lg, borderRadius: radius.control, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  retainText: { ...type.content, color: theme.onBrand, fontWeight: '700' },
});
