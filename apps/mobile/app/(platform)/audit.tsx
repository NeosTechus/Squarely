import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

interface AuditRow {
  action: string;
  detail: string | null;
  created_at: string;
  merchant_id: string | null;
  merchants: { name: string } | { name: string }[] | null;
}

const merchantName = (m: AuditRow["merchants"]): string | null => {
  if (!m) return null;
  return Array.isArray(m) ? (m[0]?.name ?? null) : m.name;
};

export default function PlatformAudit() {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await (supabase as any)
        .from("admin_audit")
        .select("action, detail, created_at, merchant_id, merchants(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  return (
    <ScreenContainer>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={rows}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View className="rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-slate-700">{item.action}</Text>
              <Text className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            <Text className="mt-1 text-xs text-slate-500">{merchantName(item.merchants) ?? "—"}</Text>
            {item.detail ? <Text className="mt-1 text-sm text-slate-600">{item.detail}</Text> : null}
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator className="mt-8" />
          ) : error ? (
            <Text className="mt-8 text-center text-sm text-red-600">{(error as Error).message}</Text>
          ) : (
            <Text className="mt-8 text-center text-slate-400">No audit events yet.</Text>
          )
        }
      />
    </ScreenContainer>
  );
}
