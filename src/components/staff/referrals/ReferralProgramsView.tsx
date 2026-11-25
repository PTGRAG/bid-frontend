"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CopyPlus,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastApiError } from "@/lib/toast-api-error";
import {
  addTier,
  chainTiers,
  earningsFor,
  removeTier,
  tierRangeLabel,
  validateProgramDraft,
  type TierDraft,
} from "@/lib/referral-tiers";
import { listStaffAuctions } from "@/services/staff.service";
import {
  createReferralProgram,
  listReferralPrograms,
  updateReferralProgram,
  type ReferralProgramAdmin,
} from "@/services/referrals.service";
import { Badge, Field, KindBadge, formatEtb } from "./referral-ui";

const PREVIEW_COUNTS = [10, 25, 50, 100, 250];

interface Draft {
  name: string;
  threshold: number;
  tiers: TierDraft[];
  netMarginPerBid: number;
  attributionWindowDays: number;
  qualifyingAuctionIds: string[];
}

function toDraft(p: ReferralProgramAdmin): Draft {
  return {
    name: p.name,
    threshold: p.threshold,
    tiers: p.tiers.map((t) => ({ from: t.from, to: t.to ?? null, amount: t.amount })),
    netMarginPerBid: p.netMarginPerBid,
    attributionWindowDays: p.attributionWindowDays,
    qualifyingAuctionIds: p.qualifyingAuctions.map((a) => a.id),
  };
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function ReferralProgramsView({ canEdit }: { canEdit: boolean }) {
  const query = useQuery({
    queryKey: ["staff", "referrals", "programs"],
    queryFn: listReferralPrograms,
  });

  if (query.isLoading) {
    return <p className="py-16 text-center text-sm text-slate-500">Loading payout rules…</p>;
  }
  if (query.isError) {
    return <p className="py-16 text-center text-sm text-red-600">Could not load the referral programs.</p>;
  }
  const programs = [...(query.data ?? [])].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm leading-relaxed text-slate-600">
        <p className="font-bold text-slate-800">How agents get paid</p>
        <p className="mt-1">
          A referral counts once the invited account pays for a ticket on a qualifying auction within the attribution
          window. Free tickets never count, and each phone number and payment account can only count once across all
          codes. Nothing is paid until a code reaches the threshold; after that, each further bidder is paid at the rate
          of the tier its number falls in. Every tier must stay below the net margin per bid, so a referral never costs
          more than the platform keeps from one ticket.
        </p>
      </div>
      {programs.map((p) => (
        <ProgramEditor key={`${p.id}:${JSON.stringify(toDraft(p))}`} program={p} canEdit={canEdit} />
      ))}
    </div>
  );
}

