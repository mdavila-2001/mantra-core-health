import { HttpErrorResponse } from '@angular/common/http';

import { replyTemplateFailureOf } from './reply-template-failure';

const fallo = (status: number, details?: Record<string, unknown>): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: { statusCode: status, code: status === 409 ? 'CONFLICT' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'VALIDATION_FAILED', message: 'x', timestamp: '', path: '/org/reply-templates/t', ...(details === undefined ? {} : { details }) },
  });

describe('el fallo de guardar una respuesta preparada', () => {
  it('409 REPLY_TEMPLATE_STALE: no se pisó a la otra persona, y dice en qué versión va hoy', () => {
    const f = replyTemplateFailureOf(fallo(409, { reason: 'REPLY_TEMPLATE_STALE', currentVersion: 4 }));
    expect(f.kind).toBe('STALE');
    expect(f.currentVersion).toBe(4);
    expect(f.message).toContain('no se guardó su cambio');
  });

  it('un 409 que no es ese no se confunde con él', () => {
    expect(replyTemplateFailureOf(fallo(409, { reason: 'OTRA' })).kind).toBe('OTHER');
  });

  it('400, 403, 404 y sin red tienen cada uno su mensaje', () => {
    expect(replyTemplateFailureOf(fallo(400)).kind).toBe('INVALID');
    expect(replyTemplateFailureOf(fallo(403)).kind).toBe('FORBIDDEN');
    expect(replyTemplateFailureOf(fallo(404)).kind).toBe('NOT_FOUND');
    expect(replyTemplateFailureOf(new HttpErrorResponse({ status: 0 })).kind).toBe('OFFLINE');
    expect(replyTemplateFailureOf(new Error('x')).kind).toBe('OTHER');
  });

  it('ningún mensaje deja ver códigos de sistema', () => {
    for (const f of [fallo(409, { reason: 'REPLY_TEMPLATE_STALE' }), fallo(400), fallo(403), fallo(404)]) {
      expect(replyTemplateFailureOf(f).message).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
    }
  });
});
