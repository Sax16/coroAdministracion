import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { useSignIn } from '@/features/auth/hooks';
import { Button } from '@/components/Button';
import { LabeledInput } from '@/components/LabeledInput';

/**
 * Pantalla de login.
 *
 * RF-002: el usuario puede iniciar sesión con email y contraseña.
 * RF-004: link "¿Olvidaste tu contraseña?" → TODO v0.2.0 (por ahora
 * muestra un alert).
 */
export default function LoginScreen() {
  const router = useRouter();
  const { signIn, loading, error, clearError } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async () => {
    if (!email || !password) return;
    const ok = await signIn({ email, password });
    if (ok) {
      // onAuthStateChange actualiza el store; el _layout raíz redirige.
      // Hacemos replace para que el back no vuelva a login.
      router.replace('/(app)/grupos');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8">
          <Text className="text-3xl font-bold text-slate-900">Coro Administración</Text>
          <Text className="mt-2 text-base text-slate-600">
            Iniciá sesión con tu cuenta
          </Text>
        </View>

        <LabeledInput
          label="Email"
          value={email}
          onChangeText={(t) => {
            clearError();
            setEmail(t);
          }}
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />

        <LabeledInput
          label="Contraseña"
          value={password}
          onChangeText={(t) => {
            clearError();
            setPassword(t);
          }}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
        />

        {error ? (
          <Text className="mb-3 text-sm text-red-600">{error}</Text>
        ) : null}

        <Button title="Iniciar sesión" onPress={onSubmit} loading={loading} />

        <View className="mt-6 flex-row justify-center">
          <Text className="text-slate-600">¿No tenés cuenta? </Text>
          <Link href="/(auth)/register" asChild>
            <Text className="font-semibold text-primary-600">Registrate</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
