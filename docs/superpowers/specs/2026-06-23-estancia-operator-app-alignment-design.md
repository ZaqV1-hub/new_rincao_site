# Estancia Operator App Alignment Design

## Context

O ecossistema de operação do Estância está desalinhado em três pontos:

1. O `site-estancia` já passou a enviar para a `estancia-ticket-api` o rótulo real do ingresso (`typeLabel`) com base no item comprado no site.
2. O `estancia-app` ainda usa a lógica antiga baseada em `type`, então a tela pós-scan continua exibindo categorias legadas como `Adulto`.
3. A contagem de pessoas no parque continua dependente de um resumo fixo da `estancia-ticket-api` (`siteAdultos`, `parqueAdultos`, etc.), que não acompanha os novos títulos vindos do site.
4. O fluxo manual “Adicionar Pessoas” do app não é mais desejado e deve ser removido completamente.

Além disso, o `site-estancia` passou a registrar auditoria e recovery de entregas pendentes, mas ainda precisa tratar compras confirmadas sem contato como `skipped`, não `failed`.

## Goals

- Fazer a tela pós-scan do `estancia-app` exibir o título real do ingresso.
- Fazer a contagem de público do app renderizar grupos dinâmicos em vez de categorias hardcoded.
- Remover completamente o fluxo manual “Adicionar Pessoas” do `estancia-app`.
- Ajustar o `site-estancia` para não registrar como falha recuperações impossíveis por falta de contato.
- Limpar o caso inconsistente já encontrado no banco (`compra 10`) para parar de gerar ruído operacional.

## Non-goals

- Redesenhar a UI geral do app.
- Mudar o fluxo principal de autenticação do app.
- Migrar o app para consumir diretamente APIs do `site-estancia`.
- Remover imediatamente os campos legados da `estancia-ticket-api` usados por versões antigas do app.

## Recommended Approach

Usar `typeLabel`/`displayType` como contrato de exibição entre os sistemas e tratar o formato antigo apenas como fallback de compatibilidade.

### Why

- O título real do ingresso já nasce no `site-estancia`, que conhece o item comprado.
- A `estancia-ticket-api` já persiste o valor exibível no fluxo novo de fulfillment.
- O app Flutter não deve manter taxonomia de ingresso em código quando o catálogo muda no site.
- O contador precisa refletir o estado real do parque, não uma classificação fixa embutida no app.

## Repo Changes

### 1. `site-estancia`

#### 1.1 Recovery de envio pendente

Modificar o recovery de tickets pendentes para tratar compras sem telefone/e-mail utilizável como `skipped` explícito.

Expected behavior:

- não tentar envio quando faltar meio de contato;
- registrar auditoria com `acao = skipped`;
- mensagem operacional descritiva, por exemplo `contact_missing_for_delivery`.

#### 1.2 Limpeza de dado inconsistente

Corrigir o caso da `compra 10`, hoje `conc` sem contato utilizável.

Preferred action:

- cancelar ou ajustar o registro para que ele deixe de aparecer como pendência de entrega.

A limpeza deve ser feita de forma explícita e rastreável, com SQL documentado no turno de implementação.

### 2. `estancia-ticket-api`

#### 2.1 `GET /tickets/:id`

Adicionar um campo estável de exibição no payload:

```json
{
  "voucher_id": "32",
  "type": "Adulto",
  "displayType": "Passaporte teste"
}
```

Rules:

- `displayType` deve preferir o valor salvo no ticket;
- se não existir valor salvo compatível, usar o mapeamento legado atual como fallback;
- manter `type` no payload por compatibilidade com clientes antigos.

#### 2.2 `GET /people-in-park`

Manter o resumo legado atual e acrescentar um resumo dinâmico:

```json
{
  "totalNoParque": 15,
  "siteAdultos": 3,
  "parqueAdultos": 2,
  "groups": [
    { "source": "site", "label": "Passaporte teste", "count": 7 },
    { "source": "site", "label": "Cortesia escola", "count": 2 },
    { "source": "parque", "label": "Passaporte Explorador", "count": 6 }
  ]
}
```

Rules:

- `label` deve vir do valor salvo em `people_in_park.type`;
- `source` deve ser `site` para `comprado_no_site = true` e `parque` para `pago_no_parque = true`;
- ordenar por `source`, depois `label`;
- `totalNoParque` continua sendo a soma de todos os grupos;
- os campos legados permanecem temporariamente.

### 3. `estancia-app`

#### 3.1 Pós-scan

Na tela [ticket_info_page.dart](/Users/juansouza/estancia-app/lib/screens/ticket_info/ticket_info_page.dart):

- usar `displayType` como texto principal;
- usar `type` apenas como fallback;
- manter o restante do fluxo de validação como está.

#### 3.2 Contagem de público

Na tela [people_count_page.dart](/Users/juansouza/estancia-app/lib/screens/people/people_count_page.dart):

- consumir `groups`;
- renderizar a lista agrupada por origem (`Site` / `Bilheteria`);
- parar de depender visualmente de `Adultos`, `Crianças`, `Isento`, etc.;
- manter `totalNoParque` no topo.

#### 3.3 Remoção do fluxo manual

Remover completamente:

- card “Adicionar Pessoas” da home;
- navegação e imports associados;
- telas:
  - [add_people_page.dart](/Users/juansouza/estancia-app/lib/screens/add_people/add_people_page.dart)
  - [category_detail_page.dart](/Users/juansouza/estancia-app/lib/screens/add_people/category_detail_page.dart)
  - [ticket_model.dart](/Users/juansouza/estancia-app/lib/screens/add_people/ticket_model.dart)

O app passa a ter apenas:

- login
- leitor de ingressos
- contagem de pessoas
- logout

## Compatibility Strategy

- `estancia-ticket-api` publica `displayType` e `groups` sem remover campos antigos.
- `estancia-app` novo passa a usar os campos novos imediatamente.
- clientes antigos continuam funcionando até nova limpeza deliberada da API.

## Testing

### `site-estancia`

- teste do recovery retornando `skipped` quando não houver contato;
- teste do audit log com `acao = skipped`.

### `estancia-ticket-api`

- teste de `GET /tickets/:id` retornando `displayType`;
- teste de `GET /people-in-park` incluindo `groups`;
- teste de compatibilidade dos campos legados.

### `estancia-app`

- teste/widget ou validação local da tela pós-scan exibindo `displayType`;
- teste/widget ou validação local da tela de contagem renderizando grupos dinâmicos;
- validação de que o card “Adicionar Pessoas” não aparece mais na home.

## Rollout Order

1. Ajustar `site-estancia` para skip explícito e limpar o dado inconsistente.
2. Publicar `estancia-ticket-api` com `displayType` e `groups`.
3. Atualizar `estancia-app` para consumir o contrato novo e remover o fluxo manual.
4. Fazer validação ponta a ponta com um ingresso real do site e uma leitura no app.

## Risks

- O banco `people_in_park` pode ter mistura de dados antigos e novos em `type`.
- O app pode assumir implicitamente a existência dos campos legados em outros pontos não mapeados ainda.
- A remoção completa do fluxo manual exige revisar imports e assets para evitar lixo morto ou build quebrado.

## Success Criteria

- Após escanear um ingresso comprado no site, o app mostra o mesmo título enviado no ticket.
- A tela de público mostra grupos reais do dia, sem taxonomia fixa no app.
- O botão/fluxo “Adicionar Pessoas” não existe mais.
- Compras `conc` sem contato não aparecem mais como falha operacional de entrega.
