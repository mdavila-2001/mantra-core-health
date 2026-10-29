import { PRACTICE_CONSULTORIO, PRACTICE_SANLUCAS, SITIO_CONSULTORIO, SITIO_OLIVOS, SITIO_SANLUCAS } from '../fixtures/agenda';
import { SPECIALTY, displayOf } from '../fixtures/concepts';
import { PROFESSIONALS } from '../fixtures/people';
import { isoDia, uuid } from '../mock-store';
import { QUIROFANO } from './procedures.handlers';

/* ============================================================================
    La consola de la organización médica (`GET /practices/:id/organization`).
    Vive aparte de `practice.handlers.ts` para que ese archivo no crezca: es el
    árbol completo de una práctica, con los códigos de concepto de la API.
    ========================================================================== */

function concepto(code: string, display: string) {
  return { code, display };
}

/** Lo que la consola necesita de una práctica y de un servicio del catálogo. */
interface PracticaBase {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}
interface ServicioBase {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export function consolaDeLaOrganizacion(practica: PracticaBase, catalogo: readonly ServicioBase[]) {
  const esHospital = practica.id === PRACTICE_SANLUCAS;
  const sitio = esHospital ? SITIO_SANLUCAS : practica.id === PRACTICE_CONSULTORIO ? SITIO_CONSULTORIO : SITIO_OLIVOS;
  const idAnexo = uuid('site-sanlucas-norte');

