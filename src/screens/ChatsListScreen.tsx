import { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../navigation';
import { useMessaging } from '../messaging/MessagingContext';
import { Conversation, loadConversations } from '../db';
import { Avatar } from '../components/Avatar';
import { displayName } from '../displayName';
import { colors, radius, spacing } from '../theme';

function formatTime(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function label(conversation: Conversation): string {
  return displayName(conversation.name, conversation.email, conversation.peerId);
}

function Tick({ status }: { status: Conversation['lastStatus'] }) {
  if (status === 'pending') {
    return (
      <Ionicons
        name="time-outline"
        size={14}
        color={colors.faint}
        style={styles.tickIcon}
      />
    );
  }
  return (
    <Ionicons
      name={status === 'sent' ? 'checkmark' : 'checkmark-done'}
      size={15}
      color={status === 'read' ? colors.tickRead : colors.faint}
      style={styles.tickIcon}
    />
  );
}

export function ChatsListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { version, connected } = useMessaging();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadConversations().then((rows) => active && setConversations(rows));
      return () => {
        active = false;
      };
    }, [version]),
  );

  return (
    <View style={styles.container}>
      {!connected ? (
        <Text style={styles.connecting}>connecting…</Text>
      ) : null}

      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="chatbubbles-outline"
            size={56}
            color={colors.faint}
            style={styles.emptyEmoji}
          />
          <Text style={styles.emptyText}>No chats yet</Text>
          <Text style={styles.emptyHint}>Tap + to find someone by email.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.peerId}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.6}
              onPress={() =>
                navigation.navigate('Chat', {
                  peerId: item.peerId,
                  title: label(item),
                })
              }
            >
              <Avatar label={label(item)} />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {label(item)}
                  </Text>
                  <Text
                    style={[styles.time, item.unread > 0 && styles.timeUnread]}
                  >
                    {formatTime(item.lastMessageAt)}
                  </Text>
                </View>
                <View style={styles.rowTop}>
                  <View style={styles.previewRow}>
                    {item.lastDirection === 'out' ? (
                      <Tick status={item.lastStatus} />
                    ) : null}
                    {item.lastType === 'image' ? (
                      <Ionicons
                        name="image-outline"
                        size={14}
                        color={colors.muted}
                        style={styles.tickIcon}
                      />
                    ) : null}
                    <Text style={styles.preview} numberOfLines={1}>
                      {item.lastType === 'image' ? 'Photo' : item.lastBody}
                    </Text>
                  </View>
                  {item.unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('NewChat')}
      >
        <Ionicons name="add" size={30} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  connecting: {
    textAlign: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#FFF8E1',
    color: '#996C00',
    fontSize: 12,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 18, color: colors.text, fontWeight: '600' },
  emptyHint: { fontSize: 14, color: colors.faint, marginTop: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowBody: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
  time: { fontSize: 12, color: colors.faint },
  timeUnread: { color: colors.accent, fontWeight: '600' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  preview: { fontSize: 14, color: colors.muted, flex: 1 },
  tickIcon: { marginRight: 3 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginTop: 2,
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
