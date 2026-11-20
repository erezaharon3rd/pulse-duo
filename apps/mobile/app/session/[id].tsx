// מסך 3: מפגש. בדיקת רצון → חשיפה אישית → 3-2-1 → נגן שקט → תחקור.
// הממשק לא מחליט כלום: הוא שולח תשובות ומציג את התוכנית שהשרת מחזיר.
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BigButton, Body, Card, Title } from '../../src/components/Ui';
import { api, hasBackend } from '../../src/data';
import { DEMO_PLAN, type UiPlan } from '../../src/demo';
import { t } from '../../src/strings';
import { colors } from '../../src/theme';

type Stage = 'ask' | 'waiting' | 'reveal' | 'countdown' | 'play' | 'debrief' | 'stopped';

export default function Session() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stage, setStage] = useState<Stage>('ask');
  const [plan, setPlan] = useState<UiPlan | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const answer = async (a: 'yes' | 'not_today') => {
    if (!hasBackend()) {
      if (a === 'yes') { setPlan(DEMO_PLAN); setStage('reveal'); } else { setMsg(t('postponed')); }
      return;
    }
    const r = await api.session.answer(id!, a, 'balanced');
    if (r.status === 'ready') {
      const { plan } = await api.session.reveal(id!);
      setPlan(plan as unknown as UiPlan);
      setStage('reveal');
    } else {
      setMsg(r.message ?? 'מחכים לצד השני…');
      setStage('waiting');
    }
  };

  if (stage === 'ask' || stage === 'waiting') {
    return (
      <View style={st.wrap}>
        <Title>המפגש של הערב 🎲</Title>
        <Body muted>25 דקות · 2 תנוחות חדשות מחכות · רמז: משהו עם החלפת תפקידים 👀</Body>
        <View style={{ height: 24 }} />
        <BigButton label={t('imIn')} onPress={() => answer('yes')} />
        <BigButton label={t('notToday')} tone="muted" onPress={() => answer('not_today')} />
        {msg && <Body muted>{msg}</Body>}
      </View>
    );
  }
  if (stage === 'reveal' && plan) return <Reveal plan={plan} onReady={() => setStage('countdown')} />;
  if (stage === 'countdown') return <Countdown onDone={() => setStage('play')} />;
  if (stage === 'play' && plan) return <Player plan={plan} onEnd={() => setStage('debrief')} onStop={() => setStage('stopped')} />;
  if (stage === 'stopped') return <Triage onDone={() => setStage('debrief')} />;
  return <Debrief onDone={() => router.replace('/home')} />;
}

function Reveal({ plan, onReady }: { plan: UiPlan; onReady: () => void }) {
  const [shown, setShown] = useState(0);
  return (
    <View style={st.wrap}>
      <Title>החשיפה שלך 🃏</Title>
      <Body muted>רק את/ה רואה את זה. אפשר להחליף כל קלף, בלי להסביר.</Body>
      {plan.steps.map((s, k) => (
        <Pressable key={k} onPress={() => { Platform.OS !== 'web' && Haptics.selectionAsync(); setShown(Math.max(shown, k + 1)); }}>
          <Card style={{ opacity: k < shown ? 1 : 0.5 }}>
            <Text style={st.cardTitle}>{k < shown ? s.title : '❔ הקש/י לחשיפה'}</Text>
            {k < shown && <Body muted>{s.subtitle}</Body>}
          </Card>
        </Pressable>
      ))}
      <BigButton label={t('ready')} onPress={onReady} />
    </View>
  );
}

function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  const scale = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    scale.setValue(0.5);
    Animated.spring(scale, { toValue: 1.2, useNativeDriver: true }).start();
    Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const h = setTimeout(() => (n > 1 ? setN(n - 1) : onDone()), 900);
    return () => clearTimeout(h);
  }, [n]);
  return (
    <View style={[st.wrap, st.center]}>
      <Animated.Text style={[st.count, { transform: [{ scale }] }]}>{n}</Animated.Text>
    </View>
  );
}

function Player({ plan, onEnd, onStop }: { plan: UiPlan; onEnd: () => void; onStop: () => void }) {
  useKeepAwake(); // המסך לא נכבה בזמן מפגש
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(plan.steps[0].seconds);
  const lastTap = useRef(0);

  useEffect(() => {
    if (left <= 0) {
      Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (i + 1 >= plan.steps.length) return onEnd();
      setI(i + 1);
      setLeft(plan.steps[i + 1].seconds);
      return;
    }
    const h = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(h);
  }, [left]);

  // לחיצה כפולה בכל מקום = עצירה
  const onPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 350) onStop();
    lastTap.current = now;
  };

  const s = plan.steps[i];
  return (
    <Pressable style={[st.wrap, st.session]} onPress={onPress}>
      <Text style={st.sessionSmall}>{t('stopHint')}</Text>
      <View style={st.center}>
        <Text style={st.sessionTitle}>{s.title}</Text>
        <Text style={st.sessionSmall}>{s.subtitle}</Text>
        <Text style={st.sessionTimer}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</Text>
      </View>
      <Text style={st.sessionSmall}>לחיצה כפולה = עצירה</Text>
    </Pressable>
  );
}

function Triage({ onDone }: { onDone: () => void }) {
  return (
    <View style={st.wrap}>
      <Title>עצרנו ✋</Title>
      <Card><Body>כאב בחזה, כאב ראש חזק ופתאומי, התעלפות, חולשה בצד אחד?</Body><Body muted>התקשרו מיד למד״א 101</Body></Card>
      <Card><Body>דפיקות לב חריגות, כאב חד באגן, מפרק שנתן את עצמו?</Body><Body muted>עצרו ופנו לרופא/ה</Body></Card>
      <BigButton label="סתם עצרנו – הכול בסדר" tone="calm" onPress={onDone} />
    </View>
  );
}

function Debrief({ onDone }: { onDone: () => void }) {
  const feelings = ['📈 הגיע במהלך', '🔥 היה מההתחלה', '🌊 רגוע ונעים', '🌫️ לא הגיע', '😕 לא היה לי נוח', '🤍 לא באמת רציתי'];
  return (
    <View style={st.wrap}>
      <Title>איך היה? (רק את/ה רואה)</Title>
      {feelings.map((f) => <BigButton key={f} label={f} tone="muted" onPress={onDone} />)}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, padding: 20, paddingTop: 56, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  count: { color: colors.neon, fontSize: 140, fontWeight: '900' },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'right' },
  session: { backgroundColor: colors.sessionBg, justifyContent: 'space-between' },
  sessionTitle: { color: colors.sessionText, fontSize: 34, fontWeight: '700', textAlign: 'center' },
  sessionSmall: { color: colors.sessionText, fontSize: 14, textAlign: 'center', opacity: 0.8 },
  sessionTimer: { color: colors.sessionText, fontSize: 64, fontWeight: '300', marginTop: 24 },
});
