import { Component, inject, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterLink } from '@angular/router';

import { empty, loading, ready, unexpectedError } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { expectNoSeriousViolations } from '../../../testing/a11y';
import { Badge } from './atoms/badge/badge';
import { BADGE_VARIANTS } from './atoms/badge/badge.types';
import { AppButton } from './atoms/button/button';
import { AppButtonLink } from './atoms/button/button-link';
import { BUTTON_VARIANTS } from './atoms/button/button.types';
import { Input } from './atoms/input/input';
import { Select } from './atoms/select/select';
import { FormField } from './molecules/form-field/form-field';
import { Tab } from './molecules/tabs/tab/tab';
import { Tabs } from './molecules/tabs/tabs';
import { ToastService } from './molecules/toast/toast.service';
import { ContentDialog } from './organisms/content-dialog/content-dialog';
import { DataTable } from './organisms/data-table/data-table';
import { Shell } from './organisms/shell/shell';
import { SideNav } from './organisms/side-nav/side-nav';
import type { NavSection } from './organisms/side-nav/side-nav.types';
import { ToastContainer } from './organisms/toast-container/toast-container';

/**
 * Gate de accesibilidad de los componentes compartidos críticos (axe, WCAG 2.2
 * A/AA). Bloquea el pull request **sólo** ante violaciones `serious` o
 * `critical`.
 *
 * ## En qué se diferencia de `a11y.spec.ts`
 *
 * `a11y.spec.ts` audita el catálogo del sistema de diseño en su estado más
 * cargado y no admite **ninguna** violación. Este archivo cubre lo que ese no
 * monta —el modal de contenido, los avisos, las insignias, los botones, el
 * armazón y la navegación lateral— y los estados que ahí no aparecen: campos
 * deshabilitados o de sólo lectura, pestañas deshabilitadas, tablas cargando,
 * vacías o en error, el cajón abierto.
 *
 * ## Qué afirma y qué no
 *
 * Afirma **reglas** de axe, nunca valores: ningún caso fija un color, un `role`
 * o un texto concreto. Los tokens de color y el anillo de foco pueden cambiar;
 * la insignia puede pasar a anunciarse como región viva. Mientras el resultado
 * siga siendo accesible, estas pruebas siguen en verde. Lo que necesita
 * píxeles —contraste, área táctil— no se ve en jsdom y se mide en otro lado
 * (ver `src/testing/a11y.ts`).
 */

/* ── Modal de contenido ─────────────────────────────────────────────────── */

@Component({
  imports: [ContentDialog, FormField, Input, AppButton],
  template: `
    <app-content-dialog
      heading="Editar el motivo de la consulta"
      description="El cambio queda en la historia clínica con su firma."
    >
      <app-form-field label="Motivo" hint="Máximo 200 caracteres" [required]="true">
        <app-input type="text" />
      </app-form-field>
      <div dialog-actions>
        <button app-button type="button" variant="ghost">Cancelar</button>
        <button app-button type="submit">Guardar</button>
      </div>
    </app-content-dialog>
  `,
})
class ContentDialogHost {}

@Component({
  imports: [ContentDialog],
  template: `
    <app-content-dialog heading="Aviso de privacidad" closeLabel="Entendido" [dismissible]="false">
      <p>Sus datos se usan sólo para la atención.</p>
    </app-content-dialog>
  `,
})
class BlockingDialogHost {}

/* ── Campos de formulario ───────────────────────────────────────────────── */

@Component({
  imports: [FormField, Input, Select],
  template: `
    <app-form-field label="Correo" hint="Lo usamos para avisarle del turno">
      <app-input type="email" autocomplete="email" [disabled]="true" />
    </app-form-field>
    <app-form-field label="Documento" description="Figura en su cédula">
      <app-input type="text" [readonly]="true" />
    </app-form-field>
    <app-form-field label="Especialidad" errorMessage="Elija una especialidad" [required]="true">
      <app-select [options]="options" [hasError]="true" />
    </app-form-field>
    <app-form-field label="Sede">
      <app-select [options]="options" [disabled]="true" />
    </app-form-field>
  `,
})
class FormFieldStatesHost {
  readonly options = [
    { value: 'car', label: 'Cardiología' },
    { value: 'der', label: 'Dermatología' },
  ];
}

/* ── Avisos ─────────────────────────────────────────────────────────────── */

