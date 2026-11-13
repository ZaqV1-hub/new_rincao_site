# Painel de gestão Rincão — plano de implementação e implantação

> **Execução autorizada em 12/11/2026:** usuário aprovou todas as recomendações e a implementação. Trabalhar localmente por entregas verificáveis, com revisão; atualizar o Product Owner e enviar para `develop` somente ao final. Não há autorização nova para promover este painel à `main`.

**Objetivo:** colocar em operação a gestão por data, programação do dia seguinte, caixas por local, passeios, contagem, fechamento diário e visão dos donos para Rincão e Estância.
**Arquitetura:** evolução do Next.js existente, preservando compras, vouchers, clientes, tabelas de preço, autenticação e integração de ingressos. Novas regras financeiras ficam no servidor, com transações, auditoria, idempotência e snapshots de fechamento. App de contagem proposto como área web responsiva autenticada, com internet obrigatória, integrada ao mesmo domínio de passeios.
**Stack verificada:** Next.js 16.4.5 no checkout principal, React 19.2.4, TypeScript, pg/mysql2, Vitest, React PDF e ExcelJS. `develop` ainda possui diferenças de versão/implementação que precisam ser reconciliadas antes de fixar a baseline.
**Especificação:** `../specs/painel-gestao-referencias/painel-rincao-dev.md` e `../specs/painel-gestao-referencias/painel-rincao-prototipo.html`, cópias integrais dos anexos.
**Estado:** baseline local integrada; cadastros E1 implementados e verificados localmente em 12/11/2026; E2 com agenda, validade, capacidade e serviços na venda online; E3 com resumo e listas por data implementados localmente. E4 e E5 implementados e verificados localmente; E6 em levantamento. Recomendações da seção 9 aprovadas; detalhes externos precisam de evidência, sem simular integrações existentes.

## 1. Decisões confirmadas e limites

- O usuário autorizou a implementação após revisar o plano. O texto do anexo continua sendo especificação; a autorização vem da conversa. Atualização do Product Owner e envio para develop ficam para o final.
- Confirmado pelo usuário: o app de contagem ainda não existe; precisa integrar o plano.
- Confirmado pelo usuário: o app pode exigir internet. Não implementar fila offline ou sincronização offline nesta versão; mostrar perda de conexão e não afirmar que salvou sem confirmação do servidor.
- Confirmado pelo usuário: finalizar passeio exige recebimento integral. Boleto emitido ou pagamento apenas prometido não equivale a recebido.
- Todas as nove áreas do documento permanecem no escopo. A proposta de liberar o operacional antes do painel dos donos é uma ordem técnica, não exclusão do painel dos donos.
- Protótipo é referência de telas/textos/fluxos. Dados, nomes, datas fixas, assinaturas desenhadas e valores simulados não vão para produção.
- Não criar editor novo de tabelas de preço. Reutilizar o existente.
- Gerar programação e fichas não envia mensagens. O gerente continua enviando os arquivos.
- Estorno/reembolso financeiro real não é consequência automática de marcar uma pessoa como ausente.
- Datas operacionais em `America/Sao_Paulo`; instantes de auditoria armazenados com timezone. Dinheiro calculado em centavos inteiros e persistido em decimal exato, nunca usando arredondamentos independentes no browser.

## 2. Evidências e lacunas encontradas

### Reaproveitamento

| Área | Arquivos existentes relevantes | Evolução necessária |
|---|---|---|
| Agenda e preços | `src/lib/painel-agenda.ts`, `agenda-repository.ts`, `src/components/painel-agenda-manager.tsx`, `painel-agenda-editor.tsx`, `src/app/api/painel/agenda/route.ts` | Agenda como entrada, configuração por data civil, alteração em lote e capacidade online |
| Compras e vouchers | `src/lib/painel-compras.ts`, `voucher-repository.ts`, `ops-voucher-validation.ts`, `src/components/painel-compra-detail-page.tsx` | Filtro por data, caixa de validação, mudança em lote e validade |
| Vendas | `src/lib/ops-box-office-sales.ts`, `painel-bilheteria-sales.ts`, `src/components/painel-bilheteria-workstation.tsx` | Já há pagamentos múltiplos e idempotência; adicionar caixa explícito e serviços |
| Caixa | `src/lib/ops-cash-management.ts`, `ops-cash-closures.ts`, `scripts/run-cash-auto-close.ps1` | Hoje o período é global e pode ser criado automaticamente; movimentos são agrupados por horário. Novo modelo exige local, data e vínculo explícito |
| Passeios/clientes | `src/lib/ops-client-trips.ts`, `painel-client-trip-detail.ts`, `ops-trip-school-report-core.ts`, `src/components/painel-client-trip-detail-page.tsx` | Veículos, contagem, pagamento da escola, recibo e snapshot |
| Segurança | `src/lib/painel-api-auth.ts`, `painel-session.ts`, `ops-session.ts`, `ops-permissions.ts`, `painel-acl.ts` | Permissões específicas de fechamento, reabertura, contagem e donos; autorização em cada endpoint |
| Documentos | `src/lib/ops-trip-school-report-pdf-core.tsx`, `voucher-pdf.tsx`, dependências React PDF/ExcelJS | Novos relatórios usam os mesmos snapshots e renderizadores existentes |
| Implantação | `.github/workflows/deploy-vm.yml`, `scripts/deploy-vm.ps1`, `docs/DEPLOY_VM.md` | Acrescentar gates reais de testes, migração e verificações de negócio |

### Constatações que mudam o plano

1. `main` e `develop` não são cópias equivalentes: comparação local mostrou 77 commits exclusivos em develop e 67 em main, e diferenças em 165 arquivos. Não substituir uma branch pela outra. Inventariar e integrar mudanças mantendo proteções de produção e funcionalidades exclusivas de HML.
2. Baseline principal: `99e22d0`; develop: `1b3d57a`. Validar novamente no início da execução.
3. Na atualização anterior desta conversa, build de PROD local passou; suíte teve 892 testes aprovados, 14 falhas e 8 ignorados. As mesmas 14 falhas foram reproduzidas no commit anterior de PROD. Isso é evidência histórica, não execução de testes deste planejamento. O requisito de suíte integral verde exige saneamento antes da liberação.
4. O HTML contém estado em memória e data fixa 24/10/2026. Navegação verificada em agenda, resumo, passeios, página de passeio, compras da data, caixas, fechamento, dia seguinte, serviços e locais. Não foi feita homologação exaustiva de todos os botões/exportações ou de todas as larguras.
5. Não foi encontrado no HTML um painel dos donos/Estância; essa área tem especificação textual, mas requer desenho próprio antes de implementação visual.
6. Há documentação histórica sobre `estancia-app`/`estancia-ticket-api`, mas não prova que o app de contagem por ônibus exista. O usuário confirmou que não existe.
7. O adaptador de banco suporta PostgreSQL e MySQL e distingue banco de ingresso e banco do sistema. Não assumir que todas as tabelas estão no mesmo banco ou que as migrações PostgreSQL servem para ambos.
8. `authorizePainelApiAccess` não substitui autenticação obrigatória: há retorno permissivo para sessão fora do painel. Novas rotas devem exigir sessão e permissões explicitamente; o perfil `auditor` atual não basta para isolar o painel dos donos.
9. Não existe grafo Graphify neste checkout. Mapeamento feito por leitura direta, sem gerar grafo nem chamar outro provedor.
10. Os repositórios `/Users/juansouza/site-estancia` e `/Users/juansouza/estancia-ticket-api` foram localizados; o primeiro contém módulos de caixa/fechamento equivalentes. Ambos têm mudanças locais preexistentes, preservadas. Banco real, configuração ativa da VM, infraestrutura da Estância, volumes e capacidade de restauração não foram inspecionados nesta análise. São verificações obrigatórias da etapa inicial.

