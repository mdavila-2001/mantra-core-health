import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { AccessGovernanceClient } from '../../../../core/data-access/access-governance/access-governance.client';
import { AccessLifecycleClient } from '../../../../core/data-access/access-governance/access-lifecycle.client';
import {
  casosDeCicloDeVida,
  GENTE,
  metaDeVinculo,
} from '../../../../core/mock/fixtures/support-hospital-governance';
import {
  abrirElSimulador,
  esperarHasta,
  porId,
  textoDe,
  tocar,
} from '../../../../../testing/gobierno-simulador';
import { chooseSelectOption } from '../../../../../testing/select';
import { LifecycleList } from './lifecycle-list';

// La primera petición carga el simulador y su validador de contrato: tarda más que una prueba de componente común.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

describe('LifecycleList', () => {
  const sim = abrirElSimulador('hospital_piloto');
  let fixture: ComponentFixture<LifecycleList>;
  const rows = (): HTMLElement[] =>
    Array.from(document.body.querySelectorAll<HTMLElement>('[data-testid^="case-person-"]'));
  const norasCase = (): string =>
    casosDeCicloDeVida.filtrar((c) => c.engagementId === GENTE.nora.engagementId)[0]!.id;

  const abrir = async (): Promise<void> => {
    fixture = TestBed.createComponent(LifecycleList);
    document.body.appendChild(fixture.nativeElement);
    await esperarHasta(
      fixture,
      () =>
        (rows().length > 0 ||
          document.body.querySelector('app-empty-state, [role="alert"]') !== null) &&
        textoDe('ownerless-host') !== '',
    );
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    sim.reiniciar();
    TestBed.configureTestingModule({ providers: [...sim.providers, provideRouter([])] });
    sim.iniciarSesion();
  });
  afterEach(() => {
    fixture?.nativeElement.remove();
    fixture?.destroy();
    vi.restoreAllMocks();
  });
  afterAll(() => sim.cerrar());

  it('lista los casos abiertos con su tipo, su estado y su plazo en palabras, y el filtro «Todos» suma los completados', async () => {
    const spy = vi.spyOn(TestBed.inject(AccessLifecycleClient), 'listCases');
    await abrir();
    expect(spy).toHaveBeenLastCalledWith({ status: 'OPEN' });
    expect(rows().map((r) => r.textContent!.trim())).toEqual(['Nora Villarroel']);
    expect(textoDe(`case-kind-${norasCase()}`)).toBe('Ingreso');
    expect(textoDe(`case-status-${norasCase()}`)).toBe('Abierto');
    expect(textoDe(`case-due-${norasCase()}`)).toMatch(/^Vence en \d+ días?$/);
    expect(porId(`case-open-${norasCase()}`)!.getAttribute('href')).toBe(
      `/administration/access-governance/lifecycle/${norasCase()}`,
    );

    document.body
      .querySelector<HTMLElement>('[data-testid="case-status"] [data-value=""]')!
      .click();
    await esperarHasta(fixture, () => rows().length === 2);
    expect(spy).toHaveBeenLastCalledWith({});
    expect(rows().map((r) => r.textContent!.trim())).toContain('Mario Salvatierra');
  });

  it('filtra por tipo: sin bajas, dice por qué está vacío y ofrece la próxima acción', async () => {
    await abrir();
    await chooseSelectOption(fixture, porId('case-kind')!, 'Baja');
    await esperarHasta(
      fixture,
      () => rows().length === 0 && document.body.textContent!.includes('Ningún caso coincide'),
    );
    expect(document.body.querySelector('a[href="/administration/support-team"]')).not.toBeNull();
  });

  it('asigna el dueño de una cuenta sin dueño de punta a punta: petición, recarga y la lista ya no la trae', async () => {
    const put = vi.spyOn(TestBed.inject(AccessLifecycleClient), 'putOwner');
    await abrir();
    const nora = GENTE.nora.engagementId;
    expect(textoDe(`ownerless-${nora}`)).toContain('Nora Villarroel');
    expect(textoDe(`ownerless-${nora}`)).toContain('Nadie es responsable de esta cuenta.');

    await tocar(fixture, `owner-assign-${nora}`);
    expect(put).not.toHaveBeenCalled();
    expect(textoDe(`owner-error-${nora}`)).toBe('Elija quién será responsable de la cuenta.');

    await chooseSelectOption(fixture, porId(`owner-select-${nora}`)!, 'Sofía Camacho');
    await tocar(fixture, `owner-assign-${nora}`);
    await esperarHasta(fixture, () =>
      textoDe('ownerless-host').includes('Todas las cuentas tienen responsable.'),
    );
    expect(put).toHaveBeenCalledWith(nora, { supervisorUserId: GENTE.sofia.userId });
    expect(textoDe('owner-notice')).toContain(
      'Sofía Camacho es ahora responsable de la cuenta de Nora Villarroel.',
    );
    expect(metaDeVinculo.get(nora)!.supervisorUserId).toBe(GENTE.sofia.userId);
    expect(porId(`ownerless-${nora}`)).toBeNull();
  });

  it('un dueño que la API no admite se explica en lenguaje simple junto a la cuenta', async () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'x',
        reason: 'OWNER_NOT_ELIGIBLE',
        details: { reason: 'OWNER_NOT_ELIGIBLE' },
        timestamp: '',
        path: '/x',
      },
    });
    vi.spyOn(TestBed.inject(AccessLifecycleClient), 'putOwner').mockReturnValue(
      throwError(() => error),
    );
    await abrir();
    const nora = GENTE.nora.engagementId;
    await chooseSelectOption(fixture, porId(`owner-select-${nora}`)!, 'Mario Salvatierra');
    await tocar(fixture, `owner-assign-${nora}`);
    await esperarHasta(fixture, () => textoDe(`owner-error-${nora}`) !== '');
    expect(textoDe(`owner-error-${nora}`)).toBe(
      'Esa persona no puede ser responsable de la cuenta.',
    );
    // La cuenta sigue sin dueño: nada cambió.
    expect(metaDeVinculo.get(nora)!.supervisorUserId).toBeUndefined();
    expect(porId(`ownerless-${nora}`)).not.toBeNull();
  });

  it('S8: sin conexión ofrece reintentar; S7: si una recarga falla con datos a la vista, los marca como atrasados con su antigüedad', async () => {
    const cases = vi.spyOn(TestBed.inject(AccessLifecycleClient), 'listCases');
    cases.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await abrir();
    expect(document.body.textContent).toContain('Sin conexión');

    cases.mockRestore();
    const retry = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.includes('Reintentar'),
    )!;
    retry.click();
    await esperarHasta(fixture, () => rows().length === 1);

    vi.spyOn(TestBed.inject(AccessLifecycleClient), 'listCases').mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    document.body
      .querySelector<HTMLElement>('[data-testid="case-status"] [data-value="COMPLETED"]')!
      .click();
    await esperarHasta(fixture, () =>
      document.body.textContent!.includes('pueden estar atrasados'),
    );
    expect(document.body.textContent).toMatch(/Información al \d{2}\/\d{2}\/\d{4}/);
    expect(rows().map((r) => r.textContent!.trim())).toEqual(['Nora Villarroel']);
  });

  it('S9: un error inesperado muestra el código de soporte; S5: sin permiso lo dice sin ofrecer una salida falsa', async () => {
    const body = (status: number, code: string): HttpErrorResponse =>
      new HttpErrorResponse({
        status,
        error: {
          statusCode: status,
          code,
          message: 'x',
          correlationId: 'req-777',
          timestamp: '',
          path: '/x',
        },
      });
    vi.spyOn(TestBed.inject(AccessLifecycleClient), 'listCases').mockReturnValue(
      throwError(() => body(500, 'INTERNAL')),
    );
    vi.spyOn(TestBed.inject(AccessGovernanceClient), 'getOwnerless').mockReturnValue(
      throwError(() => body(403, 'FORBIDDEN')),
    );
    await abrir().catch(() => undefined);
    await esperarHasta(
      fixture,
      () =>
        document.body.textContent!.includes('req-777') &&
        document.body.textContent!.includes('No tiene acceso a esta sección'),
    );
    expect(document.body.textContent).toContain('No pudimos completar la operación');
  });
});
