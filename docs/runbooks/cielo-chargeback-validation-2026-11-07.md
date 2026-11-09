# Validação da API de Chargeback — 07/11/2026

## Escopo e estado

Correção do HTTP 204, homologação com dados fictícios no sandbox, consulta histórica e preparação autorizada da VM. A integração do aplicativo permanece desativada. Nenhuma defesa, aceite ou reembolso real foi enviado. A etapa inicial de homologação não alterou a configuração persistente; a preparação posterior está registrada abaixo.

O certificado assinado corresponde à chave privada mantida exclusivamente na VM. Autenticação mTLS/OAuth funcionou nos dois ambientes. As sondas usam o cliente real transpilado do checkout, com lista explícita de hosts, métodos e rotas permitidos: em produção, somente OAuth e consultas PENDING/DONE; em homologação, também consulta de documento/ciclo de vida e recusa fictícia. Segredos não fazem parte deste relatório ou do Git. As cópias temporárias locais de credenciais foram removidas; posteriormente, as credenciais foram configuradas no runtime protegido conforme autorização.

## Correções e evidências

- HTTP 204 vira lista vazia final somente em PENDING/DONE. Continua sendo resposta inválida para autenticação, documento e apresentação; nunca confirma envio.
- Consulta por caso usa `idCase`. A forma minúscula era ignorada pelo sandbox; resultados fora do filtro continuam rejeitados. Uma verificação adicional em produção selecionou um caso tratado e consultou seu ID: retornou exatamente um caso correspondente, com quatro chamadas HTTP 200 (duas autenticações e duas consultas), sem escrita.
- Apresentação usa multipart com campos textuais e PDF binário `<idCase>.pdf`. JSON foi rejeitado com HTTP 400; o cliente corrigido recebeu HTTP 200 e código 102.
- Erros de negócio são reconhecidos também em `errorMessage`, `details` e `errorMessage.details`. O 901 observado dentro de HTTP 400 é transitório; se ocorrer na apresentação, o resultado permanece incerto, sem retransmissão automática. Código 927 em consulta de documento significa ausência, sem autorizar reenvio.
- Webhook de notificação aceita envelope `content`; lifecycle aceita `idcase`. Validação integral do lote precede persistência, com rejeição de aliases conflitantes e EC indevido.

O PDF fictício foi gerado pelo renderer do aplicativo: duas páginas, 6.816 bytes, SHA-256 `4a13f48237cc3cfb3f4f2da74727656ca0d4dd2e6762e65ed3771ac36c7dcb05`. Somente dados sintéticos foram usados no envio. A consulta de documento retornou código 104 e um JPG fixo de 3.723 bytes, diferente do PDF enviado. A consulta de ciclo de vida retornou “Em análise com Cielo”. Os cenários de erro de consulta/apresentação/documento retornaram 901 e foram classificados pelo cliente corrigido.

### Limites do sandbox

As respostas são simuladas e algumas divergem dos exemplos do manual: o cenário de erro de lifecycle retornou sucesso; os ECs dos cenários de consulta apresentaram comportamento invertido. O filtro por caso devolve o ID solicitado, mas conserva metadados de paginação de exemplo (`totalElements=123`). Não usar esses dados para inferir contestações reais ou enfraquecer validações do cliente.

Não há webhook no sandbox e a consulta de documento não recupera o PDF recém-enviado. Assim, chamadas externas foram homologadas individualmente, e o fluxo completo de persistência, dossiê, submissão e recuperação foi verificado em PostgreSQL descartável com fronteiras Cielo/coleta simuladas. Não foi comprovado um circuito externo completo com estado persistente na Cielo.

