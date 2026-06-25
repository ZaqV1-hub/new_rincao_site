import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const schemaPath = new URL("../docker/initdb/01_schema.sql", import.meta.url);

const ignoredTablePatterns = [
  /_backup/i,
  /_bak_/i,
  /_delta_/i,
];

function shouldIgnoreTable(tableName) {
  return ignoredTablePatterns.some((pattern) => pattern.test(tableName));
}

function getMysqlConfig() {
  const host = process.env.WP_DB_HOST || process.env.INGRESSO_DB_HOST;
  const user = process.env.WP_DB_USER || process.env.INGRESSO_DB_USER;
  const password = process.env.WP_DB_PASSWORD || process.env.INGRESSO_DB_PASSWORD;
  const database = process.env.WP_DB_NAME || process.env.INGRESSO_DB_NAME;
  const port = Number(process.env.WP_DB_PORT || process.env.INGRESSO_DB_PORT || 3306);

  if (!host || !user || !database) {
    throw new Error(
      "Defina WP_DB_HOST, WP_DB_USER, WP_DB_PASSWORD e WP_DB_NAME para preparar o MySQL do painel.",
    );
  }

  return {
    host,
    user,
    password,
    database,
    port,
    ssl: { rejectUnauthorized: false },
    multipleStatements: false,
  };
}

function parseCreateTables(schemaSql) {
  const tables = new Map();
  const regex = /CREATE TABLE public\.(\w+)\s*\(([\s\S]*?)\);\n/gi;

  for (const match of schemaSql.matchAll(regex)) {
    const tableName = match[1];
    const body = match[2];

    if (shouldIgnoreTable(tableName)) {
      continue;
    }

    tables.set(tableName, body);
  }

  return tables;
}

