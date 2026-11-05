import { NextRequest, NextResponse } from "next/server";
import { serverErrorMessage } from "@/lib/errors";
import { mapPerson } from "@/lib/mappers";
import { getSupabase } from "@/lib/supabase";

function errorResponse(error: unknown, status = 500) {
  return NextResponse.json(
    { error: serverErrorMessage(error) },
    { status },
  );
}

async function listPeople() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("people")
    .select("id,name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapPerson);
}

export async function GET() {
  try {
    return NextResponse.json({ people: await listPeople() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const raw = body.names ?? body.name;
    const names = (Array.isArray(raw) ? raw : [raw])
      .filter((name: unknown): name is string => typeof name === "string")
      .flatMap((name: string) => name.split(","))
      .map((name: string) => name.trim().replace(/\s+/g, " "))
      .filter(Boolean);

    if (!names.length) {
      return NextResponse.json(
        { error: "Podaj co najmniej jedno imię." },
        { status: 400 },
      );
    }

    const existing = await listPeople();
    const seen = new Set(
      existing.map((person) => person.name.toLocaleLowerCase("pl")),
    );
    const inserts: { name: string }[] = [];

    for (const name of names) {
      const key = name.toLocaleLowerCase("pl");
      if (seen.has(key)) continue;
      seen.add(key);
      inserts.push({ name });
    }

    if (inserts.length) {
      const supabase = getSupabase();
      const { error } = await supabase.from("people").insert(inserts);
      if (error) throw error;
    }

    return NextResponse.json({ people: await listPeople() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    const name =
      typeof body.name === "string"
        ? body.name.trim().replace(/\s+/g, " ")
        : "";

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Nieprawidłowa osoba." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Imię nie może być puste." }, { status: 400 });
    }

    const people = await listPeople();
    const key = name.toLocaleLowerCase("pl");
    const duplicate = people.find(
      (person) =>
        person.id !== id && person.name.toLocaleLowerCase("pl") === key,
    );
    if (duplicate) {
      return NextResponse.json(
        { error: "Osoba o tym imieniu już istnieje." },
        { status: 400 },
      );
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("people")
      .update({ name })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ people: await listPeople() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Nieprawidłowa osoba." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("people").delete().eq("id", id);
    if (error) throw error;

    await supabase.from("shifts").delete().is("person_id", null);

    return NextResponse.json({ people: await listPeople() });
  } catch (error) {
    return errorResponse(error);
  }
}
