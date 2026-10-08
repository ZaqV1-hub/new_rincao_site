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
