INSERT INTO public.informacao (nome, texto, status)
SELECT
  'Agenda local',
  'Chegue com antecedencia;Apresente seu voucher na entrada;Programacao local para validacao',
  'ati'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.informacao
  WHERE nome = 'Agenda local'
);

INSERT INTO public.tabpreco (
  nmtabpreco,
  vlnormal,
  vlinfant,
  sttabpreco,
  dtcadastro,
  hrcadastro,
  vlnormalbil,
  vlinfantbil
)
SELECT
  'Tabela local',
  80.00,
  60.00,
  'ativ',
  CURRENT_DATE,
  CURRENT_TIME,
  80.00,
  60.00
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tabpreco
  WHERE nmtabpreco = 'Tabela local'
);

INSERT INTO public.agenda (
  dtagenda,
  idtabpreco,
  idinformacao,
  tpagenda,
  stagenda,
  nmpromocional,
  dspromocional,
  dtcadastro,
  hrcadastro
)
SELECT
  CURRENT_DATE,
  tabpreco.idtabpreco,
  informacao.idinformacao,
  'padra',
  'abe',
  NULL,
  NULL,
  CURRENT_DATE,
  CURRENT_TIME
FROM public.tabpreco
CROSS JOIN public.informacao
WHERE tabpreco.nmtabpreco = 'Tabela local'
  AND informacao.nome = 'Agenda local'
  AND NOT EXISTS (
    SELECT 1
    FROM public.agenda
    WHERE dtagenda = CURRENT_DATE
      AND tpagenda IN ('padra', 'promo')
  );

INSERT INTO public.uf (iduf, nmuf)
VALUES ('SP', 'Sao Paulo')
ON CONFLICT (iduf) DO NOTHING;

INSERT INTO public.cidade (idcidade, nmcidade, iduf)
SELECT 9668, 'Sao Paulo', 'SP'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cidade
  WHERE idcidade = 9668
);

INSERT INTO public.papel (idpapel, nmpapel, dtcadastro, hrcadastro)
VALUES
  (1, 'Gerente', CURRENT_DATE, CURRENT_TIME),
  (2, 'Funcionario', CURRENT_DATE, CURRENT_TIME)
ON CONFLICT (idpapel) DO NOTHING;

INSERT INTO public.usuario (
  cpf,
  nmusuario,
  idpapel,
  email,
  cep,
  uf,
  bairro,
  endereco,
  complemento,
  telefone,
  celular,
  senha,
  dtcadastro,
  hrcadastro,
  stusuario,
  rg,
  dtnascimento,
  sexo,
  cidade,
  numero
)
VALUES (
  '22181922845',
  'Usuario Local Teste',
  1,
  'local.teste@example.com',
  '01001000',
  'SP',
  'Centro',
  'Rua Local',
  'Casa',
  '1133334444',
  '11988887777',
  '827ccb0eea8a706c4c34a16891f84e7b',
  CURRENT_DATE,
  CURRENT_TIME,
  'ati',
  '123456789',
  DATE '1990-05-10',
  'm',
  9668,
  123
)
ON CONFLICT (cpf) DO UPDATE
SET
  nmusuario = EXCLUDED.nmusuario,
  idpapel = EXCLUDED.idpapel,
  email = EXCLUDED.email,
  cep = EXCLUDED.cep,
  uf = EXCLUDED.uf,
  bairro = EXCLUDED.bairro,
  endereco = EXCLUDED.endereco,
  complemento = EXCLUDED.complemento,
  telefone = EXCLUDED.telefone,
  celular = EXCLUDED.celular,
  senha = EXCLUDED.senha,
  stusuario = EXCLUDED.stusuario,
  rg = EXCLUDED.rg,
  dtnascimento = EXCLUDED.dtnascimento,
  sexo = EXCLUDED.sexo,
  cidade = EXCLUDED.cidade,
  numero = EXCLUDED.numero;
