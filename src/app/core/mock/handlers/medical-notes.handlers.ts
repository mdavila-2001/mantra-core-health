import {
  notas,
  NOTA_TIPO_EVOLUCION,
  type FilaDeNotaSimulada,
  type NotaSimulada,
} from '../fixtures/clinica';
import { ESTADO } from '../fixtures/conceptos';
import { MEDICA } from '../fixtures/personas';
import {
  conflict,
  forbidden,
  notFound,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { ahora, cuerpo, nuevoId } from '../mock-store';
import { avisarFichaAlPaciente } from './clinical.handlers';

/* ============================================================================
    La nota médica (C1): la tabla campo/valor que la médica escribe en cada
    cita.

    Lo que el propietario pidió, literal: «en cada cita es posible realizar
    una observación, en la cual el doctor escribe lo que se observa y cada
    observación tiene su respectivo ID … es una tabla de valores donde los
    campos son más dinámicos y laxos … llamadas notas médicas».

    El contrato es el de `chart.clinical_note_*` con una columna más —las
    filas— que el backend todavía no tiene (P39). Acá se valida lo que el
    backend va a validar, para que la pantalla no se acostumbre a un servidor
    que acepta cualquier cosa.
   ========================================================================== */

/** Hasta cuántas filas admite una nota. Más que eso ya es un formulario. */
const TOPE_DE_FILAS = 40;
const TOPE_DEL_ROTULO = 60;
const TOPE_DEL_VALOR = 500;

/** Lo que se manda al abrir una nota o al agregarle una versión. */
interface CuerpoDeNota {
  readonly patientProfileId: string;
  readonly authorProfileId: string;
  readonly encounterId?: string;
  readonly noteTypeConceptId?: string;
  readonly entries?: readonly { readonly label?: unknown; readonly value?: unknown }[];
  readonly chiefComplaintText?: string;
  readonly subjectiveText?: string;
  readonly objectiveText?: string;
  readonly assessmentText?: string;
  readonly planText?: string;
  readonly amendmentReasonText?: string;
}

/** Un problema de una fila, con el índice para que la pantalla lo ancle. */
interface ProblemaDeFila {
  readonly index: number;
  readonly field: 'label' | 'value';
  readonly message: string;
}

/** «Presión Arterial» y «presion arterial» son el mismo rótulo. */
function normalizado(rotulo: string): string {
  return rotulo.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Las filas, ya limpias, o los problemas que impiden guardarlas.
 *
 * Devuelve las filas con `label` y `value` recortados: lo que se guarda es lo
 * que se lee, y un rótulo con espacios al final no se distingue en pantalla
 * del mismo rótulo sin ellos.
 */
function validarFilas(entradas: CuerpoDeNota['entries']): {
  readonly filas: readonly FilaDeNotaSimulada[];
  readonly problemas: readonly ProblemaDeFila[];
} {
  if (entradas === undefined) return { filas: [], problemas: [] };
  if (!Array.isArray(entradas)) {
    return {
      filas: [],
      problemas: [{ index: 0, field: 'label', message: 'Las filas deben ser una lista.' }],
    };
  }
  if (entradas.length > TOPE_DE_FILAS) {
    return {
      filas: [],
      problemas: [
        { index: TOPE_DE_FILAS, field: 'label', message: `Hasta ${TOPE_DE_FILAS} filas por nota.` },
      ],
    };
  }

  const problemas: ProblemaDeFila[] = [];
  const filas: FilaDeNotaSimulada[] = [];
  const vistos = new Set<string>();

  entradas.forEach((fila, index) => {
    const label = typeof fila.label === 'string' ? fila.label.trim() : '';
    const value = typeof fila.value === 'string' ? fila.value.trim() : '';
    if (label.length === 0) {
      problemas.push({ index, field: 'label', message: `Fila ${index + 1}: falta el campo.` });
    } else if (label.length > TOPE_DEL_ROTULO) {
      problemas.push({
        index,
        field: 'label',
        message: `Fila ${index + 1}: el campo admite hasta ${TOPE_DEL_ROTULO} caracteres.`,
      });
    }
    if (value.length === 0) {
      problemas.push({ index, field: 'value', message: `Fila ${index + 1}: falta el valor.` });
    } else if (value.length > TOPE_DEL_VALOR) {
      problemas.push({
        index,
        field: 'value',
        message: `Fila ${index + 1}: el valor admite hasta ${TOPE_DEL_VALOR} caracteres.`,
      });
    }
    const clave = normalizado(label);
    if (clave !== '' && vistos.has(clave)) {
      problemas.push({
        index,
        field: 'label',
        message: `Fila ${index + 1}: el campo «${label}» ya está en otra fila.`,
      });
    }
    vistos.add(clave);
    filas.push({ label, value });
  });

  return { filas, problemas };
}

/** La nota como la ve el cliente: sin las dos columnas internas de la tabla. */
function publica(nota: NotaSimulada): Omit<NotaSimulada, 'id' | 'patientProfileId'> {
  const { id: _id, patientProfileId: _paciente, ...resto } = nota;
  return resto;
}

/** Quién puede leer las notas de una persona: quien atiende o la persona misma. */
function puedeLeer(request: MockRequest, patientProfileId: string): boolean {
  const user = request.user;
  if (user === null) return false;
  if (user.roles.includes('SUPERADMIN')) return true;
  if (user.patientProfileId === patientProfileId) return true;
  return user.practitionerProfileId !== undefined;
}

export function registerMedicalNotes(router: MockRouter): void {
  /* ---- listar: lo que ya se escribió de esta persona ------------------------ */

  router.get('/charts/notes', (request) => {
    const patientProfileId = request.query.get('patientProfileId');
    if (patientProfileId === null || patientProfileId === '') {
      return validation('Falta patientProfileId.');
    }
    if (!puedeLeer(request, patientProfileId)) return forbidden();

    const encounterId = request.query.get('encounterId');
    const limit = Number(request.query.get('limit') ?? 50) || 50;
    const items = notas
      .filtrar(
        (n) =>
          n.patientProfileId === patientProfileId &&
          (encounterId === null || encounterId === '' || n.encounterId === encounterId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(publica);
    return { items, count: items.length, limit, nextCursor: null };
  });

  /* ---- abrir una nota ------------------------------------------------------- */

  router.post('/charts/notes', (request) => {
    const datos = cuerpo<CuerpoDeNota>(request);
    if (datos.patientProfileId === undefined || datos.patientProfileId === '') {
      return validation('Falta patientProfileId.');
    }
    const { filas, problemas } = validarFilas(datos.entries);
    if (problemas.length > 0) {
      return validation(problemas[0]!.message, problemas);
    }
    const textoLibre = (datos.subjectiveText ?? '').trim();
    if (filas.length === 0 && textoLibre === '') {
      return validation('La nota necesita al menos una fila o un texto libre.');
    }

    const noteId = nuevoId('note');
    const nueva: NotaSimulada = {
      noteId,
      id: noteId,
      patientProfileId: datos.patientProfileId,
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
      noteTypeConceptId: datos.noteTypeConceptId ?? NOTA_TIPO_EVOLUCION,
      lifecycleStatusConceptId: ESTADO['ST-DRAFT']!,
      currentVersionId: nuevoId('note-version'),
      versionNumber: 1,
      authorProfileId: datos.authorProfileId ?? request.user?.practitionerProfileId ?? MEDICA.id,
      entries: filas,
      chiefComplaintText: datos.chiefComplaintText ?? '',
      subjectiveText: textoLibre,
      objectiveText: datos.objectiveText ?? '',
      assessmentText: datos.assessmentText ?? '',
      planText: datos.planText ?? '',
      signedAt: null,
      releasedToPatient: false,
      createdAt: ahora(),
    };
    notas.agregar(nueva);
    // La nota médica es la otra mitad de la ficha: si la médica empezó por
    // acá y no por el diagnóstico, el aviso al paciente sale igual. Y si ya
    // salió por el diagnóstico, no sale dos veces.
    avisarFichaAlPaciente({
      patientProfileId: nueva.patientProfileId,
      encounterId: nueva.encounterId,
      autorProfileId: nueva.authorProfileId,
    });
    return {
      status: 201,
      body: {
        noteId,
        versionId: nueva.currentVersionId,
        versionNumber: 1,
        lifecycleStatusConceptId: nueva.lifecycleStatusConceptId,
        versionStatusConceptId: ESTADO['ST-DRAFT']!,
      },
    };
  });

  /* ---- agregarle una versión ------------------------------------------------ */

  // `ChartNotesClient.appendVersion` hace `PUT` (UC-15-02); se acepta también
  // `POST` por si alguna pantalla vieja lo usa.
  const agregarVersion = (request: MockRequest) => {
    const n = notas.get(request.params['id']!);
    if (n === undefined) return notFound('Nota no encontrada');
    const datos = cuerpo<CuerpoDeNota>(request);
    // Una nota firmada no se pisa: se corrige diciendo por qué.
    if (n.signedAt !== null && (datos.amendmentReasonText ?? '').trim() === '') {
      return conflict(
        'La nota está firmada. Para corregirla hay que decir el motivo de la enmienda.',
      );
    }
    const { filas, problemas } = validarFilas(datos.entries);
    if (problemas.length > 0) {
      return validation(problemas[0]!.message, problemas);
    }
    const versionId = nuevoId('note-version');
    notas.actualizar(n.noteId, {
      ...(datos.entries === undefined ? {} : { entries: filas }),
      ...(datos.chiefComplaintText === undefined
        ? {}
        : { chiefComplaintText: datos.chiefComplaintText }),
      ...(datos.subjectiveText === undefined
        ? {}
        : { subjectiveText: datos.subjectiveText.trim() }),
      ...(datos.objectiveText === undefined ? {} : { objectiveText: datos.objectiveText }),
      ...(datos.assessmentText === undefined ? {} : { assessmentText: datos.assessmentText }),
      ...(datos.planText === undefined ? {} : { planText: datos.planText }),
      currentVersionId: versionId,
      versionNumber: n.versionNumber + 1,
    });
    return {
      status: 201,
      body: {
        noteId: n.noteId,
        versionId,
        versionNumber: n.versionNumber + 1,
        lifecycleStatusConceptId: n.lifecycleStatusConceptId,
        versionStatusConceptId: ESTADO['ST-DRAFT']!,
      },
    };
  };
  router.put('/charts/notes/:id/versions', agregarVersion);
  router.post('/charts/notes/:id/versions', agregarVersion);

  /* ---- firmar --------------------------------------------------------------- */

  router.post('/charts/notes/:id/versions/:versionId/sign', (request) => {
    const n = notas.get(request.params['id']!);
    if (n === undefined) return notFound('Nota no encontrada');
    if (n.currentVersionId !== request.params['versionId']) {
      return notFound('Esa versión ya no es la vigente');
    }
    // Firmar dos veces no es un error: la firma es la misma.
    const firmada =
      n.signedAt === null
        ? notas.actualizar(n.noteId, {
            signedAt: ahora(),
            lifecycleStatusConceptId: ESTADO['ST-COMPLETED']!,
          })
        : n;
    return publica(firmada ?? n);
  });
}
