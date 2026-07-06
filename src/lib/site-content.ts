export type PageCta = {
  label: string;
  href: string;
};

export type PageFact = {
  label: string;
  value: string;
};

export type PageSection = {
  title: string;
  intro?: string;
  paragraphs?: string[];
  items?: string[];
  note?: string;
};

export type PageMedia = {
  src: string;
  alt: string;
};

export type PageVideo = {
  title: string;
  src: string;
};

export type PageGallerySection = {
  title: string;
  items: PageMedia[];
  note?: string;
  anchorId?: string;
};

export type HomeSlide = {
  src: string;
  alt: string;
  href: string;
};

export type HomeService = {
  title: string;
  href: string;
  iconSrc: string;
};

export type InfoPage = {
  slug: string;
  path: string;
  eyebrow: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  summary: string;
  highlights: string[];
  cta: PageCta;
  secondaryCta?: PageCta;
  facts?: PageFact[];
  heroImage?: PageMedia;
  sections: PageSection[];
  videos?: PageVideo[];
  extraGallerySections?: PageGallerySection[];
  gallery?: PageMedia[];
};

export const contact = {
  email: "atendimento@cluberincao.com.br",
  whatsapp: "https://wa.me/5511947040718",
  instagram: "https://www.instagram.com/cluberincao/",
  tiktok: "https://www.tiktok.com/@cluberincao",
  facebook: "https://pt-br.facebook.com/ClubeRincao/",
  map: "https://goo.gl/maps/hK5JdJb6nM92",
  address: "Av. do Jaceguava, 2.222 - Jardim Casa Grande - São Paulo - SP",
  cep: "04870-425",
  company: "Rincão Pousada e Lazer LTDA",
  cnpj: "14.582.297/0001-55",
  phones: ["(11) 5979-2522", "(11) 5979-6000", "(11) 5922-8464"],
};

export const primaryNav = [
  { href: "/", label: "Início" },
  { href: "/quem-somos", label: "Quem Somos" },
  { href: "/estrutura", label: "Estrutura" },
  { href: "/servicos", label: "Serviços" },
  { href: "/agenda", label: "Agenda" },
  { href: "/localizacao", label: "Localização" },
  { href: "/trabalhe-conosco", label: "Trabalhe Conosco" },
];

export const homeHighlights = [
  {
    title: "84 mil metros quadrados de lazer",
    text: "O texto institucional atual posiciona o Rincão como um espaço de lazer e tranquilidade cercado por área verde e estrutura para receber famílias e grupos.",
  },
  {
    title: "Compra parte da agenda pública",
    text: "O novo site institucional agora concentra descoberta, conteúdo e entrada da jornada comercial. A agenda pública abre a seleção de data e a compra no frontend atual.",
  },
  {
    title: "Conteúdo migrado do WordPress atual",
    text: "As informações principais de estrutura, segmentos, contato e operação foram trazidas da camada pública existente para o app Next.js.",
  },
];

export const homeSlides: HomeSlide[] = [
  {
    src: "/hero/current/banner-onda.jpg",
    alt: "Piscina de Ondas",
    href: "/",
  },
  {
    src: "/hero/current/banner-25-07-2026.png",
    alt: "festa-julina-25-07-2026",
    href: "/evento/festa-julina-25-07-2026-sabado",
  },
  {
    src: "/hero/current/hotel-6.jpg",
    alt: "Hotel",
    href: "/",
  },
  {
    src: "/hero/current/banner-14-06-2026.jpg",
    alt: "festa-julina-14-06-2026",
    href: "/evento/festa-julina-14-06-2026",
  },
  {
    src: "/hero/current/banner-13-06-2026.jpg",
    alt: "festa-julina-13-06-2026",
    href: "/evento/festa-julina-13-06-2026",
  },
  {
    src: "/hero/current/banner-26-07-2026.jpg",
    alt: "Festa Julina - 26-07-2026",
    href: "/evento/festa-julina-26-07-2026-domingo",
  },
  {
    src: "/hero/current/banner-site-oficial-1.jpg",
    alt: "Piscina de Ondas",
    href: "/day-camp",
  },
];

export const homeServices: HomeService[] = [
  { title: "Casamento", href: contact.whatsapp, iconSrc: "/segments/casamento.png" },
  { title: "Melhor Idade", href: "/melhor-idade", iconSrc: "/segments/melhor-idade.png" },
  {
    title: "Confraternizações",
    href: "/confraternizacao",
    iconSrc: "/segments/confraternizacao.png",
  },
  { title: "Escola", href: "/escola", iconSrc: "/segments/escola.png" },
  { title: "Igreja", href: "/igreja", iconSrc: "/segments/igreja.png" },
  { title: "ONG's", href: "/ongs", iconSrc: "/segments/ong.png" },
  { title: "Grupos Mistos", href: "/melhor-idade-grupos-mistos", iconSrc: "/segments/misto.png" },
];

