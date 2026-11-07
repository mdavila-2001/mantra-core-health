import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileDownloadService } from '../../../../../shared/utils/file-download/file-download.service';
import { AHORA_DEMO, ARISTAS_DEMO, NODOS_DEMO } from '../red-clinica.demo';
import type { NodoDeRed } from '../red-clinica.types';
import { RedClinicaPanel, vinculosDe, type PresentacionDelPanel } from './red-clinica-panel';
import { accionDelPedido } from './red-clinica-panel.vinculos';

@Component({
  imports: [RedClinicaPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" data-testid="disparador" (click)="abrir('e1')">Abrir</button>
    <app-red-clinica-panel
      [nodo]="nodo()"
      [nodos]="nodos"
      [aristas]="aristas"
      [ahora]="ahora"
      [presentacion]="presentacion()"
      [pacienteId]="paciente()"
      (nodoElegido)="elegidos.push($event); abrir($event)"
      (cerrado)="cierres = cierres + 1; nodo.set(null)"
    >
      <button panel-acciones type="button" data-testid="accion-del-padre">Ver el registro completo</button>
    </app-red-clinica-panel>
  `,
})
class Anfitrion {
  readonly nodos = NODOS_DEMO;
  readonly aristas = ARISTAS_DEMO;
  readonly ahora = AHORA_DEMO;
  readonly nodo = signal<NodoDeRed | null>(null);
  readonly presentacion = signal<PresentacionDelPanel>('lateral');
  /** Sin paciente (como en el banco), el panel muestra lo que trae el nodo y no lee nada. */
  readonly paciente = signal<string | null>(null);
  readonly elegidos: string[] = [];
  cierres = 0;

  abrir(id: string): void {
    this.nodo.set(this.nodos.find((n) => n.id === id) ?? null);
  }
}

describe('vinculosDe', () => {
  it('lee cada arista desde la punta del nodo, salientes primero', () => {
    const v = vinculosDe('e1', ARISTAS_DEMO, NODOS_DEMO);
    expect(v.map((x) => `${x.sentido}:${x.tipo}:${x.otroId}`)).toEqual([
      'saliente:registrado-en:a1',
      'saliente:pedido-para:dx2',
      'saliente:evidencia-de:dx2',
      'saliente:evidencia-de:dx1',
    ]);
    expect(v[1].relacion).toBe('Se pidió para estudiar');
  });

  it('marca el inferido y deja en null la punta que no está a la vista', () => {
    const v = vinculosDe('e2', [...ARISTAS_DEMO, { desde: 'fantasma', hasta: 'e2', tipo: 'resultado-de' }], NODOS_DEMO);
    expect(v.find((x) => x.otroId === 'a1')?.inferido).toBe(true);
    const fuera = v.find((x) => x.otroId === 'fantasma');
    expect(fuera?.otro).toBeNull();
    expect(fuera?.relacion).toBe('Su resultado');
  });

  it('ignora los lazos de un nodo consigo mismo', () => {
    expect(vinculosDe('x', [{ desde: 'x', hasta: 'x', tipo: 'registrado-en' }], [])).toEqual([]);
  });
});

describe('accionDelPedido', () => {
  it('lleva a lo que motivó el pedido; si no está, a la atención donde se pidió; si nada, null', () => {
    expect(accionDelPedido(vinculosDe('e3', ARISTAS_DEMO, NODOS_DEMO))?.nodoId).toBe('dx2');
    const sinMotivo = ARISTAS_DEMO.filter((a) => !(a.desde === 'e3' && a.tipo === 'pedido-para'));
    expect(accionDelPedido(vinculosDe('e3', sinMotivo, NODOS_DEMO))).toEqual({ nodoId: 'a3', etiqueta: 'Ver la atención donde se pidió' });
    expect(accionDelPedido(vinculosDe('e3', [], NODOS_DEMO))).toBeNull();
  });
});

describe('RedClinicaPanel', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let host: Anfitrion;
  let http: HttpTestingController;
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const panel = () => el().querySelector<HTMLElement>('[data-testid="red-panel"]');
  const texto = () => panel()?.textContent?.replace(/\s+/g, ' ') ?? '';

  async function abrir(id: string): Promise<void> {
    host.abrir(id);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    host = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('cerrado no dibuja nada', () => {
    expect(panel()).toBeNull();
  });

  it('abre como columna lateral, sin velo, con qué, cuándo, quién y estado', async () => {
    await abrir('e1');
    expect(panel()?.tagName).toBe('ASIDE');
    expect(panel()?.getAttribute('aria-labelledby')).toBe(panel()?.querySelector('h2')?.id);
    expect(texto()).toContain('Monitoreo ambulatorio de presión (MAPA)');
    expect(texto()).toContain('Estudio');
    expect(texto()).toContain('Dra. Ana Rojas');
    expect(texto()).toContain('Resultado liberado');
    // Months alone in the text; the exact days, only as the `title`.
    const hace = el().querySelector<HTMLElement>('.panel__hecho [title]')!;
    expect(hace.textContent).toContain('hace 3\u00a0meses');
    expect(hace.title).toBe('94\u00a0días');
    expect(texto()).not.toContain('(94');
  });

  it('al abrir, el foco va al título; Escape cierra y lo devuelve a quien lo abrió', async () => {
    const disparador = el().querySelector<HTMLButtonElement>('[data-testid="disparador"]')!;
    disparador.focus();
    disparador.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(panel()?.querySelector('h2'));

    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.cierres).toBe(1);
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(disparador);
  });

  it('el botón «Cerrar el detalle» emite cerrado', async () => {
    await abrir('dx2');
    el().querySelector<HTMLButtonElement>('[data-testid="red-panel-cerrar"] , [data-testid="red-panel-cerrar"] button')?.click();
    fixture.detectChanges();
    expect(host.cierres).toBe(1);
  });

  describe('estudio', () => {
    it('muestra los valores con unidad y rango, y marca los fuera de rango con texto, no sólo color', async () => {
      await abrir('e1');
      const filas = Array.from(el().querySelectorAll<HTMLTableRowElement>('[data-testid="red-panel-valor"]'));
      expect(filas).toHaveLength(3);
      expect(filas[0].textContent).toContain('148 mmHg');
      expect(filas[0].textContent).toContain('≤ 135 mmHg');
      expect(filas[0].textContent).toContain('Alto');
      expect(filas[0].classList).toContain('panel__fila--fuera');
      expect(filas[2].textContent).not.toContain('Alto');
      expect(filas[2].classList).not.toContain('panel__fila--fuera');
      expect(texto()).toContain('2 valores fuera de rango');
      expect(texto()).toContain('Patrón hipertensivo');
    });

    it('sin resultado liberado lo dice, con la antigüedad del pedido sin repetir los días', async () => {
      await abrir('e3');
      const s3 = el().querySelector<HTMLElement>('[data-testid="red-panel-sin-resultado"]')!;
      expect(s3.textContent).toContain('pedido hace 2\u00a0meses');
      expect(s3.textContent).not.toContain('65');
      expect(s3.querySelector<HTMLElement>('[title]')?.title).toBe('65\u00a0días');
      expect(el().querySelector('[data-testid="red-panel-valor"]')).toBeNull();
    });

    it('S3 ofrece su próxima acción: la del padre va bajo el aviso, no al pie', async () => {
      await abrir('e3');
      const s3 = el().querySelector('.panel__sin-resultado')!;
      expect(s3.textContent).toContain('cuando el laboratorio libere el informe');
      expect(s3.querySelector('[data-testid="accion-del-padre"]')).not.toBeNull();
      expect(el().querySelectorAll('[data-testid="accion-del-padre"]')).toHaveLength(1);
      // Its own next action, even when the parent adds none: what it was ordered for.
      const propia = s3.querySelector<HTMLElement>('[data-testid="red-panel-sin-resultado-accion"]')!;
      expect(propia.textContent?.trim()).toBe('Ver el diagnóstico por el que se pidió');
      propia.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.elegidos).toEqual(['dx2']);
      await abrir('e1');
      expect(el().querySelector('.panel__sin-resultado')).toBeNull();
      expect(el().querySelector('.panel__acciones [data-testid="accion-del-padre"]')).not.toBeNull();
    });

    it('menos de 60 días: cifra y unidad unidas (no se parte «hace 14 / días») y sin title redundante', async () => {
      host.nodo.set({ ...NODOS_DEMO.find((n) => n.id === 'e3')!, cuando: new Date(AHORA_DEMO.getTime() - 14 * 86_400_000) });
      fixture.detectChanges();
      await fixture.whenStable();
      const s3 = el().querySelector<HTMLElement>('[data-testid="red-panel-sin-resultado"]')!;
      expect(s3.textContent).toContain('pedido hace 14\u00a0días');
      expect(s3.querySelector('[title]')).toBeNull();
    });

    it('«Pendiente» con el «info» genérico de las órdenes sale en el tono de aviso, no en el de «Completado»', async () => {
      const e3 = NODOS_DEMO.find((n) => n.id === 'e3')!;
      host.nodo.set({ ...e3, estado: { etiqueta: 'Pendiente', tono: 'info' } });
      fixture.detectChanges();
      await fixture.whenStable();
      const pendiente = panel()!.querySelector('.panel__hechos app-badge')!;
      expect(pendiente.className).toContain('warning');
      expect(pendiente.className).not.toContain('info');
      host.nodo.set(NODOS_DEMO.find((n) => n.id === 'e1')!);
      host.nodo.set({ ...host.nodo()!, estado: { etiqueta: 'Completado', tono: 'info' } });
      fixture.detectChanges();
      await fixture.whenStable();
      expect(panel()!.querySelector('.panel__hechos app-badge')!.className).toContain('success');
    });

    /** Con paciente, abrir el MAPA lee su informe; se responde con lo mismo que trae el nodo. */
    async function abrirMapaConInforme(): Promise<void> {
      host.paciente.set('pac-1');
      await abrir('e1');
      http.expectOne((r) => r.url.endsWith('/diagnostics/patients/pac-1/reports/inf-mapa')).flush({
        reportId: 'inf-mapa', patientProfileId: 'pac-1', serviceRequestId: null, codeConceptId: 'mapa', codeDisplay: 'MAPA',
        categoryConceptId: null, versionId: 'v1', versionNumber: 1, clinicalStatusConceptId: 'st', issuedAt: null,
        releasedAt: '2026-08-20T12:00:00.000Z', patientVisible: true, conclusionText: 'Patrón hipertensivo.',
        values: [], files: [{ id: 'f', fileId: 'file-mapa', name: 'Informe MAPA.pdf', contentRoleConceptId: 'rol', presentationFormatConceptId: null, ordinal: 1 }],
      });
      fixture.detectChanges();
      await fixture.whenStable();
    }
    const URL_DEL_PDF = '/diagnostics/patients/pac-1/reports/inf-mapa/files/file-mapa/content';

    it('sin paciente no ofrece bajar el archivo: no tiene por dónde', async () => {
      await abrir('e1');
      expect(el().querySelector('[data-testid="red-panel-archivo"]')).toBeNull();
    });

    it('descarga el PDF por la ruta del informe para el médico, no por /common/files', async () => {
      const save = vi.spyOn(TestBed.inject(FileDownloadService), 'save').mockImplementation(() => undefined);
      await abrirMapaConInforme();
      el().querySelector<HTMLElement>('[data-testid="red-panel-archivo"]')!.click();
      fixture.detectChanges();
      const req = http.expectOne((r) => r.url.endsWith(URL_DEL_PDF));
      expect(req.request.method).toBe('GET');
      req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
      await vi.waitFor(() => expect(save).toHaveBeenCalled());
      expect(save.mock.calls[0][1]).toBe('Informe MAPA.pdf');
      fixture.detectChanges();
      expect(texto()).toContain('Descarga iniciada');
      http.expectNone((r) => r.url.includes('/common/files/'));
    });

    it('un 403 se muestra como «no puede abrir», sin romper el resto (S5)', async () => {
      await abrirMapaConInforme();
      el().querySelector<HTMLElement>('[data-testid="red-panel-archivo"]')!.click();
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith(URL_DEL_PDF))
        .flush(new Blob([JSON.stringify({ code: 'FORBIDDEN', message: 'Sin acceso', correlationId: 'req-403' })], { type: 'application/json' }), {
          status: 403,
          statusText: 'Forbidden',
        });
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(texto()).toContain('No puede abrir este archivo');
      });
      expect(texto()).toContain('Patrón hipertensivo');
    });

    it('un 500 muestra el código de soporte (S9)', async () => {
      await abrirMapaConInforme();
      el().querySelector<HTMLElement>('[data-testid="red-panel-archivo"]')!.click();
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith(URL_DEL_PDF))
        .flush(new Blob(['x']), { status: 500, statusText: 'Error', headers: { 'x-request-id': 'req-123' } });
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(texto()).toContain('No se pudo descargar el archivo');
      });
      expect(texto()).toContain('Código de soporte');
    });

    it('cambiar el ancho (lateral ⇄ hoja) no cancela la descarga en curso', async () => {
      vi.spyOn(TestBed.inject(FileDownloadService), 'save').mockImplementation(() => undefined);
      await abrirMapaConInforme();
      el().querySelector<HTMLElement>('[data-testid="red-panel-archivo"]')!.click();
      fixture.detectChanges();
      const req = http.expectOne((r) => r.url.endsWith(URL_DEL_PDF));
      host.presentacion.set('hoja');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(panel()?.tagName).toBe('DIALOG');
      expect(req.cancelled).toBe(false);
      req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(texto()).toContain('Descarga iniciada');
      });
    });

    it('el aviso de la descarga entra en vista al aparecer, sin animar con movimiento reducido', async () => {
      const original = HTMLElement.prototype.scrollIntoView;
      const scroll = vi.fn();
      HTMLElement.prototype.scrollIntoView = scroll;
      try {
        await abrirMapaConInforme();
        el().querySelector<HTMLElement>('[data-testid="red-panel-archivo"]')!.click();
        fixture.detectChanges();
        http.expectOne((r) => r.url.endsWith(URL_DEL_PDF)).flush(new Blob(['x']), { status: 500, statusText: 'Error' });
        await vi.waitFor(() => {
          fixture.detectChanges();
          expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
        });
        expect((scroll.mock.contexts[0] as HTMLElement).textContent).toContain('No se pudo descargar el archivo');
      } finally {
        HTMLElement.prototype.scrollIntoView = original;
      }
    });

    it('cambiar de nodo cancela la descarga en curso', async () => {
      await abrirMapaConInforme();
      el().querySelector<HTMLElement>('[data-testid="red-panel-archivo"]')!.click();
      fixture.detectChanges();
      const req = http.expectOne((r) => r.url.endsWith(URL_DEL_PDF));
      await abrir('e2');
      expect(req.cancelled).toBe(true);
    });
  });

  describe('diagnóstico', () => {
    it('muestra el razonamiento: certeza, nota, quién y cuándo decidió, motivo y evidencia', async () => {
      await abrir('dx1');
      const r = el().querySelector('[data-testid="red-panel-razonamiento"]')!.textContent!.replace(/\s+/g, ' ');
      expect(r).toContain('Descartado');
      expect(r).toContain('sin signos de alarma');
      expect(r).toContain('por Dra. Ana Rojas');
      expect(r).toContain('El monitoreo ambulatorio muestra');
      expect(r).toContain('Basado en el análisis');
    });

    it('«reemplazado por» y la evidencia navegan al otro nodo', async () => {
      await abrir('dx1');
      el().querySelector<HTMLButtonElement>('[data-testid="red-panel-reemplazo"] button')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.elegidos).toEqual(['dx2']);
      expect(texto()).toContain('Hipertensión arterial esencial');
    });

    it('al navegar a otro nodo el foco va al nuevo título', async () => {
      await abrir('dx1');
      el().querySelector<HTMLButtonElement>('[data-testid="red-panel-reemplazo"] button')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement?.textContent).toContain('Hipertensión arterial esencial');
    });

    it('un presuntivo sin decisión dice desde cuándo está abierto', async () => {
      await abrir('dx3');
      expect(texto()).toContain('Presuntivo, en estudio');
      expect(texto()).toContain('Todavía no se confirmó ni se descartó · registrado hace 2 meses');
      expect(texto()).not.toContain('(65');
    });
  });

  describe('derivación', () => {
    it('muestra motivo, resumen, respuesta, llegada y la falta de contrarreferencia', async () => {
      await abrir('d1');
      const d = el().querySelector('[data-testid="red-panel-derivacion"]')!.textContent!.replace(/\s+/g, ' ');
      expect(d).toContain('Evaluar daño de órgano blanco');
      expect(d).toContain('HTA confirmada por MAPA');
      expect(d).toContain('Aceptada');
      expect(d).toContain('Llegó el');
      expect(d).toContain('El destino todavía no devolvió su informe');
    });

    it('la atención de llegada es navegable', async () => {
      await abrir('d1');
      const boton = Array.from(el().querySelectorAll<HTMLButtonElement>('[data-testid="red-panel-derivacion"] button')).find((b) =>
        b.textContent?.includes('atención de llegada'),
      )!;
      boton.click();
      expect(host.elegidos).toEqual(['a3']);
    });

    it('sin respuesta lo dice', async () => {
      await abrir('d2');
      expect(texto()).toContain('Sin respuesta todavía');
      expect(texto()).toContain('Sin llegada registrada');
    });
  });

  describe('cita, reconsulta y atención', () => {
    it('la reconsulta muestra su origen; la cita, sus siguientes', async () => {
      await abrir('r1');
      const r = el().querySelector('[data-testid="red-panel-continuidad"]')!.textContent!;
      expect(r).toContain('Reconsulta de');
      expect(r).toContain('Consulta de medicina general');
      await abrir('c1');
      const c = el().querySelector('[data-testid="red-panel-continuidad"]')!.textContent!;
      expect(c).toContain('Sin cita, reconsulta ni derivación de origen');
      expect(c).toContain('Tuvo como reconsulta');
    });

    it('la atención de llegada muestra la derivación de la que viene', async () => {
      await abrir('a3');
      const c = el().querySelector('[data-testid="red-panel-continuidad"]')!.textContent!;
      expect(c).toContain('Llegada por derivación');
      expect(c).toContain('Derivación a Cardiología');
    });
  });

  describe('vínculos', () => {
    it('lista entrantes y salientes, marca el inferido y cada uno navega', async () => {
      await abrir('e2');
      const v = Array.from(el().querySelectorAll<HTMLButtonElement>('[data-testid="red-panel-vinculo"]'));
      expect(v.map((b) => b.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
        expect.stringContaining('→ Se registró en inferido'),
        expect.stringContaining('→ Se pidió para estudiar'),
      ]);
      v[1].click();
      expect(host.elegidos).toEqual(['dx2']);
    });
  });

  describe('en el teléfono', () => {
    it('es una hoja modal: <dialog> abierto, Escape (cancel) cierra', async () => {
      host.presentacion.set('hoja');
      await abrir('dx2');
      const dialogo = panel() as HTMLDialogElement;
      expect(dialogo.tagName).toBe('DIALOG');
      expect(dialogo.hasAttribute('open')).toBe(true);
      dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(host.cierres).toBe(1);
      expect(panel()).toBeNull();
    });
  });
});

/**
 * Lo que la integración con el expediente real necesita del panel: nodos con
 * menos datos que la demostración (sin nombre del profesional, sin fecha de
 * liberación) y un padre que decide a dónde vuelve el foco.
 */
@Component({
  imports: [RedClinicaPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" data-testid="disparador" (click)="nodo.set(real)">Abrir</button>
    <app-red-clinica-panel
      presentacion="lateral"
      [nodo]="nodo()"
      [nodos]="[real]"
      [devolverFoco]="false"
      (cerrado)="nodo.set(null)"
    >
      <button type="button" panel-acciones data-testid="accion-extra">Ver el registro completo</button>
    </app-red-clinica-panel>
  `,
})
class AnfitrionReal {
  readonly real: NodoDeRed = {
    id: 'rep-1',
    tipo: 'estudio',
    titulo: 'TSH',
    cuando: new Date(2026, 9, 1),
    detalle: { tipo: 'estudio', resultado: { liberadoEn: null, valores: [], archivos: [] } },
  };
  readonly nodo = signal<NodoDeRed | null>(null);
}

describe('RedClinicaPanel con los datos del expediente', () => {
  let fixture: ComponentFixture<AnfitrionReal>;
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = () => el().querySelector('[data-testid="red-panel"]')?.textContent?.replace(/\s+/g, ' ') ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnfitrionReal],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AnfitrionReal);
    fixture.detectChanges();
    const disparador = el().querySelector<HTMLButtonElement>('[data-testid="disparador"]')!;
    disparador.focus();
    disparador.click();
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('un resultado liberado sin fecha dice «Resultado liberado» y no inventa el día', () => {
    expect(el().querySelector('[data-testid="red-panel-liberado"]')?.textContent?.trim()).toBe('Resultado liberado');
    expect(texto()).not.toContain('Liberado el');
  });

  it('sin profesional conocido no afirma «No registrado»', () => {
    expect(texto()).not.toContain('Profesional');
    expect(texto()).not.toContain('No registrado');
  });

  it('proyecta las acciones del padre al pie del detalle', () => {
    expect(el().querySelector('[data-testid="red-panel"] [data-testid="accion-extra"]')).not.toBeNull();
  });

  it('con devolverFoco en false, cerrar no le roba el foco al padre', async () => {
    const otro = document.createElement('button');
    document.body.appendChild(otro);
    fixture.componentInstance.nodo.set(null);
    fixture.detectChanges();
    otro.focus();
    await fixture.whenStable();
    expect(document.activeElement).toBe(otro);
    otro.remove();
  });
});
