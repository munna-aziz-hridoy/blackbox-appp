import { useEffect, useLayoutEffect, useState } from "react";
import {
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppStackParamList } from "../navigation";
import { useMessaging } from "../messaging/MessagingContext";
import { useCall } from "../call/CallContext";
import { getContact, loadMessagesWith, Message } from "../db";
import { colors, radius, spacing } from "../theme";

function Ticks({ status }: { status: Message["status"] }) {
  if (status === "pending") return <Text style={styles.tick}>🕓</Text>;
  if (status === "read")
    return <Text style={[styles.tick, styles.tickRead]}>✓✓</Text>;
  if (status === "delivered") return <Text style={styles.tick}>✓✓</Text>;
  return <Text style={styles.tick}>✓</Text>;
}

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<AppStackParamList, "Chat">>();
  const { version, sendMessage, markConversationRead, requestProfile } =
    useMessaging();
  const { startCall } = useCall();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [peerEmail, setPeerEmail] = useState<string | null>(null);
  const [peerPublicKey, setPeerPublicKey] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {params.title}
          </Text>
          {peerEmail && peerEmail !== params.title ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {peerEmail}
            </Text>
          ) : null}
        </View>
      ),
      headerRight: () =>
        peerPublicKey ? (
          <TouchableOpacity
            onPress={() =>
              startCall({
                userId: params.peerId,
                publicKey: peerPublicKey,
                name: params.title,
              })
            }
            hitSlop={12}
          >
            <Text style={styles.callButton}>📞</Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, params.title, params.peerId, peerEmail, peerPublicKey, startCall]);

  useEffect(() => {
    let active = true;
    loadMessagesWith(params.peerId).then((rows) => {
      if (active) setMessages(rows);
    });
    getContact(params.peerId).then((contact) => {
      if (!active) return;
      setPeerEmail(contact?.email ?? null);
      setPeerPublicKey(contact?.publicKey ?? null);
    });
    markConversationRead(params.peerId);
    return () => {
      active = false;
    };
  }, [params.peerId, version, markConversationRead]);

  useEffect(() => {
    requestProfile(params.peerId);
  }, [params.peerId, requestProfile]);

  async function handleSend() {
    const text = body.trim();
    if (!text) return;
    setBody("");
    await sendMessage(params.peerId, text);
  }

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptyHint}>Say hi 👋</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={[...messages].reverse()}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.direction === "out" ? styles.out : styles.in,
              ]}
            >
              <Text style={styles.bubbleText}>{item.body}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaTime}>{clockTime(item.createdAt)}</Text>
                {item.direction === "out" ? <Ticks status={item.status} /> : null}
              </View>
            </View>
          )}
        />
      )}

      <View
        style={[
          styles.inputBar,
          {
            paddingBottom:
              keyboardHeight > 0 ? spacing.xl : insets.bottom + spacing.sm,
          },
        ]}
      >
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor={colors.faint}
          value={body}
          onChangeText={setBody}
          multiline
        />
        <TouchableOpacity
          style={styles.send}
          activeOpacity={0.85}
          onPress={handleSend}
        >
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.chatBg },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: "600" },
  headerSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  callButton: { fontSize: 20, paddingHorizontal: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 16, color: colors.muted, fontWeight: "600" },
  emptyHint: { fontSize: 14, color: colors.faint, marginTop: spacing.xs },
  list: { flex: 1 },
  listContent: { padding: spacing.md },
  bubble: {
    maxWidth: "82%",
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    marginVertical: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  out: { alignSelf: "flex-end", backgroundColor: colors.bubbleOut },
  in: { alignSelf: "flex-start", backgroundColor: colors.bubbleIn },
  bubbleText: { fontSize: 15, color: colors.text },
  meta: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  metaTime: { fontSize: 10, color: colors.faint },
  tick: { fontSize: 11, color: colors.tick },
  tickRead: { color: colors.tickRead },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: spacing.sm,
    backgroundColor: "transparent",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    maxHeight: 120,
    fontSize: 15,
    color: colors.text,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: colors.white, fontSize: 18 },
});
