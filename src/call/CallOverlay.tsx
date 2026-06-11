import { ReactNode } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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
    case 'calling':
      return 'Calling…';
    case 'ringing':
      return 'Ringing…';
    case 'incoming':
      return 'Incoming call';
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return mmss(durationSec);
    case 'ended':
      return 'Call ended';
    default:
      return '';
  }
}

function RoundButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: ReactNode;
  label?: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.btnWrap}>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: color }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {icon}
      </TouchableOpacity>
      {label ? <Text style={styles.btnLabel}>{label}</Text> : null}
    </View>
  );
}

const TRANSLUCENT = 'rgba(255,255,255,0.14)';

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
                icon={
                  <Ionicons
                    name={call.muted ? 'mic-off' : 'mic'}
                    size={26}
                    color={call.muted ? colors.text : colors.white}
                  />
                }
                label={call.muted ? 'Unmute' : 'Mute'}
                color={call.muted ? colors.white : TRANSLUCENT}
                onPress={call.toggleMute}
              />
              <RoundButton
                icon={
                  <Ionicons
                    name="volume-high"
                    size={26}
                    color={call.speaker ? colors.text : colors.white}
                  />
                }
                label="Speaker"
                color={call.speaker ? colors.white : TRANSLUCENT}
                onPress={call.toggleSpeaker}
              />
            </View>
          ) : null}

          {call.state === 'incoming' ? (
            <View style={styles.controlRow}>
              <RoundButton
                icon={<MaterialIcons name="call-end" size={28} color={colors.white} />}
                label="Decline"
                color={colors.danger}
                onPress={call.hangUp}
              />
              <RoundButton
                icon={<Ionicons name="call" size={28} color={colors.text} />}
                label="Accept"
                color={colors.white}
                onPress={call.acceptCall}
              />
            </View>
          ) : (
            <RoundButton
              icon={<MaterialIcons name="call-end" size={28} color={colors.white} />}
              color={colors.danger}
              onPress={call.hangUp}
            />
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
  btnLabel: { color: colors.white, fontSize: 13 },
});
