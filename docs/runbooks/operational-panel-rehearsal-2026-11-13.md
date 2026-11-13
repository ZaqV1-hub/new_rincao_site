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

Ainda verificar o artefato Windows e os fluxos no ambiente publicado, concluir o mapeamento dos escritores legados e a configuração de corte antes de ativar operações concorrentes. A cópia de restauração ocupa aproximadamente 2,65 GB; o espaço livre observado após o ensaio foi aproximadamente 3,28 GB. Preservar o backup e remover somente recursos temporários próprios quando os ensaios dependentes terminarem.

Contas reais dos donos e fonte completa de recebimentos finais/contagem escolar da Estância aguardam confirmação. O painel mantém esses dados indisponíveis ou identifica o subtotal conhecido; não apresenta custos ausentes como zero. Atualização do Product Owner somente ao final, sem envio a terceiros até existir instrução específica.
