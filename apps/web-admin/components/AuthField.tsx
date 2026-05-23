"use client";

import { useId } from "react";

interface AuthFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}

/** Floating-label input (Material-style underline) for the auth screens. */
export function AuthField({
  label,
  type = "text",
  value,
  onChange,
  required,
  minLength,
  autoComplete,
}: AuthFieldProps) {
  const id = useId();
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder=" "
        className="peer w-full rounded-t-md border-b-2 border-slate-300 bg-slate-50 px-3 pb-2 pt-6 text-slate-900 outline-none transition-colors focus:border-brand-600"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-4 text-slate-500 transition-all duration-150
          peer-focus:top-2 peer-focus:text-xs peer-focus:font-medium peer-focus:text-brand-600
          peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs"
      >
        {label}
        {required ? " *" : ""}
      </label>
    </div>
  );
}
