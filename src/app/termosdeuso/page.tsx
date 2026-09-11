import type { Metadata } from "next";
import LegalPage, { MailLink, SiteLink, type LegalSection } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Termos de Uso — ${LEGAL.appName}`,
  description: `Termos de uso do aplicativo ${LEGAL.appName} e dos serviços de integração com a API do WhatsApp Business.`,
};

const SECTIONS: LegalSection[] = [
  {
    title: "1. Aceitação",
    paragraphs: [
      `Ao utilizar o ${LEGAL.appName}, você concorda com estes Termos. Caso não concorde, não utilize o serviço.`,
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
        📧 E-mail: <MailLink />
      </>,
      <>
        🌐 Site: <SiteLink />
      </>,
    ],
  },
];

export default function TermosDeUsoPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      intro={`Estes Termos regulam o uso do aplicativo ${LEGAL.appName} e dos serviços de integração com a API do WhatsApp Business.`}
      sections={SECTIONS}
    />
  );
}
