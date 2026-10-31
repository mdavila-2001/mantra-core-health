import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessApprovalsClient } from '../../../core/data-access/access-governance/access-approvals.client';
import type { SupportApproval } from '../../../core/data-access/access-governance/access-reviews.types';
import { aprobaciones, GENTE } from '../../../core/mock/fixtures/support-hospital-governance';
import { reiniciarElGobiernoDeAccesos } from '../../../core/mock/handlers/mock-reset';
import { iso, uuid } from '../../../core/mock/mock-store';
import { resolverDesafiosEnPrueba } from '../../../../testing/access-challenge-test';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { Approvals } from './approvals';

const DE_MARCOS = uuid('demo-gov-approval-marcos-a4');

/** Una aprobación crítica pedida por la cajera (`billing.receipt.void`): la decide el administrador, con su segundo paso. */
const ANULACION: SupportApproval = {
  id: uuid('spec-anular-comprobante'),
  tenantId: aprobaciones.get(DE_MARCOS)!.tenantId,
  kind: 'ACTION',
  status: 'PENDING',
  approverKind: 'SECOND_APPROVER',
  atom: 'billing.receipt.void',
  requesterUserId: GENTE.mario.userId,
  subjectUserId: GENTE.mario.userId,
  reasonText: 'El comprobante R-0001 salió con el monto equivocado.',
  createdAt: iso(0, 8, 0),
  expiresAt: iso(0, 23, 50),
  summary:
    'Mario Quispe pide anular el comprobante R-0001. Si se aprueba, se puede hacer una vez en la próxima hora.',
};

/** Un cambio de permisos (`GRANT_CHANGE`) con el detalle completo que la API manda en `GET /approvals/pending`. */
const CAMBIO_DE_PERMISOS: SupportApproval = {
  id: uuid('spec-cambio-de-permisos'),
  tenantId: aprobaciones.get(DE_MARCOS)!.tenantId,
  kind: 'GRANT_CHANGE',
  status: 'PENDING',
  approverKind: 'SECOND_APPROVER',
  requesterUserId: GENTE.mario.userId,
  subjectUserId: GENTE.mario.userId,
  reasonText: 'Va a cubrir la caja el fin de semana.',
  createdAt: iso(0, 8, 0),
  expiresAt: iso(0, 23, 50),
  summary: 'Dar a Mario Quispe accesos críticos: Anular comprobantes.',
  details: {
    op: 'ADD',
    reasons: ['NEW_CRITICAL_ATOMS', 'VALIDITY_EXTENDED'],
    atoms: [
      { code: 'billing.receipt.view', name: 'Ver comprobantes', critical: false },
      { code: 'billing.receipt.void', name: 'Anular comprobantes', critical: true },
    ],
    criticalAtoms: [{ code: 'billing.receipt.void', name: 'Anular comprobantes', critical: true }],
    target: {
      kind: 'PRACTITIONER_SERVICE',
      expansionMode: 'FIXED',
      practitionerName: 'Dr. Andrés Pérez',
      serviceName: 'Ecografía',
    },
    validFrom: iso(0, 0, 0),
    validTo: iso(20, 23, 59),
    conditions: ['Solo de lunes a viernes, de 8:00 a 18:00.', 'Solo desde la red de la organización.'],
  },
};

/**
 * «Aprobaciones de cuatro ojos» contra el simulador: cada decisión se demuestra pantalla → petición → respuesta → recarga →
 * pantalla (`isolate: false`: cada prueba parte del piloto de fábrica).
 */
