// רכיבי בסיס: כפתור גדול עם רטט ו"קפיצה", כרטיס, כפתור יציאה מהירה.
import * as Haptics from 'expo-haptics';
import { useRef, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, font, minTouch, radius } from '../theme';

const tap = () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

export function Bounce({ children, onPress, onLongPress, style }: { children: ReactNode; onPress?: () => void; onLongPress?: () => void; style?: ViewStyle }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 12 }).start();
  return (
    <Pressable
      onPressIn={() => to(0.94)}
      onPressOut={() => to(1)}
      onPress={() => { tap(); onPress?.(); }}
      onLongPress={() => { Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onLongPress?.(); }}
      delayLongPress={600}
    >
      <Animated.View style={[{ transform: [{ scale: s }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function BigButton({ label, onPress, tone = 'neon' }: { label: string; onPress: () => void; tone?: 'neon' | 'calm' | 'muted' }) {
  const bg = tone === 'neon' ? colors.neon : tone === 'calm' ? colors.calm : colors.card;
  return (
    <Bounce onPress={onPress} style={[st.btn, { backgroundColor: bg }]}>
      <Text style={st.btnText}>{label}</Text>
    </Bounce>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[st.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={st.title}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[st.body, muted && { color: colors.muted }]}>{children}</Text>;
}

const st = StyleSheet.create({
  btn: { minHeight: minTouch + 12, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginVertical: 6 },
  btnText: { color: '#fff', fontSize: font.body + 2, fontWeight: '700', writingDirection: 'rtl' },
  card: { backgroundColor: colors.card, borderRadius: radius, padding: 20, marginVertical: 8 },
  title: { color: colors.text, fontSize: font.title, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginBottom: 12 },
  body: { color: colors.text, fontSize: font.body, textAlign: 'right', writingDirection: 'rtl', lineHeight: 26 },
});
