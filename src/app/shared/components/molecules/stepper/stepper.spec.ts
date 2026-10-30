import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { Stepper } from './stepper';
import { porcentajeDelRecorrido, type StepperStep } from './stepper.types';

@Component({
  imports: [Stepper],
  template: `<app-stepper [steps]="steps()" label="Crear agenda" />`,
})
class Host {
  readonly steps = signal<readonly StepperStep[]>([]);
}

/** El mismo recorrido, con los pasos convertidos en controles. */
@Component({
  imports: [Stepper],
  template: `<app-stepper
    [steps]="steps()"
    label="Crear agenda"
    interactive
    (stepSelected)="pedidos.push($event)"
  />`,
})
class HostInteractivo {
  readonly steps = signal<readonly StepperStep[]>([]);
  readonly pedidos: number[] = [];
}

/**
 * El mismo recorrido con el modo compacto y el interactivo a la vista: son las
 * dos entradas que el alta de paciente combina.
 */
@Component({
  imports: [Stepper],
  template: `<app-stepper
    [steps]="steps()"
    label="Crear cuenta"
    [interactive]="interactivo()"
    [compact]="compacto()"
    (stepSelected)="pedidos.push($event)"
  />`,
})
class HostCompacto {
  readonly steps = signal<readonly StepperStep[]>([]);
  readonly interactivo = signal(true);
  readonly compacto = signal(true);
  readonly pedidos: number[] = [];
}

/** El recorrido con `currentLabelOnly` y `compact` a la vista (issue #1448). */
@Component({
  imports: [Stepper],
  template: `<app-stepper
    [steps]="steps()"
    label="Crear cuenta"
    [currentLabelOnly]="soloActual()"
    [compact]="compacto()"
  />`,
})
class HostSoloActual {
  readonly steps = signal<readonly StepperStep[]>([]);
  readonly soloActual = signal(true);
  readonly compacto = signal(false);
}

const TRES_PASOS: readonly StepperStep[] = [
  { label: 'Recurso', status: 'complete' },
  { label: 'Política', status: 'current' },
  { label: 'Plantilla', status: 'upcoming' },
];

/**
 * Los diez pasos del alta de paciente, que es lo que motivó el modo compacto.
 * El tercero es el actual: los dos primeros ya se contestaron.
 */
const DIEZ_PASOS: readonly StepperStep[] = [
  { label: '¿Cómo se llama?', status: 'complete' },
  { label: 'Su documento de identidad', status: 'complete' },
  { label: 'Cuéntenos un poco sobre usted', status: 'current' },
  { label: '¿Cómo le contactamos?', status: 'upcoming' },
  { label: '¿Dónde vive?', status: 'upcoming' },
  { label: '¿Dónde trabaja?', status: 'upcoming' },
  { label: 'El lugar donde trabaja', status: 'upcoming' },
  { label: 'Su acceso', status: 'upcoming' },
  { label: 'Su seguro de salud', status: 'upcoming' },
  { label: 'Datos de facturación', status: 'upcoming' },
];

