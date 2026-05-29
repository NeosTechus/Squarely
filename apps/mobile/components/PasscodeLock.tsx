import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useDevicePasscode } from "@/lib/useDevicePasscode";
import { useUnlock } from "@/store/lock";
import { useMerchantTheme } from "@/lib/useMerchantTheme";

/**
 * Full-screen passcode gate. Renders nothing unless the merchant has a device
 * passcode AND this session isn't unlocked yet — then it blocks the screen with
 * a numeric keypad until the correct code is entered. Drop it inside POS/Kiosk.
 */
export function PasscodeLock() {
  const { enabled, verify } = useDevicePasscode();
  const unlocked = useUnlock((s) => s.unlocked);
  const unlock = useUnlock((s) => s.unlock);
  const brand = useMerchantTheme();
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);
  const [checking, setChecking] = useState(false);

  if (!enabled || unlocked) return null;

  const press = async (d: string) => {
    setErr(false);
    const next = (code + d).slice(0, 8);
    setCode(next);
    if (next.length >= 4) {
      // auto-submit attempt once we have at least 4 digits on each keypress >=4
    }
  };
  const submit = async () => {
    setChecking(true);
    const ok = await verify(code);
    setChecking(false);
    if (ok) {
      unlock();
      setCode("");
    } else {
      setErr(true);
      setCode("");
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <Modal visible transparent={false} animationType="fade">
      <View className="flex-1 items-center justify-center bg-slate-900 px-8">
        <Text className="text-2xl font-bold text-white">Enter passcode</Text>
        <Text className="mt-1 text-sm text-white/60">Ask a manager if you don&apos;t have it</Text>

        {/* dots */}
        <View className="mt-8 flex-row gap-3">
          {[0, 1, 2, 3, 4, 5].slice(0, Math.max(4, code.length || 4)).map((i) => (
            <View key={i} className={`h-3.5 w-3.5 rounded-full ${i < code.length ? "bg-white" : "bg-white/25"}`} />
          ))}
        </View>
        {err ? <Text className="mt-3 text-sm text-red-400">Wrong passcode, try again</Text> : null}

        {/* keypad */}
        <View className="mt-8 w-72 flex-row flex-wrap justify-between">
          {keys.map((k, i) =>
            k === "" ? (
              <View key={i} className="mb-4 h-16 w-20" />
            ) : (
              <Pressable
                key={i}
                onPress={() => (k === "⌫" ? setCode((c) => c.slice(0, -1)) : press(k))}
                className="mb-4 h-16 w-20 items-center justify-center rounded-2xl bg-white/10 active:bg-white/20"
              >
                <Text className="text-2xl font-semibold text-white">{k}</Text>
              </Pressable>
            ),
          )}
        </View>

        <Pressable
          onPress={submit}
          disabled={code.length < 4 || checking}
          className="mt-2 w-72 items-center rounded-2xl py-4 active:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: brand }}
        >
          <Text className="text-base font-bold text-white">{checking ? "Checking…" : "Unlock"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
