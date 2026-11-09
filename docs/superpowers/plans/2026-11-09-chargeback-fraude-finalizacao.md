# Finalização da preparação de chargebacks de fraude

> **For agentic workers:** Use `superpowers:executing-plans` para executar as tarefas sequencialmente. Não habilitar envios reais. Revisão independente somente quando justificada pelo risco e pelas instruções vigentes.

**Goal:** Concluir a cobertura de fraude e a ativação da automação: obter orientação de produto, avaliar as evidências disponíveis, implementar/testar/publicar os ajustes necessários e somente então ativar, após confirmação efetiva da liberação pela Cielo. O usuário já autoriza a ativação final sem nova pergunta; até todas essas condições se confirmarem, manter integração e agendador desligados. Não tornar fraude elegível sem provas suficientes nem declarar cobertura de casos não demonstrada.

**Architecture:** Enriquecer o coletor e o PDF existentes, sem novo serviço, dependência, flag ou alteração do checkout. Separar evidência disponível de elegibilidade para envio: a classificação atual de fraude como exceção permanece até haver critérios suficientes aprovados. Usar testes sintéticos e sondas isoladas somente leitura; nunca executar o worker de produção nesta etapa.

**Tech Stack:** TypeScript, Vitest, PostgreSQL, React PDF, Next.js 16.4.5, IIS/Windows.

**Spec:** [Plano original e restrições](2026-11-03-dossie-contestacao-cielo.md), [validação existente](../../runbooks/cielo-chargeback-validation-2026-11-07.md) e reavaliação abaixo.

## Resposta recebida e reavaliação

