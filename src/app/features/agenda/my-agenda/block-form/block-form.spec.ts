import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockForm, aMedianoche, conHora, type BloqueoPedido } from './block-form';
import { franjasPorDia } from '../my-agenda';
import type { AvailabilityExceptionTypeOption } from '@core/data-access/scheduling/scheduling.types';

/**
 * El bloqueo por rango y por franja (D4 del plan de UX del 22/08/2026).
 *
 * Lo que se fija acá es la parte que **no se ve** y que decide si un bloqueo
 * hace lo que dice: cuántas excepciones se mandan y con qué instantes. La
 * pantalla puede verse bien y dejar la agenda abierta un día de más.
 */
describe('franjasPorDia', () => {
  function pedido(desde: Date, hasta: Date) {
    return {
      desde,
      hasta,
      exceptionType: 'CONFERENCE' as const,
      motivo: '',
      dias: 0,
      franjaHoraria: true,
    };
  }

  it('manda una excepción por cada día del rango, no una sola de punta a punta', () => {
    // Es la diferencia entre «las tardes del 10 al 12» y «del 10 a las 14:00
    // al 12 a las 18:00». Lo segundo se lleva puestas las noches y las mañanas
    // del medio, que es lo contrario de lo que alguien pide.
    const intervalos = franjasPorDia(
      pedido(conHora(new Date(2026, 8, 10), '14:00'), conHora(new Date(2026, 8, 12), '18:00')),
    );

    expect(intervalos).toHaveLength(3);
    for (const intervalo of intervalos) {
      expect(intervalo.startAt.getHours()).toBe(14);
      expect(intervalo.endAt.getHours()).toBe(18);
      // Cada franja empieza y termina el MISMO día: si cruzara, bloquearía la
      // noche entera.
      expect(intervalo.startAt.getDate()).toBe(intervalo.endAt.getDate());
    }
    expect(intervalos.map((i) => i.startAt.getDate())).toEqual([10, 11, 12]);
  });

  it('un solo día da una sola excepción', () => {
    const dia = new Date(2026, 8, 10);
    const intervalos = franjasPorDia(pedido(conHora(dia, '08:00'), conHora(dia, '12:30')));

    expect(intervalos).toHaveLength(1);
    expect(intervalos[0].endAt.getHours()).toBe(12);
    expect(intervalos[0].endAt.getMinutes()).toBe(30);
  });

  it('recorre por fecha y no sumando 24 horas: un día no siempre dura 24', () => {
    // En un cambio de horario de verano un día dura 23 o 25 horas. Sumando
    // 86 400 000 milisegundos, la franja se correría una hora a partir de ahí y
    // el bloqueo dejaría de coincidir con la agenda. Se comprueba sobre un mes
    // largo para que el recorrido no dependa del huso de quien corre la prueba.
    const intervalos = franjasPorDia(
      pedido(conHora(new Date(2026, 9, 25), '09:00'), conHora(new Date(2026, 10, 2), '13:00')),
    );

    expect(intervalos).toHaveLength(9);
    for (const intervalo of intervalos) {
      expect(intervalo.startAt.getHours()).toBe(9);
      expect(intervalo.endAt.getHours()).toBe(13);
    }
  });
});

describe('aMedianoche', () => {
  it('deja la fecha y borra la hora, en horario local', () => {
    const cuando = aMedianoche(new Date(2026, 1, 14, 17, 45, 30, 500));

    expect(cuando.getFullYear()).toBe(2026);
    expect(cuando.getMonth()).toBe(1);
    expect(cuando.getDate()).toBe(14);
    expect(cuando.getHours()).toBe(0);
    expect(cuando.getMinutes()).toBe(0);
    expect(cuando.getSeconds()).toBe(0);
  });
});

/** Lo que publica el catálogo, recortado a lo que esta pantalla usa. */
const CATALOGO: readonly AvailabilityExceptionTypeOption[] = [
  { type: 'ABSENCE', conceptId: 'c-1', label: 'Ausencia', requiresText: false, blocks: true },
  { type: 'VACATION', conceptId: 'c-2', label: 'Vacaciones', requiresText: false, blocks: true },
  {
    type: 'CONFERENCE',
    conceptId: 'c-3',
    label: 'Congreso o capacitación',
    requiresText: false,
    blocks: true,
  },
  {
    type: 'EXTRA',
    conceptId: 'c-4',
    label: 'Atención extraordinaria',
    requiresText: false,
    blocks: false,
  },
  { type: 'OTHER', conceptId: 'c-5', label: 'Otro', requiresText: true, blocks: true },
];

/** Lo protegido del componente, tipado — el repo no admite `any` en specs. */
interface Testable {
  readonly tipo: { set(v: string): void };
  readonly motivo: { set(v: string): void };
  readonly desde: { set(v: Date | null): void };
  readonly hasta: { set(v: Date | null): void };
  readonly porFranja: { set(v: boolean): void };
  readonly opcionesDeMotivo: () => readonly { value: string; label: string }[];
  readonly exigeTexto: () => boolean;
  readonly error: () => string | null;
  enviar(): void;
}

