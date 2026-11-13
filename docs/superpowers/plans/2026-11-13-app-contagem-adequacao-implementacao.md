# App de contagem — plano complementar de implementação e implantação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execução autorizada pelo usuário em 13/11/2026; publicar na develop ao final e atualizar rascunho ao PO.

**Goal:** Adequar a área `/contagem` ao protótipo recebido em 13/11/2026, com portaria, filipeta e relatórios reais, preservando a integração com o painel.

**Architecture:** Evoluir o app no mesmo repositório, sessão e PostgreSQL. Reutilizar veículos, revisões, assinaturas, auditoria e comandos idempotentes; separar entrada de voucher de caixa e separar conclusão da contagem diária de fechamento financeiro. Usar a integração existente de mensagens somente após confirmar seu contrato e template para filipetas.

**Tech Stack:** Next.js 16.4.5/App Router, React 19, TypeScript, PostgreSQL, Vitest, renderizadores já instalados; API de ingressos Node/Meta quando aplicável.

**Spec:** `../specs/2026-11-13-app-contagem-analise-de-aderencia.md` e arquivos originais preservados em `../specs/app-contagem-referencias/`.

## Restrições globais e decisões

- Estado do plano: execução autorizada em andamento, baseline `6a7f588`.
- D1 confirmada: monitor pode assumir/recontar com confirmação e histórico; passeio financeiramente finalizado continua bloqueado até revisão autorizada.
- D2 confirmada: finalizar contagem encerra a conferência e gera relatórios; não fecha caixas nem financeiro.
- D3 confirmada: monitor pode validar entradas sem abrir caixa e sem movimentar dinheiro.
- Internet obrigatória. PWA não significa operação offline. Não persistir assinatura/contato/observações sensíveis em cache de service worker.
- Idades do sistema: adulto 10+, criança 4–9, isento até 3. As idades 12+/4–11 do protótipo não serão adotadas.
- Voucher pode ser usado em qualquer dia aberto dentro da validade. Outra data, por si só, não deve negar entrada.
- Participantes = adulto + criança + isento + criança PCD + adulto PCD + filho de professor. Equipe = professor/coordenador + acompanhante PCD. Total = participantes + equipe.
- Nenhuma cortesia é cadastrada na contagem. Presença pode ultrapassar previsão; previsão não é capacidade nem limite de entrada.
- Contagem concluída e envio da filipeta são estados distintos. Falha do WhatsApp não apaga contagem nem exige nova assinatura.
- Preservar revisões/assinaturas antigas, comandos já executados, recibos financeiros e migrações aplicadas. Migrar por adição, sem reset.
- Não promover para `main` nesta entrega. Destino previsto: `develop`/homologação, pelo CI/CD existente, após implementação e verificações.
- Não alterar despesas da Estância; pendência permanece com Isaque. Não realizar cobrança ou envio a pessoas reais durante testes.
- Ler guias relevantes da versão instalada em `node_modules/next/dist/docs/` antes de implementar convenções do framework.

## Modelo proposto e dependências

| Informação | Fonte e alteração mínima |
|---|---|
| Passeio e veículos | Manter `passeio_operacao`/`passeio_veiculos`; acrescentar identificação ordinal por tipo/passeio e transportador específico opcional, herdando transportador do passeio quando não houver exceção |
| Contagem e responsável | Manter `passeio_contagens`; catálogo novo para novas revisões se necessário; preservar leitura do catálogo anterior, incluindo detalhes PCD livres |
| Assinatura | Manter `contagem_assinaturas`; autorizar consulta a monitor com acesso à contagem do parque para exibir filipeta, sem abrir URL pública permanente |
| Histórico/feed | Projetar auditoria existente com eventos e nomes; não criar segundo log de eventos se a fonte atual atender ao contrato |
| Restrições do passeio para cozinha | Acrescentar campo próprio `food_notes` em `passeio_operacao`, editável na programação; não publicar observações administrativas sem seleção |
| Encerramento da contagem | Novas tabelas `contagem_dias` e `contagem_dia_revisoes`: estado/versão e snapshots imutáveis; sem alterar `operacao_dias.estado` |
| Compartilhamento manual | `contagem_compartilhamentos`: revisão, operador, ação aberta/declarada e chave idempotente; nenhum status fictício de entrega |
| Entrada day use | Manter voucher canônico, data/hora/autor existentes e auditoria; contexto de entrada sem `validacao_periodo_id` fictício. Inspecionar constraints antes da migração |
| Permissão de entrada | Recurso específico `vis_portaria`, separado de `vis_bilhet`; nenhuma concessão automática a todos os usuários existentes |