describe('Approvals', () => {
  let fixture: ComponentFixture<Approvals>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 4; i += 1) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };
  const click = async (el: Element | null): Promise<void> => {
    expect(el).not.toBeNull();
    (el as HTMLElement).click();
    await settle();
  };
  const escribir = async (id: string, texto: string): Promise<void> => {
    const campo = byId(id)!.querySelector('textarea')!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const pestana = async (rotulo: string): Promise<void> => {
    await click(
      Array.from(host().querySelectorAll<HTMLElement>('[role="tab"]')).find((t) =>
        t.textContent!.includes(rotulo),
      ) ?? null,
    );
  };
  const hechas = (): string[] => peticiones.map((p) => `${p.method} ${p.path} ${p.status}`);

  async function montar(
    cuenta: string,
    ruta = '/administration/access-governance/approvals',
  ): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideGovernanceMock(cuenta)],
    });
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue(ruta);
    fixture = TestBed.createComponent(Approvals);
    await settle();
  }

  beforeEach(() => {
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    reiniciarElGobiernoDeAccesos();
  });

  it('el doctor ve qué se le pide, quién, por qué y qué pasa si aprueba, sin códigos de permiso', async () => {
    await montar('suarez', '/my-team/approvals');
    const tarjeta = byId(`aprobacion-${DE_MARCOS}`)!;
    expect(host().textContent).toContain('Aprobaciones de mi equipo');
    expect(tarjeta.textContent).toContain('Marcos Ribera pide cancelar la cita de Mateo Rivera');
    expect(tarjeta.textContent).toContain(
      'Por qué lo pide: «La mamá de Mateo avisó que no puede venir mañana por la mañana.»',
    );
    expect(tarjeta.textContent).toContain(
      'Qué pasa si la aprueba: la acción se puede hacer una sola vez durante los próximos 60 minutos.',
    );
    expect(byId(`aprobacion-vence-${DE_MARCOS}`)!.textContent).toMatch(/Vence en (\d+ h|1 día)/);
    expect(tarjeta.textContent).not.toMatch(/agenda\.appointment/);
    expect(byId('approvals-pestanas')!.textContent).toContain('Pendientes de mi decisión (1)');
  });

  it('aprobar: la API aprueba, se vuelve a pedir la lista y, al no quedar nada, el estado vacío dice qué hacer', async () => {
    await montar('suarez', '/my-team/approvals');
    olvidarPeticiones();

    await click(byId(`aprobacion-aprobar-${DE_MARCOS}`));

    expect(hechas()[0]).toBe(`POST /approvals/${DE_MARCOS}/decision 200`);
    expect(peticiones[0]!.body).toEqual({ decision: 'APPROVE' });
    expect(hechas()).toEqual(
      expect.arrayContaining(['GET /approvals/pending 200', 'GET /me/support-approvals 200']),
    );
    expect(aprobaciones.get(DE_MARCOS)).toMatchObject({ status: 'APPROVED' });
    expect(byId(`aprobacion-${DE_MARCOS}`)).toBeNull();
    expect(host().textContent).toContain('No hay nada esperando su decisión');
    expect(host().querySelector('a[href="/my-team"]')).not.toBeNull();
    expect(byId('approvals-anuncio')!.textContent).toContain('Aprobada.');
  });

  it('rechazar pide el motivo; con él, la API lo guarda y quien pidió lo ve en «Mis solicitudes»', async () => {
    await montar('suarez', '/my-team/approvals');
    await click(byId(`aprobacion-rechazar-${DE_MARCOS}`));
    olvidarPeticiones();
    await click(byId(`aprobacion-confirmar-rechazo-${DE_MARCOS}`));
    expect(peticiones).toHaveLength(0);
    expect(byId(`aprobacion-rechazo-${DE_MARCOS}`)!.textContent).toContain(
      'Escriba al menos 5 caracteres.',
    );

    await escribir(`aprobacion-motivo-${DE_MARCOS}`, 'Mateo ya tiene control esa mañana.');
    await click(byId(`aprobacion-confirmar-rechazo-${DE_MARCOS}`));

    expect(peticiones[0]).toMatchObject({
      method: 'POST',
      path: `/approvals/${DE_MARCOS}/decision`,
      status: 200,
      body: { decision: 'REJECT', comment: 'Mateo ya tiene control esa mañana.' },
    });
    expect(aprobaciones.get(DE_MARCOS)).toMatchObject({ status: 'REJECTED' });

    fixture.destroy();
    TestBed.resetTestingModule();
    await montar('marcos');
    await pestana('Mis solicitudes');
    expect(byId(`solicitud-estado-${DE_MARCOS}`)!.textContent).toContain('Rechazada');
    expect(byId(`solicitud-rechazo-${DE_MARCOS}`)!.textContent).toContain(
      'Mateo ya tiene control esa mañana.',
    );
    expect(byId(`solicitud-cancelar-${DE_MARCOS}`)).toBeNull();
  });

  it('quien pidió no tiene nada que decidir sobre lo suyo; en «Mis solicitudes» puede cancelarla mientras está pendiente', async () => {
    await montar('marcos');
    expect(byId('approvals-sin-pendientes')!.textContent).toContain('Nada espera su decisión');
    await pestana('Mis solicitudes');
    expect(byId(`solicitud-${DE_MARCOS}`)!.textContent).toContain('Decide el doctor.');
    expect(byId(`solicitud-estado-${DE_MARCOS}`)!.textContent).toContain('Pendiente');
    olvidarPeticiones();

    await click(byId(`solicitud-cancelar-${DE_MARCOS}`));

    expect(hechas()[0]).toBe(`POST /me/support-approvals/${DE_MARCOS}/cancel 200`);
    expect(aprobaciones.get(DE_MARCOS)).toMatchObject({ status: 'CANCELLED' });
    await pestana('Mis solicitudes');
    expect(byId(`solicitud-estado-${DE_MARCOS}`)!.textContent).toContain('Cancelada');
    expect(byId(`solicitud-cancelar-${DE_MARCOS}`)).toBeNull();
  });

  it('un permiso crítico avisa que pedirá el segundo paso y, al aprobar, lo resuelve y reintenta', async () => {
    aprobaciones.agregar(ANULACION);
    await montar('hospital_piloto');
    const desafios = resolverDesafiosEnPrueba();
    expect(byId(`aprobacion-${ANULACION.id}`)!.textContent).toContain(
      'Mario Quispe pide anular el comprobante R-0001',
    );
    expect(byId('aprobacion-segundo-paso')!.textContent).toContain('le pediremos su segundo paso');
    olvidarPeticiones();

    await click(byId(`aprobacion-aprobar-${ANULACION.id}`));

    expect(hechas().slice(0, 3)).toEqual([
      `POST /approvals/${ANULACION.id}/decision 403`,
      'POST /iam/me/step-up 200',
      `POST /approvals/${ANULACION.id}/decision 200`,
    ]);
    expect(desafios.preguntados.map((d) => d.kind)).toEqual(['STEP_UP']);
    expect(aprobaciones.get(ANULACION.id)).toMatchObject({ status: 'APPROVED' });
    expect(byId(`aprobacion-${ANULACION.id}`)).toBeNull();
  });

  /**
   * Ronda 2 de la API (`SupportApprovalViewDto.details`): quien aprueba ve el permiso COMPLETO que daría, no solo un resumen.
   */
  describe('detalle de un cambio de permisos (details)', () => {
    it('muestra todos los permisos con los críticos marcados, el objetivo por nombre, la vigencia y las condiciones', async () => {
      aprobaciones.agregar(CAMBIO_DE_PERMISOS);
      await montar('hospital_piloto');
      const detalle = byId(`aprobacion-detalle-${CAMBIO_DE_PERMISOS.id}`)!;
      expect(detalle).not.toBeNull();
      const atomos = Array.from(detalle.querySelectorAll('[data-testid^="aprobacion-atomo-"]')).map((e) =>
        e.textContent!.replace(/\s+/g, ' ').trim(),
      );
      expect(atomos).toHaveLength(2);
      expect(atomos[0]).toContain('Ver comprobantes');
      expect(atomos[0]).not.toContain('Crítico');
      expect(atomos[1]).toContain('Anular comprobantes');
      expect(atomos[1]).toContain('Crítico');
      expect(byId(`aprobacion-objetivo-${CAMBIO_DE_PERMISOS.id}`)!.textContent).toContain(
        'Dr. Andrés Pérez, solo en Ecografía',
      );
      expect(byId(`aprobacion-vigencia-${CAMBIO_DE_PERMISOS.id}`)!.textContent).toMatch(/Desde el .* hasta el /);
      const condiciones = byId(`aprobacion-condiciones-${CAMBIO_DE_PERMISOS.id}`)!.textContent!;
      expect(condiciones).toContain('Solo de lunes a viernes, de 8:00 a 18:00.');
      expect(condiciones).toContain('Solo desde la red de la organización.');
    });

    it('explica en lenguaje simple por qué pide aprobación y nunca muestra los códigos', async () => {
      aprobaciones.agregar(CAMBIO_DE_PERMISOS);
      await montar('hospital_piloto');
      const tarjeta = byId(`aprobacion-${CAMBIO_DE_PERMISOS.id}`)!;
      const motivos = byId(`aprobacion-por-que-${CAMBIO_DE_PERMISOS.id}`)!.textContent!;
      expect(motivos).toContain('Suma permisos críticos');
      expect(motivos).toContain('Alarga cuánto dura el permiso');
      expect(tarjeta.textContent).not.toMatch(/NEW_CRITICAL_ATOMS|VALIDITY_EXTENDED|billing\.receipt/);
    });

    it('sin condiciones ni fin de vigencia lo dice, y avisa del segundo paso porque hay un permiso crítico', async () => {
      aprobaciones.agregar({
        ...CAMBIO_DE_PERMISOS,
        id: uuid('spec-cambio-sin-condiciones'),
        details: { ...CAMBIO_DE_PERMISOS.details!, validFrom: undefined, validTo: undefined, conditions: [] },
      });
      await montar('hospital_piloto');
      const id = uuid('spec-cambio-sin-condiciones');
      expect(byId(`aprobacion-vigencia-${id}`)!.textContent).toContain('Sin fecha de fin');
      expect(byId(`aprobacion-condiciones-${id}`)!.textContent).toContain('Sin condiciones');
      expect(byId('aprobacion-segundo-paso')!.textContent).toContain('le pediremos su segundo paso');
    });

    it('un ajuste (UPDATE) dice qué cambia', async () => {
      aprobaciones.agregar({
        ...CAMBIO_DE_PERMISOS,
        id: uuid('spec-cambio-update'),
        details: { ...CAMBIO_DE_PERMISOS.details!, op: 'UPDATE', reasons: ['SCOPE_WIDENED'], changes: ['validTo', 'condition'] },
      });
      await montar('hospital_piloto');
      const id = uuid('spec-cambio-update');
      expect(byId(`aprobacion-cambia-${id}`)!.textContent).toContain('la vigencia');
      expect(byId(`aprobacion-cambia-${id}`)!.textContent).toContain('las condiciones');
      expect(byId(`aprobacion-por-que-${id}`)!.textContent).toContain('Amplía');
    });

    it('una aprobación que no es un cambio de permisos no muestra ese detalle', async () => {
      aprobaciones.agregar(ANULACION);
      await montar('hospital_piloto');
      expect(byId(`aprobacion-detalle-${ANULACION.id}`)).toBeNull();
    });
  });

  it('si el segundo paso se cancela, no se aprueba nada y no se muestra un error', async () => {
    aprobaciones.agregar(ANULACION);
    await montar('hospital_piloto');
    resolverDesafiosEnPrueba();
    const { AccessChallengeService } = await import('../access-challenge/access-challenge.service');
    const { AccessChallengeCancelledError } =
      await import('../../../core/access-challenge/access-challenge');
    vi.spyOn(TestBed.inject(AccessChallengeService), 'resolve').mockReturnValue(
      throwError(() => new AccessChallengeCancelledError()),
    );

    await click(byId(`aprobacion-aprobar-${ANULACION.id}`));

    expect(aprobaciones.get(ANULACION.id)).toMatchObject({ status: 'PENDING' });
    expect(byId(`aprobacion-error-${ANULACION.id}`)).toBeNull();
    expect(byId(`aprobacion-${ANULACION.id}`)).not.toBeNull();
  });

  it('S4: si otra persona ya la resolvió, lo dice en lenguaje simple y vuelve a leer la lista', async () => {
    aprobaciones.agregar(ANULACION);
    await montar('hospital_piloto');
    aprobaciones.actualizar(ANULACION.id, { status: 'APPROVED' });
    olvidarPeticiones();

    await click(byId(`aprobacion-rechazar-${ANULACION.id}`));
    await escribir(`aprobacion-motivo-${ANULACION.id}`, 'No corresponde anularlo.');
    await click(byId(`aprobacion-confirmar-rechazo-${ANULACION.id}`));

    expect(peticiones[0]).toMatchObject({ method: 'POST', status: 409 });
    expect(hechas()).toContain('GET /approvals/pending 200');
    // La tarjeta ya no está (la API no la lista), pero el aviso queda arriba, en lenguaje simple.
    expect(byId(`aprobacion-${ANULACION.id}`)).toBeNull();
    expect(byId('approvals-anuncio')!.textContent).toContain('Esa solicitud ya fue resuelta.');
  });

  it('una pendiente vencida no se puede decidir: lo dice y no ofrece botones', async () => {
    aprobaciones.agregar({ ...ANULACION, id: uuid('spec-vencida'), expiresAt: iso(-1, 8, 0) });
    await montar('hospital_piloto');
    expect(byId(`aprobacion-vencida-${uuid('spec-vencida')}`)!.textContent).toContain(
      'Esta solicitud venció',
    );
    expect(byId(`aprobacion-aprobar-${uuid('spec-vencida')}`)).toBeNull();
  });

  it('S5: sin permiso para ver la sección muestra el muro con su código de soporte, sin tarjetas', async () => {
    vi.spyOn(AccessApprovalsClient.prototype, 'listPending').mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: {
              statusCode: 403,
              code: 'FORBIDDEN',
              message: 'No tiene permiso',
              correlationId: 'req-77',
            },
          }),
      ),
    );
    await montar('ana');
    expect(host().textContent).toContain('No tiene acceso a esta sección');
    expect(host().textContent).toContain('req-77');
    expect(byId('approvals-pestanas')).toBeNull();
  });

  it('S9: un error inesperado muestra el código para reportarlo y permite reintentar', async () => {
    const original = AccessApprovalsClient.prototype.listPending;
    let roto = true;
    vi.spyOn(AccessApprovalsClient.prototype, 'listPending').mockImplementation(function (
      this: AccessApprovalsClient,
    ) {
      return roto
        ? throwError(
            () =>
              new HttpErrorResponse({
                status: 500,
                error: {
                  statusCode: 500,
                  code: 'INTERNAL',
                  message: 'Falló',
                  correlationId: 'req-500',
                },
              }),
          )
        : original.call(this);
    });
    await montar('suarez', '/my-team/approvals');
    expect(host().textContent).toContain('req-500');

    roto = false;
    await click(
      Array.from(host().querySelectorAll('button')).find((b) =>
        b.textContent!.includes('Reintentar'),
      ) ?? null,
    );
    expect(byId(`aprobacion-${DE_MARCOS}`)).not.toBeNull();
  });
});
