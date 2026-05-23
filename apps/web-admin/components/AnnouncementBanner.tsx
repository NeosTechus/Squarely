"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@squarely/db/browser";

type Announcement = { title: string; body: string };

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserClient() as unknown as {
      from: (t: string) => any;
    };

    (async () => {
      const { data } = await supabase
        .from("announcements")
        .select("title,body")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) {
        setAnnouncement({ title: data.title, body: data.body });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement || dismissed) return null;

  return (
    <div className="flex items-start justify-between gap-4 bg-brand-600 px-4 py-2 text-sm text-white">
      <div className="min-w-0">
        <span className="font-semibold">{announcement.title}</span>{" "}
        <span className="text-white/90">{announcement.body}</span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="shrink-0 rounded-md px-2 py-0.5 text-white/80 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
