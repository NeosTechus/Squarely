import { SafeAreaView, View, type ViewProps } from "react-native";

export function ScreenContainer({ children, className, ...rest }: ViewProps & { className?: string }) {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View {...rest} className={`flex-1 ${className ?? ""}`}>
        {children}
      </View>
    </SafeAreaView>
  );
}
