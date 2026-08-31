export type DocsHeading = {
  id: string;
  title: string;
  level?: 2 | 3;
};

interface DocsTocProps {
  headings: DocsHeading[];
}

export function DocsToc({ headings }: DocsTocProps) {
  if (!headings || headings.length === 0) return null;

  return (
    <aside className="hidden xl:block w-56 shrink-0">
      <nav
        className="sticky top-20 border-l border-slate-200/80 pl-3.5 dark:border-slate-800/80"
        aria-label="Table of contents"
      >
        <p className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          On this page
        </p>
        <ul className="space-y-1.5 text-[12.5px] leading-snug">
          {headings.map((heading) => (
            <li
              key={heading.id}
              className={heading.level === 3 ? "pl-2 text-slate-400 dark:text-slate-500" : ""}
            >
              <a
                href={`#${heading.id}`}
                className="block text-slate-500 transition-colors hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-400 line-clamp-2"
              >
                {heading.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
