# Painel do Rincão · desenvolvimento

Arquivo para o Codex desenvolver o painel do Rincão a partir do protótipo aprovado (`Rincão Gestão - Painel.html`). O protótipo define telas, textos e fluxo; o código segue a stack, os componentes e o banco do sistema atual.

## Prompt para o Codex

```
Você vai desenvolver o novo painel de gestão do Rincão neste repositório. Leia este arquivo inteiro e abra o protótipo "Rincão Gestão - Painel.html", navegando por todas as telas descritas aqui.

Antes de codar:
1. Mapeie a stack, rotas, componentes, autenticação e banco do sistema atual, e o que já existe e deve ser reaproveitado (compras, vouchers, clientes/escolas, passeios escolares, bilheteria e validação de ingresso, tabela de preço, observações do cliente, integração Cielo, geração de PDF).
2. Proponha as migrações que faltam e me mostre o plano antes de aplicar.

Depois implemente por partes, nesta ordem, cada uma em develop com testes e a suíte inteira passando:
1. Agenda e day use por data
2. Página da data e resumo
3. Dia seguinte
4. Serviços adicionais e locais de caixa
5. Caixas por local
6. Compras e vouchers da data
7. Passeios (caixa de passeios, página do passeio e fechamento)
8. Fechamento do dia e exportação
9. Painel dos donos

O cálculo do fechamento do passeio deve ficar numa função pura e testada, exatamente como descrito. A contagem dos ônibus vem do aplicativo de contagem (outro arquivo) e precisa aparecer no painel em tempo real. Ao fim de cada parte, liste o que foi feito e como testar no site de teste.
```

## 1. Agenda, day use por data e tabela de preço


### Objetivo

A agenda vira a tela inicial do painel. Cada data mostra o que está previsto e dá acesso a tudo daquele dia.

### Fluxo e telas

1. **Calendário mensal** com setas para o mês anterior/próximo.
2. **Cada data** mostra: total de pessoas previstas, número de passeios e veículos e o faturamento do dia (quando houver).
3. **Estados visuais da data:**
   - **Day use aberto:** destaque forte.
   - **Só grupos:** tem passeio mas o day use está fechado.
   - **Sem nada aberto:** data futura vazia mostra o botão "Abrir day use".
   - **Hoje:** marcador de hoje.
4. **Selos por data:** Day use, Dia seguinte (a criar, criado, enviado), Fechado, Contando (algum ônibus em contagem agora), Fechamento pendente.
5. **Filtros:** Todas, Day use, Grupos, Fechamento pendente.
6. **Clique na data** abre a página da data (página da data).
7. **Abrir ou editar o day use da data** (modal):
   - status: aberta ou fechada (fechada some do site de vendas);
   - **tabela de preço** da data (fica acima de "Ingressos à venda");
   - validade dos vouchers: só no dia, 7 dias, 30 dias, 6 meses;
   - limite de vendas no site (os caixas podem vender acima do limite);
   - ingressos à venda (Adulto, Criança, Isento);
   - serviços adicionais à venda (vêm do cadastro de serviços (parte 4)).
8. **Seleção múltipla de datas:** cada data de hoje em diante tem um quadradinho no canto. Com uma ou mais datas marcadas aparece uma barra com "Tabela de preço" + "Aplicar". Aplicar troca a tabela de todas as marcadas de uma vez. Datas sem day use guardam a tabela para quando o day use for aberto.

### Regras

- Datas passadas não podem ser marcadas para troca de tabela.
- A tabela de preço da data é a que vale no site e nos caixas daquela data.
- Abrir ou fechar o day use, trocar tabela e limite ficam registrados (quem e quando).
- A edição das tabelas em si (criar tabela, mudar preços) fica fora deste projeto; use as tabelas que já existem.

## 2. Página da data e resumo


### Objetivo

Entrando numa data, a equipe encontra tudo daquele dia em abas.

### Fluxo e telas

1. **Cabeçalho:** data por extenso, setas para ir à data anterior/próxima **com movimento**, selos (day use aberto, tabela de preço, dia seguinte, caixas abertos, fechamento), botões "Editar day use" e o botão do dia seguinte (dia seguinte).
2. **Abas:** Resumo, Passeios, Compras e vouchers, Caixas, Fechamento do dia (com contador quando fizer sentido).
3. **Resumo:**
   - indicadores: pessoas previstas (grupos + day use), já no parque (contados no app + ingressos lidos), faturamento do dia, situação do fechamento;
   - **De onde vem o dinheiro** (barras): Ingressos no site, Ingressos nos caixas, Passeios, Adicionais e serviços;
   - **Contagem dos passeios:** cada passeio com contados / previsão, e o day use com vendidos e lidos.