## 3. Abordagem e ordem

**Recomendada:** implementar dentro do sistema existente; app web de contagem como área móvel com permissões próprias; consolidar parques através de contratos de leitura por parque. Menor duplicação de autenticação, banco, ingressos e regras.

**Alternativa:** serviço separado para gestão/contagem. Justificável somente se o levantamento de infraestrutura impedir o caminho integrado; aumenta sincronização e operação.

**Não recomendada:** portar o JavaScript monolítico do HTML ou reescrever todo o painel. Perderia contratos já existentes e preservaria simplificações de demonstração.

Ordem de construção: baseline → fundações/permissões → serviços e locais → agenda → resumo inicial → dia seguinte → caixas → compras/vouchers → app/contagem → fechamento de passeios → fechamento diário/exportações → painel dos donos → homologação integral e produção.

A antecipação de serviços/locais resolve dependências de agenda e caixa. O resumo nasce com contratos reais e ganha as fontes novas conforme prontas; não exibir zero inventado como integração concluída. Liberação operacional só após as dependências necessárias estarem prontas.

## 4. Contratos e invariantes de negócio

### 4.1 Identidade, datas e autorização

- Identidade operacional: parque + data civil; passeio é identificado pelos IDs reais de agenda/cliente, não por nome. Investigar cardinalidade de `agenda_extras` antes de escolher chave única de passeio.
- Não usar data como chave de compra nem considerar toda agenda de uma data como day use. Uma data pode conter day use e múltiplos passeios.
- Operador vende e valida no caixa autorizado; contador acessa veículos atribuídos; financeiro registra recebimentos/despesas e fecha caixas; gerente altera programação, finaliza e reabre com motivo; donos leem somente agregados dos parques autorizados. Mapear estes poderes para ACL existente sem conceder admin por ausência de configuração.
- Todas as rotas: validar sessão, recurso, parque, objeto, data e estado. Negar mutação por simples conhecimento de ID. Auditar identidade do usuário autenticado, não aceitar ator informado pelo cliente como verdade.
- Respostas com pessoas/finanças: `Cache-Control: private, no-store`. Assinaturas, contatos e dados de deficiência não entram em relatórios dos donos; acessos mínimos e URLs privadas.

### 4.2 Receita, recebimentos e dinheiro

- Receita operacional por data de visita = ingressos day use site + ingressos day use caixas + total dos passeios finalizados + serviços − descontos, sem duplicar componentes.
- Compras online de alunos de passeio são excluídas da linha day use. Entram no total do passeio uma única vez quando finalizado.
- O pagamento online não vira dinheiro no caixa que validou o ingresso. Fundo e sangria alteram custódia de dinheiro, não receita nem resultado.
- Dinheiro esperado = fundo inicial + reforços + recebimentos líquidos em dinheiro − sangrias − despesas em dinheiro − devoluções em dinheiro efetivamente pagas. Troco não é receita; não subtrair duas vezes se o recebimento já é líquido.
- Despesa atribuída a passeio integra o resultado diário uma única vez. “Todos os passeios” não multiplica o lançamento pelo número de grupos.
- Registrar separadamente data da visita e data do recebimento. Comparação com extrato usa data do recebimento; resumo do dia usa a regra de visita. Rotular ambas para não prometer conciliação bancária a partir de competência de visita.
- Snapshot fechado permanece imutável. Pagamento tardio, cancelamento, reembolso ou reagendamento posterior gera pendência de ajuste; não altera silenciosamente números fechados.

### 4.3 Cálculo puro do passeio

Criar `src/lib/trip-settlement-calculation.ts` e teste correspondente; valores monetários em centavos. Entradas: contagem por modalidade dos veículos concluídos, participantes pagos no site identificados por voucher/participante, ausentes marcados para devolução, cortesias adulto/criança, preços adulto/criança e versão das categorias não cobradas.

```text
qAd = max(0, adultosContados - adultosSitePresentes - cortesiasAdulto)
qCr = max(0, criancasContadas - criancasSitePresentes - cortesiasCrianca)
aCobrar = qAd * precoAdultoCentavos + qCr * precoCriancaCentavos
siteV = soma dos valores efetivamente pagos atribuídos aos participantes presentes
reembV = soma dos valores efetivamente pagos atribuídos aos ausentes selecionados
totalPasseio = siteV + aCobrar
naoCobrados = coord + pcdCr + pcdAd + acompPcd + filhoProf + isento
```

Caso de aceite: 20 adultos e 30 crianças concluídos; 5 adultos e 10 crianças pagos online; 2 cortesias adulto e 3 criança; preços 100/80 reais; siteV=1.300 reais. Resultado: 13 adultos + 17 crianças a cobrar, 2.660 reais da escola, total 3.960 reais. Alterar preços não altera siteV.

Testar valores zero, quantidades negativas rejeitadas, modalidades não sobrepostas, preços distintos, descontos reais dos itens online, homônimos, múltiplos vouchers da mesma compra, exclusão de ausentes, contagem incompleta, site acima da contagem e arredondamento na distribuição de descontos. Nunca dividir arbitrariamente o total da compra se incluir serviços ou ingressos com preços diferentes.

Finalização: somente recebimentos confirmados cobrindo exatamente a cobrança líquida; excesso só permitido como troco respaldado por dinheiro. Não exigir caixa para Pix/transferência/cartão; qualquer recebimento em dinheiro exige caixa de passeios aberto. Recibo único e snapshot gravados na mesma transação dos vínculos financeiros. Duplo clique não emite segundo recibo. Quando cobrança for zero, permitir recibo sem pagamento fictício, com confirmação explícita das inconsistências.

Contagem incompleta e site acima da contagem continuam como avisos conforme o documento; exigir confirmação registrada do gerente antes de finalizar nesses casos. Proposta de controle a validar na revisão.

### 4.4 Estados e concorrência

- Caixa: aberto → fechado manual/automático. Fechamento não abre outro automaticamente. Reabertura do dia não reabre caixas automaticamente.
- Uma sessão aberta por local/data; vários operadores usam a mesma sessão. Proposta: permitir sessões sucessivas no mesmo local após fechamento, mantendo histórico; o texto do HTML sobre “um caixa por dia” precisa confirmação.
- Dia: aberto → fechado → reaberto com nova revisão; conservar todos os snapshots e motivos.
- Passeio: aberto → pagamento parcial → recebido integralmente → finalizado. Pagamento parcial é persistido, mas não gera receita de passeio finalizado. Correção após finalização exige revisão autorizada, preservando recibo anterior.
- Reembolso: solicitado → em processamento → pago ou falhou/cancelado. Marcar ausência não chama Cielo. Operação externa idempotente e com comprovante; a política inicial manual/automática precisa decisão.
- Contagem: aguardando → contando → concluído; edição concorrente usa versão e devolve 409 quando desatualizada. Reabrir contagem exige permissão e motivo; se passeio já fechou, registrar divergência sem recalcular snapshot.
- Fechamento e venda concorrentes bloqueiam o mesmo caixa/dia em ordem consistente; venda entra integralmente antes do fechamento ou é rejeitada, nunca fica parcialmente registrada.
- Dia seguinte: rascunho/criado/arquivos gerados; “Criado e enviado” é o rótulo solicitado, com explicação de que significa arquivos gerados. Só marcar após exportações concluídas; alteração posterior torna a exportação desatualizada.

## 5. Plano de dados e migrações

Os nomes novos abaixo são propostas. Confirmar catálogo real, schema, tipos, índices e escritores legados antes de produzir SQL executável. Não criar tabelas equivalentes se já houver fonte adequada. Não aplicar DDL durante renderização/GET.

