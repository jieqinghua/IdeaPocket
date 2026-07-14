import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { metrics, radius, shadow, spacing, theme, type } from '../theme';

const wordmark = require('../assets/images/ideapocket-wordmark.png');
const BRAND_SECTION_HEIGHT = spacing.lg + 24 + spacing.sm;
const NAVIGATION_BOTTOM_GAP = spacing.sm;
const NAVIGATION_SECTION_HEIGHT = metrics.minTouch + 1 + NAVIGATION_BOTTOM_GAP;
export const HOME_HEADER_HEIGHT = BRAND_SECTION_HEIGHT + NAVIGATION_SECTION_HEIGHT;

const TABS = [
  { key: 'notes', label: '笔记' },
  { key: 'themes', label: '主题', icon: 'sparkles-outline' },
];

export default function HomeHeader({
  tab,
  onChange,
  scrollY,
  topInset = 0,
  overlayActive = false,
  layoutMode = 'list',
  onToggleLayout,
  onExportBackup,
  onConfigureAIKey,
  aiKeyConfigured = false,
  backupRunning = false,
}) {
  const masonryActive = layoutMode === 'masonry';
  const menuButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTop, setMenuTop] = useState(HOME_HEADER_HEIGHT);
  const translateY = scrollY.interpolate({
    inputRange: [0, BRAND_SECTION_HEIGHT],
    outputRange: [0, -BRAND_SECTION_HEIGHT],
    extrapolate: 'clamp',
  });
  const brandOpacity = scrollY.interpolate({
    inputRange: [0, BRAND_SECTION_HEIGHT * 0.65, BRAND_SECTION_HEIGHT],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });
  const openMenu = () => {
    const show = (top = HOME_HEADER_HEIGHT) => {
      setMenuTop(top);
      setMenuOpen(true);
    };
    if (!menuButtonRef.current?.measureInWindow) {
      show();
      return;
    }
    menuButtonRef.current.measureInWindow((_x, y, _width, height) => show(y + height + spacing.xxs));
  };
  const chooseMenuAction = (action) => {
    setMenuOpen(false);
    action?.();
  };

  return (
    <View
      pointerEvents={overlayActive ? 'none' : 'box-none'}
      style={[styles.header, { top: topInset }, overlayActive && styles.headerUnderOverlay]}
    >
      <Animated.View
        style={[
          styles.brandSection,
          { opacity: brandOpacity, transform: [{ translateY }] },
        ]}
      >
        <Image
          source={wordmark}
          accessibilityLabel="IdeaPocket"
          resizeMode="contain"
          style={styles.brand}
        />
      </Animated.View>
      <Animated.View style={[styles.navigationSection, { transform: [{ translateY }] }]}>
        <View style={styles.navigationRow}>
          <View style={styles.tabs} accessibilityRole="tablist">
            {TABS.map((item) => {
              const active = tab === item.key;
              const color = active ? theme.brand : theme.inkSoft;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${item.label}页`}
                  onPress={() => onChange(item.key)}
                  style={({ pressed }) => [
                    styles.tab,
                    active && styles.tabActive,
                    pressed && styles.tabPressed,
                  ]}
                >
                  {!!item.icon && (
                    <Ionicons
                      name={active ? 'sparkles' : item.icon}
                      size={metrics.smallIcon}
                      color={color}
                    />
                  )}
                  <Text style={[styles.tabText, { color }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actions}>
            {tab === 'notes' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={masonryActive ? '切换为列表' : '切换为双列瀑布流'}
                accessibilityHint="更改首页笔记卡片的排列方式"
                accessibilityState={{ selected: masonryActive }}
                hitSlop={4}
                onPress={onToggleLayout}
                style={({ pressed }) => [styles.iconButton, pressed && styles.tabPressed]}
              >
                <Ionicons
                  name={masonryActive ? 'list-outline' : 'grid-outline'}
                  size={metrics.standardIcon}
                  color={theme.brand}
                />
              </Pressable>
            )}
            <Pressable
              ref={menuButtonRef}
              accessibilityRole="button"
              accessibilityLabel="更多选项"
              accessibilityState={{ expanded: menuOpen }}
              hitSlop={4}
              onPress={openMenu}
              style={({ pressed }) => [styles.iconButton, pressed && styles.tabPressed]}
            >
              <Ionicons name="ellipsis-horizontal" size={metrics.standardIcon} color={theme.brand} />
            </Pressable>
          </View>
        </View>
        <View style={styles.rule} />
      </Animated.View>
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.menuModal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭更多选项"
            onPress={() => setMenuOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityRole="menu" style={[styles.menu, { top: menuTop }]}>
            <Pressable
              accessibilityRole="menuitem"
              accessibilityState={{ disabled: backupRunning }}
              disabled={backupRunning}
              onPress={() => chooseMenuAction(onExportBackup)}
              style={({ pressed }) => [
                styles.menuItem,
                backupRunning && styles.iconButtonDisabled,
                pressed && styles.tabPressed,
              ]}
            >
              <Ionicons name="download-outline" size={metrics.standardIcon} color={theme.ink} />
              <Text style={styles.menuItemText}>{backupRunning ? '正在导出…' : '导出笔记'}</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => chooseMenuAction(onConfigureAIKey)}
              style={({ pressed }) => [styles.menuItem, pressed && styles.tabPressed]}
            >
              <Ionicons name="key-outline" size={metrics.standardIcon} color={theme.ink} />
              <Text style={styles.menuItemText}>{aiKeyConfigured ? '修改 API Key' : '配置 API Key'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    right: 0,
    left: 0,
    height: HOME_HEADER_HEIGHT,
    zIndex: 10,
    elevation: 10,
  },
  headerUnderOverlay: {
    zIndex: 0,
    elevation: 0,
  },
  brandSection: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: BRAND_SECTION_HEIGHT,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.page,
    backgroundColor: theme.bg,
  },
  brand: {
    width: 156,
    height: 24,
    tintColor: theme.brand,
  },
  navigationSection: {
    position: 'absolute',
    top: BRAND_SECTION_HEIGHT,
    right: 0,
    left: 0,
    height: NAVIGATION_SECTION_HEIGHT,
    backgroundColor: theme.bg,
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: metrics.minTouch,
    paddingHorizontal: spacing.page,
  },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    minWidth: 84,
    minHeight: metrics.minTouch,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  tabActive: { borderRadius: radius.pill, backgroundColor: theme.accentSoft },
  tabPressed: { opacity: 0.78 },
  tabText: { ...type.pageTitle, fontWeight: '600' },
  actions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: metrics.minTouch,
    height: metrics.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: { opacity: 0.45 },
  menuModal: { flex: 1 },
  menu: {
    position: 'absolute',
    right: spacing.page,
    minWidth: 184,
    paddingVertical: spacing.xxs,
    borderRadius: radius.control,
    backgroundColor: theme.surface,
    ...shadow.control,
  },
  menuItem: {
    minHeight: metrics.standardButton,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuItemText: { ...type.content, color: theme.ink, fontWeight: '600' },
  menuDivider: { height: 1, marginHorizontal: spacing.md, backgroundColor: theme.line },
  rule: { height: 1, backgroundColor: 'transparent' },
});
