# App de contagem — análise de aderência ao material recebido

Data: 13/11/2026. Código analisado: `6a7f588`, branch local `codex/painel-gestao`. Escopo desta rodada: análise e planejamento; nenhuma alteração funcional, migração, envio externo ou implantação.

## 1. Conclusão e correção de escopo

O app existente é uma primeira implementação integrada ao painel, produzida antes de receber a especificação própria do aplicativo. Possui persistência, autenticação, concorrência, contagens e assinaturas reais. **Não é a implementação completa do protótipo agora recebido.** A comunicação anterior de conclusão do app foi ampla demais: o próprio plano E7 previa apresentar as telas, reconhecendo que o HTML do painel não especificava integralmente este aplicativo.

Recomendação: conservar a base e executar um plano complementar do app, com reflexos delimitados no painel, na validação de entrada e na integração de mensagens. Não reconstruir o painel nem criar um segundo banco de contagem.

O painel teve implantação técnica em homologação registrada no runbook; isso não equivale a aceite operacional ou conclusão dos requisitos novos. Permanecem as pendências anteriores: despesas da Estância com Isaque, fonte completa do consolidado escolar da Estância, identidades dos donos e homologação pela equipe. A análise atual não revalidou a VM nem promoveu `main`.

## 2. Fontes e precedência

- Material original preservado em `app-contagem-referencias/app-contagem-rincao-dev.md`; SHA-256 `37f1d054223807e3b4ab2f827d3810094b1d73e2aa98d3762fa6e78da1de4f8a`.
- Protótipo preservado em `app-contagem-referencias/contagem-rincao-prototipo.html`; SHA-256 `63f0ee218b9546a6a7751cefb140cfe64137c5995ec0b03b53d48a6719818b21`.
- Fontes originais: `/Users/juansouza/Downloads/app-contagem-rincao-dev.md` e `/Users/juansouza/Downloads/Contagem Rincão - Aplicativo.html` (nome Unicode decomposto no disco).
- Decisões explícitas do usuário prevalecem: internet obrigatória permitida; idades atuais do sistema; voucher utilizável em qualquer dia aberto dentro da validade; finalização financeira do passeio exige recebimento integral.
- O bloco “Prompt para o Codex” é especificação anexada, não autorização nesta rodada para executar deploy, enviar mensagens, alterar branch ou iniciar implementação. O pedido atual é comparar e planejar.
- O HTML define aparência e interação. Login de demonstração, data fixa, incrementos aleatórios, assinatura gerada dos personagens e avisos simulados de envio não são regras para o produto real.

## 3. Matriz completa

Legenda: **Existe** = evidência no código; **Parcial** = requer adequação; **Falta** = não implementado no app; **Diverge** = comportamento diferente.

