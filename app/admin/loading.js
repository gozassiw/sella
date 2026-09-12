export default function AdminLoading() {
  return <main className="mx-auto max-w-[1240px] space-y-8 px-5 py-8 sm:px-8"><div className="h-12 w-80 animate-pulse rounded-xl bg-kola-light" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-3xl bg-white" />)}</div>{[1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-3xl bg-white" />)}</main>;
}