export const structureFeatures = [
  "6 piscinas, incluindo piscina de ondas e áreas infantis com escorregadores.",
  "Parque de diversões, trenzinho, salão de jogos, tirolesa e trilha ecológica.",
  "Espaços para grupos, escolas, confraternizações, retiros e programações temáticas.",
  "Apoio com estacionamento, vestiários, enfermaria, refeições e atendimento comercial.",
];

export const segmentCards = [
  {
    href: "/day-use-familia",
    legacyHref: "/day-camp",
    iconSrc: "/segments/familia.png",
    title: "Day-Use Família",
    text: "Passe um dia especial em família com estrutura de lazer, piscinas e compra online.",
  },
  {
    href: "/melhor-idade",
    legacyHref: "/melhor-idade-grupos-mistos",
    iconSrc: "/segments/melhor-idade.png",
    title: "Melhor Idade",
    text: "Programações com atendimento consultivo, day-use e atividades pensadas para grupos.",
  },
  {
    href: "/confraternizacoes",
    legacyHref: "/confraternizacao",
    iconSrc: "/segments/confraternizacao.png",
    title: "Confraternizações",
    text: "Estrutura para eventos corporativos, encontros de equipe e comemorações em grupo.",
  },
  {
    href: "/escola",
    iconSrc: "/segments/escola.png",
    title: "Escola",
    text: "Passeios e experiências escolares com conteúdo institucional e CTA dedicado para operação.",
  },
  {
    href: "/igreja",
    iconSrc: "/segments/igreja.png",
    title: "Igreja",
    text: "Retiros, encontros e eventos religiosos com alimentação, lazer e contato comercial direto.",
  },
  {
    href: "/ongs",
    iconSrc: "/segments/ong.png",
    title: "ONGs",
    text: "Atendimento para grupos sociais e organizações com estrutura ampla e orientação comercial.",
  },
  {
    href: "/grupos-mistos",
    legacyHref: "/melhor-idade-grupos-mistos",
    iconSrc: "/segments/misto.png",
    title: "Grupos Mistos",
    text: "Página dedicada para grupos variados que precisam combinar lazer, refeições e apoio operacional.",
  },
];

