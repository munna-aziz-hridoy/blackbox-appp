import { useEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { register, verify } from '../api';
import { generateKeyPair } from '../crypto';
import { Identity, saveIdentity } from '../identity';
import { setMyProfile } from '../db';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, spacing } from '../theme';

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (identity: Identity) => void;
}) {
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [keyPair, setKeyPair] = useState<{
    publicKey: string;
    secretKey: string;
  } | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      const pair = keyPair ?? generateKeyPair();
      const { devCode: dev } = await register(email.trim(), pair.publicKey);
      setKeyPair(pair);
      setDevCode(dev ?? null);
      setPhase('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!keyPair) return;
    setError(null);
    setBusy(true);
    try {
      const identityKey = await verify(email.trim(), code.trim());
      const identity: Identity = { identityKey, ...keyPair };
      await saveIdentity(identity);
      await setMyProfile(name.trim(), email.trim());
      onAuthenticated(identity);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired code');
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    setPhase('email');
    setCode('');
    setError(null);
    setDevCode(null);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
        <View style={styles.hero}>
          <Image
            source={require('../../assets/black_box_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Black Box</Text>
          <Text style={styles.tagline}>
            End-to-end encrypted. Your messages never touch our servers.
          </Text>
        </View>

        <View style={styles.form}>
          {phase === 'email' ? (
            <>
              <Text style={styles.label}>Your name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Alex Rivera"
                placeholderTextColor={colors.faint}
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
                editable={!busy}
              />
              <Text style={styles.label}>Your email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!busy}
              />
              <PrimaryButton
                title="Send code"
                onPress={sendCode}
                loading={busy}
                disabled={!validEmail}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Enter the 6-digit code</Text>
              <Text style={styles.sub}>Sent to {email}</Text>
              {devCode ? (
                <Text style={styles.dev}>dev code: {devCode}</Text>
              ) : null}
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="••••••"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                editable={!busy}
              />
              <PrimaryButton
                title="Verify"
                onPress={handleVerify}
                loading={busy}
                disabled={code.trim().length < 6}
              />
              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={changeEmail} disabled={busy}>
                  <Text style={styles.linkText}>Change email</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={sendCode} disabled={busy}>
                  <Text style={styles.linkText}>Resend code</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  hero: { alignItems: 'center', marginBottom: spacing.xl * 1.5 },
  logo: {
    width: 84,
    height: 84,
    marginBottom: spacing.lg,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  tagline: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    lineHeight: 20,
  },
  form: { gap: spacing.md },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, marginTop: -4 },
  dev: { fontSize: 13, fontFamily: 'monospace', color: colors.brand },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  linkText: { color: colors.brand, fontSize: 14, fontWeight: '600' },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