Novos arquivos SQL propostos: `docs/sql/2026-11-13-counting-app-details.sql`, `2026-11-13-counting-day-revisions.sql`, `2026-11-13-counting-manual-shares.sql`. Acrescentar ao executor `scripts/migrate-operational-panel.mjs` e seus testes; ajustar nome/data se a execução ocorrer depois. Acrescentadas `counting-admissions` para reconciliação de entrada e `counting-access` para ampliar a coluna ACL legada de 10 para 40 caracteres, sem conceder recursos automaticamente.

Dependências: T1 → T2; T3/T5/T6 integrados após estabilizar os DTOs. Um escritor por arquivo; revisão independente sem escrita. T7 integra tudo. Renderização compartilhada realizada por `counting-export.ts`; testes de entrada e compartilhamento integrados às fixtures PostgreSQL existentes, sem duplicar harness.

## T1 — Contrato de contagem, dados e permissões

**Modificar:** `src/lib/trip-counting-contract.ts`, `src/lib/trip-counting.ts`, `src/lib/trip-counting-route.ts`, `src/lib/trip-settlement-source.ts`, `src/lib/day-program.ts`, `src/components/painel-day-program-page.tsx`, `src/components/painel-day-program-page.test.tsx`; testes de contrato/integração citados abaixo e executor de migrações.

**Criar:** migração `counting-app-details` e testes de migração/compatibilidade junto aos testes existentes.

**Interfaces:** preservar `changeTripCount`, `addCountingVehicle`, `getCountingVehicle`, `getCountingDay`, `CountingResult`. Estender DTO com ordinal, transportador efetivo, tipo de grupo, início real, subtotal provisório e contagens de veículos; não renomear chaves financeiras existentes.

- [x] Acrescentar testes para permitir `takeover`/`recount` a monitor com acesso; exigir confirmação/motivo auditável, trocar posse atomicamente e rejeitar escrita da versão anterior.
- [x] Acrescentar teste para nova conclusão com todas as categorias zero: deve falhar antes de gravar assinatura; contagem com uma pessoa deve passar. Preservar leitura de conclusão histórica zero, se existir.
- [x] Testar os sete tipos PCD e igualdade entre detalhes e quantidade. Recomendação: persistir agregados categoria/tipo/quantidade e expandir etiquetas na UI; não criar cadastro nominal. Rascunhos antigos com descrição livre continuam legíveis e são revisados explicitamente antes de uma nova conclusão.
- [x] Ajustar assinatura de normalização com compatibilidade explícita de catálogo/contexto de leitura, atualizando **todos** os chamadores, inclusive `trip-settlement-source.ts`; não trocar validador global de modo que invalide recibos/histórico.
- [x] Acrescentar campos de veículo/restrições por migração aditiva. Ordinais históricos seguem ordem estável de ID dentro de passeio/tipo; manter ID técnico, transportador desconhecido nulo e previsão desconhecida nula.
- [x] Bloquear mutações em data futura para qualquer papel na API da contagem. Correção de passado permanece fluxo administrativo separado, com gerente/motivo e sem recibo finalizado.
- [x] Adaptar programação/listas para apresentar extras sem substituí-los ao salvar quantidade prevista; compartilhar transportador e restrição alimentar sem duplicar fonte.
- [x] Rodar testes abaixo, verificar migração aplicada duas vezes sem perda/duplicação, revisar diff e registrar commit da tarefa.

