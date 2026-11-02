import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  buildThemeCards,
  formatRelativeThemeDate,
  getThemeCardVisual,
  getThemeGeneratedAt,
} from '../presentation';
import ThemeEditor from '../components/ThemeEditor';
import { metrics, radius, shadow, spacing, type, useAppTheme } from '../theme';

const statusOf = (item) => item.status || (item.dismissed ? 'dismissed' : 'current');
const CARD_SCROLL_SLOP = 8;

function ThemeCard({ item, historical = false, hidden = false, onOpen, onRetain, onDissolve }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const pressStartY = useRef(null);
  const movedDuringPress = useRef(false);
  const visual = getThemeCardVisual(item.title, item.summary, theme.mode);
  const generatedLabel = formatRelativeThemeDate(getThemeGeneratedAt(item));
  const retained = statusOf(item) === 'retained';
  const trackTouchStart = (event) => {
    pressStartY.current = event.nativeEvent.pageY;
    movedDuringPress.current = false;
  };
  const trackTouchMove = (event) => {
    if (pressStartY.current === null) return;
    if (Math.abs(event.nativeEvent.pageY - pressStartY.current) > CARD_SCROLL_SLOP) {
      movedDuringPress.current = true;
    }
  };
  const openCard = () => {
    if (movedDuringPress.current) return;
    onOpen?.(item.id);
  };
  const body = (
      <View style={styles.cardHeader}>
        <View style={[styles.iconTile, { backgroundColor: visual.backgroundColor }]}>
          <Ionicons name={visual.icon} size={22} color={visual.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.title}>{item.title}</Text>
            {(retained || item.maturity === 'candidate') && <Text style={styles.retainedTag}>{retained ? '由你管理' : '候选'}</Text>}
          </View>
          <Text numberOfLines={3} ellipsizeMode="tail" style={styles.summary}>{item.summary || item.scope || '等待生成摘要'}</Text>
          {item.summaryStale && <Text style={styles.meta}>摘要待更新</Text>}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="document-text-outline" size={metrics.smallIcon} color={theme.inkSoft} />
              <Text style={styles.meta}>{item.notes.length} 条笔记</Text>
            </View>
            {!!generatedLabel && <Text style={styles.meta}> · {generatedLabel} 生成</Text>}
          </View>
        </View>
      </View>
  );

  if (!historical && !hidden) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`打开主题：${item.title}，共 ${item.notes.length} 条笔记`}
        onTouchStart={trackTouchStart}
        onTouchMove={trackTouchMove}
        onPress={openCard}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, styles.historyCard]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`打开主题记录：${item.title}，共 ${item.notes.length} 条笔记`}
        onTouchStart={trackTouchStart}
        onTouchMove={trackTouchMove}
        onPress={openCard}
        style={({ pressed }) => pressed && styles.cardPressed}
      >
        {body}
      </Pressable>
      <View style={styles.historyActions}>
        <Pressable accessibilityRole="button" onPress={() => onRetain?.(item.id)} style={styles.historyAction}>
          <Text style={styles.keepText}>{hidden ? '恢复' : '保留'}</Text>
        </Pressable>
        {!hidden && <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert('隐藏这个主题？', '原始笔记会继续保留，可以在隐藏主题中恢复。', [
            { text: '取消', style: 'cancel' },
            { text: '隐藏', style: 'destructive', onPress: () => onDissolve?.(item.id) },
          ])}
          style={styles.historyAction}
        >
          <Text style={styles.dissolveText}>隐藏</Text>
        </Pressable>}
      </View>
    </View>
  );
}

