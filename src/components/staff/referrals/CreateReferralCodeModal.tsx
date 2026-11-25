"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeReferralCode } from "@/lib/referral";
import { toastApiError } from "@/lib/toast-api-error";
import {
  createReferralCode,
  listReferralPrograms,
  type ReferralCodeDetail,
  type ReferralKind,
} from "@/services/referrals.service";
import { Field, Modal, selectClass } from "./referral-ui";

export function CreateReferralCodeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (code: ReferralCodeDetail) => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<ReferralKind>("agent");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [programId, setProgramId] = useState("");

  const programs = useQuery({
    queryKey: ["staff", "referrals", "programs"],
    queryFn: listReferralPrograms,
  });
  const customPrograms = (programs.data ?? []).filter((p) => p.kind === kind && !p.isDefault);
  const defaultProgram = (programs.data ?? []).find((p) => p.kind === kind && p.isDefault);

  const trimmedCode = code.trim();
  const codeError = trimmedCode && !normalizeReferralCode(trimmedCode) ? "4–20 letters, digits, - or _" : null;
  const phoneRequired = kind === "agent";

  const create = useMutation({
    mutationFn: () =>
      createReferralCode({
        kind,
        ownerPhone: ownerPhone.trim() || undefined,
        code: trimmedCode ? (normalizeReferralCode(trimmedCode) ?? trimmedCode) : undefined,
        label: label.trim() || undefined,
        programId: programId || undefined,
      }),
    onSuccess: (created) => {
      toast.success(`Code ${created.code.code} created`);
      void qc.invalidateQueries({ queryKey: ["staff", "referrals"] });
      onCreated(created);
    },
    onError: (err) => toastApiError(err, "Could not create the code"),
  });

  return (
    <Modal eyebrow="Referrals" title="New referral code" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (codeError || (phoneRequired && !ownerPhone.trim())) return;
          create.mutate();
        }}
      >
        <Field label="Type">
          <div className="grid grid-cols-2 gap-2">
            {(["agent", "influencer"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setProgramId("");
                }}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  kind === k
                    ? "border-[var(--brand-blue)] bg-[var(--brand-blue)]/[0.05] ring-1 ring-[var(--brand-blue)]"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-bold capitalize text-slate-900">{k}</p>
                <p className="text-[11px] leading-snug text-slate-500">
                  {k === "agent" ? "Field agent with a Carra account" : "Creator or partner; account optional"}
                </p>
              </button>
            ))}
          </div>
        </Field>
        <Field
          label={phoneRequired ? "Agent's phone *" : "Owner's phone"}
          hint={
            phoneRequired
              ? "The agent must already have a Carra account with this phone. They see their stats when signed in."
              : "Link an account so the influencer can see their stats. Leave empty to track the code only."
          }
        >
          <Input
            required={phoneRequired}
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
            placeholder="09… or +2519…"
            inputMode="tel"
          />
        </Field>
        <Field label="Code" hint={codeError ?? "Leave empty to generate a 6-character code."}>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABEBE10"
            maxLength={20}
            className={`font-mono uppercase ${codeError ? "border-red-300" : ""}`}
          />
        </Field>
        <Field label="Label" hint="Only staff see this, e.g. the agent's area or campaign.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bole field team" maxLength={120} />
        </Field>
        <Field label="Payout rules">
          <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={selectClass}>
            <option value="">{defaultProgram ? `${defaultProgram.name} (default)` : "Default rules"}</option>
            {customPrograms.map((p) => (
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
          <Button
            type="submit"
            disabled={create.isPending || !!codeError || (phoneRequired && !ownerPhone.trim())}
            className="bg-[var(--brand-blue)] font-bold text-white"
          >
            <Link2 className="mr-1.5 h-4 w-4" />
            {create.isPending ? "Creating…" : "Create code"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
