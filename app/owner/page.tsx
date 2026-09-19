export default function OwnerControlRoomPage() {
  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 flex items-center justify-between border-b border-ink-800 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-accent-400">
              Owner Control Room
            </p>
            <h1 className="mt-3 font-display text-5xl tracking-tight">
              Database Administration Workspace
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-500">
              Natural-language database administration with authorization,
              validation, audit logging, and execution safeguards.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {[
            {
              title: 'Ask Database',
              body: 'Natural-language database operations with validation and SQL preview.',
            },
            {
              title: 'Schema Explorer',
              body: 'Inspect tables, views, indexes, constraints, and relationships.',
            },
            {
              title: 'SQL Console',
              body: 'Advanced SQL workspace for direct administrative queries.',
            },
            {
              title: 'Audit Activity',
              body: 'Track operations, authorization outcomes, and execution history.',
            },
          ].map((item) => (
            <section
              key={item.title}
              className="border border-ink-800 bg-ink-900/70 p-5"
            >
              <h2 className="text-lg font-semibold text-ink-100">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-ink-500">
                {item.body}
              </p>
            </section>
          ))}
        </div>

        <section className="mt-10 border border-ink-800 bg-ink-900/60 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-accent-400">
                Ask Database
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Owner Natural-Language Interface
              </h2>
            </div>
          </div>

          <div className="mt-6 border border-ink-700 bg-ink-950 p-4">
            <textarea
              placeholder="Example: Create a projects table with project_id, project_name, status, and created_at."
              className="min-h-[180px] w-full resize-none bg-transparent text-sm outline-none placeholder:text-ink-700"
            />
          </div>

          <div className="mt-5 flex gap-4">
            <button className="btn-primary">
              Generate Execution Plan
            </button>
            <button className="border border-ink-700 px-5 py-3 text-sm text-ink-300 transition-colors hover:border-accent-400 hover:text-ink-100">
              Open SQL Console
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
