import { isListAtTop, isNewFirstNote } from '../newNoteEntry';

describe('new note entry sequencing', () => {
  test('recognizes a newly inserted first note outside search', () => {
    expect(isNewFirstNote({
      initialized: true,
      searchActive: false,
      searchModeChanged: false,
      previousCount: 3,
      nextCount: 4,
      previousFirstId: 'older',
      nextFirstId: 'new',
    })).toBe(true);
  });

  test('does not treat initial load, search changes, or edits as a new first note', () => {
    const baseline = {
      initialized: true,
      searchActive: false,
      searchModeChanged: false,
      previousCount: 3,
      nextCount: 4,
      previousFirstId: 'older',
      nextFirstId: 'new',
    };

    expect(isNewFirstNote({ ...baseline, initialized: false })).toBe(false);
    expect(isNewFirstNote({ ...baseline, searchActive: true })).toBe(false);
    expect(isNewFirstNote({ ...baseline, searchModeChanged: true })).toBe(false);
    expect(isNewFirstNote({ ...baseline, nextCount: 3 })).toBe(false);
    expect(isNewFirstNote({ ...baseline, nextFirstId: 'older' })).toBe(false);
  });

  test('uses a small tolerance for the list top', () => {
    expect(isListAtTop(0)).toBe(true);
    expect(isListAtTop(0.8)).toBe(true);
    expect(isListAtTop(2)).toBe(false);
  });
});
