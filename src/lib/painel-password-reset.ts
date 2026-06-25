import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  getPasswordResetTicket,
  requestPasswordReset,
  resetPasswordByTicket,
} from "@/lib/password-reset-workflow";

type PanelUserByEmailRow = {
  cpf: string;
  nmusuario: string;
  email: string | null;
  idpapel: number | null;
};

function buildResetEmailHtml(input: {
  userName: string;
  ticket: string;
  resetUrl: string;
}) {
  return `
    <h2>Recuperacao de Senha</h2>
    <p>Ola ${input.userName}, foi solicitado em seu e-mail uma recuperacao de senha para acesso ao painel do Estancia.</p>
    <p>Seu ticket para mudanca de senha e: <strong>${input.ticket}</strong>.</p>
    <p>Para alterar sua senha, acesse: <a href="${input.resetUrl}">${input.resetUrl}</a></p>
  `;
}

async function findPanelUserByEmail(email: string) {
  const result = await getIngressoDbPool().query<PanelUserByEmailRow>(
    `
      SELECT cpf, nmusuario, email, idpapel
      FROM usuario
      WHERE LOWER(email) = LOWER($1)
        AND idpapel IS NOT NULL
      LIMIT 1
    `,
    [email.trim()],
  );

  return result.rows[0] ?? null;
}

export async function requestPainelPasswordReset(input: {
  email: string;
  origin: string;
}) {
  return requestPasswordReset(
    {
      async findUser(email) {
        const user = await findPanelUserByEmail(email.trim().toLowerCase());

        return user
          ? {
              cpf: user.cpf,
              email: user.email,
              name: user.nmusuario,
            }
          : null;
      },
      buildResetUrl(ticket, origin) {
        return new URL(`/painel/login/trocar-senha/ticket/${ticket}`, origin).toString();
      },
      buildEmailHtml: buildResetEmailHtml,
    },
    {
      lookup: input.email,
      origin: input.origin,
    },
  );
}

export async function getPainelPasswordResetTicket(ticket: string) {
  return getPasswordResetTicket(ticket);
}

export async function resetPainelPassword(input: {
  ticket: string;
  password: string;
}) {
  return resetPasswordByTicket(input);
}
