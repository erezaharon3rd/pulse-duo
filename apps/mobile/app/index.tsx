// מסך 1: כניסה. מייל → קישור במייל → שנת לידה (18+) → כינוי. מי שכבר רשום – ישר הביתה. (5 שאלות הדגלים האדומים יגיעו אחרי הכינוי.)
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import { BigButton, Body, Card, Title, Bounce } from '../src/components/Ui';
import { api, hasBackend } from '../src/data';
import { t } from '../src/strings';
import { colors, radius } from '../src/theme';

type Step = 'loading' | 'email' | 'sent' | 'age' | 'nick';

export default function Login() {
  const [step, setStep] = useState<Step>(hasBackend() ? 'loading' : 'email');
  const [email, setEmail] = useState('');
  const [year, setYear] = useState('');
  const [nick, setNick] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [nickOptions] = useState(() => ['קוקוס מסתורי', 'ניצוץ שקט', 'ענן שובב']);

  // חזרה מהקישור שבמייל: אם יש כניסה – פרופיל קיים הולך הביתה, חדש ממשיך לשנת לידה
  useEffect(() => {
    if (!hasBackend()) return;
    const route = async () => {
      const p = await api.profile.get().catch(() => null);
      if (p) router.replace('/home');
      else setStep('age');
    };
    api.auth.ready().then((id) => (id ? route() : setStep('email')));
    return api.auth.onSignedIn(() => void route());
  }, []);

  const next = async () => {
    setErr(null);
    try {
      if (step === 'email') {
        const e = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setErr('כתובת המייל לא נראית תקינה');
        if (!hasBackend()) return setStep('age');
        const back = Platform.OS === 'web' ? globalThis.location?.origin : undefined;
        await api.auth.sendLink(e, back);
        setStep('sent');
      } else if (step === 'age') {
        const y = Number(year);
        const now = new Date().getFullYear();
        if (!Number.isInteger(y) || y < now - 100 || y > now) return setErr('שנת לידה לא תקינה');
        if (y > now - 18) return setErr('האפליקציה מיועדת לגיל 18 ומעלה בלבד.');
        setStep('nick');
      } else if (step === 'nick') {
        const n = nick.trim();
        if (n.length < 2) return setErr('כינוי של 2 תווים לפחות');
        if (hasBackend()) await api.profile.save({ nickname: n, birthYear: Number(year), addressForm: 'plural' });
        router.replace('/home');
      }
    } catch {
      setErr('משהו לא הסתדר. ננסה שוב?');
    }
  };

  return (
    <ScrollView contentContainerStyle={st.wrap}>
      <Title>Pulse ✨</Title>
      <Body muted>{t('promise')}</Body>

      {step === 'email' && (
        <Card>
          <Body>{t('emailTitle')}</Body>
          <TextInput style={[st.input, { textAlign: 'left' }]} keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} placeholder="name@mail.com" placeholderTextColor={colors.muted} />
          <BigButton label="שלח/י קישור" onPress={next} />
        </Card>
      )}
      {step === 'loading' && <Body muted>רגע…</Body>}
      {step === 'sent' && (
        <Card>
          <Body>{t('codeTitle')}</Body>
          <Body muted>{email.trim()}</Body>
          <BigButton label="לא הגיע? לשלוח שוב" tone="muted" onPress={() => setStep('email')} />
        </Card>
      )}
      {step === 'age' && (
        <Card>
          <Body>{t('ageCheck')}</Body>
          <TextInput style={st.input} keyboardType="number-pad" value={year} onChangeText={setYear} maxLength={4} placeholder="שנת לידה" placeholderTextColor={colors.muted} />
          <BigButton label="המשך" onPress={next} />
        </Card>
      )}
      {step === 'nick' && (
        <Card>
          <Body>{t('nickTitle')}</Body>
          {nickOptions.map((n) => (
            <Bounce key={n} onPress={() => setNick(n)} style={[st.chip, nick === n && { borderColor: colors.neon }]}>
              <Body>{n}</Body>
            </Bounce>
          ))}
          <TextInput style={st.input} value={nick} onChangeText={setNick} placeholder="או כינוי משלך" placeholderTextColor={colors.muted} maxLength={20} />
          <BigButton label="יאללה" onPress={next} />
        </Card>
      )}
      {err && <Body muted>{err}</Body>}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 80, backgroundColor: colors.bg, flexGrow: 1 },
  input: { backgroundColor: '#0F0F1A', color: colors.text, borderRadius: radius, padding: 16, fontSize: 20, textAlign: 'right', marginVertical: 12 },
  chip: { borderWidth: 2, borderColor: 'transparent', borderRadius: radius, padding: 12, marginVertical: 4, backgroundColor: '#0F0F1A' },
});
