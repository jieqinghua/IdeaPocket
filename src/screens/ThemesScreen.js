import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  buildThemeCards,
  formatRelativeThemeDate,
  getThemeCardVisual,
  getThemeGeneratedAt,
} from '../presentation';
import { metrics, radius, shadow, spacing, theme, type } from '../theme';

const statusOf = (item) => item.status || (item.dismissed ? 'dismissed' : 'current');
const CARD_SCROLL_SLOP = 8;

function ThemeCard({ item, historical = false, onOpen, onRetain, onDissolve }) {
  const pressStartY = useRef(null);
  const movedDuringPress = useRef(false);
  const visual = getThemeCardVisual(item.title, item.summary);
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
            {retained && <Text style={styles.retainedTag}>已保留</Text>}
          </View>
          <Text numberOfLines={3} ellipsizeMode="tail" style={styles.summary}>{item.summary}</Text>
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

  if (!historical) {
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
        accessibilityLabel={`打开历史主题：${item.title}，共 ${item.notes.length} 条笔记`}
        onTouchStart={trackTouchStart}
        onTouchMove={trackTouchMove}
        onPress={openCard}
        style={({ pressed }) => pressed && styles.cardPressed}
      >
        {body}
      </Pressable>
      <View style={styles.historyActions}>
        <Pressable accessibilityRole="button" onPress={() => onRetain?.(item.id)} style={styles.historyAction}>
          <Text style={styles.keepText}>保留</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert('解散这个主题？', '原始笔记会继续保留。', [
            { text: '取消', style: 'cancel' },
            { text: '解散', style: 'destructive', onPress: () => onDissolve?.(item.id) },
          ])}
          style={styles.historyAction}
        >
          <Text style={styles.dissolveText}>解散</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ThemesScreen({ store, onOpenTheme, onScroll, contentTopInset = 0, initialScrollOffset = 0 }) {
  const suppressCardPressUntil = useRef(0);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const cards = useMemo(() => buildThemeCards(store.themes, store.notes), [store.notes, store.themes]);
  const current = cards.filter((item) => statusOf(item) === 'current');
  const retained = cards
    .filter((item) => statusOf(item) === 'retained')
    .sort((a, b) => (a.retainedAt || 0) - (b.retainedAt || 0));
  const history = cards
    .filter((item) => statusOf(item) === 'history')
    .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  const visible = [...current, ...retained];
  const canGenerate = store.notes.length >= 3;
  const running = store.themeStatus === 'running';

  const openTheme = (id) => {
    if (Date.now() < suppressCardPressUntil.current) return;
    onOpenTheme?.(id);
  };
  const statusText = running
    ? '正在分析全部笔记并聚合主题…'
    : store.themeError || store.themeNotice
      ? store.themeError || store.themeNotice
      : store.themeIsStale && store.lastAnalysis
        ? '笔记已变化，可重新分析主题'
        : store.themeSource === 'local'
          ? '已使用本地相关性完成整理'
          : '';

  const header = (
    <View style={styles.listHeader}>
      <Text style={styles.listHint}>{statusText || '由 AI 分析聚合生成'}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={store.lastAnalysis ? '重新分析全部笔记' : '分析全部笔记'}
        disabled={running || !canGenerate}
        onPress={store.analyzeThemes}
        style={styles.refreshButton}
      >
        <Ionicons name="sparkles-outline" size={18} color={theme.brand} />
        <Text style={styles.refreshText}>{running ? '分析中' : store.lastAnalysis ? '重新分析' : '分析全部笔记'}</Text>
      </Pressable>
    </View>
  );

  return (
    <FlatList
      style={styles.flex}
      removeClippedSubviews={false}
      contentContainerStyle={[styles.list, { paddingTop: contentTopInset }]}
      data={visible}
      contentOffset={{ x: 0, y: Math.max(0, initialScrollOffset) }}
      onScroll={onScroll}
      onScrollBeginDrag={() => { suppressCardPressUntil.current = Date.now() + 250; }}
      scrollEventThrottle={16}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => <ThemeCard item={item} onOpen={openTheme} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="sparkles-outline" size={28} color={theme.brand} />
          <Text style={styles.emptyTitle}>暂无主题</Text>
          <Text style={styles.emptyText}>{canGenerate ? '点击“分析全部笔记”生成主题。' : '至少有 3 条笔记后，可手动分析生成主题。'}</Text>
        </View>
      }
      ListFooterComponent={history.length ? (
        <View style={styles.historySection}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: historyExpanded }}
            onPress={() => setHistoryExpanded((value) => !value)}
            style={styles.historyToggle}
          >
            <Text style={styles.historyToggleText}>之前生成的主题（{history.length}）</Text>
            <Ionicons name={historyExpanded ? 'chevron-up' : 'chevron-down'} size={metrics.smallIcon} color={theme.inkSoft} />
          </Pressable>
          {historyExpanded && history.map((item) => (
            <ThemeCard
              key={item.id}
              item={item}
              historical
              onOpen={openTheme}
              onRetain={store.retainTheme}
              onDissolve={store.dismissTheme}
            />
          ))}
        </View>
      ) : null}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
