import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  AI_TEXT_PHASE,
  INITIAL_AI_TEXT_TRANSITION,
  aiTextTransitionReducer,
  isAiTextTransitionBusy,
} from '../aiTextTransition';
import AiPolishCandidateCard from '../components/AiPolishCandidateCard';
import AiTextTransform from '../components/AiTextTransform';
import DetailPageHeader from '../components/DetailPageHeader';
import { tidy } from '../lib/aiTidy';
import { formatNoteDate, hasAiTidy } from '../presentation';
import { metrics, radius, shadow, spacing, theme, type } from '../theme';

const EDITOR_LINE_HEIGHT = type.detailBody.lineHeight;
const EDITOR_MIN_HEIGHT = 600;
const DETAIL_HEADER_HEIGHT = 56;
const CARET_SAFE_GAP = 40;
const BASE_CONTENT_BOTTOM_PADDING = 40;
const AI_TOOLBAR_HEIGHT = 56;
const AI_TOOLBAR_BUTTON_HEIGHT = 40;
const MIN_AI_DISPLAY_MS = 800;

const measureTextUnits = (value) =>
  Array.from(value).reduce((sum, char) => sum + (/[\x00-\x7F]/.test(char) ? 0.56 : 1), 0);

const FourPointStar = ({ size = metrics.standardIcon, color = theme.brand }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 1.5C12.5 8 16 11.5 22.5 12C16 12.5 12.5 16 12 22.5C11.5 16 8 12.5 1.5 12C8 11.5 11.5 8 12 1.5Z"
      fill={color}
    />
  </Svg>
);

const estimateCaretLine = (text, caretIndex, inputWidth) => {
  const beforeCaret = text.slice(0, Math.max(0, caretIndex));
  const textWidth = Math.max(1, inputWidth);
  const unitsPerLine = Math.max(1, Math.floor(textWidth / type.detailBody.fontSize));
  return beforeCaret.split('\n').reduce((lineCount, segment) => {
    const wrappedLines = Math.max(1, Math.ceil(measureTextUnits(segment) / unitsPerLine));
    return lineCount + wrappedLines;
  }, 0) - 1;
};

