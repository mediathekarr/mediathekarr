export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>MediathekArr</h1>
      <p>Mediathek indexer for Sonarr/Radarr</p>
      <h2>Endpoints</h2>
      <ul>
        <li><code>/api/newznab?t=caps</code> - Capabilities</li>
        <li><code>/api/newznab?t=tvsearch&amp;tvdbid=123</code> - TV Search</li>
        <li><code>/api/download?mode=queue</code> - Download Queue</li>
      </ul>
    </main>
  );
}
