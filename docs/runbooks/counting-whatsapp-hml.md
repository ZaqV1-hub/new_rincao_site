# Filipeta pelo WhatsApp — Rincão em homologação

O template `rincao_filipeta_contagem_v1` foi submetido à Meta em 18/11/2026 como `UTILITY`, idioma `pt_BR`, cabeçalho `IMAGE`. ID do template: `2331364014325836`; WABA: `1797281724565189`; Phone Number ID: `1181013351750839`, número comercial Lumi QA terminado em 3861. O vínculo consultado pertence ao tenant `rincao` da Lumi V3 HML. Não usar o tenant Brevia nem alterar o envio de vouchers.

No momento da submissão o template estava `PENDING`. O envio consulta a Meta e exige aprovação, idioma, categoria, imagem e corpo compatíveis. A conta estava conectada, qualidade alta, com nome de exibição rejeitado; criação do template não comprova aptidão para entrega.

O operador abre uma filipeta concluída e assinada, escolhe **Enviar filipeta pelo WhatsApp** e confirma o destinatário registrado na contagem. A API não aceita telefone, imagem, template ou texto arbitrários do navegador. Cada página é enviada como uma imagem do template; as seis variáveis são responsável, grupo, data, veículo, total de pessoas e página. A imagem é carregada diretamente à Meta, sem tornar a assinatura pública por URL.

Configuração privada exclusiva de HML:

- `COUNTING_WHATSAPP_ENABLED=true`;
- `COUNTING_WHATSAPP_ACCESS_TOKEN`: credencial existente do canal autorizado;
- `COUNTING_WHATSAPP_ALLOWED_NUMBERS`: lista explícita de destinatários de teste, com DDI;
- `INGRESSO_TICKET_API_WHATSAPP_TESTING=true` e parque operacional `rincao`.

Sem ativação explícita, o fluxo manual permanece disponível. A promoção para produção exige configuração e canal próprios; este código restringe o envio ao canal de homologação acima.

Aplicar `docs/sql/2026-11-18-counting-whatsapp.sql` pelo migrador operacional no banco de homologação. O registro em `contagem_whatsapp_envios` é único por parque/revisão e preserva ator, destino, páginas e IDs aceitos. Repetir a requisição consulta a mesma tentativa. Falha, timeout ou processo interrompido não provocam reenvio automático. Antes de compartilhar manualmente após resultado parcial ou incerto, conferir o WhatsApp do destinatário.

`accepted` significa que a Meta aceitou as páginas; não significa entrega ou leitura. Este fluxo não modifica os webhooks existentes da Lumi, não cria filas de repetição nem confirma recebimento pelo aparelho. Novas contagens/recontagens têm revisões próprias; não editar uma revisão assinada para mudar o destinatário de teste.

Validação: testes PostgreSQL de concorrência, repetição, resultado parcial/incerto, autorização e allowlist; testes de origem/contrato das rotas; provider sem exposição de segredo, bloqueio de modelo pendente e upload privado. O teste externo deve usar somente amostra fictícia e destinatário autorizado. Nunca registrar tokens ou contatos de teste neste documento.

Contrato oficial consultado: [template com mídia, coleção da Meta](https://www.postman.com/meta/whatsapp-business-platform/request/2qbotrb/send-message-template-media).
