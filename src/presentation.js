export function sortNotesNewestFirst(notes) {
  return [...notes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

const pad2 = (value) => String(value).padStart(2, '0');

const THEME_TONES = [
  { color: '#2F6FED', backgroundColor: '#EDF3FF' },
  { color: '#536FD6', backgroundColor: '#EEF0FF' },
  { color: '#377E72', backgroundColor: '#ECF7F4' },
  { color: '#63738A', backgroundColor: '#EEF2F6' },
  { color: '#8059C4', backgroundColor: '#F4F0FF' },
  { color: '#A96D2D', backgroundColor: '#FFF4E8' },
];

export const THEME_VISUALS = [
  { icon: 'compass-outline', tone: 0, keywords: ['产品', '定位', '策略', '路线图', '竞品'] },
  { icon: 'people-outline', tone: 1, keywords: ['用户', '访谈', '调研', '需求', '洞察'] },
  { icon: 'color-palette-outline', tone: 4, keywords: ['设计', '交互', '界面', '体验', '视觉'] },
  { icon: 'code-slash-outline', tone: 3, keywords: ['开发', '代码', '前端', '后端', '功能'] },
  { icon: 'hardware-chip-outline', tone: 3, keywords: ['架构', '系统', '服务', '数据库', '性能'] },
  { icon: 'bug-outline', tone: 1, keywords: ['bug', '报错', '测试', '修复', '异常'] },
  { icon: 'checkmark-done-circle-outline', tone: 0, keywords: ['任务', '排期', '交付', '待办', '推进'] },
  { icon: 'people-circle-outline', tone: 4, keywords: ['会议', '沟通', '协作', '同步', '团队'] },
  { icon: 'analytics-outline', tone: 3, keywords: ['数据', '指标', '报表', '实验', '复盘'] },
  { icon: 'trending-up-outline', tone: 0, keywords: ['增长', '转化', '留存', '运营', '活动'] },
  { icon: 'megaphone-outline', tone: 1, keywords: ['文案', '品牌', '传播', '营销', '社媒'] },
  { icon: 'wallet-outline', tone: 5, keywords: ['预算', '收入', '成本', '商业', '财务'] },
  { icon: 'sparkles-outline', tone: 0, keywords: ['ai', '模型', '智能体', '自动化', '提示词'] },
  { icon: 'book-outline', tone: 3, keywords: ['学习', '阅读', '知识', '课程', '笔记'] },
  { icon: 'school-outline', tone: 4, keywords: ['作业', '考试', '复习', '论文', '课堂'] },
  { icon: 'briefcase-outline', tone: 5, keywords: ['求职', '简历', '面试', '晋升', '职业'] },
  { icon: 'bulb-outline', tone: 5, keywords: ['灵感', '创意', '脑暴', '写作', '点子'] },
  { icon: 'calendar-outline', tone: 0, keywords: ['日程', '习惯', '目标', '计划', '安排'] },
  { icon: 'fitness-outline', tone: 2, keywords: ['健身', '跑步', '饮食', '睡眠', '健康'] },
  { icon: 'airplane-outline', tone: 5, keywords: ['旅行', '出行', '城市', '攻略', '见闻'] },
  { icon: 'chatbubbles-outline', tone: 4, keywords: ['家庭', '朋友', '关系', '聊天', '社交'] },
  { icon: 'heart-outline', tone: 1, keywords: ['日记', '感受', '反思', '情绪', '心理'] },
  { icon: 'musical-notes-outline', tone: 4, keywords: ['音乐', '电影', '游戏', '艺术', '文化'] },
  { icon: 'cart-outline', tone: 5, keywords: ['购物', '家居', '咖啡', '美食', '消费'] },
];

const DEFAULT_THEME_VISUAL = {
  icon: 'folder-outline',
  ...THEME_TONES[0],
};

const normalizedText = (value) => String(value || '').trim().toLowerCase();

export function getThemeCardVisual(title, summary) {
  const normalizedTitle = normalizedText(title);
  const normalizedSummary = normalizedText(summary);
  let best = null;

  THEME_VISUALS.forEach((visual, index) => {
    const score = visual.keywords.reduce((total, keyword) => {
      const normalizedKeyword = normalizedText(keyword);
      return total
        + (normalizedTitle.includes(normalizedKeyword) ? 2 : 0)
        + (normalizedSummary.includes(normalizedKeyword) ? 1 : 0);
    }, 0);
    if (!best || score > best.score) best = { visual, index, score };
  });

  if (!best?.score) return DEFAULT_THEME_VISUAL;
  return {
    icon: best.visual.icon,
    ...THEME_TONES[best.visual.tone],
  };
}

export function getThemeGeneratedAt(theme) {
  return theme?.createdAt || theme?.updatedAt || 0;
}

export function formatRelativeThemeDate(timestamp, now = Date.now()) {
  const date = new Date(timestamp);
  const reference = new Date(now);
  if (!timestamp || Number.isNaN(date.getTime()) || Number.isNaN(reference.getTime())) return '';

  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const dayOffset = Math.round((dateDay - referenceDay) / 86400000);
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  if (dayOffset === 0) return `今天 ${time}`;
  if (dayOffset === -1) return `昨天 ${time}`;
  if (date.getFullYear() === reference.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatNoteDate(timestamp) {
  const date = new Date(timestamp);
  if (!timestamp || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function hasAiTidy(note) {
  return !!note?.rawText && note.rawText !== note.text;
}

function buildLegacyThemeCards(notes) {
  const themes = new Map();

  notes.forEach((note) => {
    if (!note.themeId) return;
    const current = themes.get(note.themeId) || {
      id: note.themeId,
      title: note.themeTitle || '未命名主题',
      summary: note.themeSummary || '',
      notes: [],
      updatedAt: 0,
    };
    current.notes.push(note);
    current.updatedAt = Math.max(current.updatedAt, note.lastTouched || note.createdAt || 0);
    if (note.themeTitle) current.title = note.themeTitle;
    if (note.themeSummary) current.summary = note.themeSummary;
    themes.set(note.themeId, current);
  });

  return [...themes.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function buildThemeCards(themesOrNotes, notes) {
  if (!Array.isArray(notes)) return buildLegacyThemeCards(themesOrNotes || []);
  const notesById = new Map(notes.map((note) => [note.id, note]));
  return (themesOrNotes || [])
    .filter((item) => !item.dismissed)
    .map((item) => ({
      ...item,
      notes: (item.noteIds || []).map((id) => notesById.get(id)).filter(Boolean),
    }))
    .filter((item) => item.notes.length >= 1)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
