/** Premium full-screen branded buffering animation. */
export function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-5">
      <div className="relative h-16 w-16">
        {/* spinning gradient ring */}
        <div className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(theme(colors.brand.600),theme(colors.brand.300),transparent_75%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-4px),#000_0)]" />
        {/* pulsing logo badge */}
        <div className="absolute inset-[18%] flex items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-lg animate-pulse">
          S
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
        <span>{label}</span>
        <span className="inline-flex gap-1">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500"
      style={{ animationDelay: delay }}
    />
  );
}
