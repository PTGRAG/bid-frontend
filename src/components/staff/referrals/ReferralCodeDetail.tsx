"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  BadgeCheck,
  Banknote,
  Eye,
  Pause,
  Pencil,
  Play,
  Smartphone,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { telegramReferralLink } from "@/lib/referral";
import { toastApiError } from "@/lib/toast-api-error";
import { tierRangeLabel } from "@/lib/referral-tiers";
import {
  REFERRAL_REJECT_REASON_LABEL,
  addReferralPayout,
  getReferralCode,
  getReferralCodeActivity,
  getReferralCodePayouts,
  getReferralCodeReferrals,
  listReferralPrograms,
  rejectReferral,
  restoreReferral,
  updateReferralCode,
  type ReferralCodeDetail as Detail,
  type ReferralView,
} from "@/services/referrals.service";
import {
  ActivityBars,
  Badge,
  CODE_STATUS_BADGE,
  CopyButton,
  Field,
  KindBadge,
  Kpi,
  Modal,
  REFERRAL_STATUS_BADGE,
  REFERRAL_STATUS_LABEL,
  SectionHeader,
  ThresholdBar,
  formatCount,
  formatDate,
  formatDateTime,
  formatEtb,
  formatPct,
  pillClass,
  selectClass,
} from "./referral-ui";

const REFERRAL_FILTERS = [
  { id: "", label: "All" },
  { id: "signed_up", label: "Signed up" },
  { id: "qualified", label: "Qualified" },
  { id: "rejected", label: "Rejected" },
] as const;

const ACTIVITY_RANGES = [7, 30, 90] as const;

const PAYOUT_METHODS = ["telebirr", "cbe_birr", "bank_transfer", "cash", "other"] as const;

