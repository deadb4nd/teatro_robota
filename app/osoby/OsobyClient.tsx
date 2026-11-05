"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Loading, Notice } from "@/components/Notice";
import { errorMessage, getJson, sendJson } from "@/lib/client";
import type { Person } from "@/lib/types";

type Flash = {
  kind: "info" | "success" | "error" | "warning";
  text: string;
};

export function OsobyClient() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newNames, setNewNames] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [flash, setFlash] = useState<Flash | null>(null);

  async function loadPeople() {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getJson<{ people: Person[] }>("/api/people");
      setPeople(result.people);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPeople();
  }, []);

  async function addPeople(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newNames.trim()) return;

    setBusy(true);
    setFlash(null);

    try {
      const result = await sendJson<{ people: Person[] }>(
        "/api/people",
        "POST",
        { names: newNames },
      );
      setPeople(result.people);
      setNewNames("");
      setFlash({ kind: "success", text: "Lista osób została zaktualizowana." });
    } catch (error) {
      setFlash({ kind: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function startEditing(person: Person) {
    setEditingId(person.id);
    setEditingName(person.name);
    setFlash(null);
  }

  async function saveRename(person: Person) {
    const name = editingName.trim();
    if (!name || name === person.name) {
      setEditingId(null);
      return;
    }

    setBusy(true);
    setFlash(null);

    try {
      const result = await sendJson<{ people: Person[] }>(
        "/api/people",
        "PATCH",
        { id: person.id, name },
      );
      setPeople(result.people);
      setEditingId(null);
      setEditingName("");
      setFlash({ kind: "success", text: "Imię zostało zmienione." });
    } catch (error) {
      setFlash({ kind: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function removePerson(person: Person) {
    if (
      !window.confirm(
        `Usunąć osobę „${person.name}”? Zniknie też jej dostępność, a przypisania w grafikach zostaną odłączone.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setFlash(null);

    try {
      const result = await sendJson<{ people: Person[] }>(
        `/api/people?id=${person.id}`,
        "DELETE",
      );
      setPeople(result.people);
      setFlash({ kind: "success", text: "Osoba została usunięta." });
    } catch (error) {
      setFlash({ kind: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Ustawienia</span>
          <h1>Osoby</h1>
        </div>
        <div className="head-actions">
          <Link className="secondary-btn" href="/dostepnosc">
            Dostępność
          </Link>
        </div>
      </div>

      <Notice kind="info">
        Lista startowa to tylko przykład — możesz dowolnie dodawać, zmieniać i
        usuwać osoby. Nie ma logowania, więc każdy z linkiem może edytować tę
        listę.
      </Notice>

      {flash ? <Notice kind={flash.kind}>{flash.text}</Notice> : null}
      {loadError ? <Notice kind="error">{loadError}</Notice> : null}

      <form className="add-people-form" onSubmit={addPeople}>
        <label>
          <span>Dodaj osoby</span>
          <input
            type="text"
            value={newNames}
            onChange={(event) => setNewNames(event.target.value)}
            placeholder="np. Ania, Kasia, Tomek"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="primary-btn" disabled={busy}>
          Dodaj
        </button>
      </form>

      <p className="hint">
        Możesz dodać kilka osób naraz, oddzielając imiona przecinkami.
      </p>

      {loading ? (
        <Loading />
      ) : (
        <div className="people-list">
          {people.map((person) => (
            <div className="person-row" key={person.id}>
              {editingId === person.id ? (
                <>
                  <input
                    className="person-edit-input"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveRename(person);
                      }
                      if (event.key === "Escape") {
                        setEditingId(null);
                        setEditingName("");
                      }
                    }}
                  />
                  <div className="row-actions">
                    <button
                      type="button"
                      className="primary-btn compact"
                      onClick={() => void saveRename(person)}
                      disabled={busy}
                    >
                      Zapisz
                    </button>
                    <button
                      type="button"
                      className="ghost-btn compact"
                      onClick={() => {
                        setEditingId(null);
                        setEditingName("");
                      }}
                      disabled={busy}
                    >
                      Anuluj
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <strong>{person.name}</strong>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="ghost-btn compact"
                      onClick={() => startEditing(person)}
                      disabled={busy}
                    >
                      Zmień
                    </button>
                    <button
                      type="button"
                      className="ghost-btn compact danger"
                      onClick={() => void removePerson(person)}
                      disabled={busy}
                    >
                      Usuń
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {people.length === 0 ? (
            <div className="empty-state">
              <strong>Lista jest pusta.</strong>
              <p>Dodaj pierwszą osobę powyżej.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
