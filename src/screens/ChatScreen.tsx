import { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import EmojiPicker from "rn-emoji-keyboard";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppStackParamList } from "../navigation";
import { useMessaging } from "../messaging/MessagingContext";
import { useCall } from "../call/CallContext";
import { getContact, loadMessagesWith, Message } from "../db";
import { colors, radius, spacing } from "../theme";

const TICK_DIM = "rgba(255,255,255,0.6)";

function Ticks({ status }: { status: Message["status"] }) {
  if (status === "pending") {
    return (
      <Ionicons name="time-outline" size={13} color={TICK_DIM} style={styles.tick} />
    );
  }
  return (
    <Ionicons
      name={status === "sent" ? "checkmark" : "checkmark-done"}
      size={14}
      color={status === "read" ? colors.white : TICK_DIM}
      style={styles.tick}
    />
  );
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
  const {
    version,
    sendMessage,
    sendImage,
    sendFile,
    markConversationRead,
    requestProfile,
  } = useMessaging();
  const { startCall } = useCall();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
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
            style={styles.callButton}
          >
            <Ionicons name="call" size={22} color={colors.white} />
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

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to send images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (result.canceled) return;
    const compressed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!compressed.base64) return;
    await sendImage(params.peerId, `data:image/jpeg;base64,${compressed.base64}`);
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 8 * 1024 * 1024) {
      Alert.alert("File too large", "Files must be under 8 MB.");
      return;
    }
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime = asset.mimeType ?? "application/octet-stream";
    await sendFile(
      params.peerId,
      `data:${mime};base64,${base64}`,
      asset.name,
      mime,
    );
  }

  async function openFile(message: Message) {
    try {
      const base64 = message.body.includes(",")
        ? message.body.split(",")[1]
        : message.body;
      const uri = `${FileSystem.cacheDirectory}${message.fileName ?? "file"}`;
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: message.mimeType ?? undefined,
        });
      }
    } catch {
      Alert.alert("Could not open file");
    }
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
              {item.type === "image" ? (
                <Image source={{ uri: item.body }} style={styles.bubbleImage} />
              ) : item.type === "file" ? (
                <TouchableOpacity
                  style={styles.fileRow}
                  activeOpacity={0.7}
                  onPress={() => openFile(item)}
                >
                  <Ionicons
                    name="document-outline"
                    size={26}
                    color={
                      item.direction === "out" ? colors.white : colors.text
                    }
                  />
                  <Text
                    style={[
                      styles.fileName,
                      item.direction === "out"
                        ? styles.bubbleTextOut
                        : styles.bubbleTextIn,
                    ]}
                    numberOfLines={1}
                  >
                    {item.fileName ?? "file"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text
                  style={[
                    styles.bubbleText,
                    item.direction === "out"
                      ? styles.bubbleTextOut
                      : styles.bubbleTextIn,
                  ]}
                >
                  {item.body}
                </Text>
              )}
              <View style={styles.meta}>
                <Text
                  style={[
                    styles.metaTime,
                    item.direction === "out" && styles.metaTimeOut,
                  ]}
                >
                  {clockTime(item.createdAt)}
                </Text>
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
        <TouchableOpacity
          style={styles.attach}
          activeOpacity={0.6}
          onPress={() => {
            Keyboard.dismiss();
            setEmojiOpen(true);
          }}
        >
          <Ionicons name="happy-outline" size={24} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.attach}
          activeOpacity={0.6}
          onPress={pickDocument}
        >
          <Ionicons name="attach" size={24} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.attach}
          activeOpacity={0.6}
          onPress={pickImage}
        >
          <Ionicons name="image-outline" size={24} color={colors.muted} />
        </TouchableOpacity>
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
          <Ionicons name="send" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      <EmojiPicker
        open={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onEmojiSelected={(e) => setBody((b) => b + e.emoji)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.chatBg },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: "600" },
  headerSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  callButton: { paddingHorizontal: 4 },
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
  bubbleText: { fontSize: 15 },
  bubbleTextOut: { color: colors.white },
  bubbleTextIn: { color: colors.text },
  bubbleImage: { width: 240, height: 240, borderRadius: 10 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 240,
    paddingVertical: 2,
  },
  fileName: { fontSize: 14, flexShrink: 1 },
  meta: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  metaTime: { fontSize: 10, color: colors.faint },
  metaTimeOut: { color: "rgba(255,255,255,0.55)" },
  tick: { marginLeft: 3 },
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
  attach: {
    width: 34,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
});
