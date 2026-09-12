export default function AccountLoading() {
  return <div className="mx-auto max-w-[1120px] space-y-6 px-4 py-6 sm:px-6"><div className="h-6 w-32 animate-pulse rounded-lg bg-kola-light" /><div className="h-12 w-64 animate-pulse rounded-xl bg-white" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-40 animate-pulse rounded-3xl bg-white" />)}</div><div className="grid grid-cols-2 gap-4">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="aspect-[4/5] animate-pulse rounded-[22px] bg-white" />)}</div></div>;
}