| Lote | Alteração proposta | Regras de migração |
|---|---|---|
| M1 | `operacao_dias`: parque/data, tabela escolhida mesmo sem day use, versão e estado; extensão vinculada à agenda para validade/capacidade | Unicidade por parque/data; preservar `agenda`, `tabpreco`, IDs e preços já vendidos |
| M2 | `servicos_adicionais`, vínculo serviço/data e item de venda com snapshot de nome/preço/canal | `preco_site=NULL` significa indisponível online; zero continua sendo preço válido; catálogo antigo mapeado por ID, sem duplicar históricos |
| M3 | `caixa_locais`; extensão de `caixa_periodos` com local/data/tipo; vínculo de venda, movimento e validação ao período | Backfill determinístico do caixa legado; não inferir local histórico inexistente; registrar “Bilheteria legada” quando necessário e comprovável |
| M4 | Programação por dia, itens de contratação, transportadores referenciados, versão/exportações e snapshot meteorológico | Campos comuns de passeio têm uma fonte única; alterações de transportador/veículos propagam transacionalmente |
| M5 | Veículos por passeio, sessões/revisões de contagem, totais por modalidade e assinatura privada | IDs estáveis, ator e horário; unicidade de evento; categoria versionada; não guardar assinatura como dado público |
| M6 | Recebimentos da escola, pagamentos divididos, despesas, solicitações de reembolso, recibos e snapshots de passeio | Referências únicas de pagamento; valores exatos; vínculo de dinheiro ao caixa; sequência de recibo sem reutilização |
| M7 | Fechamentos diários revisionados e ajustes vinculados à revisão anterior | Snapshot contém entradas, despesas, público, caixas, fontes e versão do cálculo; reabertura não apaga revisão |
| M8 | Contrato de agregados por parque e autorização de leitura dos donos | Adaptar cada parque separadamente; não presumir base compartilhada nem replicar dados pessoais |

Procedimento por lote: inventário → SQL revisado para o dialeto real → ensaio em cópia anonimizada → backup consistente e teste de restauração → expansão compatível → backfill em lotes reiniciáveis → reconciliação → código consumidor → ativação. Remoções de colunas/rotas somente depois de todos os escritores antigos estarem desativados e a janela de retorno encerrada.

Índices necessários: data/status de agenda, compra/voucher por visita e origem, caixa aberto por local/data, movimentos por período, veículos por passeio, contagens por veículo/versão, recebimentos por passeio, fechamento por parque/data/revisão. Fazer EXPLAIN com volume representativo; não validar desempenho só com o protótipo.

## 6. Entregas de implementação

Cada entrega termina com diff revisado, testes do domínio e contratos, teste de integração em banco de ensaio, evidência de homologação e instrução operacional. Não marcar checkbox com base apenas no build.

### E0 — Baseline e segurança de implantação

**Arquivos:** `.github/workflows/deploy-vm.yml`, `docs/DEPLOY_VM.md`, testes legados afetados pela integração de branches.
- [ ] Inventariar diferenças main/develop e escritores externos (legado PHP, microserviço de ingressos, jobs e app de leitura). Escolher integração explícita sem reset e sem publicar automaticamente a reconciliação.
- [ ] Reproduzir e corrigir as falhas conhecidas (15 em develop antes da integração; 14 históricas em main); registrar suite completa de develop e main no commit integrado. Não remover asserts para obter verde.
- [ ] Registrar bancos/dialetos/versões por ambiente e parque, IDs reais de agenda/passeio, volume, capacidade de disco e cópias de segurança; não versionar credenciais.
- [ ] Acrescentar validação de lint/tipos/testes antes da etapa que publica; smoke de negócio complementa `/robots.txt`.
**Aceite:** baseline única de desenvolvimento com regras preservadas, suíte verde, inventário de fontes, restauração ensaiada e relação de responsáveis operacionais.

### E1 — Contratos, permissões e catálogo

**Reusar:** `painel-api-auth.ts`, `ops-permissions.ts`, `painel-acl.ts`, `ops-audit-log.ts`, `painel-shell.tsx`.
**Criar conforme lacunas:** `src/lib/operational-day-contract.ts`, `src/lib/painel-services.ts`, `src/lib/painel-cash-locations.ts`; páginas `/painel/servicos` e `/painel/locais-caixa` e APIs sob `/api/painel/`.
- [ ] Executar M1/M2 e primeira parte de M3; definir IDs e permissões antes de conectar telas.
- [ ] Cadastro ativo/inativo, preços por canal, serviço só bilheteria e inclusão opcional em datas abertas com resumo do alcance.
- [ ] Preservar preços/nomes dos itens históricos; recusar desconto sobre serviço no servidor.
**Testes:** autorização 401/403, isolamento de parque, preço nulo versus zero, inativação sem perda histórica e duas alterações concorrentes.

### E2 — Agenda e day use

**Modificar:** `painel-agenda.ts`, `agenda-repository.ts`, `painel-agenda-manager.tsx`, `painel-agenda-editor.tsx`, página inicial protegida e API de agenda. Mapear consumidores do preço no checkout e na bilheteria antes de editar.
- [ ] Calendário, filtros, selos, seleção futura e atualização em lote com auditoria e validação de todas as datas.
- [ ] Day use com tabela, validade, ingressos, serviços e limite exclusivamente online. Fechar data retira oferta do site sem invalidar venda anterior.
- [ ] Persistir tabela para data ainda sem agenda day use; reutilizá-la ao abrir.
- [ ] Capacidade online considera reservas pendentes com expiração e compras confirmadas; reservar vagas atomicamente e liberar cancelamentos. Documentar contabilização de isentos antes de ativar.
**Testes:** data passada, virada do mês/ano, limite sob concorrência, liberação de reserva expirada, venda no caixa acima do limite, preço correto por canal e preservação de pedido já confirmado.

### E3 — Página da data e apuração comum

**Criar:** `src/lib/operational-day-summary.ts` e `.test.ts`; `src/components/painel-operational-day-page.tsx`. Evoluir `/painel/agenda/[date]` preservando links existentes.
- [ ] Cabeçalho e abas; navegação só para datas com movimento; carregar abas sob demanda e paginar listas no servidor.
- [ ] Uma função de apuração consumida pelo resumo, fechamento, exportações e agregado dos donos. Contrato distingue receita da visita, recebimentos, caixa, público e pendências.
- [ ] Implementar fontes disponíveis; fontes futuras explicitamente indisponíveis até E8/E9, sem totais simulados.
**Testes:** receita online escolar contada uma vez, adicionais não duplicados, desconto aplicado uma vez, sangria sem reduzir receita e público sem somar voucher escolar já contado no ônibus.

### E4 — Programação do dia seguinte

**Criar:** `src/lib/day-program.ts`, `day-program-export.tsx`, `weather-forecast.ts`, componentes de programação e rotas `/painel/agenda/[date]/dia-seguinte` e respectivas APIs.
- [x] M4; montar grupos reais, contatos/endereço, veículos, transportador e lista fixa de contratações. Item adicional permanece disponível para próximas datas conforme protótipo.
- [x] Criação explícita seguida de autosave com versão, indicador salvando/salvo/erro e retry seguro; editar passado exige ação auditada.
- [x] Gerar programação em PDF/imagem e fichas por transportador; transporte do cliente fica fora das fichas. Arquivos usam mesma revisão e itens preenchidos.
- [x] Reutilizar React PDF. Para PNG, provar renderização local de documento/HTML no Windows; adicionar biblioteca somente se as já instaladas não resolverem. Não usar captura dependente de serviço externo para dados das escolas.
- [x] Previsão armazena fonte, coordenadas verificadas, data-alvo, texto e instante da consulta. Datas fora do horizonte e falha da API mostram indisponibilidade; nunca clima fictício.
**Dependência:** fornecedor meteorológico com uso comercial permitido. Open-Meteo gratuito não atende automaticamente essa condição; confirmar alternativa sem custo ou aprovar contratação antes da integração.
**Testes:** conflito de autosave, reabertura, campo faltante, filtro de contratações, ficha agrupada, exportação falha sem mudar status e previsão vencida.

