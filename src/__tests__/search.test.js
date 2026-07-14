import { matchesNoteQuery, normalizeSearchText, searchNotes } from '../search';

const note = { text: '整理后的内容', rawText: '嗯 原始灵感' };

test('可检索整理后的文本和原文', () => {
  expect(matchesNoteQuery(note, '整理')).toBe(true);
  expect(matchesNoteQuery(note, '原始')).toBe(true);
  expect(matchesNoteQuery(note, '不存在')).toBe(false);
});

test('归一化全半角、空格和常见标点', () => {
  expect(normalizeSearchText(' Ｐｒｏｄｕｃｔ， 调研！ ')).toBe('product调研');
  expect(matchesNoteQuery({ text: 'Product 调研' }, 'ｐｒｏｄｕｃｔ，调研')).toBe(true);
});

test('精确命中优先于原始转写和模糊结果，同分按时间倒序', () => {
  const results = searchNotes([
    { id: 'raw', text: '整理后的内容', rawText: '用户调研记录', createdAt: 100 },
    { id: 'older', text: '用户调研计划', createdAt: 200 },
    { id: 'newer', text: '用户调研问题', createdAt: 300 },
    { id: 'fuzzy', text: '用户调查笔记', createdAt: 400 },
  ], '用户调研');

  expect(results.map((result) => result.note.id)).toEqual(['newer', 'older', 'raw', 'fuzzy']);
  expect(results[2].matchFields).toEqual(['rawText']);
});

test('支持轻微错别字，但单字查询仅做精确匹配', () => {
  const notes = [
    { id: 'typo', text: '用户调研问题', createdAt: 100 },
    { id: 'other', text: '产品设计讨论', createdAt: 200 },
  ];

  expect(searchNotes(notes, '用户调査').map((result) => result.note.id)).toContain('typo');
  expect(searchNotes(notes, '用').map((result) => result.note.id)).toEqual(['typo']);
});

test('搜索排除软删除笔记，空查询保持时间倒序', () => {
  const results = searchNotes([
    { id: 'old', text: '产品想法', createdAt: 100 },
    { id: 'deleted', text: '产品想法', createdAt: 300, deletedAt: 301 },
    { id: 'new', text: '其他想法', createdAt: 200 },
  ], '');

  expect(results.map((result) => result.note.id)).toEqual(['new', 'old']);
  expect(searchNotes(results.map((result) => result.note), '产品').map((result) => result.note.id)).toEqual(['old']);
});

test('千条本地笔记仍能返回目标结果', () => {
  const notes = Array.from({ length: 1000 }, (_, index) => ({
    id: `n-${index}`,
    text: index === 731 ? '候选产品调研结论' : `第 ${index} 条随手记录`,
    createdAt: index,
  }));

  expect(searchNotes(notes, '产品调研').map((result) => result.note.id)).toContain('n-731');
});
