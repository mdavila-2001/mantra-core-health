import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Condition, Encounter, MedicationRequest } from '../../../../../core/data-access/clinical/clinical.types';
import { RecorridoClinico } from '../../recorrido-clinico/recorrido-clinico';
import type { RegistroDeLaRed, VinculoDeLaRed } from '../../recorrido-clinico/red-clinica.model';
import { RecorridoGuiado } from '../../recorrido-guiado/recorrido-guiado';
import type { AlertaDeApoyo } from '../red-clinica-alertas.types';
import { FILTRO_VACIO, type FiltroDeRed } from '../red-clinica-filtro';
import { guiaDelExpediente, NINGUNO_VISIBLE, type GuiaDeLaRed } from './guia-de-la-red';
import { RedClinicaSuperficie } from './red-clinica-superficie';

/*
 * Dos problemas en dos días: hipotiroidismo (atención, diagnóstico y receta
 * para él) el 10 de enero, y pielonefritis (atención y diagnóstico) el 20 de
 * marzo. Los ids son los mismos en la red y en el recorrido, como en el
 * expediente.
 */
const dia1 = new Date(Date.UTC(2026, 0, 10, 13));
const dia2 = new Date(Date.UTC(2026, 2, 20, 13));
const reg = (id: string, clase: RegistroDeLaRed['clase'], cuando: Date, extra: Partial<RegistroDeLaRed> = {}): RegistroDeLaRed => ({
  id, clase, titulo: id, detalle: '', estado: '', cuando, ...extra,
});
const REGISTROS: readonly RegistroDeLaRed[] = [
  reg('e1', 'atencion', dia1),
  reg('dx1', 'diagnostico', dia1, { encuentroId: 'e1', certeza: 'confirmado', concepto: 'c-hipo', titulo: 'Hipotiroidismo' }),
  reg('rx1', 'medicacion', dia1, { encuentroId: 'e1', titulo: 'Levotiroxina' }),
  reg('e2', 'atencion', dia2),
  reg('dx2', 'diagnostico', dia2, { encuentroId: 'e2', certeza: 'confirmado', concepto: 'c-piel', titulo: 'Pielonefritis' }),
];
const VINCULOS: readonly VinculoDeLaRed[] = [
  { desde: 'e1', hasta: 'dx1', motivo: 'registrado-en' },
  { desde: 'e1', hasta: 'rx1', motivo: 'registrado-en' },
  { desde: 'dx1', hasta: 'rx1', motivo: 'indicado-para' },
  { desde: 'e2', hasta: 'dx2', motivo: 'registrado-en' },
];
const ETIQUETAS: Record<string, string> = { 'c-hipo': 'Hipotiroidismo', 'c-piel': 'Pielonefritis', 'c-levo': 'Levotiroxina 25 mcg' };
const GUIA: GuiaDeLaRed = guiaDelExpediente(
  {
    resumen: {
      encounters: [
        { id: 'e1', statusConceptId: 's', startAt: dia1, reasonText: 'Cansancio' } as Encounter,
        { id: 'e2', statusConceptId: 's', startAt: dia2, reasonText: 'Fiebre' } as Encounter,
      ],
      conditions: [
        { id: 'dx1', codeConceptId: 'c-hipo', encounterId: 'e1', createdAt: dia1 } as Condition,
        { id: 'dx2', codeConceptId: 'c-piel', encounterId: 'e2', createdAt: dia2 } as Condition,
      ],
      medicationRequests: [
        { id: 'rx1', medicationConceptId: 'c-levo', statusConceptId: 's', encounterId: 'e1', indicationConditionId: 'dx1', createdAt: dia1 } as MedicationRequest,
      ],
      careEpisodes: [],
    },
    citas: [],
    derivaciones: [],
    estudios: { orders: [], reports: [] },
  },
  (id) => (ETIQUETAS[id] === undefined ? undefined : { display: ETIQUETAS[id] }),
  null,
  new Date(Date.UTC(2026, 5, 1)),
);
const ALERTA: AlertaDeApoyo = {
  id: 'a1', tipo: 'presuntivo-sin-resolver', prioridad: 'alta', titulo: 'Presuntivo sin resolver', detalle: 'Hace 30 días', nodoId: 'dx1', nodoIds: ['dx1'],
} as AlertaDeApoyo;

