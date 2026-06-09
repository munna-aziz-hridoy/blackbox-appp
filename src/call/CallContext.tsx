import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useMessaging, CallSignal } from '../messaging/MessagingContext';
import { getTurnCredentials, IceServer } from '../api';
import { encrypt, decrypt } from '../crypto';
import { getContact } from '../db';
import { displayName } from '../displayName';

export type CallState =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'unavailable'
  | 'ended';

export type CallPeer = { userId: string; publicKey: string; name: string };

type Call = {
  state: CallState;
  peer: CallPeer | null;
  muted: boolean;
  speaker: boolean;
  durationSec: number;
  startCall: (peer: CallPeer) => Promise<void>;
  acceptCall: () => Promise<void>;
  hangUp: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
};

const CallContext = createContext<Call | null>(null);

// Native modules are required lazily so the app still loads in Expo Go (where
// they're absent) — only an actual call needs the dev build.
function loadWebrtc() {
  return require('react-native-webrtc');
}
function loadInCallManager(): any {
  try {
    return require('react-native-incall-manager').default;
  } catch {
    return null;
  }
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { identity, sendCallSignal, onCallSignal } = useMessaging();

  const [state, setState] = useState<CallState>('idle');
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const peerRef = useRef<CallPeer | null>(null);
  const roleRef = useRef<'caller' | 'callee' | null>(null);
  const pendingOfferRef = useRef<CallSignal | null>(null);
  const iceQueueRef = useRef<any[]>([]);

  const incall = useRef(loadInCallManager());

  const seal = useCallback(
    (kind: string, obj: unknown, toPublicKey: string) => ({
      kind,
      ...encrypt(JSON.stringify(obj), toPublicKey, identity.secretKey),
    }),
    [identity.secretKey],
  );

  const open = useCallback(
    (data: CallSignal): any => {
      if (!data.nonce || !data.box) return null;
      const text = decrypt(
        { nonce: data.nonce, box: data.box },
        data.fromPublicKey,
        identity.secretKey,
      );
      return text ? JSON.parse(text) : null;
    },
    [identity.secretKey],
  );

  const cleanup = useCallback(() => {
    try {
      pcRef.current?.close();
    } catch {
      // already closed
    }
    pcRef.current = null;
    localStreamRef.current?.getTracks?.().forEach((t: any) => t.stop());
    localStreamRef.current = null;
    iceQueueRef.current = [];
    pendingOfferRef.current = null;
    peerRef.current = null;
    roleRef.current = null;
    incall.current?.stopRingtone?.();
    incall.current?.stopRingback?.();
    incall.current?.stop?.();
    setMuted(false);
    setSpeaker(false);
  }, []);

  const end = useCallback(
    (notifyPeer: boolean, next: CallState = 'idle') => {
      if (notifyPeer && peerRef.current) {
        sendCallSignal(peerRef.current.userId, { kind: 'end' });
      }
      cleanup();
      setState(next);
      setPeer(null);
      if (next !== 'idle') setTimeout(() => setState('idle'), 1500);
    },
    [cleanup, sendCallSignal],
  );

  const createPeer = useCallback(
    async (iceServers: IceServer[]) => {
      const { RTCPeerConnection, mediaDevices } = loadWebrtc();
      const pc = new RTCPeerConnection({ iceServers });

      pc.addEventListener('icecandidate', (event: any) => {
        const target = peerRef.current;
        if (!event.candidate || !target) return;
        sendCallSignal(
          target.userId,
          seal(
            'ice',
            {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            },
            target.publicKey,
          ),
        );
      });

      pc.addEventListener('connectionstatechange', () => {
        const s = pc.connectionState;
        if (s === 'connected') {
          incall.current?.stopRingback?.();
          incall.current?.stopRingtone?.();
          setState('connected');
        } else if (s === 'failed' || s === 'closed' || s === 'disconnected') {
          if (peerRef.current) end(false, 'ended');
        }
      });

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));
      return pc;
    },
    [sendCallSignal, seal, end],
  );

  const flushIce = useCallback(async () => {
    const { RTCIceCandidate } = loadWebrtc();
    const pc = pcRef.current;
    if (!pc) return;
    for (const candidate of iceQueueRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    iceQueueRef.current = [];
  }, []);

  const startCall = useCallback(
    async (target: CallPeer) => {
      if (peerRef.current) return;
      peerRef.current = target;
      roleRef.current = 'caller';
      setPeer(target);
      setState('outgoing');
      try {
        incall.current?.start?.({ media: 'audio' });
        incall.current?.startRingback?.();
        const { iceServers } = await getTurnCredentials(identity.identityKey);
        const { RTCSessionDescription } = loadWebrtc();
        const pc = await createPeer(iceServers);
        pcRef.current = pc;
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(new RTCSessionDescription(offer));
        sendCallSignal(
          target.userId,
          seal('offer', offer, target.publicKey),
          (ack) => {
            if (!ack?.delivered && peerRef.current) end(false, 'unavailable');
          },
        );
      } catch {
        end(false, 'ended');
      }
    },
    [identity.identityKey, createPeer, sendCallSignal, seal, end],
  );

  const acceptCall = useCallback(async () => {
    const pending = pendingOfferRef.current;
    const target = peerRef.current;
    if (!pending || !target) return;
    try {
      incall.current?.stopRingtone?.();
      incall.current?.start?.({ media: 'audio' });
      const { iceServers } = await getTurnCredentials(identity.identityKey);
      const { RTCSessionDescription } = loadWebrtc();
      const pc = await createPeer(iceServers);
      pcRef.current = pc;
      const offer = open(pending);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(new RTCSessionDescription(answer));
      sendCallSignal(target.userId, seal('answer', answer, target.publicKey));
      pendingOfferRef.current = null;
      setState('connecting');
    } catch {
      end(true, 'ended');
    }
  }, [identity.identityKey, createPeer, open, flushIce, sendCallSignal, seal, end]);

  const hangUp = useCallback(() => end(true), [end]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t: any) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    const next = !speaker;
    incall.current?.setForceSpeakerphoneOn?.(next);
    setSpeaker(next);
  }, [speaker]);

  useEffect(() => {
    const unsubscribe = onCallSignal(async (data: CallSignal) => {
      const active = peerRef.current;

      if (data.kind === 'offer') {
        if (active) {
          sendCallSignal(data.from, { kind: 'end' });
          return;
        }
        pendingOfferRef.current = data;
        const contact = await getContact(data.from);
        const incoming: CallPeer = {
          userId: data.from,
          publicKey: data.fromPublicKey,
          name: displayName(contact?.name, contact?.email, data.from),
        };
        peerRef.current = incoming;
        roleRef.current = 'callee';
        setPeer(incoming);
        setState('incoming');
        incall.current?.startRingtone?.('_BUNDLE_');
        return;
      }

      if (!active || active.userId !== data.from) return;

      if (data.kind === 'answer') {
        const answer = open(data);
        const { RTCSessionDescription } = loadWebrtc();
        await pcRef.current?.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
        await flushIce();
        setState('connecting');
      } else if (data.kind === 'ice') {
        const candidate = open(data);
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          const { RTCIceCandidate } = loadWebrtc();
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceQueueRef.current.push(candidate);
        }
      } else if (data.kind === 'end') {
        end(false, 'ended');
      }
    });
    return unsubscribe;
  }, [onCallSignal, sendCallSignal, open, flushIce, end]);

  useEffect(() => {
    if (state !== 'connected') return;
    setDurationSec(0);
    const timer = setInterval(() => setDurationSec((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  return (
    <CallContext.Provider
      value={{
        state,
        peer,
        muted,
        speaker,
        durationSec,
        startCall,
        acceptCall,
        hangUp,
        toggleMute,
        toggleSpeaker,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall(): Call {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
}
