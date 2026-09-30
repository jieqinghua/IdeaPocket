import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DetailPageHeader from '../components/DetailPageHeader';
import { metrics, radius, shadow, spacing, type, useAppTheme } from '../theme';

function ServiceKeyCard({ title, description, value, loadError, onSave }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [draft, setDraft] = useState(value || '');
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  const save = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await onSave(draft);
      setSaved(true);
    } catch (saveError) {
      setError(saveError?.message || '保存 API Key 失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const cardError = error || loadError;
  const configured = Boolean(value);
  const canSave = Boolean(draft.trim()) && !saving;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <View style={styles.cardTitleGroup}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={[styles.status, configured ? styles.statusReady : styles.statusPending]}>
            {configured ? '已配置' : '未配置'}
          </Text>
        </View>
      </View>
      <Text style={styles.description}>{description}</Text>
      <View style={[styles.inputShell, !!cardError && styles.inputShellError]}>
        <TextInput
          accessibilityLabel={`${title} API Key`}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
          placeholder="粘贴 API Key"
          placeholderTextColor={theme.inkMuted}
          returnKeyType="done"
          secureTextEntry={!revealed}
          selectTextOnFocus={Boolean(draft)}
          selectionColor={theme.brand}
          value={draft}
          onChangeText={(nextValue) => {
            setDraft(nextValue);
            setError('');
            setSaved(false);
          }}
          onSubmitEditing={save}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={revealed ? `隐藏 ${title} API Key` : `显示 ${title} API Key`}
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
      {!!cardError && <Text accessibilityLiveRegion="polite" style={styles.error}>{cardError}</Text>}
      {saved && !cardError && <Text accessibilityLiveRegion="polite" style={styles.saved}>已安全保存到本机。</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`保存 ${title} API Key`}
        accessibilityState={{ disabled: !canSave }}
        disabled={!canSave}
        onPress={save}
        style={({ pressed }) => [
          styles.saveButton,
          !canSave && styles.saveButtonDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>{saving ? '保存中…' : '保存 Key'}</Text>
      </Pressable>
    </View>
  );
}

export default function SettingsScreen({
  deepSeekKey,
  dashscopeKey,
  deepSeekLoadError,
  dashscopeLoadError,
  onBack,
  onSaveDeepSeek,
  onSaveDashscope,
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <DetailPageHeader title="设置" backLabel="返回首页" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={styles.introTitle}>AI 服务配置</Text>
          <Text style={styles.introText}>Key 仅加密保存在这台设备，不会写入笔记备份。</Text>
        </View>
        <ServiceKeyCard
          title="DeepSeek 文本 AI"
          description="用于 AI 润色和主题整理，模型为 DeepSeek V4.1 Flash。"
          value={deepSeekKey}
          loadError={deepSeekLoadError}
          onSave={onSaveDeepSeek}
        />
        <ServiceKeyCard
          title="百炼录音转写"
          description="用于将录音转成文字，继续使用 qwen3-asr-flash。"
          value={dashscopeKey}
          loadError={dashscopeLoadError}
          onSave={onSaveDashscope}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.md },
  intro: { paddingTop: spacing.xs, paddingBottom: spacing.xs },
  introTitle: { ...type.pageTitle, color: theme.ink, fontWeight: '700' },
  introText: { ...type.content, color: theme.inkSoft, marginTop: spacing.xxs },
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.cardLine,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
    ...shadow.card,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleGroup: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  cardTitle: { ...type.sectionTitle, color: theme.ink, fontWeight: '700' },
  status: { ...type.auxiliary, borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 2 },
  statusReady: { backgroundColor: theme.accentSoft, color: theme.brand },
  statusPending: { backgroundColor: theme.cardLine, color: theme.inkSoft },
  description: { ...type.content, color: theme.inkSoft, marginTop: spacing.sm },
  inputShell: {
    alignItems: 'center',
    backgroundColor: theme.bg,
    borderColor: theme.line,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.md,
    minHeight: metrics.minTouch,
  },
  inputShellError: { borderColor: theme.destructive },
  input: { ...type.content, color: theme.ink, flex: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  revealButton: { alignItems: 'center', height: metrics.minTouch, justifyContent: 'center', width: metrics.minTouch },
  error: { ...type.auxiliary, color: theme.destructive, marginTop: spacing.xs },
  saved: { ...type.auxiliary, color: theme.fresh, marginTop: spacing.xs },
  saveButton: {
    alignItems: 'center',
    backgroundColor: theme.accentSoft,
    borderRadius: radius.control,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: metrics.minTouch,
  },
  saveButtonDisabled: { backgroundColor: theme.cardLine },
  saveText: { ...type.content, color: theme.brand, fontWeight: '700' },
  saveTextDisabled: { color: theme.inkMuted },
  pressed: { opacity: 0.58 },
});
