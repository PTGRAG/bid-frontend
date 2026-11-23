/**
 * Small eyebrow label shown above a section title (brand yellow diamond + blue caps).
 * Kept compact so sections start with content, not a big empty badge.
 */
export function SectionTag({
  children,
  align = "center",
  tone = "light",
}: {
  children: string;
  align?: "center" | "left";
  tone?: "light" | "dark";
}) {
  const isEthiopic = /[\u1200-\u137F]/.test(children);

  return (
    <div className={align === "center" ? "flex justify-center" : "flex"}>
      <p
        className={`cm-eyebrow ${isEthiopic ? "!tracking-normal" : ""} ${
          tone === "dark" ? "!text-white" : ""
        }`}
      >
        {children}
      </p>
    </div>
  );
}
