// מסך 1: כניסה. טלפון → קוד → 18+ → כינוי. (5 שאלות הדגלים האדומים יגיעו אחרי הכינוי.)
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { BigButton, Body, Card, Title, Bounce } from '../src/components/Ui';
import { api, hasBackend } from '../src/data';
import { t } from '../src/strings';
import { colors, radius } from '../src/theme';

type Step = 'phone' | 'code' | 'age' | 'nick';

export default function Login() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [nick, setNick] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [nickOptions] = useState(() => ['קוקוס מסתורי', 'ניצוץ שקט', 'ענן שובב']);

  const next = async () => {
    setErr(null);
    try {
      if (step === 'phone') {
        if (hasBackend()) await api.auth.sendCode(phone);
        setStep('code');
      } else if (step === 'code') {
        if (hasBackend()) await api.auth.verifyCode(phone, code);
        setStep('age');
      } else if (step === 'nick') {
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

      {step === 'phone' && (
        <Card>
          <Body>{t('phoneTitle')}</Body>
          <TextInput style={st.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="05X-XXXXXXX" placeholderTextColor={colors.muted} />
          <BigButton label="שלח/י קוד" onPress={next} />
        </Card>
      )}
      {step === 'code' && (
        <Card>
          <Body>{t('codeTitle')}</Body>
          <TextInput style={st.input} keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6} />
          <BigButton label="המשך" onPress={next} />
        </Card>
      )}
      {step === 'age' && (
        <Card>
          <BigButton label={t('ageCheck')} onPress={() => setStep('nick')} />
          <BigButton label="אני מתחת ל-18" tone="muted" onPress={() => setErr('האפליקציה מיועדת לגיל 18 ומעלה בלבד.')} />
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
