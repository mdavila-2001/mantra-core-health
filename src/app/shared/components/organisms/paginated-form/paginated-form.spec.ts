import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { PaginatedForm } from './paginated-form';
import { CampoPersonalizado } from './campo-personalizado';
import type { PaginaDeFormulario } from '../../../forms/paginated/paginated-form.types';

/**
 * Lo que se prueba acá es **la promesa del motor**: que sirve una página por
 * vez, que no deja avanzar con un campo mal, y que lo que se escribe termina en
 * el `FormGroup` de la pantalla y en ningún otro sitio.
 *
 * No se prueba cómo se ven la barra ni el stepper: eso ya lo cubren sus propios
 * archivos (`progress.spec.ts`, `stepper.spec.ts`). Repetirlo acá sería atar
 * este motor a la maqueta de dos componentes que no le pertenecen.
 *
 * Sí se prueba lo que el motor **decide** sobre ellos: a qué paso deja saltar y
 * a cuál no, y qué pasa con lo escrito al saltar (TAREA 04, AC-04-12 y -13).
 */

const PAGINAS: readonly PaginaDeFormulario[] = [
  {
    titulo: 'Identidad',
    campos: [
      { key: 'documento', label: 'Documento', control: 'text', required: true },
      { key: 'nacimiento', label: 'Fecha de nacimiento', control: 'date' },
    ],
  },
  {
    titulo: 'Acceso',
    campos: [
      { key: 'correo', label: 'Correo', control: 'email', required: true },
      { key: 'clave', label: 'Contraseña', control: 'password', required: true },
    ],
  },
];

@Component({
  imports: [PaginatedForm, CampoPersonalizado],
  template: `
    <app-paginated-form
      [paginas]="paginas()"
      [form]="form"
      label="Crear cuenta"
      submitLabel="Crear cuenta"
      (enviado)="enviados = enviados + 1"
    >
      <ng-template appCampoPersonalizado="odontograma">
        <p data-testid="widget-propio">un mapa dental</p>
      </ng-template>
    </app-paginated-form>
  `,
})
class Host {
  readonly paginas = signal<readonly PaginaDeFormulario[]>(PAGINAS);
  readonly form = new FormGroup({
    documento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nacimiento: new FormControl<Date | null>(null),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    clave: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    odontograma: new FormControl<string | null>(null),
  });
  enviados = 0;
}

/** Una página con las piezas nuevas: glifo, descripción y un desplegable. */
const PAGINAS_CON_ADORNOS: readonly PaginaDeFormulario[] = [
  {
    titulo: 'Identidad',
    icon: 'patients',
    campos: [
      {
        key: 'documento',
        label: 'Documento',
        control: 'text',
        required: true,
        icono: 'patients',
        hint: 'Con este número vas a iniciar sesión.',
        description: 'El número de tu cédula de identidad, sin puntos ni guiones.',
      },
      {
        key: 'genero',
        label: 'Género',
        control: 'select',
        icono: 'people',
        description: 'Como figura en tu documento.',
        options: [
          { value: 'f', label: 'Femenino' },
          { value: 'm', label: 'Masculino' },
        ],
      },
    ],
  },
  {
    titulo: 'Acceso',
    icon: 'lock',
    campos: [{ key: 'correo', label: 'Correo', control: 'email', required: true }],
  },
];

/** El mismo motor con los interruptores de la TAREA 04 a la vista. */
@Component({
  imports: [PaginatedForm],
  template: `
    <app-paginated-form
      [paginas]="paginas()"
      [form]="form"
      label="Crear cuenta"
      submitLabel="Crear cuenta"
      [interactiveSteps]="interactiveSteps()"
      [iconOnlyNav]="iconOnlyNav()"
    />
  `,
})
class HostConfigurable {
  readonly paginas = signal<readonly PaginaDeFormulario[]>(PAGINAS_CON_ADORNOS);
  readonly interactiveSteps = signal(true);
  readonly iconOnlyNav = signal(false);
  readonly form = new FormGroup({
    documento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    genero: new FormControl<string | null>(null),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });
}

/**
 * Diez páginas: las del alta de paciente, que es el recorrido que pasó el tope
 * de cinco del indicador. Una cosa por página, para que avanzar no dependa de
 * llenar nada.
 */
const PAGINAS_LARGAS: readonly PaginaDeFormulario[] = Array.from(
  { length: 10 },
  (_, i): PaginaDeFormulario => ({
    titulo: `Sección ${i + 1}`,
    clave: `seccion-${i + 1}`,
    campos: [{ key: `campo${i + 1}`, label: `Campo ${i + 1}`, control: 'text' }],
  }),
);

