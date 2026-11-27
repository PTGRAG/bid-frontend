/**
 * Label shown above a section title: blue caps in a white box with a yellow
 * bar on the right (the tag style from before the 2026 UI refresh, sized to
 * sit above a heading).
 */
export function SectionTag({
  children,
  align = "center",
}: {
  children: string;
  align?: "center" | "left";
  /** Kept for callers on dark panels; the white box reads on both. */
  tone?: "light" | "dark";
}) {
  const isEthiopic = /[ሀ-፿]/.test(children);

  return (
    <div className={`mb-2 flex max-w-full ${align === "center" ? "justify-center" : ""}`}>
      <div className="relative inline-flex max-w-full items-center">
        <div className="relative z-10 max-w-full rounded-lg bg-white px-3.5 py-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:px-4">
          <p
            className={`whitespace-nowrap text-xs font-extrabold uppercase text-[#2D9FF6] sm:text-sm ${
              isEthiopic ? "tracking-normal" : "tracking-widest"
            }`}
          >
            {children}
          </p>
        </div>
        <span
          className="absolute -right-1.5 top-1/2 h-[65%] w-2 -translate-y-1/2 rounded-[3px] bg-[#FFF307]"
          aria-hidden
        />
      </div>
    </div>
  );
}
