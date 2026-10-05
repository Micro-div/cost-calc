"use client";

import { allCurrencies } from "@/constants";
import type { CurrencyCode } from "@/types";
import { Icon } from "./Icon";

interface CurrencySettingsModalProps {
  autoCurrency: boolean;
  manualCurrency: CurrencyCode;
  currencyOverride: CurrencyCode | null;
  effectiveCurrency: CurrencyCode;
  onAutoCurrencyChange: (value: boolean) => void;
  onManualCurrencyChange: (value: CurrencyCode) => void;
  onCurrencyOverrideChange: (value: CurrencyCode | null) => void;
  onClose: () => void;
  onReset: () => void;
}

export function CurrencySettingsModal({
  autoCurrency,
  manualCurrency,
  currencyOverride,
  effectiveCurrency,
  onAutoCurrencyChange,
  onManualCurrencyChange,
  onCurrencyOverrideChange,
  onClose,
  onReset,
}: CurrencySettingsModalProps) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#15131b]/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[24px] border border-white/60 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Currency settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-[#1d1b25]">
              Currency Settings
            </p>
            <p className="mt-0.5 text-xs text-[#777381]">
              Control how currency is selected for estimates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#e8e6ec] text-[#5f5c68] transition hover:bg-[#f5f4f7]"
            aria-label="Close settings"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-[#e8e5ed] bg-[#fcfbfd] p-4">
            <div>
              <p className="text-sm font-bold text-[#302d37]">
                Auto-detect currency
              </p>
              <p className="mt-0.5 text-xs leading-5 text-[#817d88]">
                Automatically select currency based on your browser location.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoCurrency}
              onClick={() => onAutoCurrencyChange(!autoCurrency)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                autoCurrency ? "bg-[#6754e7]" : "bg-[#d5d2dc]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  autoCurrency ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {autoCurrency && (
            <div className="rounded-2xl border border-[#e8e5ed] bg-[#fcfbfd] p-4">
              <p className="text-sm font-bold text-[#302d37]">
                Detected currency
              </p>
              <p className="mt-0.5 text-xs leading-5 text-[#817d88]">
                Based on your browser locale:{" "}
                <span className="font-bold text-[#6754e7]">
                  {effectiveCurrency}
                </span>
              </p>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-[#6b6773]">
                  Override detected currency
                  <select
                    value={currencyOverride ?? ""}
                    onChange={(e) =>
                      onCurrencyOverrideChange(
                        (e.target.value || null) as CurrencyCode | null,
                      )
                    }
                    className="mt-1.5 h-10 w-full appearance-none rounded-xl border border-[#dedbe4] bg-white px-3 text-sm font-semibold text-[#403c47] outline-none transition focus:border-[#7661e8] focus:ring-4 focus:ring-[#7661e8]/10"
                  >
                    <option value="">
                      Use detected ({effectiveCurrency})
                    </option>
                    {allCurrencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          {!autoCurrency && (
            <div className="rounded-2xl border border-[#e8e5ed] bg-[#fcfbfd] p-4">
              <p className="text-sm font-bold text-[#302d37]">
                Manual currency
              </p>
              <p className="mt-0.5 text-xs leading-5 text-[#817d88]">
                Choose a fixed currency for all estimates.
              </p>
              <select
                value={manualCurrency}
                onChange={(e) =>
                  onManualCurrencyChange(e.target.value as CurrencyCode)
                }
                className="mt-3 h-11 w-full appearance-none rounded-xl border border-[#dedbe4] bg-white px-3 text-sm font-semibold text-[#403c47] outline-none transition focus:border-[#7661e8] focus:ring-4 focus:ring-[#7661e8]/10"
              >
                {allCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-xl border border-[#ddd9e3] bg-white px-4 py-3 text-sm font-bold text-[#5c5864] transition hover:bg-[#f7f6f8]"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-[#6754e7] px-4 py-3 text-sm font-bold text-white shadow-[0_8px_22px_rgba(103,84,231,0.22)] transition hover:bg-[#5946d3]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
