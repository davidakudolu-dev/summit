// Deploy separately only after configuring APP_ORIGIN and JOB_SECRET.
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      const origin=new URL(env.APP_ORIGIN);if(origin.protocol!=='https:'||origin.username||origin.password)throw new Error('1751 jobs require an approved HTTPS origin');
      const outcomes = await Promise.allSettled(['email', 'reconcile','monitor'].map(async job => {
        const r = await fetch(`${env.APP_ORIGIN}/api/jobs/${job}`, { method: 'POST', headers: { Authorization: `Bearer ${env.JOB_SECRET}` } });
        if (!r.ok) throw new Error(`1751 ${job} job failed: HTTP ${r.status}`);
        const outcome = await r.json();
        if (outcome.failed) throw new Error(`1751 ${job} job has unresolved transactions`);
      }));
      if (outcomes.some(r => r.status === 'rejected')) throw new Error('1751 background job failure; inspect outbox and payment reconciliation');
    })());
  }
};
