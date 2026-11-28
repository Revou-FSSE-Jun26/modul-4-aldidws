
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function DashboardGuide() {
  return (
    <aside className="flex flex-col gap-5">
      <p className="px-1 text-[11px] font-medium uppercase tracking-wider text-[#64766A]">
        A little direction
      </p>

      <section className="rounded-xl bg-[#EEF0E4] p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#65796B]">
          Find your flow
        </p>

        <h2 className="mt-3 font-serif text-[22px] leading-tight text-[#24483D]">
          Small steps.
          <br />
          Real progress.
        </h2>

        <div className="mt-5 space-y-5">
          <GuideStep
            number="01"
            title="Make a home for your ideas"
            description="Start with a board for any project."
            numberSize="text-[10px]"
            titleSize="text-[11px]"
            descriptionSize="text-[10px]"
          />

          <GuideStep
            number="02"
            title="Turn plans into next steps"
            description="Add tasks, details, and due dates."
            numberSize="text-[10px]"
            titleSize="text-[11px]"
            descriptionSize="text-[10px]"
          />

          <GuideStep
            number="03"
            title="Keep good things moving"
            description="Move tasks as your work evolves."
            numberSize="text-[10px]"
            titleSize="text-[11px]"
            descriptionSize="text-[10px]"
          />
        </div>

        <div className="mt-5 border-t border-[#D9DECF] pt-4">
          <Link
            href="/"
            className="flex items-center justify-between gap-2 text-[11px] font-medium text-[#24483D]"
          >
            <span>Explore the quick-start guide</span>
            <ArrowUpRight size={14} className="shrink-0" />
          </Link>
        </div>
      </section>

      <div>
        <h3 className="font-serif text-[22px] leading-snug text-[#24483D]">
          Less scattered.
          <br />
          More together.
        </h3>

        <p className="mt-2 text-[12px] leading-5 text-[#7C8178]">
          A calmer way to work, one board at a time.
        </p>
      </div>

      <div>
        <h3 className="font-serif text-[22px] leading-snug text-[#24483D]">
          From scattered to synced.
        </h3>

        <p className="mt-2 text-[12px] leading-5 text-[#7C8178]">
          Move your work forward, one board at a time.
        </p>
      </div>

      <div>
        <h3 className="font-serif text-[22px] leading-snug text-[#24483D]">
          Bring scattered tasks together.
        </h3>

        <p className="mt-2 text-[12px] leading-5 text-[#7C8178]">
          A calmer workflow, one board at a time.
        </p>
      </div>

    </aside>
  );
}

type GuideStepProps = {
  number: string;
  title: string;
  description: string;
  numberSize?: string;
  titleSize?: string;
  descriptionSize?: string;
};

function GuideStep({
  number,
  title,
  description,
  numberSize = "text-[10px]",
  titleSize = "text-[11px]",
  descriptionSize = "text-[10px]",
}: GuideStepProps) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#DDE5D0] text-[#526B57] ${numberSize}`}
      >
        {number}
      </span>

      <div className="min-w-0 flex-100">
        <p className={`font-semibold leading-6 text-[#24483D] ${titleSize}`}>
          {title}
        </p>

        <p className={`mt-1 leading-4 text-[#7C8178] ${descriptionSize}`}>
          {description}
        </p>
      </div>
    </div>
  );
}
