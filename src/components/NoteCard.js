import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MASONRY_MAX_LINES } from '../masonry';
import { formatNoteDate } from '../presentation';
import { metrics, radius, shadow, spacing, theme, type } from '../theme';

export default function NoteCard({ note, onDelete, onOpenDetail, layout = 'list', actionsOpen = false, onActionsOpen, onActionsClose, searchMatchFields = [] }) {
  const masonry = layout === 'masonry';
  const rawTextMatched = searchMatchFields.includes('rawText');
  const longPressTriggered = useRef(false);

  const openDetail = (shouldFocus = false) => {
    onOpenDetail?.(note.id, { focus: shouldFocus });
  };

  const editFromMenu = () => {
    onActionsClose?.();
    setTimeout(() => openDetail(true), 80);
  };

  const deleteFromMenu = () => {
    onActionsClose?.();
    setTimeout(() => {
      Alert.alert(
        '删除这条笔记？',
        '删除后将不再出现在笔记列表和相关主题中。',
        [
          { text: '取消', style: 'cancel' },
          { text: '删除', style: 'destructive', onPress: () => onDelete?.(note.id) },
        ]
      );
    }, 120);
  };

  return (
    <View style={[styles.card, masonry && styles.masonryCard]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`打开笔记详情：${note.text}`}
        accessibilityHint="轻点查看详情，长按可以编辑或删除"
        delayLongPress={450}
        onPressIn={() => { longPressTriggered.current = false; }}
        onLongPress={() => {
          longPressTriggered.current = true;
          onActionsOpen?.();
        }}
        onPress={() => {
          if (longPressTriggered.current) return;
          openDetail(false);
        }}
        style={({ pressed }) => [styles.cardPressTarget, pressed && !actionsOpen && styles.cardPressed]}
      >
        <View style={styles.cardContent}>
          <View style={styles.copyColumn}>
            <Text
              numberOfLines={masonry ? MASONRY_MAX_LINES : 4}
              ellipsizeMode="tail"
              style={[styles.text, masonry && styles.masonryText]}
            >
              {note.text}
            </Text>
            {masonry && !!note.image?.uri && (
              <Image
                source={{ uri: note.image.uri }}
                style={styles.masonryThumbnail}
                resizeMode="cover"
                accessibilityLabel="笔记附加图片"
              />
            )}
            <View style={[styles.footer, masonry && styles.masonryFooter]}>
              <Text style={styles.date}>{formatNoteDate(note.createdAt)}</Text>
              {rawTextMatched && (
                <View style={[styles.searchMatchTag, masonry && styles.masonrySearchMatchTag]}>
                  <Ionicons name="search-outline" size={metrics.smallIcon} color={theme.inkSoft} />
                  <Text style={styles.searchMatchText}>原始笔记命中</Text>
                </View>
              )}
            </View>
          </View>
          {!masonry && !!note.image?.uri && (
            <Image
              source={{ uri: note.image.uri }}
              style={styles.listThumbnail}
              resizeMode="cover"
              accessibilityLabel="笔记附加图片"
            />
          )}
        </View>
      </Pressable>

      {actionsOpen && (
        <View
          accessibilityRole="menu"
          accessibilityLabel="笔记操作"
          style={styles.actionOverlay}
          onTouchStart={(event) => event.stopPropagation()}
        >
          <View style={styles.actionGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="编辑笔记"
              onPress={editFromMenu}
              style={styles.actionButton}
            >
              <Ionicons name="create-outline" size={metrics.standardIcon} color={theme.ink} />
              <Text style={styles.actionText}>编辑</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="删除笔记"
              onPress={deleteFromMenu}
              style={styles.actionButton}
            >
              <Ionicons name="trash-outline" size={metrics.standardIcon} color={theme.destructive} />
              <Text style={styles.deleteActionText}>删除</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow.card,
    marginBottom: spacing.page,
    borderWidth: 0,
    borderColor: theme.cardLine,
    borderRadius: radius.card,
    backgroundColor: theme.surface,
  },
  cardPressTarget: { padding: spacing.page },
  cardPressed: { opacity: 0.76 },
  cardContent: { flexDirection: 'row', alignItems: 'flex-start' },
  copyColumn: { flex: 1, minWidth: 0 },
  text: { ...type.content, color: theme.ink },
  listThumbnail: { width: 80, height: type.content.lineHeight * 3, marginLeft: spacing.sm, borderRadius: 10, backgroundColor: theme.accentSoft },
  masonryCard: { marginBottom: 0 },
  masonryText: { ...type.content },
  masonryThumbnail: { width: '100%', aspectRatio: 4 / 3, marginTop: spacing.sm, borderRadius: 12, backgroundColor: theme.accentSoft },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  masonryFooter: { flexDirection: 'column', alignItems: 'flex-start', marginTop: spacing.xs },
  date: { ...type.auxiliary, color: theme.inkMuted },
  searchMatchTag: {
    marginLeft: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  searchMatchText: { ...type.auxiliary, color: theme.inkSoft },
  masonrySearchMatchTag: { marginLeft: 0, marginTop: spacing.xs },
  actionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: spacing.xs,
    borderRadius: radius.card,
    backgroundColor: theme.overlaySoft,
  },
  actionGroup: {
    zIndex: 1,
    elevation: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
    minHeight: metrics.minTouch,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.control,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  actionText: { ...type.auxiliary, color: theme.ink, fontWeight: '700' },
  deleteActionText: { ...type.auxiliary, color: theme.destructive, fontWeight: '700' },
});
