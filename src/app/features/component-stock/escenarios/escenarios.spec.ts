import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EscenarioContentDialog } from './content-dialog.escenarios';
import { EscenarioDataTable } from './data-table.escenarios';
import type { AnfitrionDeEscenario, EscenarioDeComponente } from './escenario.types';
import { ESCENARIOS, escenariosDe } from './escenarios';
import { EscenarioViewStateHost } from './view-state-host.escenarios';

/**
 * Lo que un escenario promete, comprobado a través de la misma interfaz que
 * usa el banco: montar el anfitrión, fijarle la variante y mirar el DOM y las
 * salidas. Nada acá toca un método privado.
 *
 * Se prueba **cada** escenario registrado —no una muestra—: el registro es la
 * lista de lo que el banco acredita, y una variante que no monta es una ficha
 * que miente.
 */

const CLAVE_DE_LA_TABLA = 'shared/components/organisms/data-table/data-table';
const CLAVE_DEL_MODAL = 'shared/components/organisms/content-dialog/content-dialog';
const CLAVE_DEL_HOST = 'shared/components/organisms/view-state-host/view-state-host';

function montar<T extends AnfitrionDeEscenario>(
  escenario: EscenarioDeComponente,
): ComponentFixture<T> {
  const fixture = TestBed.createComponent(escenario.host as never) as ComponentFixture<T>;
  fixture.componentRef.setInput('variante', escenario.variante);
  fixture.detectChanges();
  return fixture;
}

