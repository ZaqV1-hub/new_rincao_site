# Painel de gestão — ensaio técnico de 13/11/2026

## Escopo e estado

Implementação local aprovada; despesas e resultado líquido da Estância pendentes de Isaque. Publicação autorizada somente em `develop`/HML, ao final das verificações. Nenhuma publicação em `main`, cobrança ou mensagem externa foi realizada neste ensaio.

O site depende da compatibilidade da API de ingressos no commit `e2679b2` (`rincao-ticket-api`, base `origin/develop` `189a254`). Publicar essa API antes do novo site. O runbook `docs/panel-compatibility.md` naquele repositório descreve o modo de sincronização, os endpoints de reenvio e os destinatários de homologação.

## Recuperação e migrações

Backup novo e consistente do HML em `C:\Backups\RincaoPanel\20261113-pre-develop-c646822`, acessível somente a Administrators/SYSTEM. O dump usa snapshot exportado na mesma transação das contagens e somas de conferência.

- `hml.dump`: 370.225.382 bytes, SHA-256 `e987049fa03814a15849c2472c9d57466e41efaccadce4297fe840ae93e9a5de`.
- Arquivos persistentes: 99 arquivos, 107.144.974 bytes, cada cópia conferida por SHA-256, incluindo configuração, uploads e `.data`.
- Restauração isolada: `rincao_panel_restore_c646822`, PostgreSQL 16.14, sem sobrescrever `clrincao_sistema_test`.
- Contagens iguais: 167.201 compras, 562.057 vouchers, 1.438 agendas, 76.538 usuários.
- Somas iguais: compras R$ 30.461.659,14; valores de vouchers R$ 30.378.507,63. São totais técnicos da cópia, não receita gerencial do período.
- As 13 migrações iniciais foram aplicadas, reaplicadas e verificadas na cópia sem alterar essas contagens/somas. A migração adicional de índices foi ensaiada da mesma forma, totalizando 14.

A migração `2026-11-13-summary-date-indexes.sql` tem SHA-256 `0c17297eaa610e47f1f88a202b66e995266f0a01be4eadbab992c7e6a7eaad4a`. Já foi aplicada no banco local isolado e na cópia da VM; não editar seu conteúdo. Criar outra migração para alterações futuras.

Manifestos remotos: `database-manifest.json`, `persistent-manifest.json`, `restore-verification.json`, `migration-verification.json` e `migration-performance-verification.json`, na pasta do backup. A primeira tentativa incompleta está identificada separadamente e não é um backup válido.

## Apuração e desempenho

A consulta anterior percorria todos os vouchers para cada data e atingiu o timeout de 18 segundos no cenário anual de datas abertas. A consulta compartilhada agora seleciona IDs pelos caminhos independentes de validade, agenda legada e entrada efetiva, com união sem duplicatas e índices correspondentes.

Na cópia restaurada, os resultados antigos e novos coincidiram integralmente em dez datas com movimento. Medições após a alteração: dia 35 ms; intervalo mensal com corte 20 ms; 317 datas abertas no ano 1.658 ms. São medições dessa VM/cópia, não garantia de latência sob concorrência. A data de visita continua distinta da data de entrada e de recebimento.

## Homologação de mensagens

A configuração HML verificada tem credenciais reais de WhatsApp, modo de teste e nenhuma lista de destinatários. O site agora bloqueia lista de teste vazia. A API também bloqueia texto/imagem em modo `test` sem `WHATSAPP_TEST_ALLOWED_NUMBERS`. Nenhum número foi acrescentado nem mensagem enviada neste ensaio.

Reenvios do painel usam UUID persistido, JWT de serviço, journal por voucher, URL de imagem específica da solicitação e consulta de status sem redisparar. A imagem consulta a validade canônica. Aceite pelo provedor não é confirmação de entrega. Resultado parcial, timeout ou HTTP 5xx não é autorização para repetir.

## Verificação e próximos gates

Suite local: 2.059 testes do site em 369 arquivos, com PostgreSQL e sem skips; 45 testes da API, incluindo concorrência real no PostgreSQL, sem skips; 21 testes de scripts. Lint: nenhum erro e 12 avisos legados. Build e TypeScript passaram após a última alteração. A consulta de status reaproveita a conexão já adquirida após o COMMIT, evitando esgotar o pool em seis consultas simultâneas; regressão PostgreSQL comprovada. Imagem de ingresso com intervalo de seis meses inspecionada visualmente. Revisão manual do coordenador; revisão independente adicional indisponível pelo limite de uso previamente registrado.

Ainda verificar o artefato Windows e os fluxos no ambiente publicado, concluir o mapeamento dos escritores legados e a configuração de corte antes de ativar operações concorrentes. A cópia temporária foi removida somente após concluir os ensaios e reconferir o SHA-256 do dump; o backup e todos os manifestos permanecem preservados. Espaço livre após a limpeza: aproximadamente 5,77 GB.

Contas reais dos donos e fonte completa de recebimentos finais/contagem escolar da Estância aguardam confirmação. O painel mantém esses dados indisponíveis ou identifica o subtotal conhecido; não apresenta custos ausentes como zero. Atualização do Product Owner somente ao final, sem envio a terceiros até existir instrução específica.

