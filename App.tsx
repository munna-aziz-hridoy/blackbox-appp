import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppStackParamList } from './src/navigation';
import { colors } from './src/theme';
import { MessagingProvider } from './src/messaging/MessagingContext';
import { CallProvider } from './src/call/CallContext';
import { CallOverlay } from './src/call/CallOverlay';
import { AuthScreen } from './src/screens/AuthScreen';
import { ChatsListScreen } from './src/screens/ChatsListScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { NewChatScreen } from './src/screens/NewChatScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import {
  clearIdentity,
  emailFromKey,
  Identity,
  loadIdentity,
} from './src/identity';
import { clearAll, getMyProfile, initDb, setMyProfile } from './src/db';

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator();

const brandHeader = {
  headerStyle: { backgroundColor: colors.brandDark },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: '600' as const },
};

function tabIcon(symbol: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 18, color }}>{symbol}</Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        ...brandHeader,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatsListScreen}
        options={{
          headerTitle: 'Serverless Messenger',
          tabBarIcon: tabIcon('💬'),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: tabIcon('⚙️') }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await initDb();
      const stored = await loadIdentity();
      if (stored) {
        // Backfill local email for sessions created before email left the token.
        const profile = await getMyProfile();
        if (!profile.email) {
          const legacy = emailFromKey(stored.identityKey);
          if (legacy) await setMyProfile(profile.name ?? '', legacy);
        }
      }
      setIdentity(stored);
      setReady(true);
    })();
  }, []);

  const logout = useCallback(async () => {
    await clearIdentity();
    await clearAll();
    setIdentity(null);
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {identity ? (
        <MessagingProvider identity={identity} onLogout={logout}>
          <CallProvider>
            <NavigationContainer>
              <Stack.Navigator screenOptions={brandHeader}>
                <Stack.Screen
                  name="Tabs"
                  component={Tabs}
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="Chat" component={ChatScreen} />
                <Stack.Screen
                  name="NewChat"
                  component={NewChatScreen}
                  options={{ title: 'New chat' }}
                />
              </Stack.Navigator>
            </NavigationContainer>
            <CallOverlay />
          </CallProvider>
        </MessagingProvider>
      ) : (
        <AuthScreen onAuthenticated={setIdentity} />
      )}
    </SafeAreaProvider>
  );
}
