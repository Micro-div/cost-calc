import { Icon } from "./Icon";

export function Toast({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#211e29] px-4 py-3 text-sm font-semibold text-white shadow-2xl"
      role="status"
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#4fc69b] text-[#153f31]">
        <Icon name="check" className="h-3 w-3" />
      </span>
      {message}
    </div>
  );
}
