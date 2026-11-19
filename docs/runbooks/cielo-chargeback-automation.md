# Operação automática de contestações Cielo

O job consulta casos confirmados pela API Cielo, correlaciona a compra, coleta evidências, arquiva o dossiê e apresenta a defesa automaticamente quando as verificações passam. **Não há aprovação humana obrigatória por motivo, inclusive fraude.** O painel acompanha documentos, envios, resultados e pendências; alertas operacionais vão para `dev@cluberincao.com.br`.

**Política autorizada em 19/11/2026:** envio automático para qualquer motivo/bandeira, incluindo Visa 104, Mastercard 4837 e Elo 83. A política `automatic-all-reasons-v1` substitui a análise obrigatória ativada em 16/11. `CIELO_CHARGEBACK_ENABLED=true` passa a permitir também apresentação de defesas reais. Não é necessário habilitar outra flag ou aprovar cada caso.

O envio não garante êxito da defesa. O texto solicita revisão com os registros anexos; o PDF preserva as limitações de identidade, autenticação e histórico. Uso do ingresso não comprova identidade do portador. Nenhuma evidência ausente é inventada.

**Estado verificado em 19/11/2026, 15:08 BRT:** release `5096a9f`, flag true, tarefa habilitada e duas execuções bem-sucedidas após ativação. Nenhum pendente encontrado na consulta histórica atual; nenhuma defesa real apresentada nesta validação. A implantação foi recuperada de falta de espaço, com cópia verificada e deploy do artefato compilado. Restaram cerca de 2 GB livres na VM; acompanhar capacidade. Ver [registro de validação e limites](../superpowers/plans/2026-11-09-chargeback-fraude-finalizacao.md).

## 1. Habilitação com a Cielo

Solicitar ao suporte da API de Chargeback, com acompanhamento do gestor comercial:

- Cadastro dos ECs da matriz e dos estabelecimentos operados, raiz do CNPJ e e-mail de acesso ao portal. Confirmar que as credenciais permitem consulta, recusa, consulta de documento e ciclo de vida desses ECs.
- Credenciais próprias da API de Chargeback nos ambientes apropriados. MerchantId/MerchantKey da API E-commerce não substituem Client ID/Secret desta integração.
- Assinatura do certificado mTLS e confirmação de sua validade. Enviar somente o material público solicitado; a chave privada permanece no servidor. Confirmar renovação antes do vencimento.
- Cadastro das duas URLs de callback descritas abaixo. Confirmar autenticação suportada, retentativas, timeout de confirmação, comportamento de eventos repetidos e fora de ordem. A API documenta webhooks somente em produção.
- Collection oficial atualizada e homologação de `PUT /refuse`: PDF, dez páginas no máximo, até 8.000.000 bytes, justificativa até 100 caracteres, responsável e nome do arquivo igual ao IdCase.
- Confirmar requisitos de defesa por motivo, bandeira e estágio do processo; validar amostras reais. Documento gerado e retorno de aceitação do envio não significam vitória na disputa.
- O filtro de consulta usa `idCase` (camelCase), conforme a collection e a chamada real; `idcase` minúsculo foi ignorado no sandbox. Confirmar limites inclusivos/exclusivos das datas e retenção do histórico. A janela máxima é 180 dias; o cliente rejeita datas iguais e trabalha com início anterior ao fim.

**Contrato de apresentação homologado:** em 07/11/2026 o envio JSON/base64 descrito no OpenAPI foi rejeitado por HTTP 400. O formato multipart do manual v3.2.1 e da collection foi aceito por HTTP 200/código 102. O cliente envia os campos textuais `establishmentNumber`, `idChargeback`, `reasonToRefuse` e `userName`, além do PDF binário no campo `file`, com nome `<idCase>.pdf`. Os identificadores mantêm todos os dígitos. Não tratar HTTP 200 isolado como confirmação: o sucesso de apresentação exige código 102. Esse aceite foi exercitado somente em sandbox, com dados fictícios.

