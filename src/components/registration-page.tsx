import { GroupRegistrationForm } from "@/components/group-registration-form";
import type { RegistrationPageConfig } from "@/lib/group-registration-content";

export function RegistrationPage({ page }: { page: RegistrationPageConfig }) {
  return (
    <section className="w-full">
      <div
        className="relative top-[-10px] mb-[15px] h-[265px] w-full bg-cover bg-center bg-no-repeat max-md:top-0 max-md:mb-3 max-md:h-[220px]"
        style={{ backgroundImage: `url('${page.heroImage}')` }}
      >
        <div
          className="absolute left-0 top-[160px] h-[130px] w-full bg-left-top bg-no-repeat pt-[36px] pl-5 text-left max-md:top-[108px] max-md:h-[112px] max-md:bg-[length:auto_112px] max-md:pt-[30px] max-md:pl-[18px]"
          style={{ backgroundImage: "url('/theme/color-bar-3.png')" }}
        >
          <h1 className="legacy-condensed text-[30px] leading-none text-white drop-shadow-[2px_2px_5px_rgba(0,0,0,0.4)]">
            {page.title}
          </h1>
        </div>
      </div>

      <div className="flow-root w-full pb-10">
        <GroupRegistrationForm
          slug={page.slug}
          pageTitle={page.title}
          submitLabel={page.submitLabel}
        />
      </div>
    </section>
  );
}