export default function NoteDetailScreen({
  note,
  focusOnOpen = false,
  onBack,
  onApplyTidy,
  onEdit,
  onRemove,
  onAttachImage,
  onRemoveImage,
}) {
  const hasRaw = hasAiTidy(note);
  const [editText, setEditText] = useState(note.text);
  const [editorHeight, setEditorHeight] = useState(EDITOR_MIN_HEIGHT);
  const [readTextHeight, setReadTextHeight] = useState(EDITOR_LINE_HEIGHT);
  const [isEditing, setIsEditing] = useState(Boolean(focusOnOpen && !hasRaw));
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [aiTransition, dispatchAiTransition] = useReducer(
    aiTextTransitionReducer,
    INITIAL_AI_TEXT_TRANSITION
  );
  const [reduceMotion, setReduceMotion] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiNotice, setAiNotice] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [originalVisible, setOriginalVisible] = useState(false);
  const [aiCandidate, setAiCandidate] = useState(null);
  const tidyController = useRef(null);
  const editInputRef = useRef(null);
  const scrollRef = useRef(null);
  const keyboardHeightRef = useRef(0);
  const scrollYRef = useRef(0);
  const selectionRef = useRef({ start: 0, end: 0 });
  const inputLayoutRef = useRef({ y: 0, width: 0 });
  const editTextRef = useRef(note.text);
  const readOnlyRef = useRef(false);
  const pendingCaretTimerRef = useRef(null);
  const minimumAiTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const lastCommittedEditRef = useRef({ noteId: note.id, text: note.text });

  useEffect(() => {
    editTextRef.current = editText;
    readOnlyRef.current = !isEditing;
  }, [editText, isEditing]);

  const keepCaretAboveKeyboard = useCallback((keyboardHeight = keyboardHeightRef.current) => {
    if (readOnlyRef.current) return;
    const { height: viewportHeight } = Dimensions.get('window');
    const { height: screenHeight } = Dimensions.get('screen');
    const resizedByKeyboard = keyboardHeight > 0 && screenHeight - viewportHeight > keyboardHeight * 0.35;
    const effectiveKeyboardHeight = resizedByKeyboard ? 0 : keyboardHeight;
    const { y: inputY, width: inputWidth } = inputLayoutRef.current;
    const caretLine = estimateCaretLine(editTextRef.current, selectionRef.current.start, inputWidth);
    const caretY = inputY + Math.max(0, caretLine) * EDITOR_LINE_HEIGHT;
    const visibleBottom = viewportHeight
      - DETAIL_HEADER_HEIGHT
      - effectiveKeyboardHeight
      - AI_TOOLBAR_HEIGHT
      - CARET_SAFE_GAP;
    const currentScrollY = scrollYRef.current;
    const caretViewportY = caretY - currentScrollY;
    const caretBottom = caretViewportY + EDITOR_LINE_HEIGHT + spacing.md;
    let targetScrollY = currentScrollY;
    if (keyboardHeight > 0 && caretBottom > visibleBottom) {
      targetScrollY = currentScrollY + caretBottom - visibleBottom;
    } else if (caretViewportY < spacing.lg) {
      targetScrollY = currentScrollY + caretViewportY - spacing.lg;
    } else {
      return;
    }
    targetScrollY = Math.max(0, targetScrollY);
    scrollRef.current?.scrollTo({ y: targetScrollY, animated: true });
  }, []);

  const scheduleKeepCaretAboveKeyboard = useCallback(
    (delay = 80, keyboardHeight = keyboardHeightRef.current) => {
      if (pendingCaretTimerRef.current) clearTimeout(pendingCaretTimerRef.current);
      pendingCaretTimerRef.current = setTimeout(() => keepCaretAboveKeyboard(keyboardHeight), delay);
    },
    [keepCaretAboveKeyboard]
  );

  useEffect(() => {
    tidyController.current?.abort();
    tidyController.current = null;
    if (minimumAiTimerRef.current) clearTimeout(minimumAiTimerRef.current);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    dispatchAiTransition({ type: 'RESET' });
    setEditText(note.text);
    editTextRef.current = note.text;
    setIsEditing(false);
    setEditorHeight(EDITOR_MIN_HEIGHT);
    setReadTextHeight(EDITOR_LINE_HEIGHT);
    setAiError('');
    setAiNotice('');
    setImageViewerOpen(false);
    setMenuOpen(false);
    setOriginalVisible(false);
    setAiCandidate(null);
    lastCommittedEditRef.current = { noteId: note.id, text: note.text };
  }, [note.id]);

  useEffect(() => {
    if (aiTransition.phase !== AI_TEXT_PHASE.IDLE) return;
    if (aiCandidate) return;
    setEditText(note.text);
    editTextRef.current = note.text;
  }, [aiCandidate, aiTransition.phase, note.text]);

  useEffect(() => {
    if (!focusOnOpen) return undefined;
    setIsEditing(true);
    const focusTimer = setTimeout(() => editInputRef.current?.focus(), 260);
    const selectionTimer = setTimeout(() => {
      const caretIndex = editTextRef.current.length;
      const selection = { start: caretIndex, end: caretIndex };
      selectionRef.current = selection;
      editInputRef.current?.setNativeProps({ selection });
      scheduleKeepCaretAboveKeyboard(120);
    }, 340);
    return () => {
      clearTimeout(focusTimer);
      clearTimeout(selectionTimer);
    };
  }, [focusOnOpen, scheduleKeepCaretAboveKeyboard]);

  useEffect(
    () => () => {
      tidyController.current?.abort();
      tidyController.current = null;
      if (pendingCaretTimerRef.current) clearTimeout(pendingCaretTimerRef.current);
      if (minimumAiTimerRef.current) clearTimeout(minimumAiTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    []
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => subscription?.remove?.();
  }, []);

  const commitEdit = useCallback((value) => {
    const normalized = String(value || '').trim();
    const previous = lastCommittedEditRef.current;
    if (!normalized || normalized === note.text || (previous.noteId === note.id && previous.text === normalized)) {
      return false;
    }
    lastCommittedEditRef.current = { noteId: note.id, text: normalized };
    onEdit?.(note.id, normalized);
    return true;
  }, [note.id, note.text, onEdit]);

  const finishEditing = useCallback(() => {
    commitEdit(editTextRef.current);
    editInputRef.current?.blur();
    setIsEditing(false);
    setOriginalVisible(false);
  }, [commitEdit]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const nextKeyboardHeight = event.endCoordinates?.height || 0;
      keyboardHeightRef.current = nextKeyboardHeight;
      setKeyboardInset(nextKeyboardHeight);
      scheduleKeepCaretAboveKeyboard(240, nextKeyboardHeight);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
      setKeyboardInset(0);
      if (isEditing) finishEditing();
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [finishEditing, isEditing, scheduleKeepCaretAboveKeyboard]);

  useEffect(() => {
    if (keyboardInset > 0) scheduleKeepCaretAboveKeyboard(80, keyboardHeightRef.current);
  }, [keyboardInset, scheduleKeepCaretAboveKeyboard]);

  const runTidy = async () => {
    const source = editText.trim();
    if (!source || aiTransition.phase !== AI_TEXT_PHASE.IDLE || aiCandidate) return;
    tidyController.current?.abort();
    const controller = new AbortController();
    tidyController.current = controller;
    commitEdit(source);
    Keyboard.dismiss();
    editInputRef.current?.blur();
    setIsEditing(false);
    setAiError('');
    setAiNotice('');
    dispatchAiTransition({ type: 'BEGIN', sourceText: source });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    AccessibilityInfo.announceForAccessibility('AI 开始润色笔记');
    if (minimumAiTimerRef.current) clearTimeout(minimumAiTimerRef.current);
    minimumAiTimerRef.current = setTimeout(() => {
      dispatchAiTransition({ type: 'MINIMUM_ELAPSED' });
    }, reduceMotion ? 120 : MIN_AI_DISPLAY_MS);
    try {
      const { text } = await tidy(source, { signal: controller.signal });
      const output = (text || '').trim();
      dispatchAiTransition({ type: 'RESOLVED', resultText: output || source });
    } catch (error) {
      if (error?.code === 'aborted') return;
      const message = error?.message || '润色失败，请稍后重试';
      setAiError(message);
      dispatchAiTransition({ type: 'FAILED', error: message });
      AccessibilityInfo.announceForAccessibility(`AI 润色失败，${message}`);
    } finally {
      if (tidyController.current === controller) tidyController.current = null;
    }
  };

  const handleRevealComplete = useCallback(() => {
    const source = aiTransition.sourceText.trim();
    const result = aiTransition.resultText.trim() || source;
    dispatchAiTransition({ type: 'REVEALED' });
    setIsEditing(false);
    if (result === source) {
      setAiNotice('内容已经很清楚，无需替换');
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => setAiNotice(''), 2400);
      AccessibilityInfo.announceForAccessibility('内容已经很清楚，无需替换');
    } else {
      setAiCandidate({ source, result });
      AccessibilityInfo.announceForAccessibility('AI 润色完成，请确认取消或替换原文');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [aiTransition.resultText, aiTransition.sourceText]);

  const handleRecoveryComplete = useCallback(() => {
    dispatchAiTransition({ type: 'RECOVERED' });
  }, []);

  const aiBusy = isAiTextTransitionBusy(aiTransition.phase);
  const showAiTransform = aiTransition.phase !== AI_TEXT_PHASE.IDLE;
  const canRunTidy = Boolean(isEditing && aiTransition.phase === AI_TEXT_PHASE.IDLE && editText.trim() && !aiCandidate);
  const canShowMenu = !isEditing && !aiBusy && !aiCandidate;

  const handleTextChange = (value) => {
    editTextRef.current = value;
    setEditText(value);
    scheduleKeepCaretAboveKeyboard();
  };

  const handleSelectionChange = (event) => {
    selectionRef.current = event.nativeEvent.selection;
    scheduleKeepCaretAboveKeyboard();
  };

  const handleEditorContentSizeChange = (event) => {
    const contentHeight = Math.max(EDITOR_LINE_HEIGHT, Math.ceil(event.nativeEvent.contentSize.height));
    setReadTextHeight(contentHeight);
    setEditorHeight(Math.max(EDITOR_MIN_HEIGHT, contentHeight));
    scheduleKeepCaretAboveKeyboard();
  };

  const addImageFrom = async (source) => {
    if (imageBusy) return;
    setImageBusy(true);
    setImageError('');
    try {
      await onAttachImage?.(note.id, source);
    } catch (error) {
      setImageError(error?.message || '添加图片失败，请重试。');
    } finally {
      setImageBusy(false);
    }
  };

  const showImageSourcePicker = () => {
    Alert.alert('添加图片', '选择图片来源', [
      { text: '拍照', onPress: () => addImageFrom('camera') },
      { text: '从相册选择', onPress: () => addImageFrom('library') },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const confirmReplaceImage = () => {
    Alert.alert('更换图片？', '选择新图后将替换当前图片。', [
      { text: '取消', style: 'cancel' },
      { text: '继续', onPress: showImageSourcePicker },
    ]);
  };

  const confirmRemoveImage = () => {
    Alert.alert('移除图片？', '这会从该笔记和本机存储中删除当前图片。', [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          setImageBusy(true);
          setImageError('');
          try {
            const removed = await onRemoveImage?.(note.id);
            if (removed) setImageViewerOpen(false);
          } catch (error) {
            setImageError(error?.message || '移除图片失败，请重试。');
          } finally {
            setImageBusy(false);
          }
        },
      },
    ]);
  };

  const confirmBack = () => {
    if (isEditing) finishEditing();
    onBack?.();
  };

  const restoreAiSource = () => {
    const source = aiCandidate?.source || note.text;
    setAiCandidate(null);
    setEditText(source);
    editTextRef.current = source;
    setAiError('');
    Haptics.selectionAsync().catch(() => {});
  };

  const confirmAiReplacement = () => {
    const result = aiCandidate?.result?.trim();
    if (!result) return;
    onApplyTidy?.(note.id, result);
    setAiCandidate(null);
    setEditText(result);
    editTextRef.current = result;
    setOriginalVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const deleteFromMenu = () => {
    setMenuOpen(false);
    onRemove?.(note.id);
    onBack?.();
  };

  const windowHeight = Dimensions.get('window').height;
  const screenHeight = Dimensions.get('screen').height;
  const keyboardResizesWindow = keyboardInset > 0 && screenHeight - windowHeight > keyboardInset * 0.35;
  const keyboardAiBarBottom = keyboardInset > 0 && !keyboardResizesWindow ? keyboardInset : 0;
  const editorContentPadding = isEditing && aiTransition.phase === AI_TEXT_PHASE.IDLE
    ? { paddingBottom: BASE_CONTENT_BOTTOM_PADDING + AI_TOOLBAR_HEIGHT + spacing.md }
    : null;
  const imageSection = (note.image?.uri || imageError) ? (
    <View style={styles.imageSection}>
      {note.image?.uri ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="放大查看笔记图片"
          accessibilityHint="轻点全屏查看，可在全屏页面更换或删除图片。"
          onPress={() => setImageViewerOpen(true)}
          style={({ pressed }) => [styles.noteImagePressable, pressed && styles.pressed]}
        >
          <Image
            source={{ uri: note.image.uri }}
            style={styles.noteImage}
            resizeMode="cover"
            accessible={false}
          />
        </Pressable>
      ) : null}
      {!!imageError && <Text accessibilityLiveRegion="polite" style={styles.imageErrorText}>{imageError}</Text>}
    </View>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <DetailPageHeader
        title="笔记详情"
        backLabel="返回笔记列表"
        onBack={confirmBack}
        rightIcon={canShowMenu ? 'ellipsis-horizontal' : undefined}
        rightAccessibilityLabel="笔记菜单"
        onRightPress={() => setMenuOpen((current) => !current)}
      />
      {menuOpen && (
        <View style={styles.overflowMenu}>
          <Pressable
            accessibilityRole="menuitem"
            accessibilityLabel="删除笔记"
            onPress={deleteFromMenu}
            style={({ pressed }) => [styles.overflowMenuItem, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={metrics.smallIcon} color="#8A5C52" />
            <Text style={styles.overflowMenuText}>删除</Text>
          </Pressable>
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, editorContentPadding]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{formatNoteDate(note.createdAt)}</Text>
          {!note.image?.uri && aiTransition.phase === AI_TEXT_PHASE.IDLE && !aiCandidate && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="为笔记添加图片"
              disabled={imageBusy}
              onPress={showImageSourcePicker}
              style={({ pressed }) => [styles.tidyMetaAction, (pressed || imageBusy) && styles.metaActionDisabled]}
            >
              <Ionicons name="image-outline" size={metrics.smallIcon} color={theme.brand} />
              <Text style={styles.tidyMetaActionText}>{imageBusy ? '处理中' : '添加图片'}</Text>
            </Pressable>
          )}
        </View>
        {!!aiError && aiTransition.phase === AI_TEXT_PHASE.IDLE && (
          <Text accessibilityLiveRegion="polite" style={styles.aiErrorText}>{aiError}</Text>
        )}
        {!!aiNotice && aiTransition.phase === AI_TEXT_PHASE.IDLE && (
          <Text accessibilityLiveRegion="polite" style={styles.aiNoticeText}>{aiNotice}</Text>
        )}

        {aiCandidate ? (
          <>
            <AiPolishCandidateCard
              text={aiCandidate.result}
              reduceMotion={reduceMotion}
              onCancel={restoreAiSource}
              onConfirm={confirmAiReplacement}
            />
            <View style={styles.candidateOriginalSection}>
              <Text style={styles.candidateOriginalLabel}>原文笔记</Text>
              <Text style={styles.candidateOriginalText}>{aiCandidate.source}</Text>
            </View>
            {imageSection}
          </>
        ) : (
          <>
            {imageSection}
            {showAiTransform ? (
              <AiTextTransform
                phase={aiTransition.phase}
                sourceText={aiTransition.sourceText || editText}
                reduceMotion={reduceMotion}
                onRevealComplete={handleRevealComplete}
                onRecoveryComplete={handleRecoveryComplete}
              />
            ) : (
              <TextInput
                ref={editInputRef}
                multiline
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                value={editText}
                onChangeText={handleTextChange}
                onFocus={() => {
                  setOriginalVisible(false);
                  setMenuOpen(false);
                  setIsEditing(true);
                  scheduleKeepCaretAboveKeyboard(160);
                }}
                onLayout={(event) => {
                  inputLayoutRef.current = event.nativeEvent.layout;
                }}
                onSelectionChange={handleSelectionChange}
                onContentSizeChange={handleEditorContentSizeChange}
                style={[styles.editInput, { height: isEditing ? editorHeight : readTextHeight }]}
                accessibilityLabel={isEditing ? '编辑当前笔记内容' : '笔记正文，轻点编辑'}
                accessibilityHint={isEditing ? '收起输入法时会自动保存。' : '轻点文字位置开始编辑。'}
                placeholderTextColor={theme.inkSoft}
                textAlignVertical="top"
              />
            )}
          </>
        )}

        {hasRaw && !isEditing && !aiCandidate && !showAiTransform && (
          <View style={styles.originalNoteSection}>
            <View style={styles.originalNoteLine}>
              <Text style={styles.originalNoteLabel}>当前笔记经 AI 润色修改</Text>
              <Pressable accessibilityRole="button" onPress={() => setOriginalVisible((current) => !current)}>
                <Text style={styles.originalNoteLink}>{originalVisible ? '收起原始笔记' : '查看原始笔记'}</Text>
              </Pressable>
            </View>
            {originalVisible && <Text style={styles.originalNoteText}>{note.rawText}</Text>}
          </View>
        )}

        {isEditing && aiTransition.phase === AI_TEXT_PHASE.IDLE && (
          <View style={[styles.bottomSpacer, keyboardInset > 0 && styles.keyboardBottomSpacer]} />
        )}
      </ScrollView>
      {isEditing && aiTransition.phase === AI_TEXT_PHASE.IDLE && !aiCandidate && (
        <View style={[styles.keyboardAiBar, { bottom: keyboardAiBarBottom }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="使用 AI 润色笔记"
            accessibilityHint="基于当前编辑内容生成润色候选稿。"
            disabled={!canRunTidy}
            onPress={runTidy}
            style={({ pressed }) => [styles.keyboardAiButton, (pressed || !canRunTidy) && styles.keyboardAiButtonDisabled]}
          >
            <FourPointStar />
            <Text style={styles.keyboardAiButtonText}>AI 润色</Text>
          </Pressable>
        </View>
      )}
      <Modal
        visible={imageViewerOpen && !!note.image?.uri}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setImageViewerOpen(false)}
      >
        <View style={styles.imageViewer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭图片全屏查看"
            onPress={() => setImageViewerOpen(false)}
            style={({ pressed }) => [styles.imageViewerClose, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={metrics.primaryIcon} color={theme.onBrand} />
          </Pressable>
          <Image
            source={{ uri: note.image?.uri }}
            style={styles.fullscreenImage}
            resizeMode="contain"
            accessibilityLabel="笔记附加图片，全屏显示"
          />
          <View style={styles.imageViewerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="更换笔记图片"
              disabled={imageBusy}
              onPress={confirmReplaceImage}
              style={({ pressed }) => [styles.imageViewerAction, (pressed || imageBusy) && styles.imageViewerActionDisabled]}
            >
              <Ionicons name="image-outline" size={metrics.standardIcon} color={theme.onBrand} />
              <Text style={styles.imageViewerActionText}>{imageBusy ? '处理中…' : '更换图片'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="删除笔记图片"
              disabled={imageBusy}
              onPress={confirmRemoveImage}
              style={({ pressed }) => [styles.imageViewerAction, styles.imageViewerDeleteAction, (pressed || imageBusy) && styles.imageViewerActionDisabled]}
            >
              <Ionicons name="trash-outline" size={metrics.standardIcon} color={theme.onBrand} />
              <Text style={styles.imageViewerActionText}>删除图片</Text>
            </Pressable>
          </View>
          {!!imageError && <Text accessibilityLiveRegion="polite" style={styles.imageViewerError}>{imageError}</Text>}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.page, paddingTop: spacing.sm, paddingBottom: BASE_CONTENT_BOTTOM_PADDING },
  metaRow: { minHeight: 40, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { ...type.auxiliary, flex: 1, color: theme.inkSoft },
  tidyMetaAction: { width: 76, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxs },
  tidyMetaActionText: { ...type.auxiliary, color: theme.brand, fontWeight: '700' },
  metaActionDisabled: { opacity: 0.45 },
  aiErrorText: { ...type.auxiliary, marginBottom: spacing.xs, color: theme.destructive },
  aiNoticeText: { ...type.auxiliary, marginBottom: spacing.xs, color: theme.brand },
  imageSection: { marginBottom: spacing.md },
  noteImagePressable: { borderRadius: radius.control, overflow: 'hidden' },
  noteImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: theme.accentSoft },
  imageErrorText: { ...type.auxiliary, marginTop: spacing.xs, color: theme.destructive },
  overflowMenu: { position: 'absolute', zIndex: 4, top: 52, right: spacing.sm, minWidth: 116, borderRadius: radius.control, backgroundColor: theme.surface, ...shadow.control },
  overflowMenuItem: { minHeight: metrics.minTouch, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  overflowMenuText: { ...type.content, color: theme.destructive, fontWeight: '600' },
  candidateOriginalSection: { marginBottom: spacing.lg },
  candidateOriginalLabel: { ...type.auxiliary, marginBottom: spacing.xs, color: theme.inkSoft, fontWeight: '600' },
  candidateOriginalText: { ...type.detailBody, color: theme.ink },
  originalNoteSection: { marginTop: spacing.xl },
  originalNoteLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  originalNoteLabel: { ...type.auxiliary, color: theme.inkSoft },
  originalNoteLink: { ...type.auxiliary, color: theme.ink, fontWeight: '400' },
  originalNoteText: { ...type.content, marginTop: spacing.xs, color: theme.inkSoft },
  keyboardAiBar: { position: 'absolute', zIndex: 3, left: 0, right: 0, height: AI_TOOLBAR_HEIGHT, paddingHorizontal: spacing.page, borderTopWidth: 1, borderTopColor: theme.cardLine, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  keyboardAiButton: { height: AI_TOOLBAR_BUTTON_HEIGHT, paddingHorizontal: spacing.sm, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, transform: [{ translateY: -2 }] },
  keyboardAiButtonDisabled: { opacity: 0.45 },
  keyboardAiButtonText: { ...type.content, color: theme.brand, fontWeight: '700' },
  imageViewer: { flex: 1, backgroundColor: theme.imageViewer, justifyContent: 'center' },
  imageViewerClose: { position: 'absolute', zIndex: 1, top: spacing.lg, right: spacing.md, width: metrics.standardButton, height: metrics.standardButton, borderRadius: metrics.standardButton / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  fullscreenImage: { width: '100%', flex: 1 },
  imageViewerActions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.page, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  imageViewerAction: { ...shadow.control, flex: 1, minHeight: metrics.standardButton, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: theme.brand },
  imageViewerDeleteAction: { backgroundColor: theme.destructive },
  imageViewerActionDisabled: { opacity: 0.5 },
  imageViewerActionText: { ...type.content, color: theme.onBrand, fontWeight: '700' },
  imageViewerError: { ...type.auxiliary, color: theme.destructiveSoft, textAlign: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  editInput: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...type.detailBody,
    color: theme.ink,
  },
  bottomSpacer: { height: 0 },
  keyboardBottomSpacer: { height: spacing.md },
  pressed: { opacity: 0.58 },
});
