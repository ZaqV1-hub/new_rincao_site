# Plano de dossiê de contestação Cielo

> Para execução futura, usar o fluxo `superpowers:executing-plans` por entrega verificável. Este documento reúne a análise e a proposta solicitadas em 03/11/2026. As tarefas de implementação estão pendentes.

**Objetivo** — Receber contestações, identificar a cobrança e a compra, reunir evidências, gerar e apresentar a defesa à Cielo e acompanhar seu resultado automaticamente, sem cadastro, montagem de documento ou aprovação humana por caso no fluxo normal.

**Arquitetura proposta** — Aproveitar PostgreSQL, autenticação do painel, auditoria, jobs e `@react-pdf/renderer` existentes. O webhook e a reconciliação programada alimentam um processamento persistente de coleta, geração, verificação e envio pela API de Chargeback. O admin mostra documentos, recibos, resultados e exceções. As três entregas abaixo são etapas técnicas de um único resultado completo, com envio automático obrigatório.

**Base examinada** — `develop` em `cfda28c`. Comparação pontual com `main` em `cb9baf4`. A revisão implantada e os dados de produção não foram consultados. O plano usa os caminhos de `develop`, onde alguns módulos estão divididos em arquivos que permanecem agrupados em `main`.

## 1. O que existe

| Capacidade | Evidência no repositório | Aproveitamento e limite |
| --- | --- | --- |
| Botão Gerar Resumo | `src/components/painel-compra-detail-actions.tsx` | Disponível nos detalhes de compra. |
| Endpoint PDF autenticado | `src/app/api/painel/compras/[purchaseId]/resumo/route.ts` | Exige `vis_compra`, responde PDF privado sem cache. Gera o arquivo na consulta, sem arquivar uma versão. |
| Renderização do resumo | `src/lib/painel-purchase-summary-pdf.tsx` | Inclui comprador/CPF, compra, pagamento, valor, identificador do pagamento, vouchers e uso parcial ou total com data/hora. |
| Consulta dos dados | `src/lib/painel-compras.ts`, `getPainelPurchaseDetail` | Lê `compra`, `usuario`, `pagpagseguro`, `voucher`, `agenda` e dados escolares pelo pool do sistema. Seleciona uma linha de pagamento por compra. |
| Registro de utilização | `src/lib/ops-voucher-validation-shared.ts` e operações de validação | `stusado = 's'`, `dtuso`, `hruso`. A desvalidação limpa data/hora. A invalidação escreve data/hora nesses mesmos campos, com `stusado = 'inv'`. Data preenchida, isoladamente, não identifica entrada. |
| Auditoria de validações | `src/lib/ops-voucher-validation-audit.ts`, `src/lib/ops-audit-log.ts` | `edicoes_log` guarda ação, horário, operador, modo, vouchers e compras afetadas. Inclui validação, desvalidação e invalidação. |
| Consulta de auditoria | `src/lib/ops-audit-history.ts` | Filtro de compra consulta apenas `compra_id`, com paginação até 100 itens. Operações de várias compras podem ter `compra_id` nulo e IDs dentro de `detalhes_json`. |
| Pagamento Cielo | `src/lib/cielo-ecommerce.ts`, `payment-reconciliation-payload.ts`, `payment-reconciliation-writer.ts` | Consulta por PaymentId e referência. Preserva JSON em `pagpagseguro.xmlRequisicao` nos fluxos observados, mas a reconciliação atualiza a linha. TID/NSU/autorização precisam ser extraídos quando presentes. |
| Webhook atual | `src/app/api/checkout/notification/route.ts`, `src/lib/checkout-notification-proxy.ts` | Consulta a Cielo antes de conciliar pagamento. Não cria caso de contestação ou dossiê. Não contém tratamento específico de `ChangeType` de chargeback. |
| Rótulos de contestação | `src/lib/checkout-status.ts`, `src/lib/painel-compras.ts`, `src/components/painel-compras-page.tsx` | Existem rótulos/filtros “Chargeback debitado” e “Em contestação” na representação legada. Sua presença não comprova integração com a API de Chargeback. |
| Envio de ingressos | `src/lib/ticket-delivery-audit.ts`, `ticket-service-fulfillment.ts`, `purchase-confirmation-email.ts` | Existem auditoria de envio e fila de e-mail. Respostas HTTP 200/202 do serviço são tratadas como envio, e `flenvio` marca enfileiramento do e-mail. Não equivalem a confirmação de leitura pelo cliente. |
| Jobs operacionais | `src/lib/ops-daily-jobs.ts`, `ops-job-runs.ts`, `src/app/api/ops/jobs/daily-run/scheduled/route.ts` | Há infraestrutura de execução, autenticação e registro de resultados. A configuração efetiva do agendador no servidor precisa ser verificada. |

O resumo atual é uma base relevante, mas lê dados mutáveis. O nome vem do cadastro atual, a agenda pode ter sido alterada e o pagamento pode ter sido reconciliado novamente. O dossiê deve identificar a origem e o momento de captura dos dados, sem apresentar valores atuais como históricos quando não houver registro.

O cabeçalho atual contém “NOTA FISCAL / COMPROVANTE”. O novo documento deverá usar “Dossiê de contestação — compra e utilização de ingressos”. O código examinado não emite documento fiscal nessa rota.

Em `main`, o resumo já distingue `INVALIDADO` de `NÃO USADO`. A implementação deve incorporar essa distinção e o histórico de ações, evitando inferir utilização pela existência de `dtuso`.

### Fontes e limites de cobertura

