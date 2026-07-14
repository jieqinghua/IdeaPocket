import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { metrics, radius, shadow, spacing, theme, type } from '../theme';

export default function ApiKeyDialog({
  visible,
  value,
  saving = false,
  error = '',
  onChange,
  onCancel,
  onConfirm,
}) {
  const inputRef = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const canSubmit = Boolean(value?.trim()) && !saving;

  useEffect(() => {
    if (!visible) {
      setRevealed(false);
      return undefined;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 180);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={saving ? undefined : onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="取消配置 API Key"
          disabled={saving}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>请输入您的大模型 API Key</Text>
          <Text style={styles.subtitle}>用于语音识别和笔记主题整理，此 Key 仅加密保存在本地。</Text>
          <View style={[styles.inputShell, !!error && styles.inputShellError]}>
            <TextInput
              ref={inputRef}
              accessibilityLabel="大模型 API Key"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              placeholder="粘贴 API Key"
              placeholderTextColor={theme.inkMuted}
              returnKeyType="done"
              secureTextEntry={!revealed}
              selectTextOnFocus={Boolean(value)}
              selectionColor={theme.brand}
              value={value}
              onChangeText={onChange}
              onSubmitEditing={() => canSubmit && onConfirm?.()}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={revealed ? '隐藏 API Key' : '显示 API Key'}
              disabled={saving}
              hitSlop={4}
              onPress={() => setRevealed((current) => !current)}
              style={styles.revealButton}
            >
              <Ionicons
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={metrics.standardIcon}
                color={theme.inkSoft}
              />
            </Pressable>
          </View>
          {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onCancel}
              style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                !canSubmit && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>{saving ? '保存中…' : '确定'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.overlaySoft,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: theme.surface,
    ...shadow.sheet,
  },
  title: { ...type.pageTitle, color: theme.ink, fontWeight: '700' },
  subtitle: { ...type.content, marginTop: spacing.xs, color: theme.inkSoft },
  inputShell: {
    minHeight: metrics.standardButton,
    marginTop: spacing.lg,
    paddingLeft: spacing.md,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: radius.control,
    backgroundColor: theme.bg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputShellError: { borderColor: theme.destructive },
  input: { ...type.content, flex: 1, minWidth: 0, color: theme.ink },
  revealButton: {
    width: metrics.standardButton,
    height: metrics.standardButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...type.auxiliary, marginTop: spacing.xs, color: theme.destructive },
  actions: { marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  button: {
    minWidth: 88,
    minHeight: metrics.minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { backgroundColor: theme.accentSoft },
  confirmButton: { backgroundColor: theme.brand },
  buttonDisabled: { opacity: 0.45 },
  cancelText: { ...type.content, color: theme.ink, fontWeight: '700' },
  confirmText: { ...type.content, color: theme.onBrand, fontWeight: '700' },
  pressed: { opacity: 0.76 },
});
