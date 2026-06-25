"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { IngressoShell } from "@/components/ingresso-shell";
import type { AuthUser } from "@/lib/auth-contracts";
import type {
  CreateReservationResponse,
  ReservationAgendaDetail,
} from "@/lib/reservation-contracts";

type ReservationPageProps = {
  agenda: ReservationAgendaDetail;
  user: AuthUser;
};

type Quantities = {
  normal: number;
  child: number;
  exempt: number;
};

function formatPrice(value: string | null) {
  if (!value) {
    return "0,00";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "0,00";
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatFullDate(agenda: ReservationAgendaDetail) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
  }).format(new Date(`${agenda.date}T12:00:00`));
}

async function readResponseBody<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function parseQuantity(value: string) {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}

export function ReservationPage({ agenda, user }: ReservationPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [quantities, setQuantities] = useState<Quantities>({
    normal: 0,
    child: 0,
    exempt: 0,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalPrice = Number(agenda.priceTable.gateNormal ?? 0);
  const childPrice = Number(agenda.priceTable.gateChild ?? 0);
  const totalTickets =
    quantities.normal + quantities.child + quantities.exempt;
  const totalValue = quantities.normal * normalPrice + quantities.child * childPrice;

  function updateQuantity(key: keyof Quantities, value: string) {
    setQuantities((current) => ({
      ...current,
      [key]: parseQuantity(value),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (totalTickets <= 0) {
      setError("Selecione pelo menos um ingresso para reservar.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/me/reservations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agendaId: agenda.id,
          quantities,
        }),
      });
      const payload = await readResponseBody<
        | CreateReservationResponse
        | {
            ok: false;
            error: {
              message: string;
            };
          }
      >(response);

      if (response.status === 401) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      if (!response.ok || !payload?.ok) {
        setError(
          payload && !payload.ok
            ? payload.error.message
            : "Nao foi possivel concluir a reserva agora.",
        );
        return;
      }

      router.replace("/meus-ingressos");
      router.refresh();
    } catch (requestError) {
      console.error("reservation-submit-failed", requestError);
      setError("Nao foi possivel concluir a reserva agora.");
    } finally {
      setPending(false);
    }
  }

  return (
    <IngressoShell active="schedule" user={user}>
      <div className="mx-auto grid w-full max-w-[1180px] gap-6 px-4 pt-8 md:px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[30px] bg-[linear-gradient(145deg,#205f86,#174867)] p-7 text-left text-white shadow-[0_24px_55px_rgba(20,62,91,0.18)]">
          <p className="legacy-rounded text-[12px] uppercase tracking-[0.28em] text-white/72">
            Pagamento no parque
          </p>
          <h1 className="legacy-rounded mt-3 text-[28px] leading-[1.15]">
            {formatFullDate(agenda)}
          </h1>
          <p className="mt-4 text-sm leading-7 text-white/88">
            Essa reserva cria os vouchers na sua conta para apresentacao no dia
            da visita. O pagamento continua sendo feito presencialmente na
            entrada do parque.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur">
              <h2 className="legacy-rounded text-[16px] text-white">Passaporte</h2>
              <p className="mt-2 text-sm leading-6 text-white/82">
                {formatCurrency(normalPrice)} por pessoa a partir de 10 anos.
              </p>
            </article>
            <article className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur">
              <h2 className="legacy-rounded text-[16px] text-white">Passaporte Infantil</h2>
              <p className="mt-2 text-sm leading-6 text-white/82">
                {formatCurrency(childPrice)} por pessoa de 4 a 9 anos.
              </p>
            </article>
            <article className="rounded-[22px] border border-white/12 bg-white/10 p-4 backdrop-blur">
              <h2 className="legacy-rounded text-[16px] text-white">Isento</h2>
              <p className="mt-2 text-sm leading-6 text-white/82">
                Criancas de 0 a 3 anos entram sem custo.
              </p>
            </article>
          </div>

          {agenda.promotional.description ? (
            <div className="mt-6 rounded-[22px] border border-white/12 bg-white/10 p-5 text-sm leading-7 text-white/86">
              {agenda.promotional.description}
            </div>
          ) : null}

          {agenda.information.length ? (
            <div className="mt-6 rounded-[22px] border border-dashed border-white/20 bg-[#123a54]/55 p-5">
              <p className="legacy-rounded text-[16px] text-white">
                Informacoes da data
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/82">
                {agenda.information.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-[30px] border border-[#d8e6f0] bg-white p-7 text-left shadow-[0_18px_48px_rgba(17,66,97,0.11)]">
          <h2 className="legacy-rounded text-[27px] leading-tight text-[#1c5a80]">
            Quantidade de visitantes
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#4d6477]">
            Escolha quantas pessoas vao visitar o parque nessa data. A reserva
            fica disponivel logo em seguida em Meus Ingressos.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {[
              {
                key: "normal" as const,
                label: "Passaporte",
                price: formatPrice(agenda.priceTable.gateNormal),
              },
              {
                key: "child" as const,
                label: "Passaporte Infantil",
                price: formatPrice(agenda.priceTable.gateChild),
              },
              {
                key: "exempt" as const,
                label: "De 0 a 3 anos",
                price: "0,00",
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-4 rounded-[22px] border border-[#d9e5ee] bg-[#f8fbfe] px-4 py-4"
              >
                <span className="min-w-0">
                  <span className="legacy-rounded block text-[15px] text-[#1c5a80]">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-sm text-[#60768a]">
                    R$ {item.price}
                  </span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={quantities[item.key]}
                  onChange={(event) => updateQuantity(item.key, event.target.value)}
                  className="w-24 rounded-[16px] border border-[#c9d7e3] bg-white px-3 py-2 text-right text-[15px] text-[#214d6b] outline-none transition focus:border-[#3498db] focus:ring-2 focus:ring-[#d2ecfb]"
                />
              </label>
            ))}

            <div className="rounded-[24px] bg-[#eef7fc] p-5 text-[#33556d]">
              <div className="flex items-center justify-between gap-4 text-sm leading-6">
                <span>Total de visitantes</span>
                <strong className="legacy-rounded text-[18px] text-[#1c5a80]">
                  {totalTickets}
                </strong>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4 text-sm leading-6">
                <span>Total para pagar no parque</span>
                <strong className="legacy-rounded text-[18px] text-[#1c5a80]">
                  {formatCurrency(totalValue)}
                </strong>
              </div>
            </div>

            {error ? (
              <div className="rounded-[20px] border border-[#efc3c3] bg-[#fff3f1] px-4 py-3 text-sm text-[#9f3f36]">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={pending}
                className="legacy-rounded inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[999px] bg-[#3498db] px-5 py-3 text-[15px] text-white shadow-[0_12px_25px_rgba(52,152,219,0.24)] hover:bg-[#246b99] disabled:cursor-not-allowed disabled:bg-[#8abfe7]"
              >
                {pending ? "Confirmando..." : "Confirmar reserva"}
              </button>
              <Link
                href="/agenda"
                className="legacy-rounded inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[999px] border border-[#c9d7e3] px-5 py-3 text-[15px] text-[#2b5976] transition hover:border-[#3498db] hover:text-[#1c5a80]"
              >
                Voltar para agenda
              </Link>
            </div>
          </form>
        </div>
      </div>
    </IngressoShell>
  );
}
