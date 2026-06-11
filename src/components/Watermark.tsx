import { Image, StyleSheet, View } from 'react-native';

// Faint centered logo that sits behind a screen's content.
export function Watermark() {
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Image
        source={require('../../assets/black_box_logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 220, height: 220, opacity: 0.04 },
});
