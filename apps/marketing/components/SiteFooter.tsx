import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <div className="text-lg font-bold">Squarely</div>
          <p className="mt-2 text-sm text-slate-600">
            Run your business from one screen.
          </p>
          <a
            href="https://neostechus.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <NeosTechMark />
            <span>Powered by <span className="font-semibold">NeosTech LLC</span></span>
          </a>
        </div>
        <Column title="Product" links={[
          ["Features", "/features"],
          ["Pricing", "/pricing"],
          ["Download", "/download"],
        ]} />
        <Column title="Company" links={[
          ["About", "/about"],
          ["Contact", "/contact"],
        ]} />
        <Column title="Legal" links={[
          ["Terms", "/terms"],
          ["Privacy", "/privacy"],
        ]} />
      </div>
      <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500 sm:flex-row">
        <span className="inline-flex items-center gap-1.5">
          © {new Date().getFullYear()} Squarely. All rights reserved. ·
          <a href="https://neostechus.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-slate-900">
            <NeosTechMark size={14} /> Powered by NeosTech LLC
          </a>
        </span>
        <span className="flex gap-4">
          <Link href="/terms" className="hover:text-slate-900">Terms</Link>
          <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
        </span>
      </div>
    </footer>
  );
}

/** NeosTech logo mark (placeholder until the official asset is supplied). */
export function NeosTechMark({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded bg-[#1c4b8e] font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.6 }}
      aria-hidden
    >
      N
    </span>
  );
}

function Column({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="hover:text-slate-900">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
