"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { SectionTag } from "@/components/home/SectionTag";
import { useLanguage } from "@/contexts/LanguageContext";

export function FAQSection() {
  const { dict } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = dict.faq.items;

  return (
    <section id="faq" className="scroll-mt-24 py-8 sm:py-12">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10 lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionTag align="left">{dict.faq.tag}</SectionTag>
          <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {dict.faq.title}
          </h2>
        </div>
        <ul className="space-y-2">
          {faqs.map((item, index) => {
            const open = openIndex === index;
            return (
              <li key={item.q}>
                <div
                  className={`cm-card overflow-hidden rounded-2xl transition-[border-color,box-shadow] duration-300 ${
                    open ? "!border-[var(--brand-blue)]/40 shadow-[var(--shadow-card-hover)]" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5 sm:py-4"
                    aria-expanded={open}
                    onClick={() => setOpenIndex(open ? null : index)}
                  >
                    <span className="flex-1 text-[15px] font-bold leading-snug text-slate-800 sm:text-base">
                      {item.q}
                    </span>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                        open
                          ? "rotate-180 bg-[var(--brand-blue)] text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {open ? (
                        <Minus className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </span>
                  </button>
                  {/* grid-rows trick animates height without measuring */}
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-4 pb-4 text-sm leading-relaxed text-slate-600 sm:px-5">
                        {item.a}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