```bash
rtk proxy npx vitest run src/lib/trip-counting-contract.test.ts src/lib/trip-counting.integration.test.ts src/lib/day-program.integration.test.ts src/lib/trip-settlement.integration.test.ts
rtk proxy node --test scripts/migrate-operational-panel.test.mjs
```

Usar `PANEL_TEST_DATABASE_URL` apenas para banco local isolado permitido pelo harness; zero skips nos testes PostgreSQL antes do aceite. Casos obrigatórios: dois inícios, dois encerramentos, assunção durante autosave, recontagem conservando PNG antigo, recibo fechado, dia financeiro fechado e auditoria falhando com rollback.

## T2 — Telas do protótipo e sincronização de rascunho

**Modificar:** `src/app/contagem/layout.tsx`, `src/app/contagem/page.tsx`, `src/app/contagem/veiculos/[vehicleId]/page.tsx`, `src/components/counting-day-page.tsx`, `counting-vehicle-page.tsx`, `counting-controls.tsx`, `counting-signature.tsx`, `painel-counting-summary.tsx`, `src/lib/trip-counting-client.ts`.

**Criar:** `src/components/counting-account-menu.tsx`, `counting-stepper.tsx` e testes focados dos estados do fluxo; página de detalhe do passeio somente se necessária para reproduzir a navegação do HTML, reutilizando `CountingDay`.

**Interfaces:** `CountDraft` mantém oito categorias; nova revisão inicia contadores em zero conforme protótipo, sem converter nulos de rascunhos anteriores silenciosamente. Cada salvamento confirmado produz nova `version`; próximo usa essa versão.

- [x] Cobrir com testes de estado: +/−, zero mínimo, PCD cancelar/adicionar/remover, total participantes/equipe e bloqueio para avançar com zero.
- [x] Implementar faixa de datas, cartões cinza/amarelo/verde, nome/avatar, resumo conhecido e previsão, escola/grupo, transportador, extras e “Agora na equipe”. Usar assets aprovados existentes/protótipo; nenhuma marca substituta.
- [x] Implementar contagem → responsável/assinatura → prévia, com botões grandes e ações fixas sem esconder conteúdo/teclado. Mostrar texto e ícone além da cor.
- [x] Salvar rascunho automaticamente com atraso curto e fila serial: enquanto uma tentativa estiver incerta, reconciliar a mesma chave; não criar outra tentativa. Alterações posteriores ficam na memória e só usam versão atual após confirmação.
- [x] Preservar campos em erro de rede, sessão expirada ou conflito. Exibir “salvando”, “salvo” ou “não confirmado”; não confundir `navigator.onLine` com confirmação do servidor. Navegação interna/saída também avisa, não apenas fechar aba.
- [x] Assumir recupera último rascunho confirmado; informar que edições não enviadas do outro aparelho não podem ser recuperadas. Troca não libera escrita do operador anterior.
- [x] Reutilizar polling 5 s, pausa em aba oculta e refresh imediato após ação. Expor rascunho como provisório sem somá-lo à presença confirmada do painel.
- [x] Menu de conta usa logout da sessão operacional já existente; não apenas cookie do cliente comprador. Avisar de contagens atribuídas e preservar atribuição/histórico ao sair.
- [x] Validar a 390 px e em desktop, sem overflow, com teclado e toque; testar dois contextos independentes no mesmo veículo. Registrar evidência/commit.

**Aceite observável:** A conta três pessoas, salva automaticamente; B vê subtotal provisório/autor em até 10 s em rede normal; B assume explicitamente; A recebe conflito sem sobrescrever B. Final concluído aparece uma única vez no painel.

## T3 — Filipeta por revisão e assinatura na conferência

**Criar:** `src/lib/counting-slip.ts`, `counting-slip.test.ts`, `counting-slip-export.tsx`, `counting-slip-export.test.tsx`, `src/components/counting-slip.tsx`, `src/app/api/contagem/filipetas/[revisionId]/route.ts`.

**Modificar:** `counting-vehicle-page.tsx`, `trip-counting.ts` e testes de acesso à assinatura.