### E5 — Caixas por local

**Modificar:** `ops-cash-management.ts`, `ops-cash-closures.ts`, `ops-box-office-sales.ts`, componentes `painel-bilheteria-*`, `bilheteria-cash-*`, APIs `/api/ops/cash-*`, `/api/ops/box-office/sales`, `scripts/run-cash-auto-close.ps1`.
- [x] Completar M3; substituir agrupamento financeiro só por horário por vínculos explícitos. Revisar todos os chamadores de `getOrCreateOpenCashPeriod` para impedir abertura implícita.
- [x] Abrir somente hoje/local ativo, um aberto por local/data, troco inicial, vários operadores, histórico de sessões.
- [x] Quatro abas: venda, consulta, fundo/sangria e fechamento. CPF obrigatório validado no servidor; cortesias exigem autorizador permitido; pagamento dividido com restante/troco; operação idempotente.
- [x] Sangria concorrente nunca excede saldo. Validação guarda caixa/ator/horário e rejeita voucher usado/fora da validade.
- [x] Fechamento guarda esperado/contado/diferença. Meia-noite fecha sem inventar contado; registra pendência de conferência. Job recupera atraso após indisponibilidade, sem reabrir automaticamente.
**Aceite:** teste com dois caixas e dois operadores, dupla venda, dupla sangria, fechamento durante venda, job repetido e dinheiro conciliado ao centavo.

### E6 — Compras e vouchers pela data

**Modificar:** `painel-compras.ts`, `voucher-repository.ts`, `ops-voucher-validation.ts`, `painel-compra-detail-page.tsx`, componentes de lista e APIs de vouchers já existentes.
- [x] Lista com filtros/contadores, detalhe como página, retorno à data/filtro, itens, pagamentos divididos, histórico, link ao cadastro e ações selecionadas.
- [x] Reagendamento/validade em lote com prévia de elegíveis e rejeitados, nova data aberta, motivo e auditoria; preservar preço pago, identidade do voucher e vínculo correto à compra.
- [x] Validar usado/cancelado/expirado, capacidade e dia fechado. Não chamar rotina de autosserviço do cliente como autorização administrativa.
- [x] E-mail/WhatsApp via mecanismos existentes, com estado pendente/enviado/falhou e repetição sem duplicar. Destino informado precisa autorização e registro, sem expor telefone no log. Entrega externa e compatibilidade do receptor continuam gates de homologação; aceite não é entrega.
**Testes:** IDs de outra compra/parque, concorrência com validação, falha parcial do lote, reenvio, compra com vários ingressos/serviços e movimentação entre dia aberto e fechado.

### E7 — App web de contagem com internet

**Criar:** área `/contagem` com login/sessão própria no sentido de permissões, aproveitando infraestrutura de autenticação existente; `src/lib/trip-counting.ts`, `.test.ts`, componentes móveis e APIs autenticadas de veículos/contagens. Antes disso, apresentar desenho das telas; o HTML do painel não é especificação completa deste app.
- [ ] M5; lista dos passeios do dia → veículos → contagem por modalidade → responsável/WhatsApp/assinatura → revisão e concluir.
- [ ] Mostrar previstos, status, contador, categorias e deficiência quando pertinente, observações; adicionar ônibus/van registra “a mais no dia” e ator.
- [ ] Bloqueio por versão/posse de contagem evita dois operadores sobrescreverem o veículo. Servidor é fonte da verdade; toda gravação confirmada antes de mostrar sucesso.
- [ ] Sem rede: manter campos ainda visíveis, bloquear conclusão, avisar que alterações não estão salvas; confirmar estado do servidor antes de reenviar. Nenhuma garantia de persistência offline.
- [ ] Proposta de atualização no painel: polling autenticado de 5 s enquanto visível, atualização imediata após ação, pausa em aba oculta e indicação de última atualização. Aceite em rede normal: mudança confirmada visível em até 10 s. Se a operação exigir latência menor, avaliar SSE com o proxy existente.
- [ ] Assinatura armazenada em área privada persistente, com limite de tamanho/tipo e acesso auditado; recontagem não altera assinatura anterior.
**Testes:** rede perdida antes/depois do commit, evento duplicado, versão antiga, operador sem acesso, soma por modalidade, duas pessoas no mesmo veículo e painel recebendo atualização real.

### E8 — Passeios, recebimentos e recibo

**Modificar/reusar:** `ops-client-trips.ts`, `painel-client-trip-detail.ts`, `painel-client-trip-detail-page.tsx`, `ops-trip-school-report-core.ts`.
**Criar:** `trip-settlement-calculation.ts`, `trip-settlement.ts`, `trip-receipt-pdf.tsx` e testes; endpoints de recebimento, finalização e revisão por passeio.
- [ ] M6; integrar contagem real e lista completa dos pagos online; busca por nome com ID único para reembolso.
- [ ] Caixa de passeios reutiliza mecanismo de E5 com tipo próprio. Dinheiro, fundos/sangrias/despesas ficam vinculados; Pix/transferência/boleto confirmado independem de caixa aberto.
- [ ] Implementar cálculo da seção 4.3; guardar pagamentos parciais; impedir finalização sem recebimento integral.
- [ ] Prévia de recibo de duas vias; confirmação revalida contagem/pagamentos e grava snapshot/recibo único. Reimpressão usa snapshot original.
- [ ] Relatório inclui veículos, modalidades, responsável/assinatura mediante permissão, cobrança, reembolsos e despesas.
**Testes:** caso numérico, pagamento insuficiente, boleto pendente, valor integral, zero a cobrar, dinheiro sem caixa, envio duplicado, contagem alterada durante prévia e reembolso sem estorno automático.

### E9 — Fechamento diário e exportações

**Criar:** `src/lib/operational-day-closure.ts`, `operational-day-export.tsx`, APIs de fechar/reabrir/exportar. Reusar E3, E5 e E8; aplicar M7.
- [ ] Indicadores, caixas incluindo Passeios, seções recolhíveis, despesas e avisos de contagem/passeio/reembolso/conferência.
- [ ] Fechar em transação coerente com todos os caixas: impedir novas mutações, obter snapshot e fechar sessões. Valores contados ausentes permanecem ausentes, com pendência explícita.
- [ ] Proposta: impedir fechamento definitivo com passeio não finalizado; permitir somente exceção gerencial justificada, se aprovada na revisão. O anexo apenas pede avisos, portanto este bloqueio não é tratado como regra já aprovada.
- [ ] Reabrir exige gerente e motivo, cria revisão e preserva histórico. Corrigir e fechar novamente sem sobrescrever exportação anterior.
- [ ] PDF A4 e XLSX com indicadores/gráficos, caixas, passeios, modalidades, compras, day use, despesas e assinaturas. Exportar cada caixa; neutralizar conteúdo que possa virar fórmula de planilha.
**Aceite:** tela, PDF, XLSX e API têm valores idênticos para mesma revisão; teste de fechamento concorrente, reabertura, pagamento tardio e job da meia-noite.

### E10 — Painel dos donos: dois parques

