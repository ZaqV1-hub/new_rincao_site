# Revisão de interface da contagem e gestão — 19/11/2026

Referências recebidas: `Contagem Rincão - Aplicativo.html` e `Rincão Gestão - Painel.html`, na pasta Rincão Gestão do projeto. Base: develop atualizada, incluindo as alterações de Juan. Destino exclusivo: HML, em cluberincao.questione.ai. Não promover para main nesta entrega.

## Diferenças corrigidas

A entrada por /contagem continua usando a autenticação do painel, agora com o login visual próprio do aplicativo. A mesma apresentação acompanha retornos a páginas internas de contagem. CPF, senha, permissões, proteção da sessão e validação de reCAPTCHA permanecem reais. Usuários e senhas livres de demonstração do HTML não são habilitados. A ajuda de senha orienta procurar o gerente, conforme o protótipo.

O aplicativo usa moldura de 400 px no computador e tela inteira no celular, com área de rolagem própria e ações inferiores fixas. A navegação reinicia a rolagem do conteúdo. A conta mostra nome e iniciais e abre uma folha inferior. Veículos em andamento ou concluídos abrem detalhes antes da ação. Assumir, recontar e confirmar envio usam folhas inferiores. A seleção de PCD continua expandindo na própria categoria, como no HTML.

Os cabeçalhos da data exibem Hoje, Data que já passou ou Próxima data. As expansões da gestão têm seta à direita, rotação, foco e destaque de fundo, sem deslocamento e sombra ao passar o mouse. Abertura de caixa, troco/sangria, fechamento de caixa de passeios, despesas e inclusão de item da programação usam janelas próprias. Modais permitem Escape e fechamento pelo fundo, e restauram o foco. Totais dos passeios recebem hierarquia visual e descrição dos valores.

## Regras preservadas

Não há alteração de cálculos, preços, registros financeiros, permissões, bloqueios de datas, assinatura, idempotência, políticas de privacidade ou endpoints de contagem. Mantidos os avisos necessários para dados indisponíveis, conflitos e tentativas sem confirmação. O HTML é referência de interface; seus exemplos e sucessos simulados não substituem os dados do servidor.

Envios de WhatsApp continuam exigindo ação explícita e confirmação do destinatário, com a integração atual. Não são criados envios, custos ou cobranças pela revisão visual. Câmera física, instalação e compartilhamento nativo precisam de homologação no Android/iPhone reais.

## Verificação

Revisão visual do login renderizado. Testes existentes de agenda, contagem, rascunho, recuperação, navegação, QR em datas de consulta, assinatura, relatórios, imagens e compartilhamento. Incluída regressão para consultar veículos em andamento/concluídos sem iniciar nem modificar contagem. Teste de imagens, que excedeu 5 segundos sob concorrência local, passou isolado. Publicação condicionada à suíte completa, lint, tipos e build do workflow de HML; confirmar também o release ativo e as telas no endereço público.