**Interfaces:** filipeta usa uma revisão e seu catálogo, dados reais de passeio/veículo e assinatura privada; exportação de revisão concluída nunca lê rascunho corrente como se fosse aquele documento.

- [x] Criar fixture com coordenador 2, PCD criança 1, PCD adulto 1, acompanhante 1, filho de professor 1, adulto 3, criança 4 e isento 1. Esperado: participantes 11, equipe 3, total 14; PCD 2 já incluídos, sem somar novamente.
- [x] Testar prévia sem status de envio, conclusão histórica estável após recontagem, textos longos, detalhes PCD e acesso negado sem permissão.
- [x] Implementar a filipeta com modalidades, PCD por tipo, observações, nome do contador, início/fim, responsável, WhatsApp e imagem da assinatura. Antes do commit: “Ainda não finalizada nem enviada”. Horário inexistente não recebe estimativa inventada.
- [x] Correção de contagem/observações após assinatura exige nova conferência/assinatura; voltar sem alterar dados preserva assinatura ainda não finalizada.
- [x] Reutilizar renderização instalada para imagem compartilhável e, se útil, PDF; verificar motor realmente disponível antes de acrescentar dependência. Paginar observações extensas, mantendo todas as páginas.
- [x] Servir arquivos privados com checagem de parque/recurso, `no-store` e auditoria; monitor autorizado pode ver filipeta do colega. Cozinha não recebe assinatura/telefone por reutilização indiscriminada.
- [x] Rodar testes de exportação e abrir artefatos reais para comparação visual com o HTML; registrar commit.

```bash
rtk proxy npx vitest run src/lib/counting-slip.test.ts src/lib/counting-slip-export.test.tsx src/lib/trip-counting-signature.test.ts src/lib/trip-counting.integration.test.ts
```

## T4 — Portaria e QR sem caixa

**Modificar:** `src/lib/painel-access.ts`, `src/lib/ops-voucher-validation-contract.ts`, `ops-voucher-validation-shared.ts`, `ops-voucher-validation-cash.ts`, `ops-voucher-validation-audit.ts`, `ops-voucher-validation-queries.ts`; chamadores atuais encontrados por busca; testes da bilheteria/validade.

**Criar:** `src/lib/counting-admission.ts`, `counting-admission.integration.test.ts`, `src/lib/counting-qr.ts`, `counting-qr.test.ts`, `src/app/api/contagem/entradas/route.ts`, `src/app/contagem/day-use/page.tsx`, `src/components/counting-day-use-page.tsx`.

**Interfaces:** novo contexto discriminado de entrada (`kind: 'gate'`, parque, data, ator) versus venda (`kind: 'cash'`, caixa real). A validação comum mantém locks/eligibilidade; nenhuma função pública aceita identidade do operador enviada pelo navegador. Retorno distingue autorizado, já usado com data/autor, inválido, fora da validade, dia fechado e pagamento pendente.

- [x] Buscar todos os chamadores de `markVoucherUsed`, `lockVoucherCashContext`, `registerVoucherOperationAuditLog` e validadores antes da extração; preservar exigência de caixa nas rotas de bilheteria.
- [x] Testar monitor autorizado sem caixa, monitor sem recurso negado, dois leitores simultâneos e uma única admissão; nenhum lançamento financeiro ou abertura de caixa criado.
- [x] Extrair a menor parte compartilhada da validação transacional. Preservar parque, data São Paulo, pagamento, retenções, intervalo de validade, agenda aberta, cancelamento e bloqueio do dia financeiro. Auditar entrada com autor e origem portaria; `validacao_periodo_id` nulo real, nunca ID inventado.
- [x] Tratar idempotência/reconciliação de leitura com resposta perdida: repetir mesma tentativa não anuncia uma nova entrada. Voucher já usado por outro comando mostra quando e por quem, com fallback “não registrado” em legado.
- [x] Conferir conteúdo real dos QR emitidos. Evidência: API de ingressos `services/TicketFulfillmentService.js` gera `${purchaseId}-${voucherId}`; não passar isso diretamente como `numvoucher`. Parsear apenas formatos reconhecidos, resolver par compra/voucher no banco e conferir vínculo. Não navegar URLs arbitrárias lidas pela câmera.
- [x] Implementar câmera por HTTPS e decoder compatível com navegadores alvo; `BarcodeDetector` somente com detecção de capacidade. Se não houver decoder instalado compatível, escolher uma dependência pequena com documentação atual e teste em Safari; registrar decisão. Entrada manual de código continua alternativa se câmera for negada.
- [x] Parar câmera ao sair/ocultar, evitar múltiplos envios pelo mesmo QR em frames sucessivos e mostrar estados claros. Não incluir leitura de voucher escolar/serviço como pessoa day use.
- [x] Agregar vendidos na data e lidos pela data efetiva sem duplicar pessoas dos veículos. Retornar ao monitor apenas dados de presença necessários, sem DTO financeiro completo.
- [x] Rodar testes de entrada e toda regressão de validação/estorno existente; registrar commit.

