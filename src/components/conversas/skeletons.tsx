// Skeletons de loading das três colunas (Entrega 4).

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-mk-superficie-2 ${className}`} />;
}

export function InboxSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-mk-linha/50 px-6 py-3"
        >
          <Sk className="h-11 w-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Sk className="h-3 w-1/2" />
            <Sk className="h-2.5 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-8 py-6">
      <Sk className="h-10 w-2/5 self-start rounded-[16px]" />
      <Sk className="h-14 w-1/2 self-end rounded-[16px]" />
      <Sk className="h-8 w-1/3 self-start rounded-[16px]" />
      <Sk className="h-12 w-2/5 self-end rounded-[16px]" />
      <Sk className="h-9 w-1/4 self-start rounded-[16px]" />
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Sk className="h-14 w-14 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Sk className="h-4 w-2/3" />
          <Sk className="h-3 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Sk className="h-16" />
        <Sk className="h-16" />
      </div>
      <Sk className="h-20" />
      <Sk className="h-24" />
    </div>
  );
}
