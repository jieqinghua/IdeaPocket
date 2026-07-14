import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { buildMasonryLayout, MASONRY_GAP } from '../masonry';
import { metrics, spacing } from '../theme';
import AnimatedNoteEntry from './AnimatedNoteEntry';
import NoteCard from './NoteCard';

const HORIZONTAL_PADDING = spacing.page;

export default function MasonryNoteList({ notes, store, onOpenNote, onScroll, contentTopInset = 0, initialScrollOffset = 0, animatedNoteId, activeActionsNoteId, onActionsChange, searchHeader, searchMatchById = {}, emptyContent = null }) {
  const { width } = useWindowDimensions();
  const [measuredHeights, setMeasuredHeights] = useState({});
  const columnWidth = Math.max(1, (width - HORIZONTAL_PADDING * 2 - MASONRY_GAP) / 2);
  const layout = useMemo(
    () => buildMasonryLayout(notes, columnWidth, measuredHeights),
    [columnWidth, measuredHeights, notes]
  );

  const recordHeight = useCallback((id, height) => {
    setMeasuredHeights((current) => {
      if (Math.abs((current[id] || 0) - height) < 1) return current;
      return { ...current, [id]: height };
    });
  }, []);

  return (
    <ScrollView
      style={styles.flex}
      removeClippedSubviews={false}
      contentContainerStyle={[styles.scrollContent, { paddingTop: contentTopInset }]}
      contentOffset={{ x: 0, y: Math.max(0, initialScrollOffset) }}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onTouchStart={() => {
        if (activeActionsNoteId) onActionsChange?.(null);
      }}
    >
      {searchHeader}
      {notes.length ? (
        <View style={[styles.canvas, searchHeader && styles.canvasAfterSearch, { height: layout.height }]}>
          {layout.positions.map((position) => {
            const note = notes[position.index];
            return (
              <View
                key={note.id}
                onLayout={(event) => recordHeight(note.id, event.nativeEvent.layout.height)}
                style={[
                  styles.cardPosition,
                  { left: position.left, top: position.top, width: position.width },
                ]}
              >
                <AnimatedNoteEntry animate={note.id === animatedNoteId}>
                  <NoteCard
                    note={note}
                    layout="masonry"
                    searchMatchFields={searchMatchById[note.id] || []}
                    onDelete={store.remove}
                    onOpenDetail={onOpenNote}
                    actionsOpen={activeActionsNoteId === note.id}
                    onActionsOpen={() => onActionsChange?.(note.id)}
                    onActionsClose={() => onActionsChange?.(null)}
                  />
                </AnimatedNoteEntry>
              </View>
            );
          })}
        </View>
      ) : emptyContent}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: spacing.xxl + metrics.primaryButton + spacing.lg,
  },
  canvas: { position: 'relative' },
  canvasAfterSearch: { marginTop: 0 },
  cardPosition: { position: 'absolute' },
});
