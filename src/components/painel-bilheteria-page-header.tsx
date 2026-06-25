import Link from "next/link";
import {
  type LegacyPanelActionContract,
  getLegacyPanelContract,
  type LegacyPanelScreenContract,
} from "@/lib/legacy-panel-contracts";

type Props = {
  title: string;
  description: string;
  current?:
    | "overview"
    | "indicators"
    | "reservations"
    | "history"
    | "sales"
    | "finalize"
    | "reservation-payment"
    | "cash-fund"
    | "cash-closure"
    | "cash-closure-history"
    | "cash-closure-edits";
  screen?: LegacyPanelScreenContract["screenId"];
  isManager: boolean;
  actorName?: string | null;
};

function getCurrentDateLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function resolveScreenId(props: Props) {
  if (props.screen) {
    return props.screen;
  }

  switch (props.current) {
    case "history":
      return "bilheteria-history";
    case "sales":
      return "bilheteria-sales";
    case "finalize":
      return "bilheteria-finalize";
    case "reservation-payment":
      return "bilheteria-reservation-payment";
    case "cash-fund":
      return "bilheteria-cash-fund";
    case "cash-closure":
      return "bilheteria-cash-closure";
    case "cash-closure-history":
      return "bilheteria-cash-closure-history";
    case "cash-closure-edits":
      return "bilheteria-cash-closure-edits";
    default:
      return "bilheteria-index";
  }
}

function resolveActiveKeys(screen: LegacyPanelScreenContract["screenId"]) {
  switch (screen) {
    case "bilheteria-index":
      return ["ticket-lookup"];
    case "bilheteria-sales":
      return ["sales"];
    case "bilheteria-history":
      return ["history", "back-to-workstation"];
    case "bilheteria-cash-fund":
      return ["cash-fund"];
    case "bilheteria-cash-closure":
      return ["cash-closure"];
    case "bilheteria-cash-closure-history":
      return ["cash-closure-history", "cash-closure"];
    case "bilheteria-cash-closure-edits":
      return ["cash-closure-edits", "cash-closure"];
    default:
      return [];
  }
}

function actionClasses(active: boolean) {
  return active
    ? "border-[#1f7a3d] bg-[#23823f] text-white"
    : "border-[#d9e4d3] bg-white text-[#17351f] hover:bg-[#f7fbf5]";
}

function ActionIcon({ actionKey }: { actionKey?: string }) {
  const className = "h-[22px] w-[22px] shrink-0";

  switch (actionKey) {
    case "ticket-lookup":
    case "back-to-workstation":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M7 7.5h10a2 2 0 0 1 2 2v1.5a2 2 0 0 0-2 2 2 2 0 0 0 2 2V16.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V15a2 2 0 0 0 0-4V9.5a2 2 0 0 1 2-2Z" />
          <path d="M9.5 10h5M9.5 14h5" />
        </svg>
      );
    case "sales":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M5 18V10M12 18V6M19 18V13" />
          <path d="M3 18h18" />
        </svg>
      );
    case "cash-closure":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M5 7h14v11H5z" />
          <path d="M8 7V5h8v2M8 12h8M8 15h3" />
        </svg>
      );
    case "cash-fund":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M4 7.5h16v10H4z" />
          <path d="M15 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7 10h.01M17 14h.01" />
        </svg>
      );
    case "history":
    case "cash-closure-history":
    case "cash-closure-edits":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M4 12a8 8 0 1 0 3-6.24" />
          <path d="M4 4v4h4M12 8v5l3 2" />
        </svg>
      );
    default:
      return null;
  }
}

function ActionLink({
  action,
  active,
}: {
  action: LegacyPanelActionContract;
  active: boolean;
}) {
  return (
    <Link
      href={action.href}
      className={`inline-flex min-h-[56px] items-center gap-3 rounded-[6px] border px-5 py-3 text-sm font-bold shadow-[0_8px_22px_rgba(24,67,34,0.05)] transition ${actionClasses(active)}`}
    >
      <ActionIcon actionKey={action.key} />
      <span>{action.label}</span>
    </Link>
  );
}

export function PainelBilheteriaPageHeader({
  title,
  description,
  current,
  screen,
  isManager,
}: Props) {
  const screenId = resolveScreenId({
    title,
    description,
    current,
    screen,
    isManager,
  });
  const actions = (getLegacyPanelContract(screenId)?.header.actions ?? []).filter(
    (action) =>
      (!action.managerOnly || isManager) && action.key !== "back-to-panel",
  );
  const activeKeys = new Set(resolveActiveKeys(screenId));
  const primaryActions = actions.filter((action) =>
    [
      "sales",
      "cash-closure",
      "cash-fund",
      "history",
      "cash-closure-history",
      "cash-closure-edits",
    ].includes(action.key ?? ""),
  );
  const secondaryActions = actions.filter(
    (action) => !primaryActions.some((item) => item.key === action.key),
  );

  return (
    <header className="panel-section flex flex-wrap items-center justify-between gap-4 px-7 py-6">
      <div>
        <p className="panel-eyebrow">Bilheteria</p>
        <h1 className="mt-2 text-[28px] font-black capitalize leading-tight text-[#17351f]">
          {title === "Bilheteria" ? getCurrentDateLabel() : title}
        </h1>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4">
        {[...secondaryActions, ...primaryActions].map((action) => (
          <ActionLink
            key={action.key ?? action.href}
            action={action}
            active={activeKeys.has(action.key ?? "")}
          />
        ))}
      </div>
    </header>
  );
}
