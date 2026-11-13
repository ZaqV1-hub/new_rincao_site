BEGIN;
CREATE TABLE IF NOT EXISTS painel_donos_acessos (
 cpf varchar(11) PRIMARY KEY REFERENCES usuario(cpf),
 parques text[] NOT NULL CHECK (cardinality(parques)>0 AND parques <@ ARRAY['rincao','estancia']::text[]),
 ativo boolean NOT NULL DEFAULT true,
 autorizado_por text NOT NULL CHECK(length(trim(autorizado_por))>0),
 autorizado_em timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE painel_donos_acessos IS 'Acesso explícito de leitura dos donos; não concede ACL operacional. Nenhum usuário é liberado automaticamente.';
COMMIT;