function texto(fixture: ComponentFixture<unknown>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function salidas(fixture: ComponentFixture<AnfitrionDeEscenario>): readonly string[] {
  return fixture.componentInstance.salidas().map((s) => s.salida);
}

describe('el registro de escenarios', () => {
  it('no repite ids: cada escenario es una ficha distinta', () => {
    const ids = ESCENARIOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada escenario apunta a la clave de su componente y a su anfitrión', () => {
    for (const escenario of ESCENARIOS) {
      expect(escenario.id).toBe(`${escenario.clave}#${escenario.variante}`);
      expect(escenario.fuente).toMatch(/^src\/app\/features\/component-stock\/escenarios\//);
      expect(escenario.seVe.length).toBeGreaterThan(20);
      expect(escenario.interacciones.length).toBeGreaterThan(0);
    }
  });

  it('cubre los tres pilotos y sus diez estados', () => {
    expect(escenariosDe(CLAVE_DE_LA_TABLA).map((e) => e.variante)).toEqual([
      'ready',
      'ready-seleccionable',
      'ready-navegable',
      'stale',
      'empty',
      'loading',
      'route-auth-pending',
      'validation',
      'forbidden',
      'not-found',
      'offline',
      'error',
    ]);
    expect(escenariosDe(CLAVE_DEL_HOST)).toHaveLength(10);
    expect(escenariosDe(CLAVE_DEL_MODAL).map((e) => e.variante)).toEqual([
      'descartable',
      'con-cambios',
      'sm',
      'xl',
    ]);
    expect(escenariosDe('shared/components/atoms/button/button')).toEqual([]);
  });
});

describe('EscenarioDataTable', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function filas(fixture: ComponentFixture<unknown>): HTMLElement[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '[data-testid="tabla-fila"]',
      ),
    ];
  }

  /**
   * `app-button` deshabilita con `aria-disabled`, no con el atributo nativo:
   * el botón sigue siendo enfocable y el lector anuncia el estado.
   */
  function apagado(fixture: ComponentFixture<unknown>, testId: string): boolean {
    const boton = (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`);
    return boton?.getAttribute('aria-disabled') === 'true';
  }

  it.each(escenariosDe(CLAVE_DE_LA_TABLA).map((e) => [e.variante, e] as const))(
    'monta la variante «%s» sin fallar',
    (_variante, escenario) => {
      const fixture = montar<EscenarioDataTable>(escenario);
      expect(fixture.componentInstance).toBeTruthy();
    },
  );

  it('«ready» muestra las seis filas con la tabla de verdad y el cursor hacia adelante', () => {
    const fixture = montar<EscenarioDataTable>(escenariosDe(CLAVE_DE_LA_TABLA)[0]!);
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('table')).not.toBeNull();
    expect(filas(fixture)).toHaveLength(6);
    expect(texto(fixture)).toContain('Peña');
    expect(apagado(fixture, 'tabla-siguiente')).toBe(false);
    expect(apagado(fixture, 'tabla-anterior')).toBe(true);
  });

  it('ordenar emite el código de la columna y reordena las filas visibles', () => {
    const fixture = montar<EscenarioDataTable>(escenariosDe(CLAVE_DE_LA_TABLA)[0]!);
    const raiz = fixture.nativeElement as HTMLElement;

    raiz.querySelector<HTMLButtonElement>('[data-testid="tabla-ordenar"]')?.click();
    fixture.detectChanges();

    expect(salidas(fixture)).toEqual(['sortChanged']);
    expect(fixture.componentInstance.salidas()[0]?.detalle).toBe('apellido asc');
    expect(filas(fixture)[0]?.textContent).toContain('Mamani');
  });

  it('«Siguiente» cambia de página y enciende «Anterior»; «Anterior» vuelve', () => {
    const fixture = montar<EscenarioDataTable>(escenariosDe(CLAVE_DE_LA_TABLA)[0]!);
    const raiz = fixture.nativeElement as HTMLElement;

    raiz.querySelector<HTMLButtonElement>('[data-testid="tabla-siguiente"]')?.click();
    fixture.detectChanges();

    expect(filas(fixture)).toHaveLength(3);
    expect(texto(fixture)).toContain('Arce');
    expect(apagado(fixture, 'tabla-anterior')).toBe(false);

    raiz.querySelector<HTMLButtonElement>('[data-testid="tabla-anterior"]')?.click();
    fixture.detectChanges();

    expect(filas(fixture)).toHaveLength(6);
    expect(salidas(fixture)).toEqual(['cursorChanged', 'cursorChanged']);
    expect(fixture.componentInstance.salidas().map((s) => s.detalle)).toEqual([
      'pag-2',
      'anterior',
    ]);
  });

  it('«empty» no dibuja la tabla y ofrece la próxima acción', () => {
    const escenario = escenariosDe(CLAVE_DE_LA_TABLA).find((e) => e.variante === 'empty')!;
    const fixture = montar<EscenarioDataTable>(escenario);

    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
    expect(texto(fixture)).toContain('Registrar un paciente');
  });

  it('«error» muestra el código de soporte y reintentar llega al anfitrión', () => {
    const escenario = escenariosDe(CLAVE_DE_LA_TABLA).find((e) => e.variante === 'error')!;
    const fixture = montar<EscenarioDataTable>(escenario);

    expect(texto(fixture)).toContain('req-7f3a1c9e');

    const botones = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    botones.find((b) => b.textContent?.includes('Reintentar'))?.click();
    fixture.detectChanges();

    expect(salidas(fixture)).toEqual(['retry']);
  });

  it('«stale» expone la antigüedad y actualizar llega al anfitrión', () => {
    const escenario = escenariosDe(CLAVE_DE_LA_TABLA).find((e) => e.variante === 'stale')!;
    const fixture = montar<EscenarioDataTable>(escenario);

    expect(texto(fixture)).toContain('21/09/2026');
    expect(filas(fixture)).toHaveLength(6);

    const botones = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    botones.find((b) => b.textContent?.includes('Actualizar'))?.click();
    fixture.detectChanges();

    expect(salidas(fixture)).toEqual(['refresh']);
  });

  it('«ready-seleccionable» emite la selección de la página visible', () => {
    const escenario = escenariosDe(CLAVE_DE_LA_TABLA).find(
      (e) => e.variante === 'ready-seleccionable',
    )!;
    const fixture = montar<EscenarioDataTable>(escenario);
    const casillas = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]',
      ),
    ];

    // La primera casilla es la de la cabecera: marca la página visible entera.
    casillas[0]?.click();
    fixture.detectChanges();

    expect(salidas(fixture)).toEqual(['selectionChanged']);
    expect(fixture.componentInstance.salidas()[0]?.detalle).toBe('6 fila(s)');
  });
});

describe('EscenarioContentDialog', () => {
  function dialogo(fixture: ComponentFixture<unknown>): HTMLDialogElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('dialog');
  }

  it.each(escenariosDe(CLAVE_DEL_MODAL).map((e) => [e.variante, e] as const))(
    'monta la variante «%s» abierta, con el contenido y el pie proyectados',
    async (_variante, escenario) => {
      const fixture = montar<EscenarioContentDialog>(escenario);
      await fixture.whenStable();
      fixture.detectChanges();

      const modal = dialogo(fixture);
      expect(modal).not.toBeNull();
      expect(modal?.hasAttribute('open')).toBe(true);
      expect(texto(fixture)).toContain('Registrar una nota');
      expect(
        modal?.querySelector('[data-testid="content-dialog-actions"] button')?.textContent,
      ).toContain('Guardar');
      expect(salidas(fixture)).toEqual(['opened']);
    },
  );

  it('«descartable»: cerrar por el botón emite closed y desmonta el modal', async () => {
    const fixture = montar<EscenarioContentDialog>(escenariosDe(CLAVE_DEL_MODAL)[0]!);
    await fixture.whenStable();
    fixture.detectChanges();

    dialogo(fixture)
      ?.querySelector<HTMLButtonElement>('[data-testid="content-dialog-close"]')
      ?.click();
    fixture.detectChanges();

    expect(salidas(fixture)).toEqual(['opened', 'closed']);
    expect(dialogo(fixture)).toBeNull();
  });

  it('«con-cambios»: Escape pregunta en vez de cerrar; «Descartar» recién cierra', async () => {
    const escenario = escenariosDe(CLAVE_DEL_MODAL).find((e) => e.variante === 'con-cambios')!;
    const fixture = montar<EscenarioContentDialog>(escenario);
    await fixture.whenStable();
    fixture.detectChanges();

    dialogo(fixture)?.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();

    expect(salidas(fixture)).toEqual(['opened', 'dismissAttempt']);
    expect(dialogo(fixture)).not.toBeNull();
    expect(texto(fixture)).toContain('¿Descartarlos?');

    const botones = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    botones
      .find((b) => b.textContent?.includes('Descartar') && !b.textContent.includes('¿'))
      ?.click();
    fixture.detectChanges();

    expect(salidas(fixture)).toEqual(['opened', 'dismissAttempt', 'closed']);
    expect(dialogo(fixture)).toBeNull();
  });

  it('«Guardar» es una solicitud, no un éxito: se anota como guardarSolicitado', async () => {
    const fixture = montar<EscenarioContentDialog>(escenariosDe(CLAVE_DEL_MODAL)[0]!);
    await fixture.whenStable();
    fixture.detectChanges();

    dialogo(fixture)
      ?.querySelector<HTMLButtonElement>('[data-testid="content-dialog-actions"] button')
      ?.click();
    fixture.detectChanges();

    expect(salidas(fixture)).toContain('guardarSolicitado');
    expect(salidas(fixture)).not.toContain('guardadoExitoso');
  });
});

describe('EscenarioViewStateHost', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const ESPERADO: Readonly<Record<string, string>> = {
    'route-auth-pending': 'Verificando permisos',
    loading: '',
    empty: 'Registrar la primera internación',
    ready: 'Ocupación de camas',
    validation: 'Reintentá en 30 segundos',
    forbidden: 'Declarar propósito de uso',
    'not-found': 'No encontramos lo que buscás',
    stale: '21/09/2026',
    offline: 'Sin conexión',
    error: 'req-2b91d4f0',
  };

  it.each(escenariosDe(CLAVE_DEL_HOST).map((e) => [e.variante, e] as const))(
    'la variante «%s» pinta lo que promete',
    (variante, escenario) => {
      const fixture = montar<EscenarioViewStateHost>(escenario);
      expect(texto(fixture)).toContain(ESPERADO[variante] ?? '');
    },
  );

  it('solo el camino feliz y S7 muestran el contenido proyectado', () => {
    for (const escenario of escenariosDe(CLAVE_DEL_HOST)) {
      const fixture = montar<EscenarioViewStateHost>(escenario);
      const proyectado = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="escenario-contenido"]',
      );
      const deberiaVerse = escenario.variante === 'ready' || escenario.variante === 'stale';
      expect(proyectado !== null, escenario.variante).toBe(deberiaVerse);
    }
  });

  it('reintentar y actualizar llegan al anfitrión', () => {
    const offline = montar<EscenarioViewStateHost>(
      escenariosDe(CLAVE_DEL_HOST).find((e) => e.variante === 'offline')!,
    );
    [...(offline.nativeElement as HTMLElement).querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Reintentar'))
      ?.click();
    expect(salidas(offline)).toEqual(['retry']);

    const stale = montar<EscenarioViewStateHost>(
      escenariosDe(CLAVE_DEL_HOST).find((e) => e.variante === 'stale')!,
    );
    [...(stale.nativeElement as HTMLElement).querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Actualizar'))
      ?.click();
    expect(salidas(stale)).toEqual(['refresh']);
  });
});
