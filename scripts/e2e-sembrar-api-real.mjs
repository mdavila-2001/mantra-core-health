#!/usr/bin/env node
/* ============================================================================
    Inyecta datos de prueba SINTÉTICOS en la API REAL, sólo por sus endpoints
    públicos (nada de SQL directo), para que los kill-tests y las capturas
    corran contra datos que demuestran el flujo de punta a punta.

    Todo lo que crea es sintético y se declara así: nombres «(sintético)»,
    correos @alovida.test, CI con prefijo PW-. Nunca datos de personas reales.

    Uso:
      E2E_API_BASE_URL=http://127.0.0.1:3005 \
      E2E_BOOTSTRAP_ADMIN_EMAIL=... E2E_BOOTSTRAP_ADMIN_PASSWORD=... \
      E2E_ACTOR_PASSWORD=... \
      node scripts/e2e-sembrar-api-real.mjs --etiqueta carril2 --salida <archivo.env>

    Idempotente por etiqueta: con la misma etiqueta reutiliza las cuentas
    (correo y CI fijos) y no vuelve a crear consultas si la médica ya tiene
    las del escenario. Escribe en `--salida` las variables E2E_* que leen los
    kill-tests (`E2E_DOCTOR_EMAIL`, `E2E_PATIENT_EMAIL`, …). Ese archivo lleva
    contraseñas: va al scratchpad, nunca al repo.

    Escenario C-01 (carril 2 · Pablo) que deja sembrado:
      1. Paciente A · consulta con comprobante QR PENDIENTE de revisión.
      2. Paciente B · comprobante en efectivo ACEPTADO → consulta cerrada.
      3. Paciente A · comprobante RECHAZADO con motivo → el cobro sigue pendiente.
      4. Paciente B · consulta en curso sin comprobante → cerrar responde
         422 PAYMENT_REQUIRED (se comprueba y se informa).
    ========================================================================== */

import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opcion = (nombre, porDefecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : porDefecto;
};
const BASE = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3005';
const ETIQUETA = opcion('etiqueta', 'carril2').replace(/[^a-z0-9]/gi, '').toLowerCase();
const SALIDA = opcion('salida', null);
const ADMIN_EMAIL = process.env.E2E_BOOTSTRAP_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_BOOTSTRAP_ADMIN_PASSWORD;
const CLAVE = process.env.E2E_ACTOR_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !CLAVE) {
  console.error('Faltan E2E_BOOTSTRAP_ADMIN_EMAIL, E2E_BOOTSTRAP_ADMIN_PASSWORD o E2E_ACTOR_PASSWORD.');
  process.exit(2);
}
// La «captura» del comprobante: una imagen SINTÉTICA, rotulada «sin validez»,
// legible en grande (scripts/e2e-fixtures/comprobante-sintetico.png).
const PNG = readFileSync(new URL('./e2e-fixtures/comprobante-sintetico.png', import.meta.url));

async function api(metodo, ruta, { token, body, esperado } = {}) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const texto = await r.text();
  let cuerpo;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = texto;
  }
  if (esperado !== undefined && ![esperado].flat().includes(r.status)) {
    throw new Error(`${metodo} ${ruta} → ${r.status}: ${JSON.stringify(cuerpo).slice(0, 300)}`);
  }
  return { status: r.status, body: cuerpo };
}

const login = async (identificador, password) =>
  (await api('POST', '/iam/auth/login', { body: { email: identificador, password }, esperado: 200 })).body.accessToken;

async function primerConcepto(codigo) {
  const vs = await api('GET', `/terminology/value-sets?code=${codigo}`, { esperado: 200 });
  const set = (vs.body.items ?? []).find((i) => i.internalCode === codigo);
  if (!set) throw new Error(`sin value set ${codigo}`);
  const exp = await api('GET', `/terminology/value-sets/${set.id}/$expand`, { esperado: 200 });
  return exp.body.items[0].conceptId;
}

