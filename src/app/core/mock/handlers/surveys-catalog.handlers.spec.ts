import { HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { MockRouter } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { uuid } from '../mock-store';
import { registerSurveyCatalog } from './surveys-catalog.handlers';
import { registrarEncuestas } from './surveys-forms.handlers';

/** `GET /surveys/catalog` in the mock: base surveys first, then own ones with service names. */
describe('simulador: GET /surveys/catalog (Buzón)', () => {
  const router = new MockRouter();
  registrarEncuestas(router);
  registerSurveyCatalog(router);

  it('trae las dos base del sistema primero y luego las propias, con el nombre del servicio', () => {
    const match = router.match('GET', '/surveys/catalog')!;
    const body = match.handler({
      method: 'GET', path: '/surveys/catalog', params: match.params, query: new URLSearchParams(),
      body: {}, headers: new HttpHeaders(), user: buscarUsuario('medica')!,
    }) as { origin: string; scope?: string; id: string; assignments: { targetName?: string | null }[] }[];

    expect(body.slice(0, 2).map((e) => [e.origin, e.scope])).toEqual([['SYSTEM', 'CONSULTATION'], ['SYSTEM', 'SERVICE']]);
    expect(body.slice(2).every((e) => e.origin === 'PRACTITIONER')).toBe(true);
    const tele = body.find((e) => e.id === uuid('survey-teleconsulta'))!;
    expect(tele.assignments[0]?.targetName).toBe('Teleconsulta cardiológica');
  });
});
