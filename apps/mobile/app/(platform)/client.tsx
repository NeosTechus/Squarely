import { useState } from "react";
import { View, Text, TextInput, ScrollView, Switch, Pressable, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";
import { useImpersonation } from "@/lib/impersonation";

type FeatureKey = "pos" | "kiosk" | "kds" | "admin";
const FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "pos", label: "POS" },
  { key: "kiosk", label: "Kiosk" },
  { key: "kds", label: "KDS (chef)" },
  { key: "admin", label: "Admin" },
];
const PLAN_TIERS = ["starter", "growth", "pro", "enterprise"];
const fmtMoney = (c: number) => (c === 0 ? "Free" : `$${(c / 100).toFixed(0)}/mo`);
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

interface Plan { display_name: string; tier: string; monthly_price_cents: number }

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const viewAs = useImpersonation((s) => s.viewAs);

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<string>("starter");
  const [pwd, setPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: m, isLoading } = useQuery({
    queryKey: ["client-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("merchants")
        .select(
          "id, name, slug, email, phone, city, region, created_at, suspended, " +
            "merchant_features(pos,kiosk,kds,admin), " +
            "subscriptions(status, current_period_end, plans(display_name, tier, monthly_price_cents)), " +
            "locations(name, city), merchant_members(display_name, role)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      const row = data as any;
      const sub = one<any>(row.subscriptions);
      const plan = one<Plan>(sub?.plans ?? null);
      setPlanTier((prev) => (prev === "starter" && plan?.tier ? plan.tier : prev));
      return {
        ...row,
        features: one<Record<FeatureKey, boolean>>(row.merchant_features),
        sub,
        plan,
        owner: (row.merchant_members ?? []).find((x: any) => x.role === "owner"),
        loc: (row.locations ?? [])[0],
      };
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["client-detail", id] });
    qc.invalidateQueries({ queryKey: ["platform-clients"] });
  };
  const audit = async (action: string, detail?: string) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      await (supabase as any).from("admin_audit").insert({ actor: u.user?.id, action, merchant_id: id, detail: detail ?? null });
    } catch { /* best effort */ }
  };

  const toggle = useMutation({
    mutationFn: async (a: { key: FeatureKey; value: boolean }) => {
      const { error } = await (supabase as any)
        .from("merchant_features")
        .update({ [a.key]: a.value, updated_at: new Date().toISOString() })
        .eq("merchant_id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => setErrMsg((e as Error).message),
  });

  const suspendMut = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await (supabase as any).from("merchants").update({ suspended: next }).eq("id", id);
      if (error) throw error;
      await audit(next ? "suspend" : "reactivate");
    },
    onSuccess: () => { setErrMsg(null); refresh(); },
    onError: (e) => setErrMsg((e as Error).message),
  });

  const planMut = useMutation({
    mutationFn: async (tier: string) => {
      const { data: plan } = await (supabase as any).from("plans").select("id").eq("tier", tier).maybeSingle();
      if (!plan?.id) throw new Error("Plan not found.");
      const periodEnd = new Date(Date.now() + 30 * 864e5).toISOString();
      const { data: existing } = await (supabase as any).from("subscriptions").select("id").eq("merchant_id", id).maybeSingle();
      if (existing?.id) {
        const { error } = await (supabase as any).from("subscriptions")
          .update({ plan_id: plan.id, status: "active", current_period_end: periodEnd }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("subscriptions").insert({
          merchant_id: id, plan_id: plan.id, status: "active",
          current_period_start: new Date().toISOString(), current_period_end: periodEnd,
        });
        if (error) throw error;
      }
      await audit("change_plan", tier);
    },
    onSuccess: () => { setErrMsg(null); refresh(); },
    onError: (e) => setErrMsg((e as Error).message),
  });

  const pwdMut = useMutation({
    mutationFn: async (password: string) => {
      const { data, error } = await (supabase as any).rpc("admin_reset_owner_password", { p_merchant_id: id, p_password: password });
      if (error) throw error;
      if (data && data !== "ok") throw new Error(data as string);
    },
    onSuccess: () => { setPwd(""); setPwdMsg({ ok: true, text: "Password updated." }); },
    onError: (e) => setPwdMsg({ ok: false, text: (e as Error).message }),
  });

  const openDashboard = async () => {
    await audit("view_as");
    viewAs(id as string, m?.name ?? "client");
    qc.clear();
    router.replace("/(boot)" as never);
  };

  if (isLoading || !m) {
    return (
      <ScreenContainer edges={["bottom"]}>
        <ActivityIndicator className="mt-10" />
      </ScreenContainer>
    );
  }

  const renew = m.sub?.current_period_end ? new Date(m.sub.current_period_end).toLocaleDateString() : "—";

  return (
    <ScreenContainer edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* header */}
        <View>
          <Text className="text-2xl font-bold tracking-tight">{m.name}</Text>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            {m.plan ? (
              <Badge className="bg-brand-50 text-brand-700">{m.plan.display_name} · {fmtMoney(m.plan.monthly_price_cents)}</Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-500">No plan</Badge>
            )}
            {m.sub?.status ? (
              <Badge className={m.sub.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                {m.sub.status}
              </Badge>
            ) : null}
            {m.suspended ? <Badge className="bg-red-50 text-red-700">Suspended</Badge> : null}
            <Text className="text-sm text-slate-400">/{m.slug}</Text>
          </View>
          <Pressable onPress={openDashboard} className="mt-3 self-start rounded-lg bg-brand-600 px-4 py-2 active:bg-brand-700">
            <Text className="text-sm font-semibold text-white">Open dashboard →</Text>
          </Pressable>
        </View>

        {/* account */}
        <Card title="Account">
          <View className="flex-row flex-wrap">
            <Detail label="Owner" value={m.owner?.display_name ?? "—"} />
            <Detail label="Contact" value={m.email} />
            <Detail label="Phone" value={m.phone ?? "—"} />
            <Detail label="Location" value={m.loc ? `${m.loc.name}${m.loc.city ? ` · ${m.loc.city}` : ""}` : (m.city ?? "—")} />
            <Detail label="Renews" value={renew} />
            <Detail label="Joined" value={new Date(m.created_at).toLocaleDateString()} />
          </View>
        </Card>

        {/* features */}
        <Card title="Enabled features">
          <View className="flex-row flex-wrap gap-x-6 gap-y-3">
            {FEATURES.map((f) => {
              const on = m.features?.[f.key] ?? true;
              return (
                <View key={f.key} className="flex-row items-center gap-2">
                  <Text className="text-sm text-slate-600">{f.label}</Text>
                  <Switch value={on} disabled={toggle.isPending} onValueChange={(v) => toggle.mutate({ key: f.key, value: v })} />
                </View>
              );
            })}
          </View>
        </Card>

        {/* management */}
        <Card title="Management">
          {errMsg ? <Text className="mb-3 text-sm text-red-600">{errMsg}</Text> : null}

          {/* suspend */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-medium text-slate-700">Account status</Text>
              <Text className="text-xs text-slate-400">{m.suspended ? "This client is suspended." : "This client is active."}</Text>
            </View>
            <Button
              label={m.suspended ? "Reactivate" : "Suspend"}
              variant={m.suspended ? "primary" : "destructive"}
              size="sm"
              onPress={() => suspendMut.mutate(!m.suspended)}
              disabled={suspendMut.isPending}
            />
          </View>

          {/* change plan */}
          <View className="mt-5 border-t border-slate-100 pt-5">
            <Text className="mb-2 text-xs uppercase tracking-wide text-slate-400">Plan</Text>
            <View className="flex-row flex-wrap gap-2">
              {PLAN_TIERS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setPlanTier(t)}
                  className={`rounded-lg px-3 py-2 ${planTier === t ? "bg-brand-600" : "bg-slate-100"}`}
                >
                  <Text className={`text-sm font-medium capitalize ${planTier === t ? "text-white" : "text-slate-600"}`}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              label={planMut.isPending ? "Saving…" : "Change plan"}
              size="sm"
              className="mt-3 self-start"
              onPress={() => planMut.mutate(planTier)}
              disabled={planMut.isPending}
            />
          </View>

          {/* reset password */}
          <View className="mt-5 border-t border-slate-100 pt-5">
            <Text className="mb-2 text-xs uppercase tracking-wide text-slate-400">Reset owner password</Text>
            <TextInput
              value={pwd}
              onChangeText={setPwd}
              placeholder="New password (min 8 chars)"
              autoCapitalize="none"
              secureTextEntry
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <Button
              label={pwdMut.isPending ? "Resetting…" : "Reset"}
              size="sm"
              className="mt-3 self-start"
              onPress={() => { setPwdMsg(null); pwdMut.mutate(pwd); }}
              disabled={pwdMut.isPending || pwd.length < 8}
            />
            {pwdMsg ? (
              <Text className={`mt-2 text-sm ${pwdMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{pwdMsg.text}</Text>
            ) : null}
          </View>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-5">
      <Text className="mb-3 text-sm font-semibold text-slate-700">{title}</Text>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 w-1/2 pr-3">
      <Text className="text-xs uppercase tracking-wide text-slate-400">{label}</Text>
      <Text className="text-slate-700" numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Text className={`rounded-full px-2.5 py-1 text-xs font-medium ${className ?? ""}`}>{children}</Text>
  );
}
