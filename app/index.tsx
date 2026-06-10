import { Text, View } from 'react-native';

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-white p-4">
      <Text className="text-2xl font-bold text-primary-600">
        Coro Administración
      </Text>
      <Text className="mt-2 text-base text-slate-500">
        Bootstrap inicial. Próximos pasos: auth, grupos, servicios.
      </Text>
    </View>
  );
}
