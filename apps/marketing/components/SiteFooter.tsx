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
        <span>© {new Date().getFullYear()} Squarely — a NeosTechus property. All rights reserved.</span>
        <span className="flex gap-4">
          <Link href="/terms" className="hover:text-slate-900">Terms</Link>
          <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
        </span>
      </div>
    </footer>
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