```bash
rtk proxy npx vitest run src/lib/counting-qr.test.ts src/lib/counting-admission.integration.test.ts src/lib/ops-voucher-validation.test.ts src/lib/ops-voucher-validation-selected.integration.test.ts src/lib/operational-voucher-validity.integration.test.ts
```

**Exemplos obrigatórios:** voucher selecionado para segunda e válido na quarta aberta autoriza; fora do intervalo/quarta fechada não autoriza; serviço não vira pessoa; QR `123-456` não pode validar voucher 456 de outra compra; portaria sem caixa não ganha permissão de desvalidar/reembolsar.

## T5 — Encerramento da contagem e relatórios geral/cozinha

**Criar:** `src/lib/counting-day-report.ts`, `counting-day-report.test.ts`, `counting-day-closure.ts`, `counting-day-closure.integration.test.ts`, `counting-day-export.tsx`, `counting-day-export.test.tsx`, `src/app/contagem/relatorios/page.tsx`, `src/components/counting-day-reports.tsx`, APIs `src/app/api/contagem/dias/[date]/finalizar/route.ts` e `.../relatorios/route.ts`; migração de revisões diárias.

**Modificar:** `counting-day-page.tsx`, `painel-counting-summary.tsx` e DTOs compartilhados de presença necessários.

**Interfaces:** snapshot somente de presença, com IDs das revisões de veículos, day use efetivo, previsão, pendentes e observações. Uma revisão emitida é imutável; consultar relatório atual não substitui arquivo histórico silenciosamente.

- [x] Testar soma conhecida, pendências e igualdade app/painel. Com fixture T3 e 5 entradas day use: geral 19, passeios 14, day use 5; cozinha 14 refeições e 2 PCD como subconjunto.
- [x] Testar encerramento com veículos livres/contando: exige confirmação explícita e lista os pendentes como “não contado”, sem transformá-los em zero confirmado.
- [x] Implementar comando idempotente de finalizar contagem separado de `changeOperationalDayClosure`. Não alterar caixas, recebimentos, recibos, despesas nem `operacao_dias.estado`.
- [x] Proposta para revisões: conclusão emite snapshot e marca conferência concluída; nova contagem de veículos requer “Reabrir contagem” explícito, auditado, sem reabrir financeiro. Entradas QR posteriores continuam permitidas enquanto o dia operacional estiver aberto; o relatório mostra atualização posterior e exige nova emissão para incorporar esses dados.
- [x] Bloquear corridas entre conclusão de veículo/recontagem e emissão de relatório por lock/versão da data; reemissão preserva versão anterior. Financeiro fechado sempre prevalece e impede mutações.
- [x] Relatório geral apresenta modalidades, veículos, contadores, responsáveis e assinaturas autorizadas; cozinha apresenta participantes/equipe/PCD e observações de veículos + `food_notes` do passeio. Não incluir day use nas refeições sem nova regra de negócio.
- [x] Compartilhar somente após toque: `navigator.canShare`/`share` com arquivo quando disponível; cancelar não é erro nem entrega. Alternativas: copiar texto e baixar imagem; textos incluem pendentes e data/revisão.
- [x] Testar exportações com textos longos, assinatura, pendências, dados modificados após emissão, acesso de outro parque e ausência de fonte. Abrir imagens/PDF para conferir corte e paginação; registrar commit.