**Criar proposto:** `/donos`, `src/lib/owner-dashboard.ts`, `owner-dashboard.test.ts`, APIs de leitura e componentes responsivos. Nome/URL final pode ser ajustado à infraestrutura verificada.
- [ ] Inventariar Estância e fazer prova real de leitura de um fechamento. Criar/adaptar contrato de resumo no sistema daquele parque, localizado em `/Users/juansouza/site-estancia`; a API de ingressos está em `/Users/juansouza/estancia-ticket-api`. Não assumir acesso cruzado a banco no browser.
- [ ] Contrato por parque: ID, data, revisão, aberto/fechado, receita, custos, resultado, público, origens e horário da atualização. Cliente indisponível retorna “indisponível”, nunca zero.
- [ ] Autorizar donos separadamente, somente leitura; credenciais de origem restritas a consulta. Identidade parque+data evita colisão entre IDs iguais das bases.
- [ ] Dia/mês/ano, comparação anterior, mês corrente pelos mesmos dias do mês anterior com limite no último dia daquele mês, gráficos/tabelas e exportações mensais.
- [ ] Cores azul/verde com rótulos acessíveis; tela móvel; dados fechados pelo snapshot e abertos identificados como provisórios.
**Testes:** janeiro/dezembro, fevereiro e ano bissexto, mês parcial, dia sem movimento, parque fora do ar, cache segregado, tentativa de mutação e igualdade com os fechamentos de origem.

## 7. Qualidade, homologação e operação

