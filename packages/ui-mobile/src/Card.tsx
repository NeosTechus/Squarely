import { View, type ViewProps } from "react-native";

export function Card({ className, children, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      {...rest}
      className={`rounded-2xl bg-white p-4 shadow-sm border border-slate-200 ${className ?? ""}`}
    >
      {children}
    </View>
  );
}
