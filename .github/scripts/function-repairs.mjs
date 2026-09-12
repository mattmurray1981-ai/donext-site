import crypto from 'node:crypto';

export function verifyFunctionRepair(update, { name, sourcePath, oldSha, newSha, bytes }) {
  if (!update || update.name !== name || update.sourcePath !== sourcePath ||
      update.previousSourceSha !== oldSha || update.sourceSha !== newSha || update.invocationMode !== 'stream' ||
      !/^[0-9a-f]{64}$/.test(update.sha || '') ||
      crypto.createHash('sha256').update(bytes).digest('hex') !== update.sha) {
    throw new Error(`Function ${name} changed without a matching reviewed source and bundle`);
  }
  return update.sha;
}
