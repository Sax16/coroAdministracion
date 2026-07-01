/**
 * Campo de fecha que abre el DatePicker nativo al hacer tap.
 *
 * Reemplaza al TextInput con `placeholder="YYYY-MM-DD"` /
 * `placeholder="DD/MM/AAAA"`. Mantiene la API simple:
 *   <DatePickerField
 *     label="Fecha"
 *     value={fecha}
 *     onChange={(d) => setFecha(d)}
 *     error={errores.fecha}
 *     placeholder="Seleccioná una fecha"
 *   />
 *
 * UX:
 * - El campo se ve como un Pressable con el valor formateado adentro
 *   (estilo consistente con el resto de los inputs del proyecto).
 * - iOS: el picker aparece inline abajo del campo (spinner).
 * - Android: se abre el diálogo nativo modal.
 * - En ambos casos el valor se actualiza inmediatamente y se cierra.
 * - Si `value` es null, muestra el `placeholder` en gris.
 * - `minDate` opcional (útil para evitar fechas pasadas).
 *
 * Decisiones:
 * - Trabajamos en hora local: el picker setea año/mes/día LOCALES.
 *   Esto es lo que el usuario espera ("elegí el 25 de junio" = 25 jun
 *   en su zona horaria).
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import {
  capitalize,
  formatDateDisplay,
  isoToLocalDate,
} from '@/lib/dateTime';

interface DatePickerFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  error?: string | null;
  placeholder?: string;
  minDate?: Date;
  /** Para tests / Storybook. Default false. */
  disabled?: boolean;
}

export function DatePickerField({
  label,
  value,
  onChange,
  error,
  placeholder = 'Seleccioná una fecha',
  minDate,
  disabled = false,
}: DatePickerFieldProps) {
  // En Android el picker es modal (true = mostrar). En iOS lo mantenemos
  // siempre montado para que sea inline.
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  // API moderna (>= 9.0): onValueChange se llama cuando el usuario
  // confirma un valor nuevo, onDismiss cuando cierra sin elegir.
  const handleValueChange = (_event: unknown, selected?: Date) => {
    if (!selected) return;
    onChange(selected);
  };

  const handleDismiss = () => {
    if (Platform.OS === 'android') {
      setShowAndroidPicker(false);
    }
  };

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS === 'android') setShowAndroidPicker(true);
  };

  const displayValue = value
    ? capitalize(formatDateDisplay(value))
    : null;

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-slate-700">{label}</Text>

      {/* En iOS el picker es inline. En Android lo mostramos bajo demanda. */}
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          mode="date"
          value={value ?? new Date()}
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
          minimumDate={minDate}
          locale="es"
        />
      ) : null}

      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className={`h-12 justify-center rounded-lg border bg-white px-3 ${
          error ? 'border-red-500' : 'border-slate-300'
        } ${disabled ? 'opacity-50' : 'active:bg-slate-50'}`}
      >
        <Text
          className={`text-base ${displayValue ? 'text-slate-900' : 'text-slate-400'}`}
        >
          {displayValue ?? placeholder}
        </Text>
      </Pressable>

      {Platform.OS === 'android' && showAndroidPicker ? (
        <DateTimePicker
          mode="date"
          value={value ?? new Date()}
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
          minimumDate={minDate}
        />
      ) : null}

      {error ? (
        <Text className="mt-1 text-sm text-red-600">{error}</Text>
      ) : null}
    </View>
  );
}

/**
 * Helper para convertir un ISO string a `Date` (o null) al hidratar
 * el form desde un valor existente. Re-exportado para que el código
 * del form sea más legible.
 */
export const isoToDateOrNull = isoToLocalDate;