function ProgramEditor({ program, canEdit }: { program: ReferralProgramAdmin; canEdit: boolean }) {
  const qc = useQueryClient();
  const initial = useMemo(() => toDraft(program), [program]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [showAuctions, setShowAuctions] = useState(false);

  const auctionsQuery = useQuery({
    queryKey: ["staff", "referrals", "auction-options"],
    queryFn: () => listStaffAuctions({ page: 1, limit: 100 }),
    enabled: showAuctions,
    staleTime: 60_000,
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const error = validateProgramDraft(draft) ?? (draft.name.trim() ? null : "Program name is required");
  const top = draft.tiers.length ? draft.tiers[draft.tiers.length - 1].amount : 0;
  const headroom = draft.netMarginPerBid > 0 ? 1 - top / draft.netMarginPerBid : 0;

  const save = useMutation({
    mutationFn: () =>
      updateReferralProgram(program.id, {
        name: draft.name.trim(),
        threshold: draft.threshold,
        tiers: draft.tiers,
        netMarginPerBid: draft.netMarginPerBid,
        attributionWindowDays: draft.attributionWindowDays,
        qualifyingAuctionIds: draft.qualifyingAuctionIds,
      }),
    onSuccess: () => {
      toast.success("Payout rules saved. Agent earnings now use the new rules.");
      void qc.invalidateQueries({ queryKey: ["staff", "referrals"] });
    },
    onError: (err) => toastApiError(err, "Could not save the program"),
  });

  const duplicate = useMutation({
    mutationFn: () =>
      createReferralProgram({
        name: `${program.name} (custom)`,
        kind: program.kind,
        threshold: initial.threshold,
        tiers: initial.tiers,
        netMarginPerBid: initial.netMarginPerBid,
        attributionWindowDays: initial.attributionWindowDays,
        qualifyingAuctionIds: initial.qualifyingAuctionIds,
      }),
    onSuccess: () => {
      toast.success("Custom program created. Assign it to a code from the code's page.");
      void qc.invalidateQueries({ queryKey: ["staff", "referrals", "programs"] });
    },
    onError: (err) => toastApiError(err, "Could not create the program"),
  });

  const setThreshold = (threshold: number) =>
    setDraft((d) => ({ ...d, threshold, tiers: Number.isInteger(threshold) && threshold >= 0 ? chainTiers(threshold, d.tiers) : d.tiers }));
  const setTier = (i: number, patch: Partial<TierDraft>) =>
    setDraft((d) => ({
      ...d,
      tiers: chainTiers(
        d.threshold,
        d.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t))
      ),
    }));

  const selectedTitles = new Map(program.qualifyingAuctions.map((a) => [a.id, a.title]));
  for (const a of auctionsQuery.data?.items ?? []) selectedTitles.set(a.id, a.title);
  const toggleAuction = (id: string) =>
    setDraft((d) => ({
      ...d,
      qualifyingAuctionIds: d.qualifyingAuctionIds.includes(id)
        ? d.qualifyingAuctionIds.filter((x) => x !== id)
        : [...d.qualifyingAuctionIds, id],
    }));

  const disabled = !canEdit;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{program.name}</h2>
          <KindBadge kind={program.kind} />
          {program.isDefault ? (
            <Badge className="border-slate-200 bg-white text-slate-600">Default for {program.kind}s</Badge>
          ) : (
            <Badge className="border-amber-200 bg-amber-50 text-amber-800">Custom</Badge>
          )}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {program.isDefault ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl font-bold"
                disabled={duplicate.isPending}
                onClick={() => duplicate.mutate()}
              >
                <CopyPlus className="mr-1.5 h-4 w-4" />
                Make a custom copy
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl font-bold"
              disabled={!dirty || save.isPending}
              onClick={() => setDraft(initial)}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-xl bg-[var(--brand-blue)] font-bold text-white"
              disabled={!dirty || !!error || save.isPending}
              onClick={() => save.mutate()}
            >
              <Save className="mr-1.5 h-4 w-4" />
              {save.isPending ? "Saving…" : "Save rules"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: rules */}
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Program name">
              <Input
                value={draft.name}
                disabled={disabled}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </Field>
            <Field label="Payout threshold" hint="Qualified bidders a code needs before it earns anything.">
              <Input
                type="number"
                min={0}
                step={1}
                value={Number.isNaN(draft.threshold) ? "" : draft.threshold}
                disabled={disabled}
                onChange={(e) => setThreshold(num(e.target.value))}
              />
            </Field>
            <Field
              label="Net margin per bid (ETB)"
              hint="What the platform keeps from one paid ticket after costs. Every tier must pay less."
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                value={Number.isNaN(draft.netMarginPerBid) ? "" : draft.netMarginPerBid}
                disabled={disabled}
                onChange={(e) => setDraft((d) => ({ ...d, netMarginPerBid: num(e.target.value) }))}
              />
            </Field>
            <Field label="Attribution window (days)" hint="Time after signup for the first paid ticket.">
              <Input
                type="number"
                min={1}
                max={365}
                step={1}
                value={Number.isNaN(draft.attributionWindowDays) ? "" : draft.attributionWindowDays}
                disabled={disabled}
                onChange={(e) => setDraft((d) => ({ ...d, attributionWindowDays: num(e.target.value) }))}
              />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Payout tiers (per qualified bidder)</p>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, tiers: addTier(d.threshold, d.tiers) }))}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/[0.06]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add tier
                </button>
              ) : null}
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Bidders</th>
                    <th className="px-3 py-2">Up to</th>
                    <th className="px-3 py-2">ETB each</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/40 text-slate-500">
                    <td className="px-3 py-2 font-semibold">
                      {draft.threshold > 0 ? tierRangeLabel({ from: 1, to: draft.threshold }) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">Threshold</td>
                    <td className="px-3 py-2 font-bold">0</td>
                    <td />
                  </tr>
                  {draft.tiers.map((t, i) => {
                    const last = i === draft.tiers.length - 1;
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2 font-bold text-slate-900">{tierRangeLabel(t)}</td>
                        <td className="px-3 py-2">
                          {last ? (
                            <span className="text-xs font-semibold text-slate-500">and up</span>
                          ) : (
                            <Input
                              type="number"
                              min={t.from}
                              step={1}
                              className="h-8 w-24"
                              value={t.to ?? ""}
                              disabled={disabled}
                              onChange={(e) => setTier(i, { to: num(e.target.value) })}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.5"
                            className="h-8 w-24"
                            value={Number.isNaN(t.amount) ? "" : t.amount}
                            disabled={disabled}
                            onChange={(e) => setTier(i, { amount: num(e.target.value) })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {canEdit && draft.tiers.length > 1 ? (
                            <button
                              type="button"
                              aria-label={`Remove tier ${i + 1}`}
                              onClick={() => setDraft((d) => ({ ...d, tiers: removeTier(d.threshold, d.tiers, i) }))}
                              className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Qualifying auctions</p>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setShowAuctions((v) => !v)}
                  className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/[0.06]"
                >
                  {showAuctions ? "Done" : "Choose auctions"}
                </button>
              ) : null}
            </div>
            {draft.qualifyingAuctionIds.length ? (
              <div className="flex flex-wrap gap-1.5">
                {draft.qualifyingAuctionIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    {selectedTitles.get(id) ?? "Auction"}
                    {canEdit ? (
                      <button
                        type="button"
                        aria-label="Remove auction"
                        onClick={() => toggleAuction(id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Any auction counts. Pick auctions to limit which tickets qualify.</p>
            )}
            {showAuctions ? (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                {auctionsQuery.isLoading ? (
                  <p className="p-3 text-xs text-slate-500">Loading auctions…</p>
                ) : (
                  (auctionsQuery.data?.items ?? []).map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={draft.qualifyingAuctionIds.includes(a.id)}
                        onChange={() => toggleAuction(a.id)}
                        style={{ accentColor: "var(--brand-blue)" }}
                      />
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{a.title}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-400">{String(a.status)}</span>
                      <span className="text-xs font-bold text-slate-600">{formatEtb(a.entranceFee)}</span>
                    </label>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: guardrail and preview */}
        <div className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}
          {!dirty && program.warnings.length
            ? program.warnings.map((w) => (
                <div
                  key={w}
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  {w}
                </div>
              ))
            : null}

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Margin guardrail</p>
                <p className="mt-1 text-sm text-slate-600">
                  Top tier <span className="font-extrabold text-slate-900">{formatEtb(top, 0)}</span> of{" "}
                  <span className="font-extrabold text-slate-900">{formatEtb(draft.netMarginPerBid, 0)}</span> net margin
                  per bid
                </p>
              </div>
              <ShieldCheck className={`h-5 w-5 ${headroom > 0 ? "text-emerald-500" : "text-red-500"}`} />
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${headroom > 0.2 ? "bg-emerald-500" : headroom > 0 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(100, Math.max(0, (1 - headroom) * 100))}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {headroom > 0
                ? `The platform keeps at least ${formatEtb(draft.netMarginPerBid - top, 0)} per referred bidder even at the top tier.`
                : "The top tier must pay less than the net margin per bid."}
              {program.lowestEntranceFee !== undefined && program.lowestEntranceFee !== null
                ? ` Cheapest qualifying ticket today: ${formatEtb(program.lowestEntranceFee, 0)}.`
                : ""}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              What one code would earn
            </p>
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-2">Qualified bidders</th>
                  <th className="px-4 py-2 text-right">Agent earns</th>
                  <th className="px-4 py-2 text-right">Avg per bidder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...new Set([draft.threshold, ...PREVIEW_COUNTS])]
                  .filter((n) => Number.isInteger(n) && n > 0)
                  .sort((a, b) => a - b)
                  .map((n) => {
                    const earned = error ? NaN : earningsFor(draft.threshold, draft.tiers, n);
                    return (
                      <tr key={n}>
                        <td className="px-4 py-2 font-semibold text-slate-700">
                          {n}
                          {n === draft.threshold ? (
                            <span className="ml-1.5 text-[10px] font-bold uppercase text-slate-400">threshold</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right font-extrabold text-slate-900">
                          {Number.isNaN(earned) ? "—" : formatEtb(earned)}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-slate-500">
                          {Number.isNaN(earned) ? "—" : formatEtb(earned / n, 2)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {dirty ? (
            <p className="text-xs text-slate-500">
              Saving recalculates every code on this program, including bidders who already qualified.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
