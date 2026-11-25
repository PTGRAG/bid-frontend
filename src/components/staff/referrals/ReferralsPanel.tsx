"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Link2, Plus, RefreshCw, Scale, Search, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastApiError } from "@/lib/toast-api-error";
import { tierRangeLabel } from "@/lib/referral-tiers";
import {
  listReferralCodes,
  listReferralPrograms,
  runReferralSweep,
  type ReferralCodeListItem,
} from "@/services/referrals.service";
import { CreateReferralCodeModal } from "./CreateReferralCodeModal";
import { ReferralCodeDetail } from "./ReferralCodeDetail";
import { ReferralProgramsView } from "./ReferralProgramsView";
import {
  Badge,
  CODE_STATUS_BADGE,
  CopyButton,
  KindBadge,
  ThresholdBar,
  formatCount,
  formatEtb,
  formatPct,
  pillClass,
} from "./referral-ui";

const KIND_FILTERS = [
  { id: "", label: "All" },
  { id: "agent", label: "Agents" },
  { id: "influencer", label: "Influencers" },
] as const;

const STATUS_FILTERS = [
  { id: "", label: "Any status" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
] as const;

const PAGE_SIZE = 20;

type View = "codes" | "rules";

export function ReferralsPanel({ actorRole }: { actorRole: string }) {
  const role = actorRole.toLowerCase();
  const canEdit = ["super_admin", "admin"].includes(role);
  const qc = useQueryClient();

  const [view, setView] = useState<View>("codes");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const sweep = useMutation({
    mutationFn: runReferralSweep,
    onSuccess: (r) => {
      toast.success(
        r.qualified || r.rejected
          ? `${r.qualified} newly qualified, ${r.rejected} rejected`
          : "Rechecked. No referral changed."
      );
      void qc.invalidateQueries({ queryKey: ["staff", "referrals"] });
    },
    onError: (err) => toastApiError(err, "Recheck failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-blue)]">Growth</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Referrals</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Agent and influencer codes, from link visit to signup to paid ticket, and what each code has earned.
            Referrals are rechecked every two minutes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl font-bold"
              disabled={sweep.isPending}
              onClick={() => sweep.mutate()}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${sweep.isPending ? "animate-spin" : ""}`} />
              Recheck now
            </Button>
          ) : null}
          {canEdit && view === "codes" ? (
            <Button
              type="button"
              size="sm"
              className="rounded-xl bg-[var(--brand-blue)] font-bold text-white"
              onClick={() => setCreating(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New code
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            { id: "codes", label: "Codes", icon: Link2 },
            { id: "rules", label: "Payout rules", icon: Scale },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setView(id);
              setSelected(null);
            }}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-bold transition ${
              view === id
                ? "border-[var(--brand-blue)] text-[var(--brand-blue)]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {view === "rules" ? (
        <ReferralProgramsView canEdit={canEdit} />
      ) : selected ? (
        <ReferralCodeDetail codeId={selected} canEdit={canEdit} onBack={() => setSelected(null)} />
      ) : (
        <CodesList onOpen={setSelected} onCreate={canEdit ? () => setCreating(true) : undefined} />
      )}

      {creating ? (
        <CreateReferralCodeModal
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            setCreating(false);
            setView("codes");
            setSelected(c.code.id);
          }}
        />
      ) : null}
    </div>
  );
}

function CodesList({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate?: () => void }) {
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [page, setPage] = useState(1);

  const programs = useQuery({
    queryKey: ["staff", "referrals", "programs"],
    queryFn: listReferralPrograms,
  });
  const query = useQuery({
    queryKey: ["staff", "referrals", "codes", kind, status, searchApplied, page],
    queryFn: () =>
      listReferralCodes({
        kind: kind || undefined,
        status: status || undefined,
        search: searchApplied || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    refetchInterval: 30_000,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const defaults = (programs.data ?? []).filter((p) => p.isDefault);

  return (
    <div className="space-y-4">
      {defaults.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {defaults.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <KindBadge kind={p.kind} />
                <p className="text-sm font-bold text-slate-900">{p.name}</p>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Pays after <span className="font-extrabold text-slate-900">{p.threshold}</span> qualified bidders:{" "}
                {p.tiers.map((t, i) => (
                  <span key={t.from}>
                    {i ? " · " : ""}
                    <span className="font-semibold text-slate-800">{tierRangeLabel(t)}</span> {formatEtb(t.amount)}
                  </span>
                ))}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                First paid ticket within {p.attributionWindowDays} days
                {p.qualifyingAuctions.length ? ` on ${p.qualifyingAuctions.map((a) => a.title).join(", ")}` : " on any auction"}
                . Top tier {formatEtb(p.topTierAmount)} of {formatEtb(p.netMarginPerBid)} margin per bid.
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.id || "all"}
              type="button"
              className={pillClass(kind === f.id)}
              onClick={() => {
                setKind(f.id);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id || "any"}
              type="button"
              className={pillClass(status === f.id)}
              onClick={() => {
                setStatus(f.id);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2 lg:w-[380px]"
          onSubmit={(e) => {
            e.preventDefault();
            setSearchApplied(search.trim());
            setPage(1);
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code, label, owner name or phone…"
              className="pl-9"
            />
          </div>
          <Button type="submit" className="font-bold">
            Search
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {query.isLoading ? (
          <p className="py-16 text-center text-sm text-slate-500">Loading codes…</p>
        ) : query.isError ? (
          <p className="py-16 text-center text-sm text-red-600">Could not load referral codes.</p>
        ) : !items.length ? (
          <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
            <Share2 className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium">
              {searchApplied || kind || status ? "No codes match this filter" : "No referral codes yet"}
            </p>
            {onCreate && !searchApplied && !kind && !status ? (
              <Button type="button" size="sm" className="rounded-xl bg-[var(--brand-blue)] font-bold text-white" onClick={onCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create the first code
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Funnel</th>
                  <th className="px-4 py-3">Threshold</th>
                  <th className="px-4 py-3 text-right">Earned</th>
                  <th className="px-4 py-3 text-right">Owed</th>
                  <th className="w-8 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((c) => (
                  <CodeRow key={c.id} c={c} onOpen={() => onOpen(c.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Page {page} of {pages} · {formatCount(total)} codes
            </span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CodeRow({ c, onOpen }: { c: ReferralCodeListItem; onOpen: () => void }) {
  const signupRate = c.visitors ? c.signups / c.visitors : 0;
  return (
    <tr
      className="cursor-pointer align-top transition hover:bg-slate-50/80"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      tabIndex={0}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-extrabold text-slate-900">{c.code}</span>
          <KindBadge kind={c.kind} />
          {c.status !== "active" ? (
            <Badge className={CODE_STATUS_BADGE[c.status] ?? CODE_STATUS_BADGE.paused}>{c.status}</Badge>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          {c.label ? <span className="max-w-[180px] truncate text-xs text-slate-500">{c.label}</span> : null}
          <CopyButton value={c.link} label="Link" />
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-800">{c.ownerName || "—"}</p>
        <p className="text-xs text-slate-500">{c.ownerPhone || ""}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-baseline gap-3 text-xs text-slate-500">
          <span>
            <span className="text-base font-extrabold text-slate-900">{formatCount(c.visitors)}</span> visitors
          </span>
          <span>
            <span className="text-base font-extrabold text-[var(--brand-blue)]">{formatCount(c.signups)}</span> signups
          </span>
          <span>
            <span className="text-base font-extrabold text-emerald-600">{formatCount(c.qualified)}</span> qualified
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {formatPct(signupRate)} sign up · {formatCount(c.pending)} waiting to pay
          {c.rejected ? ` · ${formatCount(c.rejected)} rejected` : ""}
        </p>
      </td>
      <td className="px-4 py-3">
        <ThresholdBar qualified={c.qualified} threshold={c.threshold} compact />
      </td>
      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatEtb(c.earned)}</td>
      <td className={`px-4 py-3 text-right font-bold ${c.owed > 0 ? "text-amber-700" : "text-slate-400"}`}>
        {formatEtb(c.owed)}
      </td>
      <td className="px-2 py-3 text-slate-300">
        <ChevronRight className="h-4 w-4" />
      </td>
    </tr>
  );
}
