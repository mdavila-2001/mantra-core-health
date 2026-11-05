// Doble HTTP de la API para la verificación en navegador. NO es la API real:
// implementa el login mínimo y POST /telemetry/activity-events validando el
// contrato de CaptureActivityEventsDto (lista blanca de claves, tipos, 1..500).
import { createServer } from 'node:http';
import { appendFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const SALIDA = process.argv[2];
writeFileSync(SALIDA, '');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = () =>
  `${b64({ alg: 'HS256' })}.${b64({
    sub: '11111111-1111-4111-8111-111111111111',
    roles: ['PATIENT'],
    tenants: ['22222222-2222-4222-8222-222222222222'],
    name: 'Paciente Sintético',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.firma`;

const EVENTO = new Set(['eventSchemaDefinitionId', 'eventName', 'eventIdempotencyKey', 'analyticsSubjectId', 'userId', 'sessionId', 'sessionJourneyId', 'tenantId', 'portalTypeConceptId', 'routeTemplate', 'occurredAt', 'correlationId', 'properties']);
const PROP = new Set(['propertyName', 'valueType', 'valueString', 'valueNumber', 'valueBoolean', 'dataClassificationConceptId']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const vistas = new Set();

function validar(body) {
  const errores = [];
  if (!Array.isArray(body?.events) || body.events.length < 1 || body.events.length > 500) errores.push('events 1..500');
  for (const [i, e] of (body?.events ?? []).entries()) {
    for (const k of Object.keys(e)) if (!EVENTO.has(k)) errores.push(`events.${i}.${k} no permitido`);
    if (!UUID.test(e.eventSchemaDefinitionId ?? '')) errores.push(`events.${i}.eventSchemaDefinitionId`);
    for (const k of ['userId', 'sessionId', 'tenantId']) if (e[k] !== undefined && !UUID.test(e[k])) errores.push(`events.${i}.${k} uuid`);
    if (typeof e.routeTemplate === 'string' && e.routeTemplate.length > 300) errores.push(`events.${i}.routeTemplate>300`);
    if (Number.isNaN(Date.parse(e.occurredAt))) errores.push(`events.${i}.occurredAt`);
    for (const [j, p] of (e.properties ?? []).entries()) {
      for (const k of Object.keys(p)) if (!PROP.has(k)) errores.push(`events.${i}.properties.${j}.${k}`);
      if (p.valueString !== undefined && (typeof p.valueString !== 'string' || p.valueString.length > 4000)) errores.push('valueString');
      if (p.valueNumber !== undefined && typeof p.valueNumber !== 'number') errores.push('valueNumber');
      if (p.valueBoolean !== undefined && typeof p.valueBoolean !== 'boolean') errores.push('valueBoolean');
    }
  }
  return errores;
}

createServer((req, res) => {
  let datos = '';
  req.on('data', (c) => (datos += c));
  req.on('end', () => {
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const url = req.url.split('?')[0];
    console.log(new Date().toISOString(), req.method, url);
    if (req.method === 'POST' && (url === '/iam/auth/login' || url === '/iam/auth/token/refresh')) {
      return json(200, { accessToken: token(), refreshToken: randomUUID(), expiresAt: new Date(Date.now() + 3600e3).toISOString() });
    }
    if (req.method === 'POST' && url === '/telemetry/activity-events') {
      if (!/^Bearer /.test(req.headers.authorization ?? '')) return json(401, { code: 'UNAUTHENTICATED' });
      let body;
      try { body = JSON.parse(datos); } catch { return json(400, { code: 'VALIDATION_ERROR' }); }
      const errores = validar(body);
      // Idempotencia como la API: una clave ya vista se cuenta en skipped.
      let skipped = 0;
      const ids = [];
      for (const e of body.events ?? []) {
        if (vistas.has(e.eventIdempotencyKey)) { skipped += 1; continue; }
        vistas.add(e.eventIdempotencyKey);
        ids.push(randomUUID());
      }
      appendFileSync(SALIDA, JSON.stringify({ en: new Date().toISOString(), auth: 'Bearer ***', errores, skipped, body }) + '\n');
      if (errores.length) return json(400, { code: 'VALIDATION_ERROR', details: errores });
      return json(201, { inserted: ids.length, skipped, eventIds: ids });
    }
    return json(404, { code: 'NOT_FOUND', message: 'doble: sin manejador' });
  });
}).listen(3000, () => console.log('doble de API en :3000'));
