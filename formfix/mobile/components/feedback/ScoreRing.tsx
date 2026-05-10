import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Font } from '../../constants/theme';

interface Props { score: number; size?: number; }

export default function ScoreRing({ score, size = 120 }: Props) {
  const r    = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  const color = score >= 80 ? Colors.accent : score >= 60 ? Colors.warn : Colors.danger;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={Colors.card} strokeWidth={8} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={8} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          rotation="-90" origin={`${size / 2},${size / 2}`}
        />
      </Svg>
      <Text style={[styles.score, { color }]}>{score}</Text>
      <Text style={styles.label}>/100</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  score: { fontSize: Font.sizes.xxl, fontWeight: Font.weight.black },
  label: { color: Colors.textMuted, fontSize: Font.sizes.xs, marginTop: -4 },
});
