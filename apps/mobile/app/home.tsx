// מסך 2: בית. ערימת כרטיסי צימוד. לחיצה ארוכה = ניצוץ, לחיצה = מפגש הבא.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BigButton, Body, Bounce, Card, Title } from '../src/components/Ui';
import { api, hasBackend } from '../src/data';
import { t } from '../src/strings';
import { colors } from '../src/theme';

interface Pair { pairingId: string; coupleName: string | null; level: number; frozenUntil: string | null }

const DEMO: Pair[] = [{ pairingId: 'demo', coupleName: 'צוות הפירוטכניקה', level: 2, frozenUntil: null }];

export default function Home() {
  const [pairs, setPairs] = useState<Pair[]>(hasBackend() ? [] : DEMO);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (hasBackend()) api.pairings.list().then(setPairs).catch(() => setToast('אין חיבור כרגע'));
  }, []);

  const spark = async (p: Pair) => {
    if (!hasBackend()) return setToast('✨ הניצוץ נשלח');
    const r = await api.spark.send(p.pairingId, 'now');
    setToast(r.sent ? '✨ הניצוץ נשלח' : r.senderSees ?? null);
  };

  return (
    <ScrollView contentContainerStyle={st.wrap}>
      <View style={st.top}>
        <Bounce onPress={() => router.push('/card')}><Text style={st.icon}>🃏</Text></Bounce>
        <Bounce onPress={() => router.push('/settings')}><Text style={st.icon}>⚙️</Text></Bounce>
      </View>
      <Title>הצימודים שלי</Title>

      <Card style={{ borderColor: colors.spark, borderWidth: 1 }}>
        <Body>שאלת היום 💭</Body>
        <Body muted>מה הדבר הקטן שהכי משמח את בן/בת הזוג שלך בבוקר?</Body>
      </Card>

      {pairs.map((p) => (
        <Bounce key={p.pairingId} onPress={() => router.push(`/session/${p.pairingId}`)} onLongPress={() => spark(p)}>
          <Card style={st.pair}>
            <Text style={st.pairName}>{p.coupleName ?? 'צימוד חדש'}</Text>
            <Body muted>{p.frozenUntil ? t('resting') : `דרגה ${p.level} · המפגש הבא: הערב 21:30`}</Body>
            <Body muted>{t('sparkHint')}</Body>
          </Card>
        </Bounce>
      ))}

      <BigButton label={t('addPairing')} tone="muted" onPress={() => setToast('קישור צימוד + קוד 4 ספרות יופיעו כאן')} />
      {toast && <Text style={st.toast}>{toast}</Text>}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 56, backgroundColor: colors.bg, flexGrow: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  icon: { fontSize: 28 },
  pair: { minHeight: 150, justifyContent: 'center' },
  pairName: { color: colors.neon, fontSize: 24, fontWeight: '800', textAlign: 'right' },
  toast: { color: colors.spark, textAlign: 'center', marginTop: 16, fontSize: 18 },
});
