import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EncounterTimeline } from './encounter-timeline';
import type {
  EncounterHeader,
  TimelineCondition,
  TimelineFollowUp,
  TimelineNote,
  TimelineOrder,
  TimelinePrescription,
} from './encounter-timeline.types';

/**
 * La línea del encuentro (C6.H2.M1).
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **El orden es el del relato**, y los hechos sin fecha van al final.
 * 2. **Los rótulos son los del carril**, letra por letra: son lo que el
 *    paciente lee, y una coma de más los vuelve otra frase.
 * 3. **Ningún identificador llega al DOM.** Es la pantalla más sensible del
 *    producto y el organismo es quien pinta.
 * 4. **Lo que no llega se omite sin romper**: sin notas, sin órdenes, sin
 *    reconsulta y sin recetas la línea sigue dibujando lo que tiene.
 * 5. **Una lectura en vuelo se declara**, no se calla.
 */

/**
 * Un instante fijo: la línea ordena por tiempo y un `new Date()` la volvería azarosa.
 *
 * En hora **local** y no en UTC: el rótulo de la reconsulta se escribe en la
 * zona de quien la lee —una cita se cumple a la hora del reloj de la pared— y
 * un `Date.UTC` dejaría la aserción atada a la zona de la máquina que corre.
 */
const T = (minutos: number): Date => new Date(2026, 2, 1, 10, minutos, 0);

const ATENCION: EncounterHeader = {
  id: '11111111-1111-4111-8111-111111111111',
  motivo: 'Dolor de garganta',
  cuando: T(0),
  cerrada: true,
};

const NOTA: TimelineNote = {
  id: '22222222-2222-4222-8222-222222222222',
  rotulo: 'Nota #a1b2',
  cuando: T(5),
  filas: [{ etiqueta: 'Motivo', valor: 'Odinofagia de tres días' }],
};

const ORDEN: TimelineOrder = {
  id: '33333333-3333-4333-8333-333333333333',
  estudio: 'Hemograma',
  categoria: 'Análisis de laboratorio',
  estado: 'Cumplida',
  cuando: T(10),
  resultadoDisponible: true,
};

const DIAGNOSTICO: TimelineCondition = {
  id: '44444444-4444-4444-8444-444444444444',
  nombre: 'Hipertensión',
  estado: 'Diagnóstico confirmado',
  tono: 'success',
  detalle: 'activa hasta 24/11',
  cuando: T(15),
};

const RECONSULTA: TimelineFollowUp = {
  id: '55555555-5555-4555-8555-555555555555',
  cuando: new Date(2026, 9, 2, 10, 30, 0),
  profesional: 'Dra. Rojas',
  estado: 'Confirmada',
};

const RECETA: TimelinePrescription = {
  id: '66666666-6666-4666-8666-666666666666',
  medicamento: 'Losartán',
  indicacion: 'Hipertensión',
  detalle: '50 mg · una vez al día',
  cuando: T(20),
};

