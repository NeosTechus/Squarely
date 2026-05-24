import { useState } from "react";
import { View, Text, TextInput, Alert, Pressable } from "react-native";
import { router } from "expo-router";
import { Button, ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert("Could not sign in", error.message);
      return;
    }
    router.replace("/");
  };

  const sendMagicLink = async () => {
    if (!email) {
      Alert.alert("Email required", "Enter your email first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: "squarely://auth/callback" },
    });
    setLoading(false);
    if (error) {
      Alert.alert("Could not send", error.message);
      return;
    }
    Alert.alert("Check your email", "Tap the magic link to sign in.");
  };

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-bold tracking-tight">Squarely</Text>
        <Text className="mt-2 text-slate-600">Sign in to your account.</Text>
        <View className="mt-10 w-full max-w-sm">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@store.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3"
          />
          <View className="mt-3 flex-row items-center rounded-xl border border-slate-300 bg-white pr-3">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              autoCapitalize="none"
              secureTextEntry={!showPassword}
              className="flex-1 px-4 py-3"
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} className="px-1 py-1">
              <Text className="text-sm font-medium text-brand-600">{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>
          <Button
            label={loading ? "Signing in…" : "Sign in"}
            onPress={signIn}
            disabled={loading || !email || !password}
            className="mt-4"
            size="lg"
          />
          <Pressable onPress={sendMagicLink} disabled={loading} className="mt-4 self-center">
            <Text className="text-sm text-slate-500">Email me a magic link instead</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}
