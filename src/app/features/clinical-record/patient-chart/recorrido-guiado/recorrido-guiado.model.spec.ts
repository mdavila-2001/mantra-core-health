import { describe, expect, it } from 'vitest';

import type {
  CareEpisode,
  Condition,
  Encounter,
  MedicationRequest,
} from '../../../../core/data-access/clinical/clinical.types';
import type {
  DiagnosticOrder,
  DiagnosticReport,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';

import {
  armarRecorridoGuiado,
  diaUtc,
  enumerar,
  fechaCorta,
  legible,
  seguirEpisodio,
  type LectorDelRecorrido,
  type PasoDelRecorrido,
  type RegistrosDelRecorrido,
} from './recorrido-guiado.model';

/* ---------------------------------------------------------------------------
   Una historia de demo con los ids con forma de uuid, como los reales: así la
   prueba «ningún identificador crudo en el texto» mide algo.

     3 feb   Medicina general por cefalea → migraña presuntiva, tomografía para
             confirmarla o descartarla, paracetamol sin indicación.
     10 feb  Informe de la tomografía, liberado.
     17 feb  Reconsulta (vuelve al 3 feb) en Neurología → se descarta migraña con
             la tomografía, se confirma sinusitis, amoxicilina para sinusitis,
             derivación a Otorrinolaringología.
     2 mar   Llega derivado (targetEncounterId), cambian amoxicilina por
             claritromicina.
     20 mar  Reconsulta agendada (futura) que vuelve al 17 feb, que volvía al 3 feb.
   ------------------------------------------------------------------------- */

const u = (n: number): string => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const dia = (mes: number, d: number, hora = 13): Date => new Date(Date.UTC(2026, mes - 1, d, hora));

const ID = {
  e1: u(1),
  e2: u(2),
  e3: u(3),
  migrana: u(10),
  sinusitis: u(11),
  tac: u(20),
  informeTac: u(21),
  paracetamol: u(30),
  amoxicilina: u(31),
  claritromicina: u(32),
  cita1: u(40),
  cita2: u(41),
  cita3: u(42),
  derivacion: u(50),
} as const;

const CONCEPTOS: Record<string, string> = {
  'cx-migrana': 'Migraña',
  'cx-sinusitis': 'Sinusitis aguda',
  'cx-tac': 'Tomografía de cráneo',
  'cx-paracetamol': 'Paracetamol 500 mg',
  'cx-amoxicilina': 'Amoxicilina 500 mg',
  'cx-claritromicina': 'Claritromicina 500 mg',
  'cx-ambulatorio': 'Ambulatorio',
  'cx-cancelada': 'Cancelada',
  'cx-internacion': 'Clínica',
  'cx-uuid': u(999),
  'cx-codigo': 'COND_CONFIRMED',
};

const SERVICIOS: Record<string, string> = {
  [ID.e1]: 'Medicina general',
  [ID.e2]: 'Neurología',
  [ID.e3]: 'Otorrinolaringología',
};

const lector: LectorDelRecorrido = {
  etiqueta: (id) => (id === undefined ? undefined : CONCEPTOS[id]),
  codigo: (id) => (id === 'cx-v-confirmado' ? 'clinical:CONDITION_CONFIRMED' : id === 'cx-v-descartado' ? 'COND_REFUTED' : undefined),
  servicioDeAtencion: (a) => SERVICIOS[a.id],
};

const atencion = (id: string, cuando: Date, motivo?: string, extra: Partial<Encounter> = {}): Encounter => ({
  id,
  statusConceptId: 'cx-estado',
  startAt: cuando,
  ...(motivo === undefined ? {} : { reasonText: motivo }),
  ...extra,
});

const migrana: Condition = {
  id: ID.migrana,
  codeConceptId: 'cx-migrana',
  encounterId: ID.e1,
  createdAt: dia(2, 3),
  verification: {
    outcome: 'REFUTED',
    decidedAt: dia(2, 17, 15).toISOString(),
    decidedByProfileId: u(900),
    reasonText: 'La tomografía no muestra hallazgos compatibles.',
    basedOn: { kind: 'ANALYSIS', serviceRequestId: ID.tac, encounterId: ID.e2 },
  },
  replacedByConditionId: ID.sinusitis,
};

const sinusitis: Condition = {
  id: ID.sinusitis,
  codeConceptId: 'cx-sinusitis',
  encounterId: ID.e2,
  createdAt: dia(2, 17),
  verification: {
    outcome: 'CONFIRMED',
    decidedAt: dia(2, 17, 16).toISOString(),
    decidedByProfileId: u(900),
    reasonText: null,
    basedOn: null,
  },
};

const tac: DiagnosticOrder = {
  id: ID.tac,
  patientProfileId: u(800),
  encounterId: ID.e1,
  codeConceptId: 'cx-tac',
  statusConceptId: 'cx-estado',
  createdAt: dia(2, 3, 14),
  reasonConditionId: ID.migrana,
};

const informeTac: DiagnosticReport = {
  id: ID.informeTac,
  patientProfileId: u(800),
  serviceRequestId: ID.tac,
  codeConceptId: 'cx-tac',
  lifecycleStatusConceptId: 'cx-estado',
  currentReleasedVersionId: u(700),
  createdAt: dia(2, 10),
};

const receta = (
  id: string,
  med: string,
  encounterId: string,
  cuando: Date,
  extra: Partial<MedicationRequest> & Record<string, unknown> = {},
): MedicationRequest => ({
  id,
  medicationConceptId: med,
  statusConceptId: 'cx-estado',
  encounterId,
  createdAt: cuando,
  ...extra,
});

const cita = (id: string, cuando: Date, extra: Partial<Booking> = {}): Booking => ({
  id,
  statusConceptId: 'cx-estado',
  startAt: cuando,
  createdAt: dia(1, 1),
  ...extra,
});

const derivacion: Referral = {
  id: ID.derivacion,
  patientProfileId: u(800),
  statusConceptId: 'cx-estado',
  status: 'ACCEPTED',
  createdAt: dia(2, 17),
  sourceEncounterId: ID.e2,
  targetDisplayName: 'Otorrinolaringología de Clínica Norte',
  diagnosisText: 'Sinusitis aguda que no cede',
  targetEncounterId: ID.e3,
};

const HISTORIA: RegistrosDelRecorrido = {
  atenciones: [
    atencion(ID.e2, dia(2, 17), 'Control de cefalea'),
    atencion(ID.e1, dia(2, 3), 'Cefalea de dos semanas'),
    atencion(ID.e3, dia(3, 2), 'Sinusitis que no cede'),
  ],
  diagnosticos: [migrana, sinusitis],
  ordenes: [tac],
  informes: [informeTac],
  recetas: [
    receta(ID.paracetamol, 'cx-paracetamol', ID.e1, dia(2, 3)),
    receta(ID.amoxicilina, 'cx-amoxicilina', ID.e2, dia(2, 17), {
      indicationConditionId: ID.sinusitis,
      doseText: '1 comprimido',
      frequencyText: 'cada 8 horas',
      replacedByRequestId: ID.claritromicina,
    }),
    receta(ID.claritromicina, 'cx-claritromicina', ID.e3, dia(3, 2), { indicationConditionId: ID.sinusitis }),
  ],
  citas: [
    cita(ID.cita1, dia(2, 3)),
    cita(ID.cita2, dia(2, 17), { followUpOf: { bookingId: ID.cita1, encounterId: ID.e1, startAt: dia(2, 3) } }),
    cita(ID.cita3, dia(3, 20), { followUpOf: { bookingId: ID.cita2, encounterId: ID.e2 } }),
  ],
  derivaciones: [derivacion],
};

const AHORA = dia(3, 10);
const armar = (r: RegistrosDelRecorrido = HISTORIA): readonly PasoDelRecorrido[] => armarRecorridoGuiado(r, lector, AHORA);
const pasoDel = (pasos: readonly PasoDelRecorrido[], clave: string): PasoDelRecorrido => {
  const paso = pasos.find((p) => p.clave === clave);
  if (paso === undefined) throw new Error(`no hay paso ${clave}`);
  return paso;
};

describe('fechas y texto', () => {
  it('fechaCorta lee el día en UTC, no en hora local', () => {
    expect(fechaCorta(new Date(Date.UTC(2026, 1, 3, 0, 0)))).toBe('3 feb 2026');
    // 02:00 UTC del 3 es todavía 2 de febrero en Bolivia: el día clínico es el 3.
    expect(fechaCorta(new Date('2026-02-03T02:00:00Z'))).toBe('3 feb 2026');
    expect(fechaCorta(new Date('2026-09-30T23:59:00Z'))).toBe('30 sept 2026');
    expect(diaUtc(new Date('2026-02-03T02:00:00Z'))).toBe('2026-02-03');
  });

  it('legible descarta uuid, códigos de catálogo y vacíos', () => {
    expect(legible(u(5))).toBeUndefined();
    expect(legible('COND_CONFIRMED')).toBeUndefined();
    expect(legible('clinical:CONDITION_ACTIVE')).toBeUndefined();
    expect(legible('   ')).toBeUndefined();
    expect(legible(undefined)).toBeUndefined();
    expect(legible(' Migraña ')).toBe('Migraña');
  });

  it('enumerar junta con comas e «y»', () => {
    expect(enumerar([])).toBe('');
    expect(enumerar(['a'])).toBe('a');
    expect(enumerar(['a', 'b'])).toBe('a y b');
    expect(enumerar(['a', 'b', 'c'])).toBe('a, b y c');
  });
});

describe('armarRecorridoGuiado — orden y agrupado', () => {
  it('ordena los pasos por día, aunque los registros lleguen desordenados', () => {
    expect(armar().map((p) => p.clave)).toEqual([
      '2026-02-03',
      '2026-02-10',
      '2026-02-17',
      '2026-03-02',
      '2026-03-20',
    ]);
  });

  it('agrupa en un paso lo del mismo día y enfoca los registros reales de ese día', () => {
    const primero = pasoDel(armar(), '2026-02-03');
    expect(new Set(primero.enfocar)).toEqual(
      new Set([ID.e1, ID.migrana, ID.tac, ID.paracetamol]),
    );
    expect(primero.titulo).toBe('Consulta en Medicina general');
    expect(primero.fechaTexto).toBe('3 feb 2026');
  });

  it('no repite como cita la visita que ya es una atención del mismo día', () => {
    const primero = pasoDel(armar(), '2026-02-03');
    expect(primero.enfocar).not.toContain(ID.cita1);
    expect(primero.narracion).not.toMatch(/Tenía una cita/);
  });

  it('los revelados se acumulan, sin repetir, e incluyen el foco del paso', () => {
    const pasos = armar();
    let anterior: readonly string[] = [];
    for (const paso of pasos) {
      expect(paso.revelados.slice(0, anterior.length)).toEqual(anterior);
      for (const id of paso.enfocar) expect(paso.revelados).toContain(id);
      expect(new Set(paso.revelados).size).toBe(paso.revelados.length);
      anterior = paso.revelados;
    }
  });
});

describe('armarRecorridoGuiado — plantillas', () => {
  it('narra la primera consulta con el ejemplo pedido', () => {
    const { narracion, frases } = pasoDel(armar(), '2026-02-03');
    expect(narracion).toContain('El 3 feb 2026 consultó en Medicina general por cefalea de dos semanas.');
    expect(narracion).toContain('Se planteó migraña como diagnóstico presuntivo.');
    expect(narracion).toContain('Se pidió tomografía de cráneo para confirmar o descartar migraña.');
    // El orden de razonamiento: atención, diagnóstico, estudio, receta.
    expect(frases.map((f) => f.fuentes[0])).toEqual([ID.e1, ID.migrana, ID.tac, ID.paracetamol]);
  });

  it('el vínculo inferido se dice «en la misma atención», nunca como causa', () => {
    const { frases } = pasoDel(armar(), '2026-02-03');
    const paracetamol = frases.find((f) => f.fuentes.includes(ID.paracetamol));
    expect(paracetamol?.inferida).toBe(true);
    expect(paracetamol?.texto).toBe(
      'Se indicó Paracetamol 500 mg en la misma atención; la receta no indica para qué diagnóstico.',
    );
    expect(paracetamol?.texto).not.toMatch(/para tratar/);
    expect(frases.filter((f) => f.inferida)).toHaveLength(1);
  });

  it('el resultado dice qué estudio, cuándo se pidió y para qué', () => {
    const { narracion, titulo, enfocar } = pasoDel(armar(), '2026-02-10');
    expect(narracion).toBe(
      'El 10 feb 2026 se registró el informe de tomografía de cráneo, pedida el 3 feb 2026 para confirmar o descartar migraña, con resultado liberado.',
    );
    expect(titulo).toBe('Resultado de tomografía de cráneo');
    expect(enfocar).toEqual([ID.informeTac, ID.tac]);
  });

  it('un informe sin versión liberada lo dice', () => {
    const pasos = armar({ informes: [{ ...informeTac, currentReleasedVersionId: undefined }], ordenes: [tac] });
    expect(pasoDel(pasos, '2026-02-10').narracion).toContain('todavía no tiene un resultado liberado');
  });

  it('el descarte dice por qué, con qué evidencia y qué se confirmó en su lugar', () => {
    const { narracion, frases } = pasoDel(armar(), '2026-02-17');
    expect(narracion).toContain(
      'Se descartó migraña con base en el resultado de tomografía de cráneo: La tomografía no muestra hallazgos compatibles.',
    );
    expect(narracion).toContain('En su lugar se confirmó sinusitis aguda.');
    const descarte = frases.find((f) => f.texto.includes('Se descartó migraña'));
    expect(descarte?.fuentes).toEqual(expect.arrayContaining([ID.migrana, ID.tac, ID.sinusitis]));
    expect(descarte?.inferida).toBe(false);
  });

  it('un diagnóstico confirmado el mismo día se narra en una sola frase', () => {
    const { narracion } = pasoDel(armar(), '2026-02-17');
    expect(narracion).toContain('Se diagnosticó sinusitis aguda y quedó confirmado.');
    expect(narracion).not.toContain('Se planteó sinusitis aguda');
  });

  it('la reconsulta dice a qué cita vuelve', () => {
    const { narracion } = pasoDel(armar(), '2026-02-17');
    expect(narracion).toMatch(/^El 17 feb 2026 tenía agendada una reconsulta que vuelve a la cita del 3 feb 2026\. Consultó en Neurología por control de cefalea\./);
  });

  it('las reconsultas encadenadas nombran toda la cadena', () => {
    const { narracion, titulo, enfocar } = pasoDel(armar(), '2026-03-20');
    expect(narracion).toBe(
      'El 20 mar 2026 tiene agendada una reconsulta que vuelve a la cita del 17 feb 2026, que a su vez volvía a la del 3 feb 2026.',
    );
    expect(titulo).toBe('Reconsulta agendada');
    expect(enfocar).toEqual([ID.cita3]);
  });

  it('una cadena de reconsultas con ciclo termina', () => {
    const a = cita(u(60), dia(4, 1), { followUpOf: { bookingId: u(61), encounterId: null } });
    const b = cita(u(61), dia(4, 8), { followUpOf: { bookingId: u(60), encounterId: null } });
    const pasos = armar({ citas: [a, b] });
    expect(pasos).toHaveLength(2);
    expect(pasoDel(pasos, '2026-04-08').narracion).toContain('vuelve a la cita del 1 abr 2026');
  });

  it('la receta con indicación dice para qué es, con dosis', () => {
    const { narracion } = pasoDel(armar(), '2026-02-17');
    expect(narracion).toContain(
      'Se indicó Amoxicilina 500 mg (1 comprimido, cada 8 horas) para tratar sinusitis aguda.',
    );
  });

  it('el reemplazo de una receta se narra en la receta nueva', () => {
    const { narracion, enfocar } = pasoDel(armar(), '2026-03-02');
    expect(narracion).toContain(
      'Se indicó Claritromicina 500 mg para tratar sinusitis aguda. Reemplaza a Amoxicilina 500 mg, indicado el 17 feb 2026.',
    );
    expect(enfocar).toContain(ID.amoxicilina);
  });

  it('el reemplazo también se lee desde replacesRequestId', () => {
    const vieja = receta(u(70), 'cx-amoxicilina', ID.e1, dia(2, 3));
    const nueva = receta(u(71), 'cx-claritromicina', ID.e1, dia(2, 9), { replacesRequestId: u(70) });
    const pasos = armar({ recetas: [vieja, nueva] });
    expect(pasoDel(pasos, '2026-02-09').narracion).toContain('Reemplaza a Amoxicilina 500 mg, indicado el 3 feb 2026.');
  });

  it('la derivación dice a dónde y por qué; la llegada se narra en la atención de destino', () => {
    const pasos = armar();
    expect(pasoDel(pasos, '2026-02-17').narracion).toContain(
      'Se derivó a Otorrinolaringología de Clínica Norte por sinusitis aguda que no cede.',
    );
    const llegada = pasoDel(pasos, '2026-03-02');
    expect(llegada.narracion).toMatch(
      /^El 2 mar 2026 llegó por la derivación del 17 feb 2026 a Otorrinolaringología de Clínica Norte, y se lo recibió en esta atención\. Consultó en Otorrinolaringología por sinusitis que no cede\./,
    );
    expect(llegada.titulo).toBe('Consulta en Otorrinolaringología');
    expect(llegada.enfocar).toEqual(expect.arrayContaining([ID.derivacion, ID.e3]));
  });

  it('la derivación rechazada sin motivo lo dice', () => {
    const rechazada: Referral = { ...derivacion, status: 'REJECTED', respondedAt: dia(2, 20), rejectReason: undefined };
    const pasos = armar({ derivaciones: [rechazada] });
    expect(pasoDel(pasos, '2026-02-20').narracion).toBe(
      'El 20 feb 2026 la derivación del 17 feb 2026 fue rechazada. No se registró el motivo.',
    );
  });

  it('la contrarreferencia se narra en su día', () => {
    const conContra: Referral = { ...derivacion, counterReferralAt: dia(3, 5), counterReferralText: 'Seguir con lavados nasales.' };
    expect(pasoDel(armar({ derivaciones: [conContra] }), '2026-03-05').narracion).toBe(
      'El 5 mar 2026 se recibió la contrarreferencia de la derivación del 17 feb 2026: Seguir con lavados nasales.',
    );
  });

  it('la internación tiene ingreso y alta, y la atención dice que fue durante ella', () => {
    const internacion: CareEpisode = {
      id: u(80),
      tenantId: u(801),
      typeConceptId: 'cx-internacion',
      statusConceptId: 'cx-estado',
      startAt: dia(5, 1, 8),
      endAt: dia(5, 4),
      createdAt: dia(5, 1),
    };
    const pasos = armar({
      internaciones: [internacion],
      atenciones: [atencion(u(81), dia(5, 1, 9), 'Dolor abdominal', { episodeId: u(80) })],
    });
    expect(pasos.map((p) => p.clave)).toEqual(['2026-05-01', '2026-05-04']);
    expect(pasos[0].narracion).toBe(
      'El 1 may 2026 ingresó a internación (clínica). Tuvo una atención por dolor abdominal, durante la internación.',
    );
    expect(pasos[1].narracion).toBe('El 4 may 2026 recibió el alta de la internación iniciada el 1 may 2026.');
    expect(pasos[1].titulo).toBe('Alta de internación');
  });

  it('un procedimiento futuro se narra como programado', () => {
    const pasos = armar({
      procedimientos: [{ id: u(90), caseNumber: 'QX-0001', patientProfileId: u(800), statusConceptId: 'cx-x', scheduledStartAt: dia(4, 2) }],
    });
    expect(pasos[0].narracion).toBe('El 2 abr 2026 tiene programada una intervención quirúrgica.');
    expect(pasos[0].narracion).not.toContain('QX-0001');
  });

  it('una cita común sin atención ese día se narra con su estado', () => {
    const pasos = armar({ citas: [cita(u(91), dia(1, 15), { statusConceptId: 'cx-cancelada', service: { offeringId: 'x', name: 'Cardiología', price: '0', minDurationMinutes: 20, maxDurationMinutes: 30, requiresApproval: false } })] });
    expect(pasos[0].narracion).toBe('El 15 ene 2026 tenía una cita de Cardiología (estado: cancelada).');
  });
});

describe('armarRecorridoGuiado — cadenas de reemplazo de diagnósticos', () => {
  const dx = (id: string, concepto: string, extra: Partial<Condition> & Record<string, unknown> = {}): Condition => ({
    id,
    codeConceptId: concepto,
    createdAt: dia(6, 1),
    ...extra,
  });
  const descartado = (decidido: Date, reemplazo?: string) => ({
    verification: {
      outcome: 'REFUTED' as const,
      decidedAt: decidido.toISOString(),
      decidedByProfileId: u(900),
      reasonText: null,
      basedOn: null,
    },
    ...(reemplazo === undefined ? {} : { replacedByConditionId: reemplazo }),
  });

  it('X → Y → Z: cada descarte nombra su reemplazo y avisa si también cayó', () => {
    const x = dx(u(100), 'cx-migrana', descartado(dia(6, 5), u(101)));
    const y = dx(u(101), 'cx-sinusitis', { createdAt: dia(6, 5), ...descartado(dia(6, 9), u(102)) });
    const z = dx(u(102), 'cx-paracetamol', { createdAt: dia(6, 9) });
    const pasos = armar({ diagnosticos: [x, y, z] });
    const texto = pasos.map((p) => p.narracion).join(' ');
    expect(texto).toContain('Se descartó migraña. No se registró el motivo del descarte. En su lugar se planteó sinusitis aguda, que después también se descartó.');
    expect(texto).toContain('Se descartó sinusitis aguda. No se registró el motivo del descarte. En su lugar se planteó paracetamol 500 mg, todavía en estudio.');
  });

  it('un reemplazo que no está en la lectura se dice, sin nombrarlo', () => {
    const x = dx(u(110), 'cx-migrana', descartado(dia(6, 5), u(119)));
    expect(armar({ diagnosticos: [x] }).map((p) => p.narracion).join(' ')).toContain(
      'En su lugar se registró otro diagnóstico, que no está en esta lectura.',
    );
  });

  it('un ciclo de reemplazos (inválido para la API) no cuelga ni repite', () => {
    const x = dx(u(120), 'cx-migrana', descartado(dia(6, 5), u(121)));
    const y = dx(u(121), 'cx-sinusitis', descartado(dia(6, 6), u(120)));
    const pasos = armar({ diagnosticos: [x, y] });
    expect(pasos.length).toBeGreaterThan(0);
  });

  it('un reemplazo apuntando a sí mismo se ignora', () => {
    const x = dx(u(130), 'cx-migrana', descartado(dia(6, 5), u(130)));
    expect(armar({ diagnosticos: [x] }).map((p) => p.narracion).join(' ')).not.toContain('En su lugar');
  });

  it('el veredicto también se lee del código del catálogo cuando no hay decisión de C3', () => {
    const x = dx(u(140), 'cx-migrana', { verificationStatusConceptId: 'cx-v-confirmado' });
    const y = dx(u(141), 'cx-sinusitis', { verificationStatusConceptId: 'cx-v-descartado' });
    const texto = armar({ diagnosticos: [x, y] })[0].narracion;
    expect(texto).toContain('El 1 jun 2026 se diagnosticó migraña y quedó confirmado.');
    expect(texto).toContain('Se consideró sinusitis aguda y se descartó.');
  });

  it('una orden pedida después de confirmar es de seguimiento, no de confirmación', () => {
    const x = dx(u(150), 'cx-sinusitis', {
      verification: { outcome: 'CONFIRMED', decidedAt: dia(6, 1).toISOString(), decidedByProfileId: u(900), reasonText: null, basedOn: null },
    });
    const orden = { ...tac, id: u(151), encounterId: undefined, createdAt: dia(6, 20), reasonConditionId: u(150) } as DiagnosticOrder;
    expect(pasoDel(armar({ diagnosticos: [x], ordenes: [orden] }), '2026-06-20').narracion).toBe(
      'El 20 jun 2026 se pidió tomografía de cráneo para el seguimiento de sinusitis aguda.',
    );
  });
});

describe('armarRecorridoGuiado — ausencia de datos', () => {
  it('sin motivo ni servicio: frase honesta', () => {
    const pasos = armar({ atenciones: [atencion(u(200), dia(7, 1), undefined, { classConceptId: 'cx-ambulatorio' })] });
    expect(pasos[0].narracion).toBe('El 1 jul 2026 tuvo una atención (ambulatorio). No se registró el motivo.');
    expect(pasos[0].titulo).toBe('Atención');
  });

  it('una etiqueta que devuelve un uuid o un código se trata como desconocida', () => {
    const pasos = armar({
      diagnosticos: [{ id: u(210), codeConceptId: 'cx-uuid', createdAt: dia(7, 2) }],
      recetas: [receta(u(211), 'cx-codigo', u(299), dia(7, 2))],
    });
    expect(pasos[0].narracion).toContain('El 2 jul 2026 se planteó un diagnóstico sin nombre disponible como diagnóstico presuntivo.');
    expect(pasos[0].narracion).toContain('Se indicó un medicamento sin nombre disponible. No se registró la indicación.');
  });

  it('una orden sin motivo ni atención con diagnósticos lo dice', () => {
    const orden = { ...tac, id: u(220), encounterId: undefined, createdAt: dia(7, 3) } as DiagnosticOrder;
    delete (orden as unknown as Record<string, unknown>)['reasonConditionId'];
    expect(armar({ ordenes: [orden] })[0].narracion).toBe(
      'El 3 jul 2026 se pidió tomografía de cráneo. No se registró para qué diagnóstico.',
    );
  });

  it('una derivación sin destino lo dice', () => {
    const sinDestino: Referral = { ...derivacion, targetDisplayName: undefined, sourceEncounterId: undefined };
    expect(armar({ derivaciones: [sinDestino] })[0].narracion).toBe(
      'El 17 feb 2026 se emitió una derivación; no se registró el destino.',
    );
  });

  it('lo que no tiene fecha va al final, en un paso que lo explica', () => {
    const pasos = armar({
      atenciones: [atencion(u(230), dia(7, 4), 'Fiebre'), { id: u(231), statusConceptId: 'x' }],
    });
    expect(pasos.map((p) => p.clave)).toEqual(['2026-07-04', 'sin-fecha']);
    const ultimo = pasos[1];
    expect(ultimo.fecha).toBeNull();
    expect(ultimo.fechaTexto).toBe('Sin fecha');
    expect(ultimo.narracion).toMatch(/^Estos registros no tienen fecha/);
  });

  it('sin registros no hay pasos', () => {
    expect(armar({})).toEqual([]);
  });

  it('ningún uuid llega al texto, aunque venga en un texto libre', () => {
    const pasos = armar({
      ...HISTORIA,
      atenciones: [...(HISTORIA.atenciones ?? []), atencion(u(240), dia(8, 1), `Control ${u(241)} anual`)],
    });
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    for (const paso of pasos) {
      expect(paso.narracion).not.toMatch(uuid);
      expect(paso.titulo).not.toMatch(uuid);
      for (const f of paso.frases) expect(f.texto).not.toMatch(uuid);
    }
    expect(pasoDel(pasos, '2026-08-01').narracion).toBe('El 1 ago 2026 tuvo una atención por control anual.');
  });

  it('cada frase se rastrea a registros que existen', () => {
    const existentes = new Set(
      Object.values(HISTORIA).flatMap((lista: readonly { id: string }[] | undefined) => (lista ?? []).map((r) => r.id)),
    );
    for (const paso of armar()) {
      expect(paso.frases.length).toBeGreaterThan(0);
      for (const f of paso.frases) {
        expect(f.fuentes.length).toBeGreaterThan(0);
        for (const id of f.fuentes) expect(existentes.has(id)).toBe(true);
      }
      for (const id of paso.enfocar) expect(existentes.has(id)).toBe(true);
    }
  });
});

describe('seguirEpisodio', () => {
  it('se queda con los pasos del episodio, recorta el foco y recalcula los revelados', () => {
    const episodio = [ID.e2, ID.sinusitis, ID.amoxicilina, ID.e3, ID.claritromicina];
    const pasos = seguirEpisodio(armar(), episodio);
    expect(pasos.map((p) => p.clave)).toEqual(['2026-02-17', '2026-03-02']);
    for (const paso of pasos) for (const id of paso.enfocar) expect(episodio).toContain(id);
    expect(pasos[1].revelados).toEqual(expect.arrayContaining(episodio));
    expect(pasos[1].revelados).toHaveLength(episodio.length);
    // La narración no se recorta.
    expect(pasos[0].narracion).toContain('Se descartó migraña');
  });

  it('un episodio sin nodos en la historia deja la lista vacía', () => {
    expect(seguirEpisodio(armar(), [u(999)])).toEqual([]);
  });
});
