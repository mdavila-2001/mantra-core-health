#!/usr/bin/env node
/**
 * Un paciente sintético **con huella propia** en el hospital de `sembrado.json`,
 * sólo por la API (la vía que reconoce `isPatientInTenant`: una reserva de turno
 * hecha por el propio paciente). La base sólo se LEE (ids de dos conceptos de
 * terminología que pide el alta pública de paciente).
 *
 *   ADMIN_PASSWORD=… STAFF_PASSWORD=… node docs/refactor-profesional/trabajo/evidencias/infra-f2f3/real-api/sembrar-paciente.mjs
 *
 * 1. Un consultorio (F1, dueña) y su recurso agendable de tipo ROOM (POST /scheduling/resources, admin de catálogo).
 * 2. Plantilla de todos los días (POST /scheduling/resources/:id/templates) y slots (POST /scheduling/templates/:id/generate-slots).
 * 3. Alta pública de paciente (POST /iam/auth/register-patient) y su login.
 * 4. Con el token del paciente (sin `X-Tenant-Id`: todavía no es del hospital): hold (POST /scheduling/slots/:id/holds) y solicitud (POST /scheduling/holds/:token/request).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API ?? 'http://localhost:3000';
const PASS = process.env.STAFF_PASSWORD;
if (!PASS) throw new Error('Falta STAFF_PASSWORD');
const aqui = dirname(fileURLToPath(import.meta.url));
const s = JSON.parse(readFileSync(join(aqui, 'sembrado.json'), 'utf8'));
const log = [];
const leer = (q) => execFileSync('docker', ['exec', 'mantra-redesa-postgres-1', 'psql', '-U', 'mantra', '-d', 'alovida', '-At', '-c', q], { encoding: 'utf8' }).trim();

async function call(method, path, { token, tenant, body, expect = [200, 201] } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(tenant ? { 'X-Tenant-Id': tenant } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  log.push({ method, path, status: res.status, requestId: res.headers.get('x-request-id') });
  if (!expect.includes(res.status)) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
const login = async (body) => (await call('POST', '/iam/auth/login', { body })).accessToken;

// El recurso agendable lo crea un administrador de catálogo (`CatalogAccess.assertMayCreateResource`):
// la dueña del hospital responde 403 ROLE_INSUFFICIENT, así que va el admin de plataforma.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) throw new Error('Falta ADMIN_PASSWORD');
const admin = await login({ email: process.env.ADMIN_EMAIL ?? 'admin@alovidasalud.com', password: ADMIN_PASSWORD });
const como = { token: admin, tenant: s.hospital };
// Un consultorio (la habitación de internación no es agendable: 422 SPACE_NOT_SCHEDULABLE), por F1 y con la dueña.
const duena = await login({ email: s.duena.email, password: PASS });
const consultorio = s.consultorio ?? (await call('POST', `/sites/${s.sede}/care-spaces`, { token: duena, tenant: s.hospital, body: { code: `CON-${s.tag}`, name: 'Consultorio de admisión', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_CONSULTING_ROOM', parentSpaceId: s.edificio, activate: true, areaM2: 12 } })).id;
s.consultorio = consultorio;
writeFileSync(join(aqui, 'sembrado.json'), JSON.stringify(s, null, 2));
// Idempotente: si el consultorio ya tiene recurso (409 RESOURCE_ALREADY_EXISTS_FOR_SPACE) se reusa, igual que su plantilla.
const listar = (x) => (Array.isArray(x) ? x : (x?.items ?? []));
let recurso = listar(await call('GET', `/scheduling/resources?tenantId=${s.hospital}`, como)).find((r) => r.resourceRefId === consultorio);
recurso ??= await call('POST', '/scheduling/resources', { ...como, body: { tenantId: s.hospital, resourceType: 'ROOM', resourceRefType: 'care_spaces', resourceRefId: consultorio, name: `Consultorio de admisión ${s.tag}`, practiceId: s.practica, timeZone: 'America/La_Paz', capacity: 1 } });
const reglas = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '00:00:00', endTime: '23:30:00', slotMinutes: 30, capacityPerSlot: 1 }));
const plantilla = listar(await call('GET', `/scheduling/resources/${recurso.id}/templates`, como))[0] ?? (await call('POST', `/scheduling/resources/${recurso.id}/templates`, { ...como, body: { name: `Admisión ${s.tag}`, rules: reglas, slotMinutes: 30 } }));
const desde = new Date(Date.now() + 2 * 3_600_000);
const hasta = new Date(Date.now() + 2 * 86_400_000);
await call('POST', `/scheduling/templates/${plantilla.id}/generate-slots`, { ...como, body: { from: desde.toISOString(), to: hasta.toISOString() } });

const municipio = leer("select id from terminology.catalog_concepts where code like 'geo:bo:municipality:%' order by code limit 1");
const departamento = leer("select m.concept_id from terminology.value_set_members m join terminology.value_set_versions v on v.id = m.value_set_version_id join terminology.value_sets vs on vs.id = v.value_set_id where vs.internal_code = 'VS_BO_DEPARTMENT' and v.is_default and m.included order by m.ordinal limit 1");
const nationalId = `SIN${Date.now().toString().slice(-7)}`;
await call('POST', '/iam/auth/register-patient', {
  body: { nationalId, password: PASS, name: 'Paciente', lastName: `Sintético ${s.tag}`, displayName: `Paciente Sintético ${s.tag}`, email: `pac-${nationalId.toLowerCase()}@example.test`, birthDate: '1985-03-14', phone: '+591 70000001', sexAtBirth: 'FEMALE', residenceMunicipalityConceptId: municipio, issuerAdministrativeAreaConceptId: departamento },
});
const tokenPaciente = await login({ nationalId, password: PASS });
const claims = JSON.parse(Buffer.from(tokenPaciente.split('.')[1], 'base64url').toString('utf8'));
const patientProfileId = claims.pid;
console.error('claims', JSON.stringify({ tenants: claims.tenants, tid: claims.tid, roles: claims.roles }));

const slots = await call('GET', `/scheduling/resources/${recurso.id}/slots?from=${encodeURIComponent(desde.toISOString())}&to=${encodeURIComponent(hasta.toISOString())}`, { token: tokenPaciente });
const lista = Array.isArray(slots) ? slots : (slots.items ?? []);
// Un cupo al azar: una corrida anterior pudo dejar retenido el primero.
const libres = lista.filter((x) => x.available !== false);
const slot = libres[Math.floor(Math.random() * libres.length)];
if (!slot) throw new Error(`sin slots: ${JSON.stringify(slots).slice(0, 300)}`);
const hold = await call('POST', `/scheduling/slots/${slot.id}/holds`, { token: tokenPaciente, body: { patientProfileId } });
// El paciente **solicita** (autoservicio); confirmar es del mostrador (403 TENANT_SCOPE_CONFLICT para el paciente).
const reserva = await call('POST', `/scheduling/holds/${hold.holdToken ?? hold.token}/request`, { token: tokenPaciente, body: { tenantId: s.hospital, patientProfileId, channel: 'PORTAL', reasonText: 'Control previo a la internación' } });

s.paciente = { nationalId, patientProfileId, recursoId: recurso.id, bookingId: reserva.id ?? reserva.bookingId ?? null };
s.logPaciente = log;
writeFileSync(join(aqui, 'sembrado.json'), JSON.stringify(s, null, 2));
console.log(JSON.stringify(s.paciente));
