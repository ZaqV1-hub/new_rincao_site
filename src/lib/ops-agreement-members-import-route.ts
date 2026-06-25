import {
  opsErrorResponse,
  opsOkResponse,
  readJsonPayload,
  readRouteActor,
  readStringOrEmpty,
} from "@/lib/ops-route-utils";

type ImportPayload = {
  csvText?: unknown;
  reason?: unknown;
  actor?: {
    name?: unknown;
    cpf?: unknown;
  } | null;
};

type OperationError = {
  code: string;
  message: string;
  status: number;
};

export async function handleAgreementMembersImportRoute<TData>({
  request,
  agreementId,
  runImport,
  asError,
  logKey,
}: {
  request: Request;
  agreementId: string;
  runImport: (input: {
    agreementId: string;
    csvText: string;
    reason: string;
    actor: {
      name: string | null;
      cpf: string | null;
    };
  }) => Promise<TData>;
  asError: (error: unknown) => OperationError;
  logKey: string;
}) {
  const payload = await readJsonPayload<ImportPayload>(request);

  try {
    const data = await runImport({
      agreementId,
      csvText: readStringOrEmpty(payload?.csvText),
      reason: readStringOrEmpty(payload?.reason),
      actor: readRouteActor(payload?.actor),
    });

    return opsOkResponse(data);
  } catch (error) {
    const operationError = asError(error);

    console.error(logKey, error);

    return opsErrorResponse(
      operationError.code,
      operationError.message,
      operationError.status,
    );
  }
}
