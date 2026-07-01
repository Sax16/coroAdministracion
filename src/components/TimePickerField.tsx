/**
 * Campo de hora que abre el TimePicker nativo al hacer tap.
 *
 * Reemplaza al TextInput con `placeholder="HH:MM"`. Misma API que
 * `DatePickerField`:
 *   <TimePickerField
 *     label="Hora"
 *     value={hora}            // Date | null
 *     onChange={(d) => setHora(d)}
 *     error={errores.hora}
 *   />
 *
 * Decisiones:
 * - **24 horas siempre.** El coro trabaja en 24h, no queremos AM/PM
 *   (es confuso para los admins que ya cargan "19:00"). Se puede
 *   cambiar a `is24Hour={false}` si algún día se i18n-iza.
 * - Trabajamos con `Date` por consistencia con DatePickerField. El
 *   form llama a `dateToHHMM(value)` cuando necesita el string para
 *   guardar en la DB (jsonb del patrón, validación, etc.).
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { formatTimeDisplay, hhmmToDate } from '@/lib/dateTime';

interface TimePickerFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  error?: string | null;
  placeholder?: string;
  disabled?: boolean;
}

export function TimePickerField({
  label,
  value,
  onChange,
  error,
  placeholder = 'Seleccioná una hora',
  disabled = false,
}: TimePickerFieldProps) {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  // API moderna (>= 9.0): onValueChange para valor nuevo confirmado,
  // onDismiss cuando cierra sin elegir.
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

  const displayValue = value ? formatTimeDisplay(value) : null;

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-slate-700">{label}</Text>

      {Platform.OS === 'ios' ? (
        <DateTimePicker
          mode="time"
          value={value ?? hhmmToDate('19:00')}
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
          is24Hour
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
          mode="time"
          value={value ?? hhmmToDate('19:00')}
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
          is24Hour
        />
      ) : null}

      {error ? (
        <Text className="mt-1 text-sm text-red-600">{error}</Text>
      ) : null}
    </View>
  );
}