### Regras

- **Passeios só entram no faturamento quando o passeio é finalizado** (pagamento registrado no fechamento do passeio, parte 7). Até lá, a linha Passeios fica em R$ 0,00 para aquele passeio.
- Faturamento do dia = ingressos no site + ingressos nos caixas + passeios finalizados + adicionais e serviços − descontos.
- "Já no parque" = pessoas contadas no app (veículos concluídos) + ingressos de day use lidos/validados.
- As setas pulam para a próxima data com movimento (day use aberto ou passeio).

## 3. Dia seguinte dentro da data


### Objetivo

Substituir a planilha do dia seguinte que o Wagner monta à mão. A programação nasce dos dados da agenda e gera os arquivos para o grupo e para os transportadores.

### Fluxo e telas

1. **Botão na página da data:**
   - data futura sem dia seguinte: "Criar dia seguinte";
   - já criado: "Alterar dia seguinte";
   - data que já passou: "Abrir dia seguinte" (só consulta).
2. **Tela do dia seguinte:**
   - X fecha e volta para a última data onde a pessoa estava;
   - setas para ir ao dia seguinte da data anterior/próxima com movimento;
   - **faixa de datas** com o status de cada uma: A criar, Criado, Criado e enviado, Já ocorreu, Já ocorreu e não criado.
3. **Grupos do dia** (vêm da agenda): representante, cliente, contato e telefone da escola, público, veículos (ônibus + vans), transportador, horário de embarque, observações. Linha do day use com o público vendido. Linha de resumo com total de pessoas e veículos. Clicar num grupo abre um modal para completar: contato, telefone, ônibus, vans, horário, público, transportador (com sugestões dos já usados e a opção "Transporte do cliente"), contato do transportador, observações. O que faltar aparece como "faltando"/"a preencher".
4. **Observações e contratações:** a lista já vem pronta com todos os itens (Escala monitoria, Portaria, Enfermaria, Cantor, Equipe de tirolesa, Equipe de piscina, Manutenção, Sacolão e padaria, Vai acender a caldeira?). Só preencher o nome de quem fica. Em branco significa que não tem. Botão "+ Adicionar outro item".
5. **Previsão do tempo** da data, buscada ao abrir, com botão "Atualizar previsão".
6. **Criar dia seguinte** marca a data como criada na agenda. Depois disso as alterações salvam sozinhas.
7. **Enviar:** gera dois materiais para download (imagem e PDF):
   - **Programação do dia:** mesma leitura da planilha de hoje (grupos, resumo, contratações preenchidas e previsão do tempo). Itens sem nome não aparecem.
   - **Fichas dos transportadores:** uma ficha por transportador, com cada parada (cliente, ônibus/vans, horário de embarque, endereço e contato da escola). "Transporte do cliente" não gera ficha.
   - O painel só gera os arquivos. Quem envia no grupo e para os transportadores é o gerente, como hoje.
8. **Data que já passou:** abre só para consulta, com "Editar mesmo assim" (fica registrado).

### Regras

- Os grupos são lidos dos passeios da data. Alterar transportador/veículos aqui atualiza o passeio.
- Status muda para "Criado e enviado" quando os arquivos são gerados.
- Endereço e contato da escola vêm do cadastro do cliente.
- Previsão do tempo: use uma API gratuita (ex.: Open-Meteo) com a localização do parque; guarde o texto e o horário da consulta.

## 4. Administração: serviços adicionais e locais de caixa


### Serviços adicionais

- Cadastro com: nome, descrição, valor no site (em branco = só vende na bilheteria), valor na bilheteria, ativo/inativo.
- Substitui os antigos "tickets de serviço e adicionais" no caixa, no day use e no fechamento.
- Ao criar um serviço novo, opção de já colocar à venda nas datas com day use aberto.
- Serviços **não têm desconto** no caixa.
- Exemplos do protótipo: Estacionamento, Tirolesa, Arvorismo, Pedalinho, Petisqueira, Almoço buffet, Armário.

### Locais de caixa

