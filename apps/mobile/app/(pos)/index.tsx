import { View, Text, FlatList, Pressable } from "react-native";
import { Button, ScreenContainer, Card } from "@squarely/ui-mobile";
import { useCart } from "@/store/cart";

const placeholderItems = [
  { id: "1", name: "Espresso", price_cents: 350 },
  { id: "2", name: "Cappuccino", price_cents: 475 },
  { id: "3", name: "Avocado Toast", price_cents: 1200 },
  { id: "4", name: "Bagel", price_cents: 425 },
  { id: "5", name: "Cold Brew", price_cents: 525 },
  { id: "6", name: "Croissant", price_cents: 375 },
];

export default function Pos() {
  const cart = useCart();
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

  return (
    <ScreenContainer>
      <View className="flex-1 flex-row">
        <View className="flex-1 p-4">
          <Text className="mb-3 text-xl font-bold">Menu</Text>
          <FlatList
            data={placeholderItems}
            numColumns={3}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ gap: 12 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  cart.addLine({
                    id: `${item.id}-${Date.now()}`,
                    item_id: item.id,
                    name: item.name,
                    unit_price_cents: item.price_cents,
                    quantity: 1,
                    modifiers: [],
                  })
                }
                className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50"
              >
                <Text className="text-base font-semibold">{item.name}</Text>
                <Text className="mt-1 text-sm text-slate-500">{fmt(item.price_cents)}</Text>
              </Pressable>
            )}
          />
        </View>
        <View className="w-80 border-l border-slate-200 bg-white p-4">
          <Text className="text-xl font-bold">Cart</Text>
          <FlatList
            className="mt-3 flex-1"
            data={cart.lines}
            keyExtractor={(l) => l.id}
            renderItem={({ item }) => (
              <Card className="mb-2 flex-row items-center justify-between">
                <View>
                  <Text className="font-semibold">{item.name}</Text>
                  <Text className="text-sm text-slate-500">
                    {item.quantity} × {fmt(item.unit_price_cents)}
                  </Text>
                </View>
                <Pressable onPress={() => cart.removeLine(item.id)}>
                  <Text className="text-red-600">Remove</Text>
                </Pressable>
              </Card>
            )}
            ListEmptyComponent={
              <Text className="mt-8 text-center text-slate-400">Tap items to add</Text>
            }
          />
          <View className="border-t border-slate-200 pt-3">
            <View className="flex-row justify-between">
              <Text className="font-semibold">Subtotal</Text>
              <Text className="font-semibold">{fmt(cart.subtotalCents())}</Text>
            </View>
            <Button
              label="Charge"
              size="lg"
              className="mt-4"
              disabled={cart.lines.length === 0}
              onPress={() => {
                /* Phase 2: open payment flow */
              }}
            />
            <Button
              label="Clear"
              variant="ghost"
              className="mt-2"
              onPress={cart.clear}
            />
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
