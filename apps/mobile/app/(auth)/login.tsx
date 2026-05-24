import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Alert, Pressable, Switch, ImageBackground, Animated, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";
import { loadCredentials, saveCredentials, clearCredentials } from "@/lib/savedCredentials";

const BG = require("../../assets/login-bg.png");

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // gentle float on the logo mark
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ]),
    ).start();
  }, [float]);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  useEffect(() => {
    loadCredentials().then((c) => {
      if (c) {
        setEmail(c.email);
        setPassword(c.password);
        setRemember(true);
        setHasSaved(true);
      }
    });
  }, []);

  const signIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert("Could not sign in", error.message);
      return;
    }
    if (remember) await saveCredentials({ email: email.trim(), password });
    else await clearCredentials();
    router.replace("/");
  };

  const forgetSaved = async () => {
    await clearCredentials();
    setRemember(false);
    setHasSaved(false);
    setPassword("");
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
    <ImageBackground source={BG} resizeMode="cover" className="flex-1">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 items-center justify-center px-6"
        >
          {/* brand mark */}
          <Animated.View style={{ transform: [{ translateY }] }} className="mb-8 items-center">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
              <Text className="text-4xl font-black text-white">S</Text>
            </View>
            <Text className="mt-3 text-2xl font-bold tracking-tight text-white">Squarely</Text>
            <Text className="mt-1 text-sm text-white/70">Sign in to your account</Text>
          </Animated.View>

          {/* card */}
          <View className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@store.com"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
            />
            <View className="mt-3 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 pr-3">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                secureTextEntry={!showPassword}
                className="flex-1 px-4 py-3 text-slate-900"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} className="px-1 py-1">
                <Text className="text-sm font-medium text-brand-600">{showPassword ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>

            <View className="mt-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Switch value={remember} onValueChange={setRemember} />
                <Text className="text-sm text-slate-600">Remember me</Text>
              </View>
              {hasSaved ? (
                <Pressable onPress={forgetSaved} hitSlop={8}>
                  <Text className="text-sm font-medium text-red-500">Forget</Text>
                </Pressable>
              ) : null}
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

          <Text className="mt-8 text-xs text-white/50">Powered by NeosTech LLC</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}
