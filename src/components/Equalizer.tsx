import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

const native = Platform.OS !== 'web';

export function Equalizer({ active, colors, bars = 9 }: { active: boolean; colors: [string, string]; bars?: number }) {
  const values = useRef(Array.from({ length: bars }, () => new Animated.Value(0.2))).current;

  useEffect(() => {
    if (!active) {
      values.forEach((v) => Animated.timing(v, { toValue: 0.15, duration: 250, useNativeDriver: native }).start());
      return;
    }
    let stopped = false;
    const bounce = (v: Animated.Value) => {
      if (stopped) return;
      Animated.timing(v, {
        toValue: 0.25 + Math.random() * 0.75,
        duration: 140 + Math.random() * 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: native,
      }).start(({ finished }) => finished && bounce(v));
    };
    values.forEach(bounce);
    return () => {
      stopped = true;
      values.forEach((v) => v.stopAnimation());
    };
  }, [active, values]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 48, gap: 6 }}>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 8,
            height: 48,
            borderRadius: 4,
            backgroundColor: i % 2 ? colors[0] : colors[1],
            transform: [{ translateY: Animated.multiply(Animated.subtract(1, v), 24) }, { scaleY: v }],
          }}
        />
      ))}
    </View>
  );
}
