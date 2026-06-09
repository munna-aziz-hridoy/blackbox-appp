import { StyleSheet, Text, View } from 'react-native';
import { avatarColor, colors } from '../theme';

export function Avatar({ label, size = 48 }: { label: string; size?: number }) {
  const letter = (label.trim().charAt(0) || '?').toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColor(label),
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.white, fontWeight: '700' },
});
