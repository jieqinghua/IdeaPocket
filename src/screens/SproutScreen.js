import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isComposted } from '../heat';
import { selectSprout, todayKey } from '../sprout';
import { loadMeta, saveMeta } from '../storage';
import { theme } from '../theme';

export default function SproutScreen({ store }) {
  const now = Date.now();
  const [meta, setMeta] = useState(null);
  const [note, setNote] = useState(null); // 本次展示锁定的那张芽
  const [seenIds, setSeenIds] = useState([]);

  useEffect(() => {
    loadMeta().then((m) => setMeta(m || {}));
  }, []);

  const pool = store.notes.filter((n) => isComposted(n, now));
  const today = todayKey();
  const dismissed = meta && meta.sproutDismissed === today;
  const poolKey = pool.map((item) => item.id).join('|');
  const seenKey = seenIds.join('|');

  // 选出今天的芽：按日期确定性挑一张，且在被处理前保持稳定。
  useEffect(() => {
    if (!meta) return;
    if (dismissed || pool.length === 0) {
      setNote(null);
      return;
    }
    setNote((current) => {
      const stillThere = current && pool.find((item) => item.id === current.id);
      return stillThere || selectSprout(pool, today, seenIds);
    });
    // poolKey/seenKey 让候选变化可追踪，同时避免把每次 render 的新数组放进依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, dismissed, poolKey, seenKey, today]);

  const restToday = () => {
    if (note) setSeenIds((current) => [...new Set([...current, note.id])]);
    const m = { ...meta, sproutDismissed: today };
    setMeta(m);
    saveMeta(m);
  };
  const peekAgain = () => {
    const m = { ...meta, sproutDismissed: null };
    setMeta(m);
    setNote(null);
    saveMeta(m);
  };
  const water = () => {
    store.water(note.id);
    setNote(null); // 复活 → 离开堆肥，自动浮出下一张
  };
  const plant = () => {
    store.plant(note.id);
    setNote(null);
  };

  if (!store.ready || !meta) {
    return (
      <Centered>
        <Text style={styles.muted}>…</Text>
      </Centered>
    );
  }

  if (pool.length === 0) {
    return (
      <Centered>
        <Text style={styles.big}>🌱</Text>
        <Text style={styles.muted}>堆肥里还没有东西冒芽。{'\n'}先去记，过些天再回来。</Text>
      </Centered>
    );
  }

  if (dismissed || !note) {
    return (
      <Centered>
        <Text style={styles.big}>🌿</Text>
        <Text style={styles.muted}>今天的芽看过了。{'\n'}明天再来翻翻。</Text>
        <Pressable style={styles.ghost} onPress={peekAgain}>
          <Text style={styles.ghostTxt}>再翻一个</Text>
        </Pressable>
      </Centered>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>冒芽</Text>
        <Text style={styles.sub}>从土里浮上来的一个旧念头</Text>
      </View>
      <View style={styles.stage}>
        <Text style={styles.q}>还记得这个吗？</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>{note.text}</Text>
        </View>
        <Text style={styles.age}>记于 {new Date(note.createdAt).toLocaleDateString()}</Text>
      </View>
      <View style={styles.actions}>
        <Action label="💧 浇水复活" onPress={water} primary />
        <Action label="🌲 收为多年生" onPress={plant} />
        <Action label="😌 让它继续躺着" onPress={restToday} />
      </View>
    </View>
  );
}

function Centered({ children }) {
  return <View style={styles.centered}>{children}</View>;
}

function Action({ label, onPress, primary }) {
  return (
    <Pressable style={[styles.action, primary && styles.actionPrimary]} onPress={onPress}>
      <Text style={[styles.actionTxt, primary && styles.actionTxtPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  big: { fontSize: 44, marginBottom: 14 },
  muted: { color: theme.inkSoft, fontSize: 15, lineHeight: 24, textAlign: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: theme.ink },
  sub: { fontSize: 13, color: theme.inkSoft, marginTop: 2 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  q: { color: theme.inkSoft, fontSize: 15, marginBottom: 16 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 26,
    borderWidth: 1,
    borderColor: theme.line,
    width: '100%',
  },
  cardText: { color: theme.ink, fontSize: 19, lineHeight: 28 },
  age: { color: theme.inkSoft, fontSize: 12, marginTop: 14 },
  actions: { padding: 16, gap: 10 },
  action: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  actionPrimary: { backgroundColor: theme.accent, borderColor: theme.accent },
  actionTxt: { color: theme.ink, fontSize: 15 },
  actionTxtPrimary: { color: '#fff', fontWeight: '600' },
  ghost: { marginTop: 18, paddingHorizontal: 16, paddingVertical: 8 },
  ghostTxt: { color: theme.accent, fontSize: 14 },
});
