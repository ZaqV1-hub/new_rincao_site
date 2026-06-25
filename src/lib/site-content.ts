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
  email: "contato@estancia.local",
  whatsapp: "https://wa.me/5511947040718",
  instagram: "#",
  tiktok: "#",
  facebook: "#",
  map: "https://goo.gl/maps/hK5JdJb6nM92",
  address: "Av. do Jaceguava, 2.222 - Jardim Casa Grande - São Paulo - SP",
  cep: "04870-425",
  company: "Estancia Pousada e Lazer LTDA",
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
    text: "O texto institucional atual posiciona o Estancia como um espaco de lazer e tranquilidade cercado por area verde e estrutura para receber familias e grupos.",
  },
  {
    title: "Compra parte da agenda publica",
    text: "O novo site institucional agora concentra descoberta, conteudo e entrada da jornada comercial. A agenda publica abre a compra e o agendamento no frontend atual.",
  },
  {
    title: "Conteudo migrado do WordPress atual",
    text: "As informacoes principais de estrutura, segmentos, contato e operacao foram trazidas da camada publica existente para o app Next.js.",
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
  "6 piscinas, incluindo piscina de ondas e areas infantis com escorregadores.",
  "Parque de diversoes, trenzinho, salao de jogos, tirolesa e trilha ecologica.",
  "Espacos para grupos, escolas, confraternizacoes, retiros e programacoes tematicas.",
  "Apoio com estacionamento, vestiarios, enfermaria, refeicoes e atendimento comercial.",
];

export const segmentCards = [
  {
    href: "/day-use-familia",
    legacyHref: "/day-camp",
    iconSrc: "/segments/familia.png",
    title: "Day-Use Familia",
    text: "Passe um dia especial em familia com estrutura de lazer, piscinas e compra online.",
  },
  {
    href: "/melhor-idade",
    legacyHref: "/melhor-idade-grupos-mistos",
    iconSrc: "/segments/melhor-idade.png",
    title: "Melhor Idade",
    text: "Programacoes com atendimento consultivo, day-use e atividades pensadas para grupos.",
  },
  {
    href: "/confraternizacoes",
    legacyHref: "/confraternizacao",
    iconSrc: "/segments/confraternizacao.png",
    title: "Confraternizacoes",
    text: "Estrutura para eventos corporativos, encontros de equipe e comemoracoes em grupo.",
  },
  {
    href: "/escola",
    iconSrc: "/segments/escola.png",
    title: "Escola",
    text: "Passeios e experiencias escolares com conteudo institucional e CTA dedicado para operacao.",
  },
  {
    href: "/igreja",
    iconSrc: "/segments/igreja.png",
    title: "Igreja",
    text: "Retiros, encontros e eventos religiosos com alimentacao, lazer e contato comercial direto.",
  },
  {
    href: "/ongs",
    iconSrc: "/segments/ong.png",
    title: "ONGs",
    text: "Atendimento para grupos sociais e organizacoes com estrutura ampla e orientacao comercial.",
  },
  {
    href: "/grupos-mistos",
    legacyHref: "/melhor-idade-grupos-mistos",
    iconSrc: "/segments/misto.png",
    title: "Grupos Mistos",
    text: "Pagina dedicada para grupos variados que precisam combinar lazer, refeicoes e apoio operacional.",
  },
];

