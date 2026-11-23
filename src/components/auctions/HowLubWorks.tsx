"use client";

import { CircleDollarSign, Target, Trophy } from "lucide-react";
import { SectionTag } from "@/components/home/SectionTag";
import { useLanguage } from "@/contexts/LanguageContext";

export function HowLubWorks() {
  const { dict } = useLanguage();

  const steps = [
    {
      icon: CircleDollarSign,
      title: dict.howItWorks.step1Title,
      body: dict.howItWorks.step1Desc,
    },
    {
      icon: Target,
      title: dict.howItWorks.step2Title,
      body: dict.howItWorks.step2Desc,
    },
    {
      icon: Trophy,
      title: dict.howItWorks.step3Title,
      body: dict.howItWorks.step3Desc,
    },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-24 py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="cm-brand-panel relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_24px_60px_-28px_rgba(22,97,153,0.8)] sm:p-8 lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)] lg:items-center lg:gap-10">
            <div>
              <SectionTag align="left" tone="dark">
                {dict.howItWorks.tag}
              </SectionTag>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                {dict.howItWorks.title}
              </h2>
              <p className="mt-2 text-sm font-medium text-white/85 sm:text-base">
                {dict.howItWorks.subtitle}
              </p>
            </div>
            <ol className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  className="group relative overflow-hidden rounded-2xl bg-white p-4 text-slate-900 shadow-sm transition-transform duration-300 hover:-translate-y-1 sm:p-5"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-2 -top-5 select-none text-[5.5rem] font-extrabold leading-none text-slate-100 transition-colors duration-300 group-hover:text-[var(--color-primary-100)]"
                  >
                    {i + 1}
                  </span>
                  <div className="relative flex items-center gap-2.5 sm:block">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-yellow)] text-slate-900 shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)] sm:mb-3">
                      <step.icon className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="text-base font-extrabold leading-tight sm:text-lg">
                      <span className="sr-only">
                        {dict.common.step} {i + 1}:{" "}
                      </span>
                      {step.title}
                    </h3>
                  </div>
                  <p className="relative mt-2 text-sm leading-relaxed text-slate-600">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