  /* Los códigos de concepto son los que emite la API (`practice.concepts.ts`):
     la pantalla pinta el badge por **código**, y con códigos inventados
     (`ACTIVE`, `OPERATIONAL`) todo caía en `info`. */
  const sedesBase = [
    { id: sitio.id, code: sitio.code, name: sitio.name, type: concepto('SITE_TYPE_HOSPITAL', 'Sede principal'), physicalType: concepto('SITE_PHYS_BUILDING', 'Edificio'), operationalStatus: concepto('SITE_OP_PLANNED', 'Planificada'), status: concepto('SITE_ACTIVE', 'Activa'), timeZone: 'America/La_Paz', branchId: null },
    ...(esHospital ? [{ id: idAnexo, code: 'SANLUCAS-N', name: 'Hospital San Lucas · Anexo Norte', type: concepto('SITE_TYPE_OFFICE', 'Sucursal'), physicalType: concepto('SITE_PHYS_BUILDING', 'Edificio'), operationalStatus: concepto('SITE_OP_CLOSED', 'Cerrada'), status: concepto('SITE_RETIRED', 'Retirada'), timeZone: 'America/La_Paz', branchId: null }] : []),
  ];
  const unidadesBase = [
    { code: 'CARDIO', name: 'Cardiología', esp: SPECIALTY['CARDIOLOGIA']!, siteId: sitio.id },
    { code: 'MEDINT', name: 'Medicina interna', esp: SPECIALTY['MEDICINA_INTERNA']!, siteId: sitio.id },
    { code: 'PEDIA', name: 'Pediatría', esp: SPECIALTY['PEDIATRIA']!, siteId: sitio.id },
    ...(esHospital
      ? [
          { code: 'URG', name: 'Urgencias', esp: SPECIALTY['MEDICINA_GENERAL']!, siteId: sitio.id },
          { code: 'QX', name: 'Quirófanos', esp: SPECIALTY['ANESTESIOLOGIA']!, siteId: sitio.id },
          { code: 'GINE', name: 'Maternidad', esp: SPECIALTY['GINECOLOGIA_OBSTETRICIA']!, siteId: sitio.id },
          { code: 'CEN', name: 'Consulta externa Norte', esp: SPECIALTY['MEDICINA_GENERAL']!, siteId: idAnexo },
        ]
      : []),
  ];
  const unidades = unidadesBase.map((u, i) => ({
    id: uuid(`unit-${practica.code}-${u.code}`),
    siteId: u.siteId,
    parentUnitId: null,
    code: u.code,
    name: u.name,
    type: concepto('UNIT_TYPE_DEPT', 'Departamento'),
    specialty: concepto(u.code, displayOf(u.esp)),
    serviceMode: concepto(i % 2 === 0 ? 'OUTPATIENT' : 'INPATIENT', i % 2 === 0 ? 'Ambulatorio' : 'Internación'),
    // El anexo está retirado: lo que cuelga de él también.
    status: u.siteId === idAnexo ? concepto('UNIT_RETIRED', 'Retirada') : concepto('UNIT_ACTIVE', 'Activa'),
  }));
  /* Los quirófanos son los de `procedures.handlers.ts`: mismos ids, para que
     un caso quirúrgico programado en el «Quirófano 1» se encuentre acá. */
  const espacios = unidades.flatMap((u, i) => {
    const retirado = u.status.code === 'UNIT_RETIRED';
    const estado = retirado ? concepto('SPACE_RETIRED', 'Retirado') : concepto('SPACE_ACTIVE', 'Activo');
    const disponible = (cerrado: boolean) => (retirado || cerrado ? concepto('SPACE_OP_CLOSED', 'Cerrado') : concepto('SPACE_OP_AVAILABLE', 'Disponible'));
    if (u.code === 'QX') {
      return [QUIROFANO.Q1, QUIROFANO.Q2].map((id, n) => ({ id, siteId: u.siteId, clinicalUnitId: u.id, parentSpaceId: null, code: `QX-${n + 1}`, name: `Quirófano ${n + 1}`, type: concepto('SPACE_TYPE_OR', 'Quirófano'), capacity: 1, operationalStatus: disponible(n === 1), status: estado }));
    }
    return [
      { id: uuid(`space-${u.id}-1`), siteId: u.siteId, clinicalUnitId: u.id, parentSpaceId: null, code: `${u.code}-C1`, name: `Consultorio ${i + 1}`, type: concepto('SPACE_TYPE_ROOM', 'Consultorio'), capacity: 1, operationalStatus: disponible(false), status: estado },
      { id: uuid(`space-${u.id}-2`), siteId: u.siteId, clinicalUnitId: u.id, parentSpaceId: null, code: `${u.code}-C2`, name: `Consultorio ${i + 1}B`, type: concepto('SPACE_TYPE_ROOM', 'Consultorio'), capacity: 1, operationalStatus: disponible(i === 2), status: estado },
    ];
  });
  /* Los recuentos de la sede se **derivan** de lo que la misma respuesta
     lista: antes eran cifras fijas (6/24 y 2/6) que no coincidían con las
     filas de las pestañas «Áreas» e «Infraestructura». */
  const sitios = sedesBase.map((sede) => ({
    ...sede,
    clinicalUnitCount: unidades.filter((u) => u.siteId === sede.id).length,
    careSpaceCount: espacios.filter((e) => e.siteId === sede.id).length,
  }));
  // La plantilla y los servicios cuelgan de la sede principal: sólo se les
  // reparten las áreas de esa sede (el anexo tiene la suya).
  const unidadesPrincipales = unidades.filter((u) => u.siteId === sitio.id);
  const personal = PROFESSIONALS.filter((p) => (esHospital ? p.organizacion === 'Hospital San Lucas' : p.organizacion === 'Clínica Los Olivos')).map((p, i) => ({
    id: uuid(`staff-${practica.code}-${p.id}`),
    practitionerProfileId: p.id,
    practitionerName: p.displayName,
    siteId: sitio.id,
    clinicalUnitId: unidadesPrincipales[i % unidadesPrincipales.length]!.id,
    healthcareServiceId: null,
    role: concepto(i === 0 ? 'HEAD' : 'STAFF', i === 0 ? 'Jefe/a de servicio' : 'Médico/a de planta'),
    specialty: p.especialidades[0] === undefined ? null : concepto('SP', displayOf(p.especialidades[0])),
    isPrimary: i === 0,
    validFrom: isoDia(-900 + i * 30),
    // El último vínculo ya terminó: el estado y la vigencia dicen lo mismo.
    validTo: i === 3 ? isoDia(-30) : null,
    status: i === 3 ? concepto('ROLE_ASG_ENDED', 'Finalizado') : concepto('ROLE_ASG_ACTIVE', 'Activo'),
  }));
  return {
    organization: {
      id: practica.id,
      code: practica.code,
      name: practica.name,
      type: concepto(esHospital ? 'PR_TYPE_HOSPITAL' : 'PR_TYPE_CLINIC', esHospital ? 'Hospital' : 'Clínica'),
      status: concepto('PR_ACTIVE', 'Activa'),
      timeZone: 'America/La_Paz',
      currency: concepto('BOB', 'Boliviano'),
    },
    sites: sitios,
    clinicalUnits: unidades,
    careSpaces: espacios,
    healthcareServices: catalogo.slice(0, 6).map((s, i) => ({
      id: uuid(`hs-${s.id}`),
      siteId: sitio.id,
      clinicalUnitId: unidadesPrincipales[i % unidadesPrincipales.length]!.id,
      service: concepto(s.code, s.name),
      specialty: concepto('CARDIO', 'Cardiología'),
      referralRequired: i % 3 === 0,
      appointmentRequired: true,
      telehealthAvailable: s.code === 'TELE-CARDIO',
      status: i === 5 ? concepto('SVC_SUSPENDED', 'Suspendido') : concepto('SVC_ACTIVE', 'Activo'),
    })),
    staff: personal,
    legalDocuments: [
      { id: uuid(`doc-lic-${practica.code}`), siteId: sitio.id, type: concepto('LICENSE', 'Licencia de funcionamiento'), number: `LF-${practica.code}-2024`, issuerName: 'SEDES Santa Cruz', evidenceFileId: uuid('file-licencia'), validFrom: isoDia(-400), validTo: isoDia(330), daysToExpiry: 330, verificationStatus: concepto('ACCRED_VERIFIED', 'Verificado') },
      { id: uuid(`doc-nit-${practica.code}`), siteId: null, type: concepto('TAX_ID', 'NIT'), number: '1023456019', issuerName: 'Impuestos Nacionales', evidenceFileId: null, validFrom: isoDia(-2000), validTo: null, daysToExpiry: null, verificationStatus: concepto('ACCRED_VERIFIED', 'Verificado') },
      { id: uuid(`doc-bio-${practica.code}`), siteId: sitio.id, type: concepto('BIOSAFETY', 'Certificado de bioseguridad'), number: `BIO-${practica.code}`, issuerName: 'Gobierno Autónomo Municipal', evidenceFileId: null, validFrom: isoDia(-350), validTo: isoDia(15), daysToExpiry: 15, verificationStatus: concepto('ACCRED_PENDING', 'Por renovar') },
    ],
    inventory: [
      { id: uuid(`inv-1-${practica.code}`), name: 'Guantes de nitrilo (caja x100)', lotNumber: 'L-2409', expiryDate: isoDia(400), quantityOnHand: '48', unit: concepto('BOX', 'Caja'), reorderLevel: '20', belowReorderLevel: false, status: concepto('INV_ACTIVE', 'Disponible') },
      { id: uuid(`inv-2-${practica.code}`), name: 'Electrodos para ECG', lotNumber: 'E-1102', expiryDate: isoDia(120), quantityOnHand: '12', unit: concepto('PACK', 'Paquete'), reorderLevel: '15', belowReorderLevel: true, status: concepto('INV_ACTIVE', 'Disponible') },
      { id: uuid(`inv-3-${practica.code}`), name: 'Alcohol en gel 500 ml', lotNumber: 'A-0871', expiryDate: isoDia(25), quantityOnHand: '30', unit: concepto('UNIT', 'Unidad'), reorderLevel: '10', belowReorderLevel: false, status: concepto('INV_ACTIVE', 'Disponible') },
      { id: uuid(`inv-4-${practica.code}`), name: 'Jeringas 5 ml', lotNumber: 'J-3340', expiryDate: isoDia(700), quantityOnHand: '4', unit: concepto('BOX', 'Caja'), reorderLevel: '8', belowReorderLevel: true, status: concepto('INV_ACTIVE', 'Disponible') },
    ],
  };
}
