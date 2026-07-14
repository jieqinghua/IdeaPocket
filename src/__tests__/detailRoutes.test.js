import { detailRouteReducer, INITIAL_DETAIL_ROUTE } from '../detailRoutes';
import appConfig from '../../app.json';

describe('detailRouteReducer', () => {
  test('opens a note page and preserves the focus intent', () => {
    expect(detailRouteReducer(INITIAL_DETAIL_ROUTE, {
      type: 'OPEN_NOTE',
      id: 'note-1',
      focus: true,
    })).toEqual({ type: 'note', id: 'note-1', focus: true });
  });

  test('opens a theme page', () => {
    expect(detailRouteReducer(null, { type: 'OPEN_THEME', id: 'theme-1' }))
      .toEqual({ type: 'theme', id: 'theme-1' });
  });

  test('closes either detail page', () => {
    expect(detailRouteReducer({ type: 'note', id: 'note-1' }, { type: 'CLOSE' })).toBeNull();
    expect(detailRouteReducer({ type: 'theme', id: 'theme-1' }, { type: 'CLOSE' })).toBeNull();
  });

  test('ignores malformed open actions and unknown actions', () => {
    const current = { type: 'note', id: 'note-1', focus: false };
    expect(detailRouteReducer(current, { type: 'OPEN_NOTE' })).toBe(current);
    expect(detailRouteReducer(current, { type: 'UNKNOWN' })).toBe(current);
  });

  test('uses resize keyboard mode and opaque Android system navigation', () => {
    expect(appConfig.expo.android.softwareKeyboardLayoutMode).toBe('resize');
    expect(appConfig.expo.androidNavigationBar).toEqual({
      backgroundColor: '#F7F8FC',
      barStyle: 'dark-content',
    });
  });
});
