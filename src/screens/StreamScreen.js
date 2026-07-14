import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AnimatedNoteEntry, { NEW_NOTE_ANIMATION_MS } from '../components/AnimatedNoteEntry';
import MasonryNoteList from '../components/MasonryNoteList';
import NoteCard from '../components/NoteCard';
import { sortNotesNewestFirst } from '../presentation';
import { searchNotes } from '../search';
import { metrics, radius, shadow, spacing, theme, type } from '../theme';

function SearchHeader({ query, onChangeQuery, onFocusChange, resultCount, searching }) {
  return (
    <View style={styles.searchHeader}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={metrics.standardIcon} color={theme.inkSoft} />
        <TextInput
          accessibilityLabel="搜索笔记"
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit
          clearButtonMode="while-editing"
          onChangeText={onChangeQuery}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onSubmitEditing={() => Keyboard.dismiss()}
          placeholder="搜索笔记"
          placeholderTextColor={theme.inkSoft}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {!!query && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="清除搜索"
            hitSlop={8}
            onPress={() => onChangeQuery?.('')}
            style={styles.clearSearch}
          >
            <Ionicons name="close-circle" size={metrics.standardIcon} color={theme.inkSoft} />
          </Pressable>
        )}
      </View>
      {searching && <Text style={styles.searchSummary}>找到 {resultCount} 条相关笔记</Text>}
    </View>
  );
}