Referências oficiais: [credenciais](https://docs.cielo.com.br/pix-can-cbk/reference/autenticacao-e-credenciais-cb), [mTLS](https://docs.cielo.com.br/pix-can-cbk/reference/geracao-de-certificado-mtls-cb), [token](https://docs.cielo.com.br/pix-can-cbk/reference/obtencao-token), [consulta](https://docs.cielo.com.br/pix-can-cbk/reference/consulta-contestacao-pendente-tratada), [recusa](https://docs.cielo.com.br/pix-can-cbk/reference/recusa-de-contestacao), [webhooks](https://docs.cielo.com.br/pix-can-cbk/reference/webhook), [sandbox](https://docs.cielo.com.br/pix-can-cbk/reference/instrucoes-sandbox) e [códigos de retorno](https://docs.cielo.com.br/pix-can-cbk/reference/status-de-retorno).

## 2. Banco e implantação

Usar o PostgreSQL do **sistema**, configurado por `INGRESSO_SISTEMA_DB_*`, para as tabelas `chargeback_cases`, `chargeback_events`, `chargeback_dossiers` e `chargeback_reconciliation`. Não aplicar a migração por conveniência no banco de comunicações. Confirmar que `INGRESSO_SISTEMA_DB_CLIENT`/`DIALECT` seleciona PostgreSQL e que host, porta, banco e usuário correspondem ao runtime.

O pool do sistema precisa permitir pelo menos duas conexões simultâneas (`INGRESSO_SISTEMA_DB_POOL_MAX>=2` quando configurado por host/porta): uma mantém o lock do worker e outra coleta evidências ou enfileira alertas. Quando a configuração usa URL, verificar o limite efetivo do pool.

Antes da alteração, registrar backup restaurável e testar a migração duas vezes no banco de homologação. O SQL é aditivo e inclui `BEGIN`/`COMMIT`. No checkout aprovado, com `PGHOST`, `PGPORT`, `PGDATABASE` e `PGUSER` apontando explicitamente para esse banco, executar:

```powershell
psql --no-psqlrc --host "$env:PGHOST" --port "$env:PGPORT" --dbname "$env:PGDATABASE" --username "$env:PGUSER" --password --set=ON_ERROR_STOP=1 --file .\docs\sql\2026-11-03-chargeback-dossiers.sql
if ($LASTEXITCODE -ne 0) { throw 'Migracao de chargeback falhou.' }
```

`--password` solicita a senha sem incluí-la na linha de comando. Esses nomes `PG*` são parâmetros do utilitário `psql`; não são lidos automaticamente do `.env.local`. Preenchê-los com o mesmo destino efetivo de `INGRESSO_SISTEMA_DB_*` antes do comando. Não executar com valores ausentes ou com o banco de outro ambiente. Para TLS, configurar o cliente `psql` conforme a política do banco, sem desabilitar a verificação do certificado.

Implantar a revisão aprovada pelo fluxo existente. PDFs, snapshots, recibos e estados ficam no PostgreSQL e precisam fazer parte do backup e do teste de restauração. Não há exclusão automática de evidências: acordar retenção com a operação. O servidor deve permitir saída HTTPS para os hosts oficiais Cielo e acesso às fontes de evidência configuradas.

## 3. Configuração inicial

Guardar os valores no arquivo persistente do ambiente, fora do Git e da release. Conforme o mapeamento do projeto: `C:\SitesData\Rincao\hml\.env.local` ou `C:\SitesData\Rincao\prod\.env.local`. Restringir ACLs do arquivo, certificado e chave às contas que precisam lê-los. Reiniciar o runtime pelo procedimento de implantação após mudanças.

| Variável | Configuração |
| --- | --- |
| `CIELO_CHARGEBACK_ENABLED` | `false` durante preparação; `true` quando a integração estiver validada para o ambiente. |
| `CIELO_CHARGEBACK_ENVIRONMENT` | Exatamente `sandbox` ou `production`. |
| `CIELO_CHARGEBACK_CLIENT_ID` / `CIELO_CHARGEBACK_CLIENT_SECRET` | Credenciais fornecidas pela Cielo. |
| `CIELO_CHARGEBACK_CERT_PATH` / `CIELO_CHARGEBACK_KEY_PATH` | Caminhos absolutos para certificado PEM assinado e chave PEM. |
| `CIELO_CHARGEBACK_KEY_PASSPHRASE` | Opcional, se a chave privada for criptografada. |
| `CIELO_CHARGEBACK_ESTABLISHMENT_NUMBERS` | ECs autorizados, cada um com dez dígitos, separados por vírgula. |
| `CIELO_CHARGEBACK_USER_EMAIL` | E-mail do responsável pela tratativa transmitido à Cielo. |
| `CIELO_CHARGEBACK_ALERT_EMAIL` | Caixa operacional monitorada para exceções e risco de prazo. |
| `CIELO_CHARGEBACK_START_DATE` | Opcional, `AAAA-MM-DD`, início do histórico a reconciliar. Sem ele, o worker usa a compra local mais antiga e, sem compras, a janela inicial de 30 dias. Escolher data que cubra as contestações pendentes conhecidas. |
| `INGRESSO_OPERATIONS_JOBS_TOKEN` | Segredo de autenticação da rota operacional. Não é `INGRESSO_OPERATIONS_API_TOKEN`. |
| `CIELO_CHARGEBACK_JOB_BASE_URL` | Origem explícita do runtime, sem caminho, query ou credenciais. Exemplos do mapeamento: `http://127.0.0.1:8062` em hml, `http://127.0.0.1:8061` em produção. |
| `CIELO_CHARGEBACK_JOB_TIMEOUT_MS` | Opcional; padrão `240000`, faixa permitida de `1000` a `1800000`. |

O runner permite HTTP somente em loopback; fora disso exige HTTPS e não segue redirects. As chamadas Cielo continuam usando HTTPS/mTLS independentemente da URL local do job. O runner não precisa ler certificado ou credenciais Cielo diretamente; quem utiliza esses valores é o runtime servidor.

Preservar a configuração existente da consulta E-commerce (`INGRESSO_CIELO_MERCHANT_ID` e `INGRESSO_CIELO_MERCHANT_KEY`) e confirmar que corresponde às cobranças correlacionadas. Essa consulta pode complementar a confirmação de pagamento/cancelamento; não confundir suas credenciais com as da API de Chargeback. Confirmar também os dois pools de evidências (`INGRESSO_SISTEMA_DB_*` e `INGRESSO_DB_*`), pois o banco de comunicações pode ser diferente.

A varredura consulta uma página por execução, começando pelas notificações mais recentes e caminhando até o início do histórico configurado. O cursor é persistido; casos conhecidos têm prioridade e falhas não reiniciam a varredura. Um novo ciclo começa 24 horas após completar o anterior. Casos descobertos entram no próximo tick do job.

A política `automatic-all-reasons-v1` não restringe motivo ou bandeira. Mantém as verificações técnicas existentes: primeira contestação identificada, moeda real, caso pendente e dentro do prazo, vínculo inequívoco com compra/pagamento/EC, captura confirmada, ausência de estorno ou cobrança duplicada, valores conciliados e uso válido cobrindo o valor integral. Caso/evidências são consultados novamente antes de transmitir. Uma inconsistência mantém o caso em `exception` (**Pendência no processamento**) e gera alerta; remover análise humana por fraude não autoriza enviar documentos da compra errada ou afirmar fatos sem comprovação.

Antes da primeira transmissão, o contador de tentativas é reiniciado: revisões periódicas anteriores não consomem as 12 tentativas de envio. Falhas definitivamente transitórias mantêm esse limite nas tentativas seguintes; respostas incertas nunca autorizam reenvio automático.

Os alertas usam `queueLegacyEmail`. Configurar `EMAIL_SMTP_SERVER`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_SSL`, `EMAIL_SMTP_USERNAME`, `EMAIL_SMTP_PASSWORD`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` e `EMAIL_REPLYTO_ADDRESS`. Para entrega síncrona, usar `PASSWORD_RESET_SEND_SYNC=true` — esse é o nome já usado pelo módulo compartilhado. Se estiver `false`, comprovar que existe um consumidor ativo da fila `email`. Enfileiramento não comprova entrega ou leitura; testar uma mensagem de alerta na caixa operacional e monitorar falhas SMTP.

## 4. Callbacks

URLs de produção encaminhadas ao suporte em 07/11/2026:

```text
https://cluberincao.com.br/api/cielo/chargebacks/notification
https://cluberincao.com.br/api/cielo/chargebacks/lifecycle
```

Davi confirmou em 09/11/2026 que o callback **não oferece autenticação por token**. A origem é validada pelos seis IPs de produção em `src/lib/cielo-chargeback-production-ips.json`: São Paulo `54.207.186.191`, `18.229.238.7`, `54.232.53.112`; Virgínia `52.202.189.158`, `3.216.242.251`, `54.166.2.45`. Os IPs de homologação não estão autorizados em produção.

O deploy de produção executa `scripts/configure-chargeback-proxy.ps1`. O script valida o proxy existente, faz backup do `web.config`, bloqueia origens não permitidas nos callbacks e faz o IIS **sobrescrever** `x-rincao-remote-address` com `{REMOTE_ADDR}` em todas as requisições encaminhadas. O aplicativo também valida esse endereço. `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP` e o token antigo não autorizam o callback. O Node deve escutar exclusivamente em `127.0.0.1`; o deploy confere isso após iniciar a release. A instalação foi testada em IIS descartável, incluindo cabeçalho forjado, instalação repetida e restauração do backup.

Esta fronteira pressupõe acesso direto ao IIS. Antes de acrescentar CDN/proxy externo ou mudar a exposição do Node, revisar o mecanismo de origem confiável. Não confiar livremente no IP informado pelo cliente. O rollback restaura primeiro o aplicativo anterior e só depois o `web.config`, preservando a proteção durante a troca. Backups ficam em `C:\Deploy\Rincao\proxy-backups`.

Segundo o suporte: qualquer 2xx confirma recebimento, há três tentativas consecutivas e timeout de 30 segundos. Intervalo exato entre tentativas não foi informado. Na resposta de 09/11 às 16:36, a liberação no firewall foi prevista para 11/11; eventos chegam quando houver casos, sem teste sintético confirmado. Enquanto `CIELO_CHARGEBACK_ENABLED=false`, origens Cielo continuam recebendo 404 no aplicativo; demais origens recebem 403 na borda. Não declarar entrega ativa antes da ativação e de observar um evento real.

A notificação aceita o envelope `content: [...]` documentado e o formato direto anterior; o lifecycle aceita `idcase` documentado e `caseId` legado. Aliases conflitantes, lotes ambíguos e ECs não autorizados são rejeitados antes da persistência; limites de 100 eventos e 64 KiB. O receptor apenas persiste o identificador permitido; o worker busca o caso na API autenticada antes de aceitar os dados como evidência. As permissões do EC precisam corresponder à lista local. Coordenar mudanças dos IPs de saída com a Cielo. Homologação do receptor usa testes locais; a primeira entrega real depende do cadastro em produção, pois não há sandbox de webhook.

## 5. Runner e tarefa do Windows

O runner é uma execução única. Faz `POST /api/ops/jobs/chargebacks` com `x-ops-jobs-token`; não usa cookies do painel e não retransmite o POST automaticamente. Node 20.19.5 já consta no fluxo documentado do projeto; `--env-file` é suportado nessa versão. Variáveis herdadas pelo processo têm precedência sobre o arquivo, portanto remover configurações antigas de outro ambiente antes de testar. [Documentação Node](https://nodejs.org/download/release/latest-v20.x/docs/api/cli.html#--env-fileconfig).

Após a configuração e homologação autorizadas, executar uma vez a partir do checkout do ambiente:

```powershell
node --env-file=.env.local scripts/run-chargeback-sync.mjs
```

Na VM, o arquivo fica fora do checkout; usar seu caminho absoluto:

```powershell
node --env-file="C:\SitesData\Rincao\hml\.env.local" "C:\Deploy\Rincao\hml\repo\scripts\run-chargeback-sync.mjs"
```

**Esse comando pode apresentar defesas reais em produção.** A ativação foi autorizada em 19/11/2026; conferir ambiente, release e credenciais antes de executá-lo. O timeout limita a espera do runner; não garante cancelamento do worker no servidor. Em resultado incerto, consultar o estado persistido em vez de forçar retransmissão.

Para registrar uma tarefa a cada cinco minutos, adaptar o exemplo abaixo ao ambiente confirmado. Ele acompanha o padrão de conta `SYSTEM` já usado em `scripts/install-vm-runtime.ps1`; a conta precisa ler o arquivo de ambiente. Nenhum segredo aparece nos argumentos da tarefa. O exemplo cria uma tarefa nova, sem sobrescrever tarefas existentes:

```powershell
$environment = 'hml' # Trocar para prod somente na ativacao aprovada.
$repo = "C:\Deploy\Rincao\$environment\repo"
$envFile = "C:\SitesData\Rincao\$environment\.env.local"
$script = Join-Path $repo 'scripts\run-chargeback-sync.mjs'
$logFile = "C:\Deploy\Rincao\$environment\logs\chargeback-sync.log"
$taskName = "RincaoChargebackSync-$environment"
$node = (Get-Command node.exe -ErrorAction Stop).Source
if (!(Test-Path $envFile) -or !(Test-Path $script)) { throw 'Ambiente ou runner ausente.' }
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null
$command = "& '$node' '--env-file=$envFile' '$script' >> '$logFile' 2>&1; exit `$LASTEXITCODE"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -Command `"$command`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings
Get-ScheduledTask -TaskName $taskName
Get-ScheduledTaskInfo -TaskName $taskName
```

Confirmar na tarefa a repetição contínua de cinco minutos e observar duas execuções completas. Se aumentar `CIELO_CHARGEBACK_JOB_TIMEOUT_MS`, ajustar o limite de execução da tarefa para permitir a finalização do runner. O lock persistente no PostgreSQL também impede workers simultâneos. Configurar rotação de `chargeback-sync.log` e monitorar `LastTaskResult`, horário da última execução e falhas consecutivas. O cadastro acima não integra automaticamente o job ao instalador existente; preservar a tarefa entre releases e revalidar o caminho do runner nos deploys. [Triggers do Windows](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasktrigger).

Saídas esperadas:

| Resultado | Exit code | Ação operacional |
| --- | --- | --- |
| `result=completed imported=... processed=... failed=0` | 0 | Execução concluída. |
| `result=skipped reason=worker_locked` | 0 | Outra execução possui o lock; observar se o estado persiste anormalmente. |
| `result=partial ... failed=N` | 1 | Há falhas; consultar casos e alertas. |
| `result=failed reason=http_401` | 1 | Conferir token do job no runner e runtime. |
| `result=failed reason=http_503` | 1 | Conferir configuração, banco, Cielo e estado do job. |
| `result=failed reason=timeout` | 1 | Verificar se o worker ainda executa; não alterar estados para forçar envio. |
| `result=failed reason=invalid_configuration` | 1 | Conferir origem, token e timeout do runner. |

## 6. Aceite e recuperação

- Validar migração reexecutável e backup/restauração incluindo bytes dos PDFs e snapshots.
- Autenticação mTLS/OAuth, consultas PENDING/DONE, código 102, consulta de documento e ciclo de vida foram exercitados no sandbox. Paginação e ausência de resultados foram exercitadas também em produção, somente em leitura. O documento retornado pelo sandbox é fixo e diferente do PDF enviado; a confirmação por hash e a recuperação de resposta perdida têm testes locais, mas ainda exigem validação externa em cenário com persistência real. Não remover essas proteções para acomodar o simulador.
- Validar envio único de casos elegíveis de serviço e fraude, exceções com alerta, PDF arquivado, evento duplicado, mudança de evidência, falha transitória e resposta de envio perdida. Reinício e resposta incerta devem reconciliar o documento/estado sem retransmitir cegamente.
- Validar que resultado favorável/desfavorável vem do ciclo de vida e permanece distinto de defesa apenas apresentada.
- Confirmar entrega de alerta, funcionamento da tarefa após reinício da VM e ausência de tokens/PDFs/dados de pagamento nos logs.

Rejeições definitivas de transmissão e o esgotamento de 12 tentativas recuperáveis ficam em `rejected` (Envio bloqueado), com alerta. Corrigir a configuração e confirmar a situação na Cielo antes de uma recuperação operacional autorizada; eventos repetidos não liberam novo envio automaticamente. Casos em `uncertain` continuam em reconciliação, sem reenvio automático; ausência de documento isolada não comprova que a Cielo não recebeu a defesa.

Para interromper novas execuções durante manutenção, desabilitar a tarefa do ambiente e colocar `CIELO_CHARGEBACK_ENABLED=false`, seguindo o procedimento de reinício do runtime. Preservar todas as tabelas e estados; não excluir casos ou redefinir `submitting`/`uncertain` para `queued`. Um envio sem confirmação exige reconciliação de estado/documento na Cielo. Não há ação automática de aceite do chargeback nem de reembolso neste fluxo.

O código Cielo 927 informa ausência de documento de apoio. A consulta retorna `null` nessa condição; isso não comprova que uma transmissão anterior não ocorreu e não autoriza reenvio automático. Erros de transporte, autorização ou respostas desconhecidas continuam como falhas. Os resultados finais documentados são “A favor do Estabelecimento” e “A favor do Emissor”; mensagens desconhecidas não devem ser interpretadas como encerramento. [Ciclo de vida oficial](https://docs.cielo.com.br/pix-can-cbk/reference/pesquisa-de-ciclo-de-vida).

Testes locais do runner, sem acessar jobs reais:

```powershell
node --test scripts/run-chargeback-sync.test.mjs
```

## 7. Acompanhamento no painel

Abrir `/painel/compras/contestacoes` com permissão de consulta de compras e usar **Atualizar consulta**. A página mostra se a automação está desligada ou, quando habilitada, a saúde da última execução **agendada** de `chargebacks`, seu horário e a última execução bem-sucedida. Uma execução com mais de 15 minutos é marcada como atrasada; ausência de histórico, falha ou indisponibilidade da consulta são estados distintos. A página não liga a integração nem executa o worker.

Sucesso técnico do job não significa ausência de exceções por caso nem vitória na disputa. Conferir prazo, pendência, última sincronização, retorno Cielo, estado do envio e dossiê de cada caso. Alertas vão para `dev@cluberincao.com.br`; teste real de entrega confirmado no Gmail em 09/11. A saúde exibida depende da atualização da consulta; não é um alerta externo de indisponibilidade do servidor.

## 8. Ativação e operação do envio automático

Em 19/11/2026, após o período de operação com análise humana, o responsável autorizou o envio automático para todos os motivos, incluindo fraude. A autorização anterior de análise humana obrigatória está substituída. Os critérios de consistência e segurança permanecem; casos já tratados não são reabertos.

Implantação: testar, revisar e publicar; preservar cópia protegida do ambiente, ponteiro da release e XML da tarefa. Desabilitar temporariamente `RincaoChargebackSync-prod` e persistir `CIELO_CHARGEBACK_ENABLED=false` antes do deploy. Validar a nova release, então habilitar flag, reiniciar o runtime, habilitar a tarefa existente e acompanhar duas execuções. Não modificar credenciais, recriar tarefas ou fabricar casos de produção.

A equipe acompanha `/painel/compras/contestacoes`: **Defesa apresentada** é recibo técnico, não vitória. **Tratada na Cielo** indica tratamento externo; **Finalizada na Cielo** deve ser interpretada junto do retorno favorável/desfavorável. **Pendência no processamento**, **Envio bloqueado** e **Envio a confirmar** exigem atenção ao motivo e ao prazo. Não apresentar outra defesa manualmente se o envio estiver em curso ou incerto sem confirmar a situação na Cielo.

Rollback: desabilitar a tarefa, persistir `CIELO_CHARGEBACK_ENABLED=false` e reiniciar o runtime antes de restaurar uma release. Preservar tabelas, PDFs, recibos e estados incertos; não redefinir `submitting`/`uncertain` para a fila. A confirmação de recepção externa por webhook continua separada da saúde da consulta periódica.
