type CustomerAreaHeroProps = {
  title: string;
  subtitle: string;
  imageSrc?: string;
};

export function CustomerAreaHero({
  title,
  subtitle,
  imageSrc = "/photos/day-use.jpg",
}: CustomerAreaHeroProps) {
  return (
    <div
      className="relative mb-6 h-[280px] w-full overflow-hidden bg-cover bg-center bg-no-repeat max-md:h-[240px]"
      style={{ backgroundImage: `url('${imageSrc}')` }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(17,53,31,0.78),rgba(29,108,55,0.42),rgba(255,255,255,0.04))]" />
      <div className="absolute inset-x-0 bottom-0 top-0 flex items-end px-5 pb-7 text-left max-md:px-[18px] max-md:pb-6">
        <div className="max-w-[720px] rounded-[24px] border border-white/16 bg-black/10 px-6 py-5 backdrop-blur">
          <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-white/85">
            Area do Cliente
          </p>
          <h1 className="mt-2 text-[36px] font-black leading-none text-white drop-shadow-[2px_2px_5px_rgba(0,0,0,0.4)] max-md:text-[30px]">
            {title}
          </h1>
          <p className="mt-2 max-w-[640px] text-sm leading-6 text-white/92 md:text-[15px]">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
