import { describe, it, expect } from 'vitest';
import { defaultConfig, loadConfig } from './config.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('loadConfig', () => {
  it('returns defaults when no config file is present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rk-cfg-'));
    try {
      const cfg = await loadConfig(dir);
      expect(cfg).toEqual(defaultConfig);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('merges a JSON config on top of the defaults', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rk-cfg-'));
    try {
      await writeFile(
        join(dir, 'releasekit.config.json'),
        JSON.stringify({ publish: true, npmTag: 'next' }),
        'utf8',
      );
      const cfg = await loadConfig(dir);
      expect(cfg.publish).toBe(true);
      expect(cfg.npmTag).toBe('next');
      expect(cfg.bumpVersion).toBe(defaultConfig.bumpVersion);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