| Requisito recebido | Situação atual e evidência | Adequação |
|---|---|---|
| Web mobile/PWA no sistema | Parcial: `/contagem` responsivo; sem manifest/instalação específicos | Manifest, ícones, abertura independente e validação em Android/iPhone; continuar online |
| Mesmo login do painel | Existe: `contagem/layout.tsx`, `painel-session.ts`, `api/painel/session` | Reutilizar sessão, credenciais e proteção; aproximar apresentação do protótipo |
| Nome/avatar e sair com aviso | Parcial: mostra nome e volta ao painel; não tem menu de saída do app | Avisar também quando há contagem atribuída já salva, não só campos locais sujos |
| Hoje e faixa de dias | Parcial: hoje/data civil e campo de data; sem faixa visual | Faixa de dias, data pelo servidor em São Paulo, histórico e estados vazios |
| Futuro apenas previsto | Diverge: gerente pode contar fora de hoje com motivo | No app, futuro somente leitura para todos; separar eventual correção administrativa de passado |
| Resumo do parque, previsão e status | Parcial: totais por veículo/passeio concluído | Total do dia, participantes/equipe, contagem de veículos e previsão informativa, nunca limite |
| Cinza/amarelo/verde | Parcial: estados reais e nome; apresentação em lista sem cartões correspondentes | Cartões com cor, texto e ícone; número por tipo/passeio, não ID global como identificação principal |
| Ver o andamento dos demais | Parcial: polling 5 s; total só aparece depois de concluído; salvamento manual | Publicar subtotal salvo como provisório, autosave serializado e indicador de atualização |
| Agora na equipe | Falta: existe auditoria, não feed | Expor somente eventos operacionais relevantes de início, assunção, conclusão e veículo extra |
| Adicionar ônibus/van extra | Parcial: tipo, previsão, ator e `added_on_day` existem | Transportador por veículo, etiqueta extra, previstos + extras, adicionar ou adicionar e contar |
| Professor/coordenador conforme grupo | Parcial: oito chaves existem; rótulo único | Usar tipo real do grupo; não inferir escola pelo nome |
| Botões −/+ grandes | Diverge: campos numéricos em formulário | Contadores de uma mão, − desabilitado em zero; agrupar por modalidades como HTML |
| PCD com escolha inline e etiquetas por pessoa | Diverge: descrição livre agregada e quantidade separada, limite de 40 linhas | Sete tipos fixos, + só soma ao escolher; cancelar não soma; remover etiqueta decrementa; preservar dados históricos |
| Filho de professor, acompanhante PCD e isento | Existe no contrato e cálculo | Manter categorias exclusivas e soma sem dupla contagem |
| Faixas etárias | Documento diz adulto 12+/criança 4–11; sistema implementado usa adulto 10+/criança 4–9/isento 0–3 | Manter sistema atual por instrução explícita do usuário; não copiar as idades do HTML |
| Observações sem cortesias | Existe: observações até 2.000 caracteres e nenhuma categoria cortesia | Levar à filipeta/cozinha; não truncar silenciosamente na exportação |
| Ao menos uma pessoa antes de avançar | Falta: valida quantidades, mas soma zero pode concluir com responsável/assinatura válidos | Rejeitar total zero na UI e servidor; não reescrever registros antigos |
| Etapas contagem → responsável → resumo | Parcial: campos e assinatura existem, em uma página com revisão curta | Etapas reais, preservando rascunho e corrigindo sem perder os dados |
| Responsável/WhatsApp/assinatura | Existe: normalização, confirmação, PNG privado e persistência atômica | Mostrar assinatura na prévia e filipeta; nova assinatura após correção dos dados assinados |
| Filipeta completa antes/depois | Parcial: revisão mostra total/contato; histórico liga somente assinatura | Modalidades, PCD, observações, início/fim, contador, responsável e assinatura; artefato por revisão |
| Finalizar e enviar/Reenviar | Falta no app: completar não chama WhatsApp | Entrega idempotente por revisão; falha de envio não desfaz contagem concluída |
| Brevia/Meta/template | Há cliente Meta no repositório da API de ingressos e envio de vouchers; não há fluxo de filipeta | Confirmar ligação com integração Brevia e template; não reutilizar endpoint de voucher como se aceitasse filipeta |
| Fallback WhatsApp do celular | Falta | Abrir texto, compartilhar/baixar imagem e registrar tentativa/declaração manual sem afirmar entrega automática |
| Assumir contagem de outra pessoa | Diverge: somente gerente + motivo; monitor pode assumir apenas rascunho liberado | Decisão D1; manter exclusividade, versão e histórico |
| Ver filipeta/recontar concluído | Parcial: recontagem só gerente; assinatura só autor/gerente | D1; alinhar acesso da equipe às filipetas; manter bloqueio financeiro e histórico imutável |
| Day use QR no app | Falta: não há scanner/rota de entrada do app | Reutilizar regras canônicas; D3 resolve vínculo atual obrigatório ao caixa |
| Já usado: quando e por quem | Parcial no sistema: retorno informa data/hora/local; não retorna autor | Acrescentar autor comprovado pela auditoria; legado sem evidência diz “não registrado” |
| Voucher de outra data | Documento não trata validade flexível já aprovada | Outra data não basta para negar: conferir intervalo, dia aberto, pagamento, cancelamento e uso prévio |
| Finalizar contagem do dia | Falta no app; existe fechamento financeiro no painel | D2: operação de contagem separada de fechar caixas/financeiro |
| Relatório geral | Falta no app; relatórios financeiros existentes têm outro objetivo | Total conhecido no parque/passeios/day use; modalidades, veículos, responsáveis, assinaturas, pendentes |
| Relatório cozinha | Falta | Refeições dos passeios = participantes + equipe; PCD como subconjunto; restrições/observações; pendentes explícitos |
| Compartilhar relatórios | Falta no app | Compartilhamento nativo por ação do usuário; copiar texto/baixar imagem como alternativa |
| Sincronização com painel | Existe: banco único e polling 5 s, só após salvar | Estender DTO, autosave e resumo; manter compromisso anterior de até 10 s em rede normal, sem prometer instantaneidade |
| Testes com dois celulares | Existem testes de concorrência/revisão do backend | Homologar fluxo completo novo com duas sessões e Android/iPhone reais |

## 4. Base reaproveitável e impactos

### Banco

