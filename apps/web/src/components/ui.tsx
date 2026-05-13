export function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="section-title"><h2>{title}</h2><p>{subtitle}</p></div>;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <section className="card empty"><h2>{title}</h2><p>{text}</p></section>;
}

export function QueryState<T>({ query, children }: { query: { data?: T; isLoading: boolean; error: Error | null }; children: (data: T) => React.ReactNode }) {
  if (query.isLoading) return <EmptyState title="Cargando" text="Consultando API local." />;
  if (query.error) return <EmptyState title="Error" text={query.error.message} />;
  if (query.data === undefined) return <EmptyState title="Sin datos" text="La API no devolvio contenido." />;
  return <>{children(query.data)}</>;
}

export function MutationError({ error }: { error: Error | null }) {
  return error ? <p className="error">{error.message}</p> : null;
}
