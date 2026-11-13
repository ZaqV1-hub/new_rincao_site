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

Pendente nesta edição: registrar commit, execução CI/CD, saúde do artefato Windows e verificações HTTP do HML. Não interpretar este documento como confirmação de publicação antes desse registro.

Rollback de código pelo release anterior do deploy; migrações aditivas permanecem. Não apagar revisões, assinaturas ou journals. Não reativar escritores legados nem mudar o modo sync-only da API de ingressos.

## Homologação operacional ainda necessária

- Câmera física, instalação na tela inicial e compartilhamento nativo em Android Chrome e iOS Safari.
- Aceite da operação/PO com contas reais autorizadas. Nenhuma mensagem real foi enviada nos testes.
- Confirmação do template Brevia para futura automação.
- Despesas/resultado da Estância e fonte do consolidado escolar permanecem nas pendências anteriores com Isaque; não foram simulados como completos.
