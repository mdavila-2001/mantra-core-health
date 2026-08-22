import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ready } from '../../core/view-state/view-state';
import { esperarSinViolaciones } from '../../../testing/a11y';
import { Checkbox } from './atoms/checkbox/checkbox';
import { Input } from './atoms/input/input';
import { Select } from './atoms/select/select';
import { Switch } from './atoms/switch/switch';
import { Textarea } from './atoms/textarea/textarea';
import { Accordion } from './molecules/accordion/accordion';
import { AccordionPanel } from './molecules/accordion/accordion-panel/accordion-panel';
import { Alert } from './molecules/alert/alert';
import { Breadcrumb } from './molecules/breadcrumb/breadcrumb';
import { Dialog } from './molecules/dialog/dialog';
import { FormField } from './molecules/form-field/form-field';
import { Menu } from './molecules/menu/menu';
import { MenuItem } from './molecules/menu/menu-item/menu-item';
import { MenuTrigger } from './molecules/menu/menu-trigger/menu-trigger';
import { Pagination } from './molecules/pagination/pagination';
import { Radio } from './molecules/radio/radio';
import { RadioGroup } from './molecules/radio-group/radio-group';
import { Tab } from './molecules/tabs/tab/tab';
import { Tabs } from './molecules/tabs/tabs';
import { DataTable } from './organisms/data-table/data-table';
import { PaginatedForm } from './organisms/paginated-form/paginated-form';
import { StatusSeal } from './organisms/status-seal/status-seal';

/**
 * Auditoría automática de accesibilidad del sistema de diseño.
 *
 * ## Por qué un archivo y no una aserción en cada spec
 *
 * Las ~90 reglas de axe son **las mismas para todos los componentes**. Repetir
 * la llamada en cuarenta specs no encuentra ni una violación más y garantiza
 * que el día que haya que ajustar el ruleset —una regla que jsdom no puede
 * evaluar, una excepción documentada— haya que tocar cuarenta archivos.
 *
 * Acá está la lista completa de lo auditado, a la vista, y agregar un
 * componente es agregar una línea.
 *
 * ## Qué encuentra esto que las otras pruebas no
 *
 * Las pruebas de cada componente afirman **el contrato que alguien escribió a
 * mano**: que el `aria-describedby` apunte al error, que el `role` sea `alert`.
 * Eso cubre lo que se pensó. axe cubre lo que no: un `aria-*` con valor
 * inválido, un `role` al que le falta un hijo obligatorio, dos `id` iguales.
 *
 * Y lo que **no** cubre está escrito en `src/testing/a11y.ts`: todo lo que
 * necesita píxeles —contraste, área táctil— es invisible en jsdom y se mide en
 * otro lado. Cero violaciones acá no significa «accesible»; significa «sin los
 * errores mecánicos que una máquina puede ver sin renderizar».
 */

/* ── Los estados que se auditan ─────────────────────────────────────────────
 *
 * Cada componente se monta en el estado con **más superficie de accesibilidad**,
 * no en el más simple: un campo con error y ayuda tiene tres asociaciones ARIA
 * que uno vacío no tiene, y son justo las que se rompen.
 */

@Component({
  imports: [FormField, Input],
  template: `
    <app-form-field
      label="Documento de identidad"
      hint="Sin puntos ni guiones"
      errorMessage="Ese documento no existe en el padrón"
      [required]="true"
    >
      <app-input type="text" />
    </app-form-field>
  `,
})
class CampoConError {}

@Component({
  imports: [FormField, Textarea],
  template: `
    <app-form-field label="Motivo de la consulta" hint="Máximo 500 caracteres">
      <app-textarea [maxLength]="500" />
    </app-form-field>
  `,
})
class CampoDeTexto {}

@Component({
  imports: [FormField, Select],
  template: `
    <app-form-field label="Tipo de sangre" [required]="true">
      <app-select [options]="opciones" />
    </app-form-field>
  `,
})
class CampoDeSeleccion {
  readonly opciones = [
    { value: 'a+', label: 'A positivo' },
    { value: 'o-', label: 'O negativo' },
  ];
}

@Component({
  imports: [Checkbox, Switch],
  template: `
    <app-checkbox label="Acepto el tratamiento de mis datos" />
    <app-checkbox label="Indeterminado" [indeterminate]="true" />
    <app-switch label="Recibir recordatorios" />
  `,
})
class Conmutadores {}

@Component({
  imports: [FormField, RadioGroup, Radio],
  template: `
    <app-form-field label="Vía de contacto preferida">
      <app-radio-group>
        <app-radio value="email" label="Correo" />
        <app-radio value="sms" label="Mensaje de texto" />
        <app-radio value="tel" label="Llamada" [disabled]="true" />
      </app-radio-group>
    </app-form-field>
  `,
})
class GrupoDeOpciones {}

@Component({
  imports: [Alert],
  template: `
    <app-alert tone="error" title="No pudimos guardar" [dismissible]="true">
      Revisá la conexión e intentá de nuevo.
    </app-alert>
  `,
})
class Aviso {}

@Component({
  imports: [Tabs, Tab],
  template: `
    <app-tabs>
      <app-tab label="Datos personales">Contenido A</app-tab>
      <app-tab label="Antecedentes">Contenido B</app-tab>
    </app-tabs>
  `,
})
class Pestanas {}