@Component({
  imports: [ToastContainer],
  template: `<app-toast-container />`,
})
class ToastHost {
  constructor() {
    // Fijos (`durationMs: null`): la prueba no depende de temporizadores.
    const toasts = inject(ToastService);
    toasts.show({ type: 'success', message: 'Turno reservado', durationMs: null });
    toasts.show({
      type: 'info',
      title: 'Recordatorio',
      message: 'Mañana a las 9:00',
      durationMs: null,
    });
    toasts.show({ type: 'warning', message: 'Quedan dos cupos', durationMs: null });
    toasts.show({
      type: 'error',
      title: 'No pudimos guardar',
      message: 'Pruebe de nuevo',
      durationMs: null,
    });
  }
}

/* ── Pestañas ───────────────────────────────────────────────────────────── */

@Component({
  imports: [Tabs, Tab],
  template: `
    <app-tabs [selectedIndex]="1">
      <app-tab label="Resumen">Contenido A</app-tab>
      <app-tab label="Estudios">Contenido B</app-tab>
      <app-tab label="Facturación" [disabled]="true">Contenido C</app-tab>
    </app-tabs>
    <app-tabs orientation="vertical">
      <app-tab label="Datos">Contenido D</app-tab>
      <app-tab label="Permisos">Contenido E</app-tab>
    </app-tabs>
  `,
})
class TabsStatesHost {}

/* ── Insignias ──────────────────────────────────────────────────────────── */

@Component({
  imports: [Badge],
  template: `
    @for (variant of variants; track variant) {
      <app-badge [variant]="variant">{{ variant }}</app-badge>
    }
    <app-badge variant="error" [value]="120" [max]="99" label="Mensajes sin leer" />
    <app-badge variant="info" [dotOnly]="true" label="Hay novedades" />
    <app-badge variant="success" size="sm" [value]="3" label="Turnos confirmados" />
  `,
})
class BadgeHost {
  readonly variants = BADGE_VARIANTS;
}

/* ── Botones ────────────────────────────────────────────────────────────── */

@Component({
  imports: [AppButton, AppButtonLink, RouterLink],
  template: `
    @for (variant of variants; track variant) {
      <button app-button type="button" [variant]="variant">Acción {{ variant }}</button>
    }
    <button app-button type="button" [disabled]="true">Deshabilitado</button>
    <button app-button type="button" [isLoading]="true">Guardando</button>
    <button app-button type="button" variant="ghost" [iconOnly]="true" aria-label="Cerrar">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m7 7 10 10M17 7 7 17" />
      </svg>
    </button>
    <a app-button routerLink="/" variant="secondary">Volver al inicio</a>
    <!-- Deshabilitado sin destino, como pide el propio componente. -->
    <a app-button [disabled]="true">Enlace deshabilitado</a>
  `,
})
class ButtonHost {
  readonly variants = BUTTON_VARIANTS;
}

/* ── Armazón y navegación ───────────────────────────────────────────────── */

const SECTIONS: readonly NavSection[] = [
  {
    label: 'Atención',
    icon: 'home',
    items: [
      { label: 'Inicio', route: '/', icon: 'home' },
      { label: 'Pacientes', route: '/patients', icon: 'patients', badge: 4 },
      { label: 'Reportes', route: '/reports', disabled: true },
    ],
    blocks: [
      {
        label: 'Agenda',
        items: [
          { label: 'Mi semana', route: '/week' },
          { label: 'Bloqueos', route: '/blocks' },
        ],
      },
    ],
  },
];

@Component({ selector: 'app-a11y-gate-view', template: '<h1>Inicio</h1><p>contenido</p>' })
class RoutedView {}

@Component({
  imports: [Shell],
  template: `
    <app-shell
      [user]="{ displayName: 'Andrea Peña', roles: ['Médica'] }"
      [sections]="sections"
      [drawerMode]="drawerMode()"
    />
  `,
})
class ShellHost {
  readonly sections = SECTIONS;
  readonly drawerMode = signal(false);
}

@Component({
  imports: [SideNav],
  template: `
    <app-side-nav
      [sections]="sections"
      [collapsed]="collapsed()"
      [drawer]="drawer()"
      [open]="open()"
    />
  `,
})
class SideNavHost {
  readonly sections = SECTIONS;
  readonly collapsed = signal(false);
  readonly drawer = signal(false);
  readonly open = signal(false);
}

/* ── Tabla de datos, fuera del camino feliz ─────────────────────────────── */

interface PatientRow {
  readonly id: string;
  readonly name: string;
}

