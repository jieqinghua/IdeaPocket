import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AnimatedNoteEntry, { NEW_NOTE_ANIMATION_MS } from '../components/AnimatedNoteEntry';
import MasonryNoteList from '../components/MasonryNoteList';
import NoteCard from '../components/NoteCard';
import { isListAtTop, isNewFirstNote } from '../newNoteEntry';
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
  const previousFirstIdRef = useRef(null);
  const previousCountRef = useRef(visible.length);
  const initializedRef = useRef(false);
  const scrollableRef = useRef(null);
  const scrollOffsetRef = useRef(Math.max(0, initialScrollOffset));
  const pendingAnimationIdRef = useRef(null);
  const animationTimerRef = useRef(null);
  const scrollFallbackTimerRef = useRef(null);
  const [animatedNoteId, setAnimatedNoteId] = useState(null);
  const [activeActionsNoteId, setActiveActionsNoteId] = useState(null);
  const previousLayoutModeRef = useRef(layoutMode);
  const previousSearchActiveRef = useRef(searchActive);
  const firstId = visible[0]?.id || null;
  if (previousLayoutModeRef.current !== layoutMode) {
    previousLayoutModeRef.current = layoutMode;
    scrollOffsetRef.current = Math.max(0, initialScrollOffset);
  }
  const searchModeChanged = previousSearchActiveRef.current !== searchActive;
  if (searchModeChanged) {
    previousSearchActiveRef.current = searchActive;
    scrollOffsetRef.current = searchActive ? 0 : Math.max(0, initialScrollOffset);
  }
  const insertedAtFirst = isNewFirstNote({
    initialized: initializedRef.current,
    searchActive,
    searchModeChanged,
    previousCount: previousCountRef.current,
    nextCount: visible.length,
    previousFirstId: previousFirstIdRef.current,
    nextFirstId: firstId,
  });

  useEffect(() => {
    if (!insertedAtFirst || !firstId) return undefined;
    clearTimeout(animationTimerRef.current);
    clearTimeout(scrollFallbackTimerRef.current);

    const startAnimation = () => {
      if (pendingAnimationIdRef.current && pendingAnimationIdRef.current !== firstId) return;
      pendingAnimationIdRef.current = null;
      setAnimatedNoteId(firstId);
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = setTimeout(() => {
        setAnimatedNoteId((current) => current === firstId ? null : current);
      }, NEW_NOTE_ANIMATION_MS + 80);
    };

    if (isListAtTop(scrollOffsetRef.current)) {
      startAnimation();
      return undefined;
    }

    pendingAnimationIdRef.current = firstId;
    setAnimatedNoteId(null);
    if (layoutMode === 'masonry') {
      scrollableRef.current?.scrollTo?.({ x: 0, y: 0, animated: false });
    } else {
      scrollableRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    }
    scrollOffsetRef.current = 0;
    onScroll?.({ nativeEvent: { contentOffset: { x: 0, y: 0 } } });

    // The real y=0 onScroll event starts the animation. Keep a short fallback
    // for runtimes that omit that event, but do not tie it to this effect's
    // cleanup: CaptureFab closes immediately after submit and re-renders App.
    scrollFallbackTimerRef.current = setTimeout(() => {
      if (pendingAnimationIdRef.current !== firstId) return;
      if (layoutMode === 'masonry') {
        scrollableRef.current?.scrollTo?.({ y: 0, animated: false });
      } else {
        scrollableRef.current?.scrollToOffset?.({ offset: 0, animated: false });
      }
      scrollOffsetRef.current = 0;
      onScroll?.({ nativeEvent: { contentOffset: { x: 0, y: 0 } } });
      startAnimation();
    }, 80);
    return undefined;
  }, [firstId, insertedAtFirst, layoutMode, onScroll]);

  useEffect(() => {
    pendingAnimationIdRef.current = null;
    setAnimatedNoteId(null);
    clearTimeout(animationTimerRef.current);
    clearTimeout(scrollFallbackTimerRef.current);
  }, [layoutMode, searchActive]);

  useEffect(() => () => {
    clearTimeout(animationTimerRef.current);
    clearTimeout(scrollFallbackTimerRef.current);
  }, []);

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
  // Use the live offset, not the last value captured by App during its render.
  // Masonry height measurements can re-render this screen after an imperative
  // jump; feeding the old prop back here would restore the stale scroll position.
  const listScrollOffset = searchActive ? 0 : Math.max(0, scrollOffsetRef.current);
  const listScrollHandler = searchActive ? undefined : onScroll;
  const handleListScroll = (event) => {
    const nextOffset = Math.max(0, event.nativeEvent.contentOffset.y);
    scrollOffsetRef.current = nextOffset;
    listScrollHandler?.(event);
    if (!isListAtTop(nextOffset) || !pendingAnimationIdRef.current) return;
    const noteId = pendingAnimationIdRef.current;
    pendingAnimationIdRef.current = null;
    clearTimeout(scrollFallbackTimerRef.current);
    setAnimatedNoteId(noteId);
    clearTimeout(animationTimerRef.current);
    animationTimerRef.current = setTimeout(() => {
      setAnimatedNoteId((current) => current === noteId ? null : current);
    }, NEW_NOTE_ANIMATION_MS + 80);
  };

  return (
    <View
      style={styles.flex}
      onTouchStart={() => {
        if (activeActionsNoteId) setActiveActionsNoteId(null);
      }}
    >
      {layoutMode === 'masonry' ? (
        <MasonryNoteList
          scrollRef={scrollableRef}
          notes={visible}
          store={store}
          onOpenNote={onOpenNote}
          onScroll={handleListScroll}
          initialScrollOffset={listScrollOffset}
          contentTopInset={contentTopInset}
          animatedNoteId={animatedNoteId}
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
          ref={scrollableRef}
          style={styles.flex}
          contentContainerStyle={visible.length
            ? [styles.list, { paddingTop: contentTopInset }]
            : [styles.emptyWrap, { paddingTop: contentTopInset }]}
          data={visible}
          removeClippedSubviews={false}
          contentOffset={{ x: 0, y: listScrollOffset }}
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          onTouchStart={() => {
            if (activeActionsNoteId) setActiveActionsNoteId(null);
          }}
          keyExtractor={(note) => note.id}
          ListHeaderComponent={searchHeader}
          renderItem={({ item, index }) => (
            <AnimatedNoteEntry animate={index === 0 && item.id === animatedNoteId}>
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
