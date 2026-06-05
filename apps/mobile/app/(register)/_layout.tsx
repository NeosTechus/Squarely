import { Stack } from "expo-router";
import { PasscodeLock } from "@/components/PasscodeLock";

export default function RegisterLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <PasscodeLock />
    </>
  );
}
