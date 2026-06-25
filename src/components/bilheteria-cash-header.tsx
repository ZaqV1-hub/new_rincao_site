import Link from "next/link";
import { formatBilheteriaCashDateLong } from "@/lib/bilheteria-cash-view-model";

type Action = {
  href: string;
  label: string;
};

type Props = {
  actorName?: string | null;
  primaryActions: Action[];
  secondaryActions?: Action[];
};

export function BilheteriaCashHeader({
  primaryActions,
  secondaryActions = [],
}: Props) {
  return (
    <header className="panel-section flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="panel-eyebrow">Bilheteria</p>
        <h2 className="text-[24px] font-black capitalize leading-tight text-[#17351f]">
          {formatBilheteriaCashDateLong()}
        </h2>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {[...secondaryActions, ...primaryActions].map((action, index) => (
          <Link
            key={`${action.href}-${action.label}`}
            href={action.href}
            className={index >= secondaryActions.length ? "panel-button" : "panel-button-secondary"}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
