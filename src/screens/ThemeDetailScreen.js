import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DetailPageHeader from '../components/DetailPageHeader';
import ThemeEditor from '../components/ThemeEditor';
import { formatNoteDate, hasAiTidy } from '../presentation';
import { textHash } from '../themeModel';
import { metrics, radius, shadow, spacing, type, useAppTheme } from '../theme';

const sourceLabel = (source) => ({ ai: 'AI 摘要', local: '本地来源摘录', manual: '你编辑的摘要', legacy: '旧版摘要' }[source] || '摘要');
export default function ThemeDetailScreen({ theme: item, store, onBack, onRename, onRemoveNote, onDissolve, onRetain }) {
  const theme = useAppTheme(); const styles = createStyles(theme);
  const [editor, setEditor] = useState(null);
  const [rawIds, setRawIds] = useState(new Set());
  const [historyExpanded, setHistoryExpanded] = useState(false);
  useEffect(() => { setEditor(null); setRawIds(new Set()); setHistoryExpanded(false); }, [item.id]);
  const historical = item.status === 'history'; const hidden = item.status === 'dismissed';
  const editable = !historical && !hidden;
  const notes = [...item.notes].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const suggestions = Object.entries(item.suggestions || {}).map(([id, relation]) => ({ note: store?.notes?.find((note) => note.id === id), relation })).filter(({ note }) => note);
  const canUndo = store?.themeUndoActions?.some((action) => action.themeId === item.id);
  const action = (label, callback, destructive = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={callback} style={styles.inlineActionButton}><Text style={destructive ? styles.removeText : styles.inlineAction}>{label}</Text></Pressable>;
  const remove = (id) => Alert.alert('移出这条笔记？', '笔记会继续保留，自动整理会记住这项排除。可以手动加回或撤销。', [
    { text: '取消', style: 'cancel' }, { text: '移出', style: 'destructive', onPress: () => onRemoveNote?.(item.id, id) },
  ]);
  const hide = () => Alert.alert('隐藏这个主题？', '笔记会继续保留，可从已隐藏主题中恢复。隐藏期间只接收建议。', [
    { text: '取消', style: 'cancel' }, { text: '隐藏', onPress: () => { onDissolve?.(item.id); onBack?.(); } },
  ]);
  const save = ({ title, scope, summary, ids }) => {
    if (editor === 'title') onRename?.(item.id, title);
    if (editor === 'scope') store?.updateThemeScope(item.id, scope);
    if (editor === 'summary') store?.updateThemeSummary(item.id, summary);
    if (editor === 'members') store?.addThemeNotes(item.id, ids);
    setEditor(null);
  };
  return <View style={styles.root}>
    <DetailPageHeader title="主题详情" backLabel="返回主题列表" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.titleRow}><Text style={styles.title}>{item.title}</Text>{editable && action('改名', () => setEditor('title'))}</View>
      <Text style={styles.meta}>{notes.length} 条笔记 · {item.management === 'user' ? '由你管理' : item.maturity === 'candidate' ? '候选主题' : '自动主题'} · 更新于 {formatNoteDate(item.updatedAt)}</Text>
      {editable && store && <View style={styles.controlCard}>
        <View style={styles.titleRow}><Text style={styles.controlText}>自动加入相关笔记</Text><Switch accessibilityLabel="自动加入相关笔记" value={!!item.autoJoin} onValueChange={(value) => store.setThemeAutoJoin(item.id, value)} trackColor={{ true: theme.brand }} /></View>
        <Text style={styles.meta}>{item.autoJoin ? '明确相关时加入，弱关联与本地粗匹配显示建议。' : '新笔记只显示加入建议，由你决定成员。'}</Text>
        <View style={styles.actions}>{item.management !== 'user' && action('保留为我的主题', () => onRetain?.(item.id))}{canUndo && action('撤销最近调整', () => store.undoTheme(item.id))}</View>
      </View>}
      <View style={styles.controlCard}>
        <View style={styles.titleRow}><Text style={styles.summaryLabel}>主题范围</Text>{editable && store && action('编辑范围', () => setEditor('scope'))}</View>
        <Text style={styles.summary}>{item.scope || '尚未说明，可补充包含的对象、问题或目标。'}</Text>
      </View>
      <View style={styles.summaryCard}>
        <View style={styles.summaryLabelRow}><Ionicons name={item.summarySource === 'ai' ? 'sparkles' : 'document-text-outline'} size={metrics.smallIcon} color={theme.brand} /><Text style={styles.summaryLabel}>{sourceLabel(item.summarySource)}{item.summaryMode === 'manual' && item.summarySource !== 'manual' ? ' · 由你确认' : ''}</Text></View>
        <Text style={styles.summary}>{item.summary || '尚未生成摘要'}</Text>
        {!!item.summaryNotice && <Text style={styles.stale}>{item.summaryNotice}</Text>}
        {item.summaryStale && <Text style={styles.stale}>来源或成员已变化，摘要待更新。</Text>}
        {editable && store && <View style={styles.actions}>{action('编辑摘要', () => setEditor('summary'))}{action(store.themeStatus === 'running' ? '正在整理…' : '更新摘要', () => store.refreshThemeSummary(item.id))}</View>}
        {!!item.summaryCandidate && <View style={styles.rawPanel}><Text style={styles.summaryLabel}>更新候选 · {sourceLabel(item.summaryCandidate.source)}</Text><Text style={styles.summary}>{item.summaryCandidate.text}</Text>{editable && action('采用这份摘要', () => store?.adoptThemeSummary(item.id))}<Text style={styles.meta}>未采用前保留你编辑的摘要。</Text></View>}
      </View>
      {!!suggestions.length && <><Text style={styles.sectionTitle}>加入建议</Text>{suggestions.map(({ note, relation }) => <View key={note.id} style={styles.noteCard}>
        <Text style={styles.noteText}>{note.text}</Text><Text style={styles.meta}>{relation.reason}</Text>
        {!!relation.evidence && <Text style={styles.meta}>依据：{relation.evidence}</Text>
        }{relation.fingerprint && relation.fingerprint !== textHash(note.text) && <Text style={styles.stale}>正文已修改，建议待重新检查。</Text>}{editable && action('加入此笔记', () => store?.addThemeNote(item.id, note.id))}
      </View>)}</>}
      <View style={styles.actions}><Text style={styles.sectionTitle}>来源笔记</Text>{editable && store && action('加入笔记', () => setEditor('members'))}</View>
      <Text style={styles.sectionHint}>按记录时间排列，可核对归属与摘要。</Text>
      {notes.map((note) => { const relation = item.relations?.[note.id]; const raw = hasAiTidy(note); return <View key={note.id} style={styles.noteCard}>
        <Text style={styles.noteText}>{note.text}</Text>
        {relation && <View style={styles.rawPanel}><Text style={styles.rawLabel}>{relation.source === 'manual' ? '手动加入' : relation.source === 'local' ? '本地相关性' : 'AI 归属理由'}</Text><Text style={styles.meta}>{relation.reason}</Text>{!!relation.evidence && <Text style={styles.rawText}>“{relation.evidence}”</Text>}{relation.fingerprint && relation.fingerprint !== textHash(note.text) && <Text style={styles.stale}>正文已修改，归属依据待重新检查。</Text>}</View>}
        {raw && rawIds.has(note.id) && <View style={styles.rawPanel}><Text style={styles.rawLabel}>原始转写</Text><Text style={styles.rawText}>{note.rawText}</Text></View>}
        <View style={styles.noteFooter}><Text style={styles.noteMeta}>{formatNoteDate(note.createdAt)} · {note.source === 'voice' ? '语音' : '文字'}</Text>{raw && action(rawIds.has(note.id) ? '收起原文' : '查看原文', () => setRawIds((current) => { const next = new Set(current); if (next.has(note.id)) next.delete(note.id); else next.add(note.id); return next; }))}{editable && action('移出', () => remove(note.id), true)}</View>
      </View>; })}
      {historical && <Text style={styles.meta}>这是旧版主题记录。旧数据没有保存当时正文，下面的笔记是当前内容。</Text>}
      {!!item.revisions?.length && <>
        {action(`变化记录（${item.revisions.length}）${historyExpanded ? ' · 收起' : ' · 展开'}`, () => setHistoryExpanded((value) => !value))}
        {historyExpanded && [...item.revisions].reverse().map((version) => <View key={version.versionId} style={styles.noteCard}>
          <Text style={styles.summaryLabel}>{version.reason} · {formatNoteDate(version.recordedAt)}</Text><Text style={styles.noteText}>{version.title}</Text><Text style={styles.meta}>范围：{version.scope || '未设置'}</Text><Text style={styles.summary}>{sourceLabel(version.summarySource)}：{version.summary || '未生成'}</Text>
          {version.summaryStale && <Text style={styles.stale}>这一版摘要处于待更新状态。</Text>}
          {version.legacyHistory ? <Text style={styles.meta}>旧记录缺少当时正文版本，无法还原来源。</Text> : version.noteIds.map((id) => {
            const source = store?.themeSnapshots?.[version.sourceRefs?.[id]];
            return <View key={id} style={styles.rawPanel}><Text style={styles.rawText}>{source?.text || '这一条来源版本不可用'}</Text>{!!source?.rawText && source.rawText !== source.text && <Text style={styles.meta}>原始转写：{source.rawText}</Text>}</View>;
          })}
        </View>)}
      </>}
      {(historical || hidden) && <Pressable accessibilityRole="button" onPress={() => { if (hidden) store?.restoreTheme(item.id); else onRetain?.(item.id); }} style={styles.retainButton}><Text style={styles.retainText}>{hidden ? '恢复主题' : '保留并继续管理'}</Text></Pressable>}
      {hidden && store && <View style={styles.controlCard}><View style={styles.titleRow}><Text style={styles.controlText}>不再建议此方向</Text><Switch accessibilityLabel="不再建议此方向" value={!!item.suppressed} onValueChange={(value) => store.suppressTheme(item.id, value)} /></View><Text style={styles.meta}>开启后抑制相近内容的建议；恢复主题时会解除。</Text></View>}
      {!hidden && <Pressable accessibilityRole="button" onPress={hide} style={styles.dissolveButton}><Text style={styles.dissolveText}>隐藏主题</Text></Pressable>}
    </ScrollView>
    {!!editor && <ThemeEditor mode={editor} item={item} notes={store?.notes || []} onCancel={() => setEditor(null)} onSave={save} />}
  </View>;
}

const createStyles = (theme) => StyleSheet.create({
  controlCard: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.card, backgroundColor: theme.surface },
  controlText: { ...type.content, flex: 1, color: theme.ink },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  stale: { ...type.auxiliary, color: theme.inkSoft, marginTop: spacing.sm },
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