/** Los diez controles de {@link PAGINAS_LARGAS}, uno por página. */
function controlesLargos(): Record<string, FormControl<string>> {
  const controles: Record<string, FormControl<string>> = {};
  for (const pagina of PAGINAS_LARGAS) {
    controles[pagina.campos[0].key] = new FormControl('', { nonNullable: true });
  }
  return controles;
}

/** El motor con más páginas de las que el indicador muestra con rótulos. */
@Component({
  imports: [PaginatedForm],
  template: `
    <app-paginated-form
      [paginas]="paginas()"
      [form]="form"
      label="Crear cuenta"
      submitLabel="Crear cuenta"
      [compactSteps]="compactSteps()"
    />
  `,
})
class HostLargo {
  readonly paginas = signal<readonly PaginaDeFormulario[]>(PAGINAS_LARGAS);
  readonly compactSteps = signal(false);
  readonly form = new FormGroup(controlesLargos());
}

describe('PaginatedForm', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host, HostConfigurable, HostLargo] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** El texto del botón que hace avanzar o enviar. */
  function botonContinuar(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('[data-testid="paginated-form-continuar"]'))
      .nativeElement as HTMLButtonElement;
  }

  function titulo(): string {
    return (
      fixture.debugElement.query(By.css('.paginated-form__titulo')).nativeElement as HTMLElement
    ).textContent!.trim();
  }

  function rotulos(): string[] {
    return fixture.debugElement
      .queryAll(By.css('.form-field__label, label'))
      .map((el) => (el.nativeElement as HTMLElement).textContent!.trim());
  }

  describe('sirve una página por vez', () => {
    it('empieza por la primera y no pinta los campos de las demás', () => {
      expect(titulo()).toBe('Identidad');

      const texto = (fixture.nativeElement as HTMLElement).textContent!;
      expect(texto).toContain('Documento');
      // Los de la página siguiente no están en el DOM: ocultarlos con CSS los
      // dejaría en el orden de tabulación y en el lector de pantalla.
      expect(texto).not.toContain('Contraseña');
    });

    it('el botón dice «Siguiente» mientras quede página, y la acción real en la última', () => {
      expect(botonContinuar().textContent!.trim()).toBe('Siguiente');

      host.form.controls.documento.setValue('1234567');
      botonContinuar().click();
      fixture.detectChanges();

      expect(titulo()).toBe('Acceso');
      expect(botonContinuar().textContent!.trim()).toBe('Crear cuenta');
    });

    it('«Atrás» no aparece en la primera página', () => {
      expect(fixture.debugElement.query(By.css('[data-testid="paginated-form-atras"]'))).toBeNull();
    });
  });

  describe('valida al pasar de página', () => {
    it('no avanza con un campo obligatorio vacío, y dice por qué', () => {
      botonContinuar().click();
      fixture.detectChanges();

      expect(titulo()).toBe('Identidad');
      expect(host.form.controls.documento.touched).toBe(true);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Este dato es obligatorio.',
      );
    });

    it('no toca los campos de las otras páginas al validar la actual', () => {
      botonContinuar().click();
      fixture.detectChanges();

      // Marcar todo al primer intento pintaría de rojo una página que la persona
      // todavía no vio.
      expect(host.form.controls.correo.touched).toBe(false);
    });

    it('avanza cuando lo de la página está bien', () => {
      host.form.controls.documento.setValue('1234567');

      botonContinuar().click();
      fixture.detectChanges();

      expect(titulo()).toBe('Acceso');
    });

    it('volver atrás no valida: se puede retroceder desde una página a medias', () => {
      host.form.controls.documento.setValue('1234567');
      botonContinuar().click();
      fixture.detectChanges();

      fixture.debugElement
        .query(By.css('[data-testid="paginated-form-atras"]'))
        .nativeElement.click();
      fixture.detectChanges();

      expect(titulo()).toBe('Identidad');
    });
  });

  describe('el envío', () => {
    function irAlFinal(): void {
      host.form.controls.documento.setValue('1234567');
      botonContinuar().click();
      fixture.detectChanges();
    }

    it('emite sólo cuando todo el formulario es válido', () => {
      irAlFinal();
      host.form.controls.correo.setValue('ana@ejemplo.com');
      host.form.controls.clave.setValue('contraseña-larga');

      botonContinuar().click();
      fixture.detectChanges();

      expect(host.enviados).toBe(1);
    });

    it('con un error en una página anterior, vuelve a ella en vez de quedarse mudo', () => {
      irAlFinal();
      host.form.controls.correo.setValue('ana@ejemplo.com');
      host.form.controls.clave.setValue('contraseña-larga');
      // Alguien borró el documento de la primera página antes de enviar.
      host.form.controls.documento.setValue('');

      botonContinuar().click();
      fixture.detectChanges();

      expect(host.enviados).toBe(0);
      expect(titulo()).toBe('Identidad');
    });
  });

  describe('el dato', () => {
    it('lo que se escribe va al FormGroup de la pantalla', () => {
      // El `testId` del átomo va en el propio `<input>`, no en un envoltorio.
      const input = fixture.debugElement.query(By.css('input[data-testid="campo-documento"]'))
        .nativeElement as HTMLInputElement;

      input.value = '9876543';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(host.form.controls.documento.value).toBe('9876543');
    });

    it('la fecha también, aunque su control no sea un ControlValueAccessor', () => {
      const picker = fixture.debugElement.query(By.css('app-date-picker'));
      expect(picker).not.toBeNull();

      picker.componentInstance.value.set(new Date(1990, 4, 17));
      fixture.detectChanges();

      // El puente escribe en el mismo control: sin él, la fecha viviría en un
      // signal aparte y el envío tendría dos fuentes para el mismo dato.
      expect(host.form.controls.nacimiento.value).toEqual(new Date(1990, 4, 17));
    });
  });

  describe('los campos que el motor no sabe dibujar', () => {
    it('proyecta la plantilla que le den, con su rótulo', () => {
      host.paginas.set([
        {
          titulo: 'Odontograma',
          campos: [{ key: 'odontograma', label: 'Mapa dental', control: 'custom' }],
        },
      ]);
      fixture.detectChanges();

      expect(rotulos().join(' ')).toContain('Mapa dental');
      expect(
        fixture.debugElement.query(By.css('[data-testid="widget-propio"]')),
      ).not.toBeNull();
    });
  });

  describe('el avance', () => {
    it('la barra cuenta páginas terminadas: en la primera todavía no hay nada hecho', () => {
      const barra = fixture.debugElement.query(By.css('app-progress')).nativeElement as HTMLElement;
      expect(barra.getAttribute('aria-valuenow')).toBe('0');

      host.form.controls.documento.setValue('1234567');
      botonContinuar().click();
      fixture.detectChanges();

      expect(barra.getAttribute('aria-valuenow')).toBe('50');
    });

    it('el nombre de la barra dice dónde está la persona', () => {
      const barra = fixture.debugElement.query(By.css('app-progress')).nativeElement as HTMLElement;

      expect(barra.getAttribute('aria-label')).toBe('Crear cuenta: paso 1 de 2, Identidad');
    });
  });

  /* ==========================================================================
      TAREA 04 — lo visual del motor. Todo lo de acá lo comparten las 53
      plantillas de `features/` que montan `app-paginated-form`, así que se
      prueba también **qué sigue igual** cuando no se pide nada.
     ========================================================================= */
  describe('los pasos como controles', () => {
    let fixtureC: ComponentFixture<HostConfigurable>;
    let hostC: HostConfigurable;

    beforeEach(() => {
      fixtureC = TestBed.createComponent(HostConfigurable);
      hostC = fixtureC.componentInstance;
      fixtureC.detectChanges();
    });

    function pasos(): HTMLButtonElement[] {
      return fixtureC.debugElement
        .queryAll(By.css('button.stepper__control'))
        .map((el) => el.nativeElement as HTMLButtonElement);
    }

    function tituloC(): string {
      return (
        fixtureC.debugElement.query(By.css('.paginated-form__titulo')).nativeElement as HTMLElement
      ).textContent!.trim();
    }

    function continuarC(): HTMLButtonElement {
      return fixtureC.debugElement.query(By.css('[data-testid="paginated-form-continuar"]'))
        .nativeElement as HTMLButtonElement;
    }

    it('cada paso es un botón operable, con su glifo', () => {
      expect(pasos()).toHaveLength(2);
      expect(
        fixtureC.debugElement.queryAll(By.css('.stepper__marker app-nav-icon')).length,
      ).toBeGreaterThan(0);
    });

    it('un paso al que nunca se llegó no se abre, y lo dice', () => {
      const siguiente = pasos()[1];
      expect(siguiente.getAttribute('aria-disabled')).toBe('true');
      expect(siguiente.getAttribute('aria-label')).toContain('Todavía no llegaste');

      siguiente.click();
      fixtureC.detectChanges();

      // Sigue en la primera: el candado no depende de que la vista lo respete.
      expect(tituloC()).toBe('Identidad');
    });

    it('un paso ya visitado navega, y lo escrito sigue donde estaba', () => {
      hostC.form.controls.documento.setValue('1234567');
      continuarC().click();
      fixtureC.detectChanges();
      expect(tituloC()).toBe('Acceso');

      pasos()[0].click();
      fixtureC.detectChanges();

      expect(tituloC()).toBe('Identidad');
      // El dato vive en el FormGroup de la pantalla: saltar no lo toca.
      expect(hostC.form.controls.documento.value).toBe('1234567');
    });

    it('volver adelante revalida lo que quedaba en medio, no lo saltea', () => {
      hostC.form.controls.documento.setValue('1234567');
      continuarC().click();
      fixtureC.detectChanges();

      pasos()[0].click();
      fixtureC.detectChanges();
      // Se borra lo obligatorio de la página 1 y se intenta volver a la 2.
      hostC.form.controls.documento.setValue('');
      fixtureC.detectChanges();

      pasos()[1].click();
      fixtureC.detectChanges();

      expect(tituloC()).toBe('Identidad');
      expect(hostC.form.controls.documento.touched).toBe(true);
    });

    it('con interactiveSteps en false vuelve a ser un indicador y nada más', () => {
      hostC.interactiveSteps.set(false);
      fixtureC.detectChanges();

      expect(pasos()).toHaveLength(0);
    });
  });

  describe('el indicador con más páginas de las que entran', () => {
    let fixtureL: ComponentFixture<HostLargo>;

    beforeEach(() => {
      fixtureL = TestBed.createComponent(HostLargo);
      fixtureL.detectChanges();
    });

    function pasosL(): HTMLButtonElement[] {
      return fixtureL.debugElement
        .queryAll(By.css('[data-testid^="stepper-paso-"]'))
        .map((el) => el.nativeElement as HTMLButtonElement);
    }

    function tituloL(): string {
      return (
        fixtureL.debugElement.query(By.css('.paginated-form__titulo')).nativeElement as HTMLElement
      ).textContent!.trim();
    }

    function continuarL(): HTMLButtonElement {
      return fixtureL.debugElement.query(By.css('[data-testid="paginated-form-continuar"]'))
        .nativeElement as HTMLButtonElement;
    }

    it('sin `compactSteps`, diez páginas siguen siendo el contador de siempre', () => {
      // Es lo que hoy ven las pantallas largas, y no cambia solo: el tope de
      // cinco las sigue protegiendo mientras nadie pida lo contrario.
      expect(fixtureL.debugElement.query(By.css('app-stepper'))).toBeNull();
      expect(
        (
          fixtureL.debugElement.query(By.css('.paginated-form__contador'))
            .nativeElement as HTMLElement
        ).textContent!.trim(),
      ).toBe('Paso 1 de 10');
    });

    it('con `compactSteps` el recorrido vuelve, y vuelve compacto', () => {
      fixtureL.componentInstance.compactSteps.set(true);
      fixtureL.detectChanges();

      expect(fixtureL.debugElement.query(By.css('app-stepper .stepper--compact'))).not.toBeNull();
      expect(pasosL()).toHaveLength(10);
      expect(fixtureL.debugElement.query(By.css('.paginated-form__contador'))).toBeNull();
    });

    it('con cinco páginas o menos los rótulos se ven, se pida compacto o no', () => {
      fixtureL.componentInstance.paginas.set(PAGINAS_LARGAS.slice(0, 4));

      for (const compacto of [false, true]) {
        fixtureL.componentInstance.compactSteps.set(compacto);
        fixtureL.detectChanges();

        expect(fixtureL.debugElement.query(By.css('.stepper--compact'))).toBeNull();
        const rotulos = fixtureL.debugElement
          .queryAll(By.css('.stepper__label'))
          .map((el) => el.nativeElement as HTMLElement);
        expect(rotulos).toHaveLength(4);
        expect(rotulos.some((el) => el.classList.contains('sr-only'))).toBe(false);
      }
    });

    it('compacto no relaja el candado: al paso no visitado no se va, al visitado sí', () => {
      fixtureL.componentInstance.compactSteps.set(true);
      fixtureL.detectChanges();

      pasosL()[3].click();
      fixtureL.detectChanges();
      expect(tituloL()).toBe('Sección 1');

      continuarL().click();
      fixtureL.detectChanges();
      expect(tituloL()).toBe('Sección 2');

      pasosL()[0].click();
      fixtureL.detectChanges();
      expect(tituloL()).toBe('Sección 1');
    });
  });

  describe('los botones de avance', () => {
    let fixtureC: ComponentFixture<HostConfigurable>;
    let hostC: HostConfigurable;

    beforeEach(() => {
      fixtureC = TestBed.createComponent(HostConfigurable);
      hostC = fixtureC.componentInstance;
      fixtureC.detectChanges();
    });

    function continuarC(): HTMLButtonElement {
      return fixtureC.debugElement.query(By.css('[data-testid="paginated-form-continuar"]'))
        .nativeElement as HTMLButtonElement;
    }

    it('por defecto siguen siendo texto: las 53 pantallas no cambian solas', () => {
      expect(continuarC().textContent!.trim()).toBe('Siguiente');
      expect(continuarC().hasAttribute('aria-label')).toBe(false);
    });

    it('con iconOnlyNav son íconos, con su nombre accesible en castellano', () => {
      hostC.iconOnlyNav.set(true);
      fixtureC.detectChanges();

      expect(continuarC().getAttribute('aria-label')).toBe('Siguiente');
      expect(continuarC().querySelector('app-nav-icon')).not.toBeNull();
      expect(continuarC().className).toContain('btn--icon-only');

      hostC.form.controls.documento.setValue('1234567');
      continuarC().click();
      fixtureC.detectChanges();

      const atras = fixtureC.debugElement.query(By.css('[data-testid="paginated-form-atras"]'))
        .nativeElement as HTMLButtonElement;
      expect(atras.getAttribute('aria-label')).toBe('Atrás');
      expect(atras.querySelector('app-nav-icon')).not.toBeNull();
    });

    it('el botón de la última página conserva su texto aunque se pidan íconos', () => {
      hostC.iconOnlyNav.set(true);
      hostC.form.controls.documento.setValue('1234567');
      fixtureC.detectChanges();
      continuarC().click();
      fixtureC.detectChanges();

      // Un ícono que en realidad envía el formulario esconde lo que hace.
      expect(continuarC().textContent!.trim()).toBe('Crear cuenta');
      expect(continuarC().className).not.toContain('btn--icon-only');
    });
  });

  describe('el ícono y la descripción del campo', () => {
    let fixtureC: ComponentFixture<HostConfigurable>;

    beforeEach(() => {
      fixtureC = TestBed.createComponent(HostConfigurable);
      fixtureC.detectChanges();
    });

    it('el glifo va DENTRO del control, y también en el desplegable', () => {
      const enElInput = fixtureC.debugElement.query(
        By.css('app-input app-nav-icon[slot="icon-start"]'),
      );
      const enElSelect = fixtureC.debugElement.query(
        By.css('app-select app-nav-icon[slot="icon-start"]'),
      );

      expect(enElInput).not.toBeNull();
      expect(enElSelect).not.toBeNull();
    });

    it('el glifo no aporta el nombre accesible: quitarlo no cambia lo que se anuncia', () => {
      const glifo = fixtureC.debugElement.query(By.css('app-input app-nav-icon svg'))
        .nativeElement as SVGElement;

      expect(glifo.getAttribute('aria-hidden')).toBe('true');
    });

    it('la descripción se suma al hint, no lo reemplaza (ADR-0008)', () => {
      const campo = fixtureC.debugElement.query(By.css('app-form-field'))
        .nativeElement as HTMLElement;
      const hint = campo.querySelector('.form-field-hint');
      const descripcion = campo.querySelector('.form-field-description');
      const input = campo.querySelector('input')!;

      // El hint sigue abajo del campo, visible y sin puntero de por medio.
      expect(hint).not.toBeNull();
      expect(hint!.textContent).toContain('Con este número vas a iniciar sesión');
      expect(descripcion).not.toBeNull();

      // Y las dos describen al control: el hint no perdió su aria-describedby.
      const descritoPor = (input.getAttribute('aria-describedby') ?? '').split(' ');
      expect(descritoPor).toContain(hint!.id);
      expect(descritoPor).toContain(descripcion!.id);
    });

    it('sin placeholder propio, la descripción también va al placeholder', () => {
      const input = fixtureC.debugElement.query(By.css('input[data-testid="campo-documento"]'))
        .nativeElement as HTMLInputElement;

      expect(input.placeholder).toBe(
        'El número de tu cédula de identidad, sin puntos ni guiones.',
      );
    });
  });

  describe('la punta de la barra', () => {
    it('el motor la enciende: acá el avance es en qué paso va quien mira', () => {
      const barra = fixture.debugElement.query(By.css('app-progress')).nativeElement as HTMLElement;

      expect(barra.classList.contains('progress--with-marker')).toBe(true);
      expect(barra.querySelector('.progress__marker')).not.toBeNull();
      // Y sigue anunciando exactamente lo mismo que antes.
      expect(barra.getAttribute('aria-valuenow')).toBe('0');
    });
  });
});
