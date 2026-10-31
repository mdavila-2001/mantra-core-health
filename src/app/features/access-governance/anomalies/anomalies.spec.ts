import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  AccessGovernanceClient,
  type Anomaly,
  type AnomalyList,
} from '../../../core/data-access/access-governance';
import { anomalias } from '../../../core/mock/fixtures/support-hospital-governance';
import { reiniciarElGobiernoDeAccesos } from '../../../core/mock/handlers/mock-reset';
import { uuid } from '../../../core/mock/mock-store';
import { auditarA11y, describirViolaciones } from '../../../../testing/a11y';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { chooseSelectOption } from '../../../../testing/select';
import { Anomalies } from './anomalies';

const MARCOS = uuid('demo-gov-anomaly-marcos');
const PABLO = uuid('demo-gov-anomaly-pablo');

const apiError = (
  status: number,
  code: string,
  message: string,
  reason?: string,
): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: {
      statusCode: status,
      code,
      message,
      correlationId: 'req-88',
      ...(reason === undefined ? {} : { reason, details: { reason } }),
      timestamp: '',
      path: '/x',
    },
  });

const anomaly = (n: number, extra: Partial<Anomaly> = {}): Anomaly => ({
  id: `an-${n}`,
  userId: `u-${n}`,
  userName: `Persona ${String(n).padStart(2, '0')}`,
  kind: 'ANOMALY_CANCEL_SPIKE',
  status: 'OPEN',
  windowStart: new Date(Date.UTC(2026, 10, 1, n % 24, 0)).toISOString(),
  windowEnd: new Date(Date.UTC(2026, 10, 1, (n % 24) + 1, 0)).toISOString(),
  observed: 10 + n,
  baseline: 4,
  threshold: 12,
  evidence: {
    cancelsInWindow: 10 + n,
    dailyAverage: 4,
    baselineDays: 28,
    atom: 'agenda.appointment.cancel',
  },
  ...extra,
});

