import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso — NativeAPI",
  description:
    "Termos de uso do aplicativo NativeAPI e dos serviços de integração com a API do WhatsApp Business.",
};

const SECTIONS: { title: string; paragraphs: React.ReactNode[] }[] = [
  {
    title: "1. Aceitação",
    paragraphs: [
      "Ao utilizar o NativeAPI, você concorda com estes Termos. Caso não concorde, não utilize o serviço.",
    ],
  },
  {
    title: "2. Escopo dos serviços",
    paragraphs: [
      "Integração com a API oficial do WhatsApp Business.",
      "O usuário deve possuir conta de WhatsApp Business válida e respeitar as Políticas da Meta.",
      "O uso indevido poderá resultar na suspensão do serviço.",
    ],
  },
  {
    title: "3. Obrigações do usuário",
    paragraphs: [
      "Fornecer informações verdadeiras e atualizadas.",
      "Não usar o serviço para spam, fraude ou atividades ilegais.",
      "Respeitar as políticas de uso do WhatsApp Business.",
    ],
  },
  {
    title: "4. Limitações de responsabilidade",
    paragraphs: [
      "Não garantimos disponibilidade ininterrupta do serviço, pois dependemos da infraestrutura da Meta.",
      "Não nos responsabilizamos por danos indiretos ou uso indevido do serviço pelos usuários.",
    ],
  },
  {
    title: "5. Alterações",
    paragraphs: [
      "Os Termos poderão ser atualizados a qualquer momento. A versão mais recente estará sempre publicada em nosso site.",
    ],
  },
  {
    title: "6. Contato",
    paragraphs: [
      <>
        📧 E-mail:{" "}
        <a
          href="mailto:pvlservicos@gmail.com"
          className="text-gold-600 underline-offset-2 hover:underline"
        >
          pvlservicos@gmail.com
        </a>
      </>,
      <>
        🌐 Site:{" "}
        <a
          href="https://pedrovictorweb.com.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-600 underline-offset-2 hover:underline"
        >
          https://pedrovictorweb.com.br
        </a>
      </>,
    ],
  },
];

export default function TermosDeUsoPage() {
  return (
    <article className="glass-strong mx-auto max-w-3xl rounded-2xl px-6 py-8 shadow-glass sm:px-10 sm:py-10">
      <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
        Termos de Uso
      </h1>
      <p className="mt-2 text-sm text-ink-500">Termos de Uso – NativeAPI</p>

      <p className="mt-6 leading-relaxed text-ink-700">
        Estes Termos regulam o uso do aplicativo NativeAPI e dos serviços de integração com a API do
        WhatsApp Business.
      </p>

      <div className="mt-8 space-y-7">
        {SECTIONS.map((section) => (
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
