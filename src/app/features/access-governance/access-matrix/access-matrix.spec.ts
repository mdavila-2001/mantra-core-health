import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import { vi } from 'vitest';

import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import {
  AccessExplainClient,
  AccessGovernanceClient,
  type AccessMatrix,
  type PersonMatrix,
  type PersonMatrixRow,
  type TargetMatrix,
} from '../../../core/data-access/access-governance';
import { uuid } from '../../../core/mock/mock-store';
import { GENTE } from '../../../core/mock/fixtures/support-hospital-governance';
import { sellarPasoExtra } from '../../../core/mock/handlers/support-access.governance.core';
import { reiniciarElGobiernoDeAccesos } from '../../../core/mock/handlers/mock-reset';
import { buscarUsuario } from '../../../core/mock/mock-session';
import { FileDownloadService } from '../../../shared/utils/file-download/file-download.service';
import { auditarA11y, describirViolaciones } from '../../../../testing/a11y';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { chooseSelectOption, selectOptionLabels } from '../../../../testing/select';
import { AccessChallengeService } from '../access-challenge/access-challenge.service';
import { AccessMatrix as AccessMatrixScreen } from './access-matrix';

const PEREZ = uuid('hp-doc-perez');
const ADMIN = buscarUsuario('hospital_piloto')!;

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
      correlationId: 'req-55',
      ...(reason === undefined ? {} : { reason, details: { reason } }),
      timestamp: '',
      path: '/x',
    },
  });

const personRow = (n: number, extra: Partial<PersonMatrixRow> = {}): PersonMatrixRow => ({
  userId: `u-${n}`,
  name: `Persona ${String(n).padStart(2, '0')}`,
  engagementId: `eng-${n}`,
  templateCode: n % 2 === 0 ? 'SECRETARY' : 'BILLING_CASHIER',
  state: 'ACTIVE',
  cells: {
    SUPPORT_AGENDA: { status: 'FULL', grantIds: ['g'], conditions: [] },
    SUPPORT_BILLING: { status: n % 2 === 0 ? 'NONE' : 'PARTIAL', grantIds: [], conditions: [] },
  },
  ...extra,
});
const personMatrix = (
  rows: readonly PersonMatrixRow[],
  extra: Partial<PersonMatrix> = {},
): PersonMatrix => ({
  generatedAt: new Date().toISOString(),
  by: 'person',
  group: 'category',
  columns: ['SUPPORT_AGENDA', 'SUPPORT_BILLING'],
  rows,
  ...extra,
});