Fonte: [conversa de habilitação no Gmail](https://mail.google.com/mail/u/2/#search/cielo+chargeback/QgrcJHsHkwkVHNlXpXCbvLHnbNzllHxgfqb), mensagem de SI Tech Support Chargeback / Davi em 09/11/2026 às 16:36, lida na conta correta. `dev@cluberincao.com.br` está entre os destinatários.

- Davi informou que em **11/11/2026** a liberação no firewall estará concluída e a aplicação da Cielo iniciará os eventos. É uma previsão declarada pelo fornecedor; ainda não é prova de entrega ou aceite pelo nosso receptor.
- O suporte técnico não respondeu quais evidências bastam para fraude. Orientou abrir **novo e-mail** para `expansao.chargeback@cielo.com.br`; usar a mesma conversa não inclui a demanda na fila desse setor.
- A data não autoriza ativação. Com a flag global false, callbacks permitidos pela borda ainda recebem 404. Como o usuário rejeitou separar recebimento e envio, não habilitar somente para testar callbacks.
- A estratégia anterior continua válida para enriquecer a prova factual; não é suficiente para ampliar automaticamente os motivos elegíveis. O contato de produto e a validação operacional continuam pendentes.

## Restrições globais

- `CIELO_CHARGEBACK_ENABLED=false`; `RincaoChargebackSync-prod` desabilitada. Nenhuma defesa real, aceite de chargeback ou documento de comprador enviado à Cielo.
- Não criar flags separadas de recebimento/envio nem modo de operação dry-run.
- Não inventar IP, dispositivo, aceite, identidade física, autenticação ou relacionamento com portador.
- ECI, nome digitado do titular e uso do ingresso não autorizam, isoladamente, afirmar identidade, autenticação ou vitória.
- Não extrair PAN, CVV, CAVV, tokens ou payload bruto para PDF, logs, fixtures ou Git. CPF somente mascarado no dossiê desta preparação; conservar a proveniência do campo.
- Nenhuma nova mensagem externa sem autorização específica. A autorização anterior era para a mensagem já enviada a Davi; este plano prepara outra mensagem, não a envia.
- Não alterar checkout nem implantar coleta futura de dados neste escopo.
- Toda alteração de código/documentação deve ser publicada no remoto; preservar trabalho alheio e terminar com checkout limpo.

## Base de evidência

Sonda de presença executada em 09/11, com PostgreSQL em transação somente leitura, sem chamadas à API Cielo. Usou a lista protegida de casos DONE consultada anteriormente para 01/09–09/11 e os registros locais atuais dos pagamentos.

Dos 44 casos de fraude, 43 tiveram correspondência única por TID. Nos 43: nome declarado do titular, nome/documento/e-mail do comprador e ECI no nível `Payment` estavam presentes. ECI observado: 20 valores `0`, 23 valores `7`; nenhum tinha ECI aninhado, versão, referência ou CAVV de autenticação, nem `Authenticate=true`. Isso não determina responsabilidade ou elegibilidade. Há compras anteriores pelo mesmo CPF em 28 dos 43, sem validação de legitimidade dessas compras. Um caso não teve correspondência única nesta sonda; não classificá-lo como definitivamente perdido, pois a sonda não aplicou o fallback completo do coletor.

O coletor atual lê ECI somente em `ExternalAuthentication`. A anotação anterior de ECI indisponível no dossiê não comprova ausência no payload: esta lacuna de leitura precisa ser corrigida. Dados de cadastro atual são mutáveis e não devem ser apresentados como snapshot histórico.

## Tarefa 1 — Completar a evidência de pagamento e corrigir ECI

**Arquivos:** `src/lib/chargeback-dossier.ts`, `src/lib/chargeback-dossier.test.ts`.
**Interfaces:** preservar `collectChargebackEvidence(case): Promise<ChargebackEvidence>` e `evaluateChargebackEvidence(evidence)`; estender os campos do pagamento de modo compatível com evidências já arquivadas e fixtures.

- [x] Adicionar regressão no helper `payment` existente para ECI no nível raiz, incluindo o valor numérico zero. Dentro do describe atual:

```ts
it("reads root Payment.Eci without treating zero as missing", async () => {
  candidates = [payment({ Eci: 0, ExternalAuthentication: undefined })];
  attempts = candidates;
  const evidence = await collectChargebackEvidence(chargeback);
  expect(evidence.paymentAttempts[0]).toMatchObject({ eci: "0" });
});
```

- [x] Rodar `npm test -- src/lib/chargeback-dossier.test.ts` e confirmar a regressão antes da mudança.
- [x] Aceitar ECI raiz como fallback do campo aninhado existente, sem transformar valores inválidos em autenticação. Quando ambos forem válidos e divergirem, preservar a divergência de modo explícito; não escolher silenciosamente um resultado favorável. Cobrir ausência, strings inválidas, zero, igualdade e conflito.
- [x] Adicionar campos opcionais para nome declarado do titular e documento mascarado do comprador obtidos do pagamento vinculado. Não substituir esses dados pelo cadastro atual. Limitar comprimento e conteúdo; não carregar o objeto de cartão/autenticação inteiro para a evidência.
- [x] Testar snapshot de transação diferente do cadastro, campos ausentes e exclusão de PAN/CVV/CAVV. Confirmar que Visa 104, Mastercard 4837 e Elo 83 continuam inelegíveis mesmo com ingressos usados e campos novos preenchidos.
- [x] Rodar a suíte do coletor, revisar diff e publicar commit de implementação quando concluído.

## Tarefa 2 — Dossiê factual para fraude e lacunas visíveis

**Arquivos:** `src/lib/chargeback-dossier-pdf.tsx`, `src/lib/chargeback-dossier-pdf.test.ts`, `src/lib/chargeback-dossier.test.ts`; coletor apenas quando necessário à proveniência.
**Interfaces:** manter `renderChargebackDossierPdf(evidence)`, consumindo a evidência existente enriquecida na tarefa 1. Novos campos ausentes em arquivos antigos devem ser tratados como não disponíveis.

- [x] Testar e apresentar rótulos claros: “titular informado na transação”, “comprador informado na transação”, “cadastro consultado na coleta”, “uso registrado do ingresso”. Não chamar qualquer deles de identidade verificada.
- [x] Organizar os registros já existentes em sequência temporal: pedido, cobrança, comunicação, utilização e eventual reversão. Distinguir data do evento de data da coleta; manter data desconhecida explícita.
- [x] Descrever presença/ausência de autenticação sem concluir responsabilidade a partir de ECI. Não declarar fraude do comprador ou autorização do titular.
- [x] Exibir lacunas por caso: vínculo com o portador não comprovado, identidade na entrada não registrada, autenticação não comprovada, evento de comunicação diferente de confirmação de leitura, inconsistência de datas quando houver.
- [x] Garantir que essa seção documental não altere a decisão de envio. Preservar os motivos atuais de exceção e todas as proteções contra duplicidade, estorno, prazo expirado e uso parcial.
- [x] Validar PDF sintético visualmente e PDF histórico somente no diretório protegido. Testar layout com nomes longos, dados ausentes, documentos antigos e múltiplos ingressos; verificar ausência de segredos no texto/JSON.
- [x] Publicar commit após testes do coletor/PDF/sync. Não incluir amostras reais no Git.

## Tarefa 3 — Validar dados históricos e limites

**Arquivos:** relatório existente `docs/runbooks/cielo-chargeback-validation-2026-11-07.md`; harness sem credenciais em diretório temporário protegido.

- [x] Revalidar flag e agendador antes de qualquer sonda. Não chamar job de produção.
- [x] Aplicar o coletor completo ao caso sem correspondência única para diferenciar fallback válido, ausência e ambiguidade; não afrouxar a correlação para obter resultado positivo.
- [x] Gerar dossiês offline de amostras dos três motivos de fraude; conferir identificadores, proveniência, uso, lacunas e bloqueio de envio. Casos DONE jamais são reapresentados.
- [x] Investigar histórico anterior somente como evidência auxiliar, com consulta limitada e somente leitura. CPF repetido não demonstra mesmo cartão nem legitimidade. Sem correlação segura, registrar a limitação e não acrescentar argumento favorável ao PDF. A inclusão automática de histórico detalhado fica condicionada à orientação do produto; não é requisito desta preparação.
- [x] Registrar resultados agregados, checks e limites no relatório; nenhuma informação individual de comprador no repositório.

## Tarefa 4 — Publicar, verificar VM e entregar prontidão

**Arquivos:** runbook operacional e relatório de validação existentes.

- [x] Rodar testes dos módulos modificados e callers de sync/submission, `node --test scripts/run-chargeback-sync.test.mjs`, lint dos arquivos alterados e build/TypeScript. Não repetir a suíte global com falhas preexistentes sem mudança que justifique.
- [x] Fazer revisão independente do delta de coleta/PDF e suas consequências na política de envio; registrar achados e correções.
- [x] Publicar código e documentos; acompanhar o deploy autorizado de preparação e conferir release, saúde, proxy, flag false, tarefa desabilitada e ausência de envios. Não modificar credenciais nem reenviar alerta só para repetir prova já existente.
- [x] Confirmar remoto atualizado e checkout limpo. Entregar resumo do que está implementado, testado, não comprovado e dependente de terceiros/autorização.

## Consulta à Expansão — enviada em 09/11/2026 às 17:03

**Estado atual:** após a orientação anterior de não enviar, o responsável autorizou explicitamente o envio e criou um novo objetivo. A mensagem abaixo foi enviada uma única vez em nova conversa às 17:03, com destinatário e Cc conferidos. A avaliação da resposta de fraude agora precede a ativação final, por instrução do responsável.

**Para:** expansao.chargeback@cielo.com.br
**Cc:** dev@cluberincao.com.br
**Assunto:** Critérios de defesa por fraude em ingressos — EC 2899426197

Olá, equipe!

Sou Juan, responsável técnico pela integração do Clube Rincão (RINCAO POUSADA E LAZER LTDA, EC 2899426197). Por orientação de Davi, do suporte técnico da API de Chargeback, abrimos esta nova conversa para esclarecer as regras de defesa de vendas de ingressos pelo nosso site.

Precisamos dos critérios e documentos exigidos ou recomendados para Visa 104, Mastercard 4837 e Elo 83. Temos registros do pedido, pagamento e identificadores Cielo, dados declarados do comprador/titular e utilização do ingresso com data/hora. O registro de uso não identifica por si só o portador do cartão. Não presumimos que o pagamento aprovado ou os dados declarados comprovem autenticação.

Poderiam informar:
1. Quais evidências podem fundamentar a defesa nesses motivos e quais são obrigatórias por bandeira?
2. Qual comprovação de vínculo entre comprador, portador e usuário do ingresso é necessária? O conjunto descrito pode ser apresentado sem identificação física na entrada ou 3DS comprovado?
3. Histórico de compras anteriores pode ser utilizado? Quais critérios de vínculo e legitimidade precisam ser demonstrados?
4. Há checklist/manual aplicável ao segmento de ingressos e limitações para apresentação automatizada pela API?

Mantemos os envios reais desligados. Pedimos que mantenham dev@cluberincao.com.br em cópia. Nenhum documento ou dado individual de comprador está anexado.

Obrigado,
Juan — Desenvolvimento Clube Rincão

## Fora da conclusão desta preparação: operação real

Para declarar a automação integralmente funcionando, ainda será necessário:

1. Aguardar e avaliar a resposta da consulta enviada à Expansão; antes de ampliar a política de fraude, obter critérios e evidências suficientes. Não substituir silêncio por aprovação de fraude. Implementar, testar e publicar os ajustes que a avaliação justificar antes da ativação final.
2. Confirmar a liberação anunciada para 11/11; não esperar recebimento bem-sucedido com a flag false. Alinhar eventual recuperação de notificações ocorridas durante o período desligado, usando consulta de pendentes na ativação.
3. **Autorização condicionada atualizada em 09/11/2026:** após avaliar a resposta de fraude, concluir eventuais ajustes/publicação, aprovar os testes e confirmar efetivamente a liberação pela Cielo, ligar o fluxo único e agendador sem perguntar novamente. Antes disso, não executar job autenticado em produção. A data prevista de 11/11, sozinha, não satisfaz a condição. A ativação executará consultas periódicas e poderá enviar defesas já elegíveis; fraude continua bloqueada até critérios suficientes aprovados.
4. Observar primeiro callback real aceito, duas execuções periódicas, alertas e acompanhamento de um caso realmente elegível. Separar recibo técnico, recuperação do documento e resultado final. Ausência de caso não é prova de fluxo completo.

Acompanhamento futuro: `/painel/compras/contestacoes` (Atualizar consulta), tarefa `RincaoChargebackSync-prod`, histórico `jobName=chargebacks` e alertas `dev@cluberincao.com.br`.

## Registro de continuidade

Em 09/11/2026, este plano foi criado após leitura da resposta das 16:36. As tarefas de código acima ainda não foram executadas. Não houve novo e-mail, ativação ou envio de defesa. O objetivo solicitado cobre a preparação executável com envios desligados; sua conclusão não deve ser apresentada como conclusão das etapas externas de operação real.


### Escopo atualizado pelo responsável — 09/11/2026

O usuário quer toda a nossa entrega concluída, restando dependências externas, e autorizou explicitamente a ativação **depois dos testes e da confirmação da liberação pela Cielo, sem nova pergunta**. Isso substitui a exigência anterior de uma nova autorização para ativar. Até as duas condições se confirmarem, manter os envios desligados. Não criar ativação por data, não inferir liberação por passagem do prazo e não flexibilizar os motivos de fraude. A ativação e as verificações posteriores fazem parte do objetivo atualizado; não declarar o objetivo integral concluído apenas com a preparação.

O registro de objetivo do aplicativo estava pausado e sua ferramenta não permite editar o texto nem retomar o estado. Este plano vinculado registra a instrução vigente; o trabalho foi retomado pela autorização nesta conversa. Não marcar o objetivo antigo como concluído para contornar essa limitação.

### Execução da preparação — 09/11/2026

Coletor e PDF implementados, com novos campos opcionais para compatibilidade histórica. Testes reproduziram a ausência de ECI raiz/proveniência antes da correção. ECI divergente é explícito, sem resultado favorável escolhido silenciosamente; nome do titular validado e documento mascarado. Os indicadores de presença 3DS não reproduzem valores de autenticação. A política de elegibilidade não mudou.

A sonda completa aplicou o coletor real aos 44 casos DONE da lista protegida anterior: 43 vínculos e consultas E-commerce, sem inconsistências nesses 43; um `transaction_not_found`, inclusive após a lógica de fallback. Nenhum dos 44 elegível. Foram 435 consultas SQL somente leitura e 43 GETs de pagamento. Três PDFs históricos finais, um por motivo, têm três páginas e cerca de 12–13 KiB; inspeção visual identificou e corrigiu título cortado e separação de linhas de um ingresso. Dados pessoais permanecem apenas na área protegida.

Histórico por CPF: a presença de compras anteriores em 28 casos não demonstrou mesmo cartão nem legitimidade; nenhuma argumentação favorável foi adicionada com essa premissa. O contrato de coleta não foi expandido para buscar dados sem utilidade comprovada. Revisão independente não encontrou defeitos concretos em coleta, PDF, compatibilidade, callers e elegibilidade; executou 49 testes. Ajuste posterior de paginação foi validado novamente com PDFs reais.

O usuário reiterou **não enviar** a consulta à Expansão. Essa comunicação permanece suspensa por instrução explícita. A implantação da preparação e a verificação posterior seguem autorizadas; ativação depende dos testes e da confirmação efetiva da liberação, sem nova pergunta.

### Preparação publicada e verificada — 09/11/2026, 16:58–17:00

Código `46d953df3aba4fe5cc6ce7a738221196f221e0f2` publicado em main e na branch de trabalho. [Deploy VM 42687680352](https://github.com/ZaqV1-hub/new_rincao_site/actions/runs/42687680352) terminou success às 19:58:14 UTC. Runtime da VM confirmou essa release. Testes: 156 testes de integração na execução principal e seis do runner; após ajuste de paginação, 49 testes afetados passaram novamente, e o teste adicional de compatibilidade levou a suíte PDF a seis aprovados. Lint, build e TypeScript passaram. Revisão independente do complemento confirmou seis testes de PDF e nenhum risco concreto. A suíte global com falhas preexistentes não foi repetida.

Verificação pós-deploy: páginas públicas 200; callbacks externos 403 inclusive com headers forjados; job sem token 401; callbacks por loopback com origem confiável 404, comprovando runtime desligado. Flag false, tarefa Disabled/Enabled=false/nunca executada, quatro tabelas vazias, ACL protegida, Node loopback e proteção do proxy presentes; recursos descartáveis ausentes. A primeira consulta HTTPS da VM excedeu 15 segundos; checagens externas independentes retornaram 200 e nova verificação completa passou. Causa do timeout não foi estabelecida.

As quatro tarefas de preparação estão concluídas. O objetivo atualizado integral continua pendente da confirmação efetiva da Cielo e da ativação/verificação autorizadas; não declarar operação real concluída. Fraude permanece fora da elegibilidade. Nenhum e-mail à Expansão enviado. Nenhum processo de teste/deploy desta tarefa permanece ativo. Próxima ação: diante da confirmação real de liberação, conferir condições e executar ativação conforme runbook, sem nova pergunta. O cartão do objetivo do aplicativo permanece pausado por limitação da ferramenta; este arquivo contém o escopo e a autorização vigentes.

### Novo objetivo ativo e consulta enviada — 09/11/2026, 17:03

O objetivo anterior foi removido pelo usuário. Após nova autorização, foi criado um novo objetivo **ativo** para cobertura de fraude e ativação final. Não confundir com o cartão anteriormente pausado. A ordem vigente é: resposta de produto → avaliação → eventuais ajustes/testes/publicação → confirmação efetiva de liberação → ativação e verificação. Se a liberação técnica chegar antes da resposta de fraude, manter desligado até concluir a avaliação e os ajustes necessários. Não é preciso solicitar novamente autorização de ativação quando todas as condições forem satisfeitas.

Consulta enviada de `juansouza9.dev@gmail.com` para `expansao.chargeback@cielo.com.br`, com `dev@cluberincao.com.br` em Cc, assunto **Critérios de defesa por fraude em ingressos — EC 2899426197**, em nova conversa conforme orientação de Davi. Gmail confirmou “Message sent”; cópia enviada e detalhes confirmaram destinatários e 17:03. Sem anexos, segredos ou dados individuais de compradores. [Mensagem enviada](https://mail.google.com/mail/u/2/#sent/KtbxLthlwDcFvWVwMdZxNfGxgszkwjPRkL). Não reenviar.

Nenhuma alteração de código/VM/flag/tarefa neste envio. Release de preparação continua `46d953d`, com a última conferência documentada desligada. Próximas dependências são a resposta de produto e a confirmação efetiva da liberação; ainda não há base para ampliar elegibilidade ou ativar. O objetivo integral não está concluído.

### Dependência externa confirmada — 09/11/2026, após o envio

Três turnos consecutivos encontraram a mesma dependência externa. A última consulta ao Gmail mostra somente a consulta enviada às 17:03, sem resposta da Expansão, e a conversa técnica com seis mensagens, cuja última resposta é a de Davi às 16:36 com previsão para 11/11. Não há confirmação efetiva de liberação.

O objetivo fica bloqueado pelas respostas da Cielo, sem ser considerado concluído. Não há trabalho independente seguro restante nem processo de teste/deploy ativo. Não reenviar a consulta nem ampliar elegibilidade por ausência de resposta. Envios e agendador permanecem desligados. Próxima ação quando houver retorno: avaliar os critérios, executar ajustes sustentados por evidências e suas verificações, publicar e conferir a VM; ativar apenas após todas as condições registradas acima. Não há monitoramento contínuo ativo nesta conversa.
