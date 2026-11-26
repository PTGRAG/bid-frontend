"use client";

import { useState } from "react";
import { Check, Copy, Link2, PauseCircle, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { telegramReferralLink } from "@/lib/referral";
import { telegramShareUrl } from "@/lib/agent-dashboard";
import { openTelegramUrl } from "@/lib/telegram-webapp";
import type { ReferralCodeView } from "@/services/referrals.service";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path (Telegram's in-app browser on some phones) */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function useCopy() {
  const { dict } = useLanguage();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, value: string) => {
    if (await copyText(value)) {
      setCopied(key);
      toast.success(dict.agent.copied);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } else {
      toast.error(dict.agent.copyFailed);
    }
  };
  return { copied, copy };
}

function LinkRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const { dict } = useLanguage();
  return (
    <div className="rounded-xl bg-white/12 p-2.5 ring-1 ring-white/20 backdrop-blur-sm">
      <p className="px-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/75">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="min-w-0 flex-1 select-all truncate px-0.5 font-mono text-[13px] font-semibold text-white">
          {value.replace(/^https?:\/\//, "")}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`${dict.agent.copy}: ${label}`}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-extrabold text-[var(--color-primary-800)] transition hover:bg-[var(--brand-yellow)] hover:text-slate-900 active:scale-[0.97]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? dict.agent.copied : dict.agent.copy}
        </button>
      </div>
    </div>
  );
}

/** The agent's code and links on the brand panel, with copy and share actions. */
export function AgentShareCard({ code }: { code: ReferralCodeView }) {
  const { dict, t } = useLanguage();
  const { copied, copy } = useCopy();
  const tgLink = telegramReferralLink(code.code);
  const message = t("agent.shareMessage", { code: code.code });
  const shareLink = tgLink || code.link;

  const nativeShare = async () => {
    const shareData = { title: "CarraMarket", text: message, url: code.link };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    await copy("share", `${message} ${code.link}`);
  };

  return (
    <section className="cm-brand-panel relative overflow-hidden rounded-[1.25rem] p-4 text-white shadow-[var(--shadow-glow)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="flex flex-col justify-between gap-3 lg:w-[38%]">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white/80">
              <Link2 className="h-3.5 w-3.5" />
              {dict.agent.shareTitle}
            </p>
            <p className="mt-1 text-sm font-medium text-white/85">{dict.agent.shareDesc}</p>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">{dict.agent.yourCode}</p>
            <button
              type="button"
              onClick={() => copy("code", code.code)}
              className="group mt-1 inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-white/50 bg-white/10 px-3 py-1.5 transition hover:border-[var(--brand-yellow)]"
              aria-label={`${dict.agent.copy}: ${code.code}`}
            >
              <span className="font-mono text-2xl font-extrabold tracking-[0.18em] sm:text-3xl">{code.code}</span>
              {copied === "code" ? (
                <Check className="h-4 w-4 text-[var(--brand-yellow)]" />
              ) : (
                <Copy className="h-4 w-4 text-white/70 group-hover:text-[var(--brand-yellow)]" />
              )}
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <LinkRow
            label={dict.agent.webLink}
            value={code.link}
            copied={copied === "web"}
            onCopy={() => copy("web", code.link)}
          />
          {tgLink && (
            <LinkRow
              label={dict.agent.telegramLink}
              value={tgLink}
              copied={copied === "tg"}
              onCopy={() => copy("tg", tgLink)}
            />
          )}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openTelegramUrl(telegramShareUrl(shareLink, message))}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand-yellow)] px-3 text-sm font-extrabold text-slate-900 shadow-sm transition hover:-translate-y-px active:scale-[0.98]"
            >
              <Send className="h-4 w-4" />
              <span className="truncate sm:hidden">{dict.agent.shareTelegramShort}</span>
              <span className="hidden truncate sm:inline">{dict.agent.shareTelegram}</span>
            </button>
            <button
              type="button"
              onClick={nativeShare}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-extrabold text-[var(--color-primary-800)] shadow-sm transition hover:-translate-y-px active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" />
              {dict.agent.share}
            </button>
          </div>
        </div>
      </div>

      {code.status === "paused" && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-900/25 px-3 py-2 text-xs font-semibold text-white">
          <PauseCircle className="mt-px h-4 w-4 shrink-0" />
          {dict.agent.codePaused}
        </p>
      )}
    </section>
  );
}