function claims(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

// ---- actores -------------------------------------------------------------

async function medica(adminToken, departamento) {
  const email = `doctora.${ETIQUETA}@alovida.test`;
  try {
    return { email, token: await login(email, CLAVE) };
  } catch {
    /* no existe todavía */
  }
  const alta = await api('POST', '/iam/users/assisted-practitioner-registration', {
    token: adminToken,
    esperado: 201,
    body: {
      email,
      displayName: `Dra. Marisol Quispe (sintética ${ETIQUETA})`,
      licenseNumber: `LIC-PW-${ETIQUETA}`,
      credentialNumber: `CRED-PW-${ETIQUETA}`,
      professionalTitle: 'Médica general',
      reason: `Actor sintético para kill-tests y capturas (${ETIQUETA})`,
      clinicalRoles: ['CLINICIAN', 'PRACTITIONER'],
      nationalId: `PW-${ETIQUETA}-MED`.toUpperCase(),
      issuerAdministrativeAreaConceptId: departamento,
    },
  });
  await api('POST', '/iam/auth/activate', {
    esperado: [200, 201],
    body: { activationToken: alta.body.activationToken, newPassword: CLAVE },
  });
  return { email, token: await login(email, CLAVE) };
}

async function paciente(letra, nombre, departamento, municipio) {
  const nationalId = `PW-${ETIQUETA}-PAC${letra}`.toUpperCase();
  const email = `paciente.${letra.toLowerCase()}.${ETIQUETA}@alovida.test`;
  // El login de la API pide un correo (`isEmail`): el CI no sirve de identificador.
  try {
    return { nationalId, email, token: await login(email, CLAVE) };
  } catch {
    /* no existe todavía */
  }
  await api('POST', '/iam/auth/register-patient', {
    esperado: 201,
    body: {
      nationalId,
      password: CLAVE,
      name: nombre,
      lastName: `Sintética ${letra}`,
      email,
      phone: '+591 70055555',
      sexAtBirth: 'FEMALE',
      birthDate: '1992-03-14',
      residenceMunicipalityConceptId: municipio,
      issuerAdministrativeAreaConceptId: departamento,
    },
  });
  return { nationalId, email, token: await login(email, CLAVE) };
}

// ---- consultorio y consultas ---------------------------------------------

async function consultorio(med) {
  const sitios = await api('GET', `/practitioners/${claims(med.token).hpid}/sites`, { token: med.token });
  let sitio = (sitios.body?.items ?? [])[0];
  if (!sitio) {
    sitio = (
      await api('POST', '/practitioners/me/sites', {
        token: med.token,
        esperado: 201,
        body: { name: `Consultorio sintético ${ETIQUETA}`, timeZone: 'America/La_Paz' },
      })
    ).body;
  }
  const practiceId = sitio.practiceId;
  const catalogo = await api('GET', `/billing/service-catalog?practiceId=${practiceId}`, { token: med.token, esperado: 200 });
  const cita = (catalogo.body.items ?? []).find((i) => i.code === 'CITA_MEDICA');
  if (!cita) {
    await api('POST', '/billing/service-catalog', {
      token: med.token,
      esperado: 201,
      body: { practiceId, code: 'CITA_MEDICA', name: 'Cita médica', defaultPrice: '150.00' },
    });
  } else if (Number(cita.defaultPrice) <= 0) {
    await api('PATCH', `/billing/service-catalog/${cita.id}`, { token: med.token, esperado: 200, body: { defaultPrice: '150.00' } });
  }
  if (!sitio.bankQrFileId) {
    // El QR bancario estático de la sede (D-2): la imagen sintética.
    const qr = await subirCaptura(med);
    await api('PUT', `/practitioners/me/sites/${sitio.id}/bank-qr`, { token: med.token, esperado: 200, body: { fileId: qr } });
  }
  return { practiceId, siteId: sitio.id };
}

async function recurso(med) {
  const c = claims(med.token);
  const existentes = await api('GET', `/scheduling/resources?tenantId=${c.tenants[0]}&resourceType=PRACTITIONER`, { token: med.token });
  const propio = (existentes.body?.items ?? []).find((r) => r.resourceRefId === c.hpid);
  if (propio) return propio.id;
  const r = await api('POST', '/scheduling/resources', {
    token: med.token,
    esperado: 201,
    body: {
      tenantId: c.tenants[0],
      resourceType: 'PRACTITIONER',
      resourceRefType: 'health_practitioner_profiles',
      resourceRefId: c.hpid,
      name: `Agenda sintética ${ETIQUETA}`,
      timeZone: 'America/La_Paz',
      capacity: 1,
    },
  });
  return r.body.id;
}

async function patientProfileIdDe(pac) {
  return claims(pac.token).pid;
}

async function consultaEnCurso(med, resourceId, patientProfileId, cuando, motivo) {
  const c = claims(med.token);
  const directa = await api('POST', '/scheduling/appointments/direct', {
    token: med.token,
    esperado: 201,
    body: { patientProfileId, resourceId, startAt: cuando.toISOString(), durationMinutes: 30, reasonText: motivo },
  });
  // «Iniciar la atención»: la médica queda atendiendo a esa persona, que es lo
  // que le deja escribir y cerrar su historia.
  await api('POST', `/scheduling/bookings/${directa.body.bookingId}/start`, { token: med.token, esperado: 200 });
  const enc = await api('POST', '/clinical/encounters/check-in', {
    token: med.token,
    esperado: 201,
    body: { patientProfileId, tenantId: c.tenants[0], primaryPractitionerId: c.hpid },
  });
  return enc.body.id;
}

async function subirCaptura(pac) {
  const form = new FormData();
  form.append('category', 'IMAGE');
  form.append('sensitivity', 'PHI');
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'comprobante-sintetico.png');
  return (await api('POST', '/common/files/upload', { token: pac.token, body: form, esperado: 201 })).body.id;
}