```bash
rtk proxy npx vitest run src/lib/counting-day-report.test.ts src/lib/counting-day-closure.integration.test.ts src/lib/counting-day-export.test.tsx src/lib/operational-day-summary.integration.test.ts src/lib/operational-day-closure.test.ts
```

## T6 — Compartilhamento manual da filipeta; envio automático adiado

**Executado:** `counting-manual-share.ts`, `counting-share.tsx`, API `/api/contagem/filipetas/[revisionId]/envios` e migração `2026-11-13-counting-manual-shares.sql`.

- [x] Copiar texto e gerar todas as imagens paginadas da revisão assinada.
- [x] Compartilhamento nativo quando suportado; alternativas de download e `wa.me` com destinatário conferido.
- [x] Registrar abertura e declaração manual separadamente, sem afirmar entrega pelo provedor.
- [x] Preservar contagem e assinatura independentemente do compartilhamento; testar histórico, idempotência e autoria no PostgreSQL.
- [x] Não disparar mensagens externas nos ensaios.

**Pendente por decisão explícita do usuário:** confirmar template Brevia. Integração automática, fila, webhook, mídia do provedor, confirmação de entrega e teste externo ficam fora desta entrega. Os antigos passos automáticos desta seção foram substituídos por esse escopo; não são implementações concluídas.

## T7 — PWA, regressão e implantação em homologação

**Criar:** `public/contagem/manifest.webmanifest`, ícones em `public/contagem/`, eventual service worker com escopo `/contagem/` apenas se necessário à experiência validada, `docs/runbooks/counting-app-homologation.md`.

**Modificar:** metadata/layout da contagem, testes correspondentes, plano e registro de execução. Não alterar escopo do site inteiro nem habilitar cache de APIs autenticadas.

- [ ] Manifest com `id`, `start_url` e `scope` restritos à contagem, nome/cores/ícones aprovados, standalone. Testar instalação e retorno do login preservando destino no Android e iPhone; não prometer instalação universal sem teste.
- [ ] Navegação sem internet mostra indisponibilidade; nenhuma mensagem “salvo” sem servidor. Atualização da PWA não substitui app durante assinatura/rascunho pendente.
- [ ] Confirmar banco local isolado e executar suíte completa, lint, tipos, scripts e build equivalentes ao CI. Não contar testes pulados como aprovação.

```bash
rtk proxy npm run lint
rtk proxy npx next typegen
rtk proxy npx tsc --noEmit
rtk proxy npm test
rtk proxy node --test scripts/run-chargeback-sync.test.mjs scripts/hml-release-retention.test.mjs scripts/migrate-operational-panel.test.mjs
rtk proxy npm run build
rtk proxy node scripts/verify-program-renderer.mjs
```

- [ ] Revisar diff e integração: dados históricos, financeiro, entrada, permissões, arquivos privados, recuperação de rede e mensagens. Revisão independente se disponível; declarar indisponibilidade sem fingir revisão.
- [ ] Antes de publicar: conferir remotos/diff da `develop`, preservar alterações locais alheias, backup do banco e arquivos persistentes de HML. Ensaiar migrações em cópia isolada e conferir quantidades/somas/hashes de assinaturas antes/depois.
- [ ] Publicar somente commits revisados na `develop`. Workflow existente `.github/workflows/deploy-vm.yml` faz checks e implantação na VM; conferir SHA efetivo e health, não apenas push bem-sucedido. Implantar receptor compatível antes do emissor se API irmã mudar.
- [ ] Manter dados de contagem anteriores legíveis durante rollout. No rollback, voltar release compatível; não apagar novas contagens nem restaurar banco sobre operações posteriores. Desativar envio automático se receptor/template falhar, mantendo fallback e fila rastreável.
- [ ] Verificar HML em `https://cluberincao.questione.ai/contagem` e painel em `https://cluberincao.questione.ai/painel`. Provisionar contas de teste com permissões explícitas; remover dados sintéticos ao concluir.
- [ ] Executar roteiro abaixo com dois celulares reais e obter aceite. Atualizar PO com implementação efetiva, links, resultados e pendências; não enviar WhatsApp a terceiros sem instrução explícita.

