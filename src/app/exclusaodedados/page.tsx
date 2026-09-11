import type { Metadata } from "next";
import LegalPage, { MailLink, SiteLink, type LegalSection } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Exclusão de Dados — ${LEGAL.appName}`,
  description: `Como solicitar a exclusão dos seus dados do ${LEGAL.appName}.`,
};

const SECTIONS: LegalSection[] = [
  {
    title: "1. Como solicitar a exclusão",
    paragraphs: [
      <>
        Envie um e-mail para <MailLink /> com o assunto &quot;Exclusão de dados&quot;, informando o
        nome de usuário do Instagram ou o nome da Página do Facebook conectada ao aplicativo.
      </>,
      "Não é necessário justificar o pedido. Se preciso, podemos pedir uma confirmação para garantir que a solicitação partiu do titular da conta.",
    ],
  },
  {
    title: "2. Remover o aplicativo pelo Facebook ou Instagram",
    paragraphs: [
      "Você também pode revogar o acesso do aplicativo aos seus dados a qualquer momento:",
      "• Facebook: Configurações e privacidade → Configurações → Apps e sites → selecione o aplicativo → Remover.",
      "• Instagram: Configurações e atividade → Permissões do site → Apps e sites → selecione o aplicativo → Remover.",
      "Depois de removido, o aplicativo deixa de acessar novos dados da sua conta. Para apagar também o que já foi armazenado, faça o pedido por e-mail, como descrito no item 1.",
    ],
  },
  {
    title: "3. O que é excluído",
    paragraphs: [
      "• Dados do perfil obtidos da Meta (ID, nome de usuário, nome, biografia e números da conta).",
      "• Vídeos, miniaturas, legendas, links e métricas importados, inclusive cópias armazenadas.",
      "• Roteiros, resumos e análises de inteligência artificial ligados à sua conta.",
      "• Tokens de acesso às APIs da Meta.",
      "Registros técnicos que a lei nos obrigue a guardar são mantidos apenas pelo prazo legal e depois apagados.",
    ],
  },
  {
    title: "4. Prazo",
    paragraphs: [
      "A exclusão é concluída em até 30 dias após o recebimento do pedido. Você recebe uma confirmação por e-mail quando ela for concluída.",
    ],
  },
  {
    title: "5. Contato",
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

export default function ExclusaoDeDadosPage() {
  return (
    <LegalPage
      title="Exclusão de Dados"
      intro={`Você pode pedir a exclusão de todos os dados que o ${LEGAL.appName} obteve da sua conta do Facebook ou do Instagram, a qualquer momento e sem custo.`}
      sections={SECTIONS}
    />
  );
}
