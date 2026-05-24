import { useState } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
}

export default function PlatformAnnouncements() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: announcements = [], isLoading, error } = useQuery({
    queryKey: ["announcements"],
    queryFn: async (): Promise<AnnouncementRow[]> => {
      const { data, error } = await (supabase as any)
        .from("announcements")
        .select("id, title, body, active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnnouncementRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["announcements"] });

  const create = useMutation({
    mutationFn: async () => {
      const t = title.trim();
      const b = body.trim();
      if (!t) throw new Error("Title is required.");
      if (!b) throw new Error("Body is required.");
      const { error } = await (supabase as any)
        .from("announcements")
        .insert({ title: t, body: b, active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      setFormError(null);
      invalidate();
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const toggle = useMutation({
    mutationFn: async (vars: { id: string; active: boolean }) => {
      const { error } = await (supabase as any)
        .from("announcements")
        .update({ active: vars.active })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => setFormError((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => setFormError((e as Error).message),
  });

  return (
    <ScreenContainer>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12 }}
        data={announcements}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={
          <View className="mb-2 rounded-2xl border border-slate-200 bg-white p-4">
            <Text className="mb-3 text-sm font-semibold text-slate-700">New announcement</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Body"
              multiline
              numberOfLines={3}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              style={{ minHeight: 72, textAlignVertical: "top" }}
            />
            <Button
              label={create.isPending ? "Posting…" : "Post announcement"}
              onPress={() => {
                setFormError(null);
                create.mutate();
              }}
              disabled={create.isPending}
              size="sm"
              className="mt-3"
            />
            {formError ? <Text className="mt-2 text-sm text-red-600">{formError}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <View className="rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm font-medium text-slate-800">{item.title}</Text>
              <Text
                className={
                  item.active
                    ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                    : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                }
              >
                {item.active ? "Active" : "Inactive"}
              </Text>
            </View>
            <Text className="mt-1 text-sm text-slate-600">{item.body}</Text>
            <Text className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</Text>
            <View className="mt-3 flex-row gap-2">
              <Button
                label={item.active ? "Deactivate" : "Activate"}
                variant="secondary"
                size="sm"
                onPress={() => {
                  setFormError(null);
                  toggle.mutate({ id: item.id, active: !item.active });
                }}
                disabled={toggle.isPending}
              />
              <Button
                label="Delete"
                variant="destructive"
                size="sm"
                onPress={() => {
                  setFormError(null);
                  remove.mutate(item.id);
                }}
                disabled={remove.isPending}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator className="mt-8" />
          ) : error ? (
            <Text className="mt-8 text-center text-sm text-red-600">{(error as Error).message}</Text>
          ) : (
            <Text className="mt-8 text-center text-slate-400">No announcements yet.</Text>
          )
        }
      />
    </ScreenContainer>
  );
}
