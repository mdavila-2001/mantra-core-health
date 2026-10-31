#!/usr/bin/env node
/**
 * Datos de la prueba F2/F3 contra la API real, creados **sólo por la API**
 * (nunca SQL). Repetible: cada corrida usa una etiqueta nueva.
 *
 *   API=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… STAFF_PASSWORD=… \
 *     node docs/refactor-profesional/trabajo/evidencias/infra-f2f3/real-api/sembrar.mjs
 *
 * Escribe `sembrado.json` (ids y correos; sin tokens ni contraseñas).
 *
 * 1. Hospital: POST /iam/auth/register-organization (tenantType HOSPITAL) y login de la dueña.
 * 2. Práctica (POST /practices, admin de plataforma) y sede (POST /practices/:id/sites).
 * 3. Estructura de F1: edificio, habitación, 3 camas en bloque, unidad dueña (POST /care-spaces/:id/unit-assignments).
 * 4. Personal: una cuenta por rol (register-organization crea la cuenta), membresía STAFF
 *    en el hospital (POST /tenants/:id/memberships, dueña) y asignación operativa de sede
 *    (POST /org/:membershipId/user-assignments, admin de plataforma).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@alovidasalud.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PASS = process.env.STAFF_PASSWORD;
if (!ADMIN_PASSWORD || !PASS) throw new Error('Faltan ADMIN_PASSWORD y STAFF_PASSWORD en el entorno');
const COUNTRY_BO = '9294e8fb-a776-5c37-b868-229e5794f401';
const JUR_SCZ = '65925074-d0ea-5aa6-9e7e-11abf90e0b4f';
const tag = `W${Date.now().toString(36).toUpperCase()}`;
const log = [];

async function call(method, path, { token, tenant, body, expect = [200, 201] } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(tenant ? { 'X-Tenant-Id': tenant } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  log.push({ method, path, status: res.status, requestId: res.headers.get('x-request-id') });
  if (!expect.includes(res.status)) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 400)}`);
  return json;
}
const login = async (email, password) => (await call('POST', '/iam/auth/login', { body: { email, password } })).accessToken;

async function cuenta(sufijo, nombre) {
  const email = `${tag.toLowerCase()}-${sufijo}@example.test`;
  const r = await call('POST', '/iam/auth/register-organization', {
    body: {
      organization: { code: `${tag}_${sufijo.toUpperCase()}`.replace(/[^A-Z0-9_]/g, '_'), legalName: `${nombre} ${tag}`, tenantType: 'HOSPITAL', countryConceptId: COUNTRY_BO, jurisdictionConceptId: JUR_SCZ },
      owner: { email, password: PASS, name: nombre, lastName: tag },
    },
  });
  return { email, userId: r.ownerUserId, tenantId: r.tenantId };
}

const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
const duena = await cuenta('duena', 'Hospital');
const tokenDuena = await login(duena.email, PASS);
const hospital = duena.tenantId;
const practica = await call('POST', '/practices', { token: admin, body: { tenantId: hospital, code: `P-${tag}`, name: `Hospital ${tag}`, timeZone: 'America/La_Paz' } });
const sede = await call('POST', `/practices/${practica.id}/sites`, { token: tokenDuena, tenant: hospital, body: { code: `S-${tag}`, name: `Sede ${tag}` } });
const como = { token: tokenDuena, tenant: hospital };
const edificio = await call('POST', `/sites/${sede.id}/care-spaces`, { ...como, body: { code: `ED-${tag}`, name: 'Edificio central', formCode: 'LOC_FORM_BUILDING', functionCode: 'SPACE_FN_BUILDING_GENERIC', activate: true } });
const habitacion = await call('POST', `/sites/${sede.id}/care-spaces`, { ...como, body: { code: `H1-${tag}`, name: 'Habitación 1', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_INPATIENT_ROOM', parentSpaceId: edificio.id, activate: true, areaM2: 20 } });
const camas = await call('POST', `/sites/${sede.id}/care-spaces/bulk`, { ...como, body: { parentSpaceId: habitacion.id, formCode: 'LOC_FORM_BED', functionCode: 'SPACE_FN_BED_STANDARD', codePattern: `C${tag.slice(-4)}-{A..C}`, namePattern: 'Cama {}', censable: true, activate: true } });
const unidad = await call('POST', `/sites/${sede.id}/clinical-units`, { ...como, body: { code: `U-${tag}`, name: `Medicina interna ${tag}` } });
for (const c of camas.created) await call('POST', `/care-spaces/${c.id}/unit-assignments`, { ...como, body: { clinicalUnitId: unidad.id, roleCode: 'SPACE_UNIT_ROLE_OWNER' } });

const personal = {};
for (const [clave, rol] of [['enfermeria', 'NURSE'], ['supervision', 'NURSE_SUPERVISOR'], ['admision', 'ADMISSION'], ['limpieza', 'HOUSEKEEPING'], ['suplimpieza', 'HOUSEKEEPING_SUPERVISOR'], ['mantenimiento', 'MAINTENANCE']]) {
  const c = await cuenta(clave, rol);
  const m = await call('POST', `/tenants/${hospital}/memberships`, { ...como, body: { userId: c.userId, role: 'STAFF' } });
  const roles = rol === 'NURSE_SUPERVISOR' ? ['NURSE', 'NURSE_SUPERVISOR'] : rol === 'HOUSEKEEPING_SUPERVISOR' ? ['HOUSEKEEPING', 'HOUSEKEEPING_SUPERVISOR'] : [rol];
  for (const r of roles) await call('POST', `/org/${m.id}/user-assignments`, { token: admin, body: { role: r, accessScope: 'SITE', practiceId: practica.id, practiceSiteId: sede.id } });
  personal[clave] = { email: c.email, userId: c.userId, membershipId: m.id, roles };
}

const salida = { tag, api: API, hospital, duena: { email: duena.email, userId: duena.userId }, practica: practica.id, sede: sede.id, unidad: unidad.id, edificio: edificio.id, habitacion: habitacion.id, camas: camas.created.map((c) => ({ id: c.id, code: c.code })), personal, log };
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sembrado.json'), JSON.stringify(salida, null, 2));
console.log(JSON.stringify({ tag, hospital, sede: sede.id, camas: salida.camas.map((c) => c.code) }));
