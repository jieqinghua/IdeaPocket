import { CONFIG } from '../config';
import {
  addNote,
  applyTidyToNote,
  clearDemoNotes,
  createWelcomeNotes,
  deleteNote,
  editNote,
  removeNoteImage,
  plantNote,
  seedDemoNotes,
  setNoteImage,
  waterNote,
} from '../noteActions';

const base = {
  id: 'n1',
  text: '嗯 原文',
  createdAt: 1,
  lastTouched: 1,
  strength: 1,
  planted: false,
  source: 'text',
};

test('add 会清理空白并保留来源', () => {
  const notes = addNote([], '  新想法  ', 'voice', 10, 'fixed');
  expect(notes[0]).toMatchObject({ id: 'fixed', text: '新想法', source: 'voice', strength: 1 });
  expect(addNote(notes, '   ')).toBe(notes);
});

test('water 更新接触时间且 strength 不超过上限', () => {
  const notes = waterNote([{ ...base, strength: CONFIG.STRENGTH_CAP }], 'n1', 20);
  expect(notes[0]).toMatchObject({ lastTouched: 20, strength: CONFIG.STRENGTH_CAP });
});

test('首次种下增加 strength，取消多年生不重复增加', () => {
  const planted = plantNote([base], 'n1', 20)[0];
  expect(planted).toMatchObject({ planted: true, strength: 2, lastTouched: 20 });
  const unplanted = plantNote([planted], 'n1', 30)[0];
  expect(unplanted).toMatchObject({ planted: false, strength: 2, lastTouched: 30 });
});

test('采用整理结果只在首次保存原文', () => {
  const first = applyTidyToNote([base], 'n1', '整理后', 20)[0];
  const second = applyTidyToNote([first], 'n1', '再次整理', 30)[0];
  expect(first.rawText).toBe(base.text);
  expect(second.rawText).toBe(base.text);
  expect(second.text).toBe('再次整理');
});

test('先编辑再整理会把本次编辑稿保存为原文', () => {
  const edited = editNote([base], 'n1', '本次送给 AI 的原文', 20);
  const tidied = applyTidyToNote(edited, 'n1', 'AI 整理后的文字', 30)[0];
  expect(tidied.rawText).toBe('本次送给 AI 的原文');
  expect(tidied.text).toBe('AI 整理后的文字');
});

test('编辑会清理空白并拒绝空文本', () => {
  const edited = editNote([base], 'n1', '  修改后  ', 40);
  expect(edited[0]).toMatchObject({ text: '修改后', lastTouched: 40, strength: 2 });
  expect(editNote(edited, 'n1', '   ', 50)).toBe(edited);
});

test('添加、替换和移除图片只变更附件及笔记活跃时间', () => {
  const firstImage = {
    uri: 'file:///documents/IdeaPocketImages/n1-a.jpg',
    fileName: 'n1-a.jpg',
    width: 1600,
    height: 1200,
    mimeType: 'image/jpeg',
  };
  const attached = setNoteImage([base], 'n1', firstImage, 20)[0];
  expect(attached).toMatchObject({ image: firstImage, text: base.text, lastTouched: 20, strength: 2 });

  const replacement = { ...firstImage, uri: 'file:///documents/IdeaPocketImages/n1-b.jpg', fileName: 'n1-b.jpg' };
  const replaced = setNoteImage([attached], 'n1', replacement, 30)[0];
  expect(replaced).toMatchObject({ image: replacement, lastTouched: 30, strength: 3 });

  const removed = removeNoteImage([replaced], 'n1', 40)[0];
  expect(removed).not.toHaveProperty('image');
  expect(removed).toMatchObject({ text: base.text, lastTouched: 40, strength: 4 });
});

test('无效图片或没有附件的移除不改变笔记', () => {
  const notes = [base];
  expect(setNoteImage(notes, 'n1', { uri: 'file:///a.jpg' }, 20)).toBe(notes);
  expect(removeNoteImage(notes, 'n1', 20)[0]).toEqual(base);
});

test('删除采用软删除并保留原始内容', () => {
  const deleted = deleteNote([base], 'n1', 60);
  expect(deleted[0]).toMatchObject({
    id: 'n1',
    text: base.text,
    deletedAt: 60,
    lastTouched: 60,
  });
});

test('欢迎笔记用于首次安装，并简要介绍核心功能', () => {
  const notes = createWelcomeNotes(1000);
  expect(notes).toHaveLength(4);
  expect(notes.map((note) => note.text).join('\n')).toMatch(/麦克风/);
  expect(notes.map((note) => note.text).join('\n')).toMatch(/AI 整理/);
  expect(notes.map((note) => note.text).join('\n')).toMatch(/主题/);
  expect(notes.every((note) => note.welcome && !note.demo)).toBe(true);
});

test('演示数据可载入且可完整清除，不影响真实笔记', () => {
  const now = Date.UTC(2026, 6, 3);
  const seeded = seedDemoNotes([base], now);
  expect(seeded.filter((note) => note.demo)).toHaveLength(4);
  expect(seedDemoNotes(seeded, now + 1)).toBe(seeded);
  expect(clearDemoNotes(seeded)).toEqual([base]);
});
