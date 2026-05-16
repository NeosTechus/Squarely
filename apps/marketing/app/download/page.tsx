import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export default function Download() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <section className="px-6 pt-16 pb-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Download Squarely</h1>
        <p className="mt-3 text-slate-600">Available on iOS and Android — phone, tablet, register.</p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="https://apps.apple.com/app/squarely"
            className="rounded-xl bg-black px-6 py-3 text-white"
          >
            App Store
          </Link>
          <Link
            href="https://play.google.com/store/apps/details?id=com.squarely"
            className="rounded-xl bg-black px-6 py-3 text-white"
          >
            Google Play
          </Link>
        </div>
        <p className="mt-8 text-sm text-slate-500">
          After installing, sign in with your Squarely account or create one to onboard your store.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
