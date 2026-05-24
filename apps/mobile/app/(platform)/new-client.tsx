import { useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button, ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

const PLANS = [
  { tier: "starter", label: "Starter (Free)" },
  { tier: "growth", label: "Growth ($29/mo)" },
  { tier: "pro", label: "Pro ($79/mo)" },
  { tier: "enterprise", label: "Enterprise" },
];

export default function NewClient() {
  const qc = useQueryClient();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [planTier, setPlanTier] = useState("growth");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    const { data, error: rpcErr } = await (supabase as any).rpc("admin_onboard_merchant", {
      p_business_name: businessName,
      p_email: email,
      p_password: password,
      p_plan_tier: planTier,
    });
    setLoading(false);
    if (rpcErr) return setError(rpcErr.message);
    if (data && data !== "ok") return setError(data as string);
    qc.invalidateQueries({ queryKey: ["platform-clients"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
    router.replace("/(platform)/clients" as never);
  }

  return (
    <ScreenContainer edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text className="text-sm text-slate-600">
          Creates the merchant, the owner login, and a subscription on the chosen plan.
        </Text>

        <View className="gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <Field label="Business name">
            <Input value={businessName} onChangeText={setBusinessName} placeholder="Joe's Diner" />
          </Field>
          <Field label="Owner email">
            <Input value={email} onChangeText={setEmail} placeholder="owner@joesdiner.com" keyboardType="email-address" />
          </Field>
          <Field label="Temporary password">
            <Input value={password} onChangeText={setPassword} placeholder="min 8 characters" />
          </Field>
          <Field label="Plan">
            <View className="flex-row flex-wrap gap-2">
              {PLANS.map((p) => (
                <Pressable
                  key={p.tier}
                  onPress={() => setPlanTier(p.tier)}
                  className={`rounded-lg px-3 py-2 ${planTier === p.tier ? "bg-brand-600" : "bg-slate-100"}`}
                >
                  <Text className={`text-sm font-medium ${planTier === p.tier ? "text-white" : "text-slate-600"}`}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

          <Button
            label={loading ? "Creating…" : "Create client"}
            size="lg"
            onPress={submit}
            disabled={loading || !businessName.trim() || !email.trim() || password.length < 8}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-1 text-sm text-slate-700">{label}</Text>
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
