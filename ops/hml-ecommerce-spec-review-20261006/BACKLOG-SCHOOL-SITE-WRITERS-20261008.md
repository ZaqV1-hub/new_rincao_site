# Compra escolar do site: revisão e retenção canônicas

Goal: integrar os writers independentes do site ao gate escolar compartilhado com Lumi e ao tratamento operacional de valores retidos.

Context: compras pendentes do site já têm ESC; callbacks não podem enviar nem permitir uso antes da admissão canônica. O payload financeiro original deve permanecer disponível.

Constraints: PostgreSQL/HML; flag explícita para rollout coordenado; sem cobrança, estorno ou produção; sem mudança do julgamento por LLM. Vouchers existentes e origem site preservados. Extração de responsabilidades dos módulos grandes antes de adicionar a integração.

Done when: cotação oficial antes de criar aluno; mesmo lock de identidade nos writers; contabilização e retenção atômicas; worker reavalia e enfileira os mesmos vouchers; envio/uso bloqueados; painel autenticado consulta e registra ações; provas PostgreSQL/HTTP, testes focados e revisão final.

## Funcionamento para o Business Owner

Uma Pessoa Exemplo seleciona escola, passeio, aluno, etapa, ano, letra e valor no site. A cotação usa a fonte oficial. Quando já existe ingresso pago para a mesma combinação, o checkout aguarda a revisão canônica: confirmar duplicidade recusa a compra; confirmar homônimo distinto permite uma única compra para aquela revisão.

Se dois checkouts pagam perto um do outro, o primeiro pagamento válido pode seguir; o outro fica contabilizado e com ingresso retido até revisão. Falta de contexto, indisponibilidade da revisão ou visita vencida mantém a retenção. O dinheiro não desaparece da contabilidade e nenhum estorno é iniciado automaticamente.

O painel apresenta motivo, referência e histórico. Um operador autorizado registra acompanhamento externo ou solicita nova avaliação de recusa/expiração, com justificativa e registro de autoria. A nova avaliação nunca equivale a liberar diretamente o ingresso. Correção de contexto e resolução financeira externa exigem atendimento próprio.

O owner comprova o resultado confrontando compra paga, payload financeiro preservado, estado da retenção, histórico, gate canônico e uma única entrega dos vouchers originais. A flag só deve ser ligada após tenant e site compatíveis em HML. A matriz dos dez casos permanece pendente de conversa real com LLM e provas de painel/ESC.

## Evidências e riscos

Preflight: base `86f5bb88e6b2018cd15b309dd9bc18fb66e61f03`; typecheck original tem cinco erros em testes de checkout. Gateway LLM indisponível (502) no último probe. Sem mudanças em produção.

## Entrega implementada e verificada

Site e tenant compartilham identidade exata, quote/HMAC, claim durável de uso único e retenção financeira atômica. Callback conserva payload e origem; worker real reaproveita o ESC e enfileira uma entrega. Painel autentica sessão/ACL/permissão, valida origem pública configurada, usa CAS e audita autoria/justificativa. Cliente PDF/WhatsApp, entrega automática, quatro validações de portaria e QR operacional recusam retenções. Rótulos do voucher vêm do snapshot oficial. Resumo financeiro continua disponível; não é emissão de ingresso.

Evidências locais: tenant build e115 testes; site typecheck/build, ESLint54 arquivos,69 testes focados. Suíte ampla site687PASS/12FAIL; as mesmas12 falhas foram reproduzidas no baseline685PASS/12FAIL. Budget de duplicação do site11,5% passa(7,20%); modo estrito5% continua falhando(base7,05%). Isso é dívida legada explícita, sem afirmar conformidade com5%.

Dois bancos PostgreSQL e APIs reais:50 checks com painel Next no navegador;50 checks finais incluindo label oficial distinto do default. Sessão do operador, fonte oficial, callback e julgamento humanos são sintéticos. Outbox/auditoria persistidos e decisões publicadas em evolution sem payload de aluno. Containers/volumes/processos próprios encerrados. Os dois reports e screenshots ficam em evidence, com hashes de fontes no manifesto final.

## Extrações e dívida arquitetural

Mantidos todos os exports das fachadas. Módulos novos até400 linhas. Painel-bilheteria segue1358 linhas após retirar impressão/contratos: incidente legado aberto. Próxima extração neste backlog: consultas/detalhe, reservas/pagamento e status do gateway em módulos separados, sem acrescentar regra a esse arquivo. Aumento aparente de clones decorre também de separar blocos legados em arquivos; não se mascara o modo estrito. Correções mecânicas de fixtures/stubEnv resolvem cinco erros anteriores de typecheck sem alterar comportamento.

## Ativação coordenada em HML

1. Implantar tenant/DDL aditivo e confirmar SHA, banco test e worker.
2. Implantar site; configurar somente no cofre HML: SCHOOL_COMMERCE_ADMISSION_ENABLED, SCHOOL_COMMERCE_TENANT_ID, SCHOOL_COMMERCE_TENANT_API_URL e SCHOOL_COMMERCE_HMAC_SECRET. Segredo usa contrato lumi-to-tenant existente, nunca NEXT_PUBLIC.
3. NEXT_PUBLIC_SITE_URL deve corresponder à origem pública do painel para CSRF atrás do proxy. Ativar flag apenas após compatibilidade dos dois lados. Desligar flag não contorna retenções/snapshots já gerenciados. Não apagar as novas colunas/claims em rollback.
4. Conferir saúde e autorização sem criar pedido/cobrança/entrega; completar C9 por conversa real quando gateway voltar. Gateway permanecia502/ECONNREFUSED às21:15UTC. A matriz permanece0/10 concluídos; nada local equivale a aceite comercial.

Próximo incremento: conversa C9 real em HML e comprovação de estados/ESC; depois avançar os outros casos da matriz. Sem estorno, cobrança, envio externo ou leitor físico nesta entrega.