@Component({
  imports: [Accordion, AccordionPanel],
  template: `
    <app-accordion>
      <app-accordion-panel heading="Alergias" [expanded]="true">Ninguna</app-accordion-panel>
      <app-accordion-panel heading="Medicación">Ninguna</app-accordion-panel>
    </app-accordion>
  `,
})
class Acordeon {}

@Component({
  imports: [Menu, MenuItem, MenuTrigger],
  template: `
    <button type="button" [appMenuTrigger]="menu">Acciones</button>
    <app-menu #menu>
      <app-menu-item>Ver historia</app-menu-item>
      <app-menu-item [destructive]="true">Dar de baja</app-menu-item>
    </app-menu>
  `,
})
class MenuDeAcciones {}

@Component({
  imports: [Breadcrumb],
  template: `<app-breadcrumb [items]="items" />`,
})
class Migas {
  readonly items = [
    { label: 'Inicio', routerLink: '/' },
    { label: 'Pacientes', routerLink: '/pacientes' },
    { label: 'Ana Salas' },
  ];
}

@Component({
  imports: [Pagination],
  template: `<app-pagination [totalItems]="120" />`,
})
class Paginado {}

@Component({
  imports: [Dialog],
  template: `<app-dialog [config]="config" />`,
})
class Confirmacion {
  readonly config = {
    title: 'Dar de baja el episodio',
    message: 'Esta acción no se puede deshacer.',
    destructive: true,
  };
}

@Component({
  imports: [StatusSeal],
  template: `
    <app-status-seal variant="approved" label="Aprobado">Emitido el 12 de julio de 2026.</app-status-seal>
  `,
})
class SelloDeEstado {}

interface Fila {
  readonly id: string;
  readonly nombre: string;
}

@Component({
  imports: [DataTable],
  template: `
    <app-data-table
      caption="Pacientes de la sede"
      [state]="estado()"
      [columns]="columnas"
      [trackBy]="porId"
      [sort]="{ key: 'nombre', direction: 'asc' }"
    />
  `,
})
class Tabla {
  readonly estado = signal(
    ready<readonly Fila[]>([
      { id: '1', nombre: 'Ana Salas' },
      { id: '2', nombre: 'Beto Ruiz' },
    ]),
  );
  readonly columnas = [
    { key: 'id', header: 'Código', priority: 1 },
    { key: 'nombre', header: 'Nombre', priority: 0, sortable: true },
  ];
  readonly porId = (fila: Fila): string => fila.id;
}

/* ── La auditoría ───────────────────────────────────────────────────────────
 *
 * Un caso por componente en vez de un bucle sobre un arreglo: cuando uno falla,
 * el nombre de la prueba ya dice cuál es y no hay que leer el índice.
 */

@Component({
  imports: [PaginatedForm],
  template: `<app-paginated-form [paginas]="paginas" [form]="form" label="Crear cuenta" />`,
})
class FormularioPorPartes {
  readonly form = new FormGroup({
    documento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    correo: new FormControl('', { nonNullable: true }),
  });
  readonly paginas = [
    {
      titulo: 'Identidad',
      hint: 'Los datos de tu documento.',
      campos: [
        { key: 'documento', label: 'Documento', control: 'text' as const, required: true },
        { key: 'correo', label: 'Correo', control: 'email' as const },
      ],
    },
    { titulo: 'Acceso', campos: [] },
  ];

  constructor() {
    // Con el campo tocado e inválido: es el estado con las tres asociaciones
    // ARIA vivas (nombre, descripción y error), que es donde se rompen.
    this.form.controls.documento.markAsTouched();
  }
}

const CASOS: readonly { nombre: string; host: unknown }[] = [
  { nombre: 'campo con error, ayuda y obligatoriedad', host: CampoConError },
  { nombre: 'campo de texto largo con contador', host: CampoDeTexto },
  { nombre: 'campo de selección', host: CampoDeSeleccion },
  { nombre: 'casillas y conmutador, incluido el indeterminado', host: Conmutadores },
  { nombre: 'grupo de opciones con una deshabilitada', host: GrupoDeOpciones },
  { nombre: 'aviso de error descartable', host: Aviso },
  { nombre: 'pestañas', host: Pestanas },
  { nombre: 'acordeón con un panel abierto', host: Acordeon },
  { nombre: 'menú de acciones con una destructiva', host: MenuDeAcciones },
  { nombre: 'ruta de navegación', host: Migas },
  { nombre: 'paginado', host: Paginado },
  { nombre: 'confirmación destructiva', host: Confirmacion },
  { nombre: 'tabla con datos y una columna ordenada', host: Tabla },
  { nombre: 'sello de estado con detalle', host: SelloDeEstado },
  { nombre: 'formulario por partes, con un campo en error', host: FormularioPorPartes },
];

describe('Accesibilidad del sistema de diseño (axe)', () => {
  for (const caso of CASOS) {
    it(caso.nombre, async () => {
      await TestBed.configureTestingModule({
        // El `routerLink` de las migas necesita un router; sin él el componente
        // ni siquiera compila y el fallo no diría nada de accesibilidad.
        providers: [provideRouter([])],
      }).compileComponents();

      const fixture = TestBed.createComponent(caso.host as never);
      await fixture.whenStable();

      await esperarSinViolaciones(fixture.nativeElement as Element);
      // Margen amplio y barato: con `preload: false` cada auditoría tarda unos
      // 60 ms, así que estos 30 s no se gastan nunca en verde. Están para que
      // un agente de CI cargado no produzca un rojo por tiempo, que es el peor
      // tipo de rojo: el que no dice nada y enseña a reintentar.
    }, 30_000);
  }
});
