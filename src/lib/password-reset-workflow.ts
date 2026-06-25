import { randomBytes } from "node:crypto";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { queueLegacyEmail } from "@/lib/legacy-email";
import { hashPasswordForLegacyUser } from "@/lib/password-hashing";

type PasswordResetEmailRow = {
  sent_at: string;
};

type PasswordResetTicketRow = {
  cpf: string;
  flusado: string | null;
};

type PasswordResetUser = {
  cpf: string;
  email: string | null;
  name: string | null;
};

type PasswordResetConfig = {
  throttleMinutes: number;
  maxAttempts: number;
  attemptWindowMinutes: number;
};

export type PasswordResetRequestInput = {
  lookup: string;
  origin: string;
};

export type PasswordResetRequestResult =
  | {
      blocked: true;
      message: string;
    }
  | {
      blocked: false;
      userFound: false;
    }
  | {
      blocked: false;
      userFound: true;
      email: string;
    };

export type PasswordResetModuleConfig = {
  findUser(lookup: string): Promise<PasswordResetUser | null>;
  buildResetUrl(ticket: string, origin: string): string;
  buildEmailHtml(input: {
    userName: string;
    ticket: string;
    resetUrl: string;
  }): string;
};

function getPasswordResetConfig(): PasswordResetConfig {
  return {
    throttleMinutes: Math.max(
      0,
      Number(process.env.PASSWORD_RESET_THROTTLE_MINUTES ?? 2),
    ),
    maxAttempts: Math.max(
      0,
      Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS ?? 6),
    ),
    attemptWindowMinutes: Math.max(
      0,
      Number(process.env.PASSWORD_RESET_ATTEMPT_WINDOW_MINUTES ?? 360),
    ),
  };
}

function buildResetSubject() {
  return "Estancia - Recuperacao de Senha";
}

function generateResetTicket() {
  return randomBytes(18).toString("base64url");
}

async function checkPasswordResetThrottle(email: string) {
  const config = getPasswordResetConfig();

  if (
    !email ||
    (config.throttleMinutes === 0 &&
      (config.maxAttempts === 0 || config.attemptWindowMinutes === 0))
  ) {
    return {
      blocked: false as const,
    };
  }

  const now = Date.now();
  const windowStart = new Date(
    now - config.attemptWindowMinutes * 60 * 1000,
  ).toISOString();
  const result = await getIngressoDbPool().query<PasswordResetEmailRow>(
    `
      SELECT (dtemail::timestamp + hremail) AS sent_at
      FROM email
      WHERE para = $1
        AND assunto ILIKE $2
        AND (dtemail::timestamp + hremail) >= $3::timestamp
      ORDER BY dtemail DESC, hremail DESC
      LIMIT $4
    `,
    [
      email.trim(),
      "Clube Rinc%Senha%",
      windowStart,
      Math.max(10, config.maxAttempts + 5),
    ],
  );

  const attempts = result.rows
    .map((row) => new Date(row.sent_at).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left);
  const lastTs = attempts[0] ?? null;

  if (config.throttleMinutes > 0 && lastTs !== null) {
    const elapsed = now - lastTs;

    if (elapsed < config.throttleMinutes * 60 * 1000) {
      return {
        blocked: true as const,
        message: `Ja enviamos um link recentemente. Aguarde ${Math.max(
          1,
          Math.ceil((config.throttleMinutes * 60 * 1000 - elapsed) / 60000),
        )} min e tente novamente.`,
      };
    }
  }

  if (
    config.maxAttempts > 0 &&
    config.attemptWindowMinutes > 0 &&
    attempts.length >= config.maxAttempts
  ) {
    const oldestWindowTs = attempts[attempts.length - 1] ?? now;
    const waitMinutes = Math.max(
      1,
      Math.ceil(
        Math.max(
          0,
          oldestWindowTs + config.attemptWindowMinutes * 60 * 1000 - now,
        ) / 60000,
      ),
    );

    return {
      blocked: true as const,
      message: `Limite de tentativas atingido. Aguarde ${waitMinutes} min e tente novamente.`,
    };
  }

  return {
    blocked: false as const,
  };
}

export async function requestPasswordReset(
  config: PasswordResetModuleConfig,
  input: PasswordResetRequestInput,
): Promise<PasswordResetRequestResult> {
  const user = await config.findUser(input.lookup);
  const email = user?.email?.trim().toLowerCase() ?? "";
  const throttle = await checkPasswordResetThrottle(email);

  if (throttle.blocked) {
    return throttle;
  }

  if (!user?.cpf || !email) {
    return {
      blocked: false,
      userFound: false,
    };
  }

  const ticket = generateResetTicket();
  await getIngressoDbPool().query(
    `
      INSERT INTO trocasenha (flusado, cpf, ticket)
      VALUES ('n', $1, $2)
    `,
    [user.cpf, ticket],
  );

  const resetUrl = config.buildResetUrl(ticket, input.origin);
  await queueLegacyEmail({
    to: email,
    toName: user.name ?? null,
    subject: buildResetSubject(),
    html: config.buildEmailHtml({
      userName: user.name?.trim() || "Cliente",
      ticket,
      resetUrl,
    }),
  });

  return {
    blocked: false,
    userFound: true,
    email,
  };
}

export async function getPasswordResetTicket(ticket: string) {
  const result = await getIngressoDbPool().query<PasswordResetTicketRow>(
    `
      SELECT cpf, flusado
      FROM trocasenha
      WHERE ticket = $1
      LIMIT 1
    `,
    [ticket.trim()],
  );
  const row = result.rows[0];

  return {
    exists: Boolean(row),
    valid: Boolean(row?.cpf && row.flusado === "n"),
    cpf: row?.cpf ?? null,
  };
}

export async function resetPasswordByTicket(input: {
  ticket: string;
  password: string;
}) {
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const ticketResult = await client.query<PasswordResetTicketRow>(
      `
        SELECT cpf, flusado
        FROM trocasenha
        WHERE ticket = $1
        LIMIT 1
        FOR UPDATE
      `,
      [input.ticket.trim()],
    );
    const ticketRow = ticketResult.rows[0];

    if (!ticketRow?.cpf || ticketRow.flusado !== "n") {
      await client.query("ROLLBACK");

      return {
        ok: false as const,
        code: "invalid_ticket",
      };
    }

    await client.query(
      `
        UPDATE trocasenha
        SET flusado = 's',
            dtuso = CURRENT_DATE
        WHERE ticket = $1
      `,
      [input.ticket.trim()],
    );
    await client.query(
      `
        UPDATE usuario
        SET senha = $1
        WHERE cpf = $2
      `,
      [hashPasswordForLegacyUser(input.password), ticketRow.cpf],
    );
    await client.query("COMMIT");

    return {
      ok: true as const,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
