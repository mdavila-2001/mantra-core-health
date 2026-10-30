import { notFound, type MockRequest, type MockRouter } from '../mock-router';
import type { SchemaDescription } from '../../data-access/admin-portal/data-catalog.types';

/* ============================================================================
    Lo que la bóveda aporta al catálogo de datos, en el backend simulado:
    la explicación por schema, una ficha importada (borrador con texto de
    plantilla) y las notas de las claves foráneas.

    Reproduce las reglas de la API real: un schema que ningún módulo declara es
    `null`; un módulo sin «Propósito de negocio» deja `business` en `null`; lo
    importado es `IMPORTED_VAULT`, borrador, y cada campo plantilla declara una
    pregunta abierta. Los textos son sintéticos y están rotulados como tales.
    ========================================================================== */

const DESCRIPCIONES: Readonly<Record<string, SchemaDescription>> = {
  profiles: {
    moduleNumber: 5,
    moduleCode: 'profiles',
    title: 'Profiles — People and Role Profiles',
    domain: 'Núcleo y Terminología',
    business:
      'Holds the human identity (a person) and the role profiles hanging from it: patient, practitioner, staff. Keeps identity separate from login credentials so a patient can exist without portal access.',
    system: 'Módulo 05 del modelo: 24 tablas o vistas modeladas y 12 conjuntos de índices; depende de 3 módulos y lo referencian 9 módulos.',
    source: 'SALUD/Módulos/M05 profiles.md',
  },
  scheduling: {
    moduleNumber: 41,
    moduleCode: 'scheduling',
    title: 'Scheduling — Appointments and Availability',
    domain: 'Práctica y Agenda',
    business: 'Offers, holds and confirms appointment slots between a patient and a practitioner, and keeps the availability they are drawn from.',
    system: 'Módulo 41 del modelo: 38 tablas o vistas modeladas y 19 conjuntos de índices; depende de 5 módulos y lo referencian 4 módulos.',
    source: 'SALUD/Módulos/M41 scheduling.md',
  },
  billing: {
    moduleNumber: 17,
    moduleCode: 'billing',
    title: 'Billing, Receivables, Payables and Financial Planning',
    domain: 'Financiero y ERP',
    // La nota de este módulo no trae «Propósito de negocio»: se muestra tal cual, vacío.
    business: null,
    system: 'Módulo 17 del modelo: 120 tablas o vistas modeladas y 60 conjuntos de índices; depende de 6 módulos y lo referencian 7 módulos.',
    source: 'SALUD/Módulos/M17 billing.md',
  },
  clinical: {
    moduleNumber: 8,
    moduleCode: 'clinical',
    title: 'Core Clinical Record, Orders and Encounter Logistics',
    domain: 'Clínico y Diagnóstico',
    business: null,
    system: 'Módulo 08 del modelo: 44 tablas o vistas modeladas y 22 conjuntos de índices; depende de 6 módulos y lo referencian 12 módulos.',
    source: 'SALUD/Módulos/M08 clinical.md',
  },
  iam: {
    moduleNumber: 1,
    moduleCode: 'iam',
    title: 'Identity & Access — User Accounts and Security',
    domain: 'Identidad y Seguridad',
    business: 'Manages login accounts, credentials, MFA, devices and sessions. A user record is an authenticating account, not a person, patient or practitioner.',
    system: 'Módulo 01 del modelo: 14 tablas o vistas modeladas y 14 conjuntos de índices; lo referencian 2 módulos.',
    source: 'SALUD/Módulos/M01 iam.md',
  },
  // `terminology` queda sin descripción a propósito: ejercita el caso «ningún módulo lo declara».
};

/** La descripción de un schema, o `null` si ningún módulo de la bóveda lo declara. */
export function descripcionDeSchema(schemaName: string): SchemaDescription | null {
  return Object.hasOwn(DESCRIPCIONES, schemaName) ? (DESCRIPCIONES[schemaName] ?? null) : null;
}

interface ObjetoSembrable {
  id: string;
  schemaName: string;
  objectName: string;
  columnas: { name: string; fk?: [string, string] }[];
  ficha: object | null;
  evidencia: Record<string, unknown>[];
  revisiones: Record<string, unknown>[];
}

