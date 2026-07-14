import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { metrics, radius, shadow, spacing, theme, type } from '../theme';

// 可作常驻输入条，也可作 FAB 点击/语音转写后弹出的"可预填、可关闭"输入条。
export default function CaptureBar({
  onSubmit,
  initialText = '',
  autoFocus = false,
  onClose,
  notice,
  onRetry,
  retrying = false,
}) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText('');
    onClose?.();
  };

  return (
    <View style={styles.wrap}>
      {onClose && (
        <Pressable accessibilityRole="button" accessibilityLabel="关闭文字输入" style={styles.close} onPress={onClose}>
          <Ionicons name="close" size={metrics.standardIcon} color={theme.inkSoft} />
        </Pressable>
      )}
      <View style={styles.inputArea}>
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
        {!!onRetry && !text.trim() && (
          <Pressable disabled={retrying} onPress={onRetry} style={styles.retry}>
            <Text style={styles.retryTxt}>{retrying ? '重试中…' : '重试转写'}</Text>
          </Pressable>
        )}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="一闪而过的念头…"
          placeholderTextColor={theme.inkSoft}
          autoFocus={autoFocus}
          multiline
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="记下这条笔记"
        disabled={!text.trim()}
        style={[styles.send, { opacity: text.trim() ? 1 : 0.4 }]}
        onPress={send}
      >
        <Text style={styles.sendTxt}>记下</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...shadow.sheet,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.surface,
  },
  close: {
    width: metrics.minTouch,
    height: metrics.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xxs,
  },
  inputArea: { flex: 1, marginRight: spacing.xs },
  notice: { ...type.auxiliary, color: theme.wilting, marginBottom: spacing.xs },
  retry: { alignSelf: 'flex-start', minHeight: metrics.minTouch, justifyContent: 'center' },
  retryTxt: { ...type.auxiliary, color: theme.brand, fontWeight: '600' },
  input: {
    maxHeight: 140,
    minHeight: metrics.minTouch,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: theme.bg,
    borderRadius: radius.pill,
    ...type.content,
    color: theme.ink,
  },
  send: {
    minWidth: 64,
    paddingHorizontal: spacing.md,
    height: metrics.minTouch,
    borderRadius: radius.pill,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendTxt: { ...type.content, color: theme.onBrand, fontWeight: '600' },
});