export const infoPages: Record<string, InfoPage> = {
  "quem-somos": {
    slug: "quem-somos",
    path: "/quem-somos",
    eyebrow: "Institucional",
    title: "Quem Somos",
    seoTitle: "Quem Somos | Rincão",
    seoDescription:
      "Conheça a história, a proposta e a equipe do Rincão, espaço de lazer e eventos em São Paulo.",
    summary:
      "Somos um espaço de 84 mil metros quadrados focado em lazer e tranquilidade, com área de reflorestamento, atendimento especializado e experiência em eventos e entretenimento.",
    highlights: [
      "84 mil metros quadrados dedicados a lazer, tranquilidade e convivência.",
      "12 mil metros quadrados de área de reflorestamento evidenciada pela natureza do local.",
      "Equipe especializada para cuidar de cada detalhe da experiência de famílias e grupos.",
    ],
    cta: { label: "Falar com a equipe", href: contact.whatsapp },
    secondaryCta: { label: "Conhecer estrutura", href: "/estrutura" },
    facts: [
      { label: "Área total", value: "84 mil m2" },
      { label: "Reflorestamento", value: "12 mil m2" },
      { label: "Referência", value: "10 km do autódromo de Interlagos" },
    ],
    heroImage: {
      src: "/photos/quem-somos.jpg",
      alt: "Visitantes aproveitando a área de lazer do Rincão",
    },
    sections: [
      {
        title: "Um espaço para lazer e tranquilidade",
        paragraphs: [
          "O conteúdo institucional atual define o Rincão como um espaço cercado por natureza, com experiência em lazer, eventos e entretenimento.",
          "A proposta pública combina acolhimento, estrutura e operação comercial para receber famílias, grupos e encontros especiais ao longo do ano.",
        ],
      },
      {
        title: "Nossa equipe",
        intro:
          "A página atual destaca que a operação se apoia em profissionais preparados para cuidar de cada detalhe do evento ou visita.",
        items: [
          "Recreadores treinados em cursos de monitoria e recreação.",
          "Cozinheiros e auxiliares altamente qualificados.",
          "Gerência com ampla experiência em eventos.",
        ],
      },
      {
        title: "O que move a experiência",
        paragraphs: [
          "Toda a qualidade na prestação de serviços aliada a um dos mais belos locais de contato com a natureza faz do Rincão uma opção para se divertir e relaxar.",
          "A camada institucional nova preserva essa narrativa e tira o WordPress da frente para que o conteúdo possa evoluir em um frontend mais atual.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/quem-somos.jpg", alt: "Área social do Rincão" },
      { src: "/photos/day-use.jpg", alt: "Paisagem do Rincão" },
      { src: "/photos/estrutura-galeria.jpg", alt: "Galeria da estrutura do clube" },
    ],
  },
  estrutura: {
    slug: "estrutura",
    path: "/estrutura",
    eyebrow: "Estrutura",
    title: "Estrutura",
    seoTitle: "Estrutura | Rincão",
    seoDescription:
      "Veja a estrutura de lazer, apoio e comodidade do Rincão para famílias, grupos e eventos.",
    summary:
      "A estrutura pública do Rincão combina piscinas, parque, trilha, salão de jogos, apoio logístico e espaços preparados para lazer e convivência em grupo.",
    highlights: [
      "Piscinas, toboáguas, parque de diversões e trilha ecológica.",
      "Apoio com estacionamento, vestiários, enfermaria e guarda-volumes.",
      "Salões para refeições, reuniões e apresentações com cozinha industrial.",
    ],
    cta: { label: "Solicitar orçamento", href: contact.whatsapp },
    secondaryCta: { label: "Ver serviços", href: "/servicos" },
    facts: [
      { label: "Piscinas", value: "6 áreas aquáticas" },
      { label: "Lazer", value: "Parque, trilha, jogos e tirolesa" },
      { label: "Apoio", value: "Estacionamento, vestiários e enfermaria" },
    ],
    heroImage: {
      src: "/photos/estrutura-piscina.jpg",
      alt: "Piscina infantil do Rincão cercada por área verde",
    },
    sections: [
      {
        title: "Conheça nossa estrutura e venha aproveitar",
        items: [
          "6 piscinas sendo 3 adultas e 3 infantil com escorregadores e tendas.",
          "Toboáguas de 3 pistas e toboáguas simples.",
          "Playground aquático infantil.",
          "Quadra poliesportiva e campo de futebol society.",
          "Trilha ecológica com ponte pênsil, casa do índio e mirante.",
          "Playground coberto com 800 m2, kid-play coberto e camas elásticas.",
          "Casa de bolinhas, torres com escorregadores e mini-fazenda para exposição.",
          "Parque de diversão com carrosséis, Maria Fumaça, Centopeia, Barco Viking e La-bamba.",
          "Passeio de trenzinho, salão de jogos, quadra de vôlei e tirolesa.",
          "Casarão de antiquários.",
        ],
      },
      {
        title: "Comodidade e apoio",
        items: [
          "Estacionamento com cobranca a parte.",
          "Portaria com equipe de segurança interna e externa.",
          "Vestiários masculino e feminino com sanitários e duchas.",
          "Enfermaria e guarda-volumes.",
          "Salões para refeições e reuniões.",
          "Palco para shows e apresentações.",
          "Amplas cozinhas equipadas em padrão industrial.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/estrutura-piscina.jpg", alt: "Piscina infantil e área verde" },
      { src: "/photos/estrutura-galeria.jpg", alt: "Galeria da estrutura do clube" },
      { src: "/photos/day-use.jpg", alt: "Caminho e área arborizada do clube" },
    ],
  },
  servicos: {
    slug: "servicos",
    path: "/servicos",
    eyebrow: "Segmentos",
    title: "Serviços",
    seoTitle: "Serviços | Rincão",
    seoDescription:
      "Explore os segmentos e formatos de atendimento do Rincão para famílias, escolas, igrejas, ONGs e grupos.",
    summary:
      "A página de serviços do institucional atual funciona como ponto de entrada para os perfis de atendimento do clube. No novo app, ela organiza melhor cada segmento e seus próximos passos.",
    highlights: [
      "Segmentos de atendimento claros para famílias, grupos e organizações.",
      "CTAs separados entre orçamento, cadastro de grupo e compra online.",
      "Camada pública pronta para crescer sem depender do tema WordPress.",
    ],
    cta: { label: "Solicitar atendimento", href: contact.whatsapp },
    secondaryCta: { label: "Comprar ingressos", href: "/agenda" },
    facts: [
      { label: "Famílias", value: "Day-use e compra online" },
      { label: "Grupos", value: "Orçamento e cadastro consultivo" },
      { label: "Escolas", value: "Área escolar e ingresso estudantil" },
    ],
    heroImage: {
      src: "/photos/day-use.jpg",
      alt: "Vista aberta do Rincão",
    },
    sections: [
      {
        title: "Perfis de atendimento",
        items: [
          "Day-Use Família.",
          "Melhor Idade.",
          "Confraternizações Corporativas.",
          "Escola.",
          "Igreja.",
          "ONGs.",
          "Grupos Mistos.",
        ],
      },
      {
        title: "Como a nova camada pública organiza isso",
        paragraphs: [
          "No WordPress, a página servia principalmente como um menu de links. No Next.js, ela passa a ser uma hub de descoberta com mais contexto, metadados melhores e caminhos mais claros para conversão.",
          "O objetivo é deixar a jornada institucional compreensível antes de enviar a pessoa para o fluxo certo de compra, cadastro ou orçamento.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/day-use.jpg", alt: "Paisagem do clube" },
      { src: "/photos/estrutura-piscina.jpg", alt: "Piscina do clube" },
      { src: "/photos/confraternizacao.jpg", alt: "Encontro em grupo no Rincão" },
    ],
  },
  agenda: {
    slug: "agenda",
    path: "/agenda",
    eyebrow: "Agenda",
    title: "Agenda",
    seoTitle: "Agenda | Rincão",
    seoDescription:
      "Consulte a agenda pública do Rincão e siga para o fluxo de compra quando necessário.",
    summary:
      "A agenda pública agora é renderizada pelo Next.js a partir do BFF, com seleção de data, compra e checkout atendidos pela stack atual.",
    highlights: [
      "A agenda continua sendo a principal referência de datas de abertura e programação.",
      "A compra online já abre no novo frontend a partir da data selecionada.",
      "A página já consome o contrato público inicial do BFF.",
    ],
    cta: { label: "Comprar ingressos", href: "/login?redirect=%2Fagenda" },
    secondaryCta: { label: "Abrir compra atual", href: "/agenda" },
    facts: [
      { label: "Origem atual", value: "/agenda" },
      { label: "Jornada comercial", value: "frontend atual + BFF" },
      { label: "Pagamento", value: "stack atual do checkout" },
    ],
    heroImage: {
      src: "/theme/clube-park-rincao.jpg",
      alt: "Vista aérea do Rincão",
    },
    sections: [
      {
        title: "Como a agenda funciona hoje",
        paragraphs: [
          "No WordPress atual, a agenda pública era apenas um container para o calendário do `/ingresso`. Agora a agenda é renderizada no próprio Next.js e conduz a pessoa para o fluxo novo de compra.",
          "Isso elimina a dependência da antiga landing page de ingresso para a jornada pública principal.",
        ],
      },
      {
        title: "O que a pessoa encontra aqui",
        items: [
          "Consulta das datas disponíveis e eventos especiais.",
          "Ponto de entrada para compra de ingressos.",
          "Continuidade da experiência pública sem depender do tema antigo.",
        ],
      },
    ],
  },
  localizacao: {
    slug: "localizacao",
    path: "/localizacao",
    eyebrow: "Acesso",
    title: "Localização",
    seoTitle: "Localização | Rincão",
    seoDescription:
      "Veja o endereço do Rincão, os roteiros de ônibus e metrô/trem e o mapa ampliado.",
    summary:
      "A página de localização concentra endereço, rotas por ônibus e metrô/trem e o acesso ao mapa ampliado para facilitar a chegada ao clube.",
    highlights: [
      "Endereço completo em Av. do Jaceguava, 2.222, Jardim Casa Grande, São Paulo.",
      "Roteiro detalhado a partir do Terminal Varginha e da Estação Grajaú.",
      "Entrada de referência pelo portão 3, ao lado da Escola Cattony.",
    ],
    cta: { label: "Ver mapa", href: contact.map },
    secondaryCta: { label: "Falar no WhatsApp", href: contact.whatsapp },
    facts: [
      { label: "Endereço", value: contact.address },
      { label: "CEP", value: "04870-020" },
      { label: "Referência", value: "Portão 3 ao lado da Escola Cattony" },
    ],
    heroImage: {
      src: "/photos/day-use.jpg",
      alt: "Área externa arborizada do Rincão",
    },
    sections: [
      {
        title: "Roteiro de ônibus",
        items: [
          "Pegar ônibus até o Terminal Varginha.",
          "Descer dentro do Terminal Varginha.",
          "Pegar o micro-ônibus Messiânica dentro do terminal.",
          "Descer no ponto da Escola Cattony, ao lado do clube, com entrada pelo portão 3.",
        ],
        note:
          "Avisar o motorista que você vai descer neste ponto porque o micro-ônibus é circular.",
      },
      {
        title: "Roteiro metro ou trem",
        items: [
          "Chegar na Linha Esmeralda da CPTM e descer na Estação Grajaú.",
          "Pegar ônibus para o Terminal Varginha dentro do Terminal Grajaú.",
          "Descer dentro do Terminal Varginha.",
          "Pegar o micro-ônibus Messiânica e descer no ponto da Escola Cattony, com entrada pelo portão 3.",
        ],
        note:
          "A nova página institucional preserva o conteúdo público da rota e substitui o layout antigo do WordPress.",
      },
    ],
  },
  "trabalhe-conosco": {
    slug: "trabalhe-conosco",
    path: "/trabalhe-conosco",
    eyebrow: "Equipe",
    title: "Trabalhe Conosco",
    seoTitle: "Trabalhe Conosco | Rincão",
    seoDescription:
      "Veja os canais de contato e envie seu currículo para trabalhar no Rincão.",
    summary:
      "A página institucional de recrutamento concentra o CTA para envio de currículo, telefones e endereço do clube em uma camada pública mais limpa.",
    highlights: [
      "Envio de currículo direcionado pelo WhatsApp comercial.",
      "Telefones principais da operação já destacados na página.",
      "Endereço do clube disponível com link para mapa ampliado.",
    ],
    cta: { label: "Enviar currículo", href: contact.whatsapp },
    secondaryCta: { label: "Ver mapa ampliado", href: contact.map },
    facts: [
      { label: "Telefone 1", value: contact.phones[0] },
      { label: "Telefone 2", value: contact.phones[1] },
      { label: "Telefone 3", value: contact.phones[2] },
    ],
    heroImage: {
      src: "/photos/confraternizacao.jpg",
      alt: "Equipe e visitantes reunidos no Rincão",
    },
    sections: [
      {
        title: "Canais para candidatura",
        paragraphs: [
          "A camada pública atualizada simplifica o acesso de quem quer trabalhar no clube e destaca os canais oficiais de contato.",
          "O próximo passo recomendado, depois da publicação, é substituir o CTA de WhatsApp por um formulário estruturado ou integração com ATS.",
        ],
      },
      {
        title: "Informações públicas atuais",
        items: [
          `Telefones: ${contact.phones.join(" / ")}.`,
          "Endereço: Av. do Jaceguava, 2.222 - Jardim Casa Grande - São Paulo - SP.",
          "Mapa ampliado disponível para orientar o deslocamento.",
        ],
      },
    ],
  },
  "day-use-familia": {
    slug: "day-use-familia",
    path: "/day-use-familia",
    eyebrow: "Famílias",
    title: "Day-Use Família",
    seoTitle: "Day-Use Família | Rincão",
    seoDescription:
      "Conheça a experiência de day-use para famílias no Rincão, com estrutura de lazer, atividades e compra online.",
    summary:
      "A página de Day-Use Família traz o principal produto do público familiar, com faixa de horário, atividades, alimentação complementar e orientações frequentes.",
    highlights: [
      "Valores públicos atuais: R$ 80,00 no passaporte e R$ 60,00 no passaporte infantil.",
      "Horário de atendimento das 10h às 17h.",
      "Compra online com desconto aberta pela agenda pública do site.",
    ],
    cta: { label: "Comprar ingressos", href: "/agenda" },
    secondaryCta: { label: "Falar com a equipe", href: contact.whatsapp },
    facts: [
      { label: "Horário", value: "10h às 17h" },
      { label: "Passaporte", value: "R$ 80,00" },
      { label: "Passaporte infantil", value: "R$ 60,00 de 4 a 9 anos" },
    ],
    heroImage: {
      src: "/photos/day-use.jpg",
      alt: "Área de natureza e lazer do Day-Use Família",
    },
    sections: [
      {
        title: "Alimentação",
        intro:
          "A oferta atual varia conforme a quantidade de visitantes esperados pelo site e inclui operação de almoço por quilo ou prato feito.",
        items: [
          "Almoço por quilo: R$ 69,90 o quilo.",
          "Prato feito com arroz, feijão, fritas, salada e filé de frango ou contra filé: R$ 39,90.",
          "Outras opções de alimentação como pastel, hot-dog, porção de batata frita e sobremesas.",
        ],
      },
      {
        title: "Atividades e apoio",
        items: [
          "Piscina de ondas e 6 piscinas tradicionais com toboágua e tendas.",
          "Quadra poliesportiva, campo society, trilha, playground coberto e casa de bolinhas.",
          "Parque de diversão, La-bamba, Barco Viking, salão de jogos e trenzinho.",
          "Estacionamento, portaria com segurança, vestiários, enfermaria e área de alimentação.",
        ],
      },
      {
        title: "Perguntas frequentes mais importantes",
        items: [
          "Sem compra antecipada não é permitida a entrada pelo site.",
          "Não está incluso café da manhã nem alimentação no passaporte familiar.",
          "É proibida a entrada de alimentos, bebidas e animais.",
          "Somente nas compras efetuadas pelo site existe desconto no passaporte.",
          "Deficientes possuem 50% de desconto com apresentação de carteirinha.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/day-use.jpg", alt: "Vista geral do day-use no Rincão" },
      { src: "/photos/estrutura-piscina.jpg", alt: "Piscina do day-use" },
      { src: "/photos/estrutura-galeria.jpg", alt: "Área de lazer do Rincão" },
    ],
  },
  "melhor-idade": {
    slug: "melhor-idade",
    path: "/melhor-idade",
    eyebrow: "Grupos",
    title: "Melhor Idade",
    seoTitle: "Melhor Idade | Rincão",
    seoDescription:
      "Veja a proposta do Rincão para grupos da melhor idade, com programação prévia, day-use e atendimento consultivo.",
    summary:
      "A oferta atual para melhor idade combina day-use das 9h às 17h, programação prévia, alimentação completa e atividades pensadas para grupos com acompanhamento especializado.",
    highlights: [
      "Atendimento consultivo para grupos com programação prévia.",
      "Café da manhã, almoço self-service e encerramento com bolo confeitado.",
      "Música ao vivo, bingo animado, baile da saudade e monitoria especializada.",
    ],
    cta: { label: "Solicitar orçamento", href: contact.whatsapp },
    secondaryCta: { label: "Cadastrar seu grupo", href: "/cadastro-de-grupo-terceira-idade" },
    facts: [
      { label: "Formato", value: "Day-use das 9h às 17h" },
      { label: "Programação", value: "Prevista para grupos" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/melhor-idade.jpg",
      alt: "Grupo da melhor idade em evento no Rincão",
    },
    sections: [
      {
        title: "Alimentação",
        items: [
          "Café da manhã com frutas da estação, 5 variedades de bolos, pão com frios, bolachas caseiras e bebidas quentes e frias.",
          "Almoço self-service com 12 variedades de pratos quentes, 10 variedades de salada, frutas e sucos.",
          "Encerramento com bolo confeitado.",
        ],
        note: "Cardápio sujeito a alteração.",
      },
      {
        title: "Programação prevista",
        items: [
          "Música ao vivo para grupos acima de 45 participantes.",
          "Passeio de trenzinho, bingo animado e baile da saudade.",
          "Mini fazenda, parque de diversões, brincadeiras dirigidas e 6 piscinas com toboáguas.",
          "Piscina de ondas, trilha ecológica e monitoria especializada.",
        ],
      },
    ],
    extraGallerySections: [
      {
        title: "Mural de fotos",
        anchorId: "mural-de-fotos",
        items: [
          {
            src: "/legacy/mural/melhor-idade-anos-60-rincao-12-150x150.jpg",
            alt: "Mural de fotos da melhor idade - anos 60",
          },
          {
            src: "/legacy/mural/SAM_3979-150x150.jpg",
            alt: "Grupo da melhor idade em programação no Rincão",
          },
          {
            src: "/legacy/mural/SAM_4516-150x150.jpg",
            alt: "Participantes da melhor idade no Rincão",
          },
          {
            src: "/legacy/mural/SAM_4614-150x150.jpg",
            alt: "Grupo da melhor idade em evento",
          },
          {
            src: "/legacy/mural/Melhor-idade-festa-nordestina-rincao-8-150x150.jpg",
            alt: "Festa nordestina da melhor idade no Rincão",
          },
          {
            src: "/legacy/mural/melhor-idade-festa-natalina-rincao-7-150x150.jpg",
            alt: "Festa natalina da melhor idade no Rincão",
          },
          {
            src: "/legacy/mural/melhor-idade-anos-60-rincao-3-150x150.jpg",
            alt: "Grupo temático da melhor idade",
          },
          {
            src: "/legacy/mural/Melhor-idade-festa-nordestina-rincao-5-150x150.jpg",
            alt: "Atividade em grupo da melhor idade",
          },
        ],
        note: "Seleção do mural atual do site institucional em produção.",
      },
    ],
    gallery: [
      { src: "/photos/melhor-idade.jpg", alt: "Grupo da melhor idade em programação especial" },
      { src: "/photos/confraternizacao.jpg", alt: "Programação em grupo no Rincão" },
      { src: "/photos/day-use.jpg", alt: "Área verde do clube" },
    ],
  },
  confraternizacoes: {
    slug: "confraternizacoes",
    path: "/confraternizacoes",
    eyebrow: "Eventos",
    title: "Confraternizações Corporativas",
    seoTitle: "Confraternizações Corporativas | Rincão",
    seoDescription:
      "Conheça a estrutura do Rincão para confraternizações corporativas, com alimentação, lazer e apoio a grupos.",
    summary:
      "A página de confraternizações corporativas apresenta um produto de grupo com atendimento das 9h às 17h, alimentação, bebidas, lazer e acompanhamento de recreadores.",
    highlights: [
      "Café da manhã, bebidas, almoço e sobremesa para grupos corporativos.",
      "Lazer integrado com piscinas, tirolesa, playground, parque e trilha.",
      "Solicitação de orçamento e cadastro de empresa como próximos passos atuais.",
    ],
    cta: { label: "Solicitar orçamento", href: contact.whatsapp },
    secondaryCta: { label: "Cadastrar sua empresa", href: "/grupo-confraternizacao" },
    facts: [
      { label: "Atendimento", value: "09h às 17h" },
      { label: "Incluso", value: "Almoço e lazer com recreadores" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/confraternizacao.jpg",
      alt: "Grupo em confraternização no Rincão",
    },
    sections: [
      {
        title: "Alimentação e bebidas",
        items: [
          "Café da manhã com café, leite, achocolatado, suco, pão com frios, baguetes, ciabatas, bolos, iogurte e sucrilhos.",
          "Bebidas das 12h às 16h com água, sucos, refrigerantes e cervejas.",
          "Almoço com saladas, arroz, arroz a grega, feijão, farofa, macarrão a bolonhesa, batata gratinada e espetinhos.",
          "Sobremesa com frutas da época e sorvetes de palito.",
        ],
        note: "Cardápio sujeito a alteração.",
      },
      {
        title: "Atividades e apoio",
        items: [
          "Piscina de ondas e 6 piscinas com toboágua e tendas.",
          "Quadra poliesportiva, tirolesa, campo society e trilha ecológica.",
          "Playground coberto, casa de bolinhas, parque de diversão e salão de jogos.",
          "Estacionamento, segurança, vestiários, enfermaria e área de alimentação.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/confraternizacao.jpg", alt: "Confraternização em grupo" },
      { src: "/photos/day-use.jpg", alt: "Área externa do clube" },
      { src: "/photos/estrutura-piscina.jpg", alt: "Estrutura de lazer para grupos" },
    ],
  },
  escola: {
    slug: "escola",
    path: "/escola",
    eyebrow: "Educacional",
    title: "Escola",
    seoTitle: "Escola | Rincão",
    seoDescription:
      "Conheça a proposta escolar do Rincão, com alimentação, atividades e acesso à operação de ingresso estudantil.",
    summary:
      "A modalidade escolar do Rincão foi pensada para passeios educativos e recreativos, com estrutura preparada para receber alunos, professores e grupos em um dia completo de convivência, lazer e atividades.",
    highlights: [
      "Café da manhã, almoço e lanche da tarde como parte da proposta escolar.",
      "Atividades com piscinas, trilha, parque, trenzinho e monitoria.",
      "CTA para cadastro da escola e compra de ingresso estudantil no fluxo atual.",
    ],
    cta: { label: "Cadastre sua Escola", href: "/grupo-escola" },
    secondaryCta: { label: "Compre seu Ingresso Estudantil", href: "/ingresso/escola" },
    facts: [
      { label: "Alimentação", value: "Café, almoço e lanche" },
      { label: "Atividades", value: "Piscinas, trilha, parque e trenzinho" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/escola.jpg",
      alt: "Crianças aproveitando a área aquática do Rincão",
    },
    sections: [
      {
        title: "Alimentação",
        items: [
          "Café da manhã com achocolatado, sucos, água, pão com queijo, pão com presunto e bolos variados.",
          "Almoço com arroz, feijão, farofa, macarrão, strogonoff, linguiça e salada de tomate e alface.",
          "Lanche da tarde com kit de hot dog e suco.",
        ],
        note: "Cardápio sujeito a alteração.",
      },
      {
        title: "Atividades",
        items: [
          "Piscina de ondas e 6 piscinas com escorregadores e tendas.",
          "Toboáguas, playground aquático, quadra poliesportiva e campo society.",
          "Trilha ecológica, kid-play coberto, casa de bolinhas, mini-fazenda e parque de diversão.",
          "Passeio de trenzinho, salão de jogos, quadra de vôlei e tirolesa pequena.",
        ],
      },
    ],
    videos: [
      {
        title: "EDUCAÇÃO INFANTIL E FUNDAMENTAL 1",
        src: "https://www.youtube.com/embed/UDJF39bZj9A",
      },
      {
        title: "ENSINO FUNDAMENTAL 2",
        src: "https://www.youtube.com/embed/6Rf7sc4TWhw",
      },
      {
        title: "ENSINO MÉDIO",
        src: "https://www.youtube.com/embed/qIviy_rG8Vo",
      },
    ],
    gallery: [
      { src: "/photos/escola.jpg", alt: "Passeio escolar no Rincão" },
      { src: "/photos/estrutura-piscina.jpg", alt: "Piscina infantil para grupos escolares" },
      { src: "/photos/day-use.jpg", alt: "Área arborizada do clube" },
    ],
  },
  igreja: {
    slug: "igreja",
    path: "/igreja",
    eyebrow: "Grupos",
    title: "Igreja",
    seoTitle: "Igreja | Rincão",
    seoDescription:
      "Veja a proposta do Rincão para igrejas, retiros e encontros religiosos com alimentação e atividades em grupo.",
    summary:
      "A página de Igreja do site atual apresenta alimentação para grupos, atividades religiosas e de convivência e CTA para orçamento e cadastro da igreja.",
    highlights: [
      "Café da manhã, almoço self-service e encerramento com bolo confeitado.",
      "Espaço para cultos, retiros espirituais, encontros e congressos.",
      "Atendimento para grupos acima de 40 integrantes.",
    ],
    cta: { label: "Solicitar orçamento", href: contact.whatsapp },
    secondaryCta: { label: "Cadastrar sua igreja", href: "/grupo-igreja" },
    facts: [
      { label: "Formato", value: "Grupos acima de 40 integrantes" },
      { label: "Eventos", value: "Cultos, retiros e encontros" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/igreja.jpg",
      alt: "Grupo de igreja reunido no Rincão",
    },
    sections: [
      {
        title: "Alimentação",
        items: [
          "Café da manhã com frutas da estação, variedades de bolos, pães com frios e bebidas quentes e frias.",
          "Almoço self-service com pratos quentes, saladas, frutas e sucos.",
          "Encerramento com bolo confeitado.",
        ],
        note: "Cardápio sujeito a alteração.",
      },
      {
        title: "Atividades e formatos",
        items: [
          "Cultos e day camp.",
          "Show gospel, retiros espirituais e vigílias.",
          "Encontro de casais, mulheres, jovens e senhoras.",
          "Reuniões ministeriais, batismo, acampamentos e casamentos em salão para congressos.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/igreja.jpg", alt: "Encontro de grupo religioso no clube" },
      { src: "/photos/confraternizacao.jpg", alt: "Grupo reunido em ambiente aberto" },
      { src: "/photos/day-use.jpg", alt: "Área verde do clube" },
    ],
  },
  ongs: {
    slug: "ongs",
    path: "/ongs",
    eyebrow: "Grupos",
    title: "ONGs",
    seoTitle: "ONGs | Rincão",
    seoDescription:
      "Conheça a proposta do Rincão para ONGs, com estrutura de lazer, alimentação e atendimento consultivo para grupos.",
    summary:
      "A página pública de ONGs segue uma estrutura semelhante à escola e enfatiza alimentação, atividades e o CTA para cadastro e orçamento.",
    highlights: [
      "Café da manhã, almoço e lanche da tarde como parte da operação para grupos.",
      "Atividades com piscinas, trilha, playground, parque e trenzinho.",
      "Atendimento consultivo com orçamento e cadastro de ONG.",
    ],
    cta: { label: "Solicitar orçamento", href: contact.whatsapp },
    secondaryCta: { label: "Cadastrar sua ONG", href: "/grupo-ongs" },
    facts: [
      { label: "Formato", value: "Atendimento consultivo" },
      { label: "Atividades", value: "Piscinas, trilha, parque e jogos" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/escola.jpg",
      alt: "Grupo social aproveitando o Rincão",
    },
    sections: [
      {
        title: "Alimentação",
        items: [
          "Café da manhã com achocolatado, sucos, água, pão com queijo, pão com presunto e bolos variados.",
          "Almoço com arroz, feijão, farofa, macarrão, strogonoff, linguiça e salada.",
          "Lanche da tarde com hot dog e suco.",
        ],
        note: "Cardápio sujeito a alteração.",
      },
      {
        title: "Atividades",
        items: [
          "Piscina de ondas e 6 piscinas com escorregadores e tendas.",
          "Toboáguas, playground aquático, quadra poliesportiva e campo society.",
          "Trilha ecológica, playground coberto, mini-fazenda, parque de diversão, salão de jogos e trenzinho.",
          "Tirolesa pequena e área ampla de apoio para grupos.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/escola.jpg", alt: "Grupo em área aquática do clube" },
      { src: "/photos/day-use.jpg", alt: "Área verde e espaços abertos" },
      { src: "/photos/estrutura-piscina.jpg", alt: "Piscina infantil e vegetação" },
    ],
  },
  "grupos-mistos": {
    slug: "grupos-mistos",
    path: "/grupos-mistos",
    eyebrow: "Grupos",
    title: "Grupos Mistos",
    seoTitle: "Grupos Mistos | Rincão",
    seoDescription:
      "Atendimento para grupos mistos no Rincão, com programação prévia, day-use e serviços para experiências em grupo.",
    summary:
      "No site atual, grupos mistos compartilham a base de conteúdo da página de melhor idade. No novo institucional, o segmento ganha identidade própria sem perder a proposta comercial original.",
    highlights: [
      "Day-use com programação prévia e atendimento consultivo.",
      "Estrutura para música ao vivo, bingo, parque, piscinas e monitoria.",
      "Tarifas sob consulta e cadastro de grupo como CTA de conversão.",
    ],
    cta: { label: "Solicitar orçamento", href: contact.whatsapp },
    secondaryCta: { label: "Cadastrar seu grupo", href: "/cadastro-de-grupo-terceira-idade" },
    facts: [
      { label: "Formato", value: "Programação prévia para grupos" },
      { label: "Horário", value: "Day-use das 9h às 17h" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/confraternizacao.jpg",
      alt: "Grupo misto em encontro no Rincão",
    },
    sections: [
      {
        title: "Serviços previstos",
        items: [
          "Música ao vivo para grupos acima de 45 participantes.",
          "Passeio de trenzinho, bingo animado, baile da saudade e brincadeiras dirigidas.",
          "Mini fazenda, parque de diversões, 6 piscinas com toboáguas e piscina de ondas.",
          "Trilha ecológica e monitoria especializada para acompanhar a experiência.",
        ],
      },
      {
        title: "Como o novo institucional trata esse segmento",
        paragraphs: [
          "A camada pública anterior misturava melhor idade e grupos mistos em uma única página. O novo app consegue separar a narrativa por audiência sem perder o conteúdo comercial já validado.",
          "Isso melhora descoberta, SEO e clareza para quem chega com uma demanda de grupo mais ampla.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/confraternizacao.jpg", alt: "Grupo misto no Rincão" },
      { src: "/photos/melhor-idade.jpg", alt: "Programação para grupos no clube" },
      { src: "/photos/day-use.jpg", alt: "Área externa do Rincão" },
    ],
  },
};

export function getInfoPage(slug: string) {
  return infoPages[slug];
}
