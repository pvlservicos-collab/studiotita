import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { MailLink, SiteLink, type LegalSection } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Política de Privacidade — ${LEGAL.appName}`,
  description: `Como o ${LEGAL.appName} coleta, usa, armazena e protege os seus dados.`,
};

const SECTIONS: LegalSection[] = [
  {
    title: "1. Quem somos",
    paragraphs: [
      <>
        O {LEGAL.appName} é operado por Pedro Victor (<SiteLink />), responsável pelo tratamento dos
        dados descritos nesta Política, nos termos da Lei Geral de Proteção de Dados (Lei nº
        13.709/2018 – LGPD).
      </>,
    ],
  },
  {
    title: "2. Dados que coletamos",
    paragraphs: [
      "Quando você conecta sua conta profissional do Instagram (e a Página do Facebook vinculada) ao aplicativo, acessamos, por meio das APIs oficiais da Meta e somente com a sua autorização:",
      "• Dados do perfil: ID da conta, nome de usuário, nome, biografia, número de seguidores, de contas seguidas e de publicações.",
      "• Conteúdo publicado: vídeos, reels e imagens, com legenda, miniatura, link permanente e data de publicação.",
      "• Métricas (insights): visualizações, alcance, curtidas, comentários, compartilhamentos, salvamentos, visitas ao perfil e cliques no site.",
      "• Dados que você cadastra no aplicativo, como roteiros, títulos e anotações.",
      "• Registros técnicos de uso (data, hora e ação realizada), para segurança e auditoria.",
      "Não coletamos senhas do Facebook ou do Instagram, não acessamos mensagens privadas e não coletamos dados de pagamento.",
    ],
  },
  {
    title: "3. Como usamos os dados",
    paragraphs: [
      "• Exibir seus vídeos, métricas e roteiros no painel do aplicativo.",
      "• Gerar resumos e análises de padrões dos seus vídeos com inteligência artificial.",
      "• Permitir que ferramentas autorizadas por você (como o Claude Code) consultem e organizem esse conteúdo.",
      "• Manter a segurança, corrigir erros e cumprir obrigações legais.",
      "Não vendemos seus dados, não os usamos para publicidade e não traçamos perfis de terceiros.",
    ],
  },
  {
    title: "4. Compartilhamento",
    paragraphs: [
      "Os dados são compartilhados apenas com os provedores necessários para o funcionamento do serviço, que os tratam em nosso nome:",
      "• Meta Platforms (Facebook e Instagram): origem dos dados, via APIs oficiais.",
      "• Google (Gemini API): recebe os vídeos que você escolher analisar, apenas para gerar a análise.",
      "• Vercel e Neon: hospedagem do aplicativo e armazenamento do banco de dados.",
      "Também podemos compartilhar dados quando exigido por lei ou por ordem de autoridade competente.",
    ],
  },
  {
    title: "5. Armazenamento e segurança",
    paragraphs: [
      "Os dados ficam em servidores com conexão criptografada (HTTPS/TLS) e acesso restrito por chaves de acesso. Mantemos os dados enquanto sua conta estiver conectada ao aplicativo ou enquanto forem necessários para prestar o serviço. Após o pedido de exclusão, eles são apagados conforme a nossa Política de Exclusão de Dados.",
    ],
  },
  {
    title: "6. Seus direitos",
    paragraphs: [
      "Pela LGPD, você pode, a qualquer momento, pedir confirmação do tratamento, acesso, correção, portabilidade e exclusão dos seus dados, além de revogar o consentimento dado.",
      <>
        Para excluir seus dados, siga as instruções da nossa{" "}
        <Link
          href="/exclusaodedados"
          className="text-gold-600 underline-offset-2 hover:underline"
        >
          Política de Exclusão de Dados
        </Link>
        . Você também pode remover o acesso do aplicativo a qualquer momento nas configurações do
        Facebook ou do Instagram, em &quot;Apps e sites&quot;.
      </>,
    ],
  },
  {
    title: "7. Alterações",
    paragraphs: [
      "Esta Política pode ser atualizada. A versão mais recente estará sempre publicada nesta página, com a data da última atualização.",
    ],
  },
  {
    title: "8. Contato",
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

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      intro={`Esta Política explica como o ${LEGAL.appName} coleta, usa, armazena e protege os dados obtidos por meio das APIs da Meta (Facebook e Instagram) e dos demais serviços integrados.`}
      sections={SECTIONS}
    />
  );
}
