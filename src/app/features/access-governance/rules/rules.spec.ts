import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessGovernanceClient } from '../../../core/data-access/access-governance/access-governance.client';
import { permisos } from '../../../core/mock/fixtures/support-hospital';
import {
  ajustesDeGobierno,
  reglasDeGobierno,
} from '../../../core/mock/fixtures/support-hospital-governance';
import { reiniciarElGobiernoDeAccesos } from '../../../core/mock/handlers/mock-reset';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { resolverDesafiosEnPrueba } from '../../../../testing/access-challenge-test';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { chooseSelectOption } from '../../../../testing/select';
import { Rules } from './rules';

/**
 * «Barandillas de la organización» contra el simulador: cada mutación se demuestra pantalla → petición → respuesta →
 * recarga → pantalla (`isolate: false`: cada prueba parte del piloto de fábrica).
 */
describe('Rules', () => {
  let fixture: ComponentFixture<Rules>;
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
  const marcar = async (id: string): Promise<void> => {
    await click(byId(id)!.querySelector('input'));
  };
  const pestana = async (rotulo: string): Promise<void> => {
    await click(
      Array.from(host().querySelectorAll<HTMLElement>('[role="tab"]')).find((t) =>
        t.textContent!.includes(rotulo),
      ) ?? null,
    );
  };
  const hechas = (): string[] => peticiones.map((p) => `${p.method} ${p.path} ${p.status}`);

  async function montar(cuenta = 'hospital_piloto'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideGovernanceMock(cuenta)],
    });
    fixture = TestBed.createComponent(Rules);
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

  describe('barandillas', () => {
    it('las reglas de la organización se leen como oraciones, con su mensaje y sin códigos de permiso', async () => {
      await montar();
      const texto = byId('rules-barandillas')!.textContent!;
      expect(texto).toContain(
        'Todo lo de «Facturación y caja» solo se puede usar desde la red del hospital.',
      );
      expect(texto).toContain(
        'El dato «Ver el documento del paciente en la cita» se ve como máximo de forma parcial',
      );
      expect(texto).toContain('Mensaje: «El documento se ve siempre de forma parcial.»');
      expect(texto).not.toMatch(/Techo por rol/);
    });

    it('crear una barandilla: muestra la frase, calcula a cuántas personas alcanza, pide el segundo paso y la lista recargada la trae', async () => {
      await montar();
      const desafios = resolverDesafiosEnPrueba();
      await click(byId('rules-nueva'));
      expect(byId('regla-oracion')).toBeNull();

      await click(byId('regla-guardar'));
      expect(byId('regla-problemas')!.textContent).toContain(
        'Elija el permiso al que se refiere la regla.',
      );
      expect(peticiones.filter((p) => p.method === 'POST')).toHaveLength(0);

      await chooseSelectOption(fixture, byId('regla-permiso')!, 'Cobrar la atención');
      await chooseSelectOption(fixture, byId('regla-rol')!, 'Recepción');
      await escribir('regla-mensaje', 'Recepción no cobra.');
      expect(byId('regla-oracion')!.textContent).toBe(
        'Nadie con el rol «Recepción» puede tener «Cobrar la atención».',
      );

      olvidarPeticiones();
      await click(byId('regla-ver-impacto'));
      expect(hechas()).toEqual(['GET /org/governance/access-matrix 200']);
      expect(byId('regla-impacto')!.textContent).toMatch(
        /Hoy (alcanzaría a \d+ persona|no alcanza a nadie)/,
      );

      olvidarPeticiones();
      await click(byId('regla-guardar'));

      expect(hechas().slice(0, 3)).toEqual([
        'POST /org/governance/rules 403',
        'POST /iam/me/step-up 200',
        'POST /org/governance/rules 201',
      ]);
      expect(peticiones[2]!.body).toEqual({
        kind: 'DENY_PERMISSION',
        permissionPattern: 'billing.payment.collect',
        roleTemplateCode: 'FRONT_DESK',
        message: 'Recepción no cobra.',
      });
      expect(desafios.preguntados.map((d) => d.kind)).toEqual(['STEP_UP']);
      expect(hechas()).toContain('GET /org/governance/rules 200');
      expect(byId('regla-constructor')).toBeNull();
      expect(byId('rules-barandillas')!.textContent).toContain(
        'Nadie con el rol «Recepción» puede tener «Cobrar la atención».',
      );
      expect(byId('rules-anuncio')!.textContent).toContain('Barandilla guardada');
    });

    it('exigir una condición pide marcar al menos una y arma el JSON que la API espera', async () => {
      await montar();
      resolverDesafiosEnPrueba();
      await click(byId('rules-nueva'));
      await chooseSelectOption(fixture, byId('regla-tipo')!, 'Exigir una condición');
      await chooseSelectOption(fixture, byId('regla-permiso')!, 'Devolver pagos');
      await click(byId('regla-guardar'));
      expect(byId('regla-problemas')!.textContent).toContain('Marque al menos una condición');

      await marcar('regla-cond-paso');
      await marcar('regla-cond-motivo');
      await escribir('regla-cond-motivo-minimo', '15');
      expect(byId('regla-oracion')!.textContent).toBe(
        '«Devolver pagos» solo se puede usar con un motivo de al menos 15 caracteres, con verificación en dos pasos.',
      );
      olvidarPeticiones();
      await click(byId('regla-guardar'));

      const creada = peticiones.find((p) => p.method === 'POST' && p.status === 201)!;
      expect(creada.body).toMatchObject({
        kind: 'REQUIRE_CONDITION',
        permissionPattern: 'billing.payment.refund',
        condition: {
          schemaVersion: 1,
          obligations: { requireReason: { minLength: 15 }, stepUp: { maxAgeMinutes: 10 } },
        },
      });
    });

    it('una regla repetida la rechaza la API con su texto y el constructor sigue abierto', async () => {
      await montar();
      resolverDesafiosEnPrueba();
      await click(byId('rules-nueva'));
      await chooseSelectOption(fixture, byId('regla-tipo')!, 'Limitar lo que se ve');
      await chooseSelectOption(
        fixture,
        byId('regla-permiso')!,
        'Ver el documento del paciente en la cita',
      );
      await click(byId('regla-guardar'));

      expect(byId('regla-error')!.textContent).toContain('Ya existe una regla igual.');
      expect(byId('regla-constructor')).not.toBeNull();
    });

    it('retirar: pide motivo, la API la retira y la lista ya no la muestra; «Ver también las retiradas» la trae como retirada', async () => {
      await montar();
      resolverDesafiosEnPrueba();
      vi.spyOn(TestBed.inject(DialogService), 'confirmWithReason').mockResolvedValue(
        'Ya no hace falta limitar el documento.',
      );
      const regla = reglasDeGobierno.todos().find((r) => r.kind === 'FIELD_FLOOR')!;
      expect(byId('rules-ver-retiradas')).toBeNull();
      olvidarPeticiones();

      await click(byId(`rules-retirar-${regla.id}`));

      expect(hechas().slice(0, 3)).toEqual([
        `POST /org/governance/rules/${regla.id}/retire 403`,
        'POST /iam/me/step-up 200',
        `POST /org/governance/rules/${regla.id}/retire 200`,
      ]);
      expect(peticiones[2]!.body).toEqual({ reason: 'Ya no hace falta limitar el documento.' });
      expect(byId(`rules-regla-${regla.id}`)).toBeNull();
      await click(byId('rules-ver-retiradas')!.querySelector('input'));
      expect(byId(`rules-regla-${regla.id}`)!.textContent).toContain('Retirada');
      expect(byId(`rules-retirar-${regla.id}`)).toBeNull();
    });

    it('cambiar el mensaje envía la versión que vio; si otra persona la cambió, lo dice y vuelve a leer', async () => {
      await montar();
      resolverDesafiosEnPrueba();
      const regla = reglasDeGobierno.todos().find((r) => r.kind === 'FIELD_FLOOR')!;
      await click(byId(`rules-editar-${regla.id}`));
      await escribir('rules-edicion-mensaje', 'El documento siempre va tapado.');
      olvidarPeticiones();
      await click(byId('rules-edicion-guardar'));
      expect(peticiones.find((p) => p.method === 'PATCH' && p.status === 200)!.body).toEqual({
        expectedRowVersion: 1,
        message: 'El documento siempre va tapado.',
      });
      expect(byId(`rules-regla-${regla.id}`)!.textContent).toContain(
        'Mensaje: «El documento siempre va tapado.»',
      );

      await click(byId(`rules-editar-${regla.id}`));
      reglasDeGobierno.actualizar(regla.id, { rowVersion: 7 });
      await escribir('rules-edicion-mensaje', 'Otro texto.');
      await click(byId('rules-edicion-guardar'));
      expect(byId('rules-edicion-error')!.textContent).toContain(
        'Otra persona cambió esto mientras lo editaba.',
      );
    });
  });

  describe('techos por plantilla', () => {
    /**
     * Pendiente 59: ninguna ruta de la API expone el techo de la plataforma de cada rol, así que la pantalla solo muestra los de la
     * organización. No se inventa un número: se dice qué se ve y qué no.
     */
    it('dice con honestidad que solo muestra los techos propios: el de la plataforma no lo entrega la API todavía', async () => {
      await montar();
      await pestana('Techos por plantilla');
      const aviso = byId('rules-techos-aviso')!.textContent!.replace(/\s+/g, ' ');
      expect(aviso).toContain('solo los límites que puso su organización');
      expect(aviso).toContain('todavía no entrega');
      expect(aviso).toContain('El de la plataforma siempre rige');
    });

    it('la matriz dice con texto qué rol está limitado y bajar un techo lo refleja tras recargar', async () => {
      await montar();
      resolverDesafiosEnPrueba();
      await pestana('Techos por plantilla');
      const fila = (nombre: string): HTMLElement =>
        Array.from(
          host().querySelectorAll<HTMLElement>('[data-testid="rules-matriz"] tbody tr'),
        ).find((tr) => tr.querySelector('th')!.textContent!.trim() === nombre)!;
      expect(fila('Secretaria').textContent).toContain('Bloqueada');
      expect(fila('Enfermería').textContent).not.toContain('Bloqueada');
      expect(byId('rules-techos')!.textContent).toContain(
        'El rol «Secretaria» nunca puede tener todo lo de «Facturación y caja».',
      );
      expect(byId('rules-plataforma')).not.toBeNull();

      await click(byId('rules-nuevo-techo'));
      await chooseSelectOption(fixture, byId('regla-permiso')!, 'Todo lo de «Facturación y caja»');
      await click(byId('regla-guardar'));
      expect(byId('regla-problemas')!.textContent).toContain('Un techo es de un rol: elija cuál.');
      await chooseSelectOption(fixture, byId('regla-rol')!, 'Enfermería');
      await click(byId('regla-guardar'));

      expect(fila('Enfermería').textContent).toContain('Bloqueada');
      expect(
        reglasDeGobierno
          .todos()
          .some((r) => r.kind === 'CEILING' && r.roleTemplateCode === 'NURSING'),
      ).toBe(true);
    });
  });

  describe('ajustes', () => {
    it('solo se envía lo que cambió, guardar pide el segundo paso y el valor nuevo queda en la pantalla recargada', async () => {
      await montar();
      resolverDesafiosEnPrueba();
      await pestana('Ajustes');
      expect(byId('ajustes-estado')!.textContent).toContain('Ajustes propios de su organización.');
      expect(
        byId('ajustes-guardar')!.hasAttribute('disabled') ||
          byId('ajustes-guardar')!.getAttribute('aria-disabled') === 'true',
      ).toBe(true);
      expect((byId('ajuste-inactivityDays') as HTMLInputElement).value).toBe('45');

      await escribir('ajuste-inactivityDays', '30');
      expect(byId('ajustes-cuenta')!.textContent).toContain('1 cambio sin guardar');
      olvidarPeticiones();
      await click(byId('ajustes-guardar'));

      expect(hechas().slice(0, 3)).toEqual([
        'PUT /org/governance/settings 403',
        'POST /iam/me/step-up 200',
        'PUT /org/governance/settings 200',
      ]);
      expect(peticiones[2]!.body).toEqual({ inactivityDays: 30 });
      expect(ajustesDeGobierno.get('settings')!.inactivityDays).toBe(30);
      expect(byId('ajustes-cuenta')!.textContent).toContain('Sin cambios');
      expect((byId('ajuste-inactivityDays') as HTMLInputElement).value).toBe('30');
      expect(byId('ajustes-anuncio')!.textContent).toContain('Ajustes guardados.');
    });

    it('un valor que no es un número válido se marca en el campo y no se envía; vaciar «suspender solo» significa nunca', async () => {
      await montar();
      resolverDesafiosEnPrueba();
      await pestana('Ajustes');
      await escribir('ajuste-unusedDays', '0');
      olvidarPeticiones();
      await click(byId('ajustes-guardar'));
      expect(peticiones).toHaveLength(0);
      expect(byId('ajustes')!.textContent).toContain('Escriba un número entero desde 1.');

      await click(byId('ajustes-descartar'));
      expect((byId('ajuste-unusedDays') as HTMLInputElement).value).toBe('60');
      await escribir('ajuste-autoSuspendInactiveDays', '90');
      await click(byId('ajustes-guardar'));
      expect(ajustesDeGobierno.get('settings')!.autoSuspendInactiveDays).toBe(90);
      await escribir('ajuste-autoSuspendInactiveDays', '');
      olvidarPeticiones();
      await click(byId('ajustes-guardar'));
      expect(peticiones.find((p) => p.method === 'PUT' && p.status === 200)!.body).toEqual({
        autoSuspendInactiveDays: null,
      });
      expect(ajustesDeGobierno.get('settings')!.autoSuspendInactiveDays).toBeNull();
    });
  });

  describe('permisos antiguos', () => {
    it('simulacro → reconocer lo que exige más → aplicar → revertir, cada paso contra la API y con el segundo paso', async () => {
      await montar();
      const desafios = resolverDesafiosEnPrueba();
      vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
      await pestana('Permisos antiguos');
      const antiguos = permisos.filtrar(
        (p) =>
          p.status === 'ACTIVE' &&
          p.atoms === undefined &&
          p.effect !== 'DENY' &&
          p.actions.length > 0,
      ).length;
      expect(antiguos).toBeGreaterThan(0);

      olvidarPeticiones();
      await click(byId('normalizar-simular'));
      // El simulacro no escribe nada: la API NO pide el segundo paso (solo al aplicar).
      expect(hechas()).toEqual(['POST /org/governance/normalize-legacy 200']);
      expect(peticiones[0]!.body).toEqual({ dryRun: true });
      expect(byId('normalizar')!.getAttribute('data-fase')).toBe('SIMULACRO');
      expect(byId('normalizar-resumen')!.textContent).toContain('No se cambió nada.');
      expect(
        permisos.filtrar(
          (p) =>
            p.atoms === undefined &&
            p.actions.length > 0 &&
            p.status === 'ACTIVE' &&
            p.effect !== 'DENY',
        ),
      ).toHaveLength(antiguos);
      expect(desafios.preguntados).toEqual([]);

      // Si el simulacro encuentra que algo se exige más, no se puede aplicar sin reconocerlo.
      const hayEstrechamientos = byId('normalizar-estrechamientos') !== null;
      if (hayEstrechamientos) {
        expect(
          byId('normalizar-aplicar')!.hasAttribute('disabled') ||
            byId('normalizar-aplicar')!.getAttribute('aria-disabled') === 'true',
        ).toBe(true);
        await marcar('normalizar-reconozco');
      }

      olvidarPeticiones();
      await click(byId('normalizar-aplicar'));
      const aplicar = peticiones.find(
        (p) =>
          p.method === 'POST' && p.path === '/org/governance/normalize-legacy' && p.status === 200,
      )!;
      expect(aplicar.body).toEqual({
        dryRun: false,
        ...(hayEstrechamientos ? { acknowledgeTightening: true } : {}),
      });
      // Aplicar sí pide el segundo paso: 403 → paso extra → reintento.
      expect(
        hechas().filter(
          (h) => h.startsWith('POST /org/governance/normalize-legacy ') || h.includes('step-up'),
        ),
      ).toEqual([
        'POST /org/governance/normalize-legacy 403',
        'POST /iam/me/step-up 200',
        'POST /org/governance/normalize-legacy 200',
      ]);
      expect(desafios.preguntados.map((d) => d.kind)).toEqual(['STEP_UP']);
      expect(byId('normalizar')!.getAttribute('data-fase')).toBe('APLICADO');
      expect(
        permisos.filtrar((p) => p.atoms !== undefined && p.status === 'ACTIVE').length,
      ).toBeGreaterThanOrEqual(antiguos);
      const lote = byId('normalizar-lote')!.textContent!.trim();
      expect(lote).not.toBe('');

      olvidarPeticiones();
      await click(byId('normalizar-revertir'));
      expect(
        peticiones.find(
          (p) => p.path === '/org/governance/normalize-legacy/revert' && p.status === 200,
        )!.body,
      ).toEqual({ batchId: lote });
      expect(byId('normalizar')!.getAttribute('data-fase')).toBe('REVERTIDO');
      expect(byId('normalizar-revertido')!.textContent).toContain('Se restauraron');

      // Revertir dos veces: la API responde 404 y la pantalla lo dice en palabras.
      await click(byId('normalizar-otro'));
      expect(byId('normalizar')!.getAttribute('data-fase')).toBe('INICIO');
    });
  });

  it('S5: quien no administra ve el muro y ninguna pestaña', async () => {
    await montar('ana');
    expect(host().textContent).toContain('No tiene acceso a esta sección');
    expect(byId('rules-pestanas')).toBeNull();
  });

  it('S8: sin conexión, «Reintentar» vuelve a pedir lo mismo', async () => {
    const original = AccessGovernanceClient.prototype.getSettings;
    let caido = true;
    vi.spyOn(AccessGovernanceClient.prototype, 'getSettings').mockImplementation(function (
      this: AccessGovernanceClient,
    ) {
      return caido ? throwError(() => new HttpErrorResponse({ status: 0 })) : original.call(this);
    });
    await montar();
    expect(host().textContent).toContain('Sin conexión');
    caido = false;
    await click(
      Array.from(host().querySelectorAll('button')).find((b) =>
        b.textContent!.includes('Reintentar'),
      ) ?? null,
    );
    expect(byId('rules-pestanas')).not.toBeNull();
  });
});
