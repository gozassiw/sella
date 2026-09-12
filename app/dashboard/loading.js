export default function DashboardLoading() {
  return <div className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-6 lg:px-10"><div className="h-8 w-56 animate-pulse rounded-xl bg-kola-light" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-3xl bg-white" />)}</div><div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><div className="h-72 animate-pulse rounded-3xl bg-white" /><div className="h-72 animate-pulse rounded-3xl bg-white" /></div></div>;
}
