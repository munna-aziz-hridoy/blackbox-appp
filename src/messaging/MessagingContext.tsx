import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Socket } from 'socket.io-client';
import { connect } from '../socket';
import { decrypt, encrypt } from '../crypto';
import { Identity } from '../identity';
import { registerPushToken } from '../api';
import { registerForPush } from '../push/notifications';
import {
  getContact,
  getMyProfile,
  getUnreadIncomingIds,
  loadUndeliveredOutgoing,
  markRead,
  Message,
  MyProfile,
  saveContact,
  saveMessage,
  updateDeliveryStatus,
  updateMessageStatus,
} from '../db';

type Messaging = {
  identity: Identity;
  connected: boolean;
  version: number;
  refresh: () => void;
  sendMessage: (peerId: string, body: string) => Promise<void>;
  sendImage: (peerId: string, dataUri: string) => Promise<void>;
  sendFile: (
    peerId: string,
    dataUri: string,
    fileName: string,
    mimeType: string,
  ) => Promise<void>;
  markConversationRead: (peerId: string) => Promise<void>;
  requestProfile: (userId: string) => void;
  sendCallSignal: (
    to: string,
    payload: Record<string, unknown>,
    ack?: (result: { delivered: boolean }) => void,
  ) => void;
  onCallSignal: (handler: (data: CallSignal) => void) => () => void;
  logout: () => Promise<void>;
};

export type CallSignal = {
  from: string;
  fromPublicKey: string;
  kind: 'offer' | 'answer' | 'ice' | 'end';
  nonce?: string;
  box?: string;
};

const MessagingContext = createContext<Messaging | null>(null);

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// What actually travels inside the end-to-end-encrypted box. The server only
// ever sees ciphertext — the sender's name/email never reach it.
type Payload = {
  v: 1;
  type?: 'text' | 'image' | 'file';
  body: string;
  media?: string; // base64 (no data: prefix) for image/file
  fileName?: string;
  mime?: string;
  name: string | null;
  email: string | null;
};

type Decoded = {
  type: 'text' | 'image' | 'file';
  body: string;
  media?: string;
  fileName?: string;
  mime?: string;
  name: string | null;
  email: string | null;
};

function decodePayload(text: string | null): Decoded {
  if (!text) {
    return { type: 'text', body: '[unable to decrypt]', name: null, email: null };
  }
  try {
    const parsed = JSON.parse(text) as Partial<Payload>;
    const isMedia = parsed.type === 'image' || parsed.type === 'file';
    if (parsed && (typeof parsed.body === 'string' || isMedia)) {
      return {
        type: parsed.type ?? 'text',
        body: parsed.body ?? '',
        media: parsed.media,
        fileName: parsed.fileName,
        mime: parsed.mime,
        name: parsed.name ?? null,
        email: parsed.email ?? null,
      };
    }
  } catch {
    // Not a JSON payload — treat the decrypted text as a plain body.
  }
  return { type: 'text', body: text, name: null, email: null };
}

// Extract the base64 part of a data: URI stored in message.body.
function base64Of(dataUri: string): string {
  return dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
}

