import { GrafikClient } from "./GrafikClient";

export default async function GrafikPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  return <GrafikClient initialWeek={params.week ?? null} />;
}
