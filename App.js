import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, LayoutAnimation, PanResponder, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, UIManager, useWindowDimensions, View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { loadAIKey, saveAIKey } from './src/aiKeyStorage';
import { setRuntimeAIKey } from './src/config.ai';
import ApiKeyDialog from './src/components/ApiKeyDialog';
import CaptureFab from './src/components/CaptureFab';
import HomeHeader, { HOME_HEADER_HEIGHT } from './src/components/HomeHeader';
import { detailRouteReducer, INITIAL_DETAIL_ROUTE } from './src/detailRoutes';
import { buildThemeCards } from './src/presentation';
import { resolveHomeTabSwipe, shouldClaimHomeTabSwipe } from './src/homeTabSwipe';
import NoteDetailScreen from './src/screens/NoteDetailScreen';
import StreamScreen from './src/screens/StreamScreen';
import ThemeDetailScreen from './src/screens/ThemeDetailScreen';
import ThemesScreen from './src/screens/ThemesScreen';
import { metrics, radius, spacing, theme, type } from './src/theme';
import { useNotes } from './src/useNotes';

const NOTE_INSERT_ANIMATION = {
  duration: 540,
  create: {
    type: LayoutAnimation.Types.easeOut,
    property: LayoutAnimation.Properties.scaleY,
  },
  update: {
    type: LayoutAnimation.Types.easeOut,
  },
};

