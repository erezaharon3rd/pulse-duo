// מסך 4: כרטיס שחקן – פרטי.
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BigButton, Body, Card, Title } from '../src/components/Ui';
import { colors } from '../src/theme';

const joints: [string, 'green' | 'yellow' | 'red'][] = [['גב תחתון', 'green'], ['ירכיים', 'green'], ['ברכיים', 'yellow'], ['שורשי כף יד', 'green']];
const dot = { green: colors.ok, yellow: colors.spark, red: '#FF5A5A' };

export default function PlayerCard() {
  return (
    <ScrollView contentContainerStyle={st.wrap}>
      <Title>קוקוס מסתורי 🃏</Title>
      <View style={st.row}>
        <Stat n="12" label="מפגשים" />
        <Stat n="9/40" label="תנוחות" />
        <Stat n="83%" label="ביעד" />
      </View>
      <Card>
        <Body>מפרקים</Body>
        {joints.map(([j, s]) => (
          <View key={j} style={st.jointRow}>
            <View style={[st.dot, { backgroundColor: dot[s] }]} />
            <Body>{j}</Body>
          </View>
        ))}
      </Card>
      <Card>
        <Body>תגים 🏅</Body>
        <Body muted>סייר לילה · 10 תודות · שבוע מנוחה חכם</Body>
      </Card>
      <BigButton label="חזרה" tone="muted" onPress={() => router.back()} />
    </ScrollView>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <Card style={{ flex: 1, marginHorizontal: 4, alignItems: 'center' }}>
      <Text style={st.n}>{n}</Text>
      <Body muted>{label}</Body>
    </Card>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 20, paddingTop: 56, backgroundColor: colors.bg, flexGrow: 1 },
  row: { flexDirection: 'row' },
  n: { color: colors.neon, fontSize: 28, fontWeight: '800' },
  jointRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
