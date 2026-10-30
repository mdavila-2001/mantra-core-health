import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildInfo } from '../../../../environments/env.generated';

/* ============================================================================
    Un archivo subido sigue siendo el mismo archivo después de F5.

    La maqueta guarda sus archivos en `sessionStorage` como JSON, y un `Blob`
    no sobrevive a eso: tras recargar, `bytes` vuelve como `{}`. Antes,
    `fileContent` devolvía ese `{}` como si fueran los bytes, y el comprobante
    de pago que el paciente acababa de subir se abría vacío.
    ========================================================================== */

const CLAVE = 'mock.files.archivos';
const ID = 'archivo-subido-antes-de-recargar';
const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

function archivoTrasRecargar(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id: ID,
    currentVersionId: 'version-1',
    originalName: 'comprobante pago.png',
    category: 'IMAGE',
    sensitivity: 'NORMAL',
    lifecycleStatusConceptId: 'activo',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    dataUrl: 'data:image/svg+xml,<svg/>',
    uploaderUserId: 'user-paciente',
    // Lo que deja `JSON.stringify` de un `Blob`.
    bytes: {},
    ...extra,
  };
}

async function recargarCon(fila: Record<string, unknown>): Promise<typeof import('./files.handlers')> {
  sessionStorage.setItem(CLAVE, JSON.stringify({ build: buildInfo.commit, filas: [fila] }));
  vi.resetModules();
  return import('./files.handlers');
}

describe('archivos de la maqueta tras recargar', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  it('entrega la copia `data:` de la imagen, con su nombre, y no el `{}` que dejó el JSON', async () => {
    const { fileContent } = await recargarCon(archivoTrasRecargar({ dataUrlReal: DATA_URL }));

    expect(fileContent(ID)).toEqual({
      body: DATA_URL,
      headers: { 'Content-Disposition': "attachment; filename*=UTF-8''comprobante%20pago.png" },
    });
  });

  it('sin copia `data:` cae al archivo dibujado, nunca al `{}`', async () => {
    const { fileContent } = await recargarCon(archivoTrasRecargar({}));

    const contenido = fileContent(ID) as { body: unknown };
    expect(contenido.body).toBe('data:image/svg+xml,<svg/>');
  });

  it('la URL de la imagen no intenta un `blob:` de bytes que ya no existen', async () => {
    const { urlDeArchivoSimulado } = await recargarCon(archivoTrasRecargar({}));

    expect(urlDeArchivoSimulado(ID)).toBe('data:image/svg+xml,<svg/>');
  });
});
