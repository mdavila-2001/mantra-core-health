import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecorridoClinico, type NodoElegido } from './recorrido-clinico';
import type { RegistroDeLaRed, VinculoDeLaRed } from './red-clinica.model';

/**
 * La red en pantalla. La agrupación y la geometría se prueban en sus modelos;
 * acá, las promesas de la vista: plegar y desplegar por episodio con
 * `aria-expanded`, que cada registro sea un botón que abre su detalle, que su
 * nombre accesible diga lo que dicen las líneas (y «inferido» cuando lo es),
 * que el detalle y los descartados se abran en el mismo botón, y los puntos
 * de extensión de la Franja 3.
 */
const enero = new Date(2026, 0, 10);
const r = (
  id: string,
  clase: RegistroDeLaRed['clase'],
  extra: Partial<RegistroDeLaRed> = {},
): RegistroDeLaRed => ({
  id,
  clase,
  titulo:
    id === 'c'
      ? 'Ambulatorio'
      : id === 'dx'
        ? 'Hipertensión'
        : id === 'rx'
          ? 'Enalapril'
          : id === 'dx-x'
            ? 'Angina'
            : id === 'est'
              ? 'MAPA'
              : id,
  detalle: '',
  estado: 'Activa',
  cuando: enero,
  ...extra,
});

const REGISTROS: readonly RegistroDeLaRed[] = [
  r('c', 'atencion'),
  r('dx', 'diagnostico', { encuentroId: 'c', certeza: 'presuntivo', concepto: 'HTA' }),
  r('dx-x', 'diagnostico', { encuentroId: 'c', certeza: 'descartado', concepto: 'ANG', estado: 'Descartado' }),
  r('rx', 'medicacion', { encuentroId: 'c' }),
  r('est', 'estudio', { encuentroId: 'c' }),
  ...['o1', 'o2', 'o3', 'o4'].map((id) => r(id, 'observacion', { encuentroId: 'c' })),
];
const VINCULOS: readonly VinculoDeLaRed[] = [
  { desde: 'c', hasta: 'dx', motivo: 'registrado-en' },
  { desde: 'c', hasta: 'dx-x', motivo: 'registrado-en' },
  { desde: 'c', hasta: 'rx', motivo: 'registrado-en' },
  { desde: 'c', hasta: 'est', motivo: 'registrado-en' },
  { desde: 'dx', hasta: 'rx', motivo: 'indicado-para' },
  { desde: 'dx', hasta: 'est', motivo: 'inferido-misma-atencion' },
  // El diferencial descartado y el que quedó: un solo episodio.
  { desde: 'dx-x', hasta: 'dx', motivo: 'reemplazado-por' },
  ...['o1', 'o2', 'o3', 'o4'].map((id) => ({ desde: 'c', hasta: id, motivo: 'registrado-en' as const })),
];