describe('Stepper', () => {
  it('pinta un ítem por paso, en orden', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.steps.set([
      { label: 'Recurso', status: 'complete' },
      { label: 'Política', status: 'current' },
      { label: 'Plantilla', status: 'upcoming' },
    ]);
    fixture.detectChanges();

    const labels = fixture.debugElement
      .queryAll(By.css('.stepper__label'))
      .map((el) => el.nativeElement.textContent.trim());
    expect(labels).toEqual(['Recurso', 'Política', 'Plantilla']);
  });

  it('marca sólo el paso actual con aria-current="step"', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.steps.set([
      { label: 'Recurso', status: 'complete' },
      { label: 'Política', status: 'current' },
      { label: 'Plantilla', status: 'upcoming' },
    ]);
    fixture.detectChanges();

    const current = fixture.debugElement.queryAll(By.css('[aria-current="step"]'));
    expect(current).toHaveLength(1);
    expect(current[0].nativeElement.textContent).toContain('Política');
  });

  it('el paso completado muestra un check y no su número', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.steps.set([
      { label: 'Recurso', status: 'complete' },
      { label: 'Política', status: 'current' },
    ]);
    fixture.detectChanges();

    const marcadores = fixture.debugElement.queryAll(By.css('.stepper__marker'));
    // El primero (completado) trae el ✓ svg y ningún dígito.
    expect(marcadores[0].query(By.css('svg'))).not.toBeNull();
    expect(marcadores[0].nativeElement.textContent.trim()).toBe('');
    // El actual muestra su ordinal.
    expect(marcadores[1].nativeElement.textContent.trim()).toBe('2');
  });

  it('resume el avance como «Crear agenda: paso 2 de 3» en el aria-label', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.steps.set([
      { label: 'Recurso', status: 'complete' },
      { label: 'Política', status: 'current' },
      { label: 'Plantilla', status: 'upcoming' },
    ]);
    fixture.detectChanges();

    const ol = fixture.debugElement.query(By.css('.stepper'));
    expect(ol.attributes['aria-label']).toBe('Crear agenda: paso 2 de 3');
  });

  describe('modo interactivo', () => {
    function montar(pasos: readonly StepperStep[] = TRES_PASOS) {
      TestBed.configureTestingModule({ imports: [HostInteractivo] });
      const fixture = TestBed.createComponent(HostInteractivo);
      fixture.componentInstance.steps.set(pasos);
      fixture.detectChanges();
      return fixture;
    }

    it('sin `interactive` los pasos NO son controles: las otras tres pantallas que lo montan no navegan', () => {
      TestBed.configureTestingModule({ imports: [Host] });
      const fixture = TestBed.createComponent(Host);
      fixture.componentInstance.steps.set(TRES_PASOS);
      fixture.detectChanges();

      expect(fixture.debugElement.queryAll(By.css('button'))).toHaveLength(0);
    });

    it('cada paso es un <button> de verdad, no un <li> con click', () => {
      const fixture = montar();

      const botones = fixture.debugElement.queryAll(By.css('button.stepper__control'));
      expect(botones).toHaveLength(3);
      // `type="button"`: dentro de un formulario, sin esto cada paso enviaría.
      expect(botones[0].nativeElement.getAttribute('type')).toBe('button');
    });

    it('el nombre accesible lleva ordinal, rótulo y estado —y contiene el rótulo visible—', () => {
      const fixture = montar();

      const botones = fixture.debugElement.queryAll(By.css('button.stepper__control'));
      expect(botones[0].nativeElement.getAttribute('aria-label')).toBe(
        'Paso 1 de 3: Recurso, completado',
      );
      expect(botones[1].nativeElement.getAttribute('aria-label')).toBe(
        'Paso 2 de 3: Política, paso actual',
      );
    });

    it('sigue habiendo un solo aria-current, y ahora vive en el control', () => {
      const fixture = montar();

      const actuales = fixture.debugElement.queryAll(By.css('[aria-current="step"]'));
      expect(actuales).toHaveLength(1);
      expect(actuales[0].nativeElement.tagName.toLowerCase()).toBe('button');
    });

    it('pulsar un paso propone su índice; navegar lo decide quien lo monta', () => {
      const fixture = montar();

      fixture.debugElement.queryAll(By.css('button.stepper__control'))[0].nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.pedidos).toEqual([0]);
    });

    it('el paso cerrado dice por qué, sigue enfocable y no propone nada', () => {
      const fixture = montar([
        { label: 'Recurso', status: 'current' },
        {
          label: 'Plantilla',
          status: 'upcoming',
          disabled: true,
          disabledReason: 'Todavía no llegó acá: complete los pasos anteriores.',
        },
      ]);

      const cerrado = fixture.debugElement.queryAll(By.css('button.stepper__control'))[1]
        .nativeElement as HTMLButtonElement;

      // `aria-disabled` y no el atributo nativo: así se puede llegar con el
      // teclado y escuchar por qué no se abre.
      expect(cerrado.getAttribute('aria-disabled')).toBe('true');
      expect(cerrado.hasAttribute('disabled')).toBe(false);
      expect(cerrado.getAttribute('aria-label')).toContain(
        'Todavía no llegó acá',
      );

      cerrado.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.pedidos).toEqual([]);
    });

    it('el paso con glifo lo dibuja, y el completado sigue mostrando su ✓', () => {
      const fixture = montar([
        { label: 'Identidad', status: 'complete', icon: 'patients' },
        { label: 'Contacto', status: 'current', icon: 'mail' },
      ]);

      const marcadores = fixture.debugElement.queryAll(By.css('.stepper__marker'));
      // El completado no cambia de seña por tener glifo: el ✓ manda.
      expect(marcadores[0].query(By.css('app-nav-icon'))).toBeNull();
      expect(marcadores[0].query(By.css('svg'))).not.toBeNull();
      expect(marcadores[1].query(By.css('app-nav-icon'))).not.toBeNull();
    });

    it('el estado no se distingue sólo por color: cada uno trae su forma y su texto', () => {
      const fixture = montar();

      const items = fixture.debugElement.queryAll(By.css('.stepper__step'));
      // Forma: ✓ el completado, ordinal el actual, marcador punteado el
      // pendiente (`--upcoming` en el CSS).
      expect(items[0].nativeElement.className).toContain('stepper__step--complete');
      expect(items[2].nativeElement.className).toContain('stepper__step--upcoming');
      // Y texto, que es lo que no depende de ver nada.
      expect(items[2].nativeElement.textContent).toContain('pendiente');
    });
  });

  describe('modo compacto', () => {
    function montar(
      pasos: readonly StepperStep[] = DIEZ_PASOS,
      opciones: { interactivo?: boolean; compacto?: boolean } = {},
    ) {
      TestBed.configureTestingModule({ imports: [HostCompacto] });
      const fixture = TestBed.createComponent(HostCompacto);
      fixture.componentInstance.steps.set(pasos);
      fixture.componentInstance.interactivo.set(opciones.interactivo ?? true);
      fixture.componentInstance.compacto.set(opciones.compacto ?? true);
      fixture.detectChanges();
      return fixture;
    }

    /**
     * Los atributos del elemento, sin los que pone la encapsulación de estilos
     * (`_ngcontent-…`): su sufijo cambia en cada compilación y no es del
     * componente.
     */
    function atributosDe(elemento: Element): string[] {
      return [...elemento.attributes]
        .map((atributo) => atributo.name)
        .filter((nombre) => !nombre.startsWith('_ng'))
        .sort();
    }

    /** El globo vive colgado del `<body>`, fuera del árbol del componente. */
    function globo(): HTMLElement | null {
      return document.body.querySelector('app-tooltip-panel');
    }

    afterEach(() => {
      // Un globo abierto sobrevive al fixture: sin esto, la prueba siguiente
      // encontraría el de la anterior.
      globo()?.remove();
    });

    it('saca el rótulo de la vista, no del nombre accesible', () => {
      const fixture = montar();

      const lista = fixture.debugElement.query(By.css('ol')).nativeElement as HTMLElement;
      expect(lista.classList.contains('stepper--compact')).toBe(true);

      const rotulos = fixture.debugElement
        .queryAll(By.css('.stepper__label'))
        .map((el) => el.nativeElement as HTMLElement);
      expect(rotulos).toHaveLength(10);
      expect(rotulos.every((el) => el.classList.contains('sr-only'))).toBe(true);

      const actual = fixture.debugElement.queryAll(By.css('button.stepper__control'))[2]
        .nativeElement as HTMLButtonElement;
      // El nombre accesible sigue entero: es lo que anuncia el lector.
      expect(actual.getAttribute('aria-label')).toBe(
        'Paso 3 de 10: Cuéntenos un poco sobre usted, paso actual',
      );
      // Y el texto sigue en el DOM: `sr-only` lo esconde de la vista y de nada más.
      expect(actual.textContent).toContain('Cuéntenos un poco sobre usted');
    });

    it('devuelve el rótulo como globo al enfocar el paso', async () => {
      const fixture = montar();
      const paso = fixture.debugElement.queryAll(By.css('button.stepper__control'))[4]
        .nativeElement as HTMLButtonElement;

      paso.dispatchEvent(new FocusEvent('focus'));
      await fixture.whenStable();

      expect(globo()?.textContent?.trim()).toBe('¿Dónde vive?');
      expect(paso.getAttribute('aria-describedby')).toBe(globo()?.id);

      paso.dispatchEvent(new FocusEvent('blur'));
      await fixture.whenStable();

      expect(globo()).toBeNull();
      expect(paso.hasAttribute('aria-describedby')).toBe(false);
    });

    it('sin `interactive` el globo cuelga del paso, que es lo único que hay', () => {
      vi.useFakeTimers();
      try {
        const fixture = montar(DIEZ_PASOS, { interactivo: false });
        const paso = fixture.debugElement.queryAll(By.css('li.stepper__step'))[4]
          .nativeElement as HTMLElement;

        paso.dispatchEvent(new MouseEvent('mouseenter'));
        // Con el puntero se espera: cruzar la fila no debe abrir nada.
        vi.advanceTimersByTime(1000);
        fixture.detectChanges();

        expect(globo()?.textContent?.trim()).toBe('¿Dónde vive?');
      } finally {
        vi.useRealTimers();
      }
    });

    it('los diez pasos siguen siendo diez controles con su testId', () => {
      const fixture = montar();

      const controles = fixture.debugElement
        .queryAll(By.css('button.stepper__control'))
        .map((el) => el.nativeElement as HTMLButtonElement);

      expect(controles.map((el) => el.getAttribute('data-testid'))).toEqual(
        Array.from({ length: 10 }, (_, i) => `stepper-paso-${i}`),
      );
    });

    it('sigue proponiendo el índice, y sigue sin proponer el paso cerrado', () => {
      const cerrado = DIEZ_PASOS.map((paso, i) =>
        i === 6
          ? { ...paso, disabled: true, disabledReason: 'Todavía no llegó acá.' }
          : paso,
      );
      const fixture = montar(cerrado);
      const controles = fixture.debugElement
        .queryAll(By.css('button.stepper__control'))
        .map((el) => el.nativeElement as HTMLButtonElement);

      controles[1].click();
      controles[6].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.pedidos).toEqual([1]);
    });

    it('sin `compact` el recorrido queda como estaba: ni clase, ni globo', async () => {
      const fixture = montar(DIEZ_PASOS, { compacto: false });

      expect(fixture.debugElement.query(By.css('.stepper--compact'))).toBeNull();

      const rotulos = fixture.debugElement
        .queryAll(By.css('.stepper__label'))
        .map((el) => el.nativeElement as HTMLElement);
      expect(rotulos.some((el) => el.classList.contains('sr-only'))).toBe(false);

      const paso = fixture.debugElement.queryAll(By.css('button.stepper__control'))[4]
        .nativeElement as HTMLButtonElement;
      paso.dispatchEvent(new FocusEvent('focus'));
      await fixture.whenStable();

      expect(globo()).toBeNull();
      expect(paso.hasAttribute('aria-describedby')).toBe(false);
    });

    it('el paso trae los mismos atributos con compacto y sin él', () => {
      // El modo compacto es una opción de una molécula que montan cuatro
      // pantallas: sin ella encendida, el DOM tiene que ser el de siempre. Los
      // dos recorridos salen del MISMO módulo de prueba: configurarlo dos veces
      // no se puede una vez que hay un componente creado.
      TestBed.configureTestingModule({ imports: [HostCompacto] });
      const crear = (compacto: boolean) => {
        const fixture = TestBed.createComponent(HostCompacto);
        fixture.componentInstance.steps.set(DIEZ_PASOS);
        fixture.componentInstance.compacto.set(compacto);
        fixture.detectChanges();
        return fixture;
      };

      const sinCompactar = crear(false);
      const compactado = crear(true);

      const actual = (fixture: ReturnType<typeof crear>): HTMLButtonElement =>
        fixture.debugElement.queryAll(By.css('button.stepper__control'))[2]
          .nativeElement as HTMLButtonElement;
      const item = (fixture: ReturnType<typeof crear>): HTMLElement =>
        fixture.debugElement.queryAll(By.css('li.stepper__step'))[2].nativeElement as HTMLElement;

      expect(atributosDe(actual(sinCompactar))).toEqual([
        'aria-current',
        'aria-label',
        'class',
        'data-testid',
        'type',
      ]);
      expect(atributosDe(item(sinCompactar))).toEqual(['class']);

      // Y el globo no deja rastro en el host mientras está cerrado.
      expect(atributosDe(actual(compactado))).toEqual(atributosDe(actual(sinCompactar)));
      expect(atributosDe(item(compactado))).toEqual(atributosDe(item(sinCompactar)));
    });
  });
});

