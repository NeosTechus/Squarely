import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export function ScreenContainer({
  children,
  className,
  edges,
  ...rest
}: ViewProps & { className?: string; edges?: readonly Edge[] }) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-slate-50">
      <View {...rest} className={`flex-1 ${className ?? ""}`}>
        {children}
      </View>
    </SafeAreaView>
  );
}
