import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, gradients } from '../theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <LinearGradient colors={gradients.bg} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  gradient?: [string, string];
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
};

export function Button({ title, onPress, gradient = gradients.main, variant = 'primary', disabled, style, icon }: ButtonProps) {
  const handle = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };
  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={handle}
        disabled={disabled}
        style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.7 }, disabled && { opacity: 0.4 }, style]}
      >
        {icon}
        <Text style={styles.ghostText}>{title}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={handle} disabled={disabled} style={({ pressed }) => [pressed && { transform: [{ scale: 0.97 }] }, style]}>
      <LinearGradient
        colors={disabled ? ['#3A3060', '#2A2050'] : gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primary}
      >
        {icon}
        <Text style={[styles.primaryText, disabled && { color: colors.textMuted }]}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}

export function P({ children, style, selectable }: { children: ReactNode; style?: StyleProp<TextStyle>; selectable?: boolean }) {
  return (
    <Text style={[styles.p, style]} selectable={selectable}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16, flexGrow: 1 },
  primary: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  ghost: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ghostText: { color: colors.textDim, fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.cardBorder },
  h1: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  h2: { color: colors.text, fontSize: 20, fontWeight: '800' },
  p: { color: colors.textDim, fontSize: 15, lineHeight: 21 },
});
