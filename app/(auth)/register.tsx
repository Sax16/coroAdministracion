import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { useSignUp } from '@/features/auth/hooks';
import { Button } from '@/components/Button';
import { LabeledInput } from '@/components/LabeledInput';

/**
 * Pantalla de registro.
 *
 * RF-001: registro de usuario con email + contraseña. El trigger
 * `handle_new_user` en la DB crea automáticamente la fila en
 * `public.perfiles` con el nombre y apellido.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, loading, error, clearError } = useSignUp();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = nombre.trim() && apellido.trim() && email.trim() && password.length >= 6;

  const onSubmit = async () => {
    if (!canSubmit) return;
    const ok = await signUp({ nombre, apellido, email, password });
    if (ok) {
      // El usuario queda logueado automáticamente (Supabase Auth default).
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
          <Text className="text-3xl font-bold text-slate-900">Crear cuenta</Text>
          <Text className="mt-2 text-base text-slate-600">
            Empezá a administrar tu grupo de alabanza
          </Text>
        </View>

        <LabeledInput
          label="Nombre"
          value={nombre}
          onChangeText={(t) => {
            clearError();
            setNombre(t);
          }}
          placeholder="María"
          autoCapitalize="words"
          autoComplete="given-name"
        />

        <LabeledInput
          label="Apellido"
          value={apellido}
          onChangeText={(t) => {
            clearError();
            setApellido(t);
          }}
          placeholder="García"
          autoCapitalize="words"
          autoComplete="family-name"
        />

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
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          autoComplete="new-password"
        />

        {error ? (
          <Text className="mb-3 text-sm text-red-600">{error}</Text>
        ) : null}

        <Button
          title="Crear cuenta"
          onPress={onSubmit}
          loading={loading}
          disabled={!canSubmit}
        />

        <View className="mt-6 flex-row justify-center">
          <Text className="text-slate-600">¿Ya tenés cuenta? </Text>
          <Link href="/(auth)/login" asChild>
            <Text className="font-semibold text-primary-600">Iniciá sesión</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
