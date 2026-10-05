import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";

type QueryClient = Pick<ReturnType<typeof getIngressoSistemaDbPool>, "query">;

export async function ensureSiteAccountOverridesTable(client: QueryClient = getIngressoSistemaDbPool()) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS usuario_site_conta (
      cpf varchar(11) PRIMARY KEY,
      senha varchar(255) NOT NULL,
      nmusuario varchar(120) NOT NULL,
      rg varchar(10),
      dtnascimento date,
      sexo varchar(1),
      email varchar(120),
      telefone varchar(20),
      celular varchar(20),
      endereco varchar(100),
      numero varchar(20),
      cep varchar(8),
      bairro varchar(50),
      uf varchar(2),
      cidade integer,
      complemento varchar(50),
      stusuario varchar(3) NOT NULL DEFAULT 'ati',
      dtcadastro date NOT NULL DEFAULT CURRENT_DATE,
      dtulogin date,
      hrulogin time
    )
  `);
  await client.query("CREATE INDEX IF NOT EXISTS usuario_site_conta_email_idx ON usuario_site_conta (lower(email))");
}

export async function preservePublicAccountBeforeInternalPromotion(client: QueryClient, cpf: string) {
  await ensureSiteAccountOverridesTable(client);
  await client.query(
    `
      INSERT INTO usuario_site_conta (
        cpf, senha, nmusuario, rg, dtnascimento, sexo, email, telefone, celular,
        endereco, numero, cep, bairro, uf, cidade, complemento, stusuario,
        dtcadastro, dtulogin, hrulogin
      )
      SELECT
        cpf, senha, nmusuario, rg, dtnascimento, sexo, email, telefone, celular,
        endereco, numero::text, cep, bairro, uf, cidade, complemento, stusuario,
        dtcadastro, dtulogin, hrulogin
      FROM usuario
      WHERE cpf = $1 AND idpapel IS NULL
      ON CONFLICT (cpf) DO NOTHING
    `,
    [cpf],
  );
}

export async function hasSiteAccountOverride(cpf: string) {
  await ensureSiteAccountOverridesTable();
  const result = await getIngressoSistemaDbPool().query<{ cpf: string }>(
    "SELECT cpf FROM usuario_site_conta WHERE cpf = $1 LIMIT 1",
    [cpf],
  );
  return Boolean(result.rows[0]);
}
