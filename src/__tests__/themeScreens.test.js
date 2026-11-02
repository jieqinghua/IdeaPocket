import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert, FlatList, Pressable, Switch, Text, TextInput } from 'react-native';
import ThemeEditor from '../components/ThemeEditor';
import ThemeDetailScreen from '../screens/ThemeDetailScreen';
import ThemesScreen from '../screens/ThemesScreen';
import { migrateThemeState } from '../themeModel';

jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: () => null }));
const notes = [{ id: 'a', text: '当前正文', createdAt: 1 }, { id: 'b', text: '可加入正文', createdAt: 2 }, { id: 'demo', text: '演示正文', demo: true }];
let tree;
const mount = async (element) => { await act(async () => { tree = renderer.create(element); }); };
const pressables = () => tree.root.findAll((node) => typeof node.props.onPress === "function");
const button = (label) => pressables().find((node) => node.props.accessibilityLabel === label);
const content = () => tree.root.findAllByType(Text).flatMap((node) => [node.props.children].flat()).filter((value) => typeof value === 'string').join(' ');
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; jest.restoreAllMocks(); });

test('人工创建需要名称和来源，列表排除演示笔记', async () => {
  const save = jest.fn(); await mount(<ThemeEditor mode="create" notes={notes} onSave={save} />);
  const choices = tree.root.findByType(FlatList).props.data;
  expect(choices.map((note) => note.id)).toEqual(['a', 'b']);
  let saveButton = pressables().find((node) => 'disabled' in node.props);
  expect(saveButton.props.disabled).toBe(true);
  await act(async () => {
    tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === '主题名称').props.onChangeText('我的主题');
    pressables().find((node) => node.props.accessibilityLabel === '选择笔记：当前正文').props.onPress();
  });
  saveButton = pressables().find((node) => 'disabled' in node.props);
  expect(saveButton.props.disabled).toBe(false);
  await act(async () => saveButton.props.onPress());
  expect(save).toHaveBeenCalledWith({ title: '我的主题', scope: '', summary: '', ids: ['a'] });
});

test('详情呈现真实摘要来源、待更新状态和历史快照，纠偏入口连接存储', async () => {
  const store = { notes, themeUndoActions: [{ themeId: 't' }], themeSnapshots: { old: { text: '修改前正文' } }, updateThemeScope: jest.fn(), setThemeAutoJoin: jest.fn(), undoTheme: jest.fn(), addThemeNote: jest.fn() };
  const item = { ...migrateThemeState({ themes: [{ id: 't', title: '我的主题', noteIds: ['a'], summary: '本地摘录', summarySource: 'local', summaryStale: true, scope: '研究问题', revisions: [{ versionId: 'v1', noteIds: ['a'], sourceRefs: { a: 'old' }, summary: '以前摘要', summarySource: 'ai', title: '以前主题', reason: '来源正文已修改', recordedAt: 1 }] }] }).themes[0], notes: [notes[0]] };
  await mount(<ThemeDetailScreen theme={item} store={store} />);
  expect(content()).toContain('本地来源摘录'); expect(content()).toContain('摘要待更新');
  await act(async () => button('变化记录（1） · 展开').props.onPress());
  expect(content()).toContain('修改前正文');
  await act(async () => button('撤销最近调整').props.onPress());
  expect(store.undoTheme).toHaveBeenCalledWith('t');
  await act(async () => tree.root.findByType(Switch).props.onValueChange(false));
  expect(store.setThemeAutoJoin).toHaveBeenCalledWith('t', false);
  await act(async () => button('编辑范围').props.onPress());
  const editor = tree.root.findByType(ThemeEditor);
  await act(async () => editor.props.onSave({ scope: '新的具体问题' }));
  expect(store.updateThemeScope).toHaveBeenCalledWith('t', '新的具体问题');
});

test('隐藏主题可恢复，抑制方向独立于隐藏', async () => {
  const store = { notes, themeUndoActions: [], themeSnapshots: {}, restoreTheme: jest.fn(), suppressTheme: jest.fn() };
  const item = { ...migrateThemeState({ themes: [{ id: 't', status: 'dismissed', noteIds: ['a'], suppressed: false }] }).themes[0], notes: [notes[0]] };
  await mount(<ThemeDetailScreen theme={item} store={store} />);
  expect(button('改名')).toBeUndefined();
  const restore = pressables().find((node) => node.findAllByType(Text).some((text) => text.props.children === '恢复主题'));
  await act(async () => { restore.props.onPress(); tree.root.findByType(Switch).props.onValueChange(true); });
  expect(store.restoreTheme).toHaveBeenCalledWith('t');
  expect(store.suppressTheme).toHaveBeenCalledWith('t', true);
});

test('主题页启用自动分析前说明联网，候选与隐藏有独立入口', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const themes = migrateThemeState({ themes: [{ id: 'c', status: 'candidate', noteIds: ['a', 'b'] }, { id: 'h', status: 'dismissed', noteIds: ['a'] }] }).themes;
  const store = { themes, notes, pendingThemeCount: 2, analysisNoteCount: 2, setAutoThemes: jest.fn(), themeStatus: 'idle' };
  await mount(<ThemesScreen store={store} />);
  expect(tree.root.findByType(FlatList).props.data.some((item) => item.section?.includes('候选'))).toBe(true);
  expect(tree.root.findByType(FlatList).props.data.some((item) => item.id === 'h')).toBe(false);
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  expect(store.setAutoThemes).not.toHaveBeenCalled();
  expect(alert.mock.calls[0][1]).toContain('DeepSeek');
  await act(async () => alert.mock.calls[0][2][1].onPress());
  expect(store.setAutoThemes).toHaveBeenCalledWith(true);
  const toggle = button('展开已隐藏主题');
  await act(async () => toggle.props.onPress());
  expect(tree.root.findByType(FlatList).props.data.some((item) => item.id === 'h')).toBe(true);
});
