import { GodzinyClient } from "./GodzinyClient";

export default async function GodzinyPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  return <GodzinyClient initialWeek={params.week ?? null} />;
}
