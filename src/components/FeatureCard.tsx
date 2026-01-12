export type FeatureCardProps = {
  title: string;
  description: string;
  badge?: string;
};

export function FeatureCard({ title, description, badge }: FeatureCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-gradient-to-br from-emerald-300/60 via-sky-300/60 to-blue-400/60 blur-3xl transition duration-200 group-hover:blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {badge ? (
            <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
              {badge}
            </span>
          ) : null}
        </div>
      </div>
      <p className="relative mt-4 text-sm leading-relaxed text-slate-600">
        {description}
      </p>
    </article>
  );
}
