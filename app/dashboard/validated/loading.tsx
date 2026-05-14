function SkeletonRow() {
  return (
    <div className="border-t border-slate-100 px-4 py-3.5 flex items-center gap-4">
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 w-28 bg-slate-100 rounded animate-pulse" />
        <div className="h-2 w-14 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
      <div className="h-2.5 w-48 bg-slate-100 rounded animate-pulse" />
      <div className="h-2.5 w-10 bg-slate-100 rounded animate-pulse" />
      <div className="h-2.5 w-20 bg-slate-100 rounded animate-pulse" />
    </div>
  )
}

export default function Loading() {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-3.5 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-2.5 w-52 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-6 w-20 bg-green-100 rounded-full animate-pulse" />
      </div>
      <div className="flex-1 p-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200 h-10" />
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    </div>
  )
}
