"use client";

import { Icon } from "@/components/common/Icon";
import { Brand } from "./Brand";

interface HeaderProps {
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
  onOpenSettings: () => void;
  onEstimateClick: () => void;
}

// Mobile-only logo size (screens under 640px). Change 0.75 to resize:
// 0.65 = smaller, 0.85 = bigger. Tablet and desktop are not affected.
const headerCss = `
@media (max-width: 639px) {
  .header-logo { zoom: 0.75; }
}
`;

export function Header({
  mobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
  onOpenSettings,
  onEstimateClick,
}: HeaderProps) {
  return (
    <header className="relative z-50 border-b border-[#e9e7ed]/90 bg-white/90 backdrop-blur-xl">
      <style>{headerCss}</style>
      <nav
        className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-5 sm:px-7"
        aria-label="Main navigation"
      >
        <div className="header-logo">
          <Brand />
        </div>
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#services"
            className="text-sm font-medium text-[#65616d] transition hover:text-[#26232d]"
          >
            Services
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-medium text-[#65616d] transition hover:text-[#26232d]"
          >
            How it works
          </a>
          <a
            href="#why-costcalc"
            className="text-sm font-medium text-[#65616d] transition hover:text-[#26232d]"
          >
            Why CostCalc
          </a>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={onOpenSettings}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#e5e2e9] text-[#393541] transition hover:bg-[#f5f4f7]"
            aria-label="Currency settings"
            title="Currency settings"
          >
            <Icon name="globe" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEstimateClick}
            className="flex items-center gap-2 rounded-xl bg-[#313131] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#5b5b5c]"
          >
            Estimate my project
            <Icon name="arrow-right" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={onOpenSettings}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#e5e2e9] text-[#393541]"
            aria-label="Currency settings"
          >
            <Icon name="globe" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#e5e2e9] text-[#393541]"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation"
          >
            <Icon name={mobileMenuOpen ? "close" : "menu"} />
          </button>
        </div>
      </nav>
      {mobileMenuOpen && (
        <div className="border-t border-[#ece9ef] bg-white px-5 py-4 md:hidden">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-1">
            {[
              ["Services", "services"],
              ["How it works", "how-it-works"],
              ["Why CostCalc", "why-costcalc"],
            ].map(([label, id]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={onCloseMobileMenu}
                className="rounded-xl px-3 py-3 text-sm font-semibold text-[#4c4854] hover:bg-[#f6f5f8]"
              >
                {label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                onCloseMobileMenu();
                onEstimateClick();
              }}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#1d1a25] px-4 py-3 text-sm font-bold text-white"
            >
              Estimate my project
              <Icon name="arrow-right" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}