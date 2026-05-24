import { useState } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

interface AdminRow {
  user_id: string;
  email: string;
  created_at: string;
}

export default function PlatformAdmins() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: admins = [], isLoading, error } = useQuery({
    queryKey: ["platform-admins"],
    queryFn: async (): Promise<AdminRow[]> => {
      const { data, error } = await (supabase as any).rpc("admin_list_platform_admins");
      if (error) throw error;
      return (data ?? []) as AdminRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform-admins"] });

  const add = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_add_platform_admin", {
        p_email: email.trim(),
      });
      if (error) throw error;
      if (data && data !== "ok") throw new Error(data as string);
    },
    onSuccess: () => {
      setEmail("");
      setFormError(null);
      invalidate();
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await (supabase as any).rpc("admin_remove_platform_admin", {
        p_user_id: userId,
      });
      if (error) throw error;
      if (data && data !== "ok") throw new Error(data as string);
    },
    onSuccess: invalidate,
    onError: (e) => setFormError((e as Error).message),
  });

  return (
    <ScreenContainer>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12 }}
        data={admins}
        keyExtractor={(a) => a.user_id}
        ListHeaderComponent={
          <View className="mb-2 rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold text-slate-700">Add an admin</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="person@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <Button
              label={add.isPending ? "Adding…" : "Add admin"}
              onPress={() => {
                setFormError(null);
                add.mutate();
              }}
              disabled={add.isPending || !email.trim()}
              size="sm"
              className="mt-3"
            />
            <Text className="mt-2 text-xs text-slate-400">The user must already have a Squarely account.</Text>
            {formError ? <Text className="mt-2 text-sm text-red-600">{formError}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-1">
              <Text className="text-sm font-medium text-slate-800">{item.email}</Text>
              <Text className="text-xs text-slate-400">
                Added {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Button
              label="Remove"
              variant="destructive"
              size="sm"
              onPress={() => {
                setFormError(null);
                remove.mutate(item.user_id);
              }}
              disabled={remove.isPending}
            />
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator className="mt-8" />
          ) : error ? (
            <Text className="mt-8 text-center text-sm text-red-600">{(error as Error).message}</Text>
          ) : (
            <Text className="mt-8 text-center text-slate-400">No platform admins yet.</Text>
          )
        }
      />
    </ScreenContainer>
  );
}