describe('AccessMatrix', () => {
  let fixture: ComponentFixture<AccessMatrixScreen>;
  let governance: AccessGovernanceClient;

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
  const choose = async (id: string, label: string): Promise<void> =>
    chooseSelectOption(fixture, byId(id)!, label);
  const radio = async (id: string, label: string): Promise<void> => {
    const option = Array.from(byId(id)!.querySelectorAll<HTMLElement>('[role="radio"]')).find(
      (r) => r.textContent?.trim() === label,
    );
    if (option === undefined) throw new Error(`No hay «${label}» en ${id}`);
    option.click();
    await settle();
  };
  const mount = async (
    matrix?: (
      query: Parameters<AccessGovernanceClient['getAccessMatrix']>[0],
    ) => ReturnType<AccessGovernanceClient['getAccessMatrix']>,
  ): Promise<void> => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideGovernanceMock('hospital_piloto')],
    });
    governance = TestBed.inject(AccessGovernanceClient);
    if (matrix !== undefined) vi.spyOn(governance, 'getAccessMatrix').mockImplementation(matrix);
    fixture = TestBed.createComponent(AccessMatrixScreen);
    await settle();
  };
  const realPerson = async (): Promise<PersonMatrix> =>
    (await firstValueFrom(
      governance.getAccessMatrix({ by: 'person', group: 'category' }),
    )) as PersonMatrix;
  const realTarget = async (id = PEREZ): Promise<TargetMatrix> =>
    (await firstValueFrom(governance.getAccessMatrix({ by: 'doctor', id }))) as TargetMatrix;
  const rowTexts = (): string[] =>
    Array.from(el().querySelectorAll('[data-testid="matrix-grid"] tbody th[scope="row"]')).map(
      (th) => th.textContent!.trim(),
    );

  beforeEach(() => {
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
  });

  describe('«Quién tiene qué»', () => {
    it('pide la matriz de personas por categoría y la dibuja como tabla: título, encabezados de columna y de fila', async () => {
      await mount();
      const real = await realPerson();
      expect(
        peticiones.filter((p) => p.path === '/org/governance/access-matrix').length,
      ).toBeGreaterThanOrEqual(1);
      expect(el().querySelector('table caption')?.textContent).toContain('Quién tiene qué');
      const heads = Array.from(
        el().querySelectorAll('[data-testid="matrix-grid"] thead th[scope="col"]'),
      ).map((h) => h.textContent!.replace(/[▲▼↕]/g, '').trim());
      expect(heads).toEqual([
        'Persona',
        'Agenda',
        'Pacientes',
        'Mensajería',
        'Facturación y caja',
        'Reportes',
        'Equipo de apoyo',
        'Auditoría y explicación',
      ]);
      expect(rowTexts()).toHaveLength(Math.min(10, real.rows.length));
    });

    it('cada celda dice su estado con palabras, no solo con color, y hay una leyenda', async () => {
      await mount();
      const real = await realPerson();
      const marcos = real.rows.find((r) => r.engagementId === GENTE.marcos.engagementId)!;
      for (const [column, cell] of Object.entries(marcos.cells)) {
        const text = byId(`matrix-cell-${marcos.engagementId}-${column}`)!.textContent!;
        const expected = {
          FULL: 'Completo',
          CONDITIONAL: 'Con condiciones',
          PARTIAL: 'Parcial',
          NONE: 'Sin acceso',
        }[cell.status];
        expect(text, column).toContain(expected);
      }
      const legend = byId('matrix-legend')!.textContent!;
      for (const word of ['Completo', 'Con condiciones', 'Parcial', 'Sin acceso'])
        expect(legend).toContain(word);
    });

    it('agrupar por permiso individual vuelve a pedir la matriz con group=atom y cambia las columnas', async () => {
      await mount();
      const spy = vi.spyOn(governance, 'getAccessMatrix');
      await radio('matrix-group', 'Permiso individual');
      expect(spy).toHaveBeenLastCalledWith({ by: 'person', group: 'atom' });
      const heads = Array.from(
        el().querySelectorAll('[data-testid="matrix-grid"] thead th[scope="col"]'),
      ).map((h) => h.textContent!);
      expect(heads.some((h) => h.includes('Cancelar citas'))).toBe(true);
    });

    it('filtra por plantilla de rol y por vigencia sin volver a pedir los datos', async () => {
      await mount(() =>
        of(
          personMatrix(
            Array.from({ length: 6 }, (_, i) =>
              personRow(i + 1, i === 5 ? { state: 'SUSPENDED' } : {}),
            ),
          ),
        ),
      );
      const spy = vi.spyOn(governance, 'getAccessMatrix');
      const calls = spy.mock.calls.length;
      expect(rowTexts()).toHaveLength(6);
      await choose('matrix-filter-template', 'Secretaria');
      expect(rowTexts()).toEqual(
        ['Persona 02', 'Persona 04', 'Persona 06'].map((n) => expect.stringContaining(n)),
      );
      await choose('matrix-filter-template', 'Todas las plantillas');
      await choose('matrix-filter-state', 'Suspendidos');
      expect(rowTexts()).toEqual([expect.stringContaining('Persona 06')]);
      expect(spy.mock.calls.length).toBe(calls);
    });

    it('el filtro de sensibilidad esconde las columnas menos sensibles y a quien no tiene nada en las que quedan', async () => {
      await mount(() =>
        of(
          personMatrix([
            personRow(1),
            personRow(2, {
              cells: {
                SUPPORT_AGENDA: { status: 'FULL', grantIds: ['g'], conditions: [] },
                SUPPORT_BILLING: { status: 'NONE', grantIds: [], conditions: [] },
              },
            }),
          ]),
        ),
      );
      await choose('matrix-filter-sensitivity', 'Solo crítica');
      const heads = Array.from(
        el().querySelectorAll('[data-testid="matrix-grid"] thead th[scope="col"]'),
      ).map((h) => h.textContent!);
      expect(heads.join('|')).toContain('Facturación y caja');
      expect(rowTexts()).toEqual([expect.stringContaining('Persona 01')]);
    });

    it('ordena por nombre con su botón y lo anuncia en aria-sort', async () => {
      await mount(() => of(personMatrix([personRow(2), personRow(1), personRow(3)])));
      await click('matrix-sort-name');
      expect(byId('matrix-sort-name')!.closest('th')!.getAttribute('aria-sort')).toBe('ascending');
      expect(rowTexts()[0]).toContain('Persona 01');
      await click('matrix-sort-name');
      expect(byId('matrix-sort-name')!.closest('th')!.getAttribute('aria-sort')).toBe('descending');
      expect(rowTexts()[0]).toContain('Persona 03');
    });

    it('pagina de diez en diez con «Anterior» y «Siguiente»', async () => {
      await mount(() => of(personMatrix(Array.from({ length: 12 }, (_, i) => personRow(i + 1)))));
      expect(rowTexts()).toHaveLength(10);
      expect(byId('matrix-page-summary')?.textContent).toContain('Página 1 de 2');
      await click('matrix-next');
      expect(rowTexts()).toHaveLength(2);
      expect(byId('matrix-page-summary')?.textContent).toContain('Página 2 de 2');
      expect(byId('matrix-next')!.getAttribute('aria-disabled')).toBe('true');
      await click('matrix-prev');
      expect(rowTexts()).toHaveLength(10);
    });
  });

  describe('el detalle de una celda y el «¿por qué?»', () => {
    it('al elegir una celda muestra la persona, su estado y pregunta al servidor por el permiso elegido (POST /org/access/explain)', async () => {
      await mount();
      await click(`matrix-cell-${GENTE.marcos.engagementId}-SUPPORT_AGENDA`);
      const detail = byId('matrix-detail')!;
      expect(detail.textContent).toContain('Marcos Ribera');
      expect(detail.textContent).toContain('Agenda');
      await choose('matrix-explain-atom', 'Cancelar citas');
      olvidarPeticiones();
      await click('matrix-explain-run');
      const post = peticiones.find((p) => p.method === 'POST' && p.path === '/org/access/explain')!;
      expect(post.status).toBe(200);
      expect(post.body).toEqual({
        engagementId: GENTE.marcos.engagementId,
        action: 'agenda.appointment.cancel',
      });
      const result = byId('matrix-explain-result')!;
      expect(result.textContent).toContain('Hace falta un paso más');
      expect(result.textContent).toContain('Marcos Ribera debe escribir el motivo');
      expect(result.textContent).toContain('Escriba el motivo (al menos 10 caracteres).');
      expect(result.querySelectorAll('li').length).toBeGreaterThanOrEqual(6);
    });

    it('lo que el servidor niega se explica con texto y con símbolo, y dice qué puede cambiar el administrador', async () => {
      await mount();
      await click(`matrix-cell-${GENTE.marcos.engagementId}-SUPPORT_BILLING`);
      await choose('matrix-explain-atom', 'Devolver pagos');
      await click('matrix-explain-run');
      const result = byId('matrix-explain-result')!;
      expect(result.textContent).toContain('No está permitido');
      expect(result.textContent).toContain('no tiene el permiso «Devolver pagos»');
      expect(result.querySelector('[data-passed="false"]')).not.toBeNull();
      expect(result.textContent).toContain('Agregar el permiso a esta persona.');
    });

    it('con la agrupación por permiso, la celda ya trae el permiso y no pide elegirlo', async () => {
      await mount();
      await radio('matrix-group', 'Permiso individual');
      await click(`matrix-cell-${GENTE.marcos.engagementId}-agenda.appointment.cancel`);
      expect(byId('matrix-explain-atom')).toBeNull();
      olvidarPeticiones();
      await click('matrix-explain-run');
      expect(peticiones.find((p) => p.path === '/org/access/explain')?.body).toEqual({
        engagementId: GENTE.marcos.engagementId,
        action: 'agenda.appointment.cancel',
      });
    });

    it('si el servidor responde que no existe, lo dice sin revelar nada y sin romper la pantalla', async () => {
      await mount();
      await click(`matrix-cell-${GENTE.marcos.engagementId}-SUPPORT_AGENDA`);
      vi.spyOn(TestBed.inject(AccessExplainClient), 'explain').mockReturnValue(
        throwError(() => apiError(404, 'NOT_FOUND', 'No encontrado')),
      );
      await click('matrix-explain-run');
      expect(byId('matrix-explain-error')?.textContent).toContain('No encontramos');
      expect(byId('matrix-explain-error')?.getAttribute('role')).toBe('alert');
    });

    it('ofrece abrir los permisos de la persona', async () => {
      await mount();
      await click(`matrix-cell-${GENTE.marcos.engagementId}-SUPPORT_AGENDA`);
      expect(
        byId('matrix-detail')!.querySelector(
          `a[href="/administration/support-team/${GENTE.marcos.engagementId}"]`,
        ),
      ).not.toBeNull();
    });
  });

  describe('«Quién puede actuar sobre…»', () => {
    it('antes de elegir a quién, la pantalla dice qué hacer y no pide nada', async () => {
      await mount();
      await radio('matrix-view', 'Quién puede actuar sobre…');
      expect(el().textContent).toContain('Elija un doctor');
      olvidarPeticiones();
      expect(peticiones).toHaveLength(0);
    });

    it('al elegir un doctor pide la matriz con by=doctor&id y lista quién puede actuar, con su estado en palabras', async () => {
      await mount();
      await radio('matrix-view', 'Quién puede actuar sobre…');
      const spy = vi.spyOn(governance, 'getAccessMatrix');
      await choose('matrix-target', 'Dr. Andrés Pérez');
      expect(spy).toHaveBeenLastCalledWith({ by: 'doctor', id: PEREZ });
      const real = await realTarget();
      expect(real.rows.length).toBeGreaterThan(0);
      expect(el().querySelectorAll('[data-testid="tabla-fila"]')).toHaveLength(real.rows.length);
      for (const row of real.rows) {
        const state = byId(`matrix-effective-${row.engagementId}`)!.textContent!;
        expect(state).toContain(row.effective ? 'Puede hoy' : 'Hoy está bloqueado');
      }
    });

    it('quien tiene el permiso pero hoy está bloqueado lo explica con el motivo en lenguaje simple', async () => {
      const blocked = {
        userId: 'u-b',
        name: 'Marcos Ribera',
        engagementId: 'eng-b',
        templateCode: 'CALL_CENTER',
        state: 'ACTIVE',
        effective: false,
        reason: 'DOCTOR_NOT_ACCEPTED',
        atoms: ['agenda.appointment.view'],
        grantIds: ['g'],
        conditions: [],
      };
      await mount((q) =>
        of(
          q.by === 'person'
            ? personMatrix([personRow(1)])
            : ({
                generatedAt: new Date().toISOString(),
                by: 'doctor',
                id: q.id ?? '',
                rows: [blocked],
              } satisfies AccessMatrix),
        ),
      );
      await radio('matrix-view', 'Quién puede actuar sobre…');
      await choose('matrix-target', 'Dr. Andrés Pérez');
      const text = byId('matrix-effective-eng-b')!.textContent!;
      expect(text).toContain('Hoy está bloqueado');
      expect(text).toContain('todavía no aceptó');
    });

    it('«¿Por qué?» en una fila explica ese permiso sobre ese doctor (el doctor viaja en la petición)', async () => {
      await mount();
      await radio('matrix-view', 'Quién puede actuar sobre…');
      await choose('matrix-target', 'Dr. Andrés Pérez');
      const real = await realTarget();
      const row = real.rows[0]!;
      await click(`matrix-why-${row.engagementId}`);
      expect(byId('matrix-detail')).not.toBeNull();
      olvidarPeticiones();
      await click('matrix-explain-run');
      const body = peticiones.find((p) => p.path === '/org/access/explain')!.body as Record<
        string,
        unknown
      >;
      expect(body).toMatchObject({
        engagementId: row.engagementId,
        action: row.atoms[0],
        practitionerRoleAssignmentId: PEREZ,
      });
      expect(byId('matrix-explain-result')).not.toBeNull();
    });

    it('cambiar a servicio o a espacio ofrece las opciones de esa dimensión', async () => {
      await mount();
      await radio('matrix-view', 'Quién puede actuar sobre…');
      await radio('matrix-target-kind', 'Servicio');
      expect(await selectOptionLabels(fixture, byId('matrix-target')!)).toEqual(
        expect.arrayContaining(['Ecografía', 'Tomografía']),
      );
      await radio('matrix-target-kind', 'Espacio');
      const labels = await selectOptionLabels(fixture, byId('matrix-target')!);
      expect(labels.length).toBeGreaterThan(3);
    });

    it('S3: nadie puede actuar sobre ese destino y se propone dar permisos', async () => {
      await mount((q) =>
        of(
          q.by === 'person'
            ? personMatrix([personRow(1)])
            : ({
                generatedAt: new Date().toISOString(),
                by: 'doctor',
                id: q.id ?? '',
                rows: [],
              } satisfies AccessMatrix),
        ),
      );
      await radio('matrix-view', 'Quién puede actuar sobre…');
      await choose('matrix-target', 'Dr. Andrés Pérez');
      expect(el().textContent).toContain('Nadie puede actuar hoy');
      expect(el().querySelector('a[href="/administration/support-team"]')).not.toBeNull();
    });

    it('S6: un destino que no es de la organización se muestra como «no encontrado», sin detalles', async () => {
      await mount((q) =>
        q.by === 'person'
          ? of(personMatrix([personRow(1)]))
          : throwError(() => apiError(404, 'NOT_FOUND', 'El doctor X no existe')),
      );
      await radio('matrix-view', 'Quién puede actuar sobre…');
      await choose('matrix-target', 'Dr. Andrés Pérez');
      expect(el().textContent).toContain('No encontramos lo que busca');
      expect(el().textContent).not.toContain('El doctor X no existe');
    });
  });

  describe('exportar', () => {
    const open = async (): Promise<void> => click('matrix-export-open');
    let saved: { blob: Blob; name: string }[];

    beforeEach(() => {
      saved = [];
    });
    const spyDownload = (): void => {
      vi.spyOn(TestBed.inject(FileDownloadService), 'save').mockImplementation(
        (blob: Blob, name: string) => {
          saved.push({ blob, name });
        },
      );
    };

    it('abre un panel que pide el motivo, avisa que no se escriban datos de pacientes y que habrá un segundo paso', async () => {
      await mount();
      await open();
      const panel = byId('matrix-export-panel')!;
      expect(panel.textContent).toContain('motivo');
      expect(panel.textContent).toContain('No escriba datos de pacientes');
      expect(panel.textContent).toContain('segundo paso');
      expect(byId('matrix-export-open')!.getAttribute('aria-expanded')).toBe('true');
    });

    it('un motivo de menos de 10 caracteres no sale: el campo lo explica y no hay ninguna petición', async () => {
      await mount();
      await open();
      await write('matrix-export-reason', 'auditar');
      olvidarPeticiones();
      await click('matrix-export-submit');
      expect(peticiones).toHaveLength(0);
      expect(el().querySelector('.form-field-error')?.textContent).toContain(
        'al menos 10 caracteres',
      );
      expect(
        byId('matrix-export-reason')!.querySelector('textarea')!.getAttribute('aria-invalid'),
      ).toBe('true');
    });

    it('pide el segundo paso por el servicio de desafíos, reintenta con él y descarga el archivo con su huella', async () => {
      await mount();
      spyDownload();
      const challenges = TestBed.inject(AccessChallengeService);
      const resolve = vi.spyOn(challenges, 'resolve').mockImplementation(() => {
        sellarPasoExtra(ADMIN.id);
        return of({ stepUpVerified: true });
      });
      await open();
      await write('matrix-export-reason', 'Revisión trimestral de auditoría interna');
      olvidarPeticiones();
      await click('matrix-export-submit');

      const exports = peticiones.filter(
        (p) => p.path === '/org/governance/reports/access-matrix/export',
      );
      expect(exports.map((p) => p.status)).toEqual([403, 200]);
      expect(exports[1]!.body).toEqual({
        format: 'csv',
        reason: 'Revisión trimestral de auditoría interna',
        filters: { by: 'person', group: 'category' },
      });
      expect(resolve).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'STEP_UP' }),
        expect.anything(),
      );
      expect(saved).toHaveLength(1);
      expect(saved[0]!.name).toMatch(/^matriz-de-accesos-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(await saved[0]!.blob.text()).toContain('access-matrix');
      const done = byId('matrix-export-done')!;
      expect(done.textContent).toMatch(/[0-9a-f]{16}/);
      expect(done.textContent).toContain('filas');
      expect(done.getAttribute('role')).toBe('status');
    });

    it('con el diálogo real: el código del segundo paso se escribe, se verifica y la exportación sale', async () => {
      await mount();
      spyDownload();
      await open();
      await write('matrix-export-reason', 'Control interno del primer semestre');
      olvidarPeticiones();
      (byId('matrix-export-submit') as HTMLElement).click();
      await vi.waitFor(
        () => expect(document.body.querySelector('[data-testid="desafio-codigo"]')).not.toBeNull(),
        { timeout: 4000 },
      );
      const input = document.body.querySelector(
        '[data-testid="desafio-codigo"]',
      ) as HTMLInputElement;
      input.value = '123456';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      (
        document.body.querySelector('[data-testid="desafio-verificar"]') as HTMLButtonElement
      ).click();
      await vi.waitFor(() => expect(saved).toHaveLength(1), { timeout: 4000 });
      await settle();
      expect(
        peticiones
          .filter((p) => p.path === '/org/governance/reports/access-matrix/export')
          .map((p) => p.status),
      ).toEqual([403, 200]);
      expect(document.body.querySelector('[data-testid="desafio"]')).toBeNull();
    });

    it('si la persona cancela el segundo paso, no se exporta nada y se lo dice', async () => {
      await mount();
      spyDownload();
      vi.spyOn(TestBed.inject(AccessChallengeService), 'resolve').mockReturnValue(
        throwError(() => new AccessChallengeCancelledError()),
      );
      await open();
      await write('matrix-export-reason', 'Revisión trimestral de auditoría interna');
      await click('matrix-export-submit');
      expect(saved).toHaveLength(0);
      expect(byId('matrix-export-error')?.textContent).toContain('No se exportó');
      expect(byId('matrix-export-done')).toBeNull();
    });

    it('un fallo del servidor se muestra con el texto de lenguaje simple', async () => {
      await mount();
      spyDownload();
      vi.spyOn(governance, 'exportReport').mockReturnValue(
        throwError(() => apiError(422, 'PRECONDITION_FAILED', 'x', 'EXPORT_REASON_REQUIRED')),
      );
      await open();
      await write('matrix-export-reason', 'Revisión trimestral de auditoría interna');
      await click('matrix-export-submit');
      expect(byId('matrix-export-error')?.textContent).toContain(
        'Escriba el motivo de la exportación',
      );
      expect(saved).toHaveLength(0);
    });

    it('exporta lo que se está viendo: la vista de un doctor manda by=doctor, id y los filtros; en JSON sale como .json', async () => {
      await mount();
      spyDownload();
      sellarPasoExtra(ADMIN.id);
      await radio('matrix-view', 'Quién puede actuar sobre…');
      await choose('matrix-target', 'Dr. Andrés Pérez');
      await choose('matrix-filter-sensitivity', 'Alta o más');
      await open();
      await radio('matrix-export-format', 'JSON');
      await write('matrix-export-reason', 'Evidencia para la revisión de la jefatura');
      olvidarPeticiones();
      await click('matrix-export-submit');
      const call = peticiones.find(
        (p) => p.path === '/org/governance/reports/access-matrix/export',
      )!;
      expect(call.status).toBe(200);
      expect(call.body).toEqual({
        format: 'json',
        reason: 'Evidencia para la revisión de la jefatura',
        filters: { by: 'doctor', id: PEREZ, sensitivity: 'HIGH' },
      });
      expect(saved[0]!.name).toMatch(/\.json$/);
    });
  });

  describe('los estados', () => {
    it('S3: sin personas con vínculo dice qué hacer', async () => {
      await mount(() => of(personMatrix([])));
      expect(el().textContent).toContain('Todavía no hay personas');
      expect(el().querySelector('a[href="/administration/support-invitations"]')).not.toBeNull();
    });

    it('S3 con filtros: si nada coincide, dice cómo quitar los filtros', async () => {
      await mount(() => of(personMatrix([personRow(1)])));
      await choose('matrix-filter-state', 'Suspendidos');
      expect(el().textContent).toContain('Ninguna persona coincide');
      await click('matrix-clear-filters');
      expect(rowTexts()).toHaveLength(1);
    });

    it('S5: sin permiso, lo dice y no muestra la matriz', async () => {
      await mount(() =>
        throwError(() => apiError(403, 'FORBIDDEN', 'No tiene permiso para esta operación.')),
      );
      expect(el().textContent).toContain('No tiene permiso');
      expect(byId('matrix-grid')).toBeNull();
    });

    it('S7: una matriz calculada hace horas se muestra con su antigüedad', async () => {
      await mount(() =>
        of(
          personMatrix([personRow(1)], {
            generatedAt: new Date(Date.now() - 4 * 3_600_000).toISOString(),
          }),
        ),
      );
      expect(el().textContent).toContain('pueden estar atrasados');
      expect(rowTexts()).toHaveLength(1);
    });

    it('S8: sin conexión ofrece reintentar y al reintentar pinta la matriz', async () => {
      const matrix = vi.fn<() => Observable<AccessMatrix>>(() =>
        throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })),
      );
      await mount(matrix);
      const retry = el().querySelector(
        'button[class*="app-button"], app-empty-state button',
      ) as HTMLButtonElement;
      expect(retry.textContent).toMatch(/reintentar/i);
      matrix.mockImplementation(() => of(personMatrix([personRow(1)])));
      retry.click();
      await settle();
      expect(rowTexts()).toHaveLength(1);
    });

    it('S9: un error inesperado muestra el código de la petición', async () => {
      await mount(() => throwError(() => apiError(500, 'INTERNAL', 'Fallo')));
      expect(el().textContent).toContain('req-55');
    });
  });

  it('no tiene violaciones de accesibilidad que una máquina pueda ver (cuadrícula, detalle y exportación abiertos)', async () => {
    await mount();
    await click(`matrix-cell-${GENTE.marcos.engagementId}-SUPPORT_AGENDA`);
    await click('matrix-export-open');
    const violaciones = await auditarA11y(el());
    expect(violaciones, describirViolaciones(violaciones)).toEqual([]);
  });

  it('la vista de un doctor tampoco tiene violaciones', async () => {
    await mount();
    await radio('matrix-view', 'Quién puede actuar sobre…');
    await choose('matrix-target', 'Dr. Andrés Pérez');
    const violaciones = await auditarA11y(el());
    expect(violaciones, describirViolaciones(violaciones)).toEqual([]);
  });
});
