export const INITIAL_VOICE_STATE = {
  phase: 'idle',
  error: '',
  retryUri: null,
};

// 录音阶段必须保留承载 responder 的按钮，否则会丢失上滑与松手事件。
export function shouldShowCaptureButton(composerOpen, phase) {
  return !composerOpen && (phase === 'idle' || phase === 'recording');
}

export function voiceCaptureReducer(state, action) {
  switch (action.type) {
    case 'RECORDING':
      return { phase: 'recording', error: '', retryUri: null };
    case 'TRANSCRIBING':
      return { phase: 'transcribing', error: '', retryUri: action.uri || state.retryUri };
    case 'SUCCESS':
      return { phase: 'success', error: '', retryUri: null };
    case 'ERROR':
      return {
        phase: 'error',
        error: action.error || '识别失败，请重试',
        retryUri: action.uri || null,
      };
    case 'RESET':
      return INITIAL_VOICE_STATE;
    default:
      return state;
  }
}
