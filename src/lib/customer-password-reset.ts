import {
  getPasswordResetTicket,
  requestPasswordReset,
  resetPasswordByTicket,
} from "@/lib/password-reset-workflow";
import { findPublicUserByCpf } from "@/lib/user-repository";

function buildResetEmailHtml(input: {
  userName: string;
  ticket: string;
  resetUrl: string;
}) {
  return `
    <h2>Recuperacao de Senha</h2>
    <p>Ola ${input.userName}, foi solicitada uma recuperacao de senha para acesso a area do cliente do Rincao.</p>
    <p>Seu ticket para mudanca de senha e: <strong>${input.ticket}</strong>.</p>
    <p>Para alterar sua senha, acesse: <a href="${input.resetUrl}">${input.resetUrl}</a></p>
  `;
}

export async function requestCustomerPasswordReset(input: {
  cpf: string;
  origin: string;
}) {
  return requestPasswordReset(
    {
      audience: "public",
      async findUser(cpf) {
        const user = await findPublicUserByCpf(cpf);

        return user
          ? {
              cpf: user.cpf,
              email: user.email,
              name: user.name,
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
  return getPasswordResetTicket(ticket, "public");
}

export async function resetCustomerPassword(input: {
  ticket: string;
  password: string;
}) {
  return resetPasswordByTicket(input, "public");
}