Já existem `passeio_operacao`, `passeio_veiculos`, `passeio_contagens`, `contagem_assinaturas`, `contagem_catalogos`, `contagem_comandos`, `transportadores` e auditoria `edicoes_log`. Veículos já são compartilhados por programação, contagem e recebimentos. Responsável está na revisão da contagem; assinatura está vinculada por `revision_id`. Não criar tabelas duplicadas de responsável ou de “ônibus extras”.

Faltam transporte específico do veículo, identificação estável por tipo dentro do passeio, registro de finalização/revisão da contagem diária e entrega da filipeta. Detalhes PCD já têm estrutura categoria/descrição/quantidade e podem representar as opções fixas sem criar prontuário ou cadastro de pessoas. Para alterações de contrato, versionar catálogo/leitura e preservar texto livre histórico; `trip-settlement-source.ts` chama o normalizador e não pode quebrar ao ler contagens antigas.

Migrações aplicadas são imutáveis. Acrescentar novas migrações com leitura retrocompatível; nenhum reset, backfill inventando deficientes, transportadores ou horários. Horário inicial deve vir do registro/auditoria real, com distinção de troca de contador. O ID técnico do veículo continua inalterado.

### Frontend e sincronização

Reaproveitar `counting-signature.tsx`, controles de conexão/comando e autenticação. Adequar `counting-day-page.tsx`, `counting-vehicle-page.tsx` e `contagem/layout.tsx` ao protótipo. O comando atual já concilia resposta perdida antes de repetir e bloqueia escrita concorrente; autosave precisa usar essa mesma serialização, sem disparar um comando simultâneo para cada toque.

O painel recebe `getCountingDay()` em `painel-counting-summary.tsx`. Separar `draftSubtotal` de presença concluída; nunca incorporar contagem parcial como presença confirmada ou receita. O feed pode projetar auditoria existente sem divulgar CPF, telefone, deficiência ou assinatura.

### Day use e financeiro

`validateVoucherByNumber()` exige `periodId`; `markVoucherUsed()` recebe `VoucherCashContext`. Não basta adicionar câmera nem passar caixa fictício. D3 confirmou a separação de contexto de entrada e contexto de venda. Todos os chamadores da bilheteria e as reversões precisam preservar suas regras atuais.

O QR também não é simplesmente o número textual do voucher: `services/TicketFulfillmentService.js` da API de ingressos gera o par `${purchaseId}-${voucherId}`. O scanner deverá reconhecer o formato, resolver e conferir o vínculo no banco, além de tratar formatos legados comprovados. Não navegar endereços arbitrários lidos pela câmera. O voucher já armazena `validado_por_nome`/`validado_por_cpf`; expor apenas nome autorizado e horário na resposta de duplicidade, sem inventar autor de registros legados.

Reutilizar classificações de `operational-day-summary-sql.ts`: ingressos escolares já contados nos veículos e serviços adicionais não entram outra vez no day use. Vendidos para a data e entradas efetivas hoje são medidas diferentes com vouchers flexíveis. O campo “ainda previstos” é estimativa, nunca estoque nem autorização de entrada.

O fechamento financeiro atual fecha caixas, cria snapshots e impõe bloqueios. Não conectá-lo diretamente ao botão do monitor. Relatórios de contagem não concedem acesso a valores recebidos, despesas ou dados dos donos.

### WhatsApp e arquivos

`ticket-service-whatsapp.ts` é específico de ingressos/compra. A API irmã contém `services/MetaWhatsAppClient.js`, com texto, imagem e template, e mecanismos de status. Isso prova uma base de integração disponível no código, não a aprovação de um template de filipeta nem que a conta citada como Brevia seja essa mesma configuração.

O link `wa.me` prepara texto; não anexa a imagem automaticamente. Para arquivo, usar compartilhamento nativo quando suportado ou download. Abrir o aplicativo ou retornar do compartilhamento não comprova entrega. Exibir estados distintos: contagem concluída, envio pendente, aceito pelo provedor, enviado/entregue quando confirmado, falhou, resultado incerto, compartilhamento manual iniciado/declarado. Não repetir automaticamente resultado incerto.

Filipeta com assinatura/contato permanece privada. Para o provedor buscar mídia, preferir upload autenticado ou URL temporária restrita ao artefato; nunca publicar a rota de assinatura inteira. Cozinha não necessita telefone nem assinatura do responsável. Observações pedidas devem aparecer sem corte; não copiar nomes e exemplos médicos fictícios do protótipo para dados reais.

## 5. Decisões e dependências

As três perguntas abaixo foram respondidas pelo usuário nesta rodada. As recomendações principais foram confirmadas; detalhes de implementação continuam propostas do plano.