export default function StreamScreen({
  store,
  layoutMode = 'list',
  searchQuery = '',
  onSearchQueryChange,
  onSearchFocusChange,
  contentTopInset = 0,
  initialScrollOffset = 0,
  onOpenNote,
  onScroll,
}) {
  const normalizedQuery = searchQuery.trim();
  const searchActive = Boolean(normalizedQuery);
  const searchResults = useMemo(
    () => searchActive ? searchNotes(store.notes, normalizedQuery) : [],
    [normalizedQuery, searchActive, store.notes]
  );
  const visible = searchActive
    ? searchResults.map((result) => result.note)
    : sortNotesNewestFirst(store.notes);
  const searchMatchById = useMemo(
    () => Object.fromEntries(searchResults.map((result) => [result.note.id, result.matchFields])),
    [searchResults]
  );
  const [, forceRender] = useReducer((value) => value + 1, 0);
  const previousFirstIdRef = useRef(null);
  const previousCountRef = useRef(visible.length);
  const initializedRef = useRef(false);
  const animatedFirstIdRef = useRef(null);
  const [activeActionsNoteId, setActiveActionsNoteId] = useState(null);
  const previousLayoutModeRef = useRef(layoutMode);
  const previousSearchActiveRef = useRef(searchActive);
  const firstId = visible[0]?.id || null;
  if (previousLayoutModeRef.current !== layoutMode) {
    previousLayoutModeRef.current = layoutMode;
    animatedFirstIdRef.current = null;
  }
  const searchModeChanged = previousSearchActiveRef.current !== searchActive;
  if (searchModeChanged) {
    previousSearchActiveRef.current = searchActive;
    animatedFirstIdRef.current = null;
  }
  const insertedAtFirst = initializedRef.current
    && !searchActive
    && !searchModeChanged
    && visible.length > previousCountRef.current
    && firstId !== previousFirstIdRef.current;
  if (insertedAtFirst) animatedFirstIdRef.current = firstId;

  useEffect(() => {
    if (!insertedAtFirst || !firstId) return undefined;
    const timer = setTimeout(() => {
      if (animatedFirstIdRef.current !== firstId) return;
      animatedFirstIdRef.current = null;
      forceRender();
    }, NEW_NOTE_ANIMATION_MS + 80);
    return () => clearTimeout(timer);
  }, [firstId, insertedAtFirst]);

  useLayoutEffect(() => {
    previousFirstIdRef.current = firstId;
    previousCountRef.current = visible.length;
    initializedRef.current = true;
  }, [firstId, visible.length]);

  const searchHeader = (
    <SearchHeader
      query={searchQuery}
      onChangeQuery={onSearchQueryChange}
      onFocusChange={onSearchFocusChange}
      resultCount={visible.length}
      searching={searchActive}
    />
  );
  const listScrollOffset = searchActive ? 0 : Math.max(0, initialScrollOffset);
  const listScrollHandler = searchActive ? undefined : onScroll;

  return (
    <View
      style={styles.flex}
      onTouchStart={() => {
        if (activeActionsNoteId) setActiveActionsNoteId(null);
      }}
    >
      {layoutMode === 'masonry' ? (
        <MasonryNoteList
          notes={visible}
          store={store}
          onOpenNote={onOpenNote}
          onScroll={listScrollHandler}
          initialScrollOffset={listScrollOffset}
          contentTopInset={contentTopInset}
          animatedNoteId={animatedFirstIdRef.current}
          activeActionsNoteId={activeActionsNoteId}
          onActionsChange={setActiveActionsNoteId}
          searchHeader={searchHeader}
          searchMatchById={searchMatchById}
          emptyContent={
            <View style={styles.masonryEmptyState}>
              <Ionicons name={searchActive ? 'search-outline' : 'document-text-outline'} size={64} color={theme.inkSoft} />
              <Text style={styles.emptyTitle}>{searchActive ? '没有找到相关笔记' : '暂无笔记'}</Text>
              <Text style={styles.emptyHint}>{searchActive ? '试试更短的关键词或不同的说法' : '按住底部按钮开始记录'}</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          style={styles.flex}
          contentContainerStyle={visible.length
            ? [styles.list, { paddingTop: contentTopInset }]
            : [styles.emptyWrap, { paddingTop: contentTopInset }]}
          data={visible}
          removeClippedSubviews={false}
          contentOffset={{ x: 0, y: listScrollOffset }}
          onScroll={listScrollHandler}
          scrollEventThrottle={16}
          onTouchStart={() => {
            if (activeActionsNoteId) setActiveActionsNoteId(null);
          }}
          keyExtractor={(note) => note.id}
          ListHeaderComponent={searchHeader}
          renderItem={({ item, index }) => (
            <AnimatedNoteEntry animate={index === 0 && item.id === animatedFirstIdRef.current}>
              <NoteCard
                note={item}
                searchMatchFields={searchMatchById[item.id] || []}
                onDelete={store.remove}
                onOpenDetail={onOpenNote}
                actionsOpen={activeActionsNoteId === item.id}
                onActionsOpen={() => setActiveActionsNoteId(item.id)}
                onActionsClose={() => setActiveActionsNoteId(null)}
              />
            </AnimatedNoteEntry>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={searchActive ? 'search-outline' : 'document-text-outline'} size={64} color={theme.inkSoft} />
              <Text style={styles.emptyTitle}>{searchActive ? '没有找到相关笔记' : '暂无笔记'}</Text>
              <Text style={styles.emptyHint}>{searchActive ? '试试更短的关键词或不同的说法' : '按住底部按钮开始记录'}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchHeader: { width: '100%', marginBottom: spacing.md },
  searchWrap: {
    ...shadow.control,
    minHeight: metrics.minTouch,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0,
    borderRadius: radius.pill,
    backgroundColor: theme.surface,
  },
  searchInput: {
    flex: 1,
    minHeight: metrics.minTouch,
    paddingHorizontal: spacing.xs,
    ...type.content,
    color: theme.ink,
  },
  clearSearch: { minWidth: metrics.minTouch, minHeight: metrics.minTouch, alignItems: 'center', justifyContent: 'center' },
  searchSummary: { ...type.auxiliary, color: theme.inkSoft, marginTop: spacing.xs },
  list: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xxl + metrics.primaryButton + spacing.lg,
  },
  emptyWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xxl + metrics.primaryButton,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  masonryEmptyState: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...type.pageTitle,
    color: theme.inkSoft,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  emptyHint: {
    ...type.auxiliary,
    color: theme.inkSoft,
    textAlign: 'center',
  },
});
