import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { Line } from 'react-native-svg';
import VoiceOverlay from '../components/VoiceOverlay';
import { WAVEFORM_BAR_COUNT } from '../voiceWaveform';

let tree;
const mount = async (props) => {
  await act(async () => {
    tree = renderer.create(<VoiceOverlay visible duration={0} metering={-20} {...props} />);
  });
};
const texts = () => tree.root.findAllByType(Text).flatMap((node) => [node.props.children].flat()).join(' ');
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; });

test('录音遮罩显示发送提示与实时波形条', async () => {
  await mount({ canceling: false });
  expect(texts()).toContain('松手发送，上滑取消');
  expect(tree.root.findAllByType(Line)).toHaveLength(WAVEFORM_BAR_COUNT);
});

test('识别阶段只显示识别中，不再显示波形', async () => {
  await mount({ phase: 'recognizing' });
  expect(texts()).toContain('识别中');
  expect(tree.root.findAllByType(Line)).toHaveLength(0);
});

test('隐藏时不渲染遮罩', async () => {
  await act(async () => {
    tree = renderer.create(<VoiceOverlay visible={false} />);
  });
  expect(tree.toJSON()).toBeNull();
});