- Cadastro com: nome, descrição, ativo/inativo.
- Ao abrir um caixa (caixas), a pessoa escolhe o local numa lista dos locais ativos que ainda não estão abertos naquela data.
- Exemplos: Bilheteria, Piscina de ondas, Lanchonete, Quiosque da tirolesa, Recepção da pousada.

## 5. Caixas por local


### Objetivo

Substituir a "bilheteria" por caixas que se abrem e fecham por local, com várias pessoas e vários caixas ao mesmo tempo.

### Regras

- Todo caixa é **aberto e fechado**. Pode ser aberto a qualquer hora e entra no histórico.
- **Fecha sozinho à meia-noite** se ninguém fechar antes.
- **Vários caixas abertos ao mesmo tempo**, um por local. Mais de uma pessoa pode usar o mesmo caixa aberto.
- Ao abrir: escolher o **local** (lista de locais de caixa (parte 4)) e informar o **troco inicial**.
- Caixa só abre na data de hoje.

### Telas dentro do caixa (4 abas)

1. **Vender:**
   - cartões de ingressos (Adulto, Criança, Isento, com o preço da tabela da data na bilheteria) e de serviços adicionais; tocar adiciona;
   - **desconto por ingresso:** meia, parceiro, aniversariante, cortesia. Cortesia exige "autorizado por";
   - serviços **não têm desconto**;
   - **CPF do cliente obrigatório**, para achar a compra depois;
   - **pagamento dividido** em mais de uma forma (dinheiro, Pix, crédito, débito), com cálculo do que falta e do troco (troco só em dinheiro).
2. **Consultar ingresso:**
   - validar pelo código do voucher; avisa se já foi usado (quando e em qual caixa) ou se é de outra data;
   - buscar por nome, CPF ou número da compra.
3. **Fundo e sangria:**
   - fundo = nome da pessoa + valor colocado;
   - sangria = nome da pessoa + valor retirado (não pode passar do dinheiro do caixa);
   - a sangria sai do dinheiro do caixa e do fechamento geral.
4. **Fechamento do caixa:**
   - público, faturamento, dinheiro no caixa e ticket médio;
   - ingressos do site lidos ali, ingressos vendidos, serviços adicionais, cortesias;
   - resumo por forma de pagamento;
   - conferência do dinheiro: troco + vendas em dinheiro − sangrias = esperado; informar o contado e ver a diferença;
   - exportar e fechar o caixa.

## 6. Compras e vouchers da data


### Objetivo

Ver e resolver tudo que foi vendido para a data, no site e nos caixas, sem sair da agenda. Boa parte já existe no sistema; aqui é reorganizar a partir da data.

### Fluxo e telas

1. **Lista de compras da data:** day use e alunos de passeio. Filtros: origem (site ou caixas) e tipo (day use, passeio). Busca por número da compra, nome ou CPF. Contador por filtro.
2. **Clicar na linha abre a página da compra** (página, não modal), com:
   - dados do cliente e da visita (data, compra feita em, origem, validade, valor total);
   - **vouchers**, um por ingresso, com status usado/não usado (quando usado: hora e caixa);
   - ações nos vouchers selecionados: validar, desvalidar, imprimir, enviar no WhatsApp para um telefone;
   - itens, pagamento (pode ser dividido) e histórico;
   - botões "Mover ou editar validade" e "Mais detalhes do cliente" (abre o cadastro do cliente, que já existe).
3. **Mover ou editar validade em lote** (ex.: dia de chuva): nova data (só datas com day use aberto), nova validade, motivo, opção de avisar o cliente por e-mail. Fica registrado no histórico da compra.

## 7. Passeios: caixa de passeios, página do passeio e fechamento


### Aba Passeios = caixa só dos passeios

