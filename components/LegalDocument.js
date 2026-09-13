import Link from "next/link";

export default function LegalDocument({ audience, title, lastUpdated = "13 September 2026", intro, sections, relatedHref, relatedLabel }) {
  return (
    <main className="min-h-screen bg-surface px-5 py-10 sm:px-8">
      <article className="mx-auto max-w-3xl app-card p-6 sm:p-10">
        <Link href="/" className="text-sm font-extrabold text-kola">Sella</Link>
        <p className="eyebrow mt-10 text-kola">{audience} legal document</p>
        <h1 className="display mt-3 text-4xl">{title}</h1>
        <p className="mt-4 text-sm text-muted">Last updated: {lastUpdated}</p>
        {intro && <p className="mt-8 text-sm leading-7 text-muted">{intro}</p>}
        <div className="prose prose-sm mt-8 max-w-none text-muted">
          {sections.map(({ heading, body }) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
        </div>
        {relatedHref && <Link href={relatedHref} className="mt-8 inline-flex font-bold text-kola">{relatedLabel} →</Link>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-kola">
          <Link href={audience === "Buyer" ? "/buyer-terms" : "/seller-terms"}>Read {audience.toLowerCase()} terms</Link>
          <Link href={audience === "Buyer" ? "/buyer-privacy" : "/seller-privacy"}>Read {audience.toLowerCase()} privacy policy</Link>
        </div>
      </article>
    </main>
  );
}
