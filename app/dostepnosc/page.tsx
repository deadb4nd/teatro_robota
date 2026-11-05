import { DostepnoscClient } from "./DostepnoscClient";

export default async function DostepnoscPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  return <DostepnoscClient initialWeek={params.week ?? null} />;
}
