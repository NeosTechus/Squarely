"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAnnouncements,
  createAnnouncement,
  setAnnouncementActive,
  deleteAnnouncement,
} from "./actions";

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: announcements = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => listAnnouncements(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["announcements"] });

  const create = useMutation({
    mutationFn: async (input: { title: string; body: string }) => {
      const res = await createAnnouncement(input);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      setFormError(null);
      invalidate();
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const toggle = useMutation({
    mutationFn: async (vars: { id: string; active: boolean }) => {
      const res = await setAnnouncementActive(vars.id, vars.active);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: invalidate,
    onError: (e) => setFormError((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteAnnouncement(id);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: invalidate,
    onError: (e) => setFormError((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Announcements
      </h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          New announcement
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            create.mutate({ title, body });
          }}
          className="space-y-3"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Body"
            required
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {create.isPending ? "Posting…" : "Post announcement"}
          </button>
        </form>
        {formError ? (
          <p className="mt-2 text-sm text-red-600">{formError}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            All announcements
          </h2>
        </div>
        {isLoading ? (
          <p className="p-5 text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{(error as Error).message}</p>
        ) : announcements.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No announcements yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {announcements.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {a.title}
                    </span>
                    <span
                      className={
                        a.active
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                      }
                    >
                      {a.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{a.body}</p>
                  <div className="mt-1 text-xs text-slate-400">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => {
                      setFormError(null);
                      toggle.mutate({ id: a.id, active: !a.active });
                    }}
                    disabled={toggle.isPending}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {a.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => {
                      setFormError(null);
                      remove.mutate(a.id);
                    }}
                    disabled={remove.isPending}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