@Component({
  imports: [RecorridoClinico],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-recorrido-clinico
      [registros]="registros()"
      [vinculos]="vinculos()"
      [resaltados]="resaltados()"
      [visibles]="visibles()"
      [seleccionado]="seleccionado()"
      (abrir)="abiertos.push($event)"
      (elegido)="elegidos.push($event)"
    />
  `,
})
class Anfitrion {
  readonly registros = signal<readonly RegistroDeLaRed[]>(REGISTROS);
  readonly vinculos = signal<readonly VinculoDeLaRed[]>(VINCULOS);
  readonly resaltados = signal<readonly string[]>([]);
  readonly visibles = signal<readonly string[]>([]);
  readonly seleccionado = signal<string | null>(null);
  readonly abiertos: string[] = [];
  readonly elegidos: NodoElegido[] = [];
}

describe('RecorridoClinico · la red por episodios', () => {
  let fixture: ComponentFixture<Anfitrion>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botones = (): HTMLButtonElement[] => Array.from(raiz().querySelectorAll('[data-testid="recorrido-nodo"]'));
  const boton = (texto: string): HTMLButtonElement =>
    botones().find((b) => (b.getAttribute('aria-label') ?? '').includes(texto))!;
  const episodios = (): HTMLButtonElement[] => Array.from(raiz().querySelectorAll('[data-testid="red-episodio"]'));
  const red = (): { angosto: { set(v: boolean): void } } =>
    fixture.debugElement.query(By.directive(RecorridoClinico)).componentInstance as unknown as {
      angosto: { set(v: boolean): void };
    };
  const desplegarTodo = (): void => {
    (raiz().querySelector('[data-testid="red-desplegar-todo"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('arranca con cada episodio plegado: un resumen con su nombre, estado y conteos, sin registros', () => {
    expect(episodios()).toHaveLength(1);
    const episodio = episodios()[0];
    expect(episodio.getAttribute('aria-expanded')).toBe('false');
    expect(episodio.textContent).toContain('Hipertensión');
    const nombre = episodio.getAttribute('aria-label') ?? '';
    expect(nombre).toContain('Episodio: Hipertensión');
    expect(nombre).toContain('1 atención');
    expect(nombre).toContain('1 diagnóstico descartado');
    expect(botones()).toHaveLength(0);
    expect(raiz().querySelectorAll('[data-testid="red-hito"]').length).toBeGreaterThan(0);
  });

  it('desplegar un episodio muestra sus registros y cambia `aria-expanded` en el mismo botón', () => {
    const episodio = episodios()[0];
    episodio.click();
    fixture.detectChanges();
    expect(episodio.getAttribute('aria-expanded')).toBe('true');
    expect(botones().length).toBeGreaterThan(0);
    episodio.click();
    fixture.detectChanges();
    expect(botones()).toHaveLength(0);
  });

  it('«Expandir todo» y «Contraer todo»', () => {
    desplegarTodo();
    expect(episodios().every((e) => e.getAttribute('aria-expanded') === 'true')).toBe(true);
    (raiz().querySelector('[data-testid="red-plegar-todo"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(episodios().every((e) => e.getAttribute('aria-expanded') === 'false')).toBe(true);
  });

  it('elegir un registro abre su detalle y emite el nodo con el id real', () => {
    desplegarTodo();
    boton('Medicación: Enalapril').click();
    expect(fixture.componentInstance.abiertos).toEqual(['rx']);
    expect(fixture.componentInstance.elegidos).toEqual([{ id: 'rx', clase: 'medicacion', episodio: 'episodio:dx' }]);
  });

  it('dice en el nombre accesible de dónde viene y para qué es la receta', () => {
    desplegarTodo();
    const nombre = boton('Medicación: Enalapril').getAttribute('aria-label');
    expect(nombre).toContain('registrado en la atención Ambulatorio');
    expect(nombre).toContain('indicado para Hipertensión');
    expect(boton('Diagnóstico: Hipertensión').getAttribute('aria-label')).toContain('tratado con Enalapril');
  });

  it('el vínculo inferido lo dice en la línea, en la leyenda y en el nombre accesible', () => {
    desplegarTodo();
    expect(boton('Estudio pedido: MAPA').getAttribute('aria-label')).toContain('vínculo inferido');
    expect(raiz().querySelectorAll('[data-testid="red-inferido"]').length).toBe(1);
    expect(raiz().querySelector('[data-testid="red-inferido"]')?.textContent?.trim()).toBe('inferido');
    expect(raiz().querySelector('[data-testid="red-leyenda"]')?.textContent).toContain('Inferido');
    expect(raiz().querySelector('path.red__arista--inferido')).not.toBeNull();
  });

  it('el descartado se ve plegado y se abre sin pedir un detalle, en el mismo botón', () => {
    desplegarTodo();
    const descartado = boton('Diagnóstico descartado: Angina');
    expect(descartado.getAttribute('aria-expanded')).toBe('false');
    descartado.focus();
    descartado.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.abiertos).toEqual([]);
    expect(boton('Diagnóstico: Angina')).toBe(descartado);
    expect(document.activeElement).toBe(descartado);
    const plegar = boton('Ocultar el diagnóstico descartado Angina');
    expect(plegar.getAttribute('aria-expanded')).toBe('true');
    plegar.click();
    fixture.detectChanges();
    expect(boton('Diagnóstico descartado: Angina')).toBeDefined();
  });

  it('agrupa el detalle tras un «+N» y lo abre en el mismo botón, sin pedir un detalle', () => {
    desplegarTodo();
    const grupo = boton('Mostrar 4 registros de detalle');
    expect(grupo.getAttribute('aria-expanded')).toBe('false');
    const antes = botones().length;
    grupo.focus();
    grupo.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.abiertos).toEqual([]);
    expect(botones().length).toBe(antes + 4);
    expect(boton('Agrupar el detalle')).toBe(grupo);
    expect(grupo.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(grupo);
  });

  it('al enfocar un registro atenúa lo que no está en su camino, y el puntero no apaga el foco', () => {
    desplegarTodo();
    const receta = boton('Medicación: Enalapril');
    receta.dispatchEvent(new Event('focus'));
    const grupo = boton('Mostrar 4 registros de detalle');
    grupo.dispatchEvent(new Event('mouseenter'));
    grupo.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(boton('Diagnóstico: Hipertensión').classList.contains('red__nodo--atenuado')).toBe(false);
    expect(boton('Atención: Ambulatorio').classList.contains('red__nodo--atenuado')).toBe(false);
    expect(grupo.classList.contains('red__nodo--atenuado')).toBe(true);
    expect(raiz().querySelector('path.red__arista--iluminada')).not.toBeNull();
  });

  it('enfocar el control de un grupo no atenúa lo que se acaba de mostrar', () => {
    desplegarTodo();
    const grupo = boton('Mostrar 4 registros de detalle');
    grupo.click();
    fixture.detectChanges();
    grupo.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(botones().some((b) => b.classList.contains('red__nodo--atenuado'))).toBe(false);
  });

  it('muestra la fecha propia del registro cuando no es la de su columna', () => {
    fixture.componentInstance.registros.set([
      r('c', 'atencion'),
      r('dx', 'diagnostico', { encuentroId: 'c', certeza: 'confirmado', cuando: new Date(2025, 8, 23) }),
    ]);
    fixture.componentInstance.vinculos.set([{ desde: 'c', hasta: 'dx', motivo: 'registrado-en' }]);
    fixture.detectChanges();
    desplegarTodo();
    const fechas = Array.from(raiz().querySelectorAll('.red__nodo-fecha')).map((e) => e.textContent?.trim());
    expect(fechas).toHaveLength(1);
    expect(fechas[0]).toMatch(/^Inicio sept?\.? 2025$/i);
  });

  it('pinta el estado con el mismo tono que la tabla, no con el de la clase', () => {
    fixture.componentInstance.registros.set([
      r('c', 'atencion'),
      r('dx', 'diagnostico', { encuentroId: 'c', certeza: 'confirmado', estado: 'Enfermedad activa', tonoDelEstado: 'success' }),
    ]);
    fixture.detectChanges();
    desplegarTodo();
    expect(boton('Diagnóstico: Hipertensión').querySelector('.red__nodo-estado')?.classList.contains('tono--success')).toBe(true);
    expect(boton('Atención: Ambulatorio').querySelector('.red__nodo-estado')?.classList.contains('tono--info')).toBe(true);
  });

  it('`resaltados` marca los registros y su episodio; vacío no marca nada', () => {
    desplegarTodo();
    expect(raiz().querySelector('.red__nodo--resaltado')).toBeNull();
    fixture.componentInstance.resaltados.set(['rx']);
    fixture.detectChanges();
    expect(boton('Medicación: Enalapril').classList.contains('red__nodo--resaltado')).toBe(true);
    expect(raiz().querySelector('.red__hilo--resaltado')).not.toBeNull();
  });

  it('`visibles` dibuja sólo esos registros; vacío dibuja todos', () => {
    desplegarTodo();
    const todos = botones().length;
    fixture.componentInstance.visibles.set(['dx', 'rx']);
    fixture.detectChanges();
    expect(botones().map((b) => b.dataset['id']).sort()).toEqual(['dx', 'rx']);
    fixture.componentInstance.visibles.set([]);
    fixture.detectChanges();
    expect(botones()).toHaveLength(todos);
  });

  it('en pantalla angosta se lee en vertical, con los vínculos en texto y sin leyenda de líneas', () => {
    expect(raiz().querySelector('[data-testid="red-leyenda"]')).not.toBeNull();
    red().angosto.set(true);
    fixture.detectChanges();
    expect(raiz().querySelector('.red__lienzo')).toBeNull();
    expect(raiz().querySelector('[data-testid="red-leyenda"]')).toBeNull();
    episodios()[0].click();
    fixture.detectChanges();
    expect(raiz().querySelector('.red-v')).not.toBeNull();
    expect(boton('Medicación: Enalapril').textContent).toContain('indicado para Hipertensión');
    expect(boton('Estudio pedido: MAPA').textContent).toContain('vínculo inferido');
  });
  describe('ir a un registro (panel y alertas)', () => {
    const componente = (): RecorridoClinico =>
      fixture.debugElement.query(By.directive(RecorridoClinico)).componentInstance as RecorridoClinico;
    const ir = async (id: string, foco = false): Promise<boolean> => {
      const ok = componente().irANodo(id, { foco });
      fixture.detectChanges();
      await fixture.whenStable();
      return ok;
    };

    it('despliega el episodio plegado y marca el registro como enfocado', async () => {
      expect(botones()).toHaveLength(0);
      expect(await ir('rx')).toBe(true);
      expect(episodios()[0].getAttribute('aria-expanded')).toBe('true');
      expect(boton('Medicación: Enalapril').classList.contains('red__nodo--enfocado')).toBe(true);
    });

    it('abre el descartado y el «+N» que lo escondían', async () => {
      await ir('dx-x');
      expect(boton('Diagnóstico: Angina').dataset['forma']).toBe('tarjeta');
      await ir('o3');
      expect(botones().some((b) => b.dataset['id'] === 'o3')).toBe(true);
    });

    it('con foco, el registro recibe el foco del teclado', async () => {
      await ir('est', true);
      expect(document.activeElement).toBe(boton('Estudio pedido: MAPA'));
    });

    it('no va a un registro que no está o que el filtro oculta', async () => {
      expect(await ir('fantasma')).toBe(false);
      fixture.componentInstance.visibles.set(['dx']);
      fixture.detectChanges();
      expect(await ir('rx')).toBe(false);
    });

    it('`seleccionado` marca el registro abierto en el panel', () => {
      desplegarTodo();
      fixture.componentInstance.seleccionado.set('rx');
      fixture.detectChanges();
      const receta = boton('Medicación: Enalapril');
      expect(receta.classList.contains('red__nodo--abierto')).toBe(true);
      expect(receta.getAttribute('aria-current')).toBe('true');
      expect(boton('Diagnóstico: Hipertensión').getAttribute('aria-current')).toBeNull();
    });
  });
});
