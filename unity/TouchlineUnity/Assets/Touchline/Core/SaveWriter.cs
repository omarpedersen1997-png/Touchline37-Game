using System;
using System.Threading.Tasks;

namespace Touchline.Core
{
    // Snapshot on the owner thread, then serialize disk writes on a worker.
    // A newer pending snapshot supersedes an older PENDING one, never an
    // in-progress write. Gameplay state itself is never shared with that worker.
    public sealed class SaveWriter
    {
        private readonly SaveStore store;
        private readonly ITextCodec codec;
        private readonly object gate = new object();
        private string pending;
        private bool running;
        private Task work = Task.CompletedTask;
        private volatile string lastError;
        public string LastError => lastError;
        public bool Busy { get { lock (gate) return running; } }
        public SaveWriter(SaveStore store, ITextCodec codec) { this.store = store; this.codec = codec; }
        public Task Request(SandboxSave state)
        {
            string snapshot = codec.Encode(state);
            lock (gate)
            {
                pending = snapshot;
                if (!running) { running = true; work = Task.Run(Drain); }
                return work;
            }
        }
        private void Drain()
        {
            for (;;)
            {
                string snapshot;
                lock (gate)
                {
                    if (pending == null) { running = false; return; }
                    snapshot = pending; pending = null;
                }
                try { store.Save(codec.Decode<SandboxSave>(snapshot)); lastError = null; }
                catch (Exception error) { lastError = error.Message; }
            }
        }
        public Task Flush() { lock (gate) return work; }
    }
}