function parsePrimaryKeys(schemaSql) {
  const primaryKeys = new Map();
  const regex =
    /ALTER TABLE ONLY public\.(\w+)\s+ADD CONSTRAINT [\w"]+ PRIMARY KEY \(([^)]+)\);/gi;

  for (const match of schemaSql.matchAll(regex)) {
    const tableName = match[1];
    const columns = match[2]
      .split(",")
      .map((value) => value.trim().replace(/^"|"$/g, ""));

    if (!shouldIgnoreTable(tableName)) {
      primaryKeys.set(tableName, columns);
    }
  }

  return primaryKeys;
}

function parseUniqueKeys(schemaSql) {
  const uniqueKeys = new Map();
  const regex =
    /ALTER TABLE ONLY public\.(\w+)\s+ADD CONSTRAINT ([\w"]+) UNIQUE \(([^)]+)\);/gi;

  for (const match of schemaSql.matchAll(regex)) {
    const tableName = match[1];
    const constraintName = match[2].replace(/^"|"$/g, "");
    const columns = match[3]
      .split(",")
      .map((value) => value.trim().replace(/^"|"$/g, ""));

    if (shouldIgnoreTable(tableName)) {
      continue;
    }

    if (!uniqueKeys.has(tableName)) {
      uniqueKeys.set(tableName, []);
    }

    uniqueKeys.get(tableName).push({ constraintName, columns });
  }

  return uniqueKeys;
}

function parseForeignKeys(schemaSql) {
  const foreignKeys = new Map();
  const regex =
    /ALTER TABLE ONLY public\.(\w+)\s+ADD CONSTRAINT ([\w"]+) FOREIGN KEY \(([^)]+)\) REFERENCES public\.(\w+)\(([^)]+)\)([^;]*);/gi;

  for (const match of schemaSql.matchAll(regex)) {
    const tableName = match[1];

    if (shouldIgnoreTable(tableName) || shouldIgnoreTable(match[4])) {
      continue;
    }

    if (!foreignKeys.has(tableName)) {
      foreignKeys.set(tableName, []);
    }

    foreignKeys.get(tableName).push({
      constraintName: match[2].replace(/^"|"$/g, ""),
      columns: match[3]
        .split(",")
        .map((value) => value.trim().replace(/^"|"$/g, "")),
      referencedTable: match[4],
      referencedColumns: match[5]
        .split(",")
        .map((value) => value.trim().replace(/^"|"$/g, "")),
      trailing: match[6] ?? "",
    });
  }

  return foreignKeys;
}

function normalizeColumnDefinition(line) {
  return line
    .replace(/,$/, "")
    .replace(/public\./g, "")
    .replace(/"([^"]+)"/g, "`$1`")
    .replace(/::[a-zA-Z_ ]+/g, "")
    .replace(/\bcharacter varying\((\d+)\)/gi, "VARCHAR($1)")
    .replace(/\bcharacter varying\b/gi, "VARCHAR(255)")
    .replace(/\bcharacter\((\d+)\)/gi, "CHAR($1)")
    .replace(/\bjsonb\b/gi, "JSON")
    .replace(/\bjson\b/gi, "JSON")
    .replace(/\btimestamp(?:\(\d+\))? with time zone\b/gi, "DATETIME")
    .replace(/\btimestamp(?:\(\d+\))? without time zone\b/gi, "DATETIME")
    .replace(/\btime(?:\(\d+\))? without time zone\b/gi, "TIME")
    .replace(/\bdouble precision\b/gi, "DOUBLE")
    .replace(/\bnumeric\(([^)]+)\)/gi, "DECIMAL($1)")
    .replace(/\bnumeric\b/gi, "DECIMAL(10,2)")
    .replace(/\bboolean\b/gi, "TINYINT(1)")
    .replace(/\bsmallint\b/gi, "SMALLINT")
    .replace(/\binteger\b/gi, "INT")
    .replace(/\bbigint\b/gi, "BIGINT")
    .replace(/\btext\b/gi, "TEXT")
    .replace(/\bbytea\b/gi, "LONGBLOB")
    .replace(/DEFAULT now\(\)/gi, "DEFAULT CURRENT_TIMESTAMP")
    .replace(/\bdate DEFAULT CURRENT_DATE\b/gi, "DATE")
    .replace(/\bTIME DEFAULT CURRENT_TIME\b/gi, "TIME")
    .replace(/\b(TEXT|JSON)\s+DEFAULT\s+'[^']*'/gi, "$1")
    .replace(/DEFAULT false/gi, "DEFAULT 0")
    .replace(/DEFAULT true/gi, "DEFAULT 1")
    .replace(/DEFAULT nextval\('[^']+'\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCreateTableSql(tableName, body, primaryKeys) {
  const primaryKeyColumns = primaryKeys.get(tableName) ?? [];
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !line.startsWith("CONSTRAINT") &&
        !line.startsWith("PRIMARY KEY") &&
        !line.startsWith("UNIQUE"),
    )
    .map(normalizeColumnDefinition);

  const adjustedLines = lines.map((line) => {
    const columnMatch = line.match(/^`?([a-zA-Z0-9_]+)`?\s+(INT|BIGINT|SMALLINT)\b/i);

    if (
      columnMatch &&
      primaryKeyColumns.length === 1 &&
      primaryKeyColumns[0] === columnMatch[1] &&
      /^id/i.test(columnMatch[1])
    ) {
      return line.includes("AUTO_INCREMENT")
        ? line
        : line.replace(/\bNOT NULL\b/i, "NOT NULL AUTO_INCREMENT");
    }

    return line;
  });

  const primaryKeyClause =
    primaryKeyColumns.length > 0
      ? `,
      PRIMARY KEY (${primaryKeyColumns
        .map((column) => `\`${column}\``)
        .join(", ")})`
      : "";

  return `
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      ${adjustedLines.join(",\n      ")}${primaryKeyClause}
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
}

