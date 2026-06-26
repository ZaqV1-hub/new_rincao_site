import Image from "next/image";
import Link from "next/link";

type PainelBrandLogoProps = {
  href?: string | null;
  className?: string;
  compact?: boolean;
  light?: boolean;
  stacked?: boolean;
};

export function PainelBrandLogo({
  href = "/painel",
  className = "",
  compact = false,
  stacked = false,
}: PainelBrandLogoProps) {
  const width = stacked ? 160 : compact ? 220 : 320;
  const height = stacked ? 160 : compact ? 72 : 104;
  const classes = `inline-flex items-center justify-center overflow-hidden ${className}`.trim();
  const image = (
    <Image
      src="/brand/rincao-logo.png"
      alt={"Clube de Campo Rinc\u00e3o"}
      width={width}
      height={height}
      priority={compact}
      className="block h-full w-full object-contain object-center"
    />
  );

  if (!href) {
    return (
      <span className={classes} aria-label={"Clube de Campo Rinc\u00e3o"}>
        {image}
      </span>
    );
  }

  return (
    <Link href={href} className={classes} aria-label={"Clube de Campo Rinc\u00e3o"}>
      {image}
    </Link>
  );
}
