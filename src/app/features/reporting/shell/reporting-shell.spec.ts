import { signal } from '@angular/core';
import { DeferBlockBehavior, TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ETIQUETA_VERTICAL, VERTICALES } from '@core/data-access/reporting/reporting-labels';
import { AuthService } from '../../../core/auth/auth.service';
import { ReportContextStore } from '../state/report-context.store';
import { ReportingShell } from './reporting-shell';

describe('ReportingShell', () => {
  let fixture: ComponentFixture<ReportingShell>;
  let shell: ReportingShell;
  let router: Router;
  let contexto: ReportContextStore;

  async function montar(roles: readonly string[]) {
    await TestBed.configureTestingModule({
      imports: [ReportingShell],
      // El asistente es de otro carril: el bloque `@defer` se queda en su
      // `@placeholder` y acá solo se prueba el panel que lo contiene.
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: AuthService, useValue: { roles: signal(roles), displayName: signal(null) } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    contexto = TestBed.inject(ReportContextStore);
    fixture = TestBed.createComponent(ReportingShell);
    shell = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const raiz = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => raiz().querySelector<T>(selector);
  const byTestId = (id: string) => q<HTMLElement>(`[data-testid="${id}"]`);

  async function pulsar(elemento: HTMLElement | null): Promise<void> {
    expect(elemento).not.toBeNull();
    elemento?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('el armazón', () => {
    beforeEach(async () => montar(['SECURITY_ADMIN', 'REPORTING_ADMIN']));

    it('lleva el título «Portal de reportería» y un enlace al inicio del portal', () => {
      expect(q('.rep__titulo')?.textContent).toContain('Portal de reportería');
      expect(q('.rep__marca')?.getAttribute('href')).toBe('/reports');
    });

    it('tiene un salto al contenido y un <main> donde se pinta el reporte', () => {
      expect(q('.rep__saltar')?.getAttribute('href')).toBe('#reporting-contenido');
      expect(q('main#reporting-contenido')).not.toBeNull();
      expect(q('main router-outlet')).not.toBeNull();
    });

    it('la navegación ofrece Inicio y las siete pestañas con los rótulos del catálogo', () => {
      const enlaces = Array.from(raiz().querySelectorAll<HTMLAnchorElement>('#reporting-nav a'));

      expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([
        '/reports',
        ...VERTICALES.map((v) => `/reports/commercial/${v}`),
      ]);
      expect(enlaces.slice(1).map((a) => a.textContent?.trim())).toEqual(
        VERTICALES.map((v) => ETIQUETA_VERTICAL[v]),
      );
      expect(enlaces).toHaveLength(8);
    });

    it('marca la página actual con aria-current, y solo esa', async () => {
      await router.navigateByUrl('/reports/commercial/cobros');
      fixture.detectChanges();

      const actuales = raiz().querySelectorAll('#reporting-nav [aria-current="page"]');
      expect(actuales).toHaveLength(1);
      expect(actuales[0].getAttribute('data-testid')).toBe('reporting-nav-cobros');
      expect(actuales[0].classList).toContain('is-activa');
    });

    it('«Inicio» solo se marca en el inicio exacto, no en cada pestaña', async () => {
      await router.navigateByUrl('/reports/commercial/calidad');
      fixture.detectChanges();

      const inicio = q('#reporting-nav a[href="/reports"]');
      expect(inicio?.classList).not.toContain('is-activa');
    });
  });

  describe('el conmutador de alcance', () => {
    beforeEach(async () => montar(['REPORTING_ADMIN']));

    it('arranca en el alcance del almacén (plataforma)', () => {
      expect(contexto.alcance()).toBe('plataforma');
      expect(byTestId('segmentado-plataforma')?.getAttribute('aria-checked')).toBe('true');
      expect(byTestId('segmentado-organizacion')?.getAttribute('aria-checked')).toBe('false');
    });

    it('elegir «Mi organización» escribe en ReportContextStore.alcance', async () => {
      await pulsar(byTestId('segmentado-organizacion'));

      expect(contexto.alcance()).toBe('organizacion');
      expect(byTestId('segmentado-organizacion')?.getAttribute('aria-checked')).toBe('true');
    });

    it('si el almacén cambia por otro lado, el conmutador lo refleja', () => {
      contexto.alcance.set('organizacion');
      fixture.detectChanges();

      expect(byTestId('segmentado-organizacion')?.getAttribute('aria-checked')).toBe('true');
    });

    it('el grupo tiene nombre accesible', () => {
      expect(q('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Alcance de los reportes');
    });
  });

  describe('cambiar de portal', () => {
    it('con los dos accesos ofrece «Cambiar de portal» (al selector) y «Portal de administración» (a «/»)', async () => {
      await montar(['SECURITY_ADMIN', 'REPORTING_ADMIN']);

      expect(byTestId('reporting-cambiar-portal')?.getAttribute('href')).toBe('/portal-selector');
      expect(byTestId('reporting-ir-administracion')?.getAttribute('href')).toBe('/');
    });

    it('quien solo tiene reportería no ve enlaces a un portal que no es suyo', async () => {
      await montar(['REPORT_VIEWER']);

      expect(byTestId('reporting-cambiar-portal')).toBeNull();
      expect(byTestId('reporting-ir-administracion')).toBeNull();
    });
  });

  describe('el panel del asistente', () => {
    beforeEach(async () => montar(['REPORTING_ADMIN']));

    it('nace cerrado: el centro son los reportes', () => {
      expect(shell.asistenteAbierto()).toBe(false);
      expect(byTestId('reporting-asistente')).toBeNull();
      expect(byTestId('reporting-asistente-boton')?.getAttribute('aria-expanded')).toBe('false');
    });

    it('el botón «Preguntar a sus reportes» lo abre y lo declara con aria-expanded', async () => {
      const boton = byTestId('reporting-asistente-boton');
      expect(boton?.textContent).toContain('Preguntar a sus reportes');

      await pulsar(boton);

      expect(byTestId('reporting-asistente')).not.toBeNull();
      expect(boton?.getAttribute('aria-expanded')).toBe('true');
      expect(boton?.getAttribute('aria-controls')).toBe('reporting-asistente');
      expect(q('#reporting-asistente')?.getAttribute('aria-labelledby')).toBe(
        'reporting-asistente-titulo',
      );
    });

    it('el foco entra al panel al abrirlo', async () => {
      await pulsar(byTestId('reporting-asistente-boton'));

      expect(document.activeElement).toBe(byTestId('reporting-asistente'));
    });

    it('«Cerrar» lo cierra y devuelve el foco al botón que lo abrió', async () => {
      const boton = byTestId('reporting-asistente-boton');
      await pulsar(boton);
      await pulsar(byTestId('reporting-asistente-cerrar'));

      expect(byTestId('reporting-asistente')?.hidden).toBe(true);
      expect(boton?.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(boton);
    });

    it('cerrarlo lo oculta pero no lo destruye: al volver a abrirlo es el mismo panel', async () => {
      const boton = byTestId('reporting-asistente-boton');
      await pulsar(boton);
      const panel = byTestId('reporting-asistente');
      await pulsar(byTestId('reporting-asistente-cerrar'));
      await pulsar(boton);

      expect(byTestId('reporting-asistente')).toBe(panel);
      expect(panel?.hidden).toBe(false);
    });

    it('Escape lo cierra', async () => {
      await pulsar(byTestId('reporting-asistente-boton'));

      byTestId('reporting-asistente')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      fixture.detectChanges();

      expect(shell.asistenteAbierto()).toBe(false);
    });

    it('un Escape que ya atendió un menú o un diálogo anidado no cierra además el asistente', async () => {
      await pulsar(byTestId('reporting-asistente-boton'));
      const panel = byTestId('reporting-asistente');
      const menu = document.createElement('div');
      menu.setAttribute('role', 'menu');
      panel?.appendChild(menu);

      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const atendido = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      atendido.preventDefault();
      panel?.dispatchEvent(atendido);
      fixture.detectChanges();

      expect(shell.asistenteAbierto()).toBe(true);
    });

    it('abrirlo no cambia lo que hay en el centro', async () => {
      await pulsar(byTestId('reporting-asistente-boton'));

      expect(q('main#reporting-contenido')).not.toBeNull();
      expect(q('.rep')?.classList).toContain('rep--con-asistente');
    });
  });

  describe('el menú en pantallas angostas', () => {
    beforeEach(async () => montar(['REPORTING_ADMIN']));

    it('el botón «Menú» abre y cierra el cajón y lo declara con aria-expanded', async () => {
      const boton = byTestId('reporting-menu');
      expect(boton?.textContent).toContain('Menú');
      expect(boton?.getAttribute('aria-expanded')).toBe('false');
      expect(q('#reporting-nav')?.classList).not.toContain('is-abierto');

      await pulsar(boton);
      expect(boton?.getAttribute('aria-expanded')).toBe('true');
      expect(q('#reporting-nav')?.classList).toContain('is-abierto');

      await pulsar(boton);
      expect(q('#reporting-nav')?.classList).not.toContain('is-abierto');
    });

    it('elegir un destino cierra el cajón', async () => {
      await pulsar(byTestId('reporting-menu'));
      expect(shell.menuAbierto()).toBe(true);

      await router.navigateByUrl('/reports/commercial/publicidad');
      fixture.detectChanges();

      expect(shell.menuAbierto()).toBe(false);
    });

    it('Escape cierra el cajón', async () => {
      await pulsar(byTestId('reporting-menu'));

      q('.rep')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(shell.menuAbierto()).toBe(false);
    });
  });
});
