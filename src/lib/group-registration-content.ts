import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-metadata";

export type RegistrationPageConfig = {
  slug: string;
  path: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  summary: string;
  heroImage: string;
  heroAlt: string;
  submitLabel: string;
};

export const registrationPages: RegistrationPageConfig[] = [
  {
    slug: "cadastro-de-grupo-terceira-idade",
    path: "/cadastro-de-grupo-terceira-idade",
    title: "Melhor Idade & Grupos Mistos",
    seoTitle: "Cadastro de Grupo Terceira Idade | Estancia",
    seoDescription:
      "Preencha o cadastro de grupo para melhor idade e grupos mistos no Estancia.",
    summary:
      "Preencha os dados do grupo e do coordenador para solicitar orcamento e iniciar o cadastro da sua visita com atendimento consultivo.",
    heroImage: "/photos/melhor-idade.jpg",
    heroAlt: "Grupo da melhor idade no Estancia",
    submitLabel: "Solicitar orcamento e cadastrar grupo",
  },
  {
    slug: "grupo-igreja",
    path: "/grupo-igreja",
    title: "Grupo Igreja",
    seoTitle: "Grupo Igreja | Estancia",
    seoDescription: "Preencha o cadastro de grupo para igrejas, retiros e encontros no Estancia.",
    summary:
      "Use este formulario para solicitar orcamento, informar a necessidade do grupo e agilizar o atendimento comercial para encontros de igreja.",
    heroImage: "/photos/igreja.jpg",
    heroAlt: "Grupo de igreja no Estancia",
    submitLabel: "Solicitar orcamento e cadastrar grupo",
  },
  {
    slug: "grupo-escola",
    path: "/grupo-escola",
    title: "Grupo Escola",
    seoTitle: "Grupo Escola | Estancia",
    seoDescription:
      "Preencha o cadastro de grupo para escolas e passeios estudantis no Estancia.",
    summary:
      "Preencha os dados da escola e do coordenador para solicitar orcamento e organizar a visita escolar com o time comercial.",
    heroImage: "/photos/escola.jpg",
    heroAlt: "Grupo escolar no Estancia",
    submitLabel: "Solicitar orcamento e cadastrar grupo",
  },
  {
    slug: "grupo-ongs",
    path: "/grupo-ongs",
    title: "Grupo ONGs",
    seoTitle: "Grupo ONGs | Estancia",
    seoDescription: "Preencha o cadastro de grupo para ONGs no Estancia.",
    summary:
      "Envie os dados do grupo e do coordenador para que o atendimento consultivo possa montar a melhor proposta para a ONG.",
    heroImage: "/photos/escola.jpg",
    heroAlt: "Grupo social no Estancia",
    submitLabel: "Solicitar orcamento e cadastrar grupo",
  },
  {
    slug: "grupo-confraternizacao",
    path: "/grupo-confraternizacao",
    title: "Grupo Confraternizacao",
    seoTitle: "Grupo Confraternizacao | Estancia",
    seoDescription:
      "Preencha o cadastro de grupo para confraternizacoes corporativas no Estancia.",
    summary:
      "Informe os dados da empresa e do coordenador para solicitar orcamento e iniciar o planejamento da confraternizacao com o time comercial.",
    heroImage: "/photos/confraternizacao.jpg",
    heroAlt: "Confraternizacao corporativa no Estancia",
    submitLabel: "Solicitar orcamento e cadastrar grupo",
  },
];

export function getRegistrationPage(slug: string) {
  const page = registrationPages.find((item) => item.slug === slug);

  if (!page) {
    throw new Error(`Unknown registration page: ${slug}`);
  }

  return page;
}

export function buildRegistrationMetadata(slug: string): Metadata {
  const page = getRegistrationPage(slug);
  const siteUrl = getSiteUrl();

  return {
    title: `${page.title} - Estancia`,
    description: page.seoDescription,
    alternates: {
      canonical: page.path,
    },
    openGraph: {
      title: page.seoTitle,
      description: page.seoDescription,
      url: page.path,
      siteName: "Estancia",
      type: "website",
      images: [
        {
          url: `${siteUrl}${page.heroImage}`,
          alt: page.heroAlt,
        },
      ],
    },
  };
}
