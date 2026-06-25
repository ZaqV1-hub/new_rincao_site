# Estancia Site

Duplicacao do site do Rincao para o ambiente da Estancia, mantendo a mesma
estrutura de variaveis, integrações e BFF do dominio `/ingresso/**`.

## Objetivo

- concentrar navegacao institucional, paginas de segmento e conteudo publico no `apps/web`
- remover dependencia do tema WordPress para paginas institucionais
- servir `/ingresso/**` apenas por rotas Next, redirects Next ou endpoints aposentados
- manter uma fonte de verdade unica para operacao, autenticacao, compra e pagamento no frontend atual

## Estrutura atual

- `src/app`: rotas publicas do novo institucional
- `src/components`: shell, layouts e blocos compartilhados
- `src/lib/site-content.ts`: conteudo institucional em codigo, sem CMS e sem WordPress
- `public/brand`, `public/photos` e `public/segments`: ativos migrados do tema e da media library do WordPress

## Setup local

1. Copie [`.env.local.example`](./.env.local.example) para `.env.local`.
2. Suba o Postgres local:

```bash
npm run db:up
```

3. Inicie o app:

```bash
npm run dev
```

Abra [http://localhost:3002](http://localhost:3002).

### Banco local com Docker

O repositório expõe um Postgres 17 local em `127.0.0.1:54320`, com volume
persistente e banco `clestancia_sistema` por padrao. A estrutura inicial do
banco fica em [`docker/initdb/01_schema.sql`](./docker/initdb/01_schema.sql) e e
aplicada automaticamente quando o volume e criado pela primeira vez.

Comandos uteis:

```bash
npm run db:up
npm run db:down
npm run db:reset
```

Se precisar puxar novamente apenas o schema do banco de origem, sem dados:

1. Copie [`.env.schema-source.example`](./.env.schema-source.example) para `.env.schema-source`.
2. Preencha as variaveis `SOURCE_INGRESSO_DB_*`.
3. Rode:

```bash
npm run db:schema:pull
```

Se o container local ja tiver sido criado antes de atualizar o schema, recrie o
volume:

```bash
npm run db:reset
npm run db:up
```

## Deploy self-hosted

O app agora usa `output: "standalone"` no build do Next.js.

Em producao, o fluxo esperado passa a ser:

```bash
npm ci
npm run build
node .next/standalone/server.js
```

Depois do build, o runtime `standalone` precisa receber tambem os assets publicos e
os assets compilados do Next:

- `public` para `.next/standalone/public`
- `.next/static` para `.next/standalone/.next/static`

No deploy em Windows com IIS, o recomendado e manter o Next.js rodando em um
processo Node dedicado e usar o IIS apenas como reverse proxy para a porta local
desse processo.

## Formularios institucionais

Os formularios de grupos preservam a regra do WordPress: em producao, os
envios devem ser gravados em banco MySQL na tabela compativel com o plugin
Contact Form 7 Database Extension.

Antes do cutover, aplicar a migration:

```bash
mysql --host="$GROUP_REGISTRATION_MYSQL_HOST" \
  --user="$GROUP_REGISTRATION_MYSQL_USER" \
  --password \
  "$GROUP_REGISTRATION_MYSQL_DATABASE" \
  < ../../scripts/20260419_group_registration_cfdb_tables.sql
```

Variaveis aceitas pelo `apps/web`:

- `GROUP_REGISTRATION_DATABASE_URL` ou `GROUP_REGISTRATION_MYSQL_URL`
- `GROUP_REGISTRATION_MYSQL_HOST`
- `GROUP_REGISTRATION_MYSQL_PORT`
- `GROUP_REGISTRATION_MYSQL_DATABASE`
- `GROUP_REGISTRATION_MYSQL_USER`
- `GROUP_REGISTRATION_MYSQL_PASSWORD`
- `GROUP_REGISTRATION_WP_TABLE_PREFIX`, padrao `rincaowp_`
- `GROUP_REGISTRATION_CFDB_TABLE`, padrao `rincaowp_cf7dbplugin_submits`
- `GROUP_REGISTRATION_CFDB_ST_TABLE`, padrao `rincaowp_cf7dbplugin_st`
- `GROUP_REGISTRATION_REQUIRE_DATABASE=true`, se o envio deve falhar quando o
  banco estiver indisponivel

Sem banco configurado, o app usa `apps/web/.data/group-registrations` como
fallback local. Se o banco estiver configurado mas falhar, o fallback em arquivo
tambem e usado, exceto quando `GROUP_REGISTRATION_REQUIRE_DATABASE=true`.

## Estado da migracao

O WordPress deixou de ser a camada publica e o app Next tambem assumiu o
dominio `/ingresso/**` na aplicacao. O legado Zend permanece apenas como base
historica e referencia de paridade, sem fallback server-side no runtime do
checkout, da autenticacao, das rotas operacionais ou da borda publica de
`/ingresso/**`.

## BFF da agenda publica

A agenda publica e lida e renderizada pelo Next.js.

Endpoints locais:

- `GET /api/agenda/publica?mes=1&ano=2026`
- `GET /api/agenda/[id]`

A pagina `/agenda` consome esse contrato e agora direciona para
`/comprar/[id]` e `/agendar/[id]` no frontend atual.

## BFF de autenticacao

Endpoints locais:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

O login valida CPF e senha contra a tabela `usuario` do `/ingresso`, preservando
o hash MD5 legado apenas por compatibilidade de banco. Em caso de sucesso, o Next.js
emite um cookie HTTP-only assinado chamado `rincao_bff_session`.

Variavel obrigatoria em producao:

- `INGRESSO_BFF_SESSION_SECRET`

Essa sessao autentica os endpoints BFF novos e os fluxos de area do cliente no
Next.js. Ela nao depende de sessao Zend/PHP para as rotas migradas.

## BFF de vouchers

Endpoint local:

- `GET /api/me/vouchers?limit=50&offset=0`

O endpoint requer `rincao_bff_session` e retorna pedidos `ponli` e `reser`
agrupados para a futura tela de area logada. Acoes transacionais como cancelar
reserva, preparar token de PDF e gerar voucher continuam fora deste contrato.

Variaveis aceitas para conectar no Postgres do `/ingresso`:

- `INGRESSO_DATABASE_URL`
- `INGRESSO_DB_HOST`, padrao `127.0.0.1`
- `INGRESSO_DB_PORT`, padrao `54320`
- `INGRESSO_DB_NAME`, padrao `clrincao_sistema`
- `INGRESSO_DB_USER`, padrao `postgres`
- `INGRESSO_DB_PASSWORD`, padrao `postgres`
- `INGRESSO_DB_POOL_MAX`, padrao `4`
- `INGRESSO_DB_SSL=true`, quando o banco exigir TLS
- `INGRESSO_CIELO_MERCHANT_ID` e `INGRESSO_CIELO_MERCHANT_KEY`, obrigatorias para consulta direta Cielo no BFF
- `INGRESSO_CIELO_API_ENDPOINT`, padrao `https://api.cieloecommerce.cielo.com.br/`
- `INGRESSO_CIELO_QUERY_ENDPOINT`, padrao `https://apiquery.cieloecommerce.cielo.com.br/`
- `INGRESSO_CIELO_TIMEOUT_MS`, padrao `30000`
- `INGRESSO_CIELO_SOFT_DESCRIPTOR`, padrao `CLUBERINCAO`
- `INGRESSO_CIELO_PIX_EXPIRATION_SECONDS`, padrao `86400`
- `INGRESSO_CIELO_MAX_INSTALLMENTS`, padrao `12`
- `INGRESSO_CIELO_MIN_INSTALLMENT_VALUE_CENTS`, padrao `100`
- `INGRESSO_CIELO_3DS_CLIENT_ID`, `INGRESSO_CIELO_3DS_CLIENT_SECRET`, `INGRESSO_CIELO_3DS_ESTABLISHMENT_CODE`, `INGRESSO_CIELO_3DS_MERCHANT_NAME` e `INGRESSO_CIELO_3DS_MCC`, para emissao nativa do token 3DS no BFF
- `INGRESSO_CIELO_3DS_TOKEN_ENDPOINT`, padrao `https://mpi.braspag.com.br/api/public/v1/access-token`
- `INGRESSO_CIELO_3DS_ENVIRONMENT`, padrao `PRD`
- `INGRESSO_CIELO_3DS_DEBUG`, padrao `false`
- `INGRESSO_CIELO_3DS_TIMEOUT_MS`, padrao `30000`
- `INGRESSO_TICKET_API_BASE_URL`, `INGRESSO_TICKET_API_USERNAME` e `INGRESSO_TICKET_API_PASSWORD`, para emissao/envio pos-confirmacao via microservico de tickets. A base padrao atual e `https://estanciaticketapi.azurewebsites.net`
- `INGRESSO_TICKET_API_TIMEOUT_MS`, padrao `25000`
- `INGRESSO_TICKET_API_TESTING=true`, quando o microservico exigir o header de homologacao

Endpoints de pagamento expostos pelo BFF:

- `POST /api/checkout/checkout-link`
- `GET /api/checkout/status`
- `GET /api/checkout/cielo3ds-token`
- `POST /api/checkout/notification`
- `POST /api/me/vouchers/[purchaseId]/whatsapp`

O checkout, status, token 3DS e webhook usam a stack nativa do BFF quando
`INGRESSO_CIELO_*` e `INGRESSO_CIELO_3DS_*` estiverem configurados. O BFF cria
venda, cancela Pix pendente antes de gerar outro, aplica conciliacao nativa em
`pagpagseguro` e `compra`, responde o webhook localmente e usa o microservico
de tickets para emissao e envio quando `INGRESSO_TICKET_API_*` estiver
configurado. Cashback e demais efeitos operacionais sincronizam
`compra.vlcomiss` nativamente e usam o historico `codindica_cashback` quando
essa tabela existir no ambiente.

O endpoint `POST /api/me/vouchers/[purchaseId]/whatsapp` usa o mesmo
microservico de tickets para enviar vouchers selecionados ao numero informado na
area do cliente. Em homologacao, `INGRESSO_TICKET_API_WHATSAPP_TESTING=true`
pode restringir envios aos numeros listados em
`INGRESSO_TICKET_API_WHATSAPP_ALLOWED_NUMBERS`.

## BFF operacional de vouchers

Primeiro corte da fase operacional de vouchers no Next.js:

- `POST /api/ops/vouchers/validate`
- `POST /api/ops/vouchers/unvalidate`
- `POST /api/ops/vouchers/invalidate`

Os endpoints exigem `Authorization: Bearer <INGRESSO_OPERATIONS_API_TOKEN>` e
permitem:

- validar um voucher por numero
- validar vouchers por `purchaseId`
- validar vouchers de passeio por `schoolId + agendaId`
- validar ou desvalidar uma selecao explicita de `voucherIds`
- invalidar uma selecao explicita de `voucherIds`
- invalidar todos os vouchers de uma compra por `purchaseId`

Quando `INGRESSO_TICKET_API_*` estiver configurado, o BFF tambem sincroniza a
acao com `/tickets/validate`. Falhas nessa sincronizacao nao desfazem a escrita
local; elas voltam como warning para a camada chamadora e ficam registradas no
log do servidor.

Variavel nova:

- `INGRESSO_OPERATIONS_API_TOKEN`, obrigatoria para os endpoints operacionais
- `INGRESSO_OPERATIONS_API_TOKEN_ROLE`, opcional para limitar o papel do
  bearer token operacional (`admin` por padrao)
- `INGRESSO_OPERATIONS_JOBS_TOKEN`, obrigatoria para a rota agendada
  `POST /api/ops/jobs/daily-run/scheduled`
- `INGRESSO_OPERATIONS_ROLE_MAP`, opcional para mapear CPFs a papeis
  operacionais (`admin`, `operator`, `finance`, `auditor`) no formato
  `52998224725:admin,11122233344:finance` ou JSON

## BFF operacional de compras

Primeiro corte da operacao de bilheteria no Next.js:

- `POST /api/ops/purchases/cancel`
- `POST /api/ops/purchases/update`
- `GET /api/ops/reference-data`
- `GET /api/ops/audit-logs`

O endpoint tambem exige `Authorization: Bearer <INGRESSO_OPERATIONS_API_TOKEN>`
e hoje cobre cancelamento operacional de compras `bilhe` e `reser`, com
invalidacao local dos vouchers e sincronizacao oportunistica de `invalidate`
no microservico de tickets.

O endpoint de update cobre a edicao operacional enxuta de compras `bilhe` e
`reser`, incluindo `dtcompra`, `cpf`, `stcompra`, vouchers e pagamentos. Para
vouchers `norma` e `infan`, o payload tambem aceita `discountId`, recalcula
`vlunicompra`, atualiza `descricao` e persiste a trilha em `edicoes_log` com
motivo e diff antes/depois. O retorno de cancelamento e update inclui
`auditLogId`.

Os endpoints de leitura operacional expostos agora cobrem:

- referencias de descontos, tipos e autorizadores de cortesia
- historico paginado de `edicoes_log`, com filtro opcional por `purchaseId`

## Console interna de operacoes

Rota local:

- `GET /operacoes`

Essa tela interna concentra os fluxos operacionais ja migrados para o BFF:
validacao, desvalidacao e invalidacao de vouchers, alem de cancelamento e
edicao operacional de compras.

Caracteristicas do corte:

- nao entra na navegacao publica
- responde com `robots: noindex, nofollow`
- usa `Authorization: Bearer <INGRESSO_OPERATIONS_API_TOKEN>` nas chamadas
- guarda token, nome e CPF do operador apenas em `sessionStorage`
- exibe o JSON bruto de resposta para facilitar suporte e homologacao
- aceita `discountId` no JSON de vouchers da edicao operacional
- consulta descontos, cortesias e auditoria sem fallback server-side para Zend

Ela nao substitui ainda um painel administrativo completo; e apenas a primeira
camada de operacao do Next.js para manter os fluxos ja migrados fora do legado.

No Docker local atual, os defaults ja apontam para o banco `ingresso_db`.

## Scheduler operacional

O BFF ja expoe duas superficies para jobs operacionais:

- `POST /api/ops/jobs/daily-run`, para disparo manual pela console interna
- `POST /api/ops/jobs/daily-run/scheduled`, para uso por scheduler externo com
  `x-ops-jobs-token`

O repositório agora inclui um chamador shell em
[crons/ops-daily-run.sh](/Users/juansouza/rincao_site/crons/ops-daily-run.sh:1),
pronto para cron Linux. Variaveis aceitas pelo script:

- `OPS_JOBS_BASE_URL`, fallback para `SITE_BASE_URL`, `WP_SITE_BASE_URL` e
  depois `http://127.0.0.1:3002`
- `INGRESSO_OPERATIONS_JOBS_TOKEN`
- `OPS_DAILY_RUN_RECENT_DAYS`, padrao `7`
- `OPS_DAILY_RUN_CANCEL_AFTER_DAYS`, padrao `5`
- `OPS_DAILY_RUN_LIMIT`, padrao `50`
- `OPS_DAILY_RUN_RETRIES_PER_STEP`, padrao `1`
- `OPS_DAILY_RUN_CASH_REASON`, padrao `Rotina diaria agendada no BFF`
- `OPS_DAILY_RUN_LOG_FILE`, padrao `ops_daily_run.log`

Exemplo de cron diario:

```cron
15 23 * * * /bin/bash /var/www/html/crons/ops-daily-run.sh
```

## O que ja foi migrado

- conteudo institucional principal de home, quem somos, estrutura, servicos, agenda, localizacao e trabalhe conosco
- paginas segmentadas para day-use familia, melhor idade, confraternizacoes, escola, igreja, ONGs e grupos mistos
- ativos visuais reais do site atual, copiados para o proprio app
- metadata por rota, `robots.txt`, `sitemap.xml` e aliases para URLs legadas como `/day-camp`, `/confraternizacao` e `/melhor-idade-grupos-mistos`
#   n e w _ r i n c a o _ s i t e  
 