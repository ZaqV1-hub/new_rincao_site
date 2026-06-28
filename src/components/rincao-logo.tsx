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
}: RincaoLogoProps) {
  const width = compact ? 340 : 340;
  const height = compact ? 151 : 151;
  const classes = `inline-flex items-center ${className}`.trim();
  const src = "/brand/rincao-logo.png";
  const label = "Clube Rincão";
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