function buildUniqueKeySql(tableName, item) {
  return `
    ALTER TABLE \`${tableName}\`
    ADD CONSTRAINT \`${item.constraintName}\`
    UNIQUE (${item.columns.map((column) => `\`${column}\``).join(", ")})
  `;
}

function buildForeignKeySql(tableName, item) {
  const deleteAction = /ON DELETE CASCADE/i.test(item.trailing)
    ? " ON DELETE CASCADE"
    : /ON DELETE SET NULL/i.test(item.trailing)
      ? " ON DELETE SET NULL"
      : "";
  const updateAction = /ON UPDATE CASCADE/i.test(item.trailing)
    ? " ON UPDATE CASCADE"
    : "";

  return `
    ALTER TABLE \`${tableName}\`
    ADD CONSTRAINT \`${item.constraintName}\`
    FOREIGN KEY (${item.columns.map((column) => `\`${column}\``).join(", ")})
    REFERENCES \`${item.referencedTable}\` (${item.referencedColumns
      .map((column) => `\`${column}\``)
      .join(", ")})${updateAction}${deleteAction}
  `;
}

async function applySql(connection, sql, ignoreErrors = []) {
  try {
    await connection.query(sql);
  } catch (error) {
    const message = String(error?.message ?? error);

    if (ignoreErrors.some((fragment) => message.includes(fragment))) {
      return;
    }

    throw error;
  }
}

async function seedOperationalData(connection) {
  await connection.query(
    `
      INSERT INTO papel (idpapel, nmpapel, dtcadastro, hrcadastro)
      VALUES
        (1, 'Gerente', CURRENT_DATE, CURRENT_TIME),
        (2, 'Funcionario', CURRENT_DATE, CURRENT_TIME),
        (3, 'Bilheteria', CURRENT_DATE, CURRENT_TIME)
      ON DUPLICATE KEY UPDATE nmpapel = VALUES(nmpapel)
    `,
  );

  await connection.query(
    `
      INSERT INTO uf (iduf, nmuf)
      VALUES ('SP', 'Sao Paulo')
      ON DUPLICATE KEY UPDATE nmuf = VALUES(nmuf)
    `,
  );

  await connection.query(
    `
      INSERT INTO cidade (idcidade, nmcidade, iduf)
      VALUES (9668, 'Sao Paulo', 'SP')
      ON DUPLICATE KEY UPDATE nmcidade = VALUES(nmcidade), iduf = VALUES(iduf)
    `,
  );

  await connection.query(
    `
      INSERT INTO informacao (idinformacao, nome, texto, status)
      VALUES (1, 'Agenda local', 'Chegue com antecedencia;Apresente seu voucher na entrada;Programacao local para validacao', 'ati')
      ON DUPLICATE KEY UPDATE nome = VALUES(nome), texto = VALUES(texto), status = VALUES(status)
    `,
  );

  await connection.query(
    `
      INSERT INTO tabpreco (
        idtabpreco,
        nmtabpreco,
        vlnormal,
        vlinfant,
        sttabpreco,
        dtcadastro,
        hrcadastro,
        vlnormalbil,
        vlinfantbil
      )
      VALUES (
        1,
        'Tabela local',
        80.00,
        60.00,
        'ativ',
        CURRENT_DATE,
        CURRENT_TIME,
        80.00,
        60.00
      )
      ON DUPLICATE KEY UPDATE
        nmtabpreco = VALUES(nmtabpreco),
        vlnormal = VALUES(vlnormal),
        vlinfant = VALUES(vlinfant),
        sttabpreco = VALUES(sttabpreco),
        vlnormalbil = VALUES(vlnormalbil),
        vlinfantbil = VALUES(vlinfantbil)
    `,
  );

  await connection.query(
    `
      INSERT INTO agenda (
        idagenda,
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
      VALUES (
        1,
        CURRENT_DATE,
        1,
        1,
        'padra',
        'abe',
        NULL,
        NULL,
        CURRENT_DATE,
        CURRENT_TIME
      )
      ON DUPLICATE KEY UPDATE
        dtagenda = VALUES(dtagenda),
        idtabpreco = VALUES(idtabpreco),
        idinformacao = VALUES(idinformacao),
        tpagenda = VALUES(tpagenda),
        stagenda = VALUES(stagenda)
    `,
  );

  await connection.query(
    `
      INSERT INTO usuario (
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
        '1990-05-10',
        'm',
        9668,
        123
      )
      ON DUPLICATE KEY UPDATE
        nmusuario = VALUES(nmusuario),
        idpapel = VALUES(idpapel),
        email = VALUES(email),
        senha = VALUES(senha),
        stusuario = VALUES(stusuario)
    `,
  );

  await connection.query(
    `
      INSERT INTO cliente_tipos (idtipo, nome)
      VALUES
        (1, 'Escola'),
        (2, 'Melhor Idade'),
        (3, 'Grupo')
      ON DUPLICATE KEY UPDATE nome = VALUES(nome)
    `,
  );

  await connection.query(
    `
      INSERT INTO clientes (idcliente, idtipo, nome, status)
      VALUES
        (1, 1, 'Escola Modelo Rincao', 1),
        (2, 2, 'Grupo Melhor Idade Rincao', 1),
        (3, 3, 'Grupo Parceiro Rincao', 1)
      ON DUPLICATE KEY UPDATE
        idtipo = VALUES(idtipo),
        nome = VALUES(nome),
        status = VALUES(status)
    `,
  );

  const [agendaExtraIdRows] = await connection.query(
    `
      SELECT COALESCE(MAX(idextra), 0) + 1 AS nextId
      FROM agenda_extras
    `,
  );
  const nextAgendaExtraId = Number(agendaExtraIdRows[0]?.nextId ?? 1);

  await connection.query(
    `
      INSERT INTO agenda_extras (
        idagenda,
        idcliente,
        aceita_familia,
        slug,
        foto,
        criado_em,
        atualizado_em,
        idextra,
        stagenda_cli
      )
      VALUES (
        1,
        1,
        1,
        'RINCAO1',
        NULL,
        NOW(),
        NOW(),
        ?,
        'abe'
      )
      ON DUPLICATE KEY UPDATE
        aceita_familia = VALUES(aceita_familia),
        slug = VALUES(slug),
        atualizado_em = VALUES(atualizado_em),
        stagenda_cli = VALUES(stagenda_cli)
    `,
    [nextAgendaExtraId],
  );

  await connection.query(
    `
      DELETE FROM agenda_faixas
      WHERE idagenda = 1
        AND idcliente = 1
    `,
  );

  await connection.query(
    `
      INSERT INTO agenda_faixas (idagenda, idade_min, idade_max, valor, idcliente)
      VALUES
        (1, 0, 5, 0.00, 1),
        (1, 6, 12, 25.00, 1),
        (1, 13, 17, 35.00, 1),
        (1, 18, 59, 50.00, 1),
        (1, 60, 120, 30.00, 1)
    `,
  );
}

async function main() {
  const schemaSql = await readFile(schemaPath, "utf8");
  const createTables = parseCreateTables(schemaSql);
  const primaryKeys = parsePrimaryKeys(schemaSql);
  const uniqueKeys = parseUniqueKeys(schemaSql);
  const foreignKeys = parseForeignKeys(schemaSql);

  const connection = await mysql.createConnection(getMysqlConfig());

  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const [tableName, body] of createTables.entries()) {
      const createSql = buildCreateTableSql(tableName, body, primaryKeys);
      await applySql(connection, createSql);
    }

    for (const [tableName, items] of uniqueKeys.entries()) {
      for (const item of items) {
        await applySql(connection, buildUniqueKeySql(tableName, item), [
          "Duplicate key name",
          "Duplicate entry",
        ]);
      }
    }

    for (const [tableName, items] of foreignKeys.entries()) {
      for (const item of items) {
        await applySql(connection, buildForeignKeySql(tableName, item), [
          "Duplicate foreign key constraint name",
          "already exists",
        ]);
      }
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    await seedOperationalData(connection);

    const [tableCountRows] = await connection.query(
      `
        SELECT COUNT(*) AS total
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
      `,
    );
    const [userRows] = await connection.query(
      "SELECT cpf, nmusuario, idpapel, stusuario FROM usuario WHERE cpf = '22181922845' LIMIT 1",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          totalTables: tableCountRows[0]?.total ?? null,
          adminUser: userRows[0] ?? null,
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("bootstrap-mysql-panel-failed");
  console.error(error);
  process.exit(1);
});