export const infoPages: Record<string, InfoPage> = {
  "quem-somos": {
    slug: "quem-somos",
    path: "/quem-somos",
    eyebrow: "Institucional",
    title: "Quem Somos",
    seoTitle: "Quem Somos | Estancia",
    seoDescription:
      "Conheca a historia, a proposta e a equipe do Estancia, espaco de lazer e eventos em Sao Paulo.",
    summary:
      "Somos um espaco de 84 mil metros quadrados focado em lazer e tranquilidade, com area de reflorestamento, atendimento especializado e experiencia em eventos e entretenimento.",
    highlights: [
      "84 mil metros quadrados dedicados a lazer, tranquilidade e convivencia.",
      "12 mil metros quadrados de area de reflorestamento evidenciada pela natureza do local.",
      "Equipe especializada para cuidar de cada detalhe da experiencia de familias e grupos.",
    ],
    cta: { label: "Falar com a equipe", href: contact.whatsapp },
    secondaryCta: { label: "Conhecer estrutura", href: "/estrutura" },
    facts: [
      { label: "Area total", value: "84 mil m2" },
      { label: "Reflorestamento", value: "12 mil m2" },
      { label: "Referencia", value: "10 km do autodromo de Interlagos" },
    ],
    heroImage: {
      src: "/photos/quem-somos.jpg",
      alt: "Visitantes aproveitando a area de lazer do Estancia",
    },
    sections: [
      {
        title: "Um espaco para lazer e tranquilidade",
        paragraphs: [
          "O conteudo institucional atual define o Estancia como um espaco cercado por natureza, com experiencia em lazer, eventos e entretenimento.",
          "A proposta publica combina acolhimento, estrutura e operacao comercial para receber familias, grupos e encontros especiais ao longo do ano.",
        ],
      },
      {
        title: "Nossa equipe",
        intro:
          "A pagina atual destaca que a operacao se apoia em profissionais preparados para cuidar de cada detalhe do evento ou visita.",
        items: [
          "Recreadores treinados em cursos de monitoria e recreacao.",
          "Cozinheiros e auxiliares altamente qualificados.",
          "Gerencia com ampla experiencia em eventos.",
        ],
      },
      {
        title: "O que move a experiencia",
        paragraphs: [
          "Toda a qualidade na prestacao de servicos aliada a um dos mais belos locais de contato com a natureza faz do Estancia uma opcao para se divertir e relaxar.",
          "A camada institucional nova preserva essa narrativa e tira o WordPress da frente para que o conteudo possa evoluir em um frontend mais atual.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/quem-somos.jpg", alt: "Area social do Estancia" },
      { src: "/photos/day-use.jpg", alt: "Paisagem do Estancia" },
      { src: "/photos/estrutura-galeria.jpg", alt: "Galeria da estrutura do clube" },
    ],
  },
  estrutura: {
    slug: "estrutura",
    path: "/estrutura",
    eyebrow: "Estrutura",
    title: "Estrutura",
    seoTitle: "Estrutura | Estancia",
    seoDescription:
      "Veja a estrutura de lazer, apoio e comodidade do Estancia para familias, grupos e eventos.",
    summary:
      "A estrutura publica do Estancia combina piscinas, parque, trilha, salao de jogos, apoio logistico e espacos preparados para lazer e convivencia em grupo.",
    highlights: [
      "Piscinas, toboaguas, parque de diversoes e trilha ecologica.",
      "Apoio com estacionamento, vestiarios, enfermaria e guarda-volumes.",
      "Saloes para refeicoes, reunioes e apresentacoes com cozinha industrial.",
    ],
    cta: { label: "Solicitar orcamento", href: contact.whatsapp },
    secondaryCta: { label: "Ver servicos", href: "/servicos" },
    facts: [
      { label: "Piscinas", value: "6 areas aquaticas" },
      { label: "Lazer", value: "Parque, trilha, jogos e tirolesa" },
      { label: "Apoio", value: "Estacionamento, vestiarios e enfermaria" },
    ],
    heroImage: {
      src: "/photos/estrutura-piscina.jpg",
      alt: "Piscina infantil do Estancia cercada por area verde",
    },
    sections: [
      {
        title: "Conheca nossa estrutura e venha aproveitar",
        items: [
          "6 piscinas sendo 3 adultas e 3 infantil com escorregadores e tendas.",
          "Toboaguas de 3 pistas e toboaguas simples.",
          "Playground aquatico infantil.",
          "Quadra poli-esportiva e campo de futebol society.",
          "Trilha ecologica com ponte pênsil, casa do indio e mirante.",
          "Playground coberto com 800 m2, kid-play coberto e camas elasticas.",
          "Casa de bolinhas, torres com escorregadores e mini-fazenda para exposicao.",
          "Parque de diversao com carrosseis, Maria Fumaca, Centopeia, Barco Viking e La-bamba.",
          "Passeio de trenzinho, salao de jogos, quadra de volei e tirolesa.",
          "Casarao de antiquarios.",
        ],
      },
      {
        title: "Comodidade e apoio",
        items: [
          "Estacionamento com cobranca a parte.",
          "Portaria com equipe de seguranca interna e externa.",
          "Vestiarios masculino e feminino com sanitarios e duchas.",
          "Enfermaria e guarda-volumes.",
          "Saloes para refeicoes e reunioes.",
          "Palco para shows e apresentacoes.",
          "Amplas cozinhas equipadas em padrao industrial.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/estrutura-piscina.jpg", alt: "Piscina infantil e area verde" },
      { src: "/photos/estrutura-galeria.jpg", alt: "Galeria da estrutura do clube" },
      { src: "/photos/day-use.jpg", alt: "Caminho e area arborizada do clube" },
    ],
  },
  servicos: {
    slug: "servicos",
    path: "/servicos",
    eyebrow: "Segmentos",
    title: "Servicos",
    seoTitle: "Servicos | Estancia",
    seoDescription:
      "Explore os segmentos e formatos de atendimento do Estancia para familias, escolas, igrejas, ONGs e grupos.",
    summary:
      "A pagina de servicos do institucional atual funciona como ponto de entrada para os perfis de atendimento do clube. No novo app, ela organiza melhor cada segmento e seus proximos passos.",
    highlights: [
      "Segmentos de atendimento claros para familias, grupos e organizacoes.",
      "CTAs separados entre orcamento, cadastro de grupo e compra online.",
      "Camada publica pronta para crescer sem depender do tema WordPress.",
    ],
    cta: { label: "Solicitar atendimento", href: contact.whatsapp },
    secondaryCta: { label: "Comprar ingressos", href: "/agenda" },
    facts: [
      { label: "Familias", value: "Day-use e compra online" },
      { label: "Grupos", value: "Orcamento e cadastro consultivo" },
      { label: "Escolas", value: "Area escolar e ingresso estudantil" },
    ],
    heroImage: {
      src: "/photos/day-use.jpg",
      alt: "Vista aberta do Estancia",
    },
    sections: [
      {
        title: "Perfis de atendimento",
        items: [
          "Day-Use Familia.",
          "Melhor Idade.",
          "Confraternizacoes Corporativas.",
          "Escola.",
          "Igreja.",
          "ONGs.",
          "Grupos Mistos.",
        ],
      },
      {
        title: "Como a nova camada publica organiza isso",
        paragraphs: [
          "No WordPress, a pagina servia principalmente como um menu de links. No Next.js, ela passa a ser uma hub de descoberta com mais contexto, metadados melhores e caminhos mais claros para conversao.",
          "O objetivo e deixar a jornada institucional compreensivel antes de enviar a pessoa para o fluxo certo de compra, cadastro ou orcamento.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/day-use.jpg", alt: "Paisagem do clube" },
      { src: "/photos/estrutura-piscina.jpg", alt: "Piscina do clube" },
      { src: "/photos/confraternizacao.jpg", alt: "Encontro em grupo no Estancia" },
    ],
  },
  agenda: {
    slug: "agenda",
    path: "/agenda",
    eyebrow: "Agenda",
    title: "Agenda",
    seoTitle: "Agenda | Estancia",
    seoDescription:
      "Consulte a agenda publica do Estancia e siga para o fluxo de compra ou agendamento quando necessario.",
    summary:
      "A agenda publica agora e renderizada pelo Next.js a partir do BFF, com compra, agendamento e checkout atendidos pela stack atual.",
    highlights: [
      "A agenda continua sendo a principal referencia de datas de abertura e programacao.",
      "A compra online e o agendamento com pagamento no parque ja abrem no novo frontend.",
      "A pagina ja consome o contrato publico inicial do BFF.",
    ],
    cta: { label: "Comprar ou agendar", href: "/login?redirect=%2Fagenda" },
    secondaryCta: { label: "Abrir compra atual", href: "/agenda" },
    facts: [
      { label: "Origem atual", value: "/agenda" },
      { label: "Jornada comercial", value: "frontend atual + BFF" },
      { label: "Pagamento", value: "stack atual do checkout" },
    ],
    heroImage: {
      src: "/theme/clube-park-rincao.jpg",
      alt: "Vista aerea do Estancia",
    },
    sections: [
      {
        title: "Como a agenda funciona hoje",
        paragraphs: [
          "No WordPress atual, a agenda publica era apenas um container para o calendario do `/ingresso`. Agora a agenda e renderizada no proprio Next.js e conduz a pessoa para o fluxo novo de compra ou agendamento.",
          "Isso elimina a dependencia da antiga landing page de ingresso para a jornada publica principal.",
        ],
      },
      {
        title: "O que a pessoa encontra aqui",
        items: [
          "Consulta das datas disponiveis e eventos especiais.",
          "Ponto de entrada para compra de ingressos ou agendamento de visita.",
          "Continuidade da experiencia publica sem depender do tema antigo.",
        ],
      },
    ],
  },
  localizacao: {
    slug: "localizacao",
    path: "/localizacao",
    eyebrow: "Acesso",
    title: "Localizacao",
    seoTitle: "Localizacao | Estancia",
    seoDescription:
      "Veja o endereco do Estancia, os roteiros de onibus e metro/trem e o mapa ampliado.",
    summary:
      "A pagina de localizacao concentra endereco, rotas por onibus e metro/trem e o acesso ao mapa ampliado para facilitar a chegada ao clube.",
    highlights: [
      "Endereco completo em Av. do Jaceguava, 2.222, Jardim Casa Grande, Sao Paulo.",
      "Roteiro detalhado a partir do Terminal Varginha e da Estacao Grajau.",
      "Entrada de referencia pelo portao 3, ao lado da Escola Cattony.",
    ],
    cta: { label: "Ver mapa", href: contact.map },
    secondaryCta: { label: "Falar no WhatsApp", href: contact.whatsapp },
    facts: [
      { label: "Endereco", value: contact.address },
      { label: "CEP", value: "04870-020" },
      { label: "Referencia", value: "Portao 3 ao lado da Escola Cattony" },
    ],
    heroImage: {
      src: "/photos/day-use.jpg",
      alt: "Area externa arborizada do Estancia",
    },
    sections: [
      {
        title: "Roteiro de onibus",
        items: [
          "Pegar onibus ate o Terminal Varginha.",
          "Descer dentro do Terminal Varginha.",
          "Pegar o micro-onibus Messiânica dentro do terminal.",
          "Descer no ponto da Escola Cattony, ao lado do clube, com entrada pelo portao 3.",
        ],
        note:
          "Avisar o motorista que voce vai descer neste ponto porque o micro-onibus e circular.",
      },
      {
        title: "Roteiro metro ou trem",
        items: [
          "Chegar na Linha Esmeralda da CPTM e descer na Estacao Grajau.",
          "Pegar onibus para o Terminal Varginha dentro do Terminal Grajau.",
          "Descer dentro do Terminal Varginha.",
          "Pegar o micro-onibus Messiânica e descer no ponto da Escola Cattony, com entrada pelo portao 3.",
        ],
        note:
          "A nova pagina institucional preserva o conteudo publico da rota e substitui o layout antigo do WordPress.",
      },
    ],
  },
  "trabalhe-conosco": {
    slug: "trabalhe-conosco",
    path: "/trabalhe-conosco",
    eyebrow: "Equipe",
    title: "Trabalhe Conosco",
    seoTitle: "Trabalhe Conosco | Estancia",
    seoDescription:
      "Veja os canais de contato e envie seu curriculo para trabalhar no Estancia.",
    summary:
      "A pagina institucional de recrutamento concentra o CTA para envio de curriculo, telefones e endereco do clube em uma camada publica mais limpa.",
    highlights: [
      "Envio de curriculo direcionado pelo WhatsApp comercial.",
      "Telefones principais da operacao ja destacados na pagina.",
      "Endereco do clube disponivel com link para mapa ampliado.",
    ],
    cta: { label: "Enviar curriculo", href: contact.whatsapp },
    secondaryCta: { label: "Ver mapa ampliado", href: contact.map },
    facts: [
      { label: "Telefone 1", value: contact.phones[0] },
      { label: "Telefone 2", value: contact.phones[1] },
      { label: "Telefone 3", value: contact.phones[2] },
    ],
    heroImage: {
      src: "/photos/confraternizacao.jpg",
      alt: "Equipe e visitantes reunidos no Estancia",
    },
    sections: [
      {
        title: "Canais para candidatura",
        paragraphs: [
          "A camada publica atualizada simplifica o acesso de quem quer trabalhar no clube e destaca os canais oficiais de contato.",
          "O proximo passo recomendado, depois da publicacao, e substituir o CTA de WhatsApp por um formulario estruturado ou integracao com ATS.",
        ],
      },
      {
        title: "Informacoes publicas atuais",
        items: [
          `Telefones: ${contact.phones.join(" / ")}.`,
          "Endereco: Av. do Jaceguava, 2.222 - Jardim Casa Grande - Sao Paulo - SP.",
          "Mapa ampliado disponivel para orientar o deslocamento.",
        ],
      },
    ],
  },
  "day-use-familia": {
    slug: "day-use-familia",
    path: "/day-use-familia",
    eyebrow: "Familias",
    title: "Day-Use Familia",
    seoTitle: "Day-Use Familia | Estancia",
    seoDescription:
      "Conheca a experiencia de day-use para familias no Estancia, com estrutura de lazer, atividades e compra online.",
    summary:
      "A pagina de Day-Use Familia traz o principal produto do publico familiar, com faixa de horario, atividades, alimentacao complementar e orientacoes frequentes.",
    highlights: [
      "Valores publicos atuais: R$ 80,00 no passaporte e R$ 60,00 no passaporte infantil.",
      "Horario de atendimento das 10h as 17h.",
      "Compra online com desconto aberta pela agenda publica do site.",
    ],
    cta: { label: "Fazer agendamento", href: "/agenda" },
    secondaryCta: { label: "Falar com a equipe", href: contact.whatsapp },
    facts: [
      { label: "Horario", value: "10h as 17h" },
      { label: "Passaporte", value: "R$ 80,00" },
      { label: "Passaporte infantil", value: "R$ 60,00 de 4 a 9 anos" },
    ],
    heroImage: {
      src: "/photos/day-use.jpg",
      alt: "Area de natureza e lazer do Day-Use Familia",
    },
    sections: [
      {
        title: "Alimentacao",
        intro:
          "A oferta atual varia conforme a quantidade de visitantes agendados pelo site e inclui operacao de almoco por quilo ou prato feito.",
        items: [
          "Almoco por quilo: R$ 69,90 o quilo.",
          "Prato feito com arroz, feijao, fritas, salada e file de frango ou contra file: R$ 39,90.",
          "Outras opcoes de alimentacao como pastel, hot-dog, porcao de batata frita e sobremesas.",
        ],
      },
      {
        title: "Atividades e apoio",
        items: [
          "Piscina de ondas e 6 piscinas tradicionais com toboagua e tendas.",
          "Quadra poli-esportiva, campo society, trilha, playground coberto e casa de bolinhas.",
          "Parque de diversao, La-bamba, Barco Viking, salao de jogos e trenzinho.",
          "Estacionamento, portaria com seguranca, vestiarios, enfermaria e area de alimentacao.",
        ],
      },
      {
        title: "Perguntas frequentes mais importantes",
        items: [
          "Sem agendamento previo nao e permitida a entrada pelo site.",
          "Nao esta incluso cafe da manha nem alimentacao no passaporte familiar.",
          "E proibida a entrada de alimentos, bebidas e animais.",
          "Somente nas compras efetuadas pelo site existe desconto no passaporte.",
          "Deficientes possuem 50% de desconto com apresentacao de carteirinha.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/day-use.jpg", alt: "Vista geral do day-use no Estancia" },
      { src: "/photos/estrutura-piscina.jpg", alt: "Piscina do day-use" },
      { src: "/photos/estrutura-galeria.jpg", alt: "Area de lazer do Estancia" },
    ],
  },
  "melhor-idade": {
    slug: "melhor-idade",
    path: "/melhor-idade",
    eyebrow: "Grupos",
    title: "Melhor Idade",
    seoTitle: "Melhor Idade | Estancia",
    seoDescription:
      "Veja a proposta do Estancia para grupos da melhor idade, com programacao previa, day-use e atendimento consultivo.",
    summary:
      "A oferta atual para melhor idade combina day-use das 9h as 17h, programacao previa, alimentacao completa e atividades pensadas para grupos com acompanhamento especializado.",
    highlights: [
      "Atendimento consultivo para grupos com programacao previa.",
      "Cafe da manha, almoco self-service e encerramento com bolo confeitado.",
      "Musica ao vivo, bingo animado, baile da saudade e monitoria especializada.",
    ],
    cta: { label: "Solicitar orcamento", href: contact.whatsapp },
    secondaryCta: { label: "Cadastrar seu grupo", href: "/cadastro-de-grupo-terceira-idade" },
    facts: [
      { label: "Formato", value: "Day-use das 9h as 17h" },
      { label: "Programacao", value: "Prevista para grupos" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/melhor-idade.jpg",
      alt: "Grupo da melhor idade em evento no Estancia",
    },
    sections: [
      {
        title: "Alimentacao",
        items: [
          "Cafe da manha com frutas da estacao, 5 variedades de bolos, pao com frios, bolachas caseiras e bebidas quentes e frias.",
          "Almoco self-service com 12 variedades de pratos quentes, 10 variedades de salada, frutas e sucos.",
          "Encerramento com bolo confeitado.",
        ],
        note: "Cardapio sujeito a alteracao.",
      },
      {
        title: "Programacao prevista",
        items: [
          "Musica ao vivo para grupos acima de 45 participantes.",
          "Passeio de trenzinho, bingo animado e baile da saudade.",
          "Mini fazenda, parque de diversoes, brincadeiras dirigidas e 6 piscinas com toboaguas.",
          "Piscina de ondas, trilha ecologica e monitoria especializada.",
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
            alt: "Grupo da melhor idade em programacao no Estancia",
          },
          {
            src: "/legacy/mural/SAM_4516-150x150.jpg",
            alt: "Participantes da melhor idade no Estancia",
          },
          {
            src: "/legacy/mural/SAM_4614-150x150.jpg",
            alt: "Grupo da melhor idade em evento",
          },
          {
            src: "/legacy/mural/Melhor-idade-festa-nordestina-rincao-8-150x150.jpg",
            alt: "Festa nordestina da melhor idade no Estancia",
          },
          {
            src: "/legacy/mural/melhor-idade-festa-natalina-rincao-7-150x150.jpg",
            alt: "Festa natalina da melhor idade no Estancia",
          },
          {
            src: "/legacy/mural/melhor-idade-anos-60-rincao-3-150x150.jpg",
            alt: "Grupo tematico da melhor idade",
          },
          {
            src: "/legacy/mural/Melhor-idade-festa-nordestina-rincao-5-150x150.jpg",
            alt: "Atividade em grupo da melhor idade",
          },
        ],
        note: "Selecao do mural atual do site institucional em producao.",
      },
    ],
    gallery: [
      { src: "/photos/melhor-idade.jpg", alt: "Grupo da melhor idade em programacao especial" },
      { src: "/photos/confraternizacao.jpg", alt: "Programacao em grupo no Estancia" },
      { src: "/photos/day-use.jpg", alt: "Area verde do clube" },
    ],
  },
  confraternizacoes: {
    slug: "confraternizacoes",
    path: "/confraternizacoes",
    eyebrow: "Eventos",
    title: "Confraternizacoes Corporativas",
    seoTitle: "Confraternizacoes Corporativas | Estancia",
    seoDescription:
      "Conheca a estrutura do Estancia para confraternizacoes corporativas, com alimentacao, lazer e apoio a grupos.",
    summary:
      "A pagina de confraternizacoes corporativas apresenta um produto de grupo com atendimento das 9h as 17h, alimentacao, bebidas, lazer e acompanhamento de recreadores.",
    highlights: [
      "Cafe da manha, bebidas, almoco e sobremesa para grupos corporativos.",
      "Lazer integrado com piscinas, tirolesa, playground, parque e trilha.",
      "Solicitacao de orcamento e cadastro de empresa como proximos passos atuais.",
    ],
    cta: { label: "Solicitar orcamento", href: contact.whatsapp },
    secondaryCta: { label: "Cadastrar sua empresa", href: "/grupo-confraternizacao" },
    facts: [
      { label: "Atendimento", value: "09h as 17h" },
      { label: "Incluso", value: "Almoco e lazer com recreadores" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/confraternizacao.jpg",
      alt: "Grupo em confraternizacao no Estancia",
    },
    sections: [
      {
        title: "Alimentacao e bebidas",
        items: [
          "Cafe da manha com cafe, leite, achocolatado, suco, pao com frios, baguetes, ciabatas, bolos, iogurte e sucrilhos.",
          "Bebidas das 12h as 16h com agua, sucos, refrigerantes e cervejas.",
          "Almoco com saladas, arroz, arroz a grega, feijao, farofa, macarrao a bolonhesa, batata gratinada e espetinhos.",
          "Sobremesa com frutas da epoca e sorvetes de palito.",
        ],
        note: "Cardapio sujeito a alteracao.",
      },
      {
        title: "Atividades e apoio",
        items: [
          "Piscina de ondas e 6 piscinas com toboagua e tendas.",
          "Quadra poli-esportiva, tirolesa, campo society e trilha ecologica.",
          "Playground coberto, casa de bolinhas, parque de diversao e salao de jogos.",
          "Estacionamento, seguranca, vestiarios, enfermaria e area de alimentacao.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/confraternizacao.jpg", alt: "Confraternizacao em grupo" },
      { src: "/photos/day-use.jpg", alt: "Area externa do clube" },
      { src: "/photos/estrutura-piscina.jpg", alt: "Estrutura de lazer para grupos" },
    ],
  },
  escola: {
    slug: "escola",
    path: "/escola",
    eyebrow: "Educacional",
    title: "Escola",
    seoTitle: "Escola | Estancia",
    seoDescription:
      "Conheca a proposta escolar do Estancia, com alimentacao, atividades e acesso a operacao de ingresso estudantil.",
    summary:
      "O segmento escolar continua com operacao propria, mas a nova camada institucional preserva o conteudo de alimentacao, atividades e contatos para escolas.",
    highlights: [
      "Cafe da manha, almoco e lanche da tarde como parte da proposta escolar.",
      "Atividades com piscinas, trilha, parque, trenzinho e monitoria.",
      "CTA para cadastro da escola e compra de ingresso estudantil no fluxo atual.",
    ],
    cta: { label: "Cadastre sua Escola", href: "/grupo-escola" },
    secondaryCta: { label: "Compre seu Ingresso Estudantil", href: "/ingresso/escola" },
    facts: [
      { label: "Alimentacao", value: "Cafe, almoco e lanche" },
      { label: "Atividades", value: "Piscinas, trilha, parque e trenzinho" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/escola.jpg",
      alt: "Criancas aproveitando a area aquatica do Estancia",
    },
    sections: [
      {
        title: "Alimentacao",
        items: [
          "Cafe da manha com achocolatado, sucos, agua, pao com queijo, pao com presunto e bolos variados.",
          "Almoco com arroz, feijao, farofa, macarrao, strogonoff, linguica e salada de tomate e alface.",
          "Lanche da tarde com kit de hot dog e suco.",
        ],
        note: "Cardapio sujeito a alteracao.",
      },
      {
        title: "Atividades",
        items: [
          "Piscina de ondas e 6 piscinas com escorregadores e tendas.",
          "Toboaguas, playground aquatico, quadra poliesportiva e campo society.",
          "Trilha ecologica, kid-play coberto, casa de bolinhas, mini-fazenda e parque de diversao.",
          "Passeio de trenzinho, salao de jogos, quadra de volei e tirolesa pequena.",
        ],
      },
      {
        title: "Fluxo atual",
        paragraphs: [
          "A operacao escolar usa cadastro especifico, compra estudantil e acompanhamento no frontend atual.",
          "A parte publica concentra a proposta do passeio e os acessos do fluxo escolar em um unico dominio.",
        ],
      },
    ],
    videos: [
      {
        title: "EDUCACAO INFANTIL E FUNDAMENTAL 1",
        src: "https://www.youtube.com/embed/UDJF39bZj9A",
      },
      {
        title: "ENSINO FUNDAMENTAL 2",
        src: "https://www.youtube.com/embed/6Rf7sc4TWhw",
      },
      {
        title: "ENSINO MEDIO",
        src: "https://www.youtube.com/embed/qIviy_rG8Vo",
      },
    ],
    gallery: [
      { src: "/photos/escola.jpg", alt: "Passeio escolar no Estancia" },
      { src: "/photos/estrutura-piscina.jpg", alt: "Piscina infantil para grupos escolares" },
      { src: "/photos/day-use.jpg", alt: "Area arborizada do clube" },
    ],
  },
  igreja: {
    slug: "igreja",
    path: "/igreja",
    eyebrow: "Grupos",
    title: "Igreja",
    seoTitle: "Igreja | Estancia",
    seoDescription:
      "Veja a proposta do Estancia para igrejas, retiros e encontros religiosos com alimentacao e atividades em grupo.",
    summary:
      "A pagina de Igreja do site atual apresenta alimentacao para grupos, atividades religiosas e de convivencia e CTA para orcamento e cadastro da igreja.",
    highlights: [
      "Cafe da manha, almoco self-service e encerramento com bolo confeitado.",
      "Espaco para cultos, retiros espirituais, encontros e congressos.",
      "Atendimento para grupos acima de 40 integrantes.",
    ],
    cta: { label: "Solicitar orcamento", href: contact.whatsapp },
    secondaryCta: { label: "Cadastrar sua igreja", href: "/grupo-igreja" },
    facts: [
      { label: "Formato", value: "Grupos acima de 40 integrantes" },
      { label: "Eventos", value: "Cultos, retiros e encontros" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/igreja.jpg",
      alt: "Grupo de igreja reunido no Estancia",
    },
    sections: [
      {
        title: "Alimentacao",
        items: [
          "Cafe da manha com frutas da estacao, variedades de bolos, paes com frios e bebidas quentes e frias.",
          "Almoco self-service com pratos quentes, saladas, frutas e sucos.",
          "Encerramento com bolo confeitado.",
        ],
        note: "Cardapio sujeito a alteracao.",
      },
      {
        title: "Atividades e formatos",
        items: [
          "Cultos e day camp.",
          "Show gospel, retiros espirituais e vigílias.",
          "Encontro de casais, mulheres, jovens e senhoras.",
          "Reunioes ministeriais, batismo, acampamentos e casamentos em salao para congressos.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/igreja.jpg", alt: "Encontro de grupo religioso no clube" },
      { src: "/photos/confraternizacao.jpg", alt: "Grupo reunido em ambiente aberto" },
      { src: "/photos/day-use.jpg", alt: "Area verde do clube" },
    ],
  },
  ongs: {
    slug: "ongs",
    path: "/ongs",
    eyebrow: "Grupos",
    title: "ONGs",
    seoTitle: "ONGs | Estancia",
    seoDescription:
      "Conheca a proposta do Estancia para ONGs, com estrutura de lazer, alimentacao e atendimento consultivo para grupos.",
    summary:
      "A pagina publica de ONGs segue uma estrutura semelhante a escola e enfatiza alimentacao, atividades e o CTA para cadastro e orcamento.",
    highlights: [
      "Cafe da manha, almoco e lanche da tarde como parte da operacao para grupos.",
      "Atividades com piscinas, trilha, playground, parque e trenzinho.",
      "Atendimento consultivo com orcamento e cadastro de ONG.",
    ],
    cta: { label: "Solicitar orcamento", href: contact.whatsapp },
    secondaryCta: { label: "Cadastrar sua ONG", href: "/grupo-ongs" },
    facts: [
      { label: "Formato", value: "Atendimento consultivo" },
      { label: "Atividades", value: "Piscinas, trilha, parque e jogos" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/escola.jpg",
      alt: "Grupo social aproveitando o Estancia",
    },
    sections: [
      {
        title: "Alimentacao",
        items: [
          "Cafe da manha com achocolatado, sucos, agua, pao com queijo, pao com presunto e bolos variados.",
          "Almoco com arroz, feijao, farofa, macarrao, strogonoff, linguica e salada.",
          "Lanche da tarde com hot dog e suco.",
        ],
        note: "Cardapio sujeito a alteracao.",
      },
      {
        title: "Atividades",
        items: [
          "Piscina de ondas e 6 piscinas com escorregadores e tendas.",
          "Toboaguas, playground aquatico, quadra poliesportiva e campo society.",
          "Trilha ecologica, playground coberto, mini-fazenda, parque de diversao, salao de jogos e trenzinho.",
          "Tirolesa pequena e area ampla de apoio para grupos.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/escola.jpg", alt: "Grupo em area aquatica do clube" },
      { src: "/photos/day-use.jpg", alt: "Area verde e espacos abertos" },
      { src: "/photos/estrutura-piscina.jpg", alt: "Piscina infantil e vegetacao" },
    ],
  },
  "grupos-mistos": {
    slug: "grupos-mistos",
    path: "/grupos-mistos",
    eyebrow: "Grupos",
    title: "Grupos Mistos",
    seoTitle: "Grupos Mistos | Estancia",
    seoDescription:
      "Atendimento para grupos mistos no Estancia, com programacao previa, day-use e servicos para experiencias em grupo.",
    summary:
      "No site atual, grupos mistos compartilham a base de conteudo da pagina de melhor idade. No novo institucional, o segmento ganha identidade propria sem perder a proposta comercial original.",
    highlights: [
      "Day-use com programacao previa e atendimento consultivo.",
      "Estrutura para musica ao vivo, bingo, parque, piscinas e monitoria.",
      "Tarifas sob consulta e cadastro de grupo como CTA de conversao.",
    ],
    cta: { label: "Solicitar orcamento", href: contact.whatsapp },
    secondaryCta: { label: "Cadastrar seu grupo", href: "/cadastro-de-grupo-terceira-idade" },
    facts: [
      { label: "Formato", value: "Programacao previa para grupos" },
      { label: "Horario", value: "Day-use das 9h as 17h" },
      { label: "Tarifas", value: "Sob consulta" },
    ],
    heroImage: {
      src: "/photos/confraternizacao.jpg",
      alt: "Grupo misto em encontro no Estancia",
    },
    sections: [
      {
        title: "Servicos previstos",
        items: [
          "Musica ao vivo para grupos acima de 45 participantes.",
          "Passeio de trenzinho, bingo animado, baile da saudade e brincadeiras dirigidas.",
          "Mini fazenda, parque de diversoes, 6 piscinas com toboaguas e piscina de ondas.",
          "Trilha ecologica e monitoria especializada para acompanhar a experiencia.",
        ],
      },
      {
        title: "Como o novo institucional trata esse segmento",
        paragraphs: [
          "A camada publica anterior misturava melhor idade e grupos mistos em uma unica pagina. O novo app consegue separar a narrativa por audiencia sem perder o conteudo comercial ja validado.",
          "Isso melhora descoberta, SEO e clareza para quem chega com uma demanda de grupo mais ampla.",
        ],
      },
    ],
    gallery: [
      { src: "/photos/confraternizacao.jpg", alt: "Grupo misto no Estancia" },
      { src: "/photos/melhor-idade.jpg", alt: "Programacao para grupos no clube" },
      { src: "/photos/day-use.jpg", alt: "Area externa do Estancia" },
    ],
  },
};

export function getInfoPage(slug: string) {
  return infoPages[slug];
}
