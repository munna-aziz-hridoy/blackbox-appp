import { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMessaging } from '../messaging/MessagingContext';
import { getMyProfile, setMyProfile } from '../db';
import { SERVER_URL } from '../config';
import { Avatar } from '../components/Avatar';
import { Watermark } from '../components/Watermark';
import { displayName } from '../displayName';
import { colors, radius, spacing } from '../theme';

export function SettingsScreen() {
  const { identity, connected, logout } = useMessaging();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyProfile().then((profile) => {
      setName(profile.name ?? '');
      setEmail(profile.email ?? '');
    });
  }, []);

  async function saveName() {
    setSaving(true);
    try {
      await setMyProfile(name.trim(), email);
      Alert.alert('Saved', 'Your name has been updated.');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    Alert.alert(
      'Log out',
      'This removes your identity key and all local chats from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: logout },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <Watermark />
      <View style={styles.card}>
        <Avatar label={displayName(name, email, identity.identityKey)} size={64} />
        <View style={styles.cardBody}>
          <Text style={styles.name}>{name.trim() || 'Add your name'}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: connected ? colors.accent : colors.faint },
              ]}
            />
            <Text style={styles.status}>
              {connected ? 'Connected' : 'Connecting…'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.section}>Your name</Text>
      <Text style={styles.hint}>This is what people you message will see.</Text>
      <View style={styles.editRow}>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={colors.faint}
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={saveName}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveText}>{saving ? '…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Server</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {SERVER_URL}
        </Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Encryption</Text>
        <Text style={styles.infoValue}>End-to-end (X25519)</Text>
      </View>

      <TouchableOpacity style={styles.logout} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardBody: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  email: { fontSize: 14, color: colors.muted, marginTop: 1 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 13, color: colors.muted },
  section: {
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.xl,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: { fontSize: 13, color: colors.faint, marginTop: spacing.xs },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 48,
    fontSize: 15,
    color: colors.text,
  },
  saveBtn: {
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.lg,
  },
  infoLabel: { fontSize: 14, color: colors.muted },
  infoValue: { fontSize: 14, color: colors.text, flexShrink: 1, textAlign: 'right' },
  logout: {
    marginTop: spacing.xl,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
