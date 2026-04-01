export default function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/60 backdrop-blur-md bg-zinc-950/80">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="font-sans font-semibold text-lg tracking-tight text-zinc-50">
          Bettrade
        </span>
        <button className="px-4 py-1.5 text-sm font-medium rounded-md bg-sky-500 hover:bg-sky-400 text-white transition-colors cursor-pointer">
          Request Access
        </button>
      </div>
    </header>
  )
}