- Compra, pagamento e validação usam `getIngressoSistemaDbPool`. Parte da auditoria de entrega, e-mail e consulta de auditoria usa `getIngressoDbPool`. Confirmar a topologia real e consultar cada fonte explicitamente. Não presumir banco único nem reutilizar indiscriminadamente a consulta de auditoria atual.
- Um evento de validação deve aparecer como registro operacional de validação, incluindo modo e operador. Não há, nos caminhos examinados, prova de identidade física do visitante ou identificador de catraca a incluir automaticamente.
- Consultar todos os eventos relacionados por `compra_id`, `purchaseIds` e `affectedVoucherIds`, com deduplicação por origem/banco/ID. Ler toda a paginação. Operações em lote exigem filtrar os dados do PDF para a compra contestada.
- Não foi localizado registro persistente de versão/aceite de termos, IP e user-agent no fluxo de compra examinado. Há metadados em inscrição de grupos, que não devem ser atribuídos a outras compras.
- Dados ausentes em compras antigas devem aparecer como indisponíveis. O histórico operacional pode ajudar a reconstruir ações, mas não recupera automaticamente horários de uso apagados que nunca foram registrados em histórico.
- Graphify está instalado, mas este checkout não contém `graphify-out/graph.json`. A análise foi feita com busca textual e leitura de código. Context7 foi consultado para Cielo, porém não trouxe o contrato específico de chargeback. Os detalhes abaixo vieram da documentação oficial diretamente.

## 2. O que a Cielo oferece

