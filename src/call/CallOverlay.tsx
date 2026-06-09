import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCall } from './CallContext';
import { Avatar } from '../components/Avatar';
import { colors } from '../theme';

function mmss(total: number): string {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function statusLabel(state: string, durationSec: number): string {
  switch (state) {
    case 'outgoing':
      return 'Calling…';
    case 'incoming':
      return 'Incoming call';
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return mmss(durationSec);
    case 'unavailable':
      return 'Unavailable';
    case 'ended':
      return 'Call ended';
    default:
      return '';
  }
}

function RoundButton({
  glyph,
  label,
  color,
  onPress,
  active,
}: {
  glyph: string;
  label?: string;
  color: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <View style={styles.btnWrap}>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: color }, active && styles.btnActive]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.btnGlyph}>{glyph}</Text>
      </TouchableOpacity>
      {label ? <Text style={styles.btnLabel}>{label}</Text> : null}
    </View>
  );
}

export function CallOverlay() {
  const call = useCall();
  const visible = call.state !== 'idle';
  const name = call.peer?.name ?? 'Unknown';

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.top}>
          <Avatar label={name} size={112} />
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.status}>
            {statusLabel(call.state, call.durationSec)}
          </Text>
        </View>

        <View style={styles.controls}>
          {call.state === 'connected' ? (
            <View style={styles.controlRow}>
              <RoundButton
                glyph={call.muted ? '🔇' : '🎙'}
                label={call.muted ? 'Unmute' : 'Mute'}
                color={colors.surface}
                active={call.muted}
                onPress={call.toggleMute}
              />
              <RoundButton
                glyph="🔊"
                label="Speaker"
                color={colors.surface}
                active={call.speaker}
                onPress={call.toggleSpeaker}
              />
            </View>
          ) : null}

          {call.state === 'incoming' ? (
            <View style={styles.controlRow}>
              <RoundButton
                glyph="✕"
                label="Decline"
                color={colors.danger}
                onPress={call.hangUp}
              />
              <RoundButton
                glyph="📞"
                label="Accept"
                color={colors.accent}
                onPress={call.acceptCall}
              />
            </View>
          ) : (
            <RoundButton glyph="📵" color={colors.danger} onPress={call.hangUp} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brandDark,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  top: { alignItems: 'center', gap: 16, marginTop: 40 },
  name: { color: colors.white, fontSize: 26, fontWeight: '600' },
  status: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  controls: { alignItems: 'center', gap: 24 },
  controlRow: { flexDirection: 'row', gap: 48 },
  btnWrap: { alignItems: 'center', gap: 8 },
  btn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: { opacity: 0.7 },
  btnGlyph: { fontSize: 28 },
  btnLabel: { color: colors.white, fontSize: 13 },
});
