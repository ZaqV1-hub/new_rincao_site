import {
  getPainelPasswordResetTicket,
  resetPainelPassword,
} from "@/lib/painel-password-reset";
import {
  createPasswordResetTicketRouteHandlers,
} from "@/lib/password-reset-ticket-route";

export const runtime = "nodejs";

export const { GET, POST } = createPasswordResetTicketRouteHandlers({
  readTicket: getPainelPasswordResetTicket,
  resetPassword: resetPainelPassword,
  logKey: "painel-password-reset-ticket-bff-failed",
});