- **Resumo no topo:** resultado dos passeios (receita − despesas dos passeios), receita (passeios finalizados), despesas, dinheiro em caixa.
- **Abrir caixa de passeios** com troco inicial. Enquanto aberto: **+ Adicionar troco**, **Sangria** (nome, valor, motivo; não passa do dinheiro do caixa) e **Fechar caixa de passeios** (informa o contado e mostra a diferença).
- Sem o caixa aberto, Pix/transferência/boleto podem ser registrados; **dinheiro exige caixa de passeios aberto**.
- **Pago por forma de pagamento** (seção recolhível): Online (site) dos passeios finalizados + o que as escolas pagaram por forma. Mostra também os movimentos do dinheiro e os reembolsos a fazer.
- **Despesas dos passeios** (seção recolhível): descrição, alocação (Monitoria, Alimentação, Transporte, Atividades e brinquedos, Materiais, Outros), passeio (ou "Todos os passeios"), pago com (Dinheiro do caixa, Pix, Cartão da empresa), valor. Despesa em dinheiro sai do caixa. Entram no resultado do dia.
- Lista dos passeios do dia (cards) com situação (A fechar / Finalizado · recibo nº), valor a cobrar ou total do passeio, pessoas contadas e veículos.
- **Exportar relatório dos passeios:** caixa, cada passeio (veículos, quem contou, responsável, modalidades, cobrança, reembolsos) e despesas.

### Página do passeio (seções recolhíveis)

1. **Dados do passeio:** cliente e representante (do cadastro), **pessoas previstas** (editável), valor por pessoa no site (só leitura), transportador, telefone, horário de embarque, observações.
2. **Veículos e contagem:** tabela com Veículo, Pessoas previstas (editável por veículo), Vieram, Status (Aguardando, Contando, Concluído), Contado por, Responsável (nome, WhatsApp e "Ver assinatura"). Uma **seta (V) no fim de cada ônibus** abre embaixo o detalhe por modalidade daquele ônibus (Modalidade 1; Modalidades 2 e 3 com o tipo de deficiência; Filho de professor; Por idade) e as observações. Fechado aponta para baixo, aberto para cima. Abaixo da tabela: contagem completa do passeio por modalidade e as observações da contagem. Botões "+ Ônibus" e "+ Van". Veículo adicionado no dia aparece como "A mais no dia" com quem adicionou.
3. **Lista de presença · pagos no site:** vem **completa**, todos entram como presentes. Cada linha: nome, tipo (Adulto/Criança), número da compra (abre a compra) e valor pago. Busca por nome. Quem foi marcado para reembolso aparece riscado com "Não veio · reembolso".
4. **Fechamento do passeio** (sempre aberto).

### Fechamento do passeio: regras e cálculo

Entradas editáveis: **valor por adulto**, **valor por criança** (começam iguais ao valor do site), **cortesias adulto**, **cortesias criança**.

> Os valores por adulto e por criança **valem só para quem foi contado no app e não pagou no site**. Mudar o valor não muda o que os compradores do site pagaram.

Cálculo (por passeio, com a contagem dos veículos concluídos):

```
cAd = adultos contados        cCr = crianças contadas
sAd = pagos no site presentes do tipo Adulto (todos menos os marcados para reembolso)
sCr = idem, tipo Criança
siteV  = soma do valor pago pelos presentes do site
reembV = soma do valor pago pelos marcados para reembolso
qAd = max(0, cAd - sAd - cortesiasAdulto)
qCr = max(0, cCr - sCr - cortesiasCrianca)
aCobrar = qAd * valorAdulto + qCr * valorCrianca
totalDoPasseio = siteV + aCobrar
naoCobrados = coord + pcdCr + pcdAd + acompPcd + filhoProf + isento   (configurável)
```

Tela do cálculo: adultos contados (quantos pagaram no site e quantas cortesias), crianças contadas (idem), não cobrados, adultos a cobrar (q × valor), crianças a cobrar (q × valor), total do passeio, menos já pagos no site, **a cobrar da escola**.

Avisos:
- Contagem incompleta (veículos não concluídos): "o cálculo usa o que foi contado até agora".
- Mais gente paga no site do que adultos + crianças contados: pedir para conferir a contagem ou marcar quem não veio.

**Pessoas do site que precisam de reembolso:** campo de busca por nome com lista suspensa (ex.: digita "Rafael", aparece cada Rafael com tipo, compra e valor; seleciona o certo). A pessoa entra numa tabela (nome, compra, valor pago) com opção de tirar. Total a reembolsar em destaque. O Rincão devolve esse valor.

**Pagamento da escola:**
- uma ou mais formas (Pix, Dinheiro, Transferência, Boleto, Cartão de crédito, Cartão de débito), com **restante automático** na última forma;
- status: falta receber, pagamento completo, ou troco (troco só se houver dinheiro);
- dinheiro exige caixa de passeios aberto;
- data do pagamento.

