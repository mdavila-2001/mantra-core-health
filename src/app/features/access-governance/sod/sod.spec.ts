import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessGovernanceClient } from '../../../core/data-access/access-governance/access-governance.client';
import { reiniciarElGobiernoDeAccesos } from '../../../core/mock/handlers/mock-reset';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { resolverDesafiosEnPrueba } from '../../../../testing/access-challenge-test';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { chooseSelectOption } from '../../../../testing/select';
import { Sod } from './sod';

/**
 * «Separación de funciones» contra el simulador del gobierno de accesos: cada mutación se demuestra
 * pantalla → petición → respuesta → recarga → pantalla (`isolate: false`: cada prueba parte del piloto de fábrica).
 */
describe('Sod', () => {
  let fixture: ComponentFixture<Sod>;
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
    const raiz = byId(id)!;
    const campo = (
      raiz.matches('input,textarea') ? raiz : raiz.querySelector('input,textarea')
    ) as HTMLInputElement;
    campo.value = texto;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };
  const pestana = async (rotulo: string): Promise<void> => {
    const boton = Array.from(host().querySelectorAll<HTMLElement>('[role="tab"]')).find((t) =>
      t.textContent!.includes(rotulo),
    );
    await click(boton ?? null);
  };

  async function montar(cuenta = 'hospital_piloto'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideGovernanceMock(cuenta)],
    });
    fixture = TestBed.createComponent(Sod);
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

  it('muestra las reglas de la plataforma en oraciones, sin códigos de permiso, y avisa que no se editan', async () => {
    await montar();
    const texto = byId('sod-reglas')!.textContent!;
    expect(byId('sod-regla-SOD-BILL-01')!.textContent).toContain(
      'No conviene reunir «Cobrar la atención» con «Anular comprobantes» en una misma persona.',
    );
    expect(byId('sod-regla-SOD-BILL-01')!.textContent).toContain(
      'Se bloquea y no admite excepciones.',
    );
    expect(texto).toContain('no se pueden editar');
    expect(texto).not.toMatch(/billing\.payment\.collect/);
    expect(host().querySelectorAll('[data-testid^="sod-regla-SOD-"]').length).toBe(11);
    expect(byId('sod-sin-reglas-propias')!.textContent).toContain('aún no agregó reglas propias');
  });

  it('el conflicto de Ricardo aparece con su excepción vigente y no ofrece pedir otra', async () => {
    await montar();
    await pestana('Conflictos');
    const tarjeta = host().querySelector('[data-testid^="sod-conflicto-SOD-GOV-03"]')!;
    expect(tarjeta.textContent).toContain('Ricardo Terceros');
    expect(tarjeta.textContent).toContain('Con excepción vigente hasta el 31/12/2026');
    expect(byId('sod-pedir-SOD-GOV-03')).toBeNull();
  });

  it('revocar la excepción: pide motivo, la API la revoca y el conflicto reaparece al recargar', async () => {
    await montar();
    vi.spyOn(TestBed.inject(DialogService), 'confirmWithReason').mockResolvedValue(
      'Ya no hay otra persona de caja que cubrir.',
    );
    await pestana('Excepciones');
    const revocar = host().querySelector('[data-testid^="sod-revocar-"]');
    expect(host().querySelector('[data-testid^="sod-excepcion-estado-"]')!.textContent).toContain(
      'Vigente hasta el 31/12/2026',
    );
    olvidarPeticiones();

    await click(revocar);

    const hechas = peticiones.map((p) => `${p.method} ${p.path} ${p.status}`);
    expect(hechas[0]).toMatch(/^POST \/org\/governance\/sod-exceptions\/.+\/revoke 200$/);
    expect(hechas).toContain('GET /org/governance/sod-exceptions 200');
    expect(peticiones[0]!.body).toEqual({ reason: 'Ya no hay otra persona de caja que cubrir.' });
    expect(host().querySelector('[data-testid^="sod-excepcion-estado-"]')!.textContent).toContain(
      'Revocada',
    );
    expect(host().querySelector('[data-testid^="sod-revocar-"]')).toBeNull();
    expect(byId('sod-anuncio')!.textContent).toContain('Excepción de Ricardo Terceros revocada.');

    await pestana('Conflictos');
    expect(
      host().querySelector('[data-testid^="sod-conflicto-SOD-GOV-03"]')!.textContent,
    ).toContain('Conflicto sin resolver');
  });

  it('pedir una excepción: exige una justificación de 40 caracteres y deja el cuatro ojos pendiente de otra persona', async () => {
    await montar();
    vi.spyOn(TestBed.inject(DialogService), 'confirmWithReason').mockResolvedValue(
      'Se retira la excepción para volver a pedirla.',
    );
    await pestana('Excepciones');
    await click(host().querySelector('[data-testid^="sod-revocar-"]'));
    await pestana('Conflictos');

    await click(byId('sod-pedir-SOD-GOV-03'));
    await escribir('sod-pedido-justificacion', 'Cubre la caja los sábados.');
    olvidarPeticiones();
    await click(byId('sod-pedido-enviar'));
    expect(peticiones).toHaveLength(0);
    expect(byId('sod-pedido')!.textContent).toContain('Escriba al menos 40 caracteres.');

    await escribir(
      'sod-pedido-justificacion',
      'Cubre la caja los sábados porque no hay otra persona disponible en el piso 1.',
    );
    await click(byId('sod-pedido-enviar'));

    expect(peticiones[0]).toMatchObject({
      method: 'POST',
      path: '/org/governance/sod-exceptions',
      status: 202,
    });
    expect(peticiones.map((p) => `${p.method} ${p.path}`)).toContain(
      'GET /org/governance/sod-findings',
    );
    expect(byId('sod-pedido-hecho')!.textContent).toContain(
      'queda pendiente de un segundo administrador',
    );
    expect(byId('sod-pedido')).toBeNull();
    await pestana('Excepciones');
    expect(host().textContent).toContain('Esperando aprobación');
  });

  it('crear una regla propia: pide el segundo paso, reintenta y la lista recargada la muestra', async () => {
    await montar();
    const desafios = resolverDesafiosEnPrueba();
    await click(byId('sod-nueva-regla'));

    await click(byId('sod-form-guardar'));
    expect(byId('sod-form-problemas')!.textContent).toContain('Escriba un código como SOD-ORG-01.');
    expect(peticiones.filter((p) => p.method === 'POST')).toHaveLength(0);

    await escribir('sod-form-codigo', 'SOD-ORG-01');
    await escribir('sod-form-nombre', 'Descontar y anular');
    await click(byId('sod-form-a-opcion-billing.discount.apply')!.querySelector('input'));
    await click(byId('sod-form-b-opcion-billing.receipt.void')!.querySelector('input'));
    await chooseSelectOption(fixture, byId('sod-form-accion')!, 'Bloquear');
    olvidarPeticiones();

    await click(byId('sod-form-guardar'));

    const hechas = peticiones.map((p) => `${p.method} ${p.path} ${p.status}`);
    expect(hechas.slice(0, 3)).toEqual([
      'POST /org/governance/sod-rules 403',
      'POST /iam/me/step-up 200',
      'POST /org/governance/sod-rules 201',
    ]);
    expect(desafios.preguntados.map((d) => d.kind)).toEqual(['STEP_UP']);
    expect(hechas).toContain('GET /org/governance/sod-rules 200');
    expect(byId('sod-form')).toBeNull();
    const nueva = byId('sod-regla-SOD-ORG-01')!;
    expect(nueva.textContent).toContain(
      'No conviene reunir «Aplicar descuentos» con «Anular comprobantes» en una misma persona.',
    );
    expect(nueva.textContent).toContain('Propia');
    expect(byId('sod-sin-reglas-propias')).toBeNull();
  });

  it('una regla propia no puede aflojar la de la plataforma: la API lo rechaza y el formulario lo dice', async () => {
    await montar();
    resolverDesafiosEnPrueba();
    await click(byId('sod-nueva-regla'));
    await escribir('sod-form-codigo', 'SOD-ORG-02');
    await escribir('sod-form-nombre', 'Cobrar y anular (suave)');
    await click(byId('sod-form-a-opcion-billing.payment.collect')!.querySelector('input'));
    await click(byId('sod-form-b-opcion-billing.receipt.void')!.querySelector('input'));
    await chooseSelectOption(fixture, byId('sod-form-base')!, 'Cobrar y anular (SOD-BILL-01)');
    await chooseSelectOption(fixture, byId('sod-form-accion')!, 'Avisar');

    await click(byId('sod-form-guardar'));

    expect(byId('sod-form-error')!.textContent).toContain(
      'Una regla de la organización no puede aflojar la de la plataforma.',
    );
    expect(byId('sod-form')).not.toBeNull();
    expect(byId('sod-regla-SOD-ORG-02')).toBeNull();
  });

  it('quien no administra ve S5, sin lista alguna', async () => {
    await montar('ana');
    expect(host().textContent).toContain('No tiene acceso a esta sección');
    expect(byId('sod-pestanas')).toBeNull();
  });

  it('sin conexión muestra S8 y «Reintentar» vuelve a pedir todo', async () => {
    const original = AccessGovernanceClient.prototype.listSodRules;
    let caido = true;
    vi.spyOn(AccessGovernanceClient.prototype, 'listSodRules').mockImplementation(function (
      this: AccessGovernanceClient,
    ) {
      return caido ? throwError(() => new HttpErrorResponse({ status: 0 })) : original.call(this);
    });
    await montar();
    expect(host().textContent).toContain('Sin conexión');
    expect(byId('sod-pestanas')).toBeNull();

    caido = false;
    await click(
      Array.from(host().querySelectorAll('button')).find((b) =>
        b.textContent!.includes('Reintentar'),
      ) ?? null,
    );

    expect(byId('sod-pestanas')).not.toBeNull();
    expect(host().textContent).not.toContain('Sin conexión');
  });

  it('si una recarga falla, conserva lo que se veía y avisa que puede estar atrasado (S7)', async () => {
    await montar();
    vi.spyOn(AccessGovernanceClient.prototype, 'listSodFindings').mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    vi.spyOn(TestBed.inject(DialogService), 'confirmWithReason').mockResolvedValue(
      'Ya no hay otra persona de caja que cubrir.',
    );
    await pestana('Excepciones');
    await click(host().querySelector('[data-testid^="sod-revocar-"]'));
    expect(host().textContent).toContain('Está viendo datos que pueden estar atrasados');
    expect(byId('sod-excepciones')).not.toBeNull();
  });
});
