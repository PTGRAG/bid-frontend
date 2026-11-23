"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings, ShieldCheck, Menu, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { isStaffRole } from "@/services/auth.service";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";

export const Navbar = () => {
  const { user, loading, logout } = useAuth();
  const { dict } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    router.push("/");
  };

  const navLinks = [
    { label: dict.nav.auctions, href: "/auctions" },
    ...(user
      ? [{ label: dict.nav.myAuctions, href: "/my-auctions" }]
      : []),
    { label: dict.nav.howItWorks, href: "/#how-it-works" },
    { label: dict.nav.winners, href: "/#winners" },
    { label: dict.nav.faq, href: "/#faq" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-2 sm:px-6 sm:pt-3">
      <nav className="mx-auto flex h-14 max-w-7xl items-center gap-2 rounded-2xl border border-white/70 bg-white/85 px-2 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 sm:h-16 sm:gap-4 sm:rounded-full sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link href="/" className="flex shrink-0 items-center">
            <Image
              src="/logo.png"
              alt="CarraMarket"
              width={160}
              height={50}
              className="h-8 w-auto object-contain sm:h-9"
              priority
            />
          </Link>
        </div>

        <div className="hidden flex-1 items-center justify-center gap-1 md:flex lg:gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex h-9 items-center rounded-full px-3.5 text-sm font-bold transition-colors duration-200 ${
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] font-extrabold"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <LanguageSwitcher variant="pill" className="hidden h-10 sm:inline-flex" />

          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <NotificationBell />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                      className="inline-flex h-10 max-w-[min(100vw-8rem,220px)] items-center gap-2 rounded-full border border-slate-200 bg-white px-1 text-sm font-bold text-slate-700 transition-colors hover:border-[var(--brand-blue)]/40 sm:pl-1 sm:pr-3"
                    >
                      {user.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.picture}
                          className="h-8 w-8 shrink-0 rounded-full"
                          alt=""
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-blue)] to-[var(--color-primary-700)] font-extrabold text-white">
                          {user.fullName?.charAt(0)?.toUpperCase() ||
                            user.email?.charAt(0)?.toUpperCase()}
                        </span>
                      )}
                      <span className="hidden max-w-[120px] truncate sm:inline">
                        {user.fullName || user.email}
                      </span>
                    </button>

                    {accountMenuOpen && (
                      <div className="cm-rise absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.25)]">
                        {isStaffRole(user.role) && (
                          <Link
                            href="/staffpanel"
                            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]"
                            onClick={() => setAccountMenuOpen(false)}
                          >
                            <ShieldCheck className="h-4 w-4" /> {dict.nav.staffPanel}
                          </Link>
                        )}
                        <Link
                          href="/account"
                          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                          onClick={() => setAccountMenuOpen(false)}
                        >
                          <Settings className="h-4 w-4" /> {dict.nav.accountSettings}
                        </Link>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" /> {dict.nav.signOut}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  <Link
                    href="/signup"
                    className="btn-shine inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full bg-[var(--brand-blue)] px-3.5 text-sm font-extrabold text-white shadow-[var(--shadow-glow)] transition-all hover:-translate-y-px hover:bg-[var(--color-primary-600)] active:scale-[0.97] sm:h-10 sm:px-5"
                  >
                    {dict.nav.signup}
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 text-sm font-extrabold text-slate-900 transition-all hover:-translate-y-px hover:border-slate-300 active:scale-[0.97] sm:h-10 sm:px-5"
                  >
                    {dict.nav.login}
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </nav>

      <div
        className={`mx-auto mt-2 max-w-7xl overflow-hidden rounded-2xl bg-white/95 backdrop-blur-xl shadow-xl transition-all duration-300 ease-in-out md:hidden ${
          mobileMenuOpen
            ? "max-h-[85vh] border border-slate-200 py-4 opacity-100"
            : "max-h-0 py-0 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-1 px-4">
          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-3 pt-1">
            <span className="text-xs font-bold text-slate-500">{dict.nav.language}:</span>
            <LanguageSwitcher variant="pill" />
          </div>

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-4 py-3 text-base font-bold transition-colors active:bg-slate-100 ${
                pathname === link.href
                  ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
};
