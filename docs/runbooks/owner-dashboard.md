# Painel dos donos — configuração e fontes

Área `/donos`, exclusivamente de consulta. Não utiliza a sessão nem as permissões operacionais. Nenhum acesso real é concedido pela migração; identificar as contas de Vilma/Jorge com o responsável antes de cadastrar seus CPFs em `painel_donos_acessos`.

## Configuração no servidor

Aplicar `2026-11-13-owner-access.sql` pelo runner operacional. Preservar seu checksum depois da aplicação. Usar as senhas já cadastradas em `usuario`; a consulta não atualiza o usuário. A linha de autorização contém CPF, parques, ativo, responsável pela autorização e data. Revogar por `ativo=false`; o próximo pedido, inclusive de uma sessão existente, perde acesso. Não atribuir perfil de gerente para conceder este acesso.

- `OWNER_SESSION_SECRET`: segredo aleatório no servidor; admite como fallback o segredo de sessão já configurado. Assinatura usa domínio e escopo exclusivos `owners`. Cookie HTTP-only, Secure em produção, SameSite Strict, oito horas.
- Proteção reCAPTCHA existente obrigatória em produção. Login/logout validam Origin contra Host recebido, inclusive atrás do proxy; nenhuma credencial é registrada em log.
- `OWNER_RINCAO_READ_DATABASE_URL`, `OWNER_ESTANCIA_READ_DATABASE_URL`, `OWNER_ESTANCIA_SCHOOL_READ_DATABASE_URL`: três conexões explícitas com papéis sem escrita. Nunca usar como fallback a credencial operacional.
- `OWNER_RINCAO_EXPECTED_DATABASE`, `OWNER_ESTANCIA_EXPECTED_DATABASE`, `OWNER_ESTANCIA_SCHOOL_EXPECTED_DATABASE`: nomes esperados exatos, verificados por `current_database()` em toda transação. Na VM consultada: Rincão HML `clrincao_sistema_test`, Estância day use `clestancia_sistema`, escolas `estancia_sistema` na origem B2B configurada. Não deduzir o host da base escolar pelo nome.
- `OWNER_RINCAO_START_DATE`, `OWNER_ESTANCIA_START_DATE`: data de corte `AAAA-MM-DD` aprovada para os novos números. Histórico anterior sem revisão gerencial não é tratado como fechamento confirmado. Não retroagir o corte para preencher gráficos.

O papel de cada conexão deve ter LOGIN, CONNECT no banco correto, USAGE em public e SELECT somente nas fontes listadas. Sem SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS, sem CREATE em public, nem INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER nas tabelas. Não reutilizar um papel membro de grupo escritor. Default `default_transaction_read_only=on`; o código também usa REPEATABLE READ READ ONLY, limite de conexão e timeout. O leitor recusa uma identidade de banco diferente ou credencial com privilégios de escrita, em vez de publicar números sob o parque errado.

Fontes Rincão: `voucher`, `compra`, `agenda`, `agenda_extras`, `servicos_adicionais`, `operacao_dias`, `operacao_fechamentos`, `caixa_periodos`, `passeio_veiculos`, `passeio_contagens`, `passeio_operacao`, `passeio_recibos`, `operacao_despesas`.

Fontes Estância: `compra`, `voucher`, `agenda`, `agenda_extras`; a origem day use também lê `estancia_site_content` para classificar passaportes especiais pelo catálogo real. Não conceder escrita nessas tabelas ao leitor. A projeção HTTP/PDF/XLSX contém apenas agregados, não assinaturas, CPFs, contatos, dados de saúde ou compras individuais.

Provisionar os papéis e guardar suas senhas diretamente no arquivo persistente de configuração, fora do Git e dos logs. Depois testar uma tentativa de escrita dentro de transação que será revertida: deve falhar por permissão mesmo com `BEGIN READ WRITE`. Nunca testar escrita em dados reais; usar tabela descartável autorizada ou inspeção de privilégios em produção.

## Apuração e limitações verificadas

Rincão reaproveita os SELECTs da apuração operacional. A consulta de intervalo usa um único pedido ao banco; `jit=off` evita custo de compilação desproporcional em períodos pequenos. Fechamentos usam a revisão imutável E9; dias abertos são provisórios. Receita por data de visita, público por entrada efetiva e veículos concluídos. Valor da gaveta não é receita. Não somar recebimentos novamente à receita.

Prova de leitura na VM em 13/11/2026: `clestancia_sistema` possui fechamentos de caixa 140/141 com `cashSales`, `fund`, `sangria`, `cashInDrawer`; esses snapshots não são fechamentos gerenciais. A configuração B2B aponta outra base, `estancia_sistema`, com compras escolares online e sem tabela de recibo/finalização do passeio ou contagem integral identificada. As consultas de novembro foram executadas nas duas origens em modo somente leitura. Isso comprova acesso às fontes identificadas, não cobertura integral da operação.

Estância mostra vendas confirmadas com itens conciliáveis ao total da compra, sem duplicar por pagamentos nem incluir reservas `N/A` não recebidas. Divergências ficam fora do subtotal e são sinalizadas. Público considera uso real e classificação comprovada: `espec` pode ser passaporte ou adicional, conforme catálogo. Produto usado sem classificação torna o total indisponível. A base escolar oferece apenas o subtotal online; em datas de excursão, receita integral e público integral permanecem indisponíveis até identificar a fonte restante. Não criar fechamento gerencial a partir de saldo de caixa. Essa integração completa permanece um gate, separado da interface pronta.

Despesas e resultado da Estância permanecem NULL, pendentes de confirmação do usuário com Isaque. Não criar módulo, zero presumido ou fórmula sobre despesas incompletas.

## Verificação e ativação

- Conta sem grant ou revogada: 401; sessão dos donos em API operacional: 401; mutação em resumo/exportação: 405; origem estrangeira em sessão: 403.
- Confirmar os três bancos/papéis, data de corte, acesso à fonte escolar e catálogo. Uma origem indisponível deve preservar a outra e exibir a lacuna.
- Conferir Dia/Mês/Ano, mês parcial contra os mesmos dias do anterior e fevereiro bissexto. Antecedente zero não produz percentual infinito.
- Conferir tela/PDF/XLSX com a mesma revisão. Uma lacuna no período mantém o total indisponível e identifica subtotal conhecido, quando há fonte disponível. Valores de dinheiro no XLSX são numéricos em reais; textos não executam fórmulas.
- Testar 360/390/1440 px, navegação por teclado e gráficos com rótulos. PDF A4 e planilha mensal incluem situação, revisão, origem e horário.
- Liberar as contas reais somente depois de conferir os números das fontes. Não declarar o consolidado da Estância completo enquanto houver os gates acima.