describe('porcentajeDelRecorrido', () => {
  const paso = (status: StepperStep['status'], i = 0): StepperStep => ({
    label: `Paso ${i + 1}`,
    status,
  });

  /** Un recorrido de `total` pasos cuyo actual es el `actual` (base 0). */
  function recorrido(total: number, actual: number): readonly StepperStep[] {
    return Array.from({ length: total }, (_, i) =>
      paso(i < actual ? 'complete' : i === actual ? 'current' : 'upcoming', i),
    );
  }

  it('es 0 % sobre el primer marcador y 100 % sobre el último', () => {
    expect(porcentajeDelRecorrido(recorrido(2, 0))).toBe(0);
    expect(porcentajeDelRecorrido(recorrido(2, 1))).toBe(100);
    expect(porcentajeDelRecorrido(recorrido(5, 0))).toBe(0);
    expect(porcentajeDelRecorrido(recorrido(5, 4))).toBe(100);
  });

  it('en el medio es la posición entre los tramos, no entre los pasos', () => {
    expect(porcentajeDelRecorrido(recorrido(3, 1))).toBe(50);
    expect(porcentajeDelRecorrido(recorrido(5, 1))).toBe(25);
    expect(porcentajeDelRecorrido(recorrido(5, 2))).toBe(50);
    expect(porcentajeDelRecorrido(recorrido(10, 1))).toBe(11);
  });

  it('crece con cada paso y nunca se pasa de 100', () => {
    const valores = Array.from({ length: 7 }, (_, i) => porcentajeDelRecorrido(recorrido(7, i)));
    expect(valores).toEqual([...valores].sort((a, b) => a - b));
    expect(new Set(valores).size).toBe(7);
    expect(Math.max(...valores)).toBe(100);
  });

  it('un recorrido de un paso, o vacío, no tiene qué medir', () => {
    expect(porcentajeDelRecorrido([])).toBe(0);
    expect(porcentajeDelRecorrido([paso('current')])).toBe(0);
  });

  it('sin paso actual: todo completado es 100 %, y si no hay nada hecho, 0 %', () => {
    expect(porcentajeDelRecorrido([paso('complete', 0), paso('complete', 1)])).toBe(100);
    expect(porcentajeDelRecorrido([paso('upcoming', 0), paso('upcoming', 1)])).toBe(0);
  });
});

