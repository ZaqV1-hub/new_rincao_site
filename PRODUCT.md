# Produto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipe operacional, gerentes, financeiro, contadores de passageiros e donos dos parques Rincão e Estância. Clientes usam o site público para comprar ingressos.

## Product Purpose

Gerir a visita por data: programação, ingressos, serviços, caixas, passeios, contagem e fechamento. Os donos consultam os resultados dos parques com origem e situação explícitas.

## Capabilities and Constraints

O plano aprovado está em `docs/superpowers/plans/2026-11-12-painel-gestao-implementacao-implantacao.md`. Implantação e atualização do Product Owner ficam para o final da implementação. Contagem exige internet; conclusão de passeio exige recebimento integral. Ausência gera pendência de reembolso manual. Valores fechados permanecem em snapshots revisionados. A origem das despesas da Estância depende de esclarecimento do Zaq.

## Evidence on Hand

Especificação e protótipo fornecidos em `docs/superpowers/specs/painel-gestao-referencias/`. Os exemplos do protótipo não são dados de produção. O painel existente fornece os componentes e o padrão visual a preservar.

## Product Principles

- Preservar os fluxos e dados existentes durante a evolução.
- Confirmar gravações no servidor antes de comunicar sucesso.
- Mostrar indisponibilidade e pendências, sem inventar valores.
- Conciliar dinheiro em centavos e autorizar ações no servidor.
