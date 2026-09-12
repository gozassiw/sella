export default function OnboardingLoading() {
  return <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6"><div className="h-5 w-40 animate-pulse rounded-lg bg-kola-light" /><div className="h-12 w-80 animate-pulse rounded-xl bg-white" /><div className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl bg-white" />)}</div><div className="h-48 animate-pulse rounded-3xl bg-white" /></div>;
}
