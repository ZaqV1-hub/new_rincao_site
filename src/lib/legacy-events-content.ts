import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-metadata";

export type LegacyEventSection = {
  title: string;
  items?: string[];
  paragraphs?: string[];
  note?: string;
};

export type LegacyEvent = {
  slug: string;
  path: string;
  title: string;
  seoDescription: string;
  heroImage: string;
  heroAlt: string;
  summary: string;
  highlights: string[];
  primaryCta?: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  sections: LegacyEventSection[];
};

export const legacyEvents: LegacyEvent[] = [
  {
    slug: "festa-julina-25-07-2026-sabado",
    path: "/evento/festa-julina-25-07-2026-sabado",
    title: "Festa Julina 25-07-2026 - Sabado",
    seoDescription:
      "Pagina legada da Festa Julina de 25 de julho de 2026, preservada no novo institucional para manter as URLs historicas do Estancia.",
    heroImage: "/hero/current/banner-25-07-2026.png",
    heroAlt: "Banner da Festa Julina de 25 de julho de 2026",
    summary:
      "Versao arquivada da pagina institucional do evento de 25 de julho de 2026, com as informacoes principais de ingressos, funcionamento e orientacoes ao visitante.",
    highlights: [
      "1o lote R$ 35,00, 2o lote R$ 40,00, 3o lote R$ 45,00 e valor no dia R$ 80,00.",
      "Entrada gratuita a partir das 18h com agendamento obrigatorio no formulario divulgado pelo clube.",
      "Piscinas, trilha, quadras e outras atividades de lazer mantidas no passaporte do evento.",
    ],
    secondaryCta: {
      label: "Agendamento gratuito apos 18h",
      href: "https://docs.google.com/forms/d/e/1FAIpQLSdC8SeEdKUra1GMZB04-yVtGJF8ySL2Z_glfUxfm90R4IEjUA/viewform?usp=publish-editor",
    },
    sections: [
      {
        title: "Ingressos Limitados",
        items: [
          "Vendas dos ingressos feita exclusivamente pelo site e representantes autorizados.",
          "1o lote - R$ 35,00.",
          "2o lote - R$ 40,00.",
          "3o lote - R$ 45,00.",
          "No dia - R$ 80,00.",
          "Estacionamento para moto e carro - R$ 20,00, cobranca no local.",
        ],
      },
      {
        title: "Atividades incluidas no passaporte",
        items: [
          "Piscina de ondas e piscinas tradicionais.",
          "Passeio a mini-fazendinha.",
          "Quadra poliesportiva e campo de futebol society.",
          "Ponte que balanca, trilha ecologica e salao de jogos.",
          "Vestiarios masculino e feminino com sanitarios e duchas.",
        ],
      },
      {
        title: "Atividades com cobranca a parte",
        items: [
          "Parque de diversoes.",
          "Tirolesa.",
          "Arvorismo.",
          "Passeio de trenzinho.",
        ],
      },
      {
        title: "Orientacoes importantes",
        items: [
          "Somente 1 responsavel deve validar os ingressos.",
          "Ingressos comprados pelo site devem ser apresentados no celular.",
          "Entrada gratuita a partir das 18h exige agendamento previo.",
        ],
      },
      {
        title: "Bilheteria no dia do evento",
        items: [
          "Acima de 10 anos - R$ 80,00.",
          "De 04 a 09 anos - R$ 60,00.",
          "Ate 03 anos - isento.",
        ],
      },
      {
        title: "Duvidas Frequentes",
        items: [
          "Comidas e bebidas nao estao inclusas no valor do passaporte.",
          "As piscinas ficam disponiveis ate as 17h.",
          "Horario da festa das 10h as 22h, com entrada gratuita a partir das 18h.",
          "E proibida a entrada de comidas e bebidas.",
          "O ingresso vale somente para o dia da festa.",
        ],
      },
      {
        title: "Estrutura Disponivel",
        items: [
          "Estacionamento.",
          "Sanitarios.",
          "Lanchonete.",
          "Enfermaria.",
          "Lojinhas.",
          "Restaurante com valor por quilo e prato feito.",
          "Toda a area externa para passeio.",
        ],
      },
      {
        title: "Ponto de Venda Autorizado",
        paragraphs: ["Aguardando atualizacao, conforme informado na pagina original do evento."],
      },
    ],
  },
  {
    slug: "festa-julina-14-06-2026",
    path: "/evento/festa-julina-14-06-2026",
    title: "Festa Julina 14-06-2026 - Domingo",
    seoDescription:
      "Pagina legada da Festa Julina de 14 de junho de 2026, preservada no novo institucional para manter a URL antiga ativa.",
    heroImage: "/hero/current/banner-14-06-2026.jpg",
    heroAlt: "Banner da Festa Julina de 14 de junho de 2026",
    summary:
      "Versao arquivada da comunicacao publica do evento de 14 de junho de 2026 com regras, valores e acesso ao ingresso por data.",
    highlights: [
      "1o lote R$ 35,00, 2o lote R$ 40,00, 3o lote R$ 45,00 e valor no dia R$ 80,00.",
      "Compra por data especifica no fluxo legado de ingresso.",
      "Piscinas, mini-fazenda, trilha e parque com parte das atividades cobradas a parte.",
    ],
    primaryCta: {
      label: "Comprar ingresso desta data",
      href: "/ingresso/index/index/did/MTQvMDYvMjAyNg==",
    },
    sections: [
      {
        title: "Ingressos Limitados",
        items: [
          "Vendas dos ingressos feita exclusivamente pelo site e representantes autorizados.",
          "1o lote - R$ 35,00.",
          "2o lote - R$ 40,00.",
          "3o lote - R$ 45,00.",
          "No dia - R$ 80,00.",
          "Estacionamento para moto e carro - R$ 20,00, cobranca no local.",
        ],
      },
      {
        title: "Atividades incluidas no passaporte",
        items: [
          "Piscina de ondas e piscinas tradicionais.",
          "Mini-fazendinha.",
          "Quadra poliesportiva e campo society.",
          "Ponte que balanca, trilha ecologica e salao de jogos.",
          "Vestiarios masculino e feminino com sanitarios e duchas.",
        ],
      },
      {
        title: "Atividades com cobranca a parte",
        items: [
          "Parque de diversoes.",
          "Tirolesa.",
          "Arvorismo.",
          "Passeio de trenzinho.",
        ],
      },
      {
        title: "Orientacoes importantes",
        items: [
          "Somente 1 responsavel deve validar os ingressos.",
          "Ingressos comprados pelo site devem ser apresentados no celular.",
          "A bilheteria no dia do evento opera somente com o valor cheio.",
        ],
      },
      {
        title: "Bilheteria no dia do evento",
        items: [
          "Acima de 10 anos - R$ 80,00.",
          "De 04 a 09 anos - R$ 60,00.",
          "Ate 03 anos - isento.",
        ],
      },
      {
        title: "Duvidas Frequentes",
        items: [
          "Comidas e bebidas nao estao inclusas no valor do passaporte.",
          "As piscinas ficam disponiveis ate as 17h.",
          "O festival acontece das 10h as 17h.",
          "E proibida a entrada de comidas e bebidas.",
          "O ingresso vale somente para o dia da festa.",
        ],
      },
      {
        title: "Estrutura Disponivel",
        items: [
          "Estacionamento - carro e moto R$ 20,00.",
          "Sanitarios.",
          "Lanchonete.",
          "Enfermaria.",
          "Lojinhas.",
          "Restaurante com valor por quilo e prato feito.",
          "Toda a area externa para passeio.",
        ],
      },
      {
        title: "Ponto de Venda Autorizado",
        paragraphs: ["Aguardando atualizacao, conforme informado na pagina original do evento."],
      },
    ],
  },
  {
    slug: "festa-julina-13-06-2026",
    path: "/evento/festa-julina-13-06-2026",
    title: "Festa Julina 13-06-2026 - Sabado",
    seoDescription:
      "Pagina legada da Festa Julina de 13 de junho de 2026, mantida no Next.js para preservar compatibilidade com a root antiga.",
    heroImage: "/hero/current/banner-13-06-2026.jpg",
    heroAlt: "Banner da Festa Julina de 13 de junho de 2026",
    summary:
      "Versao arquivada do evento de 13 de junho de 2026 com orientacoes, valores e acesso ao fluxo legado de compra por data.",
    highlights: [
      "Compra do ingresso ligada ao fluxo legado da data 13 de junho de 2026.",
      "Entrada gratuita a partir das 18h com agendamento separado no formulario do clube.",
      "Piscinas, trilha, salao de jogos e demais estruturas divulgadas na pagina original.",
    ],
    primaryCta: {
      label: "Comprar ingresso desta data",
      href: "/ingresso/index/index/did/MTMvMDYvMjAyNg==",
    },
    secondaryCta: {
      label: "Agendamento gratuito apos 18h",
      href: "https://docs.google.com/forms/d/e/1FAIpQLSdC8SeEdKUra1GMZB04-yVtGJF8ySL2Z_glfUxfm90R4IEjUA/viewform?usp=publish-editor",
    },
    sections: [
      {
        title: "Ingressos Limitados",
        items: [
          "Vendas dos ingressos feita exclusivamente pelo site e representantes autorizados.",
          "1o lote - R$ 35,00.",
          "2o lote - R$ 40,00.",
          "3o lote - R$ 45,00.",
          "No dia - R$ 80,00.",
          "Estacionamento para moto e carro - R$ 20,00, cobranca no local.",
        ],
      },
      {
        title: "Atividades incluidas no passaporte",
        items: [
          "Piscina de ondas e piscinas tradicionais.",
          "Mini-fazendinha.",
          "Quadra poliesportiva e campo society.",
          "Ponte que balanca, trilha ecologica e salao de jogos.",
          "Vestiarios masculino e feminino com sanitarios e duchas.",
        ],
      },
      {
        title: "Atividades com cobranca a parte",
        items: [
          "Parque de diversoes.",
          "Tirolesa.",
          "Arvorismo.",
          "Passeio de trenzinho.",
        ],
      },
      {
        title: "Orientacoes importantes",
        items: [
          "Somente 1 responsavel deve validar os ingressos.",
          "Ingressos comprados pelo site devem ser apresentados no celular.",
          "Entrada gratuita a partir das 18h exige agendamento previo.",
        ],
      },
      {
        title: "Bilheteria no dia do evento",
        items: [
          "Acima de 10 anos - R$ 80,00.",
          "De 04 a 09 anos - R$ 60,00.",
          "Ate 03 anos - isento.",
        ],
      },
      {
        title: "Duvidas Frequentes",
        items: [
          "Comidas e bebidas nao estao inclusas no valor do passaporte.",
          "As piscinas ficam disponiveis ate as 17h.",
          "A festa ocorre das 10h as 22h, com entrada gratuita a partir das 18h.",
          "E proibida a entrada de comidas e bebidas.",
          "O ingresso vale somente para o dia da festa.",
        ],
      },
      {
        title: "Estrutura Disponivel",
        items: [
          "Estacionamento - carro e moto R$ 20,00.",
          "Sanitarios.",
          "Lanchonete.",
          "Enfermaria.",
          "Lojinhas.",
          "Restaurante com valor por quilo e prato feito.",
          "Toda a area externa para passeio.",
        ],
      },
      {
        title: "Ponto de Venda Autorizado",
        paragraphs: ["Aguardando atualizacao, conforme informado na pagina original do evento."],
      },
    ],
  },
  {
    slug: "festa-julina-26-07-2026-domingo",
    path: "/evento/festa-julina-26-07-2026-domingo",
    title: "Festa Julina 26-07-2026 - Domingo",
    seoDescription:
      "Pagina legada da Festa Julina de 26 de julho de 2026, preservada no Next.js para manter compatibilidade com links antigos.",
    heroImage: "/hero/current/banner-26-07-2026.jpg",
    heroAlt: "Banner da Festa Julina de 26 de julho de 2026",
    summary:
      "Versao arquivada do evento de 26 de julho de 2026 com os destaques operacionais, estrutura e duvidas frequentes do material original.",
    highlights: [
      "1o lote R$ 35,00, 2o lote R$ 40,00, 3o lote R$ 45,00 e valor no dia R$ 80,00.",
      "Passeio de trenzinho mantido como atividade com cobranca a parte.",
      "Pagina original ainda marcava parte das informacoes como em desenvolvimento.",
    ],
    sections: [
      {
        title: "Ingressos Limitados",
        items: [
          "Vendas dos ingressos feita exclusivamente pelo site e representantes autorizados.",
          "1o lote - R$ 35,00.",
          "2o lote - R$ 40,00.",
          "3o lote - R$ 45,00.",
          "No dia - R$ 80,00.",
          "Estacionamento para moto e carro - R$ 20,00, cobranca no local.",
        ],
      },
      {
        title: "Atividades incluidas no passaporte",
        items: [
          "Piscina de ondas e piscinas tradicionais.",
          "Passeio a mini-fazendinha.",
          "Quadra poliesportiva e campo society.",
          "Ponte que balanca, trilha ecologica e salao de jogos.",
          "Vestiarios masculino e feminino com sanitarios e duchas.",
        ],
      },
      {
        title: "Atividades com cobranca a parte",
        items: [
          "Parque de diversoes.",
          "Tirolesa.",
          "Arvorismo.",
          "Passeio de trenzinho com cobranca a parte.",
        ],
      },
      {
        title: "Orientacoes importantes",
        items: [
          "Somente 1 responsavel deve validar os ingressos.",
          "Ingressos comprados pelo site devem ser apresentados no celular.",
          "Parte da pagina original ainda estava marcada como em desenvolvimento.",
        ],
      },
      {
        title: "Bilheteria no dia do evento",
        items: [
          "Acima de 10 anos - R$ 80,00.",
          "De 04 a 09 anos - R$ 60,00.",
          "Ate 03 anos - isento.",
        ],
      },
      {
        title: "Duvidas Frequentes",
        items: [
          "Comidas e bebidas nao estao inclusas no valor do passaporte.",
          "As piscinas ficam disponiveis ate as 17h.",
          "A festa inicia das 10h as 22h, com entrada gratuita a partir das 18h.",
          "E proibida a entrada de comidas e bebidas.",
          "O ingresso vale somente para o dia da festa.",
        ],
      },
      {
        title: "Estrutura Disponivel",
        items: [
          "Estacionamento - carro e moto R$ 20,00.",
          "Sanitarios.",
          "Lanchonete.",
          "Enfermaria.",
          "Lojinhas.",
          "Restaurante com valor por quilo e prato feito.",
          "Toda a area externa para passeio.",
        ],
      },
      {
        title: "Ponto de Venda Autorizado",
        paragraphs: ["Aguardando atualizacao, conforme informado na pagina original do evento."],
      },
    ],
  },
];

export function getLegacyEvent(slug: string) {
  return legacyEvents.find((event) => event.slug === slug) ?? null;
}

export function buildLegacyEventMetadata(event: LegacyEvent): Metadata {
  const siteUrl = getSiteUrl();

  return {
    title: `${event.title} - Estancia`,
    description: event.seoDescription,
    alternates: {
      canonical: event.path,
    },
    openGraph: {
      title: event.title,
      description: event.seoDescription,
      url: event.path,
      siteName: "Estancia",
      type: "website",
      images: [
        {
          url: `${siteUrl}${event.heroImage}`,
          alt: event.heroAlt,
        },
      ],
    },
  };
}
