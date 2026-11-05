import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { BedBoard } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { buscarUsuario } from '../../../core/mock/mock-session';
import { MaquetaDeInternacion, verificarHttp } from '../../../../testing/maqueta-de-internacion';
import { BlockDialog } from './block-dialog';
import { IsolationDialog } from './isolation-dialog';

/** Los diálogos del panel (F2.4): motivo del catálogo de la API, «Otro» con texto, 409 de compromisos, 422 de aislamiento. */
describe('diálogos del panel de cama', () => {
  function base(usuario = 'enfermeria') {
    const maqueta = new MaquetaDeInternacion(buscarUsuario(usuario)!);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const site = maqueta.acceso().sites[0]!.siteId;
    const celdas = (maqueta.llamar('GET', `/sites/${site}/bed-board`).body as BedBoard).units.flatMap((u) => u.cells);
    return { maqueta, http, celdas };
  }

  afterEach(() => verificarHttp());

  it('BlockDialog: motivos por tipo desde el catálogo, «Otro» exige texto y el 409 lista los compromisos', () => {
    const { maqueta, http, celdas } = base();
    const libre = celdas.find((c) => c.availability.code === 'SPACE_OP_AVAILABLE' && c.occupancy.code === 'OCC_FREE')!;
    const fixture = TestBed.createComponent(BlockDialog);
    fixture.componentRef.setInput('cell', libre);
    fixture.componentRef.setInput('kind', 'BLOCK_CLINICAL');
    fixture.detectChanges();
    maqueta.responderTodo(http, () => fixture.detectChanges());
    const c = fixture.componentInstance as unknown as { reasons: () => { value: string }[]; reasonCode: { set: (v: string) => void }; submit: () => void };
    expect(c.reasons().map((r) => r.value)).toContain('BLOCK_RSN_STAFF_SHORTAGE');
    expect(c.reasons().map((r) => r.value)).not.toContain('BLOCK_RSN_PREVENTIVE_MAINTENANCE');
    c.reasonCode.set('BLOCK_RSN_OTHER');
    c.submit();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Describa el motivo.');
    http.expectNone(`/care-spaces/${libre.id}/availability`);
    c.reasonCode.set('BLOCK_RSN_STAFF_SHORTAGE');
    c.submit();
    const req = http.expectOne(`/care-spaces/${libre.id}/availability`);
    expect(req.request.headers.get('If-Match-Ops')).toBe(String(libre.opsVersion));
    expect(req.request.body).toEqual({ action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' });
    req.flush(
      { code: 'CONFLICT', reason: 'FUTURE_COMMITMENTS_CONFLICT', message: 'Hay compromisos', details: { conflicts: [{ kind: 'PROCEDURE_CASE', id: 'caso-12345678', startsAt: '2026-11-01T14:00:00Z', nextAction: 'Reprogramar' }] } },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=block-conflicts]')?.textContent).toContain('Reprogramar');
  });

  it('IsolationDialog: un local no apto muestra lo que falta (422 ISOLATION_ROOM_NOT_CAPABLE)', () => {
    const { maqueta, http, celdas } = base();
    const cama = celdas.find((c) => c.code === '302-B') ?? celdas[0]!;
    const fixture = TestBed.createComponent(IsolationDialog);
    fixture.componentRef.setInput('cell', cama);
    fixture.detectChanges();
    maqueta.responderTodo(http, () => fixture.detectChanges());
    const c = fixture.componentInstance as unknown as { code: { set: (v: string) => void }; reason: { set: (v: string) => void }; submit: () => void };
    c.code.set('ISO_AIRBORNE');
    c.reason.set('TB sospechada');
    c.submit();
    maqueta.responderTodo(http, () => fixture.detectChanges());
    expect((fixture.nativeElement as HTMLElement).textContent).toMatch(/AIIR|presión negativa/i);
  });
});