export function MessagingProvider({
  identity,
  onLogout,
  children,
}: {
  identity: Identity;
  onLogout: () => Promise<void>;
  children: ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const [version, setVersion] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const callHandlers = useRef(new Set<(data: CallSignal) => void>());

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const sendCallSignal = useCallback(
    (
      to: string,
      payload: Record<string, unknown>,
      ack?: (result: { delivered: boolean }) => void,
    ) => {
      socketRef.current?.emit('call:signal', { to, ...payload }, ack);
    },
    [],
  );

  const onCallSignal = useCallback((handler: (data: CallSignal) => void) => {
    callHandlers.current.add(handler);
    return () => {
      callHandlers.current.delete(handler);
    };
  }, []);

  const sendEnvelope = useCallback(
    (message: Message, publicKey: string, profile: MyProfile) => {
      const payload: Payload =
        message.type === 'image' || message.type === 'file'
          ? {
              v: 1,
              type: message.type,
              body: '',
              media: base64Of(message.body),
              fileName: message.fileName ?? undefined,
              mime: message.mimeType ?? undefined,
              name: profile.name,
              email: profile.email,
            }
          : {
              v: 1,
              body: message.body,
              name: profile.name,
              email: profile.email,
            };
      const sealed = encrypt(
        JSON.stringify(payload),
        publicKey,
        identity.secretKey,
      );
      socketRef.current?.emit(
        'message',
        { to: message.peerId, id: message.id, ...sealed },
        async (ack: { delivered: boolean }) => {
          await updateDeliveryStatus(
            message.id,
            ack?.delivered ? 'delivered' : 'sent',
          );
          bump();
        },
      );
    },
    [identity.secretKey, bump],
  );

  const retryUndelivered = useCallback(async () => {
    if (!socketRef.current) return;
    const profile = await getMyProfile();
    const pending = await loadUndeliveredOutgoing();
    for (const message of pending) {
      const contact = await getContact(message.peerId);
      if (contact) sendEnvelope(message, contact.publicKey, profile);
    }
  }, [sendEnvelope]);

  const sendMessage = useCallback(
    async (peerId: string, body: string) => {
      const contact = await getContact(peerId);
      if (!contact) return;
      const profile = await getMyProfile();
      const message: Message = {
        id: makeId(),
        peerId,
        direction: 'out',
        type: 'text',
        body,
        fileName: null,
        mimeType: null,
        status: 'pending',
        createdAt: Date.now(),
      };
      await saveMessage(message);
      bump();
      sendEnvelope(message, contact.publicKey, profile);
    },
    [sendEnvelope, bump],
  );

  const sendImage = useCallback(
    async (peerId: string, dataUri: string) => {
      const contact = await getContact(peerId);
      if (!contact) return;
      const profile = await getMyProfile();
      const message: Message = {
        id: makeId(),
        peerId,
        direction: 'out',
        type: 'image',
        body: dataUri,
        fileName: null,
        mimeType: null,
        status: 'pending',
        createdAt: Date.now(),
      };
      await saveMessage(message);
      bump();
      sendEnvelope(message, contact.publicKey, profile);
    },
    [sendEnvelope, bump],
  );

  const sendFile = useCallback(
    async (
      peerId: string,
      dataUri: string,
      fileName: string,
      mimeType: string,
    ) => {
      const contact = await getContact(peerId);
      if (!contact) return;
      const profile = await getMyProfile();
      const message: Message = {
        id: makeId(),
        peerId,
        direction: 'out',
        type: 'file',
        body: dataUri,
        fileName,
        mimeType,
        status: 'pending',
        createdAt: Date.now(),
      };
      await saveMessage(message);
      bump();
      sendEnvelope(message, contact.publicKey, profile);
    },
    [sendEnvelope, bump],
  );

  const requestProfile = useCallback((userId: string) => {
    socketRef.current?.emit('requestProfile', { toUserId: userId });
  }, []);

  // Mark a peer's messages read locally and tell the sender (read receipt).
  const markConversationRead = useCallback(async (peerId: string) => {
    const ids = await getUnreadIncomingIds(peerId);
    await markRead(peerId);
    if (ids.length) socketRef.current?.emit('read', { to: peerId, ids });
  }, []);

  useEffect(() => {
    const socket = connect(identity.identityKey);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      retryUndelivered();
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on(
      'message',
      async (incoming: {
        from: string;
        fromPublicKey: string;
        id: string;
        nonce: string;
        box: string;
      }) => {
        const text = decrypt(
          { nonce: incoming.nonce, box: incoming.box },
          incoming.fromPublicKey,
          identity.secretKey,
        );
        const decoded = decodePayload(text);
        await saveContact({
          userId: incoming.from,
          email: decoded.email,
          name: decoded.name,
          publicKey: incoming.fromPublicKey,
        });
        const isImage = decoded.type === 'image' && !!decoded.media;
        const isFile = decoded.type === 'file' && !!decoded.media;
        const inserted = await saveMessage({
          id: incoming.id,
          peerId: incoming.from,
          direction: 'in',
          type: isImage ? 'image' : isFile ? 'file' : 'text',
          body: isImage
            ? `data:image/jpeg;base64,${decoded.media}`
            : isFile
              ? `data:${decoded.mime ?? 'application/octet-stream'};base64,${decoded.media}`
              : decoded.body,
          fileName: isFile ? (decoded.fileName ?? 'file') : null,
          mimeType: isFile ? (decoded.mime ?? null) : null,
          status: 'delivered',
          createdAt: Date.now(),
        });
        if (inserted) bump();
      },
    );

    socket.on('call:signal', (data: CallSignal) => {
      callHandlers.current.forEach((handler) => handler(data));
    });

    // A peer read our messages → mark them read (blue ticks).
    socket.on('read', async (data: { from: string; ids: string[] }) => {
      for (const id of data.ids) await updateMessageStatus(id, 'read');
      bump();
    });

    // Phase 2: a peer asks for our profile → answer encrypted to their key.
    socket.on(
      'profileRequest',
      async (req: { from: string; fromPublicKey: string }) => {
        const profile = await getMyProfile();
        const sealed = encrypt(
          JSON.stringify({ name: profile.name, email: profile.email }),
          req.fromPublicKey,
          identity.secretKey,
        );
        socket.emit('profileResponse', { to: req.from, ...sealed });
      },
    );

    // Phase 2: a peer answered our profile request.
    socket.on(
      'profile',
      async (res: {
        from: string;
        fromPublicKey: string;
        nonce: string;
        box: string;
      }) => {
        const text = decrypt(
          { nonce: res.nonce, box: res.box },
          res.fromPublicKey,
          identity.secretKey,
        );
        if (!text) return;
        try {
          const { name, email } = JSON.parse(text);
          await saveContact({
            userId: res.from,
            email: email ?? null,
            name: name ?? null,
            publicKey: res.fromPublicKey,
          });
          bump();
        } catch {
          // Ignore malformed profile responses.
        }
      },
    );

    const timer = setInterval(retryUndelivered, 15000);
    return () => {
      clearInterval(timer);
      socket.close();
      socketRef.current = null;
    };
  }, [identity.identityKey, identity.secretKey, retryUndelivered, bump]);

  useEffect(() => {
    registerForPush().then((token) => {
      if (token) registerPushToken(token, identity.identityKey);
    });
  }, [identity.identityKey]);

  return (
    <MessagingContext.Provider
      value={{
        identity,
        connected,
        version,
        refresh: bump,
        sendMessage,
        sendImage,
        sendFile,
        markConversationRead,
        requestProfile,
        sendCallSignal,
        onCallSignal,
        logout: onLogout,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging(): Messaging {
  const context = useContext(MessagingContext);
  if (!context) throw new Error('useMessaging must be used within MessagingProvider');
  return context;
}