@Component({
  imports: [RedClinicaSuperficie],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-red-clinica-superficie
      [registros]="registros"
      [vinculos]="vinculos"
      [visibles]="visibles()"
      [alertas]="alertas()"
      [seleccionado]="seleccionado()"
      [guia]="guia"
      [(filtro)]="filtro"
      (nodoElegido)="desdeAlertas.push($event)"
      (limpiar)="limpiezas = limpiezas + 1; filtro.set(filtroVacio); visibles.set([])"
    />
  `,
})
class Anfitrion {
  readonly registros = REGISTROS;
  readonly vinculos = VINCULOS;
  readonly guia = GUIA;
  readonly visibles = signal<readonly string[]>([]);
  readonly alertas = signal<readonly AlertaDeApoyo[]>([ALERTA]);
  readonly seleccionado = signal<string | null>(null);
  readonly filtro = signal<FiltroDeRed>(FILTRO_VACIO);
  readonly desdeAlertas: string[] = [];
  readonly filtroVacio = FILTRO_VACIO;
  limpiezas = 0;
}

describe('RedClinicaSuperficie', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let host: Anfitrion;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const por = (testId: string): HTMLElement | null => raiz().querySelector(`[data-testid="${testId}"]`);
  const red = (): RecorridoClinico => fixture.debugElement.query(By.directive(RecorridoClinico)).componentInstance as RecorridoClinico;
  const guiado = (): RecorridoGuiado => fixture.debugElement.query(By.directive(RecorridoGuiado)).componentInstance as RecorridoGuiado;

  async function pintar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function abrirGuiado(): Promise<void> {
    (por('red-guiado-alternar') as HTMLButtonElement).click();
    await pintar();
  }

  beforeEach(async () => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: false, media: consulta, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    host = fixture.componentInstance;
    await pintar();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('filtros, alertas y red en UNA tarjeta: ni la barra ni las alertas traen recuadro propio', () => {
    const tarjeta = por('red-superficie')!;
    expect(tarjeta.tagName.toLowerCase()).toBe('app-card');
    expect(tarjeta.querySelectorAll('app-card')).toHaveLength(0);
    expect(por('red-filtros')!.classList).toContain('filtros--integrada');
    expect(por('red-alertas')!.classList).toContain('alertas--compacta');
    expect(tarjeta.contains(raiz().querySelector('app-recorrido-clinico'))).toBe(true);
  });

  it('las alertas arrancan plegadas en un resumen que no empuja el mapa, y se despliegan', async () => {
    const plegar = por('red-alertas-plegar') as HTMLButtonElement;
    expect(plegar.getAttribute('aria-expanded')).toBe('false');
    expect(plegar.textContent).toContain('1 alerta');
    expect(plegar.textContent).toContain('1 de prioridad alta');
    expect(por('red-alerta')).toBeNull();
    plegar.click();
    await pintar();
    expect(plegar.getAttribute('aria-expanded')).toBe('true');
    (por('red-alerta') as HTMLButtonElement).click();
    expect(host.desdeAlertas).toEqual(['dx1']);
  });

  it('sin modo guiado, la red recibe los filtros tal cual', async () => {
    host.visibles.set(['dx1', 'rx1']);
    await pintar();
    expect(red().visibles()).toEqual(['dx1', 'rx1']);
    expect(por('red-guiado')).toBeNull();
  });

  it('«Recorrido paso a paso» revela la red paso a paso y resalta lo que el paso enfoca', async () => {
    await abrirGuiado();
    expect(por('red-guiado-alternar')!.getAttribute('aria-pressed')).toBe('true');
    expect(por('guiado-contador')!.textContent).toContain('Paso 1 de 2');
    const paso1 = [...red().visibles()].sort();
    expect(paso1).toEqual(['dx1', 'e1', 'rx1']);
    expect(red().resaltados()).toEqual(expect.arrayContaining(['e1']));
    (por('guiado-siguiente') as HTMLButtonElement).click();
    await pintar();
    expect([...red().visibles()].sort()).toEqual(['dx1', 'dx2', 'e1', 'e2', 'rx1']);
    expect(red().resaltados()).toEqual(expect.arrayContaining(['e2', 'dx2']));
  });

  it('lo revelado se cruza con los filtros; si no queda nada, la red no recibe «todos»', async () => {
    host.visibles.set(['dx2']);
    await pintar();
    await abrirGuiado();
    expect(red().visibles()).toEqual([NINGUNO_VISIBLE]);
    expect(por('red-guiado-sin-nodos')).not.toBeNull();
    (por('guiado-siguiente') as HTMLButtonElement).click();
    await pintar();
    expect(red().visibles()).toEqual(['dx2']);
  });

  it('el aviso de paso ofrece «Quitar filtros»: limpia los del padre y al salir no vuelven', async () => {
    host.filtro.set({ ...FILTRO_VACIO, texto: 'pielo' });
    host.visibles.set(['dx2']);
    await pintar();
    await abrirGuiado();
    expect(por('red-guiado-sin-nodos')!.textContent).toContain('no queda a la vista con los filtros puestos');
    (por('red-guiado-quitar-filtros') as HTMLButtonElement).click();
    await pintar();
    expect(host.limpiezas).toBe(1);
    expect(por('red-guiado-sin-nodos')).toBeNull();
    expect([...red().visibles()].sort()).toEqual(['dx1', 'e1', 'rx1']);
    (por('red-guiado-alternar') as HTMLButtonElement).click();
    await pintar();
    expect(host.filtro()).toEqual(FILTRO_VACIO);
    expect(red().visibles()).toEqual([]);
  });

  it('el paso despliega y trae a la vista lo que enfoca (irANodo)', async () => {
    const ir = vi.spyOn(RecorridoClinico.prototype, 'irANodo');
    await abrirGuiado();
    expect(ir).toHaveBeenCalled();
    expect(ir.mock.calls.map(([id]) => id)).toEqual(expect.arrayContaining(['e1']));
    ir.mockRestore();
  });

  it('tocar la red o una alerta pausa (interaccionEnLaRed cambia); Tab no', async () => {
    await abrirGuiado();
    const antes = guiado().interaccionEnLaRed();
    const lienzo = raiz().querySelector('app-recorrido-clinico')!;
    lienzo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await pintar();
    expect(guiado().interaccionEnLaRed()).toBe(antes);
    lienzo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await pintar();
    expect(guiado().interaccionEnLaRed()).not.toBe(antes);
  });

  it('seguir un episodio: propone el del nodo abierto y recorre sólo lo suyo', async () => {
    host.seleccionado.set('rx1');
    await pintar();
    await abrirGuiado();
    expect(por('guiado-episodio')!.textContent).toContain('Siguiendo: Hipotiroidismo');
    expect(por('guiado-contador')!.textContent).toContain('Paso 1 de 1');
  });

  it('o el del filtro «Solo el hilo de este diagnóstico»', async () => {
    host.filtro.set({ ...FILTRO_VACIO, hiloDeDiagnosticoId: 'dx2' });
    await pintar();
    await abrirGuiado();
    expect(por('guiado-episodio')!.textContent).toContain('Siguiendo: Pielonefritis');
  });

  it('salir restaura la red: filtros de antes, sin resaltados y el plegado previo', async () => {
    const restaurar = vi.spyOn(RecorridoClinico.prototype, 'restaurarPlegado');
    await abrirGuiado();
    (por('red-guiado-alternar') as HTMLButtonElement).click();
    await pintar();
    expect(por('red-guiado')).toBeNull();
    expect(red().visibles()).toEqual([]);
    expect(red().resaltados()).toEqual([]);
    expect(restaurar).toHaveBeenCalledWith(expect.objectContaining({ desplegados: expect.any(Set) }));
    restaurar.mockRestore();
  });
});
