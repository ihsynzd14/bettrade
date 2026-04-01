const STATS = [
  { value: '< 250ms', label: 'Data Latency'  },
  { value: '5,000',   label: 'API Tx / Hour' },
  { value: '100%',    label: 'Automated'     },
  { value: '24 / 7',  label: 'Always On'     },
]

export default function Stats() {
  return (
    <section className="border-y border-zinc-800 bg-zinc-900/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center py-12 border-r border-zinc-800 last:border-r-0 [&:nth-child(2)]:border-r-0 lg:[&:nth-child(2)]:border-r"
            >
              <span className="font-sans font-bold text-4xl lg:text-5xl text-zinc-50 tracking-tight">
                {stat.value}
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.15em] text-zinc-500 mt-2">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