describe('Anomalies', () => {
  let fixture: ComponentFixture<Anomalies>;
  let client: AccessGovernanceClient;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => el().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const click = async (id: string): Promise<void> => {
    (byId(id) as HTMLElement).click();
    await settle();
  };
  const write = async (id: string, value: string): Promise<void> => {
    const host = byId(id) as HTMLElement;
    const field = (
      host.matches('textarea,input') ? host : host.querySelector('textarea,input')
    ) as HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const mount = async (
    list?: () => ReturnType<AccessGovernanceClient['listAnomalies']>,
  ): Promise<void> => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideGovernanceMock('hospital_piloto')],
    });
    client = TestBed.inject(AccessGovernanceClient);
    if (list !== undefined) vi.spyOn(client, 'listAnomalies').mockImplementation(list);
    fixture = TestBed.createComponent(Anomalies);
    await settle();
  };
  const listOf =
    (items: readonly Anomaly[]) => (): ReturnType<AccessGovernanceClient['listAnomalies']> =>
      of({ items, count: items.length } satisfies AnomalyList);

  beforeEach(() => {
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
  });

  describe('la lista', () => {
    it('pide las anomalías abiertas y las muestra en una tabla con título, encabezados, persona, qué pasó y estado en palabras', async () => {
      await mount();
      expect(
        peticiones.filter((p) => p.method === 'GET' && p.path === '/org/governance/anomalies'),
      ).toHaveLength(1);
      expect(el().querySelector('table caption')?.textContent).toContain('Anomalías');
      const headers = Array.from(el().querySelectorAll('table th[scope="col"]')).map((h) =>
        h.textContent?.replace(/[▲▼↕]/g, '').trim(),
      );
      expect(headers).toEqual(
        expect.arrayContaining(['Persona', 'Qué se detectó', 'Ventana', 'Estado']),
      );
      expect(el().querySelectorAll('[data-testid="tabla-fila"]')).toHaveLength(2);
      expect(byId(`anomaly-person-${MARCOS}`)?.textContent).toContain('Marcos Ribera');
      expect(byId(`anomaly-kind-${MARCOS}`)?.textContent).toContain(
        'Muchas búsquedas de pacientes',
      );
      expect(byId(`anomaly-status-${MARCOS}`)?.textContent).toContain('Abierta');
      expect(byId(`anomaly-kind-${PABLO}`)?.textContent).toContain('Cuenta sin uso');
    });

    it('no muestra el identificador técnico de la persona', async () => {
      await mount();
      expect(el().textContent).not.toContain('u-');
      expect(el().textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    });

    it('ordena por una columna con su botón y lo anuncia en aria-sort', async () => {
      await mount();
      const byPerson = el().querySelector(
        '[data-testid="tabla-ordenar"][data-columna="person"]',
      ) as HTMLButtonElement;
      byPerson.click();
      await settle();
      const th = byPerson.closest('th')!;
      expect(th.getAttribute('aria-sort')).toBe('ascending');
      const names = Array.from(el().querySelectorAll('[data-testid^="anomaly-person-"]')).map((n) =>
        n.textContent?.trim(),
      );
      expect(names[0]).toContain('Marcos');
      byPerson.click();
      await settle();
      expect(th.getAttribute('aria-sort')).toBe('descending');
      expect(
        Array.from(el().querySelectorAll('[data-testid^="anomaly-person-"]'))[0]!.textContent,
      ).toContain('Pablo');
    });

    it('pagina de diez en diez con «Anterior» y «Siguiente» y dice en qué página está', async () => {
      await mount(listOf(Array.from({ length: 12 }, (_, i) => anomaly(i + 1))));
      expect(el().querySelectorAll('[data-testid="tabla-fila"]')).toHaveLength(10);
      expect(byId('tabla-resumen')?.textContent).toContain('Página 1 de 2');
      expect(byId('tabla-resumen')?.textContent).toContain('12');
      await click('tabla-siguiente');
      expect(el().querySelectorAll('[data-testid="tabla-fila"]')).toHaveLength(2);
      expect(byId('tabla-resumen')?.textContent).toContain('Página 2 de 2');
      await click('tabla-anterior');
      expect(el().querySelectorAll('[data-testid="tabla-fila"]')).toHaveLength(10);
    });

    it('filtra por estado y por tipo: el cliente recibe los filtros y la lista se recarga', async () => {
      await mount();
      const spy = vi.spyOn(client, 'listAnomalies');
      await chooseSelectOption(fixture, byId('anomaly-filter-status')!, 'Todas');
      expect(spy).toHaveBeenLastCalledWith({});
      await chooseSelectOption(fixture, byId('anomaly-filter-kind')!, 'Cuenta sin uso');
      expect(spy).toHaveBeenLastCalledWith({ kind: 'ANOMALY_INACTIVE_ACCOUNT' });
      expect(el().querySelectorAll('[data-testid="tabla-fila"]')).toHaveLength(1);
      expect(byId(`anomaly-person-${PABLO}`)).not.toBeNull();
    });
  });

  describe('el detalle y la evidencia', () => {
    it('al abrir una anomalía muestra su evidencia en barras, con la línea base y la descripción en texto', async () => {
      await mount();
      await click(`anomaly-view-${MARCOS}`);
      const detail = byId('anomaly-detail')!;
      expect(detail.textContent).toContain('Marcos Ribera');
      expect(byId('anomaly-description')?.textContent).toContain(
        'se observó 18, lo habitual es 4 y el umbral de la organización es 15',
      );
      expect(detail.querySelectorAll('[data-testid="anomaly-bar"]')).toHaveLength(3);
      expect(byId('anomaly-baseline')?.textContent).toContain('4');
      expect(detail.textContent).toContain('Observado');
      expect(detail.textContent).toContain('18');
      expect(detail.textContent).toContain('Umbral');
      expect(detail.textContent).toContain('15');
      // La barra que supera el umbral lo dice con texto, no solo con color.
      const bars = Array.from(detail.querySelectorAll('[data-testid="anomaly-bar"]'));
      // La API no manda serie: la pantalla arma tres barras (observado, habitual, umbral) y solo la observada puede superar.
      expect(bars[0]!.textContent).toContain('Observado');
      expect(bars[0]!.textContent).toContain('supera el umbral');
      expect(bars.slice(1).some((b) => b.textContent?.includes('supera el umbral'))).toBe(false);
      expect(byId(`anomaly-view-${MARCOS}`)?.getAttribute('aria-pressed')).toBe('true');
    });

    it('una evidencia sin serie (la que manda la API real) se dibuja con lo observado, lo habitual y el umbral, y se describe', async () => {
      await mount(listOf([anomaly(1)]));
      await click('anomaly-view-an-1');
      expect(el().querySelectorAll('[data-testid="anomaly-bar"]')).toHaveLength(3);
      expect(byId('anomaly-description')?.textContent).toContain('Muchas cancelaciones');
      expect(byId('anomaly-description')?.textContent).toContain('11');
      expect(byId('anomaly-description')?.textContent).toContain('umbral');
    });
  });

  describe('reconocer, descartar y escalar', () => {
    it('reconocer no pide comentario: manda la petición, recarga la lista y el detalle queda como «Reconocida»', async () => {
      await mount();
      await click(`anomaly-view-${MARCOS}`);
      olvidarPeticiones();
      await click('anomaly-ack');
      const post = peticiones.find((p) => p.method === 'POST');
      expect(post).toMatchObject({
        path: `/org/governance/anomalies/${MARCOS}/ack`,
        status: 200,
        body: { status: 'ACKNOWLEDGED' },
      });
      expect(peticiones.at(-1)).toMatchObject({ method: 'GET', path: '/org/governance/anomalies' });
      expect(anomalias.get(MARCOS)?.status).toBe('ACKNOWLEDGED');
      expect(byId(`anomaly-person-${MARCOS}`)).toBeNull();
      expect(byId('anomaly-detail-status')?.textContent).toContain('Reconocida');
      expect(byId('anomaly-ack')).toBeNull();
    });

    it('reconocer con comentario lo envía', async () => {
      await mount();
      await click(`anomaly-view-${MARCOS}`);
      await write('anomaly-comment', 'Fue la campaña de recordatorios.');
      olvidarPeticiones();
      await click('anomaly-ack');
      expect(peticiones.find((p) => p.method === 'POST')?.body).toEqual({
        status: 'ACKNOWLEDGED',
        comment: 'Fue la campaña de recordatorios.',
      });
    });

    it.each([
      ['anomaly-dismiss', 'DISMISSED', 'Descartada'],
      ['anomaly-escalate', 'ESCALATED', 'Escalada'],
    ])(
      '%s exige un comentario de al menos 10 caracteres: sin él no sale ninguna petición y el campo lo explica',
      async (button, status, text) => {
        await mount();
        await click(`anomaly-view-${PABLO}`);
        olvidarPeticiones();
        await click(button);
        expect(peticiones.filter((p) => p.method === 'POST')).toHaveLength(0);
        const error = el().querySelector('.form-field-error');
        expect(error?.textContent).toContain('al menos 10 caracteres');
        const field = byId('anomaly-comment')!.querySelector('textarea')!;
        expect(field.getAttribute('aria-invalid')).toBe('true');

        await write('anomaly-comment', 'corto');
        await click(button);
        expect(peticiones.filter((p) => p.method === 'POST')).toHaveLength(0);

        await write('anomaly-comment', '  La cuenta ya no se usa y se dará de baja.  ');
        await click(button);
        const post = peticiones.find((p) => p.method === 'POST')!;
        expect(post.body).toEqual({ status, comment: 'La cuenta ya no se usa y se dará de baja.' });
        expect(anomalias.get(PABLO)?.status).toBe(status);
        expect(byId('anomaly-detail-status')?.textContent).toContain(text);
        expect(byId('anomaly-detail')?.textContent).toContain(
          'La cuenta ya no se usa y se dará de baja.',
        );
      },
    );

    it('si la anomalía ya se atendió en otro lado, muestra el motivo del servidor y recarga la lista', async () => {
      await mount();
      await click(`anomaly-view-${MARCOS}`);
      vi.spyOn(client, 'resolveAnomaly').mockReturnValue(
        throwError(() =>
          apiError(409, 'CONFLICT', 'Esta alerta ya se atendió.', 'ANOMALY_ALREADY_RESOLVED'),
        ),
      );
      const spy = vi.spyOn(client, 'listAnomalies');
      await click('anomaly-ack');
      expect(byId('anomaly-error')?.textContent).toContain('Esta alerta ya se atendió.');
      expect(byId('anomaly-error')?.getAttribute('role')).toBe('alert');
      expect(spy).toHaveBeenCalled();
    });

    it('mientras la petición va, los botones se deshabilitan para no resolver dos veces', async () => {
      await mount();
      await click(`anomaly-view-${MARCOS}`);
      vi.spyOn(client, 'resolveAnomaly').mockReturnValue(new Observable<never>(() => undefined));
      (byId('anomaly-ack') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(byId('anomaly-ack')!.getAttribute('aria-disabled')).toBe('true');
      expect(byId('anomaly-dismiss')!.getAttribute('aria-disabled')).toBe('true');
      expect(byId('anomaly-escalate')!.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('los estados', () => {
    it('S3: sin anomalías abiertas dice «Todo tranquilo» y propone volver al tablero', async () => {
      await mount(listOf([]));
      expect(el().textContent).toContain('No hay anomalías abiertas');
      expect(el().querySelector('a[href="/administration/access-governance"]')).not.toBeNull();
    });

    it('S3: resolver las dos abiertas deja la lista vacía con su próxima acción (UI → petición → respuesta → recarga → UI)', async () => {
      await mount();
      for (const id of [MARCOS, PABLO]) {
        await click(`anomaly-view-${id}`);
        await click('anomaly-ack');
      }
      expect(el().querySelectorAll('[data-testid="tabla-fila"]')).toHaveLength(0);
      expect(el().textContent).toContain('No hay anomalías abiertas');
    });

    it('S3 con filtro: sin resultados para ese estado propone ver las abiertas', async () => {
      await mount();
      await chooseSelectOption(fixture, byId('anomaly-filter-status')!, 'Descartadas');
      expect(el().textContent).toContain('No hay anomalías con ese filtro');
      expect(
        el().querySelector('a[href="/administration/access-governance/anomalies?status=OPEN"]'),
      ).not.toBeNull();
    });

    it('S5: sin permiso lo dice y no muestra la tabla', async () => {
      await mount(() =>
        throwError(() => apiError(403, 'FORBIDDEN', 'No tiene permiso para esta operación.')),
      );
      expect(el().textContent).toContain('No tiene permiso');
      expect(el().querySelector('table')).toBeNull();
    });

    it('S7: si al actualizar se pierde la conexión, conserva lo que ya tenía y dice a qué hora es', async () => {
      await mount();
      vi.spyOn(client, 'listAnomalies').mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })),
      );
      await click('anomalies-refresh');
      expect(el().textContent).toContain('pueden estar atrasados');
      expect(el().textContent).toMatch(/Información al \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
      expect(byId(`anomaly-person-${MARCOS}`)).not.toBeNull();
    });

    it('S8: sin conexión ofrece reintentar y al reintentar pinta la lista', async () => {
      const list = vi.fn<() => Observable<AnomalyList>>(() =>
        throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })),
      );
      await mount(list);
      const retry = Array.from(el().querySelectorAll('button')).find((b) =>
        /reintentar/i.test(b.textContent ?? ''),
      )!;
      expect(retry).toBeDefined();
      list.mockImplementation(listOf([anomaly(1)]));
      retry.click();
      await settle();
      expect(el().querySelectorAll('[data-testid="tabla-fila"]')).toHaveLength(1);
    });

    it('S9: un error inesperado muestra el código de la petición', async () => {
      await mount(() => throwError(() => apiError(500, 'INTERNAL', 'Fallo')));
      expect(el().textContent).toContain('req-88');
    });
  });

  it('no tiene violaciones de accesibilidad que una máquina pueda ver (lista y detalle abiertos)', async () => {
    await mount();
    await click(`anomaly-view-${MARCOS}`);
    const violaciones = await auditarA11y(el());
    expect(violaciones, describirViolaciones(violaciones)).toEqual([]);
  });
});
