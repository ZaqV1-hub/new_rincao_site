import {
  getCustomerPasswordResetTicket,
  resetCustomerPassword,
} from "@/lib/customer-password-reset";
import {
  createPasswordResetTicketRouteHandlers,
} from "@/lib/password-reset-ticket-route";

export const runtime = "nodejs";

export const { GET, POST } = createPasswordResetTicketRouteHandlers({
  readTicket: getCustomerPasswordResetTicket,
  resetPassword: resetCustomerPassword,
  logKey: "customer-password-reset-ticket-bff-failed",
});
