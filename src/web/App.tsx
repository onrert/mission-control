const TABS = ['Zaman Çizelgesi', 'Kanban', 'Ayarlar']

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex h-14 items-center gap-6 border-b border-zinc-800 px-4">
        <span data-testid="app-title" className="font-display tracking-wide text-lg uppercase">
          Mission Control
        </span>
        <nav className="flex gap-4">
          {TABS.map((tab) => (
            <span
              key={tab}
              aria-disabled="true"
              className="text-sm font-mono text-zinc-400"
            >
              {tab}
            </span>
          ))}
        </nav>
      </header>
      <main className="flex items-center justify-center p-6 text-zinc-400">
        <p className="font-mono text-sm">İskelet hazır. Ekranlar sonraki feature&apos;larda eklenecek.</p>
      </main>
    </div>
  )
}
