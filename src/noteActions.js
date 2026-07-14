import { CONFIG } from './config';

let sequence = 0;

export const makeNoteId = (now = Date.now()) =>
  `${now.toString(36)}-${(sequence++).toString(36)}`;

export const bumpStrength = (strength) =>
  Math.min((strength || 1) + 1, CONFIG.STRENGTH_CAP);

export function addNote(notes, text, source = 'text', now = Date.now(), id = makeNoteId(now)) {
  const value = (text || '').trim();
  if (!value) return notes;
  return [
    {
      id,
      text: value,
      createdAt: now,
      lastTouched: now,
      strength: 1,
      planted: false,
      source,
    },
    ...notes,
  ];
}

export function waterNote(notes, id, now = Date.now()) {
  return notes.map((note) =>
    note.id === id
      ? { ...note, lastTouched: now, strength: bumpStrength(note.strength) }
      : note
  );
}

export function plantNote(notes, id, now = Date.now()) {
  return notes.map((note) =>
    note.id === id
      ? {
          ...note,
          planted: !note.planted,
          lastTouched: now,
          strength: note.planted ? note.strength : bumpStrength(note.strength),
        }
      : note
  );
}

export function editNote(notes, id, text, now = Date.now()) {
  const value = (text || '').trim();
  if (!value) return notes;
  return notes.map((note) =>
    note.id === id
      ? { ...note, text: value, lastTouched: now, strength: bumpStrength(note.strength) }
      : note
  );
}

export function setNoteImage(notes, id, image, now = Date.now()) {
  if (!image?.uri || !image?.fileName) return notes;
  return notes.map((note) =>
    note.id === id
      ? {
          ...note,
          image,
          lastTouched: now,
          strength: bumpStrength(note.strength),
        }
      : note
  );
}

export function removeNoteImage(notes, id, now = Date.now()) {
  return notes.map((note) => {
    if (note.id !== id || !note.image) return note;
    const { image, ...withoutImage } = note;
    return {
      ...withoutImage,
      lastTouched: now,
      strength: bumpStrength(note.strength),
    };
  });
}

export function applyTidyToNote(notes, id, tidiedText, now = Date.now()) {
  const value = (tidiedText || '').trim();
  if (!value) return notes;
  return notes.map((note) =>
    note.id === id
      ? {
          ...note,
          rawText: note.rawText ?? note.text,
          text: value,
          lastTouched: now,
          strength: bumpStrength(note.strength),
        }
      : note
  );
}

export function deleteNote(notes, id, now = Date.now()) {
  return notes.map((note) =>
    note.id === id
      ? { ...note, deletedAt: now, lastTouched: now }
      : note
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WELCOME_NOTES = [
  '欢迎来到 IdeaPocket。想到什么就先记下来，整理可以留到以后。',
  '轻点底部输入区可以打字；长按麦克风，把一闪而过的想法直接说出来。',
  '打开一条笔记可以用 AI 整理内容，也可以随时编辑、种下或删除它。',
  '积累至少 3 条笔记后，可以在主题页手动分析全部内容，把相关想法聚合成主题。',
];

export function createWelcomeNotes(now = Date.now()) {
  return WELCOME_NOTES.map((text, index) => {
    const timestamp = now - (WELCOME_NOTES.length - index) * 60 * 1000;
    return {
      id: `welcome-${now}-${index}`,
      text,
      createdAt: timestamp,
      lastTouched: timestamp,
      strength: 1,
      planted: false,
      source: 'text',
      welcome: true,
    };
  }).reverse();
}

const DEMO_NOTES = [
  {
    text: '把“会遗忘”做成一个可以调节的旋钮，而不是一个删除按钮。',
    ageDays: 18,
  },
  {
    text: '以后也许可以把散落的念头按季节收成，看看最近反复在想什么。',
    ageDays: 35,
  },
  {
    text: '试试把语音入口放到拇指最顺手的位置，记录应该比整理更快。',
    ageDays: 62,
  },
  {
    text: '周末想去一条没有导航也能慢慢走的旧街区。',
    ageDays: 120,
  },
];

export function seedDemoNotes(notes, now = Date.now()) {
  if (notes.some((note) => note.demo)) return notes;
  const demoNotes = DEMO_NOTES.map((item, index) => {
    const timestamp = now - item.ageDays * DAY_MS;
    return {
      id: `demo-${now}-${index}`,
      text: item.text,
      createdAt: timestamp,
      lastTouched: timestamp,
      strength: 1,
      planted: false,
      source: 'text',
      demo: true,
    };
  });
  return [...demoNotes, ...notes];
}

export function clearDemoNotes(notes) {
  return notes.filter((note) => !note.demo);
}
