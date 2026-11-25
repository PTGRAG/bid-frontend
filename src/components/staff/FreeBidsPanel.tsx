"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastApiError } from "@/lib/toast-api-error";
import {
  creditStaffAuctionFreeBids,
  getNearMissSettings,
  listStaffAuctionFreeBids,
  updateNearMissSettings,
  type NearMissSettings,
} from "@/services/staff.service";

const SETTINGS_KEY = ["staff", "near-miss", "settings"] as const;

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[var(--brand-blue)]"
      />
      <span>
        <span className="block text-sm font-bold text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

/** Staff page for the near-miss free-bid rules. */
export function FreeBidsPanel({ actorRole }: { actorRole: string }) {
  const canEdit = ["super_admin", "admin"].includes(actorRole.toLowerCase());
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: getNearMissSettings,
    enabled: canEdit,
  });
  const [form, setForm] = useState<NearMissSettings | null>(null);

  useEffect(() => {
    if (query.data?.settings) setForm(query.data.settings);
  }, [query.data]);

  const save = useMutation({
    mutationFn: (s: NearMissSettings) =>
      updateNearMissSettings({
        enabled: s.enabled,
        runnerUps: s.runnerUps,
        includeDuplicates: s.includeDuplicates,
        maxDuplicates: s.maxDuplicates,
      }),
    onSuccess: () => {
      toast.success("Free bid rules saved");
      void qc.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
    onError: (err) => toastApiError(err, "Could not save free bid rules"),
  });

  if (!canEdit) {
    return (
      <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-6 text-sm text-sky-950">
        Free bid rules require <code>admin</code> or <code>super_admin</code>.
      </div>
    );
  }

  const limits = query.data?.limits ?? { maxRunnerUps: 50, maxDuplicates: 500 };
  const defaults = query.data?.defaults;
  const runnerUpsValid =
    form != null && Number.isInteger(form.runnerUps) && form.runnerUps >= 0 && form.runnerUps <= limits.maxRunnerUps;
  const dupValid =
    form != null && Number.isInteger(form.maxDuplicates) && form.maxDuplicates >= 0 && form.maxDuplicates <= limits.maxDuplicates;
  const dirty =
    form != null &&
    query.data != null &&
    JSON.stringify({ ...form, updatedAt: undefined }) !==
      JSON.stringify({ ...query.data.settings, updatedAt: undefined });

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-blue)]">
            Near misses
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Free bids
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600">
            When a winner pays, the closest losing bids get one free bid each. A free bid covers
            the entrance fee of one ticket on any later auction. If that ticket wins, the
            customer still pays their bid amount.
          </p>
        </div>
      </div>

      {query.isLoading || !form ? (
        <p className="mt-6 text-sm text-slate-500">
          {query.isError ? "Could not load the free bid rules." : "Loading free bid rules…"}
        </p>
      ) : (
        <form
          className="mt-6 max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!runnerUpsValid || !dupValid) return;
            save.mutate(form);
          }}
        >
          <Toggle
            checked={form.enabled}
            onChange={(v) => setForm({ ...form, enabled: v })}
            label="Credit free bids automatically"
            hint="Runs once per auction, right after the winner pays. Turning it off stops new credits; free bids already given stay."
          />

          <div className={form.enabled ? "" : "pointer-events-none opacity-50"}>
            <label className="block text-sm font-bold text-slate-900" htmlFor="nm-runner-ups">
              Runner-ups who get a free bid
            </label>
            <p className="text-xs text-slate-500">
              The next lowest unique bids after the winner. {form.runnerUps > 0
                ? `${form.runnerUps} means the 2nd to ${form.runnerUps + 1}${ordinalSuffix(form.runnerUps + 1)} lowest unique bid.`
                : "0 turns runner-up credits off."}
            </p>
            <Input
              id="nm-runner-ups"
              type="number"
              min={0}
              max={limits.maxRunnerUps}
              value={Number.isFinite(form.runnerUps) ? form.runnerUps : ""}
              onChange={(e) => setForm({ ...form, runnerUps: Number.parseInt(e.target.value, 10) })}
              className="mt-2 w-32"
            />
            {!runnerUpsValid && (
              <p className="mt-1 text-xs font-medium text-red-600">
                Enter a whole number from 0 to {limits.maxRunnerUps}.
              </p>
            )}
          </div>

          <div className={`space-y-3 ${form.enabled ? "" : "pointer-events-none opacity-50"}`}>
            <Toggle
              checked={form.includeDuplicates}
              onChange={(v) => setForm({ ...form, includeDuplicates: v })}
              label="Also credit duplicate knockouts"
              hint="Bidders whose number was below the winning bid but lost only because someone else picked it too. Closest to the winning bid first."
            />
            {form.includeDuplicates && (
              <div className="pl-7">
                <label className="block text-xs font-bold text-slate-700" htmlFor="nm-max-dup">
                  Most knockouts credited per auction
                </label>
                <Input
                  id="nm-max-dup"
                  type="number"
                  min={0}
                  max={limits.maxDuplicates}
                  value={Number.isFinite(form.maxDuplicates) ? form.maxDuplicates : ""}
                  onChange={(e) =>
                    setForm({ ...form, maxDuplicates: Number.parseInt(e.target.value, 10) })
                  }
                  className="mt-1 w-32"
                />
                {!dupValid && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    Enter a whole number from 0 to {limits.maxDuplicates}.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <Button type="submit" disabled={!dirty || !runnerUpsValid || !dupValid || save.isPending}>
              {save.isPending ? "Saving…" : "Save rules"}
            </Button>
            {defaults && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm({ ...defaults })}
                disabled={save.isPending}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Reset to defaults
              </Button>
            )}
            {defaults && (
              <span className="text-xs text-slate-500">
                Defaults: on, {defaults.runnerUps} runner-ups, knockouts{" "}
                {defaults.includeDuplicates ? "on" : "off"}.
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return "th";
  return { 1: "st", 2: "nd", 3: "rd" }[n % 10 as 1 | 2 | 3] ?? "th";
}

const REASON_LABEL: Record<string, string> = {
  runner_up: "Runner-up",
  duplicate_knockout: "Duplicate knockout",
  staff_grant: "Staff grant",
};

/** "Free bids" tab of an auction's activity window: who got a free bid, plus a re-run button. */
export function AuctionFreeBidsTab({ auctionId }: { auctionId: string }) {
  const qc = useQueryClient();
  const key = ["staff", "auction", auctionId, "free-bids"];
  const query = useQuery({ queryKey: key, queryFn: () => listStaffAuctionFreeBids(auctionId) });
  const credit = useMutation({
    mutationFn: () => creditStaffAuctionFreeBids(auctionId),
    onSuccess: (n) => {
      toast.success(n > 0 ? `Credited ${n} free bid(s)` : "Everyone eligible already has their free bid");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (err) => toastApiError(err, "Could not credit free bids"),
  });

  const items = query.data ?? [];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs text-slate-500">
          Credited automatically when the winner pays. Running it again only adds missing
          credits, so nobody is credited twice.
        </p>
        <Button size="sm" variant="outline" onClick={() => credit.mutate()} disabled={credit.isPending}>
          <Gift className="mr-1.5 h-4 w-4" />
          {credit.isPending ? "Crediting…" : "Credit near misses"}
        </Button>
      </div>
      {query.isLoading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading free bids…</p>
      ) : query.isError ? (
        <p className="py-10 text-center text-sm text-rose-600">
          Could not load free bids. Only admins can see this.
        </p>
      ) : !items.length ? (
        <p className="py-10 text-center text-sm text-slate-500">
          No free bids for this auction yet. They are given once the winner has paid.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Why</th>
                <th className="px-4 py-2.5 text-right">Bid (ETB)</th>
                <th className="px-4 py-2.5">Credited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">
                    {g.participantName || g.participantId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {REASON_LABEL[g.reason] ?? g.reason}
                    {g.reason === "runner_up" && g.rank
                      ? ` · ${g.rank}${ordinalSuffix(g.rank)} lowest unique`
                      : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {g.bidValue != null ? Number(g.bidValue).toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {new Date(g.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
