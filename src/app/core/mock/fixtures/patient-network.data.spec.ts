import { conditionList, encounterList, episodeList, noteList, observationList, orderList, prescriptionList } from './clinic';
import { reservas } from './agenda';
import {
  BOOKING_STATUS,
  displayOf,
  ENCOUNTER_CLASS,
  OBSERVATION,
  OBSERVATION_UNIT,
  UNIDAD,
  VERIFICATION_DX,
} from './concepts';
import { NETWORK_IDS as N } from './patient-network.data';
import { PACIENTE } from './people';
import { uuid } from '../mock-store';
import { informes } from '../handlers/diagnostics.handlers';
import { REFERRAL_STATUS, referralList } from '../handlers/referrals.handlers';
import * as fk from '../faker/index';

/**
 * La historia de ~18 meses de la paciente de prueba (red clínica, Franja 1):
 * cada vínculo apunta a algo que existe y es de ella, y lo que las pruebas
 * viejas usaban de esta paciente sigue igual.
 */
describe('historia clínica de la paciente de prueba (red clínica)', () => {
  const P = PACIENTE.id;
  const ofPatient = <T extends { patientProfileId: string }>(row: T | undefined): T => {
    expect(row?.patientProfileId).toBe(P);
    return row!;
  };

  it('no reemplaza lo que ya tenía: sus tres diagnósticos sembrados siguen primeros y en orden', () => {
    const own = conditionList.filtrar((c) => c.patientProfileId === P).map((c) => c.id);
    expect(own.slice(0, 3)).toEqual([
      uuid(`condition-${P}-I10`),
      uuid(`condition-${P}-E78.5`),
      uuid(`condition-${P}-J06.9`),
    ]);
    expect(own).toContain(N.hypothyroidism);
  });

  it('el descartado apunta al confirmado que lo reemplazó, con su evidencia', () => {
    const anemia = ofPatient(conditionList.get(N.anemia));
    const hypo = ofPatient(conditionList.get(N.hypothyroidism));
    expect(anemia.verificationStatusConceptId).toBe(VERIFICATION_DX['COND_REFUTED']);
    expect(anemia.replacedByConditionId).toBe(hypo.id);
    expect(hypo.verificationStatusConceptId).toBe(VERIFICATION_DX['COND_CONFIRMED']);
    for (const c of [anemia, hypo]) {
      const evidence = c.verification!.basedOn!;
      expect(evidence.kind).toBe('ANALYSIS');
      const report = informes.get(evidence.diagnosticReportId!);
      expect(report?.released).toBe(true);
      expect(report?.serviceRequestId).toBe(evidence.serviceRequestId);
    }
    // Queda uno en estudio: el que la demostración rechaza.
    expect(conditionList.get(N.anxiety)?.verificationStatusConceptId).toBe(VERIFICATION_DX['COND_PROVISIONAL']);
  });

  it('cada estudio cuelga de un diagnóstico y de una atención de ella, con informe liberado', () => {
    const studies = [N.bloodCount, N.tsh, N.tshControl, N.urineCulture, N.kidneyUltrasound, N.tshSuppressed];
    for (const id of studies) {
      const order = ofPatient(orderList.get(id));
      ofPatient(conditionList.get(order.reasonConditionId!));
      ofPatient(encounterList.get(order.encounterId!));
      expect(informes.filtrar((r) => r.serviceRequestId === id && r.released)).toHaveLength(1);
    }
  });

  it('la levotiroxina se reemplaza 25 → 50 → 75 mcg, siempre para el hipotiroidismo', () => {
    const chain = [N.levo25, N.levo50, N.levo75].map((id) => ofPatient(prescriptionList.get(id)));
    expect(chain.map((r) => r.doseText)).toEqual(['25 mcg', '50 mcg', '75 mcg']);
    expect(chain[0]!.replacedByRequestId).toBe(N.levo50);
    expect(chain[1]!.replacedByRequestId).toBe(N.levo75);
    expect(chain[2]!.replacedByRequestId).toBeUndefined();
    expect(chain.every((r) => r.indicationConditionId === N.hypothyroidism)).toBe(true);
    // El concepto dice la misma concentración que la dosis: la narración no
    // puede contar «Levotiroxina 50 mcg» de la receta de 25.
    expect(chain.map((r) => displayOf(r.medicationConceptId))).toEqual([
      'Levotiroxina 25 mcg comprimidos',
      'Levotiroxina 50 mcg comprimidos',
      'Levotiroxina 75 mcg comprimidos',
    ]);
    expect(prescriptionList.get(N.ciprofloxacin)?.indicationConditionId).toBe(N.pyelonephritis);
  });

  it('la internación es un episodio con su atención de internación', () => {
    const inpatient = ofPatient(encounterList.get(N.inpatient));
    expect(inpatient.classConceptId).toBe(ENCOUNTER_CLASS['ENC-IMP']);
    expect(inpatient.episodeId).toBe(N.episode);
    ofPatient(episodeList.get(N.episode));
  });

  it('las citas: reconsultas encadenadas, una cancelada y una no asistida', () => {
    const booking = (id: string) => ofPatient(reservas.get(id));
    expect(booking(N.bookingResults).followUpOf).toEqual({ bookingId: N.bookingFirst, encounterId: N.firstVisit });
    expect(booking(N.bookingDose).followUpOf?.bookingId).toBe(N.bookingResults);
    expect(booking(N.bookingCancelled).statusConceptId).toBe(BOOKING_STATUS['BK-CANCELLED']);
    expect(booking(N.bookingNoShow).statusConceptId).toBe(BOOKING_STATUS['BK-NO-SHOW']);
  });

  it('derivaciones: una aceptada con llegada y contrarreferencia, otra rechazada con motivo', () => {
    const endo = ofPatient(referralList.get(N.referralEndocrinology));
    expect(endo.statusConceptId).toBe(REFERRAL_STATUS['REF_COMPLETED']);
    const arrival = ofPatient(encounterList.get(endo.targetEncounterId!));
    // La atención de llegada es del destino, no de quien derivó.
    expect(arrival.primaryPractitionerId).toBe(endo.targetProfileId);
    expect(endo.counterReferralText).toBeTruthy();
    ofPatient(encounterList.get(endo.sourceEncounterId!));

    const neuro = ofPatient(referralList.get(N.referralNeurology));
    expect(neuro.statusConceptId).toBe(REFERRAL_STATUS['REF_REJECTED']);
    expect(neuro.rejectReason).toBeTruthy();
  });

  it('la nota de la primera consulta es de su atención', () => {
    expect(noteList.todos().find((n) => n.noteId === N.firstVisitNote)?.encounterId).toBe(N.firstVisit);
  });
});