| ID | Origem da dúvida | Decisão confirmada | Trabalho dependente |
|---|---|---|---|
| D1 | Item 7 do documento permite assumir/recontar; código limita a gerente | Monitor com acesso à contagem pode assumir/recontar no dia, com confirmação e histórico. Passeio com recibo final continua bloqueado até revisão financeira autorizada | Permissões de comandos, acesso à filipeta e assinatura, testes de dois operadores |
| D2 | Item 9 diz finalizar contagem, mas não explica relação com fechamento financeiro | Fechar só conferência da portaria e emitir versão do relatório, sem fechar caixas. Confirmar pendentes; revisão posterior explícita preserva versão anterior | Estado diário, relatório congelado versus atualizado, reabertura |
| D3 | Item 8 pede QR para monitor; backend atual exige caixa aberto | Acesso específico de entrada sem abrir caixa e sem conceder vendas/estornos | Contexto transacional da validação, auditoria, reversões e permissões |

Outras recomendações já delimitadas no plano:

- Não perguntar novamente idades, necessidade de internet ou flexibilidade dos vouchers: o usuário já decidiu.
- Bloquear futuro no app inclusive para gerente, como pede o material. Exceções de correção no passado permanecem administrativas e auditadas.
- Manter polling existente e autosave confirmado, com aceite ≤10 s em rede normal. “Na hora” do protótipo não estabelece latência medida; SSE só se o teste operacional reprovar esse critério.
- Refeições no relatório da cozinha seguem a regra fornecida (todas as pessoas dos passeios concluídos). Day use não é somado a refeições pelo HTML; não inventar alimentação contratada nem usar preços como proxy.
- O HTML usa `p.rest` para restrição do passeio. Recomenda-se um campo específico de restrições alimentares compartilhável na programação, somado às observações dos veículos. Não enviar indiscriminadamente observações administrativas do passeio à cozinha.
- Dependência externa do envio automático: confirmar canal Brevia/Meta existente, nome/idioma/campos do template aprovado e destinatários de teste. Descobrir configuração disponível antes de pedir credenciais; não enviar segredos no chat. Sem isso, homologar o fallback honesto previsto no documento.
- Ao finalizar contagem com zero pessoas, bloquear novas conclusões; histórico antigo não é apagado nem reinterpretado.

O protótipo tem uma ambiguidade própria: `finalizar()` altera apenas uma flag; o clique em veículo não verifica essa flag, e o QR ainda pode mudar. Recomenda-se versão imutável do relatório com indicação de atualização posterior e revisão explícita, sem fingir que o HTML define uma política completa de bloqueio/reabertura. D2 confirmou a separação do financeiro; o detalhamento de revisões é proposta deste plano.

## 6. Verificações desta análise

- Leitura integral do Markdown e inspeção do HTML/CSS/JavaScript do protótipo, com atenção às fórmulas, eventos e simulações.
- Navegação real no HTML a 390 × 844: login demonstrativo, ônibus livre, PCD/TEA inline, observação, responsável, assinatura desenhada, prévia, finalização simulada, pendentes, relatórios geral/cozinha, compartilhamento, veículo extra, QR simulado, data futura e menu da conta. Nenhuma mensagem real enviada; contexto do navegador encerrado.
- Inspeção dos componentes, contratos, serviços, SQL, autenticação, resumo, fechamento, validação de vouchers e cliente Meta já existente.
- `npx vitest run src/lib/trip-counting-contract.test.ts src/lib/trip-counting-client.test.ts src/lib/trip-counting-route.test.ts src/lib/trip-counting-signature.test.ts`: **24 testes, 4 arquivos, todos passaram**.
- Não reexecutada suíte PostgreSQL completa nesta rodada; concorrência foi avaliada pelo código e testes existentes, não por novos ensaios com dois aparelhos.
- Não testados câmera física, instalação PWA, envio real de filipeta, aprovação do template nem estado atual da VM.

Referências técnicas consultadas: [manifest Next.js 16.4.5](https://github.com/vercel/next.js/blob/v16.4.5/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.mdx), também disponível na documentação instalada; [WhatsApp click to chat](https://faq.whatsapp.com/5913398998672934); [compartilhamento nativo Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API). Context7 consultado para manifest na versão instalada.

## 7. Próximo passo

Plano complementar: `../plans/2026-11-13-app-contagem-adequacao-implementacao.md`. D1–D3 confirmadas. Revisar o plano antes de implementar. Atualizar a comunicação ao PO: painel em homologação; app possui base implementada e adequação ao protótipo ainda pendente.
