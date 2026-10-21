import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

/** Ein Wert mit eigenem Kopieren-Knopf, z. B. Paketname oder SHA1 fürs Spotify-Dashboard. */
export function CopyRow({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async () => {
    await Clipboard.setStringAsync(value).catch(() => {});
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Pressable onPress={copy} style={styles.row} accessibilityLabel={`${label ?? value} kopieren`}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {label && <Text style={styles.label}>{label}</Text>}
        <Text selectable style={styles.value}>
          {value}
        </Text>
      </View>
      <View style={[styles.btn, copied && { backgroundColor: colors.green }]}>
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? colors.bg : colors.text} />
        <Text style={[styles.btnText, copied && { color: colors.bg }]}>{copied ? 'Kopiert' : 'Kopieren'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgSoft,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  value: { color: colors.cyan, fontFamily: 'monospace', fontSize: 13 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardBorder,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  btnText: { color: colors.text, fontWeight: '800', fontSize: 13 },
});
