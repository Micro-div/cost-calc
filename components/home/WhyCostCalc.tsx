"use client";

import { scrollToSection } from "@/lib";
import type { IconName } from "@/types";
import { Icon } from "@/components/common/Icon";

interface WhyCostCalcProps {
  onEstimateClick: () => void;
}

export function WhyCostCalc({ onEstimateClick }: WhyCostCalcProps) {
  return (
    <section
      id="why-costcalc"
      className="scroll-mt-16 bg-[#f8f8fb] py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 sm:px-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6b56d8]">
            More than a number
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.045em] text-[#201d27] sm:text-4xl">
            Understand the investment before you hire anyone.
          </h2>
          <p className="mt-5 text-base leading-7 text-[#746f7b]">
            CostCalc turns a simple project description into a structured
            estimate that makes sense to customers, freelancers and small
            businesses.
          </p>
          <button
            type="button"
            onClick={onEstimateClick}
            className="group mt-7 flex items-center gap-2 rounded-xl bg-[#211e29] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#35313e]"
          >
            Create my free estimate
            <Icon
              name="arrow-right"
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: "globe" as IconName,
              title: "Localized pricing",
              text: "Costs adapt to the selected country, city, currency and local market conditions.",
              color: "bg-[#eeeaff] text-[#6651d3]",
            },
            {
              icon: "calculator" as IconName,
              title: "Transparent numbers",
              text: "See labour, tools, contingency, taxes and every other included cost.",
              color: "bg-[#e8f8f1] text-[#258764]",
            },
            {
              icon: "file-text" as IconName,
              title: "Ready-to-send quotes",
              text: "Edit line items and turn your estimate into a professional PDF quotation.",
              color: "bg-[#fff3df] text-[#a86b18]",
            },
            {
              icon: "shield" as IconName,
              title: "Confidence included",
              text: "Know how complete the input is and where professional review may still be needed.",
              color: "bg-[#eaf2ff] text-[#376bb4]",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-[22px] border border-[#e7e4eb] bg-white p-5 sm:p-6"
            >
              <span
                className={`grid h-11 w-11 place-items-center rounded-2xl ${feature.color}`}
              >
                <Icon name={feature.icon} />
              </span>
              <h3 className="mt-5 text-base font-bold text-[#312d38]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#7d7884]">
                {feature.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
