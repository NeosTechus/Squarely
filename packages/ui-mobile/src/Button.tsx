import { Pressable, Text, type PressableProps } from "react-native";

export interface ButtonProps extends PressableProps {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

const variantClass: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-brand-600 active:bg-brand-700",
  secondary: "bg-slate-200 active:bg-slate-300",
  ghost: "bg-transparent active:bg-slate-100",
  destructive: "bg-red-600 active:bg-red-700",
};

const sizeClass: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-2 rounded-md",
  md: "px-4 py-3 rounded-lg",
  lg: "px-6 py-4 rounded-xl",
};

const textClass: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "text-white font-semibold",
  secondary: "text-slate-900 font-semibold",
  ghost: "text-slate-900 font-medium",
  destructive: "text-white font-semibold",
};

export function Button({
  label,
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ButtonProps & { className?: string }) {
  return (
    <Pressable
      {...rest}
      className={`${variantClass[variant]} ${sizeClass[size]} items-center justify-center ${className ?? ""}`}
    >
      <Text className={textClass[variant]}>{label}</Text>
    </Pressable>
  );
}