export default function App() {
  const store = useNotes();
  const { width: viewportWidth } = useWindowDimensions();
  const [tab, setTab] = useState('notes');
  const [noteLayout, setNoteLayout] = useState('masonry');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [detailRoute, dispatchDetail] = useReducer(detailRouteReducer, INITIAL_DETAIL_ROUTE);
  const [voiceOverlayActive, setVoiceOverlayActive] = useState(false);
  const [tabSwipeActive, setTabSwipeActive] = useState(false);
  const [aiKey, setAIKey] = useState('');
  const [aiKeyDraft, setAIKeyDraft] = useState('');
  const [aiKeyDialogOpen, setAIKeyDialogOpen] = useState(false);
  const [aiKeySaving, setAIKeySaving] = useState(false);
  const [aiKeyError, setAIKeyError] = useState('');
  const [aiKeyStorageError, setAIKeyStorageError] = useState('');
  const homeScrollY = useRef(new Animated.Value(0)).current;
  const homeTabSwipeX = useRef(new Animated.Value(0)).current;
  const homeScrollOffsetsRef = useRef({
    notes: { list: 0, masonry: 0 },
    themes: 0,
  });
  const onNotesScroll = useCallback(
    (event) => {
      const nextOffset = Math.max(0, event.nativeEvent.contentOffset.y);
      homeScrollOffsetsRef.current.notes[noteLayout] = nextOffset;
      if (tab === 'notes') homeScrollY.setValue(nextOffset);
    },
    [homeScrollY, noteLayout, tab]
  );
  const onThemesScroll = useCallback(
    (event) => {
      const nextOffset = Math.max(0, event.nativeEvent.contentOffset.y);
      homeScrollOffsetsRef.current.themes = nextOffset;
      if (tab === 'themes') homeScrollY.setValue(nextOffset);
    },
    [homeScrollY, tab]
  );
  const themeCards = useMemo(
    () => buildThemeCards(store.themes || [], store.notes || []),
    [store.notes, store.themes]
  );
  const selectedNote = detailRoute?.type === 'note'
    ? store.notes.find((note) => note.id === detailRoute.id) || null
    : null;
  const selectedTheme = detailRoute?.type === 'theme'
    ? themeCards.find((item) => item.id === detailRoute.id) || null
    : null;

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadAIKey()
      .then((storedKey) => {
        if (!active) return;
        setRuntimeAIKey(storedKey);
        setAIKey(storedKey);
        setAIKeyStorageError('');
      })
      .catch((error) => {
        if (!active) return;
        setRuntimeAIKey('');
        setAIKeyStorageError(error?.message || '读取 API Key 失败');
        console.warn('load secure AI key failed', error);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!detailRoute) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dispatchDetail({ type: 'CLOSE' });
      return true;
    });
    return () => subscription.remove();
  }, [detailRoute]);

  useEffect(() => {
    if (detailRoute?.type === 'note' && !selectedNote) dispatchDetail({ type: 'CLOSE' });
    if (detailRoute?.type === 'theme' && !selectedTheme) dispatchDetail({ type: 'CLOSE' });
  }, [detailRoute, selectedNote, selectedTheme]);

  const handleExportBackup = async () => {
    try {
      const result = await store.exportBackup();
      const fileList = result.files.filter((file) => file.kind !== 'image').map((file) => file.name).join('\n');
      const imageSummary = result.imageCount ? `\n已包含 ${result.imageCount} 张图片。` : '';
      Alert.alert(
        '备份已导出',
        `已保存 ${result.noteCount} 条真实笔记。${imageSummary}\n\n${fileList}\n\n目录：${result.directoryUri}`
      );
    } catch (error) {
      console.error('[backup:saf-v4:ui]', error?.message || error, error?.stack || '');
      Alert.alert('备份失败', error?.message || '无法写入本地备份文件，请稍后重试。');
    }
  };

  const openAIKeyDialog = () => {
    setAIKeyDraft(aiKey);
    setAIKeyError(aiKeyStorageError);
    setAIKeyDialogOpen(true);
  };

  const closeAIKeyDialog = () => {
    if (aiKeySaving) return;
    setAIKeyDialogOpen(false);
    setAIKeyDraft('');
    setAIKeyError('');
  };

  const confirmAIKey = async () => {
    if (aiKeySaving) return;
    setAIKeySaving(true);
    setAIKeyError('');
    try {
      const storedKey = await saveAIKey(aiKeyDraft);
      setRuntimeAIKey(storedKey);
      setAIKey(storedKey);
      setAIKeyStorageError('');
      setAIKeyDialogOpen(false);
      setAIKeyDraft('');
      Alert.alert('API Key 已保存', '语音识别和笔记主题整理将使用此 Key。');
    } catch (error) {
      setAIKeyError(error?.message || '保存 API Key 失败，请重试');
    } finally {
      setAIKeySaving(false);
    }
  };

  const handleAddNote = (text, source) => {
    LayoutAnimation.configureNext(NOTE_INSERT_ANIMATION);
    return store.add(text, source);
  };

  const handleTabChange = useCallback((nextTab) => {
    if (nextTab === tab) return;
    const nextOffset = nextTab === 'notes'
      ? homeScrollOffsetsRef.current.notes[noteLayout]
      : homeScrollOffsetsRef.current.themes;
    homeTabSwipeX.stopAnimation();
    homeTabSwipeX.setValue(nextTab === 'notes' ? 0 : -viewportWidth);
    homeScrollY.setValue(nextOffset);
    setSearchFocused(false);
    setTab(nextTab);
  }, [homeScrollY, homeTabSwipeX, noteLayout, tab, viewportWidth]);

  useEffect(() => {
    homeTabSwipeX.stopAnimation();
    homeTabSwipeX.setValue(tab === 'notes' ? 0 : -viewportWidth);
  }, [homeTabSwipeX, tab, viewportWidth]);

  const clampHomeTabSwipe = useCallback((dx) => {
    const directionallyClamped = tab === 'notes' ? Math.min(0, dx) : Math.max(0, dx);
    const tabOrigin = tab === 'notes' ? 0 : -viewportWidth;
    return Math.max(-viewportWidth, Math.min(0, tabOrigin + directionallyClamped));
  }, [tab, viewportWidth]);

  const settleHomeTabSwipe = useCallback((gestureState, shouldResolve = true) => {
    const nextTab = shouldResolve ? resolveHomeTabSwipe(tab, gestureState) : tab;
    const targetX = nextTab === 'notes' ? 0 : -viewportWidth;
    Animated.timing(homeTabSwipeX, {
      toValue: targetX,
      duration: 180,
      useNativeDriver: false,
    }).start(() => {
      if (nextTab !== tab) handleTabChange(nextTab);
      setTabSwipeActive(false);
    });
  }, [handleTabChange, homeTabSwipeX, tab, viewportWidth]);

  const homeTabPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        !voiceOverlayActive
        && !searchFocused
        && shouldClaimHomeTabSwipe(tab, gestureState),
      onPanResponderGrant: (_, gestureState) => {
        setTabSwipeActive(true);
        homeTabSwipeX.stopAnimation();
        homeTabSwipeX.setValue(clampHomeTabSwipe(gestureState.dx));
      },
      onPanResponderMove: (_, gestureState) => {
        homeTabSwipeX.setValue(clampHomeTabSwipe(gestureState.dx));
      },
      onPanResponderRelease: (_, gestureState) => settleHomeTabSwipe(gestureState),
      onPanResponderTerminate: (_, gestureState) => settleHomeTabSwipe(gestureState, false),
      onPanResponderTerminationRequest: () => false,
    }),
    [clampHomeTabSwipe, homeTabSwipeX, searchFocused, settleHomeTabSwipe, tab, voiceOverlayActive]
  );

  const handleLayoutToggle = () => {
    setNoteLayout((current) => {
      const next = current === 'list' ? 'masonry' : 'list';
      homeScrollY.setValue(homeScrollOffsetsRef.current.notes[next]);
      return next;
    });
  };

  const notesScrollOffset = homeScrollOffsetsRef.current.notes[noteLayout];
  const themesScrollOffset = homeScrollOffsetsRef.current.themes;
  const captureOpacity = homeTabSwipeX.interpolate({
    inputRange: [-viewportWidth, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const shouldRenderCapture = tab === 'notes' || tabSwipeActive;

  if (!store.ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ExpoStatusBar style="dark" backgroundColor={theme.bg} translucent={false} />
        <View style={styles.gate}>
          <Text style={styles.gateBrand}>IDEA POCKET</Text>
          <Text style={styles.gateText}>{store.loadError || '正在翻开你的口袋…'}</Text>
          {!!store.loadError && (
            <Pressable style={styles.retry} onPress={store.retryLoad}>
              <Text style={styles.retryText}>重试读取</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ExpoStatusBar
        style={voiceOverlayActive ? 'light' : 'dark'}
        backgroundColor={voiceOverlayActive ? theme.overlay : theme.bg}
        translucent={false}
      />
      {!!store.saveError && (
        <Pressable style={styles.saveWarning} onPress={store.clearSaveError}>
          <Text style={styles.saveWarningText}>{store.saveError}　✕</Text>
        </Pressable>
      )}
      {selectedNote ? (
        <NoteDetailScreen
          note={selectedNote}
          focusOnOpen={detailRoute.focus}
          onBack={() => dispatchDetail({ type: 'CLOSE' })}
          onApplyTidy={store.applyTidy}
          onEdit={store.edit}
          onRemove={store.remove}
          onAttachImage={store.attachImage}
          onRemoveImage={store.removeImage}
        />
      ) : selectedTheme ? (
        <ThemeDetailScreen
          theme={selectedTheme}
          onBack={() => dispatchDetail({ type: 'CLOSE' })}
          onRename={store.updateThemeTitle}
          onRemoveNote={store.removeThemeNote}
          onDissolve={store.dismissTheme}
          onRetain={store.retainTheme}
        />
      ) : (
        <>
          <View style={styles.homeContent}>
            <HomeHeader
              tab={tab}
              onChange={handleTabChange}
              scrollY={homeScrollY}
              topInset={0}
              overlayActive={voiceOverlayActive}
              layoutMode={noteLayout}
              onToggleLayout={handleLayoutToggle}
              onExportBackup={handleExportBackup}
              onConfigureAIKey={openAIKeyDialog}
              aiKeyConfigured={Boolean(aiKey)}
              backupRunning={store.backupStatus === 'running'}
            />
            <View style={styles.body} {...homeTabPanResponder.panHandlers}>
              <View style={styles.tabSwipeViewport}>
                <Animated.View
                  style={[
                    styles.tabSwipeTrack,
                    { width: viewportWidth * 2, transform: [{ translateX: homeTabSwipeX }] },
                  ]}
                >
                  <View
                    pointerEvents={tab === 'notes' && !tabSwipeActive ? 'auto' : 'none'}
                    style={[styles.tabSwipePage, { width: viewportWidth }]}
                  >
                    <StreamScreen
                      store={store}
                      layoutMode={noteLayout}
                      searchQuery={searchQuery}
                      onSearchQueryChange={setSearchQuery}
                      onSearchFocusChange={setSearchFocused}
                      contentTopInset={HOME_HEADER_HEIGHT}
                      initialScrollOffset={notesScrollOffset}
                      onScroll={onNotesScroll}
                      onOpenNote={(id, options) => dispatchDetail({ type: 'OPEN_NOTE', id, focus: options?.focus })}
                    />
                  </View>
                  <View
                    pointerEvents={tab === 'themes' && !tabSwipeActive ? 'auto' : 'none'}
                    style={[styles.tabSwipePage, { width: viewportWidth }]}
                  >
                    <ThemesScreen
                      store={store}
                      contentTopInset={HOME_HEADER_HEIGHT}
                      initialScrollOffset={themesScrollOffset}
                      onScroll={onThemesScroll}
                      onOpenTheme={(id) => dispatchDetail({ type: 'OPEN_THEME', id })}
                    />
                  </View>
                </Animated.View>
              </View>
            </View>
          </View>
          {shouldRenderCapture && (
            <CaptureFab
              onSubmit={handleAddNote}
              onOverlayChange={setVoiceOverlayActive}
              presentationOpacity={captureOpacity}
            />
          )}
        </>
      )}
      <ApiKeyDialog
        visible={aiKeyDialogOpen}
        value={aiKeyDraft}
        saving={aiKeySaving}
        error={aiKeyError}
        onChange={(value) => {
          setAIKeyDraft(value);
          if (aiKeyError) setAIKeyError('');
        }}
        onCancel={closeAIKeyDialog}
        onConfirm={confirmAIKey}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  homeContent: { flex: 1 },
  body: { flex: 1 },
  tabSwipeViewport: { flex: 1, overflow: 'hidden' },
  tabSwipeTrack: { height: '100%', flexDirection: 'row', flexShrink: 0 },
  tabSwipePage: { height: '100%', flexShrink: 0 },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  gateBrand: {
    ...type.brandLogo,
    color: theme.brand,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  gateText: { ...type.content, color: theme.inkSoft, textAlign: 'center' },
  retry: {
    minHeight: metrics.standardButton,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: theme.accent,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { ...type.content, color: theme.onBrand, fontWeight: '600' },
  saveWarning: { minHeight: metrics.minTouch, backgroundColor: theme.destructive, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  saveWarningText: { ...type.auxiliary, color: theme.onBrand, textAlign: 'center' },
});
