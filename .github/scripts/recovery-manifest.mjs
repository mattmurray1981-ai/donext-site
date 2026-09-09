/** A recovery is tied to one reviewed live snapshot, never a general guard bypass. */
export function validateRecoveryManifest(plan, { siteId, liveId, files }) {
  if (!plan || plan.schemaVersion !== 1 || plan.siteId !== siteId || plan.liveDeployId !== liveId || !/^[0-9a-f]{24}$/.test(plan.functionSourceDeployId || '')) {
    throw new Error('Recovery manifest does not match this site/live deployment or lacks a valid function donor');
  }
  if (typeof plan.reason !== 'string' || !plan.reason.trim()) throw new Error('Recovery manifest needs a review reason');
  const expected = new Map(Object.entries(plan.files || {}).map(([file, digest]) => [file.toLowerCase(), digest]));
  if (expected.size !== files.length || files.some(file => expected.get(file.path.toLowerCase()) !== file.sha)) throw new Error('Production files changed since the reviewed recovery snapshot');
  const removed = new Map();
  for (const entry of plan.removePaths || []) {
    if (!entry?.path?.startsWith('/') || /[?#*]/.test(entry.path) || !entry.reason?.trim() || !expected.has(entry.path.toLowerCase()) || removed.has(entry.path.toLowerCase())) {
      throw new Error('Each recovery removal needs one exact existing path and a reason');
    }
    removed.set(entry.path.toLowerCase(), entry.reason);
  }
  return { expected, removed };
}
