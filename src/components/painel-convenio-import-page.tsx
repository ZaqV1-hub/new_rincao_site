"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { PainelConvenioImportStage } from "@/lib/painel-convenio-import";

type PainelConvenioImportPageProps = {
  agreementId: number;
  agreementName: string;
  completed: boolean;
  initialStage: PainelConvenioImportStage | null;
};

function buildImportHref(agreementId: number, importId: string | null) {
  const base = `/painel/convenios/${agreementId}/importacao`;
  if (!importId) {
    return base;
  }

  const params = new URLSearchParams();
  params.set("importId", importId);
  return `${base}?${params.toString()}`;
}

export function PainelConvenioImportPage({
  agreementId,
  agreementName,
  completed,
  initialStage,
}: PainelConvenioImportPageProps) {
  const router = useRouter();
  const [stage, setStage] = useState<PainelConvenioImportStage | null>(initialStage);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(
    completed
      ? {
          tone: "success",
          message: "Importacao finalizada com sucesso.",
        }
      : null,
  );
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const logDownloadHref = useMemo(() => {
    if (!stage?.importId) {
      return null;
    }
    return `/api/painel/convenios/${agreementId}/importacao/log?importId=${encodeURIComponent(
      stage.importId,
    )}`;
  }, [agreementId, stage?.importId]);

  async function handleUpload(formData: FormData) {
    setFeedback(null);

    const file = formData.get("qqfile");
    if (!(file instanceof File) || file.size <= 0) {
      setFeedback({
        tone: "error",
        message: "Selecione um arquivo CSV para importar.",
      });
      return;
    }

    const payload = new FormData();
    payload.set("qqfile", file);

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/painel/convenios/${agreementId}/importacao/upload`,
          {
            method: "POST",
            body: payload,
            credentials: "same-origin",
          },
        );

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: { stage?: PainelConvenioImportStage; message?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !result?.ok || !result.data?.stage) {
          throw new Error(
            result?.error?.message || "Falha ao validar a importacao.",
          );
        }

        setStage(result.data.stage);
        setFeedback({
          tone: "success",
          message: result.data.message || "Leitura do Arquivo CSV finalizada.",
        });
        router.replace(buildImportHref(agreementId, result.data.stage.importId));
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao validar a importacao.",
        });
      }
    });
  }

  async function handleApply() {
    if (!stage?.importId) {
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/painel/convenios/${agreementId}/importacao/aplicar`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ importId: stage.importId }),
          },
        );

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: { message?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.error?.message || "Falha ao aplicar a importacao.",
          );
        }

        setStage(null);
        setFeedback({
          tone: "success",
          message: result.data?.message || "Importacao finalizada com sucesso.",
        });
        router.replace(`/painel/convenios/${agreementId}/importacao?c=sim`);
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao aplicar a importacao.",
        });
      }
    });
  }

  async function handleCancel() {
    if (!stage?.importId) {
      router.push(`/painel/convenios/${agreementId}/conveniados`);
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/painel/convenios/${agreementId}/importacao/cancelar`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ importId: stage.importId }),
          },
        );

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: { message?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.error?.message || "Falha ao cancelar a importacao.",
          );
        }

        router.push(`/painel/convenios/${agreementId}/conveniados`);
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Falha ao cancelar a importacao.",
        });
      }
    });
  }

  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link
            className="text-[#1d68a2] underline"
            href={`/painel/convenios/${agreementId}`}
          >
            {agreementName}
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link
            className="text-[#1d68a2] underline"
            href={`/painel/convenios/${agreementId}/conveniados`}
          >
            Lista de conveniados
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>Importar</span>
        </div>

        <h1 className="mt-6 text-[34px] font-semibold text-[#205a7f]">{agreementName}</h1>

        {feedback ? (
          <div
            className={`mt-6 border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-[#b7dfc0] bg-[#edf8f0] text-[#245336]"
                : "border-[#efc0c0] bg-[#fff0f0] text-[#7a2b2b]"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        {completed && !stage ? (
          <div className="mt-6 rounded-[4px] border border-[#d7d7d7] bg-[#fdfdfd] px-5 py-5">
            <p className="text-[15px] text-[#505050]">
              A importacao dos conveniados foi concluida com sucesso.
            </p>
            <p className="mt-4">
              <Link
                className="text-[#1d68a2] underline"
                href={`/painel/convenios/${agreementId}/conveniados`}
              >
                Voltar
              </Link>
            </p>
          </div>
        ) : stage ? (
          <>
            <div className="mt-6 rounded-[4px] border border-[#d7d7d7] bg-[#fbfbfb] px-5 py-5">
              <h2 className="text-[22px] font-semibold text-[#205a7f]">
                Leitura do Arquivo CSV finalizada.
              </h2>
              <p className="mt-3 text-[16px] text-[#505050]">
                Total de <strong>{stage.preview.totalRows}</strong>{" "}
                {stage.preview.totalRows === 1
                  ? "registro encontrado."
                  : "registros encontrados."}
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="border border-[#d7d7d7] bg-white px-4 py-3 text-sm text-[#505050]">
                  <strong>{stage.preview.validRows}</strong>
                  <div>Registros validos</div>
                </div>
                <div className="border border-[#d7d7d7] bg-white px-4 py-3 text-sm text-[#505050]">
                  <strong>{stage.preview.invalidRows}</strong>
                  <div>Registros com problema</div>
                </div>
                <div className="border border-[#d7d7d7] bg-white px-4 py-3 text-sm text-[#505050]">
                  <strong>{stage.preview.rows.length}</strong>
                  <div>Linhas analisadas</div>
                </div>
              </div>

              {stage.preview.invalidRows > 0 && logDownloadHref ? (
                <div className="mt-5 rounded-[4px] border border-[#f0d4a7] bg-[#fff9ec] px-4 py-4 text-sm text-[#6b5532]">
                  <p>
                    <strong>{stage.preview.invalidRows} registros apresentaram problema.</strong>
                    <br />
                    Clique no link abaixo para fazer o download do log de erros.
                  </p>
                  <a
                    className="mt-3 inline-flex text-[#1d68a2] underline"
                    href={logDownloadHref}
                  >
                    Download
                  </a>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="inline-flex items-center justify-center border border-[#c8c8c8] bg-white px-6 py-3 text-sm font-semibold text-[#4a4a4a] hover:bg-[#f3f3f3] disabled:opacity-60"
                disabled={isPending}
                onClick={handleCancel}
                type="button"
              >
                Cancelar Importacao
              </button>
              <button
                className="inline-flex items-center justify-center bg-[#4aa329] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3c8721] disabled:opacity-60"
                disabled={isPending}
                onClick={handleApply}
                type="button"
              >
                Continuar Importacao
              </button>
            </div>
          </>
        ) : (
          <form action={handleUpload} className="mt-6 rounded-[4px] border border-[#d7d7d7] bg-[#fbfbfb] px-5 py-6">
            <h2 className="text-[22px] font-semibold text-[#205a7f]">Importar Candidatos</h2>

            <div className="mt-5">
              <span className="block text-sm font-semibold text-[#5a5a5a]">
                Selecione o arquivo para importacao
              </span>
              <input
                className="mt-2 block w-full max-w-[520px] border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-[#444]"
                name="qqfile"
                onChange={(event) => {
                  setSelectedFileName(event.currentTarget.files?.[0]?.name ?? "");
                }}
                type="file"
              />
            </div>

            {selectedFileName ? (
              <div className="mt-4 text-sm text-[#505050]">
                <strong>Arquivo selecionado:</strong> {selectedFileName}
              </div>
            ) : null}

            <div className="mt-6">
              <button
                className="inline-flex items-center justify-center bg-[#4aa329] px-6 py-3 text-sm font-semibold text-white hover:bg-[#3c8721] disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                Importar
              </button>
            </div>
          </form>
        )}
      </div>

      <aside className="self-start rounded-[6px] border border-[#d7d7d7] bg-[#f6f7f8] p-4 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6f7f8d]">
          Conveniado
        </h2>
        <ul className="mt-3 space-y-3 text-[15px]">
          <li>
            <Link
              className="text-[#1d68a2] underline"
              href="/api/painel/convenios/importacao/modelo"
            >
              Modelo de arquivo (CSV)
            </Link>
          </li>
        </ul>
      </aside>
    </section>
  );
}