/**
 * «118 mg» y «36.4 mg» en el expediente (captura del 06/11/2026): la causa era
 * el simulador, que sembraba todas las observaciones con la unidad de DOSIS
 * `UNIT-MG`. El render de la ficha (`valor + etiqueta de la unidad`) estaba
 * bien. Ahora cada medición lleva su unidad de `VS_OBSERVATION_UNIT`.
 */
describe('unidades de las observaciones del simulador', () => {
  const EXPECTED: Readonly<Record<string, string>> = {
    [OBSERVATION['OBS-BP-SYS']!]: OBSERVATION_UNIT['OBSU-MMHG']!,
    [OBSERVATION['OBS-BP-DIA']!]: OBSERVATION_UNIT['OBSU-MMHG']!,
    [OBSERVATION['OBS-HR']!]: OBSERVATION_UNIT['OBSU-BPM']!,
    [OBSERVATION['OBS-TEMP']!]: OBSERVATION_UNIT['OBSU-CELSIUS']!,
    [OBSERVATION['OBS-WEIGHT']!]: OBSERVATION_UNIT['OBSU-KG']!,
    [OBSERVATION['OBS-HEIGHT']!]: OBSERVATION_UNIT['OBSU-CM']!,
    [OBSERVATION['OBS-SPO2']!]: OBSERVATION_UNIT['OBSU-PERCENT']!,
    [OBSERVATION['OBS-GLUCOSE']!]: OBSERVATION_UNIT['OBSU-MGDL']!,
    [OBSERVATION['OBS-BMI']!]: OBSERVATION_UNIT['OBSU-KGM2']!,
  };

  it('ninguna observación sembrada usa una unidad de dosis, y cada una la de su medición', () => {
    const doseUnits = new Set(Object.values(UNIDAD));
    const wrong = observationList
      .todos()
      .filter((o) => doseUnits.has(o.quantityUnitConceptId) || EXPECTED[o.codeConceptId] !== o.quantityUnitConceptId)
      .map((o) => o.id);
    expect(wrong).toEqual([]);
  });

  it('el generador de signos vitales tampoco', () => {
    const vitals = fk.signosVitales(fk.conSemilla('unidades'), 40);
    expect(vitals.length).toBeGreaterThan(0);
    for (const v of vitals) expect(v.unitConceptId).toBe(EXPECTED[v.observationConceptId]);
  });
});
