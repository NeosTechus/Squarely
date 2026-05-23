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
      <div className="border-t border-slate-200 px-6 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Squarely. All rights reserved.
      </div>
    </footer>
  );
}

/** NeosTech LLC logo mark. */
export function NeosTechMark({ size = 18 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/neostech-logo.png"
      alt="NeosTech LLC"
      width={size}
      height={size}
      className="rounded-[3px] object-contain"
    />
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
