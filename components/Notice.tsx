type Props = {
  kind?: "info" | "success" | "error" | "warning";
  children: React.ReactNode;
};

export function Notice({ kind = "info", children }: Props) {
  return <div className={`notice ${kind}`}>{children}</div>;
}

export function Loading({ label = "Ładowanie danych…" }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
