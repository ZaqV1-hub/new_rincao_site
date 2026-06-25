import type { PainelBilheteriaPurchasePrintModel } from "@/lib/painel-bilheteria";
import { PainelBilheteriaPrintTicket } from "@/components/painel-bilheteria-print-ticket";

type Props = {
  model: PainelBilheteriaPurchasePrintModel;
};

export function PainelBilheteriaPurchasePrintView({ model }: Props) {
  return <PainelBilheteriaPrintTicket vouchers={model.vouchers} />;
}