describe('EncounterTimeline', () => {
  let fixture: ComponentFixture<EncounterTimeline>;

  /** La raíz, tipada: `fixture.nativeElement` es `any` y arrastra el `any`. */
  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** El texto visible, con los espacios normalizados. */
  function texto(): string {
    return (raiz().textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Los títulos de los hechos, en el orden en que quedaron dibujados. */
  function titulos(): readonly string[] {
    return [...raiz().querySelectorAll<HTMLElement>('.linea-encuentro__titulo')].map((nodo) =>
      (nodo.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  }

  function montar(entradas: Partial<Record<string, unknown>> = {}): void {
    fixture = TestBed.createComponent(EncounterTimeline);
    fixture.componentRef.setInput('encounter', ATENCION);
    for (const [nombre, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nombre, valor);
    }
    fixture.detectChanges();
  }

  it('cuenta la consulta en orden: nota, orden, diagnóstico, reconsulta, receta', () => {
    // A propósito en desorden en la entrada: el orden lo pone el organismo.
    montar({
      prescriptions: [RECETA],
      conditions: [DIAGNOSTICO],
      notes: [NOTA],
      followUp: RECONSULTA,
      orders: [ORDEN],
    });

    expect(titulos()).toEqual([
      'Nota #a1b2',
      'Análisis de laboratorio: Hemograma — resultado disponible',
      'Diagnóstico confirmado: Hipertensión — activa hasta 24/11',
      'Receta: Losartán — por Hipertensión',
      // La reconsulta es de octubre: va última porque es lo último que pasa, y
      // no por ser reconsulta. El tiempo manda sobre el tipo.
      'Reconsulta el 02/10 a las 10:30',
    ]);
  });

  /**
   * El desempate por tipo sólo entra cuando el instante es el mismo. Es lo que
   * evita que dos hechos de la misma consulta cambien de orden entre dibujos.
   */
  it('a igualdad de instante desempata por el orden del relato', () => {
    montar({
      prescriptions: [{ ...RECETA, cuando: T(5) }],
      conditions: [{ ...DIAGNOSTICO, cuando: T(5) }],
      notes: [NOTA],
    });

    expect(titulos()).toEqual([
      'Nota #a1b2',
      'Diagnóstico confirmado: Hipertensión — activa hasta 24/11',
      'Receta: Losartán — por Hipertensión',
    ]);
  });

  it('un hecho sin fecha va al final: no puede afirmar que pasó antes', () => {
    montar({
      notes: [{ ...NOTA, cuando: null }],
      conditions: [DIAGNOSTICO],
    });

    expect(titulos()).toEqual([
      'Diagnóstico confirmado: Hipertensión — activa hasta 24/11',
      'Nota #a1b2',
    ]);
  });

  it('ningún identificador llega al DOM', () => {
    montar({
      notes: [NOTA],
      orders: [ORDEN],
      conditions: [DIAGNOSTICO],
      prescriptions: [RECETA],
      followUp: RECONSULTA,
    });

    // 36 caracteres con la forma de un uuid, en cualquier parte del marcado.
    expect(raiz().innerHTML).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it('la lista es una lista ordenada, con el nombre de la atención', () => {
    montar({ notes: [NOTA] });

    const riel = raiz().querySelector('ol.linea-encuentro__riel');
    expect(riel).not.toBeNull();
    expect(riel?.getAttribute('aria-label')).toBe('Línea de la atención: Dolor de garganta');
    // El motivo llega por el nombre accesible, no repitiendo el encabezado.
    expect(riel?.querySelectorAll('li').length).toBe(1);
  });

  /* ---- lo que no llegó se omite sin romper -------------------------------- */

  it('sin nada registrado lo dice, y no dibuja un riel vacío', () => {
    montar();

    expect(texto()).toContain('De esta atención todavía no quedó nada registrado');
    expect(raiz().querySelector('ol.linea-encuentro__riel')).toBeNull();
  });

  it('sin reconsulta no dibuja el hecho, y sin profesional no inventa el con quién', () => {
    montar({ followUp: { ...RECONSULTA, profesional: null } });

    expect(titulos()).toEqual(['Reconsulta el 02/10 a las 10:30']);
    // No hay fila «Con»: sin profesional, el par no existe. Se comprueba por la
    // ausencia del `<dl>` de `app-fact-list` y no por el texto — «Confirmada»
    // contiene «Con», y una aserción por subcadena ahí no probaría nada.
    expect(raiz().querySelector('dl')).toBeNull();
    expect(texto()).toContain('Confirmada');
  });

  it('una reconsulta sin instante se declara agendada, sin fecha inventada', () => {
    montar({ followUp: { ...RECONSULTA, cuando: null } });

    expect(titulos()).toEqual(['Reconsulta agendada']);
  });

  it('una orden sin categoría muestra el estudio solo, no un prefijo vacío', () => {
    montar({ orders: [{ ...ORDEN, categoria: '', resultadoDisponible: false }] });

    expect(titulos()).toEqual(['Hemograma']);
    // Y el estado sigue en su sello: perder la categoría no pierde el estado.
    expect(texto()).toContain('Cumplida');
  });

  it('una receta sin motivo no dice «por»', () => {
    montar({ prescriptions: [{ ...RECETA, indicacion: null, detalle: null }] });

    expect(titulos()).toEqual(['Receta: Losartán']);
    expect(texto()).not.toContain('por ');
  });

  /* ---- el estado de la lectura en vuelo ---------------------------------- */

  it('mientras faltan los estudios lo declara en vez de callarse', () => {
    montar({ conditions: [DIAGNOSTICO], loadingOrders: true });

    expect(texto()).toContain('Estamos trayendo los estudios de esta atención');
    // Y el diagnóstico ya dibujado no se pierde por esperar a las órdenes.
    expect(titulos()).toContain('Diagnóstico confirmado: Hipertensión — activa hasta 24/11');
  });

  it('el cierre de la atención cierra la línea', () => {
    montar({ notes: [NOTA] });
    expect(texto()).toContain('Atención cerrada');

    fixture.componentRef.setInput('encounter', { ...ATENCION, cerrada: false });
    fixture.detectChanges();
    expect(texto()).toContain('Atención en curso');
  });
});
