"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionTag } from "@/components/home/SectionTag";
import { useLanguage } from "@/contexts/LanguageContext";

export function CtaSection() {
  const { dict } = useLanguage();

  return (
    <section id="join" className="scroll-mt-24 px-4 pb-10 pt-4 sm:px-6 sm:pb-14 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-[#2D9FF6] shadow-[0_24px_60px_-28px_rgba(22,97,153,0.8)]">
        <Image
          src="/hero_banner.jpg"
          alt=""
          fill
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="pointer-events-none object-cover object-center"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-5 px-5 py-8 sm:px-10 sm:py-10 lg:flex-row lg:items-center lg:justify-between lg:px-14">
          <div className="max-w-xl">
            <SectionTag align="left" tone="dark">
              {dict.home.ctaTag}
            </SectionTag>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-4xl lg:leading-tight">
              {dict.home.ctaTitlePrefix}{" "}
              <span className="text-[#FFF307]">{dict.home.ctaTitleHighlight}</span>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/90 sm:text-base">
              {dict.home.ctaSubtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:flex sm:shrink-0 sm:gap-3">
            <Link
              href="/signup"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-extrabold text-[var(--color-primary-700)] shadow-[0_12px_28px_-8px_rgba(8,47,73,0.45)] transition active:scale-[0.98]"
            >
              {dict.home.createAccount}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/auctions"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/10 px-6 text-sm font-extrabold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-[0.98]"
            >
              {dict.home.browseAuctions}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
