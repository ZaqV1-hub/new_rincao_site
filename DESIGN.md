# Painel — continuidade visual

Escopo: novas áreas operacionais dentro do painel existente, sem redesenhar o site público.

- Preservar shell, marca e navegação azul existentes. Texto principal `#123b63`, secundário `#45647f`, bordas `#d4dfeb`, superfícies brancas.
- Cadastros seguem uma coluna central de até 1120 px, título direto, ação de criação e lista pesquisável. Valores usam numeração tabular e reais brasileiros.
- Edição simples aparece no fluxo da página, com labels, foco inicial, estado de salvamento e confirmação do servidor. Conflito mantém o formulário; substituir por versão atual exige ação explícita.
- No celular, ações e preços quebram em linhas legíveis. Alvos de interação próximos de 44 px; foco visível. Erros têm texto, não apenas cor.
- Não inserir exemplos do protótipo como dados reais. Não há imagens novas neste cadastro.

Evidência: telas reais de serviços revisadas em 1440×1000 e 390×844; formulário verificado em 360 px sem overflow. Ensaios com registros sintéticos no PostgreSQL local. Revisão de fonte por detector sem achados, limitada a regras regex; contraste/layout conferidos no browser, sem auditoria automática completa de acessibilidade.
