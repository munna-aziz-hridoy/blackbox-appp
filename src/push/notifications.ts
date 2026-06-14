import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Remote push doesn't exist in Expo Go (removed in SDK 53) — only in a dev build.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Show banners + play sound even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// A local (on-device) notification — works without FCM, while the app is alive.
export async function showLocalNotification(
  title: string,
  body: string,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: null,
    });
  } catch {
    // ignore (e.g. permissions not granted)
  }
}

export async function registerForPush(): Promise<string | null> {
  if (isExpoGo) return null;

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  if (!projectId) return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[push] expo token', token.data);
    return token.data;
  } catch (e) {
    console.log('[push] token error', (e as Error).message);
    return null;
  }
}