/**
 * EL MOTIVO DEL BLOQUEO — TAREA-11, punto 4.
 *
 * El defecto que esto cierra no era de pantalla sino de datos: la columna
 * `exception_type_concept_id` existía para distinguir vacaciones de un feriado
 * y **el formulario mandaba `ABSENCE` para todo**, porque nadie publicaba el
 * catálogo. Estas pruebas fijan las tres reglas que ahora vienen del servidor y
 * que sería fácil volver a escribir a mano acá.
 */
describe('BlockForm · el motivo', () => {
  let fixture: ComponentFixture<BlockForm>;

  async function montar(
    motivos: readonly AvailabilityExceptionTypeOption[] = CATALOGO,
  ): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [BlockForm] }).compileComponents();
    fixture = TestBed.createComponent(BlockForm);
    fixture.componentRef.setInput('motivos', motivos);
    fixture.detectChanges();
  }

  function api(): Testable {
    return fixture.componentInstance as unknown as Testable;
  }

  /** Un rango válido de un día, para que sólo falle lo que se está probando. */
  function rangoValido(): void {
    api().desde.set(new Date(2026, 8, 10));
    api().hasta.set(new Date(2026, 8, 10));
    api().porFranja.set(false);
  }

  it('ofrece sólo los motivos que CIERRAN horario', async () => {
    await montar();
    const valores = api()
      .opcionesDeMotivo()
      .map((o) => o.value);

    // `EXTRA` viene en el mismo catálogo pero ABRE disponibilidad: ofrecerlo
    // bajo un botón que dice «Bloquear» sería ofrecer lo contrario.
    expect(valores).not.toContain('EXTRA');
    expect(valores).toEqual(['ABSENCE', 'VACATION', 'CONFERENCE', 'OTHER']);
  });

  it('usa la etiqueta del servidor, no una traducción propia', async () => {
    await montar();
    const congreso = api()
      .opcionesDeMotivo()
      .find((o) => o.value === 'CONFERENCE');

    expect(congreso?.label).toBe('Congreso o capacitación');
  });

  it('pide explicación sólo cuando el catálogo la exige', async () => {
    await montar();
    expect(api().exigeTexto()).toBe(false);

    api().tipo.set('OTHER');
    expect(api().exigeTexto()).toBe(true);
  });

  it('con «Otro» y sin texto no deja enviar; con texto sí', async () => {
    await montar();
    rangoValido();
    api().tipo.set('OTHER');

    expect(api().error()).toContain('Otro');

    api().motivo.set('Trámite en el banco');
    expect(api().error()).toBeNull();
  });

  it('la descripción es un campo APARTE, siempre disponible', async () => {
    // El pedido original dice «un motivo (catalogable) **y** una descripción».
    // Estaban hechos excluyentes —texto libre sólo con «Otro»— y eso no era lo
    // pedido: con vacaciones también se puede querer anotar algo.
    await montar();
    rangoValido();
    api().tipo.set('VACATION');
    api().motivo.set('Me voy a Tarija');

    expect(api().exigeTexto()).toBe(false);
    expect(api().error()).toBeNull();

    let emitido: BloqueoPedido | null = null;
    fixture.componentInstance.bloquear.subscribe((p: BloqueoPedido) => (emitido = p));
    api().enviar();

    // Y viaja: una descripción que no llega al servidor es un campo decorativo.
    expect(emitido!.motivo).toBe('Me voy a Tarija');
    expect(emitido!.exceptionType).toBe('VACATION');
  });

  it('con un motivo que NO exige texto, el texto vacío no estorba', async () => {
    // Antes el texto libre era obligatorio siempre: elegir «Vacaciones» y no
    // escribir nada más era un formulario inválido sin razón.
    await montar();
    rangoValido();
    api().tipo.set('VACATION');

    expect(api().error()).toBeNull();
  });

  it('emite el motivo elegido, no ABSENCE', async () => {
    await montar();
    rangoValido();
    api().tipo.set('VACATION');

    let emitido: BloqueoPedido | null = null;
    fixture.componentInstance.bloquear.subscribe((p: BloqueoPedido) => (emitido = p));
    api().enviar();

    expect(emitido).not.toBeNull();
    expect(emitido!.exceptionType).toBe('VACATION');
  });

  it('sin catálogo el formulario sigue sirviendo, con el motivo de siempre', async () => {
    // Que la lista no cargue no puede impedirle a nadie bloquear su agenda.
    await montar([]);
    rangoValido();

    expect(api().opcionesDeMotivo()).toEqual([]);
    expect(api().error()).toBeNull();

    let emitido: BloqueoPedido | null = null;
    fixture.componentInstance.bloquear.subscribe((p: BloqueoPedido) => (emitido = p));
    api().enviar();

    expect(emitido!.exceptionType).toBe('ABSENCE');
  });
});
