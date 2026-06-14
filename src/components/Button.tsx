/**
 * Botón primario de la app. Variantes:
 * - primary (default): indigo, fondo sólido
 * - secondary: outline, fondo transparente
 * - danger: rojo
 *
 * Usa NativeWind para los estilos. Sigue la paleta definida en
 * tailwind.config.js (primary.* y accent.*).
 */
import { ActivityIndicator, Pressable, Text, ViewStyle } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const VARIANT_STYLES: Record<
  Variant,
  { container: string; text: string; spinnerColor: string }
> = {
  primary: {
    container: 'bg-primary-600 active:bg-primary-700',
    text: 'text-white',
    spinnerColor: '#ffffff',
  },
  secondary: {
    container: 'border border-slate-300 bg-white active:bg-slate-50',
    text: 'text-slate-700',
    spinnerColor: '#475569',
  },
  danger: {
    container: 'bg-red-600 active:bg-red-700',
    text: 'text-white',
    spinnerColor: '#ffffff',
  },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`h-12 items-center justify-center rounded-lg px-4 ${v.container} ${
        isDisabled ? 'opacity-50' : ''
      }`}
      style={style}
    >
      {loading ? (
        <ActivityIndicator color={v.spinnerColor} />
      ) : (
        <Text className={`text-base font-semibold ${v.text}`}>{title}</Text>
      )}
    </Pressable>
  );
}
