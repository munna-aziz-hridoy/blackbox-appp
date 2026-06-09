import { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation';
import { useMessaging } from '../messaging/MessagingContext';
import { SearchResult, searchUser } from '../api';
import { Contact, loadContacts, saveContact } from '../db';
import { Avatar } from '../components/Avatar';
import { PrimaryButton } from '../components/PrimaryButton';
import { displayName } from '../displayName';
import { colors, radius, spacing } from '../theme';

function label(contact: Contact): string {
  return displayName(contact.name, contact.email, contact.userId);
}

export function NewChatScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { identity, refresh, requestProfile } = useMessaging();
  const [email, setEmail] = useState('');
  const [foundEmail, setFoundEmail] = useState('');
  const [result, setResult] = useState<SearchResult | null | undefined>(
    undefined,
  );
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    loadContacts().then(setContacts);
  }, []);

  async function handleSearch() {
    const query = email.trim();
    if (!query) return;
    setSearching(true);
    try {
      const found = await searchUser(query, identity.identityKey);
      setResult(found);
      if (found) setFoundEmail(query);
    } catch {
      setResult(null);
    } finally {
      setSearching(false);
    }
  }

  function openChat(peerId: string, title: string) {
    navigation.replace('Chat', { peerId, title });
  }

  async function handleAdd() {
    if (!result) return;
    setAdding(true);
    await saveContact({
      userId: result.userId,
      email: foundEmail,
      name: null,
      publicKey: result.publicKey,
    });
    refresh();
    // Pull their name straight from their phone (server-blind) if they're online.
    if (result.online) requestProfile(result.userId);
    openChat(result.userId, foundEmail);
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Find by email"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={handleSearch}
          activeOpacity={0.85}
        >
          <Text style={styles.searchBtnText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {searching ? (
        <Text style={styles.muted}>Searching…</Text>
      ) : result === undefined ? null : result === null ? (
        <Text style={styles.muted}>No verified user with that email.</Text>
      ) : (
        <View style={styles.result}>
          <Avatar label={foundEmail} size={44} />
          <View style={styles.resultBody}>
            <Text style={styles.resultName}>{foundEmail}</Text>
            <Text style={[styles.presence, result.online && styles.online]}>
              {result.online ? '● online' : '○ offline'}
            </Text>
          </View>
          <View style={styles.addBtn}>
            <PrimaryButton title="Add & chat" onPress={handleAdd} loading={adding} />
          </View>
        </View>
      )}

      <Text style={styles.heading}>Contacts</Text>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.userId}
        ListEmptyComponent={<Text style={styles.muted}>No contacts yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.contact}
            activeOpacity={0.6}
            onPress={() => openChat(item.userId, label(item))}
          >
            <Avatar label={label(item)} size={44} />
            <Text style={styles.contactName}>{label(item)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { fontSize: 18 },
  muted: { color: colors.faint, marginTop: spacing.md },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  resultBody: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '600', color: colors.text },
  resultEmail: { fontSize: 13, color: colors.muted, marginTop: 1 },
  presence: { fontSize: 13, color: colors.faint, marginTop: 2 },
  online: { color: colors.accent },
  addBtn: { minWidth: 130 },
  heading: {
    fontSize: 13,
    color: colors.muted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  contactName: { fontSize: 16, color: colors.text },
});
