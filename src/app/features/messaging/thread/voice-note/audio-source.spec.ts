import { describe, expect, it } from 'vitest';

import { audioBlobOf } from './audio-source';

describe('audioBlobOf', () => {
  it('decodifica en memoria el audio que graba el navegador (tipo con parámetros)', async () => {
    const blob = await audioBlobOf('data:audio/webm;codecs=opus;base64,GkXfow==');
    expect(blob.type).toBe('audio/webm;codecs=opus');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  });

  it('acepta un data: sin base64', async () => {
    const blob = await audioBlobOf('data:audio/wav,RIFF');
    expect(blob.type).toBe('audio/wav');
    expect(await blob.text()).toBe('RIFF');
  });
});