describe('Stepper · `currentLabelOnly` (#1448)', () => {
  function montar(): ComponentFixture<HostSoloActual> {
    TestBed.configureTestingModule({ imports: [HostSoloActual] });
    const fixture = TestBed.createComponent(HostSoloActual);
    fixture.componentInstance.steps.set(TRES_PASOS);
    fixture.detectChanges();
    return fixture;
  }

  const lista = (fixture: ComponentFixture<HostSoloActual>): HTMLElement =>
    fixture.debugElement.query(By.css('ol.stepper')).nativeElement as HTMLElement;

  it('apagado por defecto: nadie pierde rótulos sin pedirlo', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.steps.set(TRES_PASOS);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.stepper--solo-actual'))).toBeNull();
  });

  it('encendido marca la lista, y los tres rótulos siguen en el DOM para el lector', () => {
    const fixture = montar();

    expect(lista(fixture).classList.contains('stepper--solo-actual')).toBe(true);
    const rotulos = fixture.debugElement
      .queryAll(By.css('.stepper__label'))
      .map((el) => (el.nativeElement as HTMLElement).textContent!.trim());
    expect(rotulos).toEqual(['Recurso', 'Política', 'Plantilla']);
  });

  it('en `compact` no hace nada: el rótulo ya lo resolvió el compacto', () => {
    const fixture = montar();
    fixture.componentInstance.compacto.set(true);
    fixture.detectChanges();

    expect(lista(fixture).classList.contains('stepper--solo-actual')).toBe(false);
    expect(lista(fixture).classList.contains('stepper--compact')).toBe(true);
  });
});
