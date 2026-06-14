import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Layout del grupo de rutas (auth).
 * Acá caen login, register, y cualquier pantalla previa al login.
 * No requiere auth (es al revés: es la zona de NO-autenticados).
 */
export default function AuthLayout() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#ffffff' },
        }}
      />
    </SafeAreaView>
  );
}
