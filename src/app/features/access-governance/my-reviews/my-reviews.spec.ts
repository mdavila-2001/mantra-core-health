import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { AccessReviewsClient } from '../../../core/data-access/access-governance/access-reviews.client';
import type { ReviewItem } from '../../../core/data-access/access-governance/access-reviews.types';
import {
  ADMIN_PRINCIPAL,
  GENTE,
  itemsDeRevision,
} from '../../../core/mock/fixtures/support-hospital-governance';
import { reiniciarElGobiernoDeAccesos } from '../../../core/mock/handlers/mock-reset';
import { uuid } from '../../../core/mock/mock-store';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { MyReviews } from './my-reviews';

/**
 * Mis revisiones, contra el backend simulado de verdad (sin latencia): lo que se hace en pantalla sale por el `HttpClient`,
 * lo atiende el mismo enrutador del simulador y la pantalla vuelve a leer. La misma clase sirve en `/my-reviews` y en
 * `/my-team/reviews`.
 */
const ID_SOFIA = uuid('demo-gov-item-sofia');
const ID_MARIO = uuid('demo-gov-item-mario');
const ID_MARCOS = uuid('demo-gov-item-marcos-eco');
const ID_ANA = uuid('demo-gov-item-ana-rojas');

const RUTAS = [
  { path: 'my-reviews', component: MyReviews },
  { path: 'my-reviews/:itemId', component: MyReviews },
  { path: 'my-team/reviews', component: MyReviews },
  { path: 'my-team/reviews/:itemId', component: MyReviews },
];

/** Un acceso pendiente para el administrador (para armar lotes). */
function pendiente(
  clave: string,
  nombre: string,
  sensibilidad: ReviewItem['maxSensitivity'] = 'LOW',
): string {
  const id = uuid(`spec-lote-${clave}`);
  itemsDeRevision.agregar({
    id,
    campaignId: uuid('demo-gov-campaign-q4'),
    campaignName: 'Certificación Q4-2026',
    engagementId: GENTE.lucia.engagementId,
    grantId: uuid(`spec-lote-grant-${clave}`),
    subjectUserId: GENTE.lucia.userId,
    subjectName: nombre,
    reviewerKind: 'ADMIN',
    state: 'PENDING',
    dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    escalated: false,
    reminderCount: 0,
    maxSensitivity: sensibilidad,
    reviewerUserId: ADMIN_PRINCIPAL.userId,
  });
  return id;
}

/** Deja el uso de un acceso como se necesita: con uso reciente en todo, o con un permiso sin uso. */
function conUso(id: string, usos: readonly { atom: string; permit: number }[]): void {
  const actual = itemsDeRevision.get(id)!;
  itemsDeRevision.actualizar(id, {
    evidence: {
      ...actual.evidence,
      usage90d: usos.map((u) => ({
        atom: u.atom,
        permit: u.permit,
        deny: 0,
        lastUsedAt: u.permit > 0 ? new Date().toISOString() : null,
      })),
    },
  });
}

const apiError = (
  status: number,
  code: string,
  reason: string,
  extra: Record<string, unknown> = {},
): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: {
      statusCode: status,
      code,
      message: 'x',
      reason,
      details: { reason, ...extra },
      correlationId: 'req-777',
      timestamp: '',
      path: '/x',
    },
  });

