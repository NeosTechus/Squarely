import { View, Text, ScrollView } from "react-native";
import { Card, ScreenContainer } from "@squarely/ui-mobile";

export default function Admin() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-3xl font-bold tracking-tight">Admin</Text>
        <Text className="mt-2 text-slate-600">
          Quick mobile-friendly view of your business. Full back-office lives in the web admin.
        </Text>
        <View className="mt-6 flex-row flex-wrap gap-3">
          {["Today's revenue", "Orders", "Avg ticket", "Open tickets"].map((label) => (
            <Card key={label} className="min-w-[140px] flex-1">
              <Text className="text-xs uppercase tracking-wide text-slate-500">{label}</Text>
              <Text className="mt-1 text-xl font-bold">—</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