Referências: manual v3.2.1 e collection recebidos do suporte; [instruções oficiais do sandbox](https://docs.cielo.com.br/pix-can-cbk/reference/instrucoes-sandbox) e [referência de recusa](https://docs.cielo.com.br/pix-can-cbk/reference/recusa-de-contestacao). Em caso de divergência, este relatório distingue o contrato efetivamente observado do schema publicado.

## Histórico de produção

Período solicitado à API: **01/01/2024 a 07/11/2026**, em seis janelas de até 179 dias com fronteiras compartilhadas. Consultas separadas por EC e status, todas as páginas percorridas e deduplicação por EC/caso. A varredura terminou sem falhas: 49 requisições (autenticação e páginas), 28 respostas HTTP 200 e 21 HTTP 204. Não foram gravados dados individuais de compradores no relatório.

| Mês da notificação | EC 2899426197 — DONE | EC matriz 1075640757 — DONE |
| --- | ---: | ---: |
| Janeiro/2026 | 41 | 0 |
| Fevereiro/2026 | 50 | 0 |
| Março/2026 | 145 | 0 |
| Abril/2026 | 59 | 0 |
| Maio/2026 | 45 | 0 |
| Junho/2026 | 10 | 0 |
| Julho/2026 | 12 | 0 |
| Agosto/2026 | 37 | 0 |
| Setembro/2026 | 33 | 0 |
| Outubro/2026 | 15 | 1 |
| Novembro/2026, até dia 7 | 1 | 0 |
| **Total por EC** | **448** | **1** |

**PENDING: zero para ambos os ECs no intervalo consultado.** A API não retornou casos de 2024 ou 2025. Isso descreve o retorno disponível nesses filtros; retenção e completude de anos antigos não foram confirmadas pela Cielo. `DONE` significa tratado, sem comprovar vitória, defesa apresentada ou resultado financeiro. Os totais dos dois ECs são separados, sem presumir que representam disputas distintas entre matriz e filial.

## Verificação local

- 152 testes de cliente, dossiê, repositório, submissão, sincronização, webhook, rotas e painel passaram.
- Oito testes integrados passaram em PostgreSQL 17 descartável: migração reexecutável, integridade de versões, lock concorrente, cursor, prioridade temporal, reuso de PDF e recuperação após falha de recibo. Banco e processo de teste foram encerrados/removidos.
- Seis testes do runner passaram.
- ESLint dos quatro arquivos de código/teste corrigidos passou.
- Build de produção, incluindo TypeScript, passou. Houve aviso do Turbopack sobre rastreamento amplo envolvendo `next.config.ts`/`rincao-content-store.ts`, fora das alterações de chargeback.
- Revisão independente dos arquivos corrigidos e seus callers não encontrou problemas concretos; repetiu 101 testes focados com sucesso.

As falhas globais preexistentes registradas no plano anterior não foram reexecutadas nem corrigidas nesta etapa.

## Preparação da VM — 07/11/2026

- Backup completo do PostgreSQL de produção `clrincao_sistema`, em formato custom, preservado em `C:\SitesData\Rincao\secrets\cielo-chargeback\2899426197-20261105\preparation-20261107\pre-migration\clrincao_sistema.dump`. Tamanho: 211.354.553 bytes. SHA-256: `5c7789a4d38ddfbbcade99c9e61768716c17f75e8972f80945533652862e0eb7`. Configuração e ponteiro anteriores também foram preservados nesse diretório protegido.
- Backup restaurado em cluster PostgreSQL 16 isolado, limitado a loopback:55439. Migração aplicada duas vezes nesse banco sem erro; cluster descartável encerrado/removido. A restauração de teste usou `--no-owner --no-acl`: não comprova recriação de papéis/permissões em outro servidor.
- Migração aplicada transacionalmente no banco real/schema `public`. As quatro tabelas de chargeback foram criadas e permaneceram vazias.
- Credenciais de produção, certificado correspondente à chave privada e segredo de callback configurados em `C:\SitesData\Rincao\prod\.env.local`, com ACL restrita a SYSTEM/Administrators. Valores anteriores não relacionados à integração preservados. Chave privada permaneceu exclusivamente na VM.
- EC operacional configurado: `2899426197`. Alertas: `dev@cluberincao.com.br`. SMTP autenticado com `transport.verify()`; nenhum e-mail de teste enviado, portanto entrega na caixa ainda não comprovada.
- `CIELO_CHARGEBACK_ENABLED=false`. Tarefa `RincaoChargebackSync-prod` criada **desabilitada**, intervalo de cinco minutos, executor SYSTEM e runner persistente em `C:\Deploy\Rincao\ops\run-chargeback-sync.mjs`. Nenhum job autenticado de produção foi executado.

### Publicação e segurança

Release selecionada sobre o commit efetivamente ativo `c50af07fdbad8474293832e58408296c3071e3a1`, sem incluir alterações locais não relacionadas. Commit publicado em `main`: `4e0ed8da303058c4097f633e966319f31830786f`. [Deploy VM](https://github.com/ZaqV1-hub/new_rincao_site/actions/runs/42388949676). A branch e o índice do checkout original foram preservados; a preparação usou fonte isolada e índice Git separado.

Deploy concluído com sucesso às 16:03:33 UTC. Verificação posterior confirmou o ponteiro da release acima e Next.js 16.4.5 no runtime. Pelo endereço público: `/robots.txt` e `/painel/login` retornaram 200; ambos os callbacks retornaram 404 com `ok:false`; o job sem autenticação retornou 401. Os mesmos status foram confirmados de fora da VM. As quatro tabelas permaneceram vazias, integração `false`, tarefa `Disabled`/`Enabled=false`/resultado 267011 (ainda não executada), ACL do ambiente protegida e cluster de restauração ausente/porta fechada. A primeira sonda final falhou com erro genérico; a execução instrumentada posterior passou integralmente. Não foi atribuída causa sem evidência.

Tarefas temporárias de backup/build removidas após conclusão. Staging e release temporária não ativada com Next.js antigo foram removidos; backup e release anterior de produção foram preservados. SHA-256 do backup reconfirmado após a limpeza. Nenhum processo de preparação permanece pendente.

Next.js atualizado de 16.2.4 para 16.4.5 na release, após identificação de vulnerabilidades críticas, inclusive [execução remota no Windows](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36). Build e TypeScript locais passaram; 168 testes relevantes passaram. Quatro fixtures/testes antigos foram ajustados para os contratos/tipos atuais, com 13 testes aprovados. A suíte completa comparada nas duas versões apresentou os mesmos resultados: 851 aprovados, 16 falhas preexistentes e oito ignorados. Auditoria das dependências de produção: zero vulnerabilidades críticas e nenhum alerta de Next.js; oito alertas de outras dependências permanecem. Revisões independentes cobriram a preparação da VM e o delta de segurança/testes.

### Resposta da Cielo e cadastro de callbacks

A [resposta de Davi, em 06/11/2026](https://mail.google.com/mail/u/2/#search/cielo+chargeback/QgrcJHsHkwkVHNlXpXCbvLHnbNzllHxgfqb), confirmou criação das credenciais, anexou certificado/collection e pediu: “Me informe o endereço para liberação.” Não é necessário repetir o pedido de habilitação. Responder à mesma conversa do suporte técnico, mantendo `dev@cluberincao.com.br` em cópia, com:

- Notificação: `https://cluberincao.com.br/api/cielo/chargebacks/notification`.
- Ciclo de vida: `https://cluberincao.com.br/api/cielo/chargebacks/lifecycle`.
- EC operacional `2899426197`, referência da matriz vinculada às credenciais `1075640757`, raiz CNPJ `14582297` e e-mail do portal `dev@cluberincao.com.br`.
- Confirmar autenticação do callback por `x-cielo-chargeback-token` e canal seguro para compartilhar o segredo, além de timeout, política de repetição, status HTTP esperado e teste controlado de entrega.

O manual v3.2.1 e a [documentação oficial de habilitação](https://docs.cielo.com.br/pix-can-cbk/reference/autenticacao-e-credenciais-cb) já orientam encaminhar URLs ao suporte. A [referência de webhook](https://docs.cielo.com.br/pix-can-cbk/reference/webhook), o manual e os e-mails lidos não esclareceram autenticação, repetição ou timeout. Os receptores permanecem fechados com HTTP 404 enquanto a integração estiver desabilitada. Não informar que já recebem eventos. Nenhum novo e-mail foi enviado nesta preparação.

**Atualização — 07/11/2026, 13:29 (São Paulo):** após autorização explícita do usuário, resposta enviada na mesma conversa do Davi, de `juansouza9.dev@gmail.com` para `techsupportchargeback@cielo.com.br`, com `dev@cluberincao.com.br` em Cc. Gmail confirmou “Message sent”. Foram informados os dois endpoints e solicitados autenticação/canal seguro, timeout/status HTTP, política de repetição e teste controlado. A mensagem esclarece que os receptores ainda retornam 404 e pede coordenação antes das entregas; defesas reais continuam desligadas. Nenhum segredo foi enviado e nenhuma configuração da VM foi alterada nessa etapa. Aguarda-se resposta da Cielo.

## Antes de ativar produção

### Resposta do suporte e conferência — 09/11/2026

Davi respondeu às 09:14 (São Paulo), na mesma conversa: liberação no firewall em dois dias; webhooks sem autenticação, com restrição por IPs de saída; qualquer HTTP 2xx confirma recepção; três tentativas seguidas e timeout de 30 segundos. Informou que os eventos chegarão conforme houver casos, em até dois dias. Não confirmou execução de teste sintético/controlado nem o intervalo entre as tentativas.

IPs de produção fornecidos: São Paulo `54.207.186.191`, `18.229.238.7`, `54.232.53.112`; Virgínia `52.202.189.158`, `3.216.242.251`, `54.166.2.45`. Homologação foi listada separadamente; não misturar suas origens à lista de produção por padrão.

Conferência somente leitura da VM confirmou a mesma release `4e0ed8da303058c4097f633e966319f31830786f`, `CIELO_CHARGEBACK_ENABLED=false`, alerta para `dev@cluberincao.com.br`, tarefa `RincaoChargebackSync-prod` Disabled/Enabled=false/resultado 267011 (nunca executada) e zero registros nas quatro tabelas. Não houve alteração de configuração, envio de mensagem ou chamada de apresentação de defesa.

Após esta conferência, o responsável autorizou concluir a preparação, **sem separar recebimento e envio**, mantendo a restrição de não apresentar defesas reais. A proposta de duas permissões foi descartada. Estado posterior registrado abaixo.

1. Manter a integração desativada durante a preparação com a Cielo. Deploy/saúde, backup/restauração, migração e configuração protegida já foram verificados conforme registro acima.
2. Confirmar os ECs operacionais, política de elegibilidade e requisitos de defesa por motivo/bandeira; conferir a amostra de dossiê com a operação.
3. Cadastrar callbacks com a Cielo, validar autenticação e recebimento. O suporte precisa esclarecer/fornecer cenário com persistência para fechar a validação externa de documento e recuperação; os testes locais não substituem essa evidência.
4. Confirmar entrega de alertas. A tarefa periódica já está configurada, mas deve continuar desabilitada até autorização de ativação.
5. Ativar envios reais somente em etapa explicitamente autorizada. Não executar o job de produção durante a preparação: ele pode apresentar defesas elegíveis.

Procedimentos e configurações: [runbook operacional](cielo-chargeback-automation.md).

## Preparação complementar — 09/11/2026

- Token externo substituído por validação dos seis IPs oficiais de produção, com proteção no IIS e no aplicativo. Um único JSON versionado alimenta ambas as listas. A instalação é incluída no deploy de produção e faz backup do proxy.
- Teste em site IIS descartável limitado a loopback comprovou: o cabeçalho forjado chegava ao probe antes da mudança, passou a ser substituído pelo IP real depois dela, ambos os callbacks rejeitaram origem não autorizada com 403, segunda instalação foi idempotente e restauração recuperou o estado anterior. Hash do proxy de produção permaneceu igual durante o teste; site, app pool e processo descartáveis foram removidos. Compatibilidade com PowerShell 5 foi exercitada.
- Revisão independente encontrou e levou à correção da ordem de rollback (runtime anterior antes de retirar o novo header confiável), da recuperação sem listener inicial, da normalização da flag no painel e da distinção entre sucesso técnico e ausência de pendências por caso.
- Painel global de contestações passou a exibir estado desligado, saúde do job agendado, última execução e último sucesso; alerta visual para ausência/falha/atraso superior a 15 minutos. Atualização é feita pelo botão da consulta, sem executar job.
- E-mail de teste único enviado por `queueLegacyEmail` para `dev@cluberincao.com.br` às 10:20 (São Paulo), registro `email.idemail=1365913`, estado `env`, zero erros. Recebimento confirmado visualmente na caixa Gmail de Juan pelo grupo, com assunto `[TESTE] Chargeback Cielo - alerta operacional 09/11/2026`. Nenhuma defesa ou dado de comprador foi incluído no e-mail.
- Consulta isolada de DONE entre 01/09 e 09/11 retornou 49 casos. Coleta em 30 amostras recentes vinculou 30 compras e conferiu 30 pagamentos na API E-commerce; sem inconsistências de coleta. O banco foi aberto com `default_transaction_read_only=on`; guardas adicionais rejeitaram SQL de escrita e qualquer endpoint Cielo de apresentação. Nenhum worker de produção foi chamado.
- Uma amostra histórica com três ingressos utilizados gerou PDF de duas páginas, 8.442 bytes, SHA-256 `f860204c8a7ef46160757bedd3b7c830561a24cb97eb6bd42dd21456526f79e7`. As duas páginas foram renderizadas e inspecionadas: conteúdo legível, sem corte/ sobreposição. Snapshot/PDF permaneceram em diretório protegido de validação, fora do Git e das tabelas de produção. Caso DONE e motivo 4837: corretamente inelegível para nova apresentação automática.
- As primeiras sondas isoladas precisaram resolver dependências no checkout da VM além da release standalone e permitir leitura de WASM embutido (`data:`) pelo renderer. Eram limites do harness de validação; nenhuma proteção de transporte da aplicação foi removida. A execução final gerou o PDF com sucesso.

### Cobertura da política frente aos casos reais

Nos 49 casos recentes, 23 eram Visa 104, 20 Mastercard 4837 e um Elo 83 (44 motivos de fraude/não autorização); três Visa 131 (serviço não recebido), um Visa 126 (duplicidade) e um Visa 137 (cancelamento). A política existente só apresenta automaticamente razões de serviço não recebido suportadas, com pagamento e uso integral comprovados. **A preparação técnica não torna os 44 casos de fraude elegíveis.** Uso do ingresso não identifica, sozinho, o portador do cartão; a amostra real não tem ECI 3DS disponível. Requisitos e evidências para esses motivos precisam ser definidos com a operação/Cielo antes de ampliar a política. Não foi reduzida a elegibilidade para transformar uma exceção em envio automático.

### Validação local desta revisão

171 testes relevantes de cliente/coleta/PDF/repositório/envio/sync/webhook/rotas/painel e seis testes do runner passaram. ESLint do delta e build de produção com TypeScript passaram. O aviso preexistente de rastreamento amplo em `rincao-content-store.ts` permanece; a suíte global com 16 falhas preexistentes não foi repetida. A integração com PostgreSQL descartável já havia passado na revisão anterior e não teve seu contrato alterado aqui.

### Publicação desta revisão

Em preparação para publicação pelo fluxo normal de `main`; o resultado do deploy e a conferência final serão registrados após a execução. Alterações anteriores de outras frentes foram preservadas no commit `5b1155c`, publicado na branch `codex/preserved-local-work-20261109`, sem misturá-las à release de chargeback.
