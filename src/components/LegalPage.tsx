import { LEGAL } from "@/lib/legal";

export type LegalSection = { title: string; paragraphs: React.ReactNode[] };

export function MailLink() {
  return (
    <a
      href={`mailto:${LEGAL.contactEmail}`}
      className="text-gold-600 underline-offset-2 hover:underline"
    >
      {LEGAL.contactEmail}
    </a>
  );
}

export function SiteLink() {
  return (
    <a
      href={LEGAL.siteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-gold-600 underline-offset-2 hover:underline"
    >
      {LEGAL.siteUrl}
    </a>
  );
}

export default function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <article className="glass-strong mx-auto max-w-3xl rounded-2xl px-6 py-8 shadow-glass sm:px-10 sm:py-10">
      <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-ink-500">
        {title} – {LEGAL.appName} · Última atualização: {LEGAL.lastUpdated}
      </p>

      <p className="mt-6 leading-relaxed text-ink-700">{intro}</p>

      <div className="mt-8 space-y-7">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-ink-900">{section.title}</h2>
            <div className="mt-2 space-y-2">
              {section.paragraphs.map((paragraph, i) => (
                <p key={i} className="leading-relaxed text-ink-700">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
