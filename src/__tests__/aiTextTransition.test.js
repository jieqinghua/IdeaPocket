import {
  AI_TEXT_PHASE,
  INITIAL_AI_TEXT_TRANSITION,
  aiTextTransitionReducer,
  isAiTextTransitionBusy,
} from '../aiTextTransition';

const reduce = (state, action) => aiTextTransitionReducer(state, action);

test('快速响应仍等待最短水波展示时间后再揭示候选稿', () => {
  let state = reduce(INITIAL_AI_TEXT_TRANSITION, { type: 'BEGIN', sourceText: '原文' });
  expect(state.phase).toBe(AI_TEXT_PHASE.PROCESSING);
  state = reduce(state, { type: 'RESOLVED', resultText: '整理后' });
  expect(state.phase).toBe(AI_TEXT_PHASE.PROCESSING);
  state = reduce(state, { type: 'MINIMUM_ELAPSED' });
  expect(state.phase).toBe(AI_TEXT_PHASE.REVEALING);
});

test('慢响应保持水波处理中并在响应到达后揭示候选稿', () => {
  let state = reduce(INITIAL_AI_TEXT_TRANSITION, { type: 'BEGIN', sourceText: '原文' });
  state = reduce(state, { type: 'MINIMUM_ELAPSED' });
  expect(state.phase).toBe(AI_TEXT_PHASE.PROCESSING);
  state = reduce(state, { type: 'RESOLVED', resultText: '整理后' });
  expect(state.phase).toBe(AI_TEXT_PHASE.REVEALING);
});

test('失败进入恢复状态且恢复后回到空闲', () => {
  let state = reduce(INITIAL_AI_TEXT_TRANSITION, { type: 'BEGIN', sourceText: '原文' });
  state = reduce(state, { type: 'FAILED', error: '网络失败' });
  expect(state).toMatchObject({ phase: AI_TEXT_PHASE.ERROR, error: '网络失败', sourceText: '原文' });
  state = reduce(state, { type: 'RECOVERED' });
  expect(state).toEqual(INITIAL_AI_TEXT_TRANSITION);
});

test('处理中拒绝重复开始且能识别未变化结果', () => {
  const started = reduce(INITIAL_AI_TEXT_TRANSITION, { type: 'BEGIN', sourceText: '原文' });
  expect(reduce(started, { type: 'BEGIN', sourceText: '另一条' })).toBe(started);
  const resolved = reduce(started, { type: 'RESOLVED', resultText: '原文' });
  expect(resolved.unchanged).toBe(true);
  expect(isAiTextTransitionBusy(resolved.phase)).toBe(true);
});

test('候选稿揭示完成后清空临时处理状态', () => {
  let state = reduce(INITIAL_AI_TEXT_TRANSITION, { type: 'BEGIN', sourceText: '原文' });
  state = reduce(state, { type: 'RESOLVED', resultText: '润色后' });
  state = reduce(state, { type: 'MINIMUM_ELAPSED' });
  expect(state.phase).toBe(AI_TEXT_PHASE.REVEALING);
  expect(reduce(state, { type: 'REVEALED' })).toEqual(INITIAL_AI_TEXT_TRANSITION);
});