**Registrar pagamento e emitir recibo:** abre a prévia do **recibo em 2 vias** (Via do Rincão, com campo de assinatura do responsável da escola; Via da escola, assinada pelo Rincão), separadas por linha de corte. O recibo traz: nº, cliente, data e veículos, representante, contagem por modalidade e total de pessoas, adultos e crianças cobrados (q × valor), cortesias, pagos no site e presentes, reembolsos, total do passeio, forma(s) de pagamento, data e valor recebido. Ao confirmar: o passeio fica **Finalizado**, grava um snapshot da conta (valores não mudam mais), o total do passeio entra na receita do dia e os pagamentos entram nas formas de pagamento (site como "Online (site)").

## 8. Fechamento do dia e exportação


### Tela

1. **Resultado do dia** (5 números): resultado (entradas − despesas), entradas (site, caixas e passeios), despesas (nº de lançamentos), **dinheiro nos caixas** (soma do esperado de todos os caixas, incluindo o de passeios), **público total** (passeios contados + ingressos de day use lidos).
2. **Avisos:** passeios sem fechamento, veículos sem contagem, caixas abertos (fecham junto com o dia), reembolsos de passeio a fazer. Se o dia já foi fechado: quem fechou, quando e botão "Reabrir o dia".
3. **Caixas do dia** (sempre visível): uma linha por caixa, **incluindo Passeios**, com situação, vendas, sangrias, dinheiro esperado, contado e diferença. Clicar abre o caixa (Passeios abre a aba Passeios).
4. Seções que **vêm fechadas e abrem ao clicar**, cada uma com um resumo/valor no título:
   - **Entradas do dia:** ingressos no site, ingressos nos caixas, passeios finalizados (cada um com site e escola), adicionais e serviços item a item, descontos e cortesias, total.
   - **Por forma de pagamento:** total por forma, para bater com extrato e maquininha.
   - **Público do dia:** pessoas em passeios (veículos contados), ingressos de day use lidos e vendidos, total.
   - **Despesas do dia:** despesas do dia + despesas do caixa de passeios (marcadas como "Caixa de passeios"), com formulário para lançar outras (descrição, categoria, valor, pago com).
5. **Exportar fechamento** (só aqui; saiu do cabeçalho da data) e **Fechar o dia**.

### Regras

- Fechar o dia fecha junto todos os caixas abertos (inclusive o de passeios) e **trava** os números do dia. Reabrir fica registrado.
- As entradas usam a mesma função de apuração da página da data (parte 2).

### Exportar fechamento (PDF e planilha)

Folha A4 com cabeçalho (logo, data, gerado por e quando) e: indicadores (resultado, entradas, despesas, dinheiro nos caixas, público), gráficos "De onde vem o dinheiro" e "Formas de pagamento", tabela de caixas, tabela de passeios (pessoas, pagos no site, da escola, total, situação), contagem dos passeios e por modalidade, entradas, day use, despesas e campos de assinatura (fechado por, conferido por). Também exporta lista de compras e o fechamento de cada caixa.

## 9. Painel dos donos (Rincão + Estância)


### Objetivo

Um link para a dona Vilma e o seu Jorge acompanharem o Rincão e a Estância juntos, a partir dos fechamentos de cada dia. Só leitura.

### Telas

- **Filtros:** Dia / Mês / Ano, setas para navegar entre períodos, parque (os dois, só Rincão, só Estância).
- **Indicadores:** Público, Receita, Custos (com % da receita) e Resultado, separados por parque e comparados com o período anterior. No mês em andamento, compara com os **mesmos dias** do mês anterior.
- **Dia:** cada parque com público (day use e alunos de passeios), receita, custos, resultado e situação do fechamento; origem da receita (site, caixas, passeios, serviços adicionais); público dos últimos 7 dias.
- **Mês:** gráficos de público e de receita por dia (os dois parques empilhados), tabela dia a dia, fechamento do mês por parque (dias abertos, público, receita, custos, resultado, dias fechados) com PDF e planilha, dias mais cheios.
- **Ano:** público e receita por mês e tabela mês a mês.
- Funciona bem no celular.

### Regras

- Os números vêm da função de apuração (página da data) e dos fechamentos do dia (fechamento do dia) de cada parque. Dia não fechado aparece como "aberto".
- Acesso separado, só leitura, sem nenhuma ação no sistema.
- Rincão e Estância são tenants/bases diferentes: o painel lê dos dois .
- Cores fixas por parque (Rincão azul, Estância verde), iguais em todos os gráficos.