export function ReferralCodeDetail({
  codeId,
  canEdit,
  onBack,
}: {
  codeId: string;
  canEdit: boolean;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [days, setDays] = useState<(typeof ACTIVITY_RANGES)[number]>(30);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [rejecting, setRejecting] = useState<ReferralView | null>(null);

  const detail = useQuery({
    queryKey: ["staff", "referrals", "code", codeId],
    queryFn: () => getReferralCode(codeId),
    refetchInterval: 30_000,
  });
  const referrals = useQuery({
    queryKey: ["staff", "referrals", "code", codeId, "referrals", status, page],
    queryFn: () => getReferralCodeReferrals(codeId, { status: status || undefined, page, limit: 20 }),
  });
  const activity = useQuery({
    queryKey: ["staff", "referrals", "code", codeId, "activity", days],
    queryFn: () => getReferralCodeActivity(codeId, days),
  });
  const payouts = useQuery({
    queryKey: ["staff", "referrals", "code", codeId, "payouts"],
    queryFn: () => getReferralCodePayouts(codeId),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["staff", "referrals"] });

  const toggleStatus = useMutation({
    mutationFn: (next: "active" | "paused") => updateReferralCode(codeId, { status: next }),
    onSuccess: (d) => {
      toast.success(d.code.status === "paused" ? "Code paused. New visits and signups won't count." : "Code is active again");
      invalidate();
    },
    onError: (err) => toastApiError(err, "Could not update the code"),
  });

  const restore = useMutation({
    mutationFn: (r: ReferralView) => restoreReferral(r.id),
    onSuccess: () => {
      toast.success("Referral restored and rechecked");
      invalidate();
    },
    onError: (err) => toastApiError(err, "Could not restore the referral"),
  });

  if (detail.isLoading) {
    return <p className="py-16 text-center text-sm text-slate-500">Loading code…</p>;
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="space-y-4">
        <BackButton onBack={onBack} />
        <p className="py-16 text-center text-sm text-red-600">Could not load this code.</p>
      </div>
    );
  }

  const d = detail.data;
  const e = d.earnings;
  const f = d.funnel;
  const tgLink = telegramReferralLink(d.code.code);
  const items = referrals.data?.items ?? [];
  const total = referrals.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <BackButton onBack={onBack} />

      {/* Identity */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-3xl font-extrabold tracking-tight text-slate-900">{d.code.code}</h1>
              <KindBadge kind={d.code.kind} />
              <Badge className={CODE_STATUS_BADGE[d.code.status] ?? CODE_STATUS_BADGE.paused}>{d.code.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{d.ownerName || "No linked account"}</span>
              {d.ownerPhone ? <span className="text-slate-500"> · {d.ownerPhone}</span> : null}
              {d.code.label ? <span className="text-slate-500"> · {d.code.label}</span> : null}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {d.program.name} · created {formatDate(d.code.createdAt)}
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              <LinkRow label="Web" value={d.code.link} />
              {tgLink ? <LinkRow label="Telegram" value={tgLink} /> : null}
            </div>
          </div>
          {canEdit ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl font-bold"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl font-bold"
                disabled={toggleStatus.isPending}
                onClick={() => toggleStatus.mutate(d.code.status === "active" ? "paused" : "active")}
              >
                {d.code.status === "active" ? (
                  <>
                    <Pause className="mr-1.5 h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-1.5 h-4 w-4" />
                    Activate
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl bg-[var(--brand-blue)] font-bold text-white"
                disabled={e.owed <= 0}
                onClick={() => setPaying(true)}
                title={e.owed <= 0 ? "Nothing owed right now" : undefined}
              >
                <Banknote className="mr-1.5 h-4 w-4" />
                Record payout
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Funnel */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Link visitors"
          value={formatCount(f.visitors)}
          hint={`${formatCount(f.visits)} opens in total`}
          icon={Eye}
        />
        <Kpi
          label="Signups"
          value={formatCount(f.signups)}
          hint={`${formatPct(f.visitorToSignupRate)} of visitors · ${formatCount(f.pending)} waiting to pay`}
          icon={UserPlus}
          tone="brand"
        />
        <Kpi
          label="Qualified bidders"
          value={formatCount(f.qualified)}
          hint={`${formatPct(f.signupToQualifiedRate)} of signups${f.rejected ? ` · ${formatCount(f.rejected)} rejected` : ""}`}
          icon={BadgeCheck}
          tone="ok"
        />
        <Kpi
          label="Earned"
          value={formatEtb(e.earned)}
          hint={
            <>
              {formatEtb(e.paidOut)} paid · <span className="font-bold text-slate-700">{formatEtb(e.owed)} owed</span>
              {e.overpaid > 0 ? <span className="text-red-600"> · {formatEtb(e.overpaid)} overpaid</span> : null}
            </>
          }
          icon={Banknote}
          tone={e.overpaid > 0 ? "danger" : e.owed > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Threshold and tiers */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader eyebrow="Payout progress" title={e.unlocked ? "Earning" : `${e.remaining} to unlock`} />
          <div className="mt-4">
            <ThresholdBar qualified={e.qualified} threshold={e.threshold} />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {e.unlocked ? (
              <>
                The next qualified bidder pays <span className="font-extrabold text-slate-900">{formatEtb(e.currentRate)}</span>.
              </>
            ) : (
              <>Nothing is paid until {e.threshold} referrals qualify.</>
            )}
            {e.nextTier ? (
              <>
                {" "}
                {e.nextTier.biddersNeeded} more to reach the {formatEtb(e.nextTier.amount)} tier.
              </>
            ) : null}
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-1.5">Tier</th>
                <th className="py-1.5 text-right">Each</th>
                <th className="py-1.5 text-right">Bidders</th>
                <th className="py-1.5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {e.tiers.map((t) => (
                <tr key={t.from} className={t.bidders ? "" : "text-slate-400"}>
                  <td className="py-1.5 font-semibold">{tierRangeLabel(t)}</td>
                  <td className="py-1.5 text-right">{formatEtb(t.amount)}</td>
                  <td className="py-1.5 text-right">{t.bidders}</td>
                  <td className="py-1.5 text-right font-bold">{formatEtb(t.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            Window: first paid ticket within {d.program.attributionWindowDays} days of signup
            {d.program.qualifyingAuctions.length
              ? ` on ${d.program.qualifyingAuctions.map((a) => a.title).join(", ")}`
              : " on any auction"}
            .
          </p>
        </div>

        {/* Activity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader eyebrow="Activity" title={`Last ${days} days`}>
            <div className="flex gap-1">
              {ACTIVITY_RANGES.map((r) => (
                <button key={r} type="button" className={pillClass(days === r)} onClick={() => setDays(r)}>
                  {r}d
                </button>
              ))}
            </div>
          </SectionHeader>
          <div className="mt-4">
            {activity.isLoading ? (
              <p className="py-10 text-center text-sm text-slate-400">Loading activity…</p>
            ) : (
              <ActivityBars days={activity.data ?? []} />
            )}
          </div>
        </div>
      </div>

      {/* Referrals */}
      <div className="space-y-3">
        <SectionHeader eyebrow="People" title="Referred accounts">
          <div className="flex flex-wrap gap-1.5">
            {REFERRAL_FILTERS.map((r) => (
              <button
                key={r.id || "all"}
                type="button"
                className={pillClass(status === r.id)}
                onClick={() => {
                  setStatus(r.id);
                  setPage(1);
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </SectionHeader>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {referrals.isLoading ? (
            <p className="py-12 text-center text-sm text-slate-500">Loading referrals…</p>
          ) : !items.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-slate-500">
              <Users className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium">No referred accounts{status ? " with this status" : " yet"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Signed up</th>
                    <th className="px-4 py-3">Paid ticket</th>
                    <th className="px-4 py-3">Flags</th>
                    {canEdit ? <th className="px-4 py-3">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((r) => {
                    const shown = r.status === "signed_up" && r.expired ? "expired" : r.status;
                    return (
                      <tr key={r.id} className="align-top">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{r.name || "—"}</p>
                          <p className="text-xs text-slate-500">{r.phone || "no phone"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={REFERRAL_STATUS_BADGE[shown] ?? REFERRAL_STATUS_BADGE.signed_up}>
                            {REFERRAL_STATUS_LABEL[shown] ?? shown}
                          </Badge>
                          {r.status === "rejected" && r.rejectReason ? (
                            <p className="mt-1 max-w-[200px] text-[11px] leading-snug text-red-600">
                              {REFERRAL_REJECT_REASON_LABEL[r.rejectReason] ?? r.rejectReason}
                              {r.rejectNote ? `: ${r.rejectNote}` : ""}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(r.signedUpAt)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {r.qualifiedAt ? (
                            <>
                              <p className="font-semibold text-slate-800">{formatDateTime(r.qualifiedAt)}</p>
                              {r.auctionTitle ? <p className="text-slate-500">{r.auctionTitle}</p> : null}
                            </>
                          ) : r.status === "signed_up" && r.qualifiesBy ? (
                            <p className={r.expired ? "text-slate-400" : ""}>
                              {r.expired ? "Window closed " : "Pay by "}
                              {formatDate(r.qualifiesBy)}
                            </p>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.needsPhone ? (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                no phone yet
                              </span>
                            ) : null}
                            {r.sameDevice ? (
                              <span
                                className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700"
                                title="Other accounts on this code signed up from the same browser"
                              >
                                <Smartphone className="h-3 w-3" />
                                {r.sameDevice} same device
                              </span>
                            ) : null}
                          </div>
                        </td>
                        {canEdit ? (
                          <td className="px-4 py-3">
                            {r.status === "rejected" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs font-bold"
                                disabled={restore.isPending}
                                onClick={() => restore.mutate(r)}
                              >
                                <Undo2 className="mr-1 h-3.5 w-3.5" />
                                Restore
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs font-bold text-red-700 hover:border-red-300 hover:text-red-700"
                                onClick={() => setRejecting(r)}
                              >
                                <Ban className="mr-1 h-3.5 w-3.5" />
                                Reject
                              </Button>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>
                Page {page} of {pages} · {formatCount(total)} accounts
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

      {/* Payouts */}
      <div className="space-y-3">
        <SectionHeader eyebrow="Money" title="Payout history" />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {payouts.isLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading payouts…</p>
          ) : !(payouts.data ?? []).length ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
              <Banknote className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium">No payouts recorded</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(payouts.data ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(p.paidAt)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatEtb(p.amount, 2)}</td>
                    <td className="px-4 py-3 text-xs font-semibold capitalize text-slate-700">
                      {p.method ? p.method.replace(/_/g, " ") : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.reference || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing ? <EditCodeModal detail={d} onClose={() => setEditing(false)} onSaved={invalidate} /> : null}
      {paying ? <PayoutModal detail={d} onClose={() => setPaying(false)} onSaved={invalidate} /> : null}
      {rejecting ? (
        <RejectModal referral={rejecting} onClose={() => setRejecting(null)} onSaved={invalidate} />
      ) : null}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" />
      All codes
    </button>
  );
}

function LinkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5">
      <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{value}</span>
      <CopyButton value={value} />
    </div>
  );
}

function EditCodeModal({ detail, onClose, onSaved }: { detail: Detail; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(detail.code.label);
  const programs = useQuery({
    queryKey: ["staff", "referrals", "programs"],
    queryFn: listReferralPrograms,
  });
  const options = (programs.data ?? []).filter((p) => p.kind === detail.code.kind);
  const defaultProgram = options.find((p) => p.isDefault);
  const [programId, setProgramId] = useState(detail.program.isDefault ? "" : detail.program.id);

  const save = useMutation({
    mutationFn: () =>
      updateReferralCode(detail.code.id, {
        label: label.trim(),
        ...(programId ? { programId } : { clearProgram: true }),
      }),
    onSuccess: () => {
      toast.success("Code updated");
      onSaved();
      onClose();
    },
    onError: (err) => toastApiError(err, "Could not update the code"),
  });

  return (
    <Modal eyebrow={detail.code.code} title="Edit code" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Label" hint="Only staff see this.">
          <Input value={label} onChange={(ev) => setLabel(ev.target.value)} maxLength={120} />
        </Field>
        <Field label="Payout rules" hint="Changing rules recalculates this code's earnings, including past bidders.">
          <select value={programId} onChange={(ev) => setProgramId(ev.target.value)} className={selectClass}>
            <option value="">{defaultProgram ? `${defaultProgram.name} (default)` : "Default rules"}</option>
            {options
              .filter((p) => !p.isDefault)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending} className="bg-[var(--brand-blue)] font-bold text-white">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PayoutModal({ detail, onClose, onSaved }: { detail: Detail; onClose: () => void; onSaved: () => void }) {
  const owed = detail.earnings.owed;
  const [amount, setAmount] = useState(String(owed));
  const [method, setMethod] = useState<string>("telebirr");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const value = Number(amount);
  const invalid = !Number.isFinite(value) || value <= 0 || value > owed;

  const save = useMutation({
    mutationFn: () =>
      addReferralPayout(detail.code.id, {
        amount: Math.round(value * 100) / 100,
        method,
        reference: reference.trim(),
        note: note.trim(),
      }),
    onSuccess: () => {
      toast.success("Payout recorded");
      onSaved();
      onClose();
    },
    onError: (err) => toastApiError(err, "Could not record the payout"),
  });

  return (
    <Modal eyebrow={detail.code.code} title="Record a payout" onClose={onClose}>
      <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Send the money first (telebirr, bank, cash), then record it here. {detail.ownerName || "The agent"} is owed{" "}
        <span className="font-extrabold text-slate-900">{formatEtb(owed, 2)}</span>.
      </p>
      <form
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!invalid) save.mutate();
        }}
      >
        <Field label="Amount (ETB) *" hint={value > owed ? "More than what is owed." : undefined}>
          <Input
            type="number"
            min={0}
            step="0.01"
            max={owed}
            value={amount}
            onChange={(ev) => setAmount(ev.target.value)}
            required
          />
        </Field>
        <Field label="Method">
          <select value={method} onChange={(ev) => setMethod(ev.target.value)} className={selectClass}>
            {PAYOUT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference" hint="Transaction id or receipt number.">
          <Input value={reference} onChange={(ev) => setReference(ev.target.value)} maxLength={120} />
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={255} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={invalid || save.isPending} className="bg-[var(--brand-blue)] font-bold text-white">
            <Banknote className="mr-1.5 h-4 w-4" />
            {save.isPending ? "Saving…" : "Record payout"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RejectModal({
  referral,
  onClose,
  onSaved,
}: {
  referral: ReferralView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => rejectReferral(referral.id, note.trim() || undefined),
    onSuccess: () => {
      toast.success("Referral rejected. It no longer counts toward the threshold or earnings.");
      onSaved();
      onClose();
    },
    onError: (err) => toastApiError(err, "Could not reject the referral"),
  });
  return (
    <Modal eyebrow="Referral" title={`Reject ${referral.name || "this referral"}?`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          save.mutate();
        }}
      >
        <p className="text-sm text-slate-600">
          The account stays, but it stops counting for this code. You can restore it later.
        </p>
        <Field label="Reason" hint="Saved in the audit log and shown to staff.">
          <Input autoFocus value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={255} placeholder="e.g. Same person as …" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending} className="bg-red-600 font-bold text-white hover:bg-red-700">
            <Ban className="mr-1.5 h-4 w-4" />
            {save.isPending ? "Rejecting…" : "Reject referral"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
