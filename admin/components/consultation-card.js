export function ConsultationCard({ entry }) {
  return <article className="entry-card">
    <div className="entry-head"><h3>{entry.schema_id} · {entry.schema_version}</h3><span className="pill">{entry.status}</span></div>
    <p className="mono">{entry.id}</p><p>{entry.created_at}</p>
    <details><summary>Validated fields</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(entry.payload, null, 2)}</pre></details>
    <details><summary>Original dictation</summary><p style={{ whiteSpace: 'pre-wrap' }}>{entry.raw_transcript}</p></details>
  </article>;
}
