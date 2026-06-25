import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  getPasswordResetTicket,
  requestPasswordReset,
  resetPasswordByTicket,
} from "@/lib/password-reset-workflow";
import { sanitizeCpf } from "@/lib/user-repository";

type PublicUserByCpfRow = {
  cpf: string;
  nmusuario: string;
  email: string | null;
};

function buildResetEmailHtml(input: {
  userName: string;
  ticket: string;
  resetUrl: string;
}) {
  return `
    <h2>Recuperacao de Senha</h2>
    <p>Ola ${input.userName}, foi solicitada uma recuperacao de senha para acesso a area do cliente do Estancia.</p>
    <p>Seu ticket para mudanca de senha e: <strong>${input.ticket}</strong>.</p>
    <p>Para alterar sua senha, acesse: <a href="${input.resetUrl}">${input.resetUrl}</a></p>
  `;
}

async function findPublicUserByCpf(cpf: string) {
  const result = await getIngressoDbPool().query<PublicUserByCpfRow>(
    `
      SELECT cpf, nmusuario, email
      FROM usuario
      WHERE cpf = $1
      LIMIT 1
    `,
    [sanitizeCpf(cpf)],
  );

  return result.rows[0] ?? null;
}

export async function requestCustomerPasswordReset(input: {
  cpf: string;
  origin: string;
}) {
  return requestPasswordReset(
    {
      async findUser(cpf) {
        const user = await findPublicUserByCpf(cpf);

        return user
          ? {
              cpf: user.cpf,
              email: user.email,
              name: user.nmusuario,
            }
          : null;
      },
      buildResetUrl(ticket, origin) {
        return new URL(`/login/trocar-senha/ticket/${ticket}`, origin).toString();
      },
      buildEmailHtml: buildResetEmailHtml,
    },
    {
      lookup: input.cpf,
      origin: input.origin,
    },
  );
}

export async function getCustomerPasswordResetTicket(ticket: string) {
  return getPasswordResetTicket(ticket);
}

export async function resetCustomerPassword(input: {
  ticket: string;
  password: string;
}) {
  return resetPasswordByTicket(input);
}
