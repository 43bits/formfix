import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import type { FormFeedback } from '../../types';

const { width: W, height: H } = Dimensions.get('window');

export default function LiveOverlay({ feedback }: { feedback: FormFeedback | null }) {
  if (!feedback?.annotated_frame) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: `data:image/jpeg;base64,${feedback.annotated_frame}` }}
        style={styles.overlay}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { width: W, height: H },
});