export default function ThemesScreen({ store, onOpenTheme, onScroll, contentTopInset = 0, initialScrollOffset = 0 }) {
  const theme = useAppTheme(); const styles = createStyles(theme);
  const suppressCardPressUntil = useRef(0);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [hiddenExpanded, setHiddenExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const cards = useMemo(() => buildThemeCards(store.themes, store.notes, { includeHidden: true }), [store.notes, store.themes]);
  const mature = cards.filter((item) => ['current', 'retained'].includes(statusOf(item)));
  const candidates = cards.filter((item) => statusOf(item) === 'candidate');
  const history = cards.filter((item) => statusOf(item) === 'history');
  const hidden = cards.filter((item) => statusOf(item) === 'dismissed');
  const running = store.themeStatus === 'running';
  const rows = [...mature];
  if (candidates.length) rows.push({ id: 'section-candidates', section: `候选主题（${candidates.length}）` }, ...candidates);
  if (historyExpanded && history.length) rows.push({ id: 'section-history', section: '旧主题记录' }, ...history);
  if (hiddenExpanded && hidden.length) rows.push({ id: 'section-hidden', section: '已隐藏主题' }, ...hidden);
  const openTheme = (id) => { if (Date.now() >= suppressCardPressUntil.current) onOpenTheme?.(id); };
  const toggleAuto = (enabled) => {
    if (!enabled) { store.setAutoThemes(false); return; }
    Alert.alert('开启自动整理', '保存或修改笔记后会自动分析。配置 DeepSeek 后，相关笔记片段会发送给该服务；未配置时使用本地相关性。引导和演示笔记不参与。你可以随时暂停和纠正归属。', [
      { text: '取消', style: 'cancel' }, { text: '开启', onPress: () => store.setAutoThemes(true) },
    ]);
  };
  const header = <View style={styles.controlPanel}>
    <View style={styles.listHeader}>
      <Text style={styles.title}>自动整理笔记</Text>
      <Switch accessibilityLabel="自动整理笔记" value={!!store.autoThemesEnabled} onValueChange={toggleAuto} trackColor={{ true: theme.brand }} />
    </View>
    <Text accessibilityLiveRegion="polite" style={styles.listHint}>{running ? '正在整理相关笔记…' : store.themeError || store.themeNotice ||
      (store.pendingThemeCount ? `${store.pendingThemeCount} 条笔记待处理` : store.autoThemesEnabled ? '新增和修改后会自动整理' : '自动整理已暂停，可手动检查')}</Text>
    <Text style={styles.listHint}>配置 DeepSeek 后会发送相关文字片段；未配置时使用本地相关性，图片不参与。</Text>
    <View style={styles.toolbar}>
      {running ? <Pressable accessibilityRole="button" onPress={store.cancelThemeAnalysis} style={styles.refreshButton}><Text style={styles.refreshText}>暂停本轮</Text></Pressable>
        : <Pressable accessibilityRole="button" accessibilityState={{ disabled: !store.analysisNoteCount }} disabled={!store.analysisNoteCount}
          onPress={(store.pendingThemeCount || store.pendingThemeSummaryCount) ? store.continueThemeAnalysis : store.analyzeThemes} style={styles.refreshButton}>
          <Text style={styles.refreshText}>{(store.pendingThemeCount || store.pendingThemeSummaryCount) ? '处理待整理笔记' : '检查全部笔记'}</Text>
        </Pressable>}
      <Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={styles.refreshButton}><Text style={styles.refreshText}>创建主题</Text></Pressable>
    </View>
    {!!history.length && <Pressable accessibilityRole="button" accessibilityState={{ expanded: historyExpanded }} style={styles.historyToggle} onPress={() => setHistoryExpanded((value) => !value)}>
      <Text style={styles.historyToggleText}>旧主题记录（{history.length}）{historyExpanded ? ' · 收起' : ' · 展开'}</Text>
    </Pressable>}
    {!!hidden.length && <Pressable accessibilityRole="button" accessibilityLabel={hiddenExpanded ? '收起已隐藏主题' : '展开已隐藏主题'} accessibilityState={{ expanded: hiddenExpanded }} style={styles.historyToggle} onPress={() => setHiddenExpanded((value) => !value)}>
      <Text style={styles.historyToggleText}>已隐藏主题（{hidden.length}）{hiddenExpanded ? ' · 收起' : ' · 展开'}</Text>
    </Pressable>}
  </View>;
  return <>
    <FlatList style={styles.flex} removeClippedSubviews={false} contentContainerStyle={[styles.list, { paddingTop: contentTopInset }]}
      data={rows} contentOffset={{ x: 0, y: Math.max(0, initialScrollOffset) }} onScroll={onScroll}
      onScrollBeginDrag={() => { suppressCardPressUntil.current = Date.now() + 250; }} scrollEventThrottle={16}
      keyExtractor={(item) => item.id} ListHeaderComponent={header}
      renderItem={({ item }) => item.section ? <Text style={styles.sectionHeading}>{item.section}</Text> : <ThemeCard item={item}
        historical={statusOf(item) === 'history'} hidden={statusOf(item) === 'dismissed'} onOpen={openTheme}
        onRetain={statusOf(item) === 'dismissed' ? store.restoreTheme : store.retainTheme} onDissolve={store.dismissTheme} />}
      ListEmptyComponent={<View style={styles.empty}>
        <Ionicons name="sparkles-outline" size={28} color={theme.brand} />
        <Text style={styles.emptyTitle}>主题会随记录逐步形成</Text>
        <Text style={styles.emptyText}>开启自动整理或手动检查笔记。弱关联内容可以暂不归类，也可以先创建自己的主题。</Text>
      </View>} />
    {creating && <ThemeEditor mode="create" notes={store.notes} onCancel={() => setCreating(false)}
      onSave={({ title, scope, ids }) => { store.createTheme(title, scope, ids); setCreating(false); }} />}
  </>;
}

const createStyles = (theme) => StyleSheet.create({
  flex: { flex: 1 },
  controlPanel: { marginBottom: spacing.md },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  sectionHeading: { ...type.sectionTitle, color: theme.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  list: { flexGrow: 1, paddingHorizontal: spacing.page, paddingBottom: spacing.xl },
  listHeader: { minHeight: metrics.minTouch, marginBottom: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listHint: { ...type.auxiliary, flex: 1, color: theme.inkSoft },
  refreshButton: { minHeight: metrics.minTouch, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  refreshText: { ...type.auxiliary, color: theme.brand, fontWeight: '700' },
  card: { ...shadow.card, marginBottom: spacing.sm, padding: spacing.md, borderWidth: 0, borderRadius: radius.card, backgroundColor: theme.surface },
  historyCard: { backgroundColor: theme.bg },
  cardPressed: { opacity: 0.76 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  iconTile: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { ...type.sectionTitle, flex: 1, color: theme.ink, fontWeight: '700' },
  retainedTag: { ...type.auxiliary, color: theme.brand, fontWeight: '700' },
  summary: { ...type.content, color: theme.inkSoft, marginTop: spacing.xxs },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  meta: { ...type.auxiliary, color: theme.inkMuted },
  empty: { flex: 1, minHeight: 360, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...type.pageTitle, marginTop: spacing.md, color: theme.ink, fontWeight: '700' },
  emptyText: { ...type.auxiliary, marginTop: spacing.xs, color: theme.inkSoft, textAlign: 'center' },
  historySection: { marginTop: spacing.sm },
  historyToggle: { minHeight: metrics.minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxs },
  historyToggleText: { ...type.auxiliary, color: theme.inkSoft },
  historyActions: { minHeight: metrics.minTouch, marginTop: spacing.sm, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  historyAction: { minWidth: 64, minHeight: metrics.minTouch, alignItems: 'center', justifyContent: 'center' },
  keepText: { ...type.content, color: theme.brand, fontWeight: '700' },
  dissolveText: { ...type.content, color: theme.destructive, fontWeight: '700' },
});
