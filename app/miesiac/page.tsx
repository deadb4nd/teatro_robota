import { MiesiacClient } from "./MiesiacClient";

export default async function MiesiacPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  return <MiesiacClient initialMonth={params.month ?? null} />;
}
