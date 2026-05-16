import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </GestureHandlerRootView>
  );
}
