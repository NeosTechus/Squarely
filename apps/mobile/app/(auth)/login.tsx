import { useState } from "react";
import { View, Text, TextInput, Alert } from "react-native";
import { Button, ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMagicLink = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
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
        <Text className="mt-2 text-slate-600">Sign in to your merchant account.</Text>
        <View className="mt-10 w-full max-w-sm">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@store.com"
            autoCapitalize="none"
            keyboardType="email-address"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3"
          />
          <Button
            label={loading ? "Sending…" : "Send magic link"}
            onPress={sendMagicLink}
            disabled={loading || !email}
            className="mt-4"
            size="lg"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