// ---- corrida ---------------------------------------------------------------

const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
const departamento = await primerConcepto('VS_BO_DEPARTMENT');
const municipio = await primerConcepto('VS_BO_MUNICIPALITY');

const med = await medica(adminToken, departamento);
const pacA = await paciente('A', 'Ana', departamento, municipio);
const pacB = await paciente('B', 'Beatriz', departamento, municipio);
const { practiceId } = await consultorio(med);
const resourceId = await recurso(med);
const idA = await patientProfileIdDe(pacA);
const idB = await patientProfileIdDe(pacB);

const tabla = async () =>
  (await api('GET', '/billing/me/provider-payment-table?limit=100', { token: med.token, esperado: 200 })).body;
const yaSembrado = (await tabla()).items.length >= 4;
const informe = [];

if (!yaSembrado) {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + 7);
  base.setUTCHours(13, 0, 0, 0);
  const hora = (h) => new Date(base.getTime() + h * 3600_000);

  // 1. Pendiente de revisión (QR con captura).
  const c1 = await consultaEnCurso(med, resourceId, idA, hora(0), 'Control de presión (sintético)');
  const f1 = await subirCaptura(pacA);
  const p1 = await api('POST', `/billing/me/charges/${c1}/payment-proofs`, {
    token: pacA.token,
    esperado: 201,
    body: { method: 'QR_TRANSFER', fileId: f1, amountMinor: 15000 },
  });
  informe.push(`1 · ${c1} · QR pendiente (${p1.body.id})`);

  // 2. Efectivo aceptado → consulta cerrada.
  const c2 = await consultaEnCurso(med, resourceId, idB, hora(1), 'Dolor lumbar (sintético)');
  const p2 = await api('POST', `/billing/me/charges/${c2}/payment-proofs`, {
    token: pacB.token,
    esperado: 201,
    body: { method: 'CASH', amountMinor: 15000 },
  });
  await api('POST', `/billing/payment-proofs/${p2.body.id}/accept`, { token: med.token, esperado: 200 });
  await api('POST', `/clinical/encounters/${c2}/close`, { token: med.token, esperado: 200, body: {} });
  informe.push(`2 · ${c2} · efectivo aceptado y consulta cerrada`);

  // 3. Rechazado con motivo → sigue pendiente.
  const c3 = await consultaEnCurso(med, resourceId, idA, hora(2), 'Seguimiento (sintético)');
  const p3 = await api('POST', `/billing/me/charges/${c3}/payment-proofs`, {
    token: pacA.token,
    esperado: 201,
    body: { method: 'CASH', amountMinor: 10000 },
  });
  await api('POST', `/billing/payment-proofs/${p3.body.id}/reject`, {
    token: med.token,
    esperado: 200,
    body: { reason: 'El monto declarado no coincide con la consulta' },
  });
  informe.push(`3 · ${c3} · rechazado con motivo`);

  // 4. Sin comprobante: cerrar responde PAYMENT_REQUIRED.
  const c4 = await consultaEnCurso(med, resourceId, idB, hora(3), 'Consulta sin pagar (sintético)');
  const cierre = await api('POST', `/clinical/encounters/${c4}/close`, { token: med.token, body: {} });
  const ok = cierre.status === 422 && cierre.body?.details?.reason === 'PAYMENT_REQUIRED';
  informe.push(`4 · ${c4} · cerrar sin pago → ${cierre.status} ${cierre.body?.details?.reason ?? ''} ${ok ? '(esperado)' : '(INESPERADO)'}`);
  if (!ok) process.exitCode = 1;
}

const final = await tabla();
const porEstado = final.items.reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] ?? 0) + 1 }), {});
console.log(`Etiqueta: ${ETIQUETA} · práctica ${practiceId}`);
console.log(yaSembrado ? 'Escenario ya sembrado: no se crearon consultas nuevas.' : informe.join('\n'));
console.log(`Tabla del prestador: ${final.items.length} sesiones · por estado ${JSON.stringify(porEstado)}`);

if (SALIDA) {
  writeFileSync(
    SALIDA,
    [
      'E2E_MODE=real',
      `E2E_DOCTOR_EMAIL=${med.email}`,
      `E2E_DOCTOR_PASSWORD=${CLAVE}`,
      `E2E_PATIENT_EMAIL=${pacA.email}`,
      `E2E_PATIENT_PASSWORD=${CLAVE}`,
      `E2E_PATIENT_2_EMAIL=${pacB.email}`,
      `E2E_PATIENT_2_PASSWORD=${CLAVE}`,
      `E2E_ADMIN_EMAIL=${ADMIN_EMAIL}`,
      `E2E_ADMIN_PASSWORD=${ADMIN_PASSWORD}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  console.log(`Credenciales E2E escritas en ${SALIDA} (no versionar).`);
}
