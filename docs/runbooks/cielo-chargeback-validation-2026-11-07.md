# Validação da API de Chargeback — 07/11/2026

## Escopo e estado

Correção do HTTP 204, homologação com dados fictícios no sandbox e consulta histórica em produção. A integração do aplicativo permanece desativada. Nenhuma defesa, aceite ou reembolso real foi enviado. Nenhuma configuração persistente do runtime, banco real ou tarefa agendada foi alterada.

O certificado assinado corresponde à chave privada mantida exclusivamente na VM. Autenticação mTLS/OAuth funcionou nos dois ambientes. As sondas usam o cliente real transpilado do checkout, com lista explícita de hosts, métodos e rotas permitidos: em produção, somente OAuth e consultas PENDING/DONE; em homologação, também consulta de documento/ciclo de vida e recusa fictícia. Segredos não fazem parte deste relatório ou do Git. As duas cópias temporárias locais de credenciais foram removidas ao final; não foram gravadas na configuração do runtime.

## Correções e evidências

- HTTP 204 vira lista vazia final somente em PENDING/DONE. Continua sendo resposta inválida para autenticação, documento e apresentação; nunca confirma envio.
- Consulta por caso usa `idCase`. A forma minúscula era ignorada pelo sandbox; resultados fora do filtro continuam rejeitados. Uma verificação adicional em produção selecionou um caso tratado e consultou seu ID: retornou exatamente um caso correspondente, com quatro chamadas HTTP 200 (duas autenticações e duas consultas), sem escrita.
- Apresentação usa multipart com campos textuais e PDF binário `<idCase>.pdf`. JSON foi rejeitado com HTTP 400; o cliente corrigido recebeu HTTP 200 e código 102.
- Erros de negócio são reconhecidos também em `errorMessage`, `details` e `errorMessage.details`. O 901 observado dentro de HTTP 400 é transitório; se ocorrer na apresentação, o resultado permanece incerto, sem retransmissão automática. Código 927 em consulta de documento significa ausência, sem autorizar reenvio.
- Webhook de notificação aceita envelope `content`; lifecycle aceita `idcase`. Validação integral do lote precede persistência, com rejeição de aliases conflitantes e EC indevido.

O PDF fictício foi gerado pelo renderer do aplicativo: duas páginas, 6.816 bytes, SHA-256 `4a13f48237cc3cfb3f4f2da74727656ca0d4dd2e6762e65ed3771ac36c7dcb05`. Somente dados sintéticos foram usados no envio. A consulta de documento retornou código 104 e um JPG fixo de 3.723 bytes, diferente do PDF enviado. A consulta de ciclo de vida retornou “Em análise com Cielo”. Os cenários de erro de consulta/apresentação/documento retornaram 901 e foram classificados pelo cliente corrigido.

### Limites do sandbox

As respostas são simuladas e algumas divergem dos exemplos do manual: o cenário de erro de lifecycle retornou sucesso; os ECs dos cenários de consulta apresentaram comportamento invertido. O filtro por caso devolve o ID solicitado, mas conserva metadados de paginação de exemplo (`totalElements=123`). Não usar esses dados para inferir contestações reais ou enfraquecer validações do cliente.

Não há webhook no sandbox e a consulta de documento não recupera o PDF recém-enviado. Assim, chamadas externas foram homologadas individualmente, e o fluxo completo de persistência, dossiê, submissão e recuperação foi verificado em PostgreSQL descartável com fronteiras Cielo/coleta simuladas. Não foi comprovado um circuito externo completo com estado persistente na Cielo.

Referências: manual v3.2.1 e collection recebidos do suporte; [instruções oficiais do sandbox](https://docs.cielo.com.br/pix-can-cbk/reference/instrucoes-sandbox) e [referência de recusa](https://docs.cielo.com.br/pix-can-cbk/reference/recusa-de-contestacao). Em caso de divergência, este relatório distingue o contrato efetivamente observado do schema publicado.

## Histórico de produção

Período solicitado à API: **01/01/2024 a 07/11/2026**, em seis janelas de até 179 dias com fronteiras compartilhadas. Consultas separadas por EC e status, todas as páginas percorridas e deduplicação por EC/caso. A varredura terminou sem falhas: 49 requisições (autenticação e páginas), 28 respostas HTTP 200 e 21 HTTP 204. Não foram gravados dados individuais de compradores no relatório.

| Mês da notificação | EC 2899426197 — DONE | EC matriz 1075640757 — DONE |
| --- | ---: | ---: |
| Janeiro/2026 | 41 | 0 |
| Fevereiro/2026 | 50 | 0 |
| Março/2026 | 145 | 0 |
| Abril/2026 | 59 | 0 |
| Maio/2026 | 45 | 0 |
| Junho/2026 | 10 | 0 |
| Julho/2026 | 12 | 0 |
| Agosto/2026 | 37 | 0 |
| Setembro/2026 | 33 | 0 |
| Outubro/2026 | 15 | 1 |
| Novembro/2026, até dia 7 | 1 | 0 |
| **Total por EC** | **448** | **1** |

**PENDING: zero para ambos os ECs no intervalo consultado.** A API não retornou casos de 2024 ou 2025. Isso descreve o retorno disponível nesses filtros; retenção e completude de anos antigos não foram confirmadas pela Cielo. `DONE` significa tratado, sem comprovar vitória, defesa apresentada ou resultado financeiro. Os totais dos dois ECs são separados, sem presumir que representam disputas distintas entre matriz e filial.

## Verificação local

- 152 testes de cliente, dossiê, repositório, submissão, sincronização, webhook, rotas e painel passaram.
- Oito testes integrados passaram em PostgreSQL 17 descartável: migração reexecutável, integridade de versões, lock concorrente, cursor, prioridade temporal, reuso de PDF e recuperação após falha de recibo. Banco e processo de teste foram encerrados/removidos.
- Seis testes do runner passaram.
- ESLint dos quatro arquivos de código/teste corrigidos passou.
- Build de produção, incluindo TypeScript, passou. Houve aviso do Turbopack sobre rastreamento amplo envolvendo `next.config.ts`/`rincao-content-store.ts`, fora das alterações de chargeback.
- Revisão independente dos arquivos corrigidos e seus callers não encontrou problemas concretos; repetiu 101 testes focados com sucesso.

As falhas globais preexistentes registradas no plano anterior não foram reexecutadas nem corrigidas nesta etapa.

## Antes de ativar produção

1. Implantar a revisão aprovada, validar backup/restauração e aplicar a migração no banco correto. Configurar credenciais/certificado no runtime com a integração desativada durante a preparação.
2. Confirmar os ECs operacionais, política de elegibilidade e requisitos de defesa por motivo/bandeira; conferir a amostra de dossiê com a operação.
3. Cadastrar callbacks com a Cielo, validar autenticação e recebimento. O suporte precisa esclarecer/fornecer cenário com persistência para fechar a validação externa de documento e recuperação; os testes locais não substituem essa evidência.
4. Confirmar entrega de alertas e configurar/verificar a tarefa periódica no ambiente autorizado.
5. Ativar envios reais somente em etapa explicitamente autorizada. Não executar o job de produção durante a preparação: ele pode apresentar defesas elegíveis.

Procedimentos e configurações: [runbook operacional](cielo-chargeback-automation.md).
