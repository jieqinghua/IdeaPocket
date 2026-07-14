export const AI_TEXT_PHASE = Object.freeze({
  IDLE: 'idle',
  PROCESSING: 'processing',
  REVEALING: 'revealing',
  ERROR: 'error',
});

export const INITIAL_AI_TEXT_TRANSITION = Object.freeze({
  phase: AI_TEXT_PHASE.IDLE,
  sourceText: '',
  resultText: '',
  responseResolved: false,
  minimumElapsed: false,
  unchanged: false,
  error: '',
});

const advance = (state) => {
  if (state.phase === AI_TEXT_PHASE.ERROR || state.phase === AI_TEXT_PHASE.IDLE) return state;
  if (state.responseResolved && state.minimumElapsed) {
    return { ...state, phase: AI_TEXT_PHASE.REVEALING };
  }
  return { ...state, phase: AI_TEXT_PHASE.PROCESSING };
};

export function aiTextTransitionReducer(state, action) {
  switch (action.type) {
    case 'BEGIN':
      if (state.phase !== AI_TEXT_PHASE.IDLE) return state;
      return {
        ...INITIAL_AI_TEXT_TRANSITION,
        phase: AI_TEXT_PHASE.PROCESSING,
        sourceText: action.sourceText,
      };
    case 'RESOLVED':
      if (state.phase === AI_TEXT_PHASE.IDLE || state.phase === AI_TEXT_PHASE.ERROR) return state;
      return advance({
        ...state,
        responseResolved: true,
        resultText: action.resultText,
        unchanged: action.resultText === state.sourceText,
      });
    case 'MINIMUM_ELAPSED':
      if (state.phase === AI_TEXT_PHASE.IDLE || state.phase === AI_TEXT_PHASE.ERROR) return state;
      return advance({ ...state, minimumElapsed: true });
    case 'FAILED':
      if (state.phase === AI_TEXT_PHASE.IDLE) return state;
      return { ...state, phase: AI_TEXT_PHASE.ERROR, error: action.error || '整理失败，请稍后重试' };
    case 'REVEALED':
    case 'RECOVERED':
    case 'RESET':
      return { ...INITIAL_AI_TEXT_TRANSITION };
    default:
      return state;
  }
}

export function isAiTextTransitionBusy(phase) {
  return [
    AI_TEXT_PHASE.PROCESSING,
    AI_TEXT_PHASE.REVEALING,
  ].includes(phase);
}
