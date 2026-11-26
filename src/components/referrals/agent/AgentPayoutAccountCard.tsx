"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Landmark, Pencil, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/query-keys";
import { ApiError, getErrorMessage } from "@/lib/api";
import { formatPayoutAccount, payoutMethodKey } from "@/lib/agent-payout";
import {
  setMyPayoutAccount,
  type PayoutAccount,
  type PayoutMethod,
  type ReferralCodeSummary,
} from "@/services/referrals.service";
import { Input } from "@/components/ui/input";

const METHODS: PayoutMethod[] = ["telebirr", "cbe_birr", "mpesa", "bank"];

function PayoutForm({
  initial,
  codeId,
  onDone,
}: {
  initial?: PayoutAccount | null;
  codeId?: string;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const { dict } = useLanguage();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PayoutMethod>((initial?.method as PayoutMethod) || "telebirr");
  const [bank, setBank] = useState(initial?.bank ?? "");
  const [account, setAccount] = useState(
    initial ? (initial.method === "bank" ? initial.account : `+${initial.account}`) : ""
  );
  const [name, setName] = useState(initial?.name ?? user?.fullName ?? "");
  const [error, setError] = useState<string | null>(null);
  const isBank = method === "bank";

  const save = useMutation({
    mutationFn: () => setMyPayoutAccount({ method, bank: isBank ? bank : undefined, account, name }, codeId),
    onSuccess: () => {
      toast.success(dict.agent.payoutSaved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.referrals(user?.id) });
      onDone();
    },
    onError: (err) =>
      setError(err instanceof ApiError && err.status === 409 ? dict.agent.payoutTaken : getErrorMessage(err) || dict.agent.payoutError),
  });

  const labelCls = "mb-1.5 block text-xs font-bold text-slate-700";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save.mutate();
      }}
      className="mt-3 space-y-3"
    >
      <fieldset>
        <legend className={labelCls}>{dict.agent.payoutMethod}</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={method === m}
              onClick={() => setMethod(m)}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-extrabold transition ${
                method === m
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {m === "bank" ? <Landmark className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
              {dict.agent[payoutMethodKey(m)]}
            </button>
          ))}
        </div>
      </fieldset>
      {isBank && (
        <div>
          <label htmlFor="payout-bank" className={labelCls}>
            {dict.agent.payoutBank}
          </label>
          <Input
            id="payout-bank"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder={dict.agent.payoutBankPlaceholder}
            maxLength={60}
            required
          />
        </div>
      )}
      <div>
        <label htmlFor="payout-account" className={labelCls}>
          {isBank ? dict.agent.payoutAccountNumber : dict.agent.payoutWalletNumber}
        </label>
        <Input
          id="payout-account"
          inputMode={isBank ? "numeric" : "tel"}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder={isBank ? "1000123456789" : "09XX XXX XXX"}
          maxLength={40}
          required
        />
      </div>
      <div>
        <label htmlFor="payout-name" className={labelCls}>
          {dict.agent.payoutName}
        </label>
        <Input id="payout-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={save.isPending || !account.trim() || !name.trim() || (isBank && !bank.trim())}
          className="btn-shine inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-[var(--brand-blue)] px-4 text-sm font-extrabold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-px disabled:pointer-events-none disabled:opacity-50"
        >
          {save.isPending ? dict.agent.payoutSaving : dict.agent.payoutSave}
        </button>
        {initial && (
          <button
            type="button"
            onClick={onDone}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            {dict.common.cancel}
          </button>
        )}
      </div>
    </form>
  );
}

/** Where the agent wants to be paid. Prompts until it's set, since staff can't pay without it. */
export function AgentPayoutAccountCard({ summary, codeId }: { summary: ReferralCodeSummary; codeId?: string }) {
  const { dict } = useLanguage();
  const payout = summary.code.payout ?? null;
  const [editing, setEditing] = useState(false);

  return (
    <section className={`cm-card p-4 sm:p-5 ${payout ? "" : "ring-2 ring-amber-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
          <Landmark className="h-4 w-4 text-[var(--brand-blue)]" />
          {dict.agent.payoutTitle}
        </h2>
        {payout && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[var(--brand-blue)] hover:bg-[var(--color-primary-50)]"
          >
            <Pencil className="h-3 w-3" />
            {dict.agent.payoutChange}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">{dict.agent.payoutDesc}</p>

      {editing || !payout ? (
        <>
          {!payout && (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
              {dict.agent.payoutMissing}
            </p>
          )}
          <PayoutForm key={payout?.account ?? "new"} initial={payout} codeId={codeId} onDone={() => setEditing(false)} />
        </>
      ) : (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            {dict.agent[payoutMethodKey(payout.method)]}
            {payout.bank ? ` · ${payout.bank}` : ""}
          </p>
          <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{formatPayoutAccount(payout)}</p>
          <p className="text-xs font-semibold text-slate-600">{payout.name}</p>
        </div>
      )}
    </section>
  );
}