## Preparação efetiva do HML

- API publicada em `develop` no commit `e7ff830` (compatibilidade `e2679b2` mais isolamento de uma fixture de versão que recebia `GITHUB_SHA` do CI). Workflow [43474510109](https://github.com/juansouza09/rincao-ticket-api/actions/runs/43474510109) passou. No Windows CI, 44 testes passaram e o teste PostgreSQL ficou condicionado à URL de teste; os 45 foram executados localmente com PostgreSQL.
- As 14 migrações foram aplicadas e verificadas em `clrincao_sistema_test`; contagens e somas antes/depois coincidiram. Evidência `hml-migration-verification.json` na pasta restrita de backup.
- Três papéis novos de consulta, sem privilégios de escrita/CREATE, configurados no arquivo persistente HML para Rincão, Estância day use e Estância escolar. Corte em 13/11/2026, sem retroagir histórico. Nenhum acesso de dono real concedido. Credenciais permanecem apenas na VM.
- PHP legado HML usa o mesmo banco; seu front controller recebeu proteção preparada, ainda desativada. Ativar `ingresso/panel-cutover.enabled` somente junto da promoção do site. GET/HEAD encaminham ao novo site/painel; demais operações recebem 409. Callbacks explícitos de notificação/retorno/status e conciliação de pagamentos permanecem disponíveis. Sete casos de roteamento e sintaxe PHP 7.4 passaram. Backup do front controller e hashes em `legacy-cutover-prepared.json`.
- Após ativar o site, configurar `OPERATIONAL_PANEL_VALIDATION_MODE=sync-only` somente na API HML e reciclar seu pool. O job HML da meia-noite já chama a rota Next atualizada; jobs PROD não foram alterados. Serviços antigos com nome HML mas configuração PROD foram identificados e preservados.
- A configuração Cielo existente do HML aponta o endpoint de produção. Não executar compra/cobrança real durante os testes; provas financeiras usam banco local isolado. Nenhuma credencial ou configuração Cielo foi alterada.

Rollback: o deploy Next mantém release anterior e reverte em falha de saúde. Migrações são aditivas e preservam o legado. Antes de voltar ao painel antigo depois de haver novas operações, conferir sessões/fechamentos e compatibilidade; não apagar o flag nem liberar novamente escrita canônica da API automaticamente. O backup do front controller permite restauração controlada. Dados históricos e snapshots não devem ser apagados para voltar código.

## Resultado da primeira ativação

Site `e4d58ef` ativado com sucesso pelo workflow [43476018203](https://github.com/ZaqV1-hub/new_rincao_site/actions/runs/43476018203). O artefato Windows passou no renderizador PNG antes da troca. Foram executadas 25 verificações HTTP autenticadas/negativas, com igualdade entre resumo e donos, exportações reais e revogação. O usuário sintético de teste e sua autorização foram removidos. PDF de três páginas A4 e XLSX de cinco abas/três imagens íntegros. Previsão MET Norway disponível, consulta real `2026-11-13T17:54:50.101Z`.

Proteção PHP ativada e API HML em `sync-only`, com confirmação HTTP: redirecionamentos 302, gravações antigas 409 e caminho direto inexistente 404. A validação antiga da API foi recusada 409 e o voucher permaneceu exatamente igual. Evidências remotas `hml-smoke-verification.json`, `cutover-activation.json`, `cutover-smoke-verification.json`; nenhum pagamento ou mensagem externa.

A primeira tentativa de ativar a proteção ocorreu durante o aquecimento e parou na checagem de saúde antes de alterar configurações. A segunda ocorreu após `robots.txt` responder 200. O primeiro teste do caminho direto esperava 409, mas o IIS corretamente retorna 404 antes do PHP; a expectativa foi corrigida, sem mudar a aplicação.

A validação de negócio no HML usou sessões técnicas assinadas apenas dentro da VM e um dono sintético temporário; não testou as credenciais nem concedeu acesso às contas reais. Login/browser público, autenticação e regras de negócio também possuem as provas locais descritas no plano. Não declarar aceite da equipe, restauração sobre pagamentos posteriores ou promoção para produção.

## Texto preparado para o Product Owner

A implementação do painel do Rincão foi disponibilizada em homologação pela branch develop. Inclui agenda e preços por data, serviços, programação com previsão do tempo e materiais, caixas por local, gestão de compras/vouchers, app online de contagem com assinatura, recebimentos e fechamento dos passeios, fechamento diário com histórico e relatórios, e consulta separada dos donos. As faixas etárias seguem o sistema atual; vouchers podem ser usados em qualquer dia aberto dentro da validade; passeios só finalizam com recebimento integral confirmado.

Testes automatizados, migrações, restauração de backup e verificações na VM foram realizados. Despesas e resultado da Estância permanecem pendentes da regra com o Isaque. O consolidado escolar da Estância ainda depende de comprovar a fonte de recebimento final e contagem completa. Falta identificar as contas reais dos donos e obter o aceite operacional da equipe. Produção/main permanece sem esta entrega. O checkout de homologação conserva a configuração anterior da Cielo de produção; não testar com cartão real.
