import { useState } from "react";
import { View, Text, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

interface PlanRow {
  id: string;
  tier: string;
  display_name: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  device_limit: number | null;
  features: string[];
}

const centsToDollars = (c: number) => (c / 100).toString();
const dollarsToCents = (d: string) => Math.round((parseFloat(d) || 0) * 100);

export default function PlatformPlans() {
  const { data: plans = [], isLoading, error } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await (supabase as any)
        .from("plans")
        .select("id, tier, display_name, monthly_price_cents, yearly_price_cents, device_limit, features")
        .order("monthly_price_cents");
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });

  return (
    <ScreenContainer edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text className="text-sm text-slate-600">
          Edit the subscription tiers offered to merchants. Prices are in dollars.
        </Text>
        {isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : error ? (
          <Text className="text-sm text-red-600">{(error as Error).message}</Text>
        ) : (
          plans.map((p) => <PlanCard key={p.id} plan={p} />)
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function PlanCard({ plan }: { plan: PlanRow }) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(plan.display_name);
  const [monthly, setMonthly] = useState(centsToDollars(plan.monthly_price_cents));
  const [yearly, setYearly] = useState(centsToDollars(plan.yearly_price_cents));
  const [deviceLimit, setDeviceLimit] = useState(plan.device_limit == null ? "" : String(plan.device_limit));
  const [features, setFeatures] = useState((plan.features ?? []).join(", "));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const trimmed = deviceLimit.trim();
      const { error } = await (supabase as any)
        .from("plans")
        .update({
          display_name: displayName.trim(),
          monthly_price_cents: dollarsToCents(monthly),
          yearly_price_cents: dollarsToCents(yearly),
          device_limit: trimmed === "" ? null : Math.round(Number(trimmed)),
          features: features.split(",").map((f) => f.trim()).filter((f) => f.length > 0),
        })
        .eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setStatus({ ok: true, text: "Saved." });
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e) => setStatus({ ok: false, text: (e as Error).message }),
  });

  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4">
      <Text className="mb-3 text-xs uppercase tracking-wide text-slate-400">{plan.tier}</Text>
      <Field label="Display name">
        <Input value={displayName} onChangeText={setDisplayName} />
      </Field>
      <Field label="Device limit (empty = unlimited)">
        <Input value={deviceLimit} onChangeText={setDeviceLimit} keyboardType="number-pad" placeholder="Unlimited" />
      </Field>
      <Field label="Monthly price ($)">
        <Input value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" />
      </Field>
      <Field label="Yearly price ($)">
        <Input value={yearly} onChangeText={setYearly} keyboardType="decimal-pad" />
      </Field>
      <Field label="Features (comma-separated)">
        <Input value={features} onChangeText={setFeatures} />
      </Field>
      <View className="mt-3 flex-row items-center gap-3">
        <Button
          label={mut.isPending ? "Saving…" : "Save"}
          onPress={() => mut.mutate()}
          disabled={mut.isPending}
          size="sm"
        />
        {status ? (
          <Text className={`text-sm ${status.ok ? "text-emerald-600" : "text-red-600"}`}>{status.text}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs uppercase tracking-wide text-slate-400">{label}</Text>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      autoCapitalize="none"
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
    />
  );
}
