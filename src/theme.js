import { Platform } from 'react-native';

// L 级视觉换肤：冷白底色 + 蓝色主色，保留现有的空间、触控和排版尺度。
export const theme = {
  bg: '#F7F8FC',
  surface: '#FFFFFF',
  ink: '#1C2333',
  inkSoft: '#737B8D',
  inkMuted: '#A5ADBD',
  brand: '#2F6FED',
  brandPressed: '#245FD2',
  accent: '#2F6FED',
  accentSoft: '#EDF3FF',
  cardLine: '#EEF1F6',
  line: '#E8ECF3',
  fresh: '#3E8D67',
  wilting: '#C17845',
  compost: '#929AAA',
  planted: '#2E7A65',
  destructive: '#D94C54',
  destructiveSoft: '#FFF1F2',
  overlay: '#111827',
  overlaySoft: 'rgba(17,24,39,0.58)',
  onBrand: '#FFFFFF',
  imageViewer: '#111827',
};

// RN 0.81 的 boxShadow 在 New Architecture + Android 9+ 上支持颜色、模糊与扩散；
// 低版本 Android 仍退回 elevation，避免旧设备完全没有层次。
const canUseAndroidBoxShadow = Platform.OS === 'android' && Number(Platform.Version) >= 28;
const androidOutsetShadow = (boxShadow, fallbackElevation) => {
  if (Platform.OS !== 'android') return {};
  return canUseAndroidBoxShadow ? { boxShadow, elevation: 0 } : { elevation: fallbackElevation };
};

export const shadow = {
  card: {
    shadowColor: '#213456',
    shadowOpacity: 0.055,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    ...androidOutsetShadow('0px 12px 32px 2px rgba(45, 61, 91, 0.08)', 4),
  },
  control: {
    shadowColor: '#213456',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    ...androidOutsetShadow('0px 10px 28px 1px rgba(45, 61, 91, 0.075)', 3),
  },
  floating: {
    shadowColor: '#1C3E86',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  sheet: {
    shadowColor: '#111827',
    shadowOpacity: 0.1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: -8 },
    ...androidOutsetShadow('0px -10px 30px 0px rgba(17, 24, 39, 0.1)', 6),
  },
};

// iOS HIG 对齐：正文以 17pt 为基准、交互控件至少 44pt，并沿用 8pt 空间节奏。
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  page: 12,
};

export const type = {
  pageTitle: { fontSize: 18, lineHeight: 24 },
  sectionTitle: { fontSize: 16, lineHeight: 22 },
  content: { fontSize: 15, lineHeight: 22 },
  detailBody: { fontSize: 17, lineHeight: 26 },
  auxiliary: { fontSize: 12, lineHeight: 16 },
  brandLogo: { fontSize: 20, lineHeight: 24 },
};

export const metrics = {
  minTouch: 44,
  standardButton: 48,
  primaryButton: 56,
  smallIcon: 14,
  standardIcon: 20,
  primaryIcon: 24,
};

export const radius = {
  control: 12,
  card: 16,
  pill: 999,
  sheet: 24,
};
