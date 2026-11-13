# Aplicativo de contagem do Rincão · desenvolvimento

Arquivo para o Codex desenvolver o aplicativo de contagem dos ônibus a partir do protótipo aprovado (`Contagem Rincão - Aplicativo.html`, abrir na largura de celular). O protótipo define telas, textos e fluxo; o código segue a stack, a autenticação e o banco do sistema atual do Rincão.

## Prompt para o Codex

```
Você vai desenvolver o aplicativo de contagem do Rincão neste repositório. Leia este arquivo inteiro e abra o protótipo "Contagem Rincão - Aplicativo.html" na largura de um celular: faça login, toque num ônibus livre, conte por modalidade (incluindo uma criança PCD escolhendo a deficiência), escreva uma observação, avance, preencha o responsável e assine, avance para o resumo, finalize e envie, depois finalize o dia e veja os relatórios geral e cozinha.

Implemente como aplicação web mobile (PWA) dentro do sistema do Rincão, com o mesmo login do painel. Antes de codar, mapeie a stack, a autenticação, o banco e a validação de voucher que já existe, e me mostre o plano (tabelas da contagem, do responsável/assinatura e dos veículos extras, e como fazer o tempo real com o painel).

Siga o fluxo e as regras deste arquivo. A contagem grava no banco e aparece na hora no painel. Botões grandes para uso com uma mão. Envio da filipeta ao WhatsApp do responsável pela integração de WhatsApp da Brevia (template); se não der no prazo, abrir o WhatsApp do celular com o texto pronto e registrar o envio. Escreva testes para as regras (um contador por veículo, assumir, recontar, totais), rode a suíte, trabalhe em develop e liste no final o que foi feito e como testar com dois celulares.
```


### Objetivo

Os monitores contam cada ônibus no portão pelo celular, por modalidade, o responsável da escola confere e assina, e a contagem chega na hora no painel.

### Fluxo e telas

1. **Login** com o mesmo acesso do painel. Tocar no nome/avatar permite sair (avisa se houver contagem em andamento).
2. **Início:** abre no dia de hoje, com uma faixa de dias para navegar. Datas futuras só mostram o previsto; a contagem só abre no dia.
   - Resumo do dia: pessoas contadas no parque com a previsão ao lado (**não é limite**, pode passar), veículos concluídos, contando e livres.
   - Passeios com seus veículos: **cinza = livre**, **amarelo = contando** (com o nome de quem conta), **verde = concluído**. Em tempo real para todos os celulares e para o painel.
   - "Agora na equipe": feed de quem começou e concluiu cada veículo.
   - **Chegou mais um ônibus ou van:** botão no passeio; escolhe tipo, transportador e pessoas estimadas; entra com etiqueta "extra", aparece para todos e no painel ("4 previstos · +2 a mais no dia").
3. **Contar um veículo** (toca no cinza):
   - **Modalidade 1:** Professor / Coordenador ("Coordenador do grupo" em grupos que não são escola).
   - **Modalidades 2 e 3 · PCD:** Criança PCD e Adulto PCD. Ao tocar no **+**, abre logo embaixo, **sem mudar de tela**, "Qual a deficiência?" com as opções (Física, Visual, Auditiva, Intelectual, TEA (autismo), Múltipla, Outra) e "Cancelar". Escolheu, soma. Cada pessoa aparece como etiqueta com × para tirar. Depois, Acompanhante PCD.
   - **Filho de professor.**
   - **Alunos e demais pessoas** (ou "Pessoas do grupo"): Adulto (a partir de 12), Criança (4 a 11), Isento (até 3), pela regra de idade do site.
   - Cada linha tem **− número +** grandes; o − fica apagado em zero.
   - **Observações:** campo livre (ex.: "2 alunos com restrição alimentar. Rafael precisa tomar remédio controlado."). Vai para a filipeta e para o relatório da cozinha. **Sem cortesias no app.**
   - Topo com total de pessoas e de professores/acompanhantes.
4. **Avançar** (exige ao menos uma pessoa) → **Responsável pelo veículo:** nome, WhatsApp e assinatura com o dedo (canvas, com limpar). Botão **Avançar**.
5. **Resumo para conferir** (filipeta ainda não finalizada): totais, cada modalidade, PCD com o tipo, observações, contado por (início e fim), responsável, WhatsApp e assinatura, com a marca "Ainda não finalizada nem enviada". Botões **Finalizar contagem e enviar** e **Voltar e corrigir**.
6. **Finalizar contagem e enviar:** o veículo fica verde para todos, a filipeta é enviada ao WhatsApp do responsável e a tela mostra a filipeta final com "Enviada para o WhatsApp do responsável às hh:mm", botões "Reenviar" e "Voltar ao passeio".
7. **Veículo amarelo de outra pessoa:** dá para **assumir a contagem** de onde ela parou. **Veículo verde:** ver a filipeta ou **recontar**.
8. **Day use: leitura de QR.** Mostra vendidos para a data, já lidos e quantos ainda previstos (pode passar). Resultado: entrada liberada, ou voucher já utilizado (quando e por quem), ou de outra data.
9. **Finalizar contagem do dia:** avisa se há veículos sem contagem e abre **Ver relatórios**:
   - **Contagem geral:** total no parque, em passeios e day use; total por modalidade de todos os passeios; cada passeio com veículos, quem contou, responsável e assinatura; day use lido e vendido.
   - **Cozinha:** refeições (participantes + professores/acompanhantes) por passeio, quantos PCD, e as restrições e observações.
   - Botão **Compartilhar** (opções do celular: WhatsApp, e-mail, copiar texto, salvar imagem). Não envia sozinho.

### Regras

- Participantes = adulto + criança + isento + criança PCD + adulto PCD + filho de professor. Equipe = professor/coordenador + acompanhante PCD.
- Um veículo só pode estar sendo contado por uma pessoa por vez (ou assumido explicitamente).
- Contagem e status sincronizam em tempo real com o painel (passeios).
- Envio da filipeta por WhatsApp: usar a integração de WhatsApp que a Brevia já tem (Meta) com um template; se não der no prazo, abrir o WhatsApp do celular com o texto e a imagem prontos (link wa.me) e registrar o envio.

### Categorias da contagem

| Chave | Nome na tela | Grupo |
|---|---|---|
| `coord` | Professor / Coordenador (em grupos: "Coordenador do grupo") | Modalidade 1 |
| `pcdCr` | Criança PCD (com a deficiência) | Modalidades 2 e 3 |
| `pcdAd` | Adulto PCD (com a deficiência) | Modalidades 2 e 3 |
| `acompPcd` | Acompanhante PCD | Modalidades 2 e 3 |
| `filhoProf` | Filho de professor | Filho de professor |
| `adulto` | Adulto (a partir de 12 anos) | Por idade |
| `crianca` | Criança (4 a 11 anos) | Por idade |
| `isento` | Isento (até 3 anos) | Por idade |

Deficiências: Física, Visual, Auditiva, Intelectual, TEA (autismo), Múltipla, Outra.
