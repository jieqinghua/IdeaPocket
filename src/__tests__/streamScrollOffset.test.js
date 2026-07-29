import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { FlatList } from 'react-native';
import StreamScreen from '../screens/StreamScreen';

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../components/NoteCard', () => ({
  __esModule: true,
  default: () => null,
}));

const notes = [
  { id: 'note-2', text: '第二条', createdAt: 2 },
  { id: 'note-1', text: '第一条', createdAt: 1 },
];
const remove = jest.fn();

function renderStream(initialScrollOffset, currentNotes = notes, onScroll = jest.fn()) {
  return (
    <StreamScreen
      store={{ notes: currentNotes, remove }}
      layoutMode="list"
      initialScrollOffset={initialScrollOffset}
      onScroll={onScroll}
    />
  );
}

describe('stream live scroll offset', () => {
  test('does not restore a stale initial offset after a later render', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(renderStream(480));
    });

    let list = tree.root.findByType(FlatList);
    expect(list.props.contentOffset.y).toBe(480);

    await act(async () => {
      list.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 0 } } });
      tree.update(renderStream(480));
    });

    list = tree.root.findByType(FlatList);
    expect(list.props.contentOffset.y).toBe(0);

    await act(async () => {
      tree.unmount();
    });
  });

  test('issues the new-note jump synchronously so a following render cannot cancel it', async () => {
    jest.useFakeTimers();
    const onScroll = jest.fn();
    let tree;
    await act(async () => {
      tree = renderer.create(renderStream(480, notes, onScroll));
    });

    const listInstance = tree.root.findByType(FlatList).instance;
    const scrollToOffset = jest
      .spyOn(listInstance, 'scrollToOffset')
      .mockImplementation(() => {});
    const nextNotes = [
      { id: 'note-3', text: '刚新增的笔记', createdAt: 3 },
      ...notes,
    ];

    await act(async () => {
      tree.update(renderStream(480, nextNotes, onScroll));
    });

    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
    expect(onScroll).toHaveBeenCalledWith({
      nativeEvent: { contentOffset: { x: 0, y: 0 } },
    });

    await act(async () => {
      tree.update(renderStream(480, nextNotes, onScroll));
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });
});
