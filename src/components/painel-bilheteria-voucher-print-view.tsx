import type { PainelBilheteriaVoucherPrintModel } from "@/lib/painel-bilheteria";
import { PainelBilheteriaPrintTicket } from "@/components/painel-bilheteria-print-ticket";

type Props = {
  model: PainelBilheteriaVoucherPrintModel;
};

export function PainelBilheteriaVoucherPrintView({ model }: Props) {
  return <PainelBilheteriaPrintTicket vouchers={[model]} />;
}
