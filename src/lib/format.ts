export function euros(centimes: number): string {
  return (centimes / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function heures(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function jourLong(jour: string): string {
  return new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
