import { runOpsVoucherOperationRoute } from "@/lib/ops-voucher-route";
export const runtime = "nodejs";
export function POST(request: Request) { return runOpsVoucherOperationRoute(request, "invalidate"); }