const PLANTILLA_DEFINICION = 'conditions es un registro central de negocio del módulo 08 · clinical (core clinical record), dominio Clínico y Diagnóstico.';
const PLANTILLA_PROPOSITO = 'Cuando un médico registra un diagnóstico, ese registro usa conditions.';
const PLANTILLA_EXISTENCIA =
  'Si esta tabla se eliminara, el negocio perdería el registro mismo de la historia clínica del paciente y no podría probar qué se diagnosticó ni cuándo.';

/**
 * Siembra una ficha importada de la bóveda en `clinical.conditions` y registra la
 * lectura de la evidencia de columna (la nota de cada clave foránea).
 */
export function registrarNotasDeBoveda(router: MockRouter, objetos: readonly ObjetoSembrable[], ahora: () => string, nuevoId: () => string): void {
  const conditions = objetos.find((o) => o.schemaName === 'clinical' && o.objectName === 'conditions');
  if (conditions) {
    conditions.ficha = {
      id: nuevoId(),
      targetKind: 'OBJECT',
      version: 1,
      reviewStatus: 'DRAFT',
      origin: 'IMPORTED_VAULT',
      currentRevisionNo: 1,
      approvedRevisionNo: null,
      approvedAt: null,
      updatedAt: ahora(),
      autorRevision: '00000000-0000-4000-8000-0000000000a1',
      content: {
        businessName: null,
        definition: PLANTILLA_DEFINICION,
        purpose: PLANTILLA_PROPOSITO,
        existenceRationale: PLANTILLA_EXISTENCIA,
        rowGrain: null,
        alternativesRationale: null,
        processSupported: null,
        sourceOfTruth: null,
        producers: [],
        consumers: [],
        deletionImpact: null,
        businessOwner: null,
        dataSteward: null,
        technicalOwner: null,
        unit: null,
        valueDomain: null,
        nullSemantics: null,
        sensitivity: 'UNKNOWN',
        openQuestions: [
          { field: 'definition', question: 'Texto de plantilla generado por la bóveda: redactar qué es esta tabla para el negocio.' },
          { field: 'purpose', question: 'Texto de plantilla generado por la bóveda: dar un ejemplo concreto de uso real.' },
          { field: 'existenceRationale', question: 'Texto de plantilla generado por la bóveda: redactar por qué hace falta esta tabla y qué se pierde sin ella.' },
        ],
      },
    };
    conditions.revisiones.push({
      revisionNo: 1,
      origin: 'IMPORTED_VAULT',
      submittedStatus: 'DRAFT',
      changeReason: 'Importado de SALUD/Entidades/E clinical.conditions.md (sha256:3f9a1c0be2d4)',
      authorUserId: '00000000-0000-4000-8000-0000000000a1',
      createdAt: ahora(),
    });
    conditions.evidencia.push({
      id: nuevoId(),
      kind: 'VAULT_NOTE',
      reference: 'SALUD/Entidades/E clinical.conditions.md',
      excerpt: 'La tabla declara 14 campos y 6 claves foráneas, con 4 relación(es) saliente(s) y 9 entrante(s) — una entidad de alta conectividad.',
      sourceRevision: 'sha256:3f9a1c0be2d4',
      createdAt: ahora(),
    });
  }

  // El id de columna del simulador es `<id del objeto>-<columna>`; el id de objeto mide 36.
  router.get('/admin/catalog/columns/:id/evidence', (req: MockRequest) => {
    const id = req.params['id'] ?? '';
    const objeto = objetos.find((o) => id.startsWith(`${o.id}-`));
    const columna = objeto?.columnas.find((c) => `${objeto.id}-${c.name}` === id);
    if (!objeto || !columna) return notFound('Columna de catálogo no encontrada');
    if (!columna.fk) return [];
    return [
      {
        id: nuevoId(),
        kind: 'VAULT_NOTE',
        reference: `SALUD/FK/FK ${objeto.schemaName}.${objeto.objectName}.${columna.name}.md`,
        excerpt: `Apunta a → ${columna.fk[0]}.${columna.fk[1]} (convención por nombre)`,
        sourceRevision: 'sha256:7c21d0aa91e3',
        createdAt: ahora(),
      },
    ];
  });
}
