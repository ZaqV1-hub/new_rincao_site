import Image from "next/image";
import Link from "next/link";

type RincaoLogoProps = {
  href?: string | null;
  className?: string;
  compact?: boolean;
  light?: boolean;
  stacked?: boolean;
};

export function RincaoLogo({
  href = "/",
  className = "",
  compact = false,
  light = false,
  stacked = false,
}: RincaoLogoProps) {
  const width = stacked ? 220 : compact ? 260 : 500;
  const height = stacked ? 260 : compact ? 76 : 146;
  const classes = `inline-flex items-center ${className}`.trim();
  const src = stacked
    ? "/brand/rincao-logo-white-stacked.png"
    : light
      ? "/brand/rincao-logo-white.png"
      : "/brand/rincao-logo-dark.png";
  const label = "Estância e Parque Ecológico das Águas";
  const image = (
    <Image
      src={src}
      alt={label}
      width={width}
      height={height}
      priority={compact}
      className="h-auto max-w-full object-contain"
      style={{ width: "auto", height: "auto" }}
    />
  );

  if (!href) {
    return (
      <span className={classes} aria-label={label}>
        {image}
      </span>
    );
  }

  return (
    <Link href={href} className={classes} aria-label={label}>
      {image}
    </Link>
  );
}
