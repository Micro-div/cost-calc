import type { IconName } from "@/types";
import { Icon } from "@/components/common/Icon";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-y border-[#e8e5ed] bg-white py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1200px] px-5 sm:px-7">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6b56d8]">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.045em] text-[#201d27] sm:text-4xl">
            From an idea to a clear estimate in three steps.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#77727e] sm:text-base">
            No spreadsheets, phone calls or confusing price lists. Just a more
            informed way to plan.
          </p>
        </div>
        <div className="relative mt-14 grid gap-5 md:grid-cols-3">
          <div className="process-line absolute left-[16%] right-[16%] top-7 hidden border-t border-dashed border-[#d9d3ee] md:block" />
          {[
            {
              icon: "sparkles" as IconName,
              number: "01",
              title: "Describe your project",
              text: "Write what you need in everyday language, or choose one of our service categories.",
            },
            {
              icon: "users" as IconName,
              number: "02",
              title: "Answer a few questions",
              text: "Confirm the project size, quality and location so the estimate can be more accurate.",
            },
            {
              icon: "file-text" as IconName,
              number: "03",
              title: "Get costs and a quote",
              text: "Review the full breakdown, scope and timeline, then create a client-ready quotation.",
            },
          ].map((step) => (
            <div
              key={step.number}
              className="relative rounded-[22px] border border-[#e8e5ed] bg-[#fbfafc] p-6 text-center"
            >
              <span className="relative z-10 mx-auto grid h-14 w-14 place-items-center rounded-2xl border-4 border-white bg-[#eeeaff] text-[#6651d3] shadow-[0_8px_20px_rgba(83,67,169,0.12)]">
                <Icon name={step.icon} className="h-6 w-6" />
              </span>
              <p className="mt-5 text-[11px] font-bold tracking-[0.16em] text-[#918b9b]">
                STEP {step.number}
              </p>
              <h3 className="mt-2 text-lg font-bold tracking-[-0.03em] text-[#302c37]">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#7b7682]">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