A API de Chargeback documenta dois webhooks, um de novos casos e outro de atualização do ciclo de vida. O novo caso contém identificadores de contestação, estabelecimento, motivo, prazo e detalhes da transação. O exemplo usa TID, NSU e autorização, sem `PaymentId` ou ID interno da compra. Essa correlação precisa ser implementada. [Webhooks Cielo](https://docs.cielo.com.br/pix-can-cbk/reference/webhook)

A integração exige cadastro e liberação pela Cielo, informações do EC matriz/CNPJ, acesso ao portal e certificado mTLS. As URLs dos webhooks devem ser informadas no processo de habilitação. Não foi verificado se a conta do Rincão já tem esse serviço. [Autenticação e credenciais](https://docs.cielo.com.br/pix-can-cbk/reference/autenticacao-e-credenciais-cb)

O webhook transacional antigo documenta `ChangeType = 7` para Risk Notification, serviço em descontinuação. A proposta usa a API de Chargeback atual. [Webhook de pagamentos](https://docs.cielo.com.br/ecommerce-cielo/docs/webhook)

É possível consultar casos `PENDING` e `DONE`, com paginação iniciada em zero e até 200 registros por página. Usar isso na reconciliação diária para recuperar eventos perdidos e casos tratados pelo portal. O prazo operacional deve vir de `treatmentDeadline`, preservando a data informada pela Cielo. [Consulta de casos](https://docs.cielo.com.br/pix-can-cbk/reference/consulta-contestacao-pendente-tratada)

Também existe envio de defesa via `PUT /chargeback/v1/refuse`. A documentação indica PDF entre os formatos aceitos, limite de 8 MB e dez páginas, nome associado ao `IdCase`, justificativa de até 100 caracteres e e-mail do responsável. Validar a codificação do campo `file` e o nome do arquivo com a collection oficial no sandbox, pois a referência mistura array de strings e blob/base64. [Recusa de contestação](https://docs.cielo.com.br/pix-can-cbk/reference/recusa-de-contestacao)

Os demais serviços possuem sandbox, mas a Cielo informa que webhooks não têm ambiente sandbox. O receptor será testado localmente com exemplos oficiais e terá uma validação controlada após a habilitação de produção. Autenticação do callback, política de retentativas, ordem dos eventos e eventuais identificadores de entrega devem ser confirmados com a Cielo. Não transportar as regras de headers do webhook de pagamentos para este serviço sem confirmação. [Sandbox](https://docs.cielo.com.br/pix-can-cbk/reference/instrucoes-sandbox)

## 3. Fluxo proposto

1. O webhook ou a consulta programada importa um caso confirmado pela API, com motivo e prazo.
2. O sistema identifica a cobrança e a compra usando os identificadores transacionais e busca dados complementares automaticamente quando necessário.
3. Coleta as evidências existentes, seleciona a justificativa correspondente ao motivo e gera uma versão arquivada do PDF.
4. Verifica vínculo, evidências exigidas, consistência, prazo e formato do documento. Casos aptos seguem diretamente para envio pela API, sem aprovação humana.
5. Confirma o recebimento, arquiva o recibo e acompanha o ciclo de vida. Falhas transitórias são retomadas automaticamente. Resultado incerto exige consulta à Cielo antes de nova transmissão.
6. Casos que permaneçam sem vínculo seguro, sem documento exigido ou com erro definitivo recebem alerta com motivo e prazo. Uma indisponibilidade recuperável permanece em retentativa, com limite orientado ao prazo. A equipe atua somente nas exceções que o sistema não consegue resolver.

**Diretriz confirmada pelo usuário** — Automação de ponta a ponta, incluindo apresentação da defesa. A primeira proposta exigia revisão humana por caso. Essa exigência foi removida. O sistema registra os critérios e a versão da regra que autorizou cada envio automático.

### Regras para apresentação automática

- Confirmar o caso na API autenticada e obter vínculo único entre cobrança, compra e estabelecimento.
- Mapear os motivos de contestação recebidos aos documentos exigidos pela Cielo e aos fatos disponíveis. Essa matriz integra a implementação e a homologação. Motivo sem regra validada gera exceção explícita.
- Para alegação de serviço não prestado, utilizar os registros de utilização pertinentes aos itens e ao valor contestados. Uso parcial deve permanecer identificado e não autoriza afirmar consumo integral.
- Para não reconhecimento/fraude, verificar as evidências de autorização exigidas pelo motivo. Registro de entrada isolado não deve produzir uma afirmação de que o titular autorizou o cartão. Buscar automaticamente os dados disponíveis de transação e autenticação antes de classificar a ausência.
- Conferir estornos, duplicidade de cobrança e inconsistências antes de compor a defesa. Não apresentar como dívida integral um valor já devolvido. Caso sem fundamento documental fica em exceção, sem aceite automático do chargeback ou emissão de reembolso.
- Verificar tamanho, páginas, justificativa, prazo e estado remoto imediatamente antes do envio. Registrar executor técnico, regra aplicada, versão do dossiê e hash. Usar o e-mail de responsável cadastrado para a integração, sem atribuir aprovação humana fictícia.
- Alertar falhas permanentes, risco de perda de prazo e integrações sem sincronização. Usar registro persistente no painel e notificação ao e-mail operacional configurado, com deduplicação de alertas. Não exigir acompanhamento manual constante para descobrir erros.

### Conteúdo do dossiê

| Parte | Conteúdo |
| --- | --- |
| Identificação | Número do caso/contestação, EC, motivo, valor contestado, prazo, compra e cobrança vinculadas. |
| Compra | Data, itens, valores, comprador e contato pertinente, identificando a fonte histórica ou atual. |
| Pagamento | PaymentId, TID, NSU, autorização, bandeira, cartão mascarado, valor cobrado, parcelas e registros de estorno/cancelamento disponíveis. Dados 3DS somente quando presentes em uma fonte verificável. |
| Ingressos | Código, categoria, data prevista, estado atual e utilização individual. Totalizar utilizados, disponíveis, invalidados e sem informação, sem transformar uso parcial em integral. |
| Cronologia | Validações, desvalidações, invalidações e alterações relevantes, com data, fuso, fonte e responsável quando registrado. Distinguir horário da ação de horário de uso conhecido. |
| Comunicações | Evidências disponíveis de disponibilização/envio, com o estado real informado pelo serviço. |
| Síntese | Texto determinístico baseado no motivo e nos fatos documentados, com limitações e anexos necessários sinalizados. |
| Rastreabilidade | Data de geração, versão, fontes e hash do PDF. Hash identifica a versão arquivada, sem alegar certificação externa ou autenticidade histórica dos dados. |

Usar texto e tabelas compactas. Aplicar automaticamente paginação e otimização de imagens quando houver anexos. Se o PDF completo continuar acima do limite, emitir exceção explícita sem cortar evidências silenciosamente. Documentos exigidos pelo motivo devem ser buscados nas fontes disponíveis. Documento obrigatório indisponível impede o envio daquele caso e gera alerta.

## 4. Dados e correlação

Proposta inicial de três tabelas no banco do sistema, sem serviço adicional de fila ou armazenamento.

- `chargeback_cases` guarda ID local, origem, EC, IDs externos, compra e pagamento vinculados, detalhes da cobrança, motivo, valor, prazo, estado remoto, estado de trabalho, motivo de exceção e eventual correção de vínculo auditada. Chave única por provedor, EC e ID de chargeback. Compra e caso não têm relação obrigatória de um para um.
- `chargeback_events` guarda eventos recebidos/verificados e o progresso de processamento, com deduplicação, erro, tentativas e próxima execução. Estados de trabalho e bloqueio temporário permitem recuperação após interrupções e concorrência entre webhook e job. Eventos não verificados não disparam geração nem alteram o estado confirmado do caso.
- `chargeback_dossiers` guarda caso, versão, snapshot JSON, PDF binário, hash, horário de geração, executor, lacunas, versão da regra de envio, resultado da verificação e recibo de apresentação. A versão armazenada é imutável. A próxima geração cria outra versão. O PDF binário no PostgreSQL é a escolha inicial para evitar infraestrutura adicional, sujeita à validação de volume e backup.

Usar valores monetários decimais/centavos e identificadores externos como strings sem perda de precisão. A API documenta IDs com até 20 dígitos. A implementação deve verificar o parsing do transporte antes de aceitar números além do intervalo seguro de JavaScript.

### Regras de vínculo

1. Buscar TID exato dentro do estabelecimento, extraído de uma resposta Cielo verificável e associado ao PaymentId local. Para compras antigas, tentar o JSON já armazenado antes de consultar a API transacional.
2. Confirmar vínculo único e coerência de data/valores. Se a contestação for parcial, preservar o valor contestado separado do valor integral. Diferença de valor não autoriza vincular a outra compra.
3. Na ausência de TID, procurar candidatos por EC, NSU, autorização e data e consultar a transação para desambiguar. Persistindo ambiguidade, registrar exceção e alertar. Nome, CPF e valor isolados não são chaves suficientes.
4. Considerar múltiplas tentativas de pagamento. Resolver o PaymentId efetivamente contestado, sem usar automaticamente a última linha escolhida pelo resumo atual.
5. Importações repetidas e casos já tratados no portal devem convergir pelo identificador externo, evitando duas apresentações da mesma defesa.

A coleta do snapshot lê compra, pagamento e uso em uma transação consistente no banco do sistema. Fontes de comunicação em outro banco recebem horário de coleta próprio. Chamadas externas ficam fora da transação de banco. O snapshot registra essas diferenças de tempo.

A importação de chargeback mantém seu estado próprio. Qualquer mudança em pagamento, reembolso, bloqueio ou disponibilidade de ingresso exige a regra de negócio correspondente, sem inferência a partir de uma mera notificação.

## 5. Entregas e critérios de aceite

### Entrega 1 — Coleta de evidências e geração automática do dossiê

Arquivos previstos para criação

- `src/lib/chargeback-repository.ts` — persistência dos casos, eventos e versões, leitura de evidências nas fontes corretas.
- `src/lib/chargeback-dossier.ts` — composição do snapshot, classificação de fatos/lacunas e geração idempotente.
- `src/lib/chargeback-dossier-pdf.tsx` — PDF a partir do snapshot. Reaproveitar os elementos visuais do resumo apenas onde a extração reduzir duplicação efetiva.
- `src/app/api/painel/compras/[purchaseId]/contestacoes/route.ts` — listar casos importados da compra.
- `src/app/api/painel/contestacoes/[caseId]/dossie/route.ts` — baixar versão armazenada com autenticação. Geração é acionada pelo processamento do caso.
- `src/components/painel-compra-contestacoes.tsx` — casos, prazo, vínculo, pendências e ações no detalhe da compra.
- `docs/sql/2026-11-03-chargeback-dossiers.sql` — migração aditiva e índices.
- Testes adjacentes a esses módulos/rotas.

Arquivos existentes a integrar

- `src/components/painel-compra-detail-page.tsx` e `painel-compra-detail-actions.tsx` para acesso ao dossiê.
- `src/lib/painel-api-auth.ts`, `painel-access.ts` e `painel-acl.ts` como referências de autenticação/ACL. Leitura pode reutilizar `vis_compra`. Correções de vínculo em exceções precisam de permissão de escrita específica. O processamento automático usa identidade técnica e credenciais restritas no servidor.
- `src/lib/ops-audit-log.ts` para registrar abertura, geração, download e vínculo manual. Nunca registrar PDF, payload sensível ou credenciais no console.

- [ ] Conferir Next.js local em `node_modules/next/dist/docs/` antes das rotas, os dialetos realmente usados e a revisão de implantação.
- [ ] Validar com consultas somente de leitura uma amostra de compra usada, parcialmente usada, desvalidada e antiga. Documentar cobertura dos registros e origem de cada dado.
- [ ] Criar a migração e demonstrar reexecução segura e isolamento dos registros existentes em banco de teste.
- [ ] Implementar coleta incluindo auditoria em lote, múltiplas páginas e dados legados ausentes. Tratar JSON antigo inválido como lacuna explícita.
- [ ] Gerar/arquivar PDF e JSON como versão única, com hash dos bytes exatos. Repetições da mesma solicitação retornam a versão existente. Regeneração deliberada cria nova versão.
- [ ] Integrar a tela de acompanhamento e autenticação. Limitar downloads ao escopo autorizado. PDF privado, sem URL pública.
- [ ] Testar uso total/parcial, invalidação, desvalidação seguida de nova validação, ação em lote de várias compras, mais de 100 logs, ausência de pagamento, pagamento de tentativa diferente, duas contestações na mesma compra, acesso negado e geração concorrente.
- [ ] Renderizar amostras e verificar texto extraído, paginação, ausência de corte de códigos e limites do arquivo. Conferir visualmente versões com muitos ingressos.

**Aceite observável** — Ao receber um caso confirmado e vinculado, o serviço gera e arquiva o dossiê sem interação com o painel. A mesma versão continua idêntica após mudanças posteriores na compra. O arquivo informa exatamente os ingressos e ações comprovados pelas fontes. Esta entrega é base técnica e depende das entregas 2 e 3 para cumprir a automação solicitada.

### Entrega 2 — Entrada automática e reconciliação

Arquivos previstos para criação

- `src/lib/cielo-chargeback.ts` e teste — cliente separado para autenticação/consulta da API de Chargeback, com mTLS configurado no servidor, timeout e respostas validadas.
- `src/lib/chargeback-sync.ts` e teste — importação, vínculo e processamento de pendências.
- `src/app/api/cielo/chargebacks/notification/route.ts` e teste — webhook de novos casos.
- `src/app/api/cielo/chargebacks/lifecycle/route.ts` e teste — webhook de ciclo de vida.
- `src/app/api/ops/jobs/chargebacks/route.ts` e teste — processamento e reconciliação autenticados.
- `src/app/painel/(protected)/compras/contestacoes/page.tsx` e componente específico — lista por prazo, vínculo, geração e estado de apresentação.

Reutilizar os padrões de `ops-auth.ts` e `ops-job-runs.ts`, com agendamento no mecanismo de implantação já utilizado. A leitura de transações é reaproveitada de `cielo-ecommerce.ts`, sem executar a reconciliação de pagamento como efeito colateral da montagem de evidências.

- [ ] Confirmar habilitação, ECs, credenciais, mTLS, autenticação do callback e cadastro das URLs com a Cielo.
- [ ] Homologar consulta paginada `PENDING`/`DONE` e ciclo de vida. Conferir sucesso de negócio no corpo, além do HTTP.
- [ ] Persistir recepção antes da confirmação HTTP. Conferir EC permitido e obter o caso na API autenticada antes de considerá-lo confirmado. Payload malformado ou identificadores inseguros são rejeitados.
- [ ] Deduplicar entregas e processar eventos fora de ordem sem regredir estados já confirmados. Se a documentação não fornecer ID de evento, usar chave derivada do tipo, estabelecimento, caso e conteúdo canônico, conservando mudanças legítimas de prazo/status.
- [ ] Gerar dossiê automaticamente após vínculo confirmado. Executar pendências em lotes com lease recuperável, retentativas limitadas e próxima execução persistida. Proposta de cadência inicial de cinco minutos para pendências e diária para reconciliação completa.
- [ ] Consultar todas as páginas e recuperar também casos antigos pendentes. Não limitar a busca à janela recente usada na conciliação de pagamentos. Sobrepor períodos de casos tratados para absorver atrasos e mudanças.
- [ ] Exibir no painel prazo Cielo, última sincronização e falhas. Emitir alertas deduplicados para exceções, risco de prazo e interrupção da integração, usando o serviço de e-mail existente. Confirmar destinatário operacional na configuração inicial.
- [ ] Testar webhook duplicado, webhook com API indisponível, EC não autorizado, dados conflitantes, caso já tratado no portal, evento fora de ordem, falha após persistência e retomada por outro worker.
- [ ] Validar a primeira entrega real do webhook de forma controlada após a habilitação, já que esse recurso não tem sandbox.

**Aceite observável** — Uma contestação recebida e vinculada gera um único caso e um dossiê e avança para a apresentação automática. Repetir o evento não duplica o trabalho. A consulta programada recupera um caso que chegou sem webhook. Exceções persistentes geram alerta sem bloquear os demais casos.

### Entrega 3 — Apresentação automática e acompanhamento

Ampliar `src/lib/cielo-chargeback.ts`, `chargeback-repository.ts`, `chargeback-sync.ts`, a tela de acompanhamento e seus testes. Criar `src/lib/chargeback-submission.ts` e teste para verificar critérios, transmitir e reconciliar a apresentação. O worker chama esse serviço diretamente após a geração, sem depender de botão no admin.

- [ ] Homologar `refuse` no sandbox usando a collection oficial. Validar nome, base64, PDF, tamanho, páginas, justificativa e responsável.
- [ ] Implementar a matriz de motivo/evidências e as regras de apresentação automática descritas na seção 3, validando os requisitos com a documentação Cielo e a amostra de casos reais. Guardar resultados e versão da regra aplicada.
- [ ] Enviar automaticamente a versão verificada, com vínculo confirmado, evidências suficientes, caso elegível e prazo válido. Guardar executor técnico, horário, versão e hash. Antes da transmissão, reconsultar estado remoto e detectar estornos ou alterações materiais posteriores ao snapshot, regenerando e verificando novamente quando necessário.
- [ ] Bloquear envio concorrente do mesmo caso. Em timeout após transmissão, registrar resultado incerto e consultar estado/documento na Cielo antes de repetir a operação.
- [ ] Separar defesa apresentada, análise em curso e resultado favorável/desfavorável. HTTP 200 isolado não indica vitória.
- [ ] Reconciliar estados vindos do portal ou de outro operador. Registrar confirmação de apresentação externa com sua fonte, sem fabricar protocolo.
- [ ] Recuperar falhas transitórias com retentativa persistente e limitada pelo prazo. Consultar o ciclo de vida e documentos para resolver resultados incertos. Emitir alerta se não for possível confirmar o envio.
- [ ] Testar envio repetido, prazo expirado, versão substituída após verificação, arquivo acima dos limites, erro de negócio em HTTP 200 e timeout de resultado desconhecido.
- [ ] Testar por motivo os casos aptos e as exceções, incluindo uso parcial, fraude sem evidência obrigatória, estorno prévio e dados conflitantes. Confirmar que exceções não geram aceite do chargeback nem reembolso automático.
- [ ] Executar um teste integrado de recebimento, correlação, coleta, PDF, apresentação e atualização de resultado sem chamadas às ações do admin. Repetir com reinício do worker e evento duplicado e comprovar uma única apresentação.

**Aceite observável** — Um caso apto chega, gera o dossiê, tem a defesa apresentada e o resultado acompanhado sem nenhuma ação humana por caso. O recibo e o ciclo de vida ficam associados à versão enviada. A entrega final só está concluída quando esse fluxo funcionar de ponta a ponta, inclusive recuperação de falhas e alertas de exceção.

## 6. Validação e dependências

Antes de implantar, testar as fontes nos ambientes reais autorizados. O banco do sistema e o banco de comunicações podem ser distintos. Assegurar que o processo de backup contempla casos e PDFs, que o processo de implantação preserva os dados e que os certificados ficam em armazenamento de segredos do servidor.

A retenção de evidências precisa ser acordada com a operação conforme obrigações aplicáveis e volume. Esta proposta não define prazo automático de exclusão. Excluir do dossiê segredos, CVV, PAN completo, tokens e dados de terceiros sem relação com a contestação. O snapshot deve usar uma lista explícita de campos necessários, sem copiar todo o JSON bruto do gateway.

Fortalecimento futuro condicionado às lacunas da amostra real — captura prospectiva do comprador/itens/termos no momento da compra e evidências detalhadas de autenticação. Compras antigas continuam com o que efetivamente foi registrado. Isso não bloqueia a primeira entrega do dossiê.

Comandos de validação previstos na implementação

```sh
npm test -- src/lib/chargeback-repository.test.ts src/lib/chargeback-dossier.test.ts src/lib/chargeback-dossier-pdf.test.ts
npm test -- src/lib/cielo-chargeback.test.ts src/lib/chargeback-sync.test.ts
npm test -- src/lib/chargeback-submission.test.ts
npm test -- src/app/api/painel/contestacoes src/app/api/cielo/chargebacks src/app/api/ops/jobs/chargebacks
npm run lint
npx tsc --noEmit
npm run build
```

Os testes de cada entrega incluem suas rotas adjacentes. Executar também os testes existentes afetados de resumo, pagamento e auditoria. A revisão independente da implementação deve cobrir vínculo transacional, acesso a dados e falhas de envio.

### Verificação executada nesta análise

Em `develop`, passaram quatro arquivos e dez testes existentes.

```sh
npm test -- src/lib/painel-purchase-summary-pdf.test.ts 'src/app/api/painel/compras/[purchaseId]/resumo/route.test.ts' src/lib/checkout-notification-proxy.test.ts src/lib/ops-audit-history.test.ts
```

São testes locais, com dependências externas simuladas nos testes pertinentes. Confirmam a base atual nesses cenários. Não validam a completude dos registros de produção nem a aceitação de uma defesa pelo banco.

### Implementação e validação local — 03/11/2026

O fluxo foi implementado no checkout `develop`: cliente mTLS/OAuth, recepção durável dos dois webhooks, reconciliação paginada persistente, vínculo/coleta, política de elegibilidade, PDF arquivado, apresentação automática, recuperação de envio incerto, consulta do resultado, alertas, painel autenticado e runner do agendador. Configuração e ativação estão em `docs/runbooks/cielo-chargeback-automation.md`; migração em `docs/sql/2026-11-03-chargeback-dossiers.sql`. As listas anteriores registram o escopo original; a conclusão operacional depende das pendências externas abaixo.

Decisões verificadas na implementação:

- Sem ação humana por caso elegível. A política inicial cobre primeira contestação em reais por serviço não recebido, Visa 13.1/131 e Mastercard 4855/4859, com valor integral comprovado, vínculo confirmado e ausência de estorno/conflitos. Fraude e outras razões sem evidência obrigatória ficam em exceção com dossiê e alerta. Uso do ingresso sozinho não comprova autorização do titular.
- O worker usa lock de sessão PostgreSQL, destruindo a conexão se não conseguir liberar o lock. A configuração exige capacidade de pelo menos duas conexões simultâneas no pool do sistema.
- Casos conhecidos são processados antes da varredura. A varredura persiste uma página por execução, começa pelos períodos recentes e percorre todo o histórico; um novo ciclo começa 24 horas após terminar o anterior. As janelas têm no máximo 179 dias e IDs longos são preservados sem conversão para `Number`.
- O snapshot usa campos permitidos, identifica dados atuais e horários de coleta e não inclui CVV/PAN completo/segredos. Tentativas alternativas expõem apenas situação e valor. Evidências materialmente iguais reutilizam a versão arquivada, mesmo após nova coleta.
- A intenção de envio e a versão do PDF são persistidas antes da chamada externa. Respostas desconhecidas e interrupções não permitem reenvio cego. Recuperação compara o hash do documento remoto; sem confirmação, continua a consulta e alerta para intervenção. Uma resposta de documento ausente não garante que a defesa não tenha sido recebida.
- Rejeições definitivas e 12 tentativas recuperáveis esgotadas bloqueiam novos envios. Resultado favorável/desfavorável conhecido encerra sondagem; `DONE` isolado não significa defesa apresentada nem vitória.
- Foram corrigidos dois helpers existentes necessários à recuperação: propagação do erro em `release` do PostgreSQL e timeout E-commerce cobrindo também o corpo HTTP.

Validação local: build de produção e TypeScript aprovados; revisão independente dos fluxos críticos concluída com correções. Oito testes integrados passaram em PostgreSQL descartável, cobrindo migração reexecutável, FK de versões, lock concorrente, cursor e prioridade temporal, arquivamento/reuso, retomada após falha de recibo e falhas independentes. Cielo e coleta de evidências são limites simulados nesses testes; o coletor tem testes próprios. Seis testes do runner passaram sem chamadas ao job real.

A suíte global apresentou 18 falhas em dez arquivos existentes. Uma execução independente no `HEAD` limpo reproduziu exatamente essas falhas: administração, cashback, e-mail, checkout, conciliação, vouchers e recuperação de senha. O lint global reproduziu dois erros anteriores em gráficos da enfermaria e 14 avisos. Esses módulos não foram corrigidos como parte desta entrega. A execução final registrou 807 testes aprovados, as mesmas 18 falhas anteriores e oito testes de integração ignorados por padrão; esses oito passaram em execução separada com PostgreSQL descartável. Nos arquivos novos/alterados, 136 testes passaram, somando 150 com os oito integrados e os seis do runner. O lint dos 41 arquivos de código/teste alterados passou. A amostra PDF de três páginas foi renderizada e inspecionada, preservando os 31 eventos de teste e a numeração.

### Continuidade

Objetivo implementado localmente; integração ainda desabilitada por padrão. Não houve deploy, migração no banco real, registro de tarefa no Windows, cadastro de callbacks ou envio real de defesa. Nenhuma credencial foi inventada e nenhum resultado remoto foi simulado como real.

Pendências para ativação: habilitar a API de Chargeback, obter credenciais e certificado mTLS, autorizar ECs, cadastrar callbacks e autenticação, validar o contrato real de `refuse` e os requisitos por motivo com a Cielo. O OpenAPI e o exemplo divergem em JSON/base64 versus multipart e nome de arquivo; o cliente segue o schema tipado e precisa ser homologado antes de produção. Confirmar destinatário/entrega de alertas, pools, backup, migração e tarefa de cinco minutos na VM. O sandbox não oferece webhooks; a primeira entrega real depende de validação controlada após cadastro em produção.

Próxima ação: solicitar à Cielo os itens do runbook e homologar as chamadas reais. A homologação pode exigir ajuste no cliente se a collection fornecida divergir do contrato público. Depois, aplicar a migração, configurar o runtime e instalar/verificar a tarefa no ambiente autorizado.

### Habilitação — 05/11/2026

EC confirmado pelo responsável: `2899426197`; CNPJ `14.582.297/0001-55`, São Paulo/SP. Conta criada pelo usuário no Portal dos Desenvolvedores com `dev@cluberincao.com.br`. A inspeção autenticada de `/pt/credenciais` mostrou somente cadastro de Client-ID Cielo Smart / LIO Local, sem credenciais cadastradas; isso não comprova habilitação da API de Chargeback. Nenhum Client-ID de outro produto foi criado.

O atendimento de Expansão Chargeback encaminhou o manual v3.2.1 e orientou procurar o suporte técnico. O endereço indicado na seção de suporte do manual é `techsupportchargeback@cielo.com.br`. A resposta não forneceu credenciais nem confirmou acesso.

CSR RSA 2048/SHA-256 gerado na VM, com assinatura verificada e chave pública correspondente à chave privada. Diretório com herança de permissões desativada e acesso restrito ao usuário executor e SYSTEM: `C:\SitesData\Rincao\secrets\cielo-chargeback\2899426197-20261105`. A chave privada permanece exclusivamente na VM. Cópia pública para envio: `/Users/juansouza/Downloads/Rincao_Cielo_Chargeback_2899426197_20261105.csr`; SHA-256 `67d6909b31613bbe6923596ab9fffc6ff16fc1156d64394c8b285a77a0c1ed9a`.

Não foram alteradas variáveis de ambiente, reiniciados serviços, ativada a integração ou feitas chamadas reais à API. Após autorização explícita do usuário, foi enviado pelo Gmail `juansouza9.dev@gmail.com` o e-mail “Habilitação API Chargeback e assinatura de CSR — EC 2899426197” para `techsupportchargeback@cielo.com.br`, com `dev@cluberincao.com.br` e `expansao.chargeback@cielo.com.br` em cópia e o CSR público anexado. Destinatários e conclusão do upload foram conferidos antes do envio; o Gmail confirmou “Message sent”. Próxima ação: aguardar a habilitação, as credenciais e o certificado assinado; depois testar autenticação e consulta sem apresentar defesa. As URLs previstas no runbook ainda dependem de implantação/validação antes do cadastro dos webhooks.

### Validação real de certificado, autenticação e consulta — 07/11/2026

Escopo autorizado: validar certificado, obter as credenciais existentes no portal e testar autenticação e consulta; nenhum envio de defesa. Davi respondeu em 06/11 às 11h17 com o certificado e a collection de sandbox. O portal autenticado passou a mostrar as credenciais de homologação e produção, ambas descritas como API de Chargeback vinculada à matriz `1075640757`. O filtro das consultas foi o EC confirmado pelo usuário, `2899426197`; não foi substituído pela matriz.

Certificado recebido: `STC-PRD-RINCAO-MULESOFT-MTLS.cer`, emissor `CIELO-SUBCA01`, RSA 2048, com uso de autenticação de cliente. A chave pública corresponde ao CSR original e à chave privada existente na VM. Validade: 06/11/2026 12:36:04 UTC até 06/11/2028 12:46:04 UTC. Fingerprint SHA-256: `03:FC:D3:24:92:48:EE:5B:FF:4C:0C:CE:B5:68:72:59:12:58:17:E8:D8:E7:5E:49:3C:15:9D:60:DA:A4:EC:85`. O ZIP contém somente o certificado, sem cadeia separada; a aceitação efetiva do mTLS foi comprovada nas chamadas abaixo, sem desabilitar a validação TLS do servidor. Cópia do certificado na VM: `C:\SitesData\Rincao\secrets\cielo-chargeback\2899426197-20261105\validation-20261107\client.cer`.

Teste isolado executado na VM com Node 20.19.5, sem utilizar o worker nem alterar o runtime do aplicativo. A lista de endpoints permitidos no script limita as chamadas a OAuth e `POST /chargeback/v1/PENDING`:

- Homologação: autenticação HTTP 200, token recebido com validade de 300 segundos; consulta HTTP 200, uma entrada de teste na primeira página e `totalElements=123`. Esses dados são do sandbox, não contestações reais do estabelecimento.
- Produção: autenticação HTTP 200, token recebido com validade de 600 segundos; consulta HTTP 204, corpo vazio. Não retornou contestações pendentes para o filtro de EC `2899426197` e notificações entre `2026-10-01` e `2026-11-07`. Isso não comprova ausência de casos fora desse período, encerrados ou em outros ECs, nem confirma sozinho toda a relação matriz/filial.
- As duas conexões negociaram TLS 1.3 com validação do servidor aprovada e certificado de cliente aceito. Tokens, segredos e dados individuais de casos não foram registrados no relatório.

Diferenças verificadas no contrato: os exemplos da collection com `mainCustomer`, `tid` e `idCase` iguais a `null` geraram HTTP 400 nos dois ambientes, indicando que esses campos exigem strings. Omitir os filtros opcionais resolveu a consulta. O cliente do sistema já omite os filtros não informados, mas seu tratamento atual de respostas tenta interpretar o corpo vazio HTTP 204 como JSON: corrigir e testar esse caso antes da ativação. O prazo de token observado em produção foi 600 segundos, embora o manual mencione cinco minutos; o cliente atual limita o cache a 300 segundos.

Context7 foi consultado, mas retornou documentação de outros produtos Cielo; a validação utilizou o manual recebido e a collection oficial enviada pelo suporte. Credenciais foram usadas em arquivos temporários locais com permissões restritas e transmitidas à VM pelo stdin do SSH; não foram gravadas em arquivos de configuração, argumentos de processo ou logs. As cópias temporárias locais foram removidas após o teste e a área de transferência foi limpa. A chave privada permaneceu na VM.

Estado atual: acesso e consultas testados; automação continua desativada. Não houve deploy, migração de banco, reinício de serviços, cadastro de webhooks, aceite de chargeback ou apresentação de defesa. Próximas ações: tratar HTTP 204 no cliente, validar o contrato de apresentação em homologação quando autorizado e concluir implantação/cadastro de callbacks antes de ativar o fluxo automático.

### Homologação autorizada e histórico ampliado — 07/11/2026

O usuário autorizou corrigir HTTP 204, homologar no sandbox, preparar produção sem defesas reais e ampliar a consulta histórica. Foram corrigidos o cliente e seu teste, além do receptor de webhooks e seu teste. O HTTP 204 termina consultas com lista vazia; o filtro correto é `idCase`; o envio exige multipart com campos strings e PDF binário `<idCase>.pdf`; os erros de negócio podem vir aninhados em `errorMessage`/`details`. A notificação usa envelope `content`, e o lifecycle aceita `idcase` documentado. TDD reproduziu as falhas antes das correções.

O cliente real corrigido foi executado isoladamente na VM e recebeu HTTP 200/código 102 para um PDF exclusivamente fictício gerado pelo renderer do aplicativo. Autenticação, consultas, consulta de documento/ciclo de vida e cenários de erro foram exercitados. O sandbox retorna documento fixo diferente do PDF enviado, cenários parcialmente divergentes do manual e não oferece webhooks. Logo, a homologação externa comprovou chamadas individuais; não comprovou persistência do PDF nem o circuito externo completo. As proteções de idempotência/recuperação permanecem intactas.

Em produção, a varredura de 01/01/2024 a 07/11/2026, paginada e deduplicada, encontrou 448 casos DONE no EC 2899426197 e um DONE no EC matriz 1075640757; zero PENDING para ambos. Todos os retornados têm notificação em 2026. DONE não comprova vitória ou defesa enviada. Uma consulta adicional pelo ID de um caso tratado retornou exatamente o caso solicitado, validando o filtro camelCase também em produção. O transporte dessas sondas impediu chamadas de escrita em produção.

Validação final: 152 testes de unidade/rotas/painel, oito integrados em PostgreSQL descartável e seis do runner passaram (166 no total). ESLint dos quatro arquivos corrigidos e build/TypeScript passaram; build apresentou aviso de rastreamento amplo fora do delta. Revisão independente dos arquivos e callers sem achados concretos, com 101 testes focados aprovados. Não foi repetida a suíte global com falhas preexistentes registradas acima.

Relatório detalhado e contagem mensal: `docs/runbooks/cielo-chargeback-validation-2026-11-07.md`. Runbook operacional atualizado para o contrato observado. Não há grafo estrutural existente; navegação foi feita por leitura direta/rg. Context7 não forneceu documentação deste produto na validação anterior; manual, collection oficial, referência pública e chamadas reais foram as evidências.

Continuidade: código validado localmente, sem commit/push/deploy. Produção permanece desativada, sem migração, callbacks cadastrados, tarefa instalada ou defesa real. Os dois arquivos temporários locais de credenciais foram removidos; chave privada permanece na VM e nenhum segredo foi persistido no runtime. Não há processo de homologação em segundo plano. Artefatos temporários sem credenciais em `/tmp/rincao-chargeback-validation-20261107` e scripts públicos/fixtures sintéticas no diretório protegido `validation-20261107` da VM; banco descartável encerrado/removido.

Próxima ação: preparar implantação/banco/alertas conforme runbook e concluir com a Cielo o cadastro/validação dos callbacks e o cenário externo com persistência, mantendo envios reais desligados até autorização. A evidência disponível não permite declarar o circuito externo integralmente homologado ou a automação já ativa em produção.

### Preparação e publicação autorizadas — 07/11/2026

Estado posterior aos registros acima: preparação da VM concluída e release publicada, **sem ativar envios reais**. O usuário confirmou `dev@cluberincao.com.br` como destinatário dos alertas. Backup completo de produção restaurado em PostgreSQL 16 isolado, migração repetida no teste e aplicada transacionalmente em `clrincao_sistema/public`. As quatro tabelas de chargeback continuam vazias. Backup protegido de 211.354.553 bytes em `C:\SitesData\Rincao\secrets\cielo-chargeback\2899426197-20261105\preparation-20261107\pre-migration\clrincao_sistema.dump`, SHA-256 `5c7789a4d38ddfbbcade99c9e61768716c17f75e8972f80945533652862e0eb7`. Cluster de restauração removido e porta 55439 fechada.

Credenciais/certificado configurados no `.env.local` persistente, ACL restrita a SYSTEM/Administrators. Chave privada não saiu da VM; cópia temporária local das credenciais removida. SMTP autenticou, mas não houve e-mail de teste. EC operacional `2899426197`; `CIELO_CHARGEBACK_ENABLED=false`. Tarefa `RincaoChargebackSync-prod` instalada desabilitada, intervalo de cinco minutos, SYSTEM, runner `C:\Deploy\Rincao\ops\run-chargeback-sync.mjs`; ainda não executada. Não executar job autenticado ou habilitar integração sem autorização para a etapa correspondente.

Fonte isolada partiu do commit ativo de produção `c50af07fdbad8474293832e58408296c3071e3a1`, preservando as alterações locais do checkout original. Branch `codex/cielo-chargeback-preparation-20261107`, commit `4e0ed8da303058c4097f633e966319f31830786f`, publicado em main. Deploy VM 42388949676 concluído com sucesso às 16:03:33 UTC. Ponteiro/runtime confirmados na VM. Next.js atualizado para 16.4.5 após auditoria identificar vulnerabilidades críticas da 16.2.4, inclusive RCE no Windows. Build/TypeScript e 168 testes relevantes passaram; suíte global comparada nas duas versões: 851 aprovados, mesmas 16 falhas preexistentes, oito ignorados. Auditoria final sem vulnerabilidades críticas/alertas de Next.js, com oito alertas de outras dependências ainda existentes. Revisões independentes verificaram scripts de preparação e delta de segurança/fixtures.

Verificação final: site público e login HTTP 200, callbacks HTTP 404/ok:false, job não autenticado HTTP 401; mesmos status observados fora da VM. Integração false, tarefa Disabled, tabelas vazias e nenhum envio real. A primeira sonda final falhou genericamente; a segunda, instrumentada, passou integralmente, sem atribuição especulativa de causa.

E-mails corretos foram lidos na conta `juansouza9.dev@gmail.com` via Chrome porque o conector Gmail estava ligado a outra conta. Davi confirmou credenciais/certificado e pediu os endereços para liberação em 06/11. Basta responder à mesma conversa com os dois callbacks, EC e dados cadastrais; não repetir habilitação. Manual/documentação/e-mails não esclarecem autenticação do callback, política de repetição ou timeout: solicitar esses detalhes e teste controlado. Nenhum novo e-mail foi enviado. Enquanto a flag global estiver false, os receptores permanecem fechados; não afirmar que já recebem notificações.

Próxima ação externa: responder ao suporte com os endereços documentados no relatório, alinhar autenticação/cadastro e validar entrega de callback/alerta. O circuito externo com persistência continua limitado pelo sandbox. Ativação de integração/tarefa e defesas reais permanece pendente de autorização explícita. Relatório completo: `docs/runbooks/cielo-chargeback-validation-2026-11-07.md`. Artefatos públicos locais: `/tmp/rincao-chargeback-preparation-20261107`; backup/credenciais protegidos permanecem na VM. Checkout original/índice preservados; registro final atualizado localmente, sem novo push que dispararia outro deploy.
