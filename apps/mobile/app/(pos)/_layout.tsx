import { Stack } from "expo-router";
import { PasscodeLock } from "@/components/PasscodeLock";

export default function PosLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <PasscodeLock />
    </>
  );
}