### Verificações por mudança

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
node --test scripts/run-chargeback-sync.test.mjs
npm run build
```

Adaptar a seleção de testes de scripts à revisão integrada; não usar o teste de chargeback como substituto dos testes novos. Testes de integração precisam de banco isolado compatível com o ambiente real, migrations aplicadas e dados sintéticos; variáveis de produção nunca entram no runner. Adicionar cenários de navegador ao harness já disponível, instalando runner no projeto somente se necessário para repetição em CI.

### Roteiro ponta a ponta de aceite

1. Gerente cria serviços/local, escolhe preço em datas futuras e abre day use com capacidade pequena; cliente compra no site e não ultrapassa o limite sob duas requisições simultâneas.
2. Dois operadores abrem locais distintos; vendem ingresso/serviço com pagamento dividido e CPF; tentam desconto indevido; registram fundo/sangria; validam voucher e conferem uso duplicado.
3. Gerente monta programação com dois grupos e um transportador, gera materiais reais; outro operador altera a programação e recebe controle de versão correto.
4. Contador acessa o app em celular, conta ônibus/van e coleta assinatura; gerente observa atualização. Simular internet interrompida e reconexão.
5. Escola tem adultos/crianças pagos online e ausente para reembolso; registrar pagamento parcial e comprovar bloqueio; completar, emitir duas vias e reimprimir sem duplicar receita.
6. Lançar despesas por formas diferentes; fechar caixas, conferir diferenças; fechar/reabrir/fechar dia; comparar todos os números em tela/PDF/XLSX.
7. Donos consultam dia/mês/ano dos dois parques; comparar snapshots e testar indisponibilidade de um parque sem sumir com o outro.
8. Ensaiar virada da meia-noite, job atrasado, rollback de código, restauração de backup em ambiente isolado e retomada de pagamentos/contagens.

Acessibilidade: teclado/foco e fechamento de modais, labels/erros, contraste, status sem depender só de cor, tabelas navegáveis e alvos de toque. Validar desktop 1440 px e celulares 390/360 px; impressão A4 com nomes longos e centenas de linhas, sem corte de totais/assinaturas.

Meta inicial proposta de desempenho: interação de venda sem duplicação, resumo com consultas agregadas sem N+1, contagem visível em até 10 s, relatórios grandes gerados sem bloquear atendimento. Fixar metas de latência com a capacidade real da VM no E0, em vez de prometer números sem medição.

## 8. Implantação completa

### Ambientes conhecidos por configuração do repositório

| Ambiente | Branch | Domínio | Node | Release/persistência |
|---|---|---|---|---|
| HML Rincão | develop | https://cluberincao.questione.ai | 8062 loopback | `C:/Deploy/Rincao/hml` e `C:/SitesData/Rincao/hml` |
| PROD Rincão | main | https://cluberincao.com.br | 8061 loopback | `C:/Deploy/Rincao/prod` e `C:/SitesData/Rincao/prod` |
| Estância | a inventariar no E0/E10 | não verificado | não verificado | não verificado |

O workflow atual publica automaticamente em push de develop/main. Planejar PRs e gates antes da promoção. A autorização de implementação não deve ser confundida com autorização de publicação; confirmar o escopo de deploy quando a execução for pedida.

### Antes da primeira homologação

- [ ] Responsáveis nomeados: gerente valida operação, financeiro valida números, responsável técnico aprova migrations/releases e donos validam consolidado.
- [ ] Bancos, filas, credenciais Cielo/ticket API e canais de mensagens separados; em HML destinos controlados, sem cobranças ou mensagens reais acidentais.
- [ ] Backup de banco consistente, assinaturas/uploads/configuração persistente e inventário dos jobs; restauração ensaiada e espaço suficiente para release anterior + nova + backup.
- [ ] Introduzir chave de ativação por parque/data de corte se coexistência for necessária. A chave deve proteger backend e escritores, não apenas menu.
- [ ] Ensaiar migrations em dados representativos; comparar contagens de linhas e somas de dinheiro antes/depois. Corrigir órfãos via plano específico, nunca apagar para passar validação.

### Publicação em HML

1. Aprovar diff, migrations e baseline; gates verdes; selecionar SHA explícito.
2. Aplicar somente expansão compatível em HML, com registro de versão/checksum e backup.
3. Publicar develop pelo fluxo existente; build no Windows com `npm ci`, standalone e assets, release imutável e troca de `current.txt`.
4. Verificar porta, domínio, autenticação, sessão, consulta a banco, data, venda de ensaio e jobs. Health de `/robots.txt` sozinho não comprova operação.
5. Executar roteiro completo com gerente/caixa/contador/financeiro e registrar evidências. Corrigir sem promover falhas conhecidas.
6. Homologar Estância e contrato de agregados em seu ambiente antes de expor o consolidado como completo.

### Corte para produção

1. Definir janela de baixo movimento e data de corte operacional; fechar/reconciliar caixas legados antes de começar caixa novo. Se não houver janela sem caixa aberto, preparar transição específica antes de publicar.
2. Revisar SHA final de main e diferenças com HML; os hashes podem diferir por merge, mas a árvore relevante e o artefato publicado precisam estar identificados e validados. Não promover branch inteira sem revisar mudanças exclusivas.
3. Backup e captura dos totais/recibos/pagamentos/caixas atuais; aplicar migrations expansivas previamente ensaiadas.
4. Publicar release, validar saúde funcional e ativar primeiro para equipe piloto/data autorizada. Evitar escritores legados e novos atuando simultaneamente sobre caixa migrado.
5. Primeiro dia acompanhado: venda, entrada, passeio, recibo e fechamento com conferência paralela do financeiro. A comparação é de leitura; não lançar a mesma venda nos dois sistemas.
6. Ativar demais operadores após aceite. Liberar painel dos donos quando ambos os parques fornecerem números conciliados. Treinar consulta de erros, reimpressão, reabertura e incidente de rede.
7. Confirmar jobs de meia-noite, pagamento/reembolso e backup, alertas de falha e evidência do primeiro fechamento. Monitorar intensivamente o primeiro dia completo e revisão no dia seguinte.

### Rollback e correção sem perda de dados

- O deploy existente retorna à release anterior em falha de saúde, mas NÃO desfaz banco nem pagamentos. Validar que a release anterior é compatível com migrations expansivas.
- Antes da primeira gravação nova: desativar recurso e restaurar release anterior pelo procedimento de `docs/DEPLOY_VM.md`.
- Depois de vendas/contagens/recibos no novo modelo: pausar as mutações afetadas; conservar registros; identificar última versão que entende esses registros; preferir correção adiante ou adaptador validado. Não voltar a escritor legado incompatível.
- Não restaurar backup antigo sobre pagamentos novos. Restauração só com plano de reconciliação e autorização específica; reprocessamento exige chaves de idempotência e referências do gateway.
- Critérios de interrupção: diferença de centavos sem explicação, recibo duplicado, venda fora do caixa, acesso indevido, perda de contagem/assinatura ou falha no fechamento. Registrar início/fim, SHA, migrations, ações e responsável.

## 9. Recomendações aprovadas e verificações operacionais

| Decisão | Diretriz aprovada; verificar detalhes na etapa | Etapa dependente |
|---|---|---|
| Fontes da Estância | Inspecionar os repositórios locais encontrados, confirmar ambiente e contrato real; validar leitura e forma de gerar fechamentos naquele parque | E0/E10 |
| Reembolso de ausentes | Começar por pendência financeira com execução manual e comprovante; estorno automático só após definir gateway/parcelas/reembolso parcial | E8 |
| Validade | Explicitar início, último dia inclusivo, seis meses calendários, possibilidade de usar em data distinta e impacto na capacidade | E2/E6 |
| Caixa após fechamento no mesmo dia | Permitir nova sessão por local, nunca duas abertas; preservar a anterior | E5 |
| Pendências no fechamento diário | Bloquear por padrão; gerente pode autorizar exceção com motivo e pendências visíveis. Não permite finalizar passeio sem recebimento integral | E9 |
| Histórico dos donos | Fechamentos novos confiáveis a partir da data de corte; histórico anterior apenas com reconstrução e reconciliação próprias, identificado como legado | E10 |
| Meteorologia | Fornecedor permitido para uso comercial e coordenadas do parque verificadas; indisponibilidade explícita até contratação/configuração | E4 |
| Categorias e recibo | Faixas etárias confirmadas em 13/11/2026: seguir o sistema atual (adulto a partir de 10 anos, criança de 4 a 9 e isento até 3), inclusive contagem/passeios. Validar demais nomes, grupos não cobrados, sequência de recibos e quem pode autorizar exceções | E7/E8 |

Não há estimativa responsável de prazo fechado sem E0, definição das fontes da Estância e aceite do app de contagem. Sequenciar entregas por dependência; o caminho crítico é baseline → caixa/contagem → fechamento passeio → fechamento dia → integração dos donos.

## 10. Critério de conclusão

- [ ] Todos os nove módulos do anexo e app de contagem possuem dados persistentes, autorização, testes e aceite operacional.
- [ ] Suíte integral verde no SHA candidato; integrações reais ensaiadas em ambiente isolado; nenhum resultado de mock apresentado como integração validada.
- [ ] Vendas/recebimentos/despesas/reembolsos/recibos e público conciliados em todos os relatórios sem duplicação.
- [ ] Migrations/backfill auditados, rollout e rollback ensaiados, rotinas de backup/alerta operando.
- [ ] Equipe treinada e primeiro dia real fechado e conferido; donos veem dados dos dois parques com origem/status corretos.

## 11. Referências verificadas e continuidade

- Arquivos do projeto citados acima e `docs/DEPLOY_VM.md`; configuração é evidência do desenho, não prova de estado atual dos servidores.
- Next.js: documentação local `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` e consulta Context7 da versão 16.4.5. GET Route Handlers não são cacheados por padrão; preservar isolamento explícito de respostas sensíveis.
- Meteorologia: https://open-meteo.com/en/pricing e https://open-meteo.com/en/terms consultados em 12/11/2026. A API gratuita é destinada a uso não comercial; a produção do parque exige escolha compatível.
- Continuidade atual na seção 12; os anexos foram preservados no repositório para o plano não depender da pasta Downloads. As evidências iniciais de análise não substituem as verificações registradas durante a execução.

## 12. Execução — 12/11/2026

- Base inicial: develop `b5a62a7`; main `7d9d4e0`; 79/69 commits exclusivos, respectivamente. Reconciliar antes da implementação funcional.
- Workspace isolado: `/Users/juansouza/.codex/worktrees/painel-gestao/new_rincao_site`, branch `codex/painel-gestao`. O checkout original e os anexos foram preservados.
- Product Owner: usuário esclareceu o significado de PO. Atualização apenas ao final; destinatário/canal ainda não especificados.
- Nenhum push, migração remota ou publicação do painel executados.
- Ruling: corrigir os testes da baseline integrada, não editar duas cópias divergentes de regras financeiras; investigar antes de alterar expectativas.
- Baseline integrada no commit `d5d91e5`, sem perda das mudanças de main/develop. Núcleo puro do cálculo do passeio em `be3edd8`, revisado independentemente; a integração financeira E8 continua pendente.

### Pendência de negócio — Estância (orientação do usuário)

Fetch realizado em ambos os repositórios. `site-estancia` local develop/main e remotas origin/codex/develop e origin/main estão em `bb2ec9d` (04/11/2026). `estancia-ticket-api` local/main e origin/main em `5d4687b` (24/06/2026). Alterações locais preexistentes preservadas.

A seção 9 do anexo exige custos/resultado dos dois parques, mas não especifica a origem/lançamento dos custos da Estância. O código atualizado consultado não fornece fonte completa. Por instrução do usuário, marcar como pendente e perguntar ao Zaq antes de implementar regra presumida.

**Pergunta para o Zaq:** Na Estância, as despesas devem ser lançadas pelo mesmo fluxo de despesas diárias/passeios descrito para o Rincão, ou o painel dos donos deve consumir uma fonte existente? Se existir, qual sistema/planilha e quais despesas entram no resultado por data de visita?

Sem resposta, custos e resultado da Estância ficam indisponíveis; não apresentar zero nem resultado fictício. Não criar novo módulo de despesas da Estância por suposição. Pergunta preparada, ainda não enviada (canal/destinatário não identificados).

### Verificação E1 e infraestrutura

- Cadastros de serviços/locais com preço site nulo versus zero, ativo/inativo, auditoria, escopo por parque e edição por versão. APIs exigem sessão do painel; somente gerente altera. Telas e menu integrados. Integração desses serviços às vendas/agenda fica para E2/E5, sem afirmar que o catálogo já substitui o legado.
- Migração expansiva aplicada apenas em PostgreSQL local isolado. Executor `scripts/migrate-operational-panel.mjs`: `--check` somente leitura, `--apply` transacional, journal/checksum e lock. Nenhuma migração remota.
- Verificações: 1027/1027 testes passam, zero ignorados, incluindo 16 integrações em PostgreSQL 16.15 (VM 16.14). Scripts 21/21; lint zero erros/14 avisos existentes; tipos/build passam. Build mantém aviso existente de tracing em `rincao-content-store.ts`. Revisão independente resolveu dois problemas de UI e encerrou sem achados pendentes.
- Browser local: cadastro real, valores por canal, zero versus indisponível, conflito de versão sem reload, nome duplicado corrigível e perda simulada da resposta após commit real (consulta retorna exatamente um registro). Layout 1440/390 px e formulário 360 px. Dados de ensaio descartados junto do container PostgreSQL17; desenvolvimento agora PostgreSQL16 na porta54422.
- Acesso confirmado via SSH com a chave indicada pelo usuário; helper `.data/vm.py` não encontrado, usado SSH direto. Azure não participa do ambiente ativo. HML/PROD usam PostgreSQL16.14 em loopback:5432, bancos separados. Leitura real confirmou releases esperadas.
- Dumps semanais de 08/11 dos três bancos: hash/tamanho e `pg_restore --list` conferem. Falha global do backup vem de outra instância MySQL; não é falha dos dumps alvo. Restauração atual e arquivos persistentes ainda não comprovados. Disco VM ~8,14GiB livre; sync Estância retorna1; escritores legados ativos precisam mapeamento antes do corte.
- Limite local: Mac atingiu falta de espaço durante teste temporário; artefatos `.next` deste worktree foram removidos, testes de scripts repetidos e passaram. Não apagar arquivos alheios para liberar espaço.

### Validade — decisão de 12/11/2026

O usuário escolheu permitir uma utilização em qualquer dia com day use aberto dentro da validade, sem reagendamento. Início na data da visita escolhida; intervalo precisa ser mostrado com início/fim explícitos no voucher. Limite de vendas online é separado da admissão em dia alternativo. Isentos continuam contabilizados como vaga de compra, conforme recomendação comunicada; não excluir silenciosamente categorias do limite. Datas efetivas de uso e da venda precisam permanecer distintas para apuração.

### Marco local E2 — agenda, validade e capacidade (12/11/2026)

- Configuração por data com versões, auditoria, tabelas em lote, ingresso/serviços habilitados, limite online e preservação das compras anteriores. Calendário inclui agendas de grupos e torna explícita a diferença entre agenda e quantidade de passeios.
- Novos vouchers guardam início/fim da validade e parque: uma utilização em qualquer day use aberto dentro do intervalo, sem reagendamento; impressão, PDF, cliente e WhatsApp preservam esse intervalo. Legado não foi recalculado. Data esgotada para novas vendas continua permitindo o uso de ingressos válidos.
- Reservas de capacidade com concorrência transacional, isentos contados, tentativa de pagamento durável, cancelamentos revalidados e confirmação tardia sem vaga mantendo pagamento confirmado e entrega retida. Portaria, recuperação e reenvio respeitam retenção.
- Verificado: 1.207/1.207 testes em PostgreSQL 16.15 local; 21/21 testes dos scripts; lint sem erros (14 avisos anteriores), TypeScript e build aprovados. O aviso de rastreamento dinâmico de arquivos preexistente permanece. PostgreSQL 17.11 também passou durante recuperação do Docker.
- Navegador com API/banco locais: criação do dia, intervalo, lote em data sem agenda, conflito de edição preservando rascunho e perda de resposta após gravação. Inspeção em desktop e celular; correções de contraste do mês e texto compacto no calendário.
- Duas revisões independentes por escopo: capacidade/entrega e configuração/calendário. Achados corrigidos, com regressões de concorrência, status legado e grupos. O executor aplicou e reconheceu como já aplicadas as três migrações no banco local isolado.
- Ainda pendente nesta etapa: oferta dos serviços e tipos habilitados na compra online, classificação histórica dos itens e compatibilidade do serviço externo de ingressos/scanners. Não publicado em develop/main e nenhuma migração remota executada. E3–E10 continuam pendentes.

### Marco local E2/E3 — serviços e página da data (12/11/2026)

- Oferta online usa ingressos habilitados e serviços ativos atribuídos à data/parque. Preço site nulo não oferece o serviço; zero é válido. Compra grava nome, preço e identidade do serviço, sem desconto de indicação; limite de capacidade conta somente pessoas. Limite técnico de 500 unidades por pedido protege a geração de vouchers, incluindo serviços.
- Resumo por data distingue receita da visita e entrada efetiva, com apuração única em transação de leitura consistente. Valores de passeios/caixas/despesas/fechamento ainda indisponíveis até as etapas correspondentes; subtotal explicitamente parcial. Agendas legadas ambíguas geram aviso sem ocultar a apuração.
- Compras e passeios carregam sob demanda, 20 itens por página. Acesso exige agenda e permissão do módulo; escolas preservam a alternativa vis_escola. Valores de compra correspondem somente aos itens da data, sem rateio inventado. Vínculo de passeio usa agenda e cliente.
- Revisões independentes corrigiram quantidade ilimitada de adicionais, preço desatualizado na prévia, bloqueio de resumo por agenda ambígua, precedência do nome do comprador e permissão de escolas. Navegador local confirmou paginação, resposta atrasada sem trocar aba, acesso 403 e recuperação, teclado e larguras 360/390/1440; cabeçalho móvel corrigido após inspeção.
- Compra sintética via API/banco: adulto 120 com indicação a 90 e dois serviços a 19 = 128 reais; três vouchers, uma vaga, desconto de 30 somente no ingresso. Prévia atualizou o serviço de 17,35 para 19 sem recarregar a página. Nenhuma cobrança externa realizada.
- Banco de runtime sintético restaurado do PostgreSQL17 temporário para PostgreSQL16.15 local, com quatro migrações reconhecidas; cluster temporário parado. Docker recuperado após limpeza autorizada de caches (4.147.812 KB liberados). Não houve exclusão de arquivos pessoais, migração remota ou publicação.
- E4–E10, compatibilidade dos scanners externos, homologação real e gates de infraestrutura continuam pendentes. Develop e Product Owner ficam para o final, conforme instrução do usuário.

Verificação final do marco E2/E3: 1.284/1.284 testes em PostgreSQL16.15, sem ignorados; 21/21 scripts; lint sem erros e 14 avisos preexistentes; tipos/build aprovados. Mantém aviso preexistente de tracing dinâmico. Migrations locais conferidas; sem publicação.


### E4 — programação e previsão implementadas localmente

- Programação explícita por data, autosave versionado, contatos por passeio, veículos estáveis, contratações e leitura de passado com alteração auditada. Calendário/resumo/navegação usam fingerprint atual em lote; mudança de cliente, venda ou previsão invalida a indicação de arquivos atuais.
- PDF e PNG da programação e fichas separadas por transportador, com snapshot imutável e confirmação após renderização. Nenhuma mensagem enviada automaticamente. Browser real: criar/editar, conflito409 com rascunho preservado, resposta perdida apóscommit sem retryautomático, teclado/modal,360/390/1440semoverflow, ZIP real com4arquivos íntegros e imagens inspecionadas.
- Usuário leu/aceitou https://docs.api.met.no/doc/TermsOfService em12/11/2026 e autorizou MET Norway. Coordenadas Rincão verificadas no mapa existente, truncadas a4decimais. Uma consulta real retornou previsão para20/11; nova consulta reutilizou cache com mesmo queriedAt. AtribuiçãoMET/CCBY4 e horários visíveis. Dataspassadas/fechadas preservam snapshot; falhas/consulta interrompida deixam aviso; Estância sem coordenadas verificadas permanece indisponível.
- Windows: prova emmemória no repositório HML comSharp0.34.5 gerouPNG3700bytes,280x51. Release atual falhou porDLLs omitidas no standalone; inclusão explícita no tracing corrigida para próxima build. Novo verificador geraPNG no artefato empacotado antes de ativar release e também noCI. ArtefatoSharp0.35.5 verificado localmente; nova release Windows ainda exige homologação, sem alteração remota.
- Validação final local:1409/1409testes emPostgreSQL16.15,312arquivos,0skips;21scripts;lint0erros14avisoslegados;tsc/buildpassaram. Revisão independenteP2cacheinterrompido corrigido e rechecado. MigrationsM4 eprevisão aplicadas somente noPGlocal.
- Próxima etapa E5: inventário concluiu que caixa atual usa seleção global/horário e abertura implícita. Estender tabelas existentes com vínculos explícitos e snapshot, adaptar todos os escritores; scanner/serviço externo continua gate operacional. Relatório detalhado na pasta local de execução e5-cash-inventory.md. Sem pushdevelop/produção e sem contato aoPO.


### E5 — caixas por local implementados e verificados localmente

- Sessões explícitas por parque, data e local, com abertura somente hoje, troco inicial, operadores autenticados, fechamento manual e automático sem abrir sucessor. Vendas, recebimentos, movimentos e validações guardam vínculos próprios; registros históricos sem local permanecem legados, sem inferência por horário.
- Quatro abas, CPF obrigatório, serviços pelo preço da bilheteria (inclusive exclusivos desse canal), cortesias autorizadas, pagamentos divididos, troco e comandos idempotentes. Tentativas sem resposta preservam dados e chave; conferência continua disponível após fechamento ou mudança de data. Resposta antiga de uma tentativa não substitui snapshot fechado.
- Validação guarda local, instante e operador; mantém a validade em qualquer dia aberto do intervalo. Serviços não aumentam o público. Pagamentos online não viram dinheiro do caixa de validação. Sangria não excede o saldo; dinheiro não contado permanece ausente no fechamento automático.
- Rotas e páginas financeiras exigem sessão do painel e vis_bilhet. Atores vêm da sessão. Caminhos antigos orientam para os novos caixas; falta de caixa ou erro de leitura não exibe saldo zero inventado. Reconciliação do caixa legado exige gerente; histórico continua separado dos novos snapshots.
- Revisão independente corrigiu leitura de vínculo financeiro após bloqueio concorrente, reserva de outro parque, transação que atravessa a meia-noite, repetição de resposta antiga sobre caixa fechado e liberação de controles durante consulta ainda pendente. Testes de regressão verificam cada caso.
- Verificação final: **1.595 testes passaram em 333 arquivos, sem ignorados**, incluindo PostgreSQL 16.15 isolado; **21 testes de scripts passaram**; lint sem erros e 12 avisos preexistentes; TypeScript e build aprovados. As sete migrações estão aplicadas e com checksum conferido apenas no banco local.
- Navegador e banco reais de ensaio: compra de 160 reais (ingresso 130 + serviço exclusivo do caixa 30), Pix 60 e dinheiro entregue 150 com troco 50. Resposta perdida após gravação; mesma compra recuperada após fechamento, sem duplicar venda ou pagamentos. Troco inicial 100 + dinheiro líquido 100 + fundo 50 − sangria 20 = saldo e contado 230, diferença zero. Validação identificou operador, horário e local; consulta preservou o caixa após navegação. Larguras 360/390/1440 sem overflow.
- Relatório de caixa usa o mesmo snapshot na tela e impressão A4; PDF de duas páginas gerado pelo navegador, margens e páginas inspecionadas visualmente no artefato standalone. Arquivo de ensaio local: /tmp/rincao-e5-cash-1-final.pdf. Nenhuma cobrança ou mensagem externa enviada; serviço de ingressos não configurado no ambiente isolado.
- **Gate de publicação:** E6 deve proteger os escritores antigos de edição/reagendamento de compra e passeio encontrados no inventário. A contagem de caixas já alimenta o resumo; recebimentos completos de passeios, despesas e fechamento diário seguem E8/E9. Homologação da VM, restauração comprovada e corte dos escritores externos ainda necessários. Nada enviado à develop/main ou ao Product Owner.

### Decisões de 13/11/2026

- Usuário confirmou que as idades devem seguir o sistema atual: adulto a partir de 10 anos, criança de 4 a 9 anos e isento até 3 anos. Não adotar as faixas 12+/4–11 do protótipo. Decisão registrada para E7/E8; nenhuma alteração comercial necessária.
- Custos/despesas da Estância continuam pendentes. O usuário confirmará com Isaque e pediu uma mensagem pronta para ele próprio encaminhar por WhatsApp, contextualizando vendas/caixa/fechamento existentes e a falta de fonte completa de despesas identificada no código. Não enviar mensagem diretamente nem presumir novo módulo ou integração.

### E6 — leitura e ações selecionadas: checkpoint local em 13/11/2026

- Lista por data com filtros de origem/tipo, busca e contadores, retorno preservando contexto; detalhe coerente em uma transação de leitura, validade e uso real, recebimentos individuais e histórico com projeção segura.
- Validação/desvalidação somente dos IDs selecionados, conferidos contra compra/parque após locks; caixa de vendas explícito. Impressão selecionada com QR local e validade preservada. Fluxos legados de edição, reagendamento e cancelamento protegidos contra operações financeiras/fechamentos concorrentes.
- WhatsApp possui diário privado idempotente e auditoria antes do despacho. Aceite/enfileiramento não significam entrega; resposta incerta mantém a mesma solicitação. Destino só aparece mascarado. Nenhuma mensagem externa foi enviada nos testes.
- Verificação em 12/11: 1.838 testes com PostgreSQL, 21 testes de scripts, build e tipos passaram; lint sem erros, 12 avisos preexistentes. Browser verificou seleção, caixa/ator/horário, impressão/PDF, retorno, filtros concorrentes e recuperação de pedido com resposta perdida. Em 13/11, revisão manual encontrou e corrigiu cancelamento de reserva já confirmada sem dados legados de recebimento; 109 testes afetados passaram, incluindo regressão primeiro falhando.
- Revisões independentes de lista/detalhe/UI/WhatsApp concluídas. Revisão independente final dos escritores legados e da correção do limite de corpo foi interrompida por limite de uso do agente; coordenador concluiu a leitura desses escopos e registrou essa limitação. Não declarar revisão independente final completa.
- Ainda pendentes nesta etapa: mudança de data/validade em lote, aviso por e-mail e integração das pendências de ajuste após fechamento. O protótipo restringe o lote a compras inteiras de day use; compras escolares não são selecionáveis. Não há reagendamento automático por previsão de chuva.
- Custos e resultado da Estância permanecem indisponíveis até confirmação do usuário com Isaque; essa pendência não bloqueia as demais etapas autorizadas.

### E6 — lote e avisos: checkpoint local em 13/11/2026

- Prévia e confirmação de até 100 compras/1.000 vouchers, somente day use inteiro. Uma transação preserva preços/IDs, revalida a prévia e transfere somente reservas online existentes. Isentos ocupam vagas; serviços não. Compras não confirmadas, usadas, canceladas, vencidas, retidas ou escolares são rejeitadas com motivo.
- “Manter data final atual” conserva o vencimento absoluto; nova visita posterior a ele exige escolher outra validade. Não se inventa uma duração histórica. Alteração de validade sem mudança de visita mantém agenda e reserva de vagas.
- Histórico fechado gera `purchase_adjustments` pendente sem mudar vouchers, vagas ou recibos. A resolução dessas pendências integra E9; não considerar a criação da pendência como alteração já aplicada.
- Avisos usam a configuração SMTP existente e uma fila privada transacional, separada do consumidor legado que pode repetir envios. Claims são confirmados antes do SMTP, com cinco envios por requisição, sem retry de resultado incerto. UI processa os avisos autorizados e permite consultar/retomar os lotes do operador. Aceite SMTP não equivale a entrega; ausência de configuração deixa pendente.
- O protocolo de capacidade agora detecta mudança de data entre descoberta e lock e desfaz a tentativa de pagamento. Sessão expirada/negada e conflito de chave preservam comandos sem confirmação no navegador. Coluna opcional de checkout escolar lida sem exigir sua existência nas bases legadas; comprovado contra a base local e em duas regressões.
- Verificação: 1.911 testes/348 arquivos com PG16, nenhum skip; 21 testes de scripts; lint sem erros e 12 avisos anteriores; build/tipos passaram. Um erro de tipo na fixture de validade sem data foi corrigido, seguido de 30 testes afetados e novo build completo. Browser móvel 390 px comprovou prévia, mudança de duas compras, lista/histórico atualizados e recuperação da mesma chave após commit real com resposta perdida, sem duplicação. Nenhum envio externo.
- Migração local `2026-11-13-purchase-batches.sql`, checksum `51208e3998d92006941174c7941e1157e71f1bac7691f91471eed913f0733e39`. Revisão manual do coordenador; revisão independente adicional indisponível por quota já registrada. Compatibilidade do receptor externo de vouchers, restauração/arquivos e homologação Windows seguem gates anteriores. Sem push/deploy/atualização do PO neste checkpoint.
