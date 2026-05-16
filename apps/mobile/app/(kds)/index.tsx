import { View, Text, FlatList } from "react-native";
import { Card, ScreenContainer } from "@squarely/ui-mobile";

const fakeOrders = [
  { id: "1", number: 101, items: ["Espresso", "Bagel"], age: "0:32" },
  { id: "2", number: 102, items: ["Avocado Toast", "Cold Brew"], age: "1:18" },
];

export default function Kds() {
  return (
    <ScreenContainer>
      <View className="flex-1 p-4">
        <Text className="text-2xl font-bold tracking-tight">Kitchen Display</Text>
        <FlatList
          className="mt-4"
          data={fakeOrders}
          numColumns={3}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <Card className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-3xl font-bold">#{item.number}</Text>
                <Text className="text-sm text-slate-500">{item.age}</Text>
              </View>
              <View className="mt-3 gap-1">
                {item.items.map((line) => (
                  <Text key={line} className="text-base">{line}</Text>
                ))}
              </View>
            </Card>
          )}
        />
      </View>
    </ScreenContainer>
  );
}
