"use client";

import { useMemo, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import Reveal from "@/components/Reveal";
import { listAuditActors, purgeAudit, type ActorInfo } from "./actions";

interface AuditRow {
  id: string;
  actor: string | null;
  action: string;
  detail: string | null;
  created_at: string;
  merchant_id: string | null;
  merchants: { name: string } | { name: string }[] | null;
}

const PAGE_SIZE = 50;

const merchantName = (m: AuditRow["merchants"]): string | null => {
  if (!m) return null;
  return Array.isArray(m) ? (m[0]?.name ?? null) : m.name;
};

/**
 * Format an ISO timestamp as a short relative string, e.g. "3m ago",
 * "2h ago", "5d ago". Falls back to a calendar date for anything older
 * than ~30 days so the column stays readable.
 */
function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Render an actor as display_name -> email -> uuid prefix -> "system". */
function actorLabel(
  actorId: string | null,
  merchantId: string | null,
  actors: Record<string, ActorInfo>,
): string {
  if (!actorId) return "system";
  const info = actors[actorId];
  if (info) {
    if (merchantId && info.displayNameByMerchant[merchantId]) {
      return info.displayNameByMerchant[merchantId];
    }
    if (info.email) return info.email;
  }
  return actorId.slice(0, 8);
}

export default function AuditPage() {
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
  };
  const qc = useQueryClient();

  const [page, setPage] = useState(0);
  const [keepDays, setKeepDays] = useState<number>(365);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<"ok" | "err">("ok");

  // Page of audit rows. Uses the new admin_audit_created_at_idx for ordering.
  // Future "cursor" optimization: replace .range with .lt('created_at',
  // lastSeenCreatedAt) and .limit(PAGE_SIZE) — the index covers that too.
  const {
    data: pageData,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: ["admin-audit", page],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ rows: AuditRow[]; total: number | null }> => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("admin_audit")
        .select(
          "id, actor, action, detail, created_at, merchant_id, merchants(name)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], total: count ?? null };
    },
  });

  const rows = pageData?.rows ?? [];
  const total = pageData?.total ?? null;

  // Resolve actor display info (email / merchant display_name) for the
  // unique actors on the current page. Skipped when the page is empty.
  const uniqueActorIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.actor) s.add(r.actor);
    return Array.from(s);
  }, [rows]);

  const { data: actors = {} } = useQuery({
    queryKey: ["admin-audit-actors", uniqueActorIds.slice().sort().join(",")],
    enabled: uniqueActorIds.length > 0,
    queryFn: () => listAuditActors(uniqueActorIds),
  });

  const purgeMut = useMutation({
    mutationFn: async (days: number) => {
      const res = await purgeAudit(days);
      if (!res.ok) throw new Error(res.error);
      return res.deleted;
    },
    onSuccess: (deleted) => {
      setFeedbackKind("ok");
      setFeedback(`Deleted ${deleted} row${deleted === 1 ? "" : "s"}.`);
      setPage(0);
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
    },
    onError: (e) => {
      setFeedbackKind("err");
      setFeedback((e as Error).message);
    },
  });

  const onPurge = () => {
    setFeedback(null);
    const days = Math.floor(keepDays);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      setFeedbackKind("err");
      setFeedback("Keep-days must be between 1 and 3650.");
      return;
    }
    const ok = window.confirm(
      `Delete all audit rows older than ${days} day${
        days === 1 ? "" : "s"
      }? This cannot be undone.`,
    );
    if (!ok) return;
    purgeMut.mutate(days);
  };

  const hasMore = total != null ? (page + 1) * PAGE_SIZE < total : rows.length === PAGE_SIZE;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <Reveal as="h1" className="text-2xl font-bold tracking-tight">
        Audit log
      </Reveal>

      {error ? (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      ) : isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 && page === 0 ? (
        <p className="text-sm text-slate-400">No audit events yet.</p>
      ) : (
        <>
          <Reveal className="overflow-x-auto rounded-2xl border border-slate-200 bg-white transition hover:shadow-md">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const absolute = new Date(r.created_at).toLocaleString();
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50"
                    >
                      <td
                        className="whitespace-nowrap px-4 py-3 text-slate-500"
                        title={absolute}
                      >
                        {relativeTime(r.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {actorLabel(r.actor, r.merchant_id, actors)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {r.action}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {merchantName(r.merchants) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.detail ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Reveal>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <div>
              {total != null ? (
                <span>
                  Showing {page * PAGE_SIZE + 1}–
                  {page * PAGE_SIZE + rows.length} of {total}
                </span>
              ) : (
                <span>Page {page + 1}</span>
              )}
              {isFetching ? (
                <span className="ml-2 text-xs text-slate-400">Refreshing…</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore || isFetching}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <Reveal className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700">Retention</h2>
        <p className="mt-1 text-xs text-slate-500">
          Permanently delete audit events older than the chosen number of days.
          The purge itself is recorded in the log.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onPurge();
          }}
          className="mt-3 flex flex-wrap items-center gap-3"
        >
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Keep last
            <input
              type="number"
              min={1}
              max={3650}
              value={keepDays}
              onChange={(e) => setKeepDays(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
            />
            days
          </label>
          <button
            type="submit"
            disabled={purgeMut.isPending}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {purgeMut.isPending ? "Purging…" : "Purge audit log"}
          </button>
        </form>
        {feedback ? (
          <p
            className={`mt-2 text-sm ${
              feedbackKind === "ok" ? "text-green-600" : "text-red-600"
            }`}
          >
            {feedback}
          </p>
        ) : null}
      </Reveal>
    </div>
  );
}