## Roteiro de homologação com dois celulares

1. Monitor A e B entram com contas diferentes; datas futuras só exibem previsto. A abre veículo livre; ambos veem amarelo/nome; B não escreve por cima.
2. A conta todas as modalidades, adiciona PCD escolhendo deficiência, cancela outra inclusão e remove etiqueta; observa totais de participante/equipe. Quantidade acima da previsão é permitida.
3. B assume explicitamente; rascunho salvo aparece; tentativa antiga de A é rejeitada. Perder rede antes/depois de salvar não duplica pessoa/comando nem anuncia sucesso falso.
4. Responsável confere, assina, volta para corrigir; alteração de contagem exige nova assinatura. Prévia contém observações e todas as categorias. Total zero não avança.
5. Finaliza uma vez: veículo verde, painel atualizado, filipeta identificada por revisão. Falha de WhatsApp mantém contagem finalizada; reenvio/compartilhamento manual mostram estado verdadeiro.
6. Recontagem mantém a primeira filipeta/assinatura consultável; recibo financeiro finalizado impede alteração. Veículo extra tem transportador, ordinal estável e indicador previsto + extra.
7. Dois celulares leem mesmo QR: só uma admissão. Conferir data/autor do uso anterior; pagamento pendente, invalidação e validade bloqueiam corretamente; voucher flexível em outro dia aberto autoriza. Nenhum caixa é criado.
8. Encerrar contagem com pendentes: lista explícita, relatórios geral/cozinha corretos, nenhuma alteração no caixa/financeiro. Novo QR posterior identifica relatório desatualizado; nova emissão preserva anterior.
9. Compartilhar/cancelar/copiar/baixar funcionam sem envio automático; cozinha não recebe contato/assinatura. Textos longos e relatório com vários passeios permanecem completos.
10. Instalar/abrir PWA em Android e iPhone; testar câmera, assinatura, sessão expirada, logout com contagem em andamento e retomada online.

## Critério de conclusão e handoff

Concluído somente quando a matriz da análise estiver atendida ou tiver pendência explicitamente aceita, os checks afetados passarem e a release correta estiver em HML. Envio automático pode permanecer pendente apenas com fallback funcional e status honesto, conforme alternativa já prevista no material. Aceite humano separado do resultado técnico.

Estado em 13/11: D1–D3 confirmadas; protótipo navegado; 24 testes unitários da base passaram; documentos/fontes preservados. Nenhum código funcional alterado. Próxima ação: revisão deste plano, depois execução autorizada de T1. Não há processo de implementação em segundo plano.

## Evidência da execução em 13/11/2026

- T1–T6 implementados, com revisões independentes e achados corrigidos. T7 em verificação/publicação.
- 2.106 testes em 377 arquivos passaram com PostgreSQL, sem skips. 21 testes de scripts passaram. Lint sem erros, com 12 avisos preexistentes.
- Navegador a 390 px e 1280 px: contagem→responsável→assinatura→prévia→filipeta, correção invalida assinatura, exportação PNG completa, encerramento/cozinha e histórico.
- Dois contextos: monitor assume último subtotal; aba antiga preserva edição e recebe conflito. Resposta perdida: um POST, recuperação pela mesma chave. Armazenamento contém apenas URL/chave.
- Monitor sem acesso de caixa: endpoint financeiro retorna 403; assinatura de colega autorizado retorna 200. Recontagem inicia todos os campos em zero e mantém filipeta anterior com 5 pessoas.
- Câmera simulada: dois toques fazem um pedido; stream recebido após ocultar a página é encerrado. Câmera física e instalação em Android/iOS dependem da homologação da equipe.
- Backup HML restaurado em cópia isolada; 19 migrações aplicadas duas vezes, preservando valores, contagens, assinaturas e concessões. Detalhes finais no runbook do aplicativo.
