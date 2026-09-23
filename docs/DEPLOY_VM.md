# Deploy do novo site do Rincao na VM Windows

Este documento descreve o deploy do `new_rincao_site` nos dois ambientes IIS da VM Rincao.

## Mapeamento

| Branch | Ambiente | Dominio | Porta Node |
| --- | --- | --- | --- |
| `develop` | homologacao | `https://cluberincao.questione.ai` | `8062` |
| `main` | producao | `https://cluberincao.com.br` | `8061` |

O IIS continua como reverse proxy. O Node executa somente o artefato `.next/standalone`.

## Separacao obrigatoria

- codigo e scripts: Git;
- releases imutaveis: `C:\Deploy\Rincao\<ambiente>\releases`;
- release ativa: caminho registrado em `C:\Deploy\Rincao\<ambiente>\current.txt`;
- configuracao e dados persistentes: `C:\SitesData\Rincao\<ambiente>`;
- backups da migracao: `C:\Sites\AzureIIS\_deploy_backups\new_rincao_site`.

Nunca versionar `.env.local`, `.data`, `public/uploads`, logs ou builds. Producao e homologacao devem usar diretorios persistentes diferentes.

## Primeira migracao

Executar primeiro em homologacao:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\migrate-vm-storage.ps1 -Environment hml
.\scripts\deploy-vm.ps1 -Environment hml
.\scripts\install-vm-runtime.ps1 -Environment hml
```

Validar o dominio de homologacao e os uploads antes de repetir em producao:

```powershell
.\scripts\migrate-vm-storage.ps1 -Environment prod
.\scripts\deploy-vm.ps1 -Environment prod
.\scripts\install-vm-runtime.ps1 -Environment prod
```

`migrate-vm-storage.ps1` somente copia dados. Ele preserva um backup com timestamp, usa a `.data` do runtime atual como fonte primaria e incorpora arquivos ausentes das outras copias de uploads.

## CI/CD

O workflow `.github/workflows/deploy-vm.yml` usa um runner hospedado do GitHub para acessar a VM por SSH. O build continua sendo executado no Windows da VM, evitando artefatos ou dependencias nativas de outra plataforma.

O repositorio precisa conter o secret `RINCAO_VM_SSH_KEY`, com a chave privada autorizada para o usuario `Administrator` da VM. A chave publica do host SSH esta fixada no workflow para impedir conexoes com um servidor diferente.

O fluxo e:

1. conexao SSH autenticada com a VM;
2. fetch e checkout do commit exato em `C:\Deploy\Rincao\<ambiente>\repo`;
3. `npm ci --include=dev` com Node 20.19.5;
4. build standalone;
5. criacao de uma nova release;
6. troca do processo Node;
7. health check local e publico;
8. rollback para a release anterior em caso de falha.

As branches sao independentes: push em `develop` publica homologacao e push em `main` publica producao. A suite de testes ainda possui falhas legadas e, ate ser saneada, o gate automatico de deploy e o build completo seguido dos health checks.

## Rollback manual

Liste as releases:

```powershell
Get-ChildItem C:\Deploy\Rincao\prod\releases
Get-ChildItem C:\Deploy\Rincao\hml\releases
```

Para ativar uma release anterior:

```powershell
Set-Content C:\Deploy\Rincao\prod\current.txt "C:\Deploy\Rincao\prod\releases\COMMIT"
Stop-ScheduledTask -TaskName NovoSiteRincaoNext8061
Start-ScheduledTask -TaskName NovoSiteRincaoNext8061
```

Depois do rollback, valide a porta local e o dominio publico.

## Backup

O backup de banco existente na VM nao cobre os arquivos do site. Deve existir uma copia diaria, preferencialmente fora da VM, destes caminhos:

- `C:\SitesData\Rincao\prod`;
- `C:\SitesData\Rincao\hml`.

O processo de restauracao deve ser testado periodicamente.
