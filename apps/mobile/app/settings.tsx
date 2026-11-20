// מסך 5: הגדרות. כולל הקפאה, פירוק, עזרה, מחיקה ויציאה מהירה.
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { BigButton, Body, Card, Title } from '../src/components/Ui';
import { t } from '../src/strings';
import { colors } from '../src/theme';

export default function Settings() {
  const [kids, setKids] = useState(false);
  const [sounds, setSounds] = useState(false);
  const [warmup, setWarmup] = useState(false);
  return (
    <ScrollView contentContainerStyle={st.wrap}>
      <Title>הגדרות</Title>
      <Card>
        <Row label="יש ילדים בבית (משתיק הכול)" value={kids} onChange={setKids} />
        <Row label="צלילים" value={sounds} onChange={setSounds} />
        <Row label="פתוח/ה להתחמם השבוע" value={warmup} onChange={setWarmup} />
      </Card>
      <BigButton label="מגבלות גוף וסינון" tone="muted" onPress={() => {}} />
      <BigButton label="להקפיא צימוד" tone="muted" onPress={() => {}} />
      <BigButton label="להזמין חברים 🎁" tone="muted" onPress={() => {}} />
      <BigButton label={t('help')} tone="calm" onPress={() => {}} />
      <BigButton label="ייצוא ומחיקת נתונים" tone="muted" onPress={() => {}} />
      <BigButton label={t('quickExit')} onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={st.row}>
      <Body>{label}</Body>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.neon }} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 56, backgroundColor: colors.bg, flexGrow: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
});
