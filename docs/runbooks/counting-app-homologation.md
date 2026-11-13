# Aplicativo de contagem — homologação

## Escopo

Complemento do painel conforme os arquivos próprios do aplicativo recebidos em 13/11/2026. Destino autorizado: `develop`/homologação. Nenhuma promoção para `main`, cobrança ou mensagem real a terceiros.

A contagem exige internet. Adicionar à tela inicial usa o manifesto `/contagem/manifest.webmanifest`; não há cache offline de contatos, observações ou assinaturas. Brevia automática permanece pendente do template, sem fila ou webhook ocioso nesta entrega.

## Fluxos implementados

- Programação e veículos com ordinal, transportador herdado/específico, extras, previsão e atividade dos monitores.
- Contagem por modalidade com botões, PCD por tipo, autosave serial, responsável, contato confirmado, assinatura e prévia.
- Monitor pode assumir/recontar com motivo e histórico; passeio financeiro finalizado continua bloqueado.
- Filipeta por revisão, assinatura privada de qualquer monitor autorizado do mesmo parque, imagens paginadas, copiar texto, download e compartilhamento manual.
- Portaria lê QR compra–voucher ou código manual; pagamento, parque, validade, retenções, dia aberto e duplicidade são conferidos, sem abrir caixa.
- Encerrar contagem gera revisão imutável geral/cozinha. Veículos pendentes são explícitos. Reabrir contagem não reabre financeiro. Entradas posteriores podem exigir nova emissão.
- Cozinha usa participantes/equipe dos passeios e restrições; PCD já está incluído. Day use não vira refeição automaticamente.

## Acesso

A conta precisa de `vis_contagem`; leitura de QR é recurso adicional `vis_portaria`. Nenhum desses recursos concede bilheteria, estorno ou caixa. Gerentes têm os recursos padrão; os demais papéis precisam de concessão explícita pelo administrador. A migração amplia `acl.idrecurso` de VARCHAR(10) para VARCHAR(40), preservando concessões. Não foram concedidos recursos a usuários reais nos ensaios.

## Verificação local

- 2.106 testes / 377 arquivos, PostgreSQL isolado e zero skips; 21 testes de scripts.
- Lint: zero erros, 12 avisos legados. Build, TypeScript e renderizador PNG do artefato standalone passaram; publicação registrada ao final.
- Chromium 390×844 e desktop1280×900: sem overflow; contagem, PCD, assinatura, correção, prévia, filipeta e PNG conferidos.
- Duas sessões: assumir preserva último rascunho, operador anterior recebe conflito sem perder sua edição; recontagem começa zerada e preserva revisão assinada anterior.
- Resposta perdida após commit: somente um POST, confirmação recuperada; sessionStorage sem contato/assinatura/observação, somente URL/chave.
- Portaria: testes PostgreSQL de concorrência, idempotência datada, pagamento de reserva, validade em outro dia aberto, dia financeiro fechado, retenções e vínculo compra–voucher. O fechamento financeiro concorrente não pode congelar snapshot anterior à entrada: teste serializável retorna 40001 e exige nova prévia.
- Câmera simulada: apenas um pedido concorrente e encerramento de stream atrasado após ocultação. Decoder jsQR conferido com QR real gerado pelo formato do emissor.
- Assinatura de colega retorna200; conta de monitor sem bilheteria recebe403 nas APIs financeiras.

## Backup e migrações

Backup restrito: `C:\Backups\RincaoPanel\20261113-pre-counting-app`.

- Dump:370.472.838 bytes; SHA256 `18c7cfe132a1ed678eb00ce51a57dd66eece5d6b768c55a370a204ec772274ba`.
- Cópia restaurada:`rincao_counting_restore_20261113`. Contagens/somas iguais:167.201 compras,562.057 vouchers,1.438 agendas,76.538 usuários; totais técnicos de compras30.461.659,14 e vouchers30.378.507,63.
-19 migrações verificadas, incluindo5 novas; aplicadas duas vezes na cópia, sem alterar contagens, valores, revisões, assinaturas ou permissões existentes.
- Manifestos `database-manifest.json`, `restore-verification.json`, `persistent-manifest.json` e `counting-migration-verification.json` mantidos na pasta restrita.
- Cópia persistente:99 arquivos,107.145.860 bytes, hashes SHA256 conferidos. A primeira soma-resumo PowerShell falhou após copiar; uma verificação independente confirmou todos os arquivos antes da publicação.

## Publicação

Base funcional `c8b423b943f7f700b01d9b0b8217d9ce6fe31e93` publicada em `develop` e ativada no HML. Workflow [43502696710](https://github.com/ZaqV1-hub/new_rincao_site/actions/runs/43502696710) concluído com sucesso, incluindo o build e renderizador Windows. SHA efetivo conferido em `current.txt`.

Foram aprovadas17 verificações HTTP: telas do app/portaria/relatórios, consultas autenticadas, recusas sem sessão, origem externa, JSON inválido, resumo do painel, manifesto e três ícones. O manifesto também respondeu200 pelo endereço público HTTPS. Nenhum dado operacional sintético foi inserido no HML; as sessões temporárias eram assinadas para o ensaio e expiram.

Evidências remotas: `counting-hml-migration-verification.json`, `counting-hml-smoke-verification.json`, `counting-cleanup-verification.json`. A cópia restaurada foi removida após as provas; os backups permanecem restritos. O registro cobre a base funcional; o commit posterior apenas esclarece o texto de rascunhos legados, padroniza no-store nas recusas da portaria e atualiza documentação.

Rollback de código pelo release anterior do deploy; migrações aditivas permanecem. Não apagar revisões, assinaturas ou journals. Não reativar escritores legados nem mudar o modo sync-only da API de ingressos.

## Homologação operacional ainda necessária

- Câmera física, instalação na tela inicial e compartilhamento nativo em Android Chrome e iOS Safari.
- Aceite da operação/PO com contas reais autorizadas. Nenhuma mensagem real foi enviada nos testes.
- Confirmação do template Brevia para futura automação.
- Despesas/resultado da Estância e fonte do consolidado escolar permanecem nas pendências anteriores com Isaque; não foram simulados como completos.

## Mensagem ao PO — pronta para encaminhar

Oi! O aplicativo de contagem foi adequado ao protótipo e à especificação enviada e já está disponível em homologação pela develop.

O app inclui programação e veículos extras, contagem por modalidade e PCD, salvamento automático, troca de monitor e recontagem com histórico, responsável e assinatura, filipeta para compartilhar manualmente e leitura de QR sem abrir caixa. O encerramento da contagem gera relatórios geral/cozinha e não fecha o financeiro. As idades seguem as regras atuais do sistema.

Links de homologação:
- Aplicativo: https://cluberincao.questione.ai/contagem
- Painel: https://cluberincao.questione.ai/painel
- Donos: https://cluberincao.questione.ai/donos

Precisamos do aceite dos fluxos pela equipe, principalmente câmera, assinatura, instalação na tela inicial e compartilhamento em Android/iPhone. Monitores precisam das permissões de contagem e portaria.

Pendências: envio automático pela Brevia até confirmar o template (alternativa manual disponível); despesas/resultado da Estância e confirmação da fonte do consolidado escolar com o Isaque; liberação das contas reais dos donos. Esta entrega fica em develop/homologação, sem promoção para produção.
