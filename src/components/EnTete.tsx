import Link from "next/link";

const LIENS = [
  { href: "/", libelle: "Planning & paie" },
  { href: "/documents", libelle: "Documents" },
];

export function EnTete({ actif }: { actif: string }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">Garde de Blanche</h1>
      <nav className="flex gap-1 rounded-lg bg-neutral-200/60 p-1 text-sm dark:bg-neutral-800">
        {LIENS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={actif === l.href ? "page" : undefined}
            className={
              actif === l.href
                ? "rounded-md bg-white px-3 py-1.5 font-medium shadow-sm dark:bg-neutral-950"
                : "rounded-md px-3 py-1.5 text-neutral-600 dark:text-neutral-400"
            }
          >
            {l.libelle}
          </Link>
        ))}
      </nav>
    </header>
  );
}