@Component({
  imports: [DataTable],
  template: `
    <app-data-table
      caption="Pacientes de la sede"
      [state]="state()"
      [columns]="columns"
      [trackBy]="byId"
      [rowLabel]="labelOf"
      [selectable]="selectable()"
    />
  `,
})
class DataTableStatesHost {
  readonly state = signal<ViewState<readonly PatientRow[]>>(loading());
  readonly selectable = signal(false);
  readonly columns = [
    { key: 'id', header: 'Código', priority: 1 },
    { key: 'name', header: 'Nombre', priority: 0, sortable: true },
  ];
  readonly byId = (row: PatientRow): string => row.id;
  readonly labelOf = (row: PatientRow): string => row.name;
}

/* ── La auditoría ───────────────────────────────────────────────────────── */

/** Margen amplio: con `preload: false` cada auditoría tarda decenas de ms. */
const TIMEOUT_MS = 30_000;

async function mount<T>(
  host: Type<T>,
): Promise<{ root: Element; instance: T; stable: () => Promise<void> }> {
  await TestBed.configureTestingModule({
    providers: [provideRouter([{ path: '**', component: RoutedView, title: 'Inicio' }])],
  }).compileComponents();
  const fixture = TestBed.createComponent(host);
  await fixture.whenStable();
  return {
    root: fixture.nativeElement as Element,
    instance: fixture.componentInstance,
    stable: async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    },
  };
}

describe('Gate de accesibilidad de componentes compartidos (axe, WCAG 2.2 AA, graves)', () => {
  it(
    'modal de contenido abierto, con bajada, un campo y acciones',
    async () => {
      const { root } = await mount(ContentDialogHost);
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'modal de contenido que no se descarta y cierra con otra palabra',
    async () => {
      const { root } = await mount(BlockingDialogHost);
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'campos deshabilitados, de sólo lectura y de selección con error',
    async () => {
      const { root } = await mount(FormFieldStatesHost);
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'avisos de los cuatro tonos, con y sin título',
    async () => {
      const { root } = await mount(ToastHost);
      // Si la cola quedara vacía la prueba no auditaría nada y pasaría igual.
      expect(root.querySelectorAll('app-toast').length).toBe(4);
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'pestañas con una deshabilitada, otra seleccionada y orientación vertical',
    async () => {
      const { root } = await mount(TabsStatesHost);
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'insignias de todas las variantes, con número desbordado y sólo punto',
    async () => {
      const { root } = await mount(BadgeHost);
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'botones de todas las variantes, deshabilitado, cargando, sólo ícono y enlace',
    async () => {
      const { root } = await mount(ButtonHost);
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'armazón con navegación fija',
    async () => {
      const { root } = await mount(ShellHost);
      await TestBed.inject(Router).navigateByUrl('/');
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'armazón en modo cajón',
    async () => {
      const { root, instance, stable } = await mount(ShellHost);
      instance.drawerMode.set(true);
      await TestBed.inject(Router).navigateByUrl('/');
      await stable();
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'navegación lateral expandida, con insignia, ítem deshabilitado y bloques',
    async () => {
      const { root } = await mount(SideNavHost);
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'navegación lateral colapsada',
    async () => {
      const { root, instance, stable } = await mount(SideNavHost);
      instance.collapsed.set(true);
      await stable();
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'navegación lateral como cajón abierto',
    async () => {
      const { root, instance, stable } = await mount(SideNavHost);
      instance.drawer.set(true);
      instance.open.set(true);
      await stable();
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'tabla cargando',
    async () => {
      const { root } = await mount(DataTableStatesHost);
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'tabla vacía con acción siguiente',
    async () => {
      const { root, instance, stable } = await mount(DataTableStatesHost);
      instance.state.set(
        empty({ label: 'Registrar paciente', route: '/patients/new' }, 'Todavía no hay pacientes'),
      );
      await stable();
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'tabla con error inesperado',
    async () => {
      const { root, instance, stable } = await mount(DataTableStatesHost);
      instance.state.set(unexpectedError('req-123'));
      await stable();
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'tabla con datos y selección de filas',
    async () => {
      const { root, instance, stable } = await mount(DataTableStatesHost);
      instance.selectable.set(true);
      instance.state.set(
        ready([
          { id: '1', name: 'Ana Salas' },
          { id: '2', name: 'Beto Ruiz' },
        ]),
      );
      await stable();
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );
});
