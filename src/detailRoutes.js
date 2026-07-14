export const INITIAL_DETAIL_ROUTE = null;

export function detailRouteReducer(state, action) {
  switch (action.type) {
    case 'OPEN_NOTE':
      return action.id ? { type: 'note', id: action.id, focus: !!action.focus } : state;
    case 'OPEN_THEME':
      return action.id ? { type: 'theme', id: action.id } : state;
    case 'CLOSE':
      return null;
    default:
      return state;
  }
}
