export default function Cta() {
  return (
    <footer>
      {/* CTA block */}
      <section className="py-24 px-6 border-t-2 border-sky-500/20 bg-zinc-950">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
            Early Access
          </p>
          <h2 className="font-sans font-bold text-4xl lg:text-5xl tracking-tight text-zinc-50">
            Built for serious traders.
          </h2>
          <p className="font-sans text-lg text-zinc-400">
            Bettrade is currently in private preview. If you&apos;re interested in early
            access, get in touch.
          </p>
          <button className="px-8 py-3 rounded-md bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition-colors cursor-pointer">
            Request Access
          </button>
        </div>
      </section>

      {/* Footer bar */}
      <div className="border-t border-zinc-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-zinc-600">
          <span>© 2026 Bettrade</span>
          <span>Private preview — not for public distribution</span>
        </div>
      </div>
    </footer>
  )
}
