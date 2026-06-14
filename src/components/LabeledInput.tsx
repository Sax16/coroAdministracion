/**
 * Input de texto con label. Variante outlined, siguiendo la paleta
 * del proyecto. Muestra el label arriba y el campo debajo.
 */
import { Text, TextInput, TextInputProps, View } from 'react-native';

interface LabeledInputProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export function LabeledInput({ label, error, ...inputProps }: LabeledInputProps) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-slate-700">{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#94a3b8"
        className={`h-12 rounded-lg border bg-white px-3 text-base text-slate-900 ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
      />
      {error ? (
        <Text className="mt-1 text-sm text-red-600">{error}</Text>
      ) : null}
    </View>
  );
}