describe('MyReviews', () => {
  let fixture: ComponentFixture<MyReviews>;
  let harness: RouterTestingHarness;
  let confirmar: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const texto = (id: string): string => byId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const refrescar = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  const clic = async (id: string): Promise<void> => {
    const el = byId(id);
    if (el === null) throw new Error(`No existe ${id}`);
    (el.matches('input,button,a')
      ? el
      : (el.querySelector('input,button,a') as HTMLElement)
    ).click();
    await refrescar();
  };
  const escribir = async (id: string, valor: string): Promise<void> => {
    const el = byId(id) as HTMLElement;
    const campo = (
      el.matches('input,textarea') ? el : el.querySelector('input,textarea')
    ) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await refrescar();
  };
  const marcada = (id: string): boolean =>
    (byId(id)!.querySelector('input') as HTMLInputElement).checked;

  async function abrir(url: string, cuenta = 'hospital_piloto'): Promise<void> {
    confirmar = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideRouter(RUTAS),
        ...provideGovernanceMock(cuenta),
        { provide: DialogService, useValue: { confirm: confirmar } },
      ],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, MyReviews);
    fixture = harness.fixture as unknown as ComponentFixture<MyReviews>;
    await refrescar();
  }

  beforeEach(() => {
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
  });

  describe('la lista del revisor', () => {
    it('muestra primero lo pendiente, con el riesgo dicho en palabras, el vencimiento y si está escalado', async () => {
      await abrir('/my-reviews');
      expect(host().textContent).toContain('Mis revisiones');
      expect(byId(`revision-tarjeta-${ID_SOFIA}`)).not.toBeNull();
      expect(texto(`revision-persona-${ID_SOFIA}`)).toContain('Sofía Camacho');
      expect(texto(`revision-riesgo-${ID_SOFIA}`)).toBe('Riesgo alto');
      expect(texto(`revision-estado-${ID_SOFIA}`)).toBe('Pendiente');
      expect(texto(`revision-vence-${ID_SOFIA}`)).toContain('Venció hace 4 días');
      expect(byId(`revision-escalado-${ID_SOFIA}`)).not.toBeNull();
      // Lo ya decidido no está en «Pendientes».
      expect(byId(`revision-tarjeta-${ID_MARIO}`)).toBeNull();
      expect(byId(`revision-abrir-${ID_SOFIA}`)?.getAttribute('href')).toBe(
        `/my-reviews/${ID_SOFIA}`,
      );
    });

    it('el filtro lee otra vez a la API: «Ya revisadas» trae lo decidido con su estado', async () => {
      await abrir('/my-reviews');
      olvidarPeticiones();
      const boton = byId('revisiones-filtro')!.querySelector(
        '[data-value="DECIDED"]',
      ) as HTMLElement;
      boton.click();
      await refrescar();
      expect(
        peticiones.some((p) => p.method === 'GET' && p.path === '/me/access-reviews/items'),
      ).toBe(true);
      expect(texto(`revision-estado-${ID_MARIO}`)).toBe('Mantenido');
      expect(byId(`revision-tarjeta-${ID_SOFIA}`)).toBeNull();
    });

    it('en «Mi equipo» del doctor los enlaces cuelgan de /my-team/reviews', async () => {
      await abrir('/my-team/reviews', 'perez');
      expect(byId(`revision-tarjeta-${ID_ANA}`)).not.toBeNull();
      expect(byId(`revision-abrir-${ID_ANA}`)?.getAttribute('href')).toBe(
        `/my-team/reviews/${ID_ANA}`,
      );
    });

    it('sin nada por revisar es un vacío con su próxima acción (S3)', async () => {
      await abrir('/my-reviews', 'ana');
      expect(host().textContent).toContain('No tiene accesos por revisar');
      expect(host().querySelector('a[href^="/my-reviews"]')?.textContent).toContain(
        'Ver las ya revisadas',
      );
    });

    it('un fallo del servidor se explica con el código de soporte (S9)', async () => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter(RUTAS),
          {
            provide: AccessReviewsClient,
            useValue: { listMyItems: () => throwError(() => apiError(500, 'INTERNAL', 'X')) },
          },
        ],
      });
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/my-reviews', MyReviews);
      fixture = harness.fixture as unknown as ComponentFixture<MyReviews>;
      await refrescar();
      expect(host().textContent).toContain('req-777');
    });

    it('sin conexión ofrece reintentar (S8)', async () => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter(RUTAS),
          {
            provide: AccessReviewsClient,
            useValue: { listMyItems: () => throwError(() => new HttpErrorResponse({ status: 0 })) },
          },
        ],
      });
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/my-reviews', MyReviews);
      fixture = harness.fixture as unknown as ComponentFixture<MyReviews>;
      await refrescar();
      expect(host().textContent).toMatch(/conexi/i);
    });
  });

  describe('el detalle con la evidencia', () => {
    it('muestra qué puede hacer la persona, cuánto lo usó en 90 días, alertas, conflictos y la última certificación', async () => {
      await abrir(`/my-reviews/${ID_MARCOS}`, 'sofia');
      expect(texto('evidencia-resumen')).toContain('Marcos Ribera puede ver la agenda');
      expect(texto('evidencia-permisos')).toContain('agenda.appointment.create');
      expect(texto('uso-agenda.appointment.view')).toContain('60');
      expect(texto('evidencia-alertas')).toContain('Sin alertas abiertas');
      expect(texto('evidencia-sod')).toContain('Sin conflictos de funciones');
      expect(texto('evidencia-techo')).toContain('Dentro del techo');
      expect(texto('evidencia-ultima')).toContain('Nunca se ha certificado');
      expect(texto('evidencia-sensibilidad')).toContain('Riesgo medio');
      expect(texto('revision-escalado-detalle')).toContain('Escalado');
    });

    it('marca el permiso que no se usó en 90 días y el comentario pasa a ser obligatorio', async () => {
      conUso(ID_MARCOS, [
        { atom: 'agenda.appointment.view', permit: 60 },
        { atom: 'agenda.appointment.create', permit: 0 },
      ]);
      await abrir(`/my-reviews/${ID_MARCOS}`, 'sofia');
      expect(texto('uso-sin-uso-agenda.appointment.create')).toContain('Sin uso');
      expect(texto('decision-aviso-comentario')).toContain('obligatorio');
    });

    it('un acceso ajeno se ve como «no encontrado», igual que uno que no existe (S6)', async () => {
      await abrir(`/my-reviews/${ID_MARIO}`, 'sofia');
      expect(host().textContent).toContain('No encontramos lo que busca');
      expect(byId('evidencia-resumen')).toBeNull();
      expect(host().querySelector('a[href="/my-reviews"]')).not.toBeNull();
    });

    it('se entra desde la lista con el enlace de cada tarjeta y se vuelve con «Volver a mis revisiones»', async () => {
      await abrir('/my-reviews');
      await clic(`revision-abrir-${ID_SOFIA}`);
      fixture = harness.fixture as unknown as ComponentFixture<MyReviews>;
      await refrescar();
      expect(TestBed.inject(Router).url).toBe(`/my-reviews/${ID_SOFIA}`);
      expect(texto('evidencia-resumen')).toContain('Sofía Camacho administra al equipo');
      expect(host().querySelector('a[href="/my-reviews"]')?.textContent).toContain(
        'Volver a mis revisiones',
      );
    });
  });

  describe('decidir', () => {
    it('mantener lo de riesgo ALTO exige comentario: sin él no sale ninguna petición; con él se envía, se vuelve a leer y se ve el resultado', async () => {
      await abrir(`/my-reviews/${ID_SOFIA}`);
      expect(texto('decision-aviso-comentario')).toContain('obligatorio');
      await clic('decision-mantener');
      await clic('decision-enviar');
      expect(texto('decision-comentario-error')).toContain('Escriba al menos 10 caracteres');
      expect(peticiones.some((p) => p.method === 'POST')).toBe(false);

      await escribir('decision-comentario', 'Administra al equipo de Ecografía y lo usa a diario.');
      olvidarPeticiones();
      await clic('decision-enviar');

      const pedido = peticiones.find((p) => p.method === 'POST');
      expect(pedido?.path).toBe(`/me/access-reviews/items/${ID_SOFIA}/decision`);
      expect(pedido?.body).toEqual({
        decision: 'CERTIFY',
        comment: 'Administra al equipo de Ecografía y lo usa a diario.',
      });
      expect(pedido?.status).toBe(200);
      expect(
        peticiones.filter(
          (p) => p.method === 'GET' && p.path === `/me/access-reviews/items/${ID_SOFIA}`,
        ),
      ).toHaveLength(1);
      expect(itemsDeRevision.get(ID_SOFIA)?.state).toBe('CERTIFIED');
      expect(texto('revision-estado-detalle')).toBe('Mantenido');
      expect(texto('decision-resultado')).toContain('Mantuvo este acceso');
      expect(byId('decision-mantener')).toBeNull();
      expect(texto('decision-hecha')).toContain('Administra al equipo de Ecografía');
    });

    it('al elegir una decisión el foco pasa al comentario, y si falta se vuelve a él', async () => {
      await abrir(`/my-reviews/${ID_MARCOS}`, 'sofia');
      await clic('decision-quitar');
      const area = byId('decision-comentario')!.querySelector('textarea');
      expect(document.activeElement).toBe(area);
      (document.activeElement as HTMLElement).blur();
      await clic('decision-enviar');
      expect(document.activeElement).toBe(area);
    });

    it('quitar siempre pide comentario y la API deja el acceso en «Quitado»', async () => {
      await abrir(`/my-reviews/${ID_MARCOS}`, 'sofia');
      await clic('decision-quitar');
      expect(texto('decision-aviso-comentario')).toContain('obligatorio');
      await clic('decision-enviar');
      expect(byId('decision-comentario-error')).not.toBeNull();
      await escribir('decision-comentario', 'Ya no atiende en Ecografía.');
      await clic('decision-enviar');
      expect(peticiones.find((p) => p.method === 'POST')?.body).toEqual({
        decision: 'REVOKE',
        comment: 'Ya no atiende en Ecografía.',
      });
      expect(itemsDeRevision.get(ID_MARCOS)?.state).toBe('REVOKED');
      expect(texto('revision-estado-detalle')).toBe('Quitado');
    });

    it('mantener lo de riesgo medio con uso reciente es un clic: el comentario es opcional', async () => {
      conUso(ID_MARCOS, [
        { atom: 'agenda.appointment.view', permit: 60 },
        { atom: 'agenda.appointment.create', permit: 4 },
      ]);
      await abrir(`/my-reviews/${ID_MARCOS}`, 'sofia');
      expect(byId('decision-aviso-comentario')).toBeNull();
      await clic('decision-mantener');
      await clic('decision-enviar');
      expect(peticiones.find((p) => p.method === 'POST')?.body).toEqual({ decision: 'CERTIFY' });
      expect(itemsDeRevision.get(ID_MARCOS)?.state).toBe('CERTIFIED');
    });

    it('si la API pide comentario aunque la pantalla no lo exigía (REVIEW_COMMENT_REQUIRED: el permiso no se usó según SU registro), desde ahí se exige y no se vuelve a mandar sin él (B7c)', async () => {
      conUso(ID_MARCOS, [
        { atom: 'agenda.appointment.view', permit: 60 },
        { atom: 'agenda.appointment.create', permit: 4 },
      ]);
      await abrir(`/my-reviews/${ID_MARCOS}`, 'sofia');
      expect(byId('decision-aviso-comentario')).toBeNull();
      const decideItem = vi
        .spyOn(TestBed.inject(AccessReviewsClient), 'decideItem')
        .mockReturnValueOnce(
          throwError(() => apiError(422, 'PRECONDITION_FAILED', 'REVIEW_COMMENT_REQUIRED')),
        );
      await clic('decision-mantener');
      await clic('decision-enviar');
      expect(decideItem).toHaveBeenCalledOnce();
      // La API sabe más que la evidencia: ahora el comentario es obligatorio y el error sale junto al campo.
      expect(byId('decision-aviso-comentario')).not.toBeNull();
      expect(texto('decision-comentario-error')).toContain('Escriba al menos 10 caracteres');
      await clic('decision-enviar');
      expect(decideItem).toHaveBeenCalledOnce();
    });

    it('ajustar solo permite quitar permisos o acortar la vigencia; deja el acceso en «Ajustado» con lo que se conservó', async () => {
      await abrir(`/my-reviews/${ID_MARCOS}`, 'sofia');
      await clic('decision-ajustar');
      // Nada cambiado todavía: no se puede enviar un ajuste que deja todo igual.
      await escribir('decision-comentario', 'Solo necesita ver la agenda.');
      await clic('decision-enviar');
      expect(texto('decision-ajuste-error')).toContain('Quite algún permiso');
      expect(peticiones.some((p) => p.method === 'POST')).toBe(false);

      await clic('ajuste-permiso-agenda.appointment.create');
      await clic('decision-enviar');
      const pedido = peticiones.find((p) => p.method === 'POST');
      expect(pedido?.body).toEqual({
        decision: 'ADJUST',
        comment: 'Solo necesita ver la agenda.',
        adjustment: { atoms: ['agenda.appointment.view'] },
      });
      expect(itemsDeRevision.get(ID_MARCOS)?.state).toBe('ADJUSTED');
      expect(texto('revision-estado-detalle')).toBe('Ajustado');
    });

    it('un ajuste no ofrece agregar permisos: solo están los que la persona ya tiene', async () => {
      await abrir(`/my-reviews/${ID_MARCOS}`, 'sofia');
      await clic('decision-ajustar');
      const ofrecidos = [...host().querySelectorAll('[data-testid^="ajuste-permiso-"]')].map((e) =>
        e.getAttribute('data-testid'),
      );
      expect(ofrecidos).toEqual([
        'ajuste-permiso-agenda.appointment.view',
        'ajuste-permiso-agenda.appointment.create',
      ]);
    });

    it('si la API rechaza la decisión muestra su motivo en lenguaje simple y el código de soporte, sin perder lo escrito', async () => {
      await abrir(`/my-reviews/${ID_MARCOS}`, 'sofia');
      const decideItem = vi
        .spyOn(TestBed.inject(AccessReviewsClient), 'decideItem')
        .mockReturnValue(
          throwError(() => apiError(422, 'PRECONDITION_FAILED', 'REVIEW_ADJUST_CANNOT_BROADEN')),
        );
      await clic('decision-quitar');
      await escribir('decision-comentario', 'Ya no atiende en Ecografía.');
      await clic('decision-enviar');
      expect(decideItem).toHaveBeenCalledOnce();
      expect(texto('decision-error')).toContain('Un ajuste solo puede reducir permisos');
      expect(texto('decision-error')).toContain('req-777');
      expect(
        (byId('decision-comentario')!.querySelector('textarea') as HTMLTextAreaElement).value,
      ).toBe('Ya no atiende en Ecografía.');
    });

    it('si el acceso ya lo decidió otra persona, lo dice y vuelve a leerlo (409)', async () => {
      await abrir(`/my-reviews/${ID_MARCOS}`, 'sofia');
      itemsDeRevision.actualizar(ID_MARCOS, {
        state: 'CERTIFIED',
        decidedAt: new Date().toISOString(),
      });
      await clic('decision-quitar');
      await escribir('decision-comentario', 'Ya no atiende en Ecografía.');
      await clic('decision-enviar');
      expect(texto('decision-error')).toContain('Ese acceso ya fue revisado');
      expect(texto('revision-estado-detalle')).toBe('Mantenido');
      expect(byId('decision-enviar')).toBeNull();
    });
  });

  describe('decisión en lote', () => {
    it('«Elegir los de bajo riesgo» marca solo lo LOW y MEDIUM, y mantenerlos es todo o nada en una sola petición', async () => {
      const a = pendiente('a', 'Ana Lote');
      const b = pendiente('b', 'Beto Lote', 'MEDIUM');
      await abrir('/my-reviews');
      await clic('revisiones-bajo-riesgo');
      expect(marcada(`revision-marcar-${a}`)).toBe(true);
      expect(marcada(`revision-marcar-${b}`)).toBe(true);
      expect(marcada(`revision-marcar-${ID_SOFIA}`)).toBe(false);
      expect(texto('revisiones-seleccionadas')).toContain('2 seleccionados');

      olvidarPeticiones();
      await clic('revisiones-mantener-lote');
      expect(confirmar).toHaveBeenCalledOnce();
      const pedido = peticiones.find((p) => p.path === '/me/access-reviews/items/bulk-decision');
      expect(pedido?.body).toEqual({ itemIds: [a, b], decision: 'CERTIFY' });
      expect(pedido?.status).toBe(200);
      expect(itemsDeRevision.get(a)?.state).toBe('CERTIFIED');
      expect(itemsDeRevision.get(b)?.state).toBe('CERTIFIED');
      // Se volvió a leer la lista: lo mantenido ya no está entre lo pendiente.
      expect(byId(`revision-tarjeta-${a}`)).toBeNull();
      expect(texto('revisiones-resultado')).toContain('Se mantuvieron 2 accesos');
    });

    it('si uno de los elegidos no es de bajo riesgo la API rechaza todo, no cambia nada y la pantalla señala cuáles lo impiden (REVIEW_BULK_NOT_ALLOWED)', async () => {
      const a = pendiente('c', 'Carla Lote');
      await abrir('/my-reviews');
      await clic('revisiones-bajo-riesgo');
      // Se suma a mano el de riesgo alto.
      await clic(`revision-marcar-${ID_SOFIA}`);
      olvidarPeticiones();
      await clic('revisiones-mantener-lote');

      const pedido = peticiones.find((p) => p.path === '/me/access-reviews/items/bulk-decision');
      expect(pedido?.status).toBe(422);
      expect(itemsDeRevision.get(a)?.state).toBe('PENDING');
      expect(itemsDeRevision.get(ID_SOFIA)?.state).toBe('PENDING');
      const error = texto('revisiones-lote-error');
      expect(error).toContain('Solo se pueden mantener en bloque los accesos de bajo riesgo');
      expect(error).toContain('No se mantuvo ninguno');
      expect(texto(`revisiones-lote-impide-${ID_SOFIA}`)).toContain('Sofía Camacho');
      expect(byId(`revisiones-lote-impide-${a}`)).toBeNull();
      expect(byId(`revision-impide-${ID_SOFIA}`)).not.toBeNull();
      expect(
        byId(`revisiones-lote-impide-${ID_SOFIA}`)!.querySelector('a')?.getAttribute('href'),
      ).toBe(`/my-reviews/${ID_SOFIA}`);
    });

    it('si no se confirma el cuadro de diálogo no sale ninguna petición', async () => {
      pendiente('d', 'Dora Lote');
      await abrir('/my-reviews');
      confirmar.mockResolvedValue(false);
      await clic('revisiones-bajo-riesgo');
      olvidarPeticiones();
      await clic('revisiones-mantener-lote');
      expect(peticiones.filter((p) => p.method === 'POST')).toEqual([]);
    });

    it('sin nada elegido el botón del lote no se ofrece', async () => {
      await abrir('/my-reviews');
      expect(byId('revisiones-mantener-lote')).toBeNull();
    });
  });
});
