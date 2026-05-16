import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const button = cva(
  "inline-flex items-center justify-center font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-brand-600 text-white hover:bg-brand-700",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        ghost: "hover:bg-slate-100 text-slate-900",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-slate-300 hover:bg-slate-50",
      },
      size: {
        sm: "h-9 px-3 rounded-md text-sm",
        md: "h-10 px-4 rounded-lg",
        lg: "h-12 px-6 rounded-xl text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
