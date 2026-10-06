# Recuperação de capacidade do deploy HML

O build Lumi exige 25 GiB livres no disco e 3 GiB de RAM livre. Uma falha de disco impede começar o build, mesmo quando há RAM suficiente. Os limites permanecem versionados no repositório Lumi.

A retenção deste site opera somente sobre releases standalone de HML. Preserva a ativa, a anterior e os quatro diretórios mais recentes. Cada candidato antigo precisa ter um SHA completo existente no Git, `server.js` standalone e BUILD_ID; todos os arquivos de fonte e assets presentes devem coincidir com blobs desse commit. A única transformação de checkout aceita é CRLF para LF em texto UTF-8 válido, e apenas se o hash resultante for exatamente o blob Git. O fingerprint do plano guarda os bytes efetivamente presentes para detectar mudança entre revisão e aplicação. Arquivos ou uploads não rastreados, fontes modificadas, ambientes, `.data` e aliases legados preservam a release inteira. Assets públicos copiados do Git são reconstruíveis; um novo arquivo de upload, mesmo em `public/uploads`, impede remover aquela release.

Os dados e o arquivo de ambiente ficam no armazenamento compartilhado separado, conforme `start-vm-runtime.ps1`. A retenção não opera sobre esse armazenamento, backups ou produção. O Git permite reconstruir o artefato retirado, mas apenas as releases mantidas ficam prontas para rollback imediato.

## Antes de aplicar

1. Confirmar que não há deploy HML concorrente e resolver o apontador `current.txt`.
2. Confirmar a release anterior por `previous.txt`. No primeiro uso em instalações antigas, proteger explicitamente o SHA do último deploy bem-sucedido, consultando o workflow correspondente.
3. Executar os testes do módulo na VM e validar o parser PowerShell do script de deploy.
4. Gerar e revisar o dry-run. Nenhuma release é removida nessa etapa.

Os parâmetros abaixo devem vir da configuração de deploy já conferida:

```powershell
$plan = Join-Path $hmlRoot "retention\plan-$(Get-Date -Format yyyyMMddHHmmss).json"
& $nodeExe scripts/hml-release-retention.mjs `
  --deployment-root $hmlRoot --repo-root $hmlRepo `
  --keep-releases 4 --report $plan
# Apenas no bootstrap sem previous.txt:
# adicionar --protected-releases $previousVerifiedSha na geração do plano.

$planHash = (Get-FileHash -LiteralPath $plan -Algorithm SHA256).Hash.ToLowerInvariant()
$receipt = [IO.Path]::ChangeExtension($plan, "receipt.json")
& $nodeExe scripts/hml-release-retention.mjs `
  --apply-plan $plan --plan-sha256 $planHash --receipt $receipt
```

O apply confere o hash, refaz o plano e valida os apontadores antes de cada remoção. Mudança de fonte ou apontador interrompe a execução. Um lock exclusivo impede duas retenções e coordena as alterações de apontador do deploy HML. O recibo é atualizado após cada remoção, inclusive quando uma falha interrompe uma aplicação parcial; não reutilizar o plano parcial.

## Depois de aplicar

Conferir o recibo, os arquivos da ativa/anterior e a saúde do site HML. Repetir o gate original de capacidade da Lumi antes de disparar um novo deploy. A execução automática de retenção ocorre antes do build quando há `previous.txt`, e novamente após o health de um deploy HML bem-sucedido. O apontador anterior só é atualizado depois desse health.

Se a verificação de origem recusar releases, preservar os diretórios e registrar a causa. Não ampliar a lista de arquivos descartáveis nem reduzir o gate para obter sucesso.

## Quando o recurso insuficiente é RAM

Uma limpeza de disco não resolve RAM livre abaixo de 3 GiB. Conferir somente nomes/PIDs e consumo dos processos, sem argumentos, ambiente ou secrets. Se houver build conhecido em execução, aguardar seu encerramento e repetir o gate. Se o consumo basal persistir, dimensionar RAM adicional ou isolar o runner; mudança de infraestrutura com custo exige a decisão do owner. Não encerrar serviços arbitrariamente para passar o gate.

## Efeito operacional observável

Sem retenção, cada deploy adiciona uma cópia de runtime e dependências; o disco pode bloquear a próxima atualização embora a aplicação atual esteja saudável. Com retenção, artefatos antigos comprovados são retirados e o espaço livre é registrado. O owner comprova o resultado pelo recibo, pelo gate de capacidade aprovado e pelo SHA realmente implantado após o novo deploy.
