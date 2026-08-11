#!/usr/bin/env node
/**
 * Verifica que la cadena entera funciona: Angular → Collector → Jaeger.
 *
 * Es la comprobación que ninguna prueba unitaria puede dar. Las unitarias usan
 * un exportador en memoria —a propósito: una prueba que necesita red falla por
 * motivos que no son del código— y por eso pueden estar todas en verde con el
 * Collector mal configurado, el endpoint equivocado o Jaeger sin recibir nada.
 *
 * Lo que hace, en orden:
 *
 *   1. Comprueba que Jaeger y el Collector responden.
 *   2. Manda un lote OTLP **por el mismo camino que usaría el navegador**.
 *   3. Espera a que atraviese la tubería.
 *   4. Consulta Jaeger y confirma que la traza llegó, con su servicio.
 *   5. Revisa que no traiga nada que no debería.
 *
 * No inventa éxito: cada paso se afirma contra la respuesta real, y el que no
 * se pudo comprobar se informa como tal en vez de darse por bueno.
 *
 * Uso:
 *   node scripts/verify-angular-tracing.mjs
 *   node scripts/verify-angular-tracing.mjs --endpoint http://localhost:4200/otel/v1/traces
 *
 * Requiere el entorno de observabilidad levantado:
 *   docker compose -f infra/otel-collector/docker-compose.observability.yml up -d
 */

const options = parseArgs(process.argv.slice(2));

/**
 * Por defecto se manda al Collector directo, no a través de la aplicación.
 *
 * Es lo que se puede comprobar sin levantar Angular, y aísla el problema: si
 * esto funciona y el navegador no ve trazas, lo que falla es el reenvío del
 * servidor o la configuración pública — no el Collector ni Jaeger.
 *
 * Con `--endpoint http://localhost:4200/otel/v1/traces` se verifica la cadena
 * completa, incluido el reenvío.
 */
const COLLECTOR = options.collector ?? 'http://localhost:4318';
const ENDPOINT = options.endpoint ?? `${COLLECTOR}/v1/traces`;
const JAEGER = options.jaeger ?? 'http://localhost:16686';
const SERVICE = options.service ?? 'mantra-angular-web-verificacion';

/** Cuánto se espera a que la traza atraviese Collector y Jaeger. */
const PROPAGATION_WAIT_MS = 12_000;

const results = [];
let failed = false;

function record(ok, title, detail) {
  results.push({ ok, title, detail });
  if (!ok) failed = true;
}

/** Identificadores hexadecimales válidos, generados acá porque no hay SDK. */
function hex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function reachable(url, name) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    record(response.ok, `${name} responde`, `${url} → ${response.status}`);
    return response.ok;
  } catch (error) {
    record(false, `${name} responde`, `${url} → ${error.message}`);
    return false;
  }
}

/**
 * Un lote OTLP mínimo pero completo.
 *
 * Lleva los mismos atributos que emitiría el navegador de verdad, y **uno
 * envenenado a propósito**: `url.full` con un token en el query string. El
 * Collector tiene que borrarlo. Si al final aparece en Jaeger, la red de
 * seguridad de privacidad no está funcionando y el script lo dice.
 */
function buildBatch(traceId, spanId) {
  const now = Date.now() * 1e6;

  /**
   * El span dura tres segundos **a propósito**.
   *
   * El Collector aplica muestreo por cola: conserva siempre los errores y lo
   * que pasa de dos segundos, y del resto solo un 10 % (ver
   * `infra/otel-collector/otel-collector.angular.yml`). Un span rápido y
   * correcto caería en ese 10 % y esta verificación fallaría nueve de cada diez
   * veces sin que nada estuviera roto.
   *
   * Una comprobación intermitente es peor que ninguna: la primera vez se
   * investiga, la segunda se vuelve a ejecutar «a ver si pasa», y a la tercera
   * se ignora. Con tres segundos, la política de latencia la conserva siempre —
   * y de paso se comprueba que esa política funciona.
   */
  const DURATION_NS = 3e9;

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            attr('service.name', SERVICE),
            attr('service.namespace', 'mantra'),
            attr('app.framework', 'angular'),
            attr('angular.rendering.mode', 'csr'),
          ],
        },
        scopeSpans: [
          {
            scope: { name: 'verify-angular-tracing' },
            spans: [
              {
                traceId,
                spanId,
                name: 'angular.navigation',
                kind: 1,
                startTimeUnixNano: String(now),
                endTimeUnixNano: String(now + DURATION_NS),
                attributes: [
                  attr('app.route.template', '/auth/verify-email'),
                  attr('angular.navigation.result', 'completed'),
                  // El cebo: esto NO debe sobrevivir al Collector.
                  attr('url.full', 'https://app.example.com/auth/verificar?token=CEBO123456'),
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function attr(key, value) {
  return { key, value: { stringValue: value } };
}

async function main() {
  console.log('· verify-angular-tracing\n');

  const jaegerUp = await reachable(`${JAEGER}/`, 'Jaeger');
  await reachable(`${COLLECTOR.replace(/:\d+$/, ':13133')}/`, 'Collector (health)');

  const traceId = hex(16);
  const spanId = hex(8);

  // --- envío ---------------------------------------------------------------
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildBatch(traceId, spanId)),
      signal: AbortSignal.timeout(10_000),
    });

    record(
      response.ok || response.status === 202,
      'el lote OTLP se acepta',
      `${ENDPOINT} → ${response.status}`,
    );
  } catch (error) {
    record(false, 'el lote OTLP se acepta', `${ENDPOINT} → ${error.message}`);
  }

  if (!jaegerUp) {
    report();
    return;
  }

  // --- espera --------------------------------------------------------------
  process.stdout.write(
    `  esperando ${PROPAGATION_WAIT_MS / 1000} s a que la traza atraviese la tubería…\n`,
  );
  // El muestreo por cola del Collector espera 10 s a que la traza termine antes
  // de decidir. Consultar antes daría un falso negativo.
  await new Promise((resolve) => setTimeout(resolve, PROPAGATION_WAIT_MS));

  // --- consulta ------------------------------------------------------------
  let trace = null;
  try {
    const response = await fetch(`${JAEGER}/api/traces/${traceId}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json();
    trace = body.data?.[0] ?? null;

    record(trace !== null, 'la traza llegó a Jaeger', `trace_id ${traceId}`);
  } catch (error) {
    record(false, 'la traza llegó a Jaeger', error.message);
  }

  if (trace === null) {
    report();
    return;
  }

  // --- servicio ------------------------------------------------------------
  const services = Object.values(trace.processes ?? {}).map((p) => p.serviceName);
  record(
    services.includes(SERVICE),
    'el servicio del frontend aparece',
    `servicios en la traza: ${services.join(', ') || '(ninguno)'}`,
  );

  // --- privacidad ----------------------------------------------------------
  const serialized = JSON.stringify(trace);

  record(
    !serialized.includes('CEBO123456'),
    'el Collector borró el atributo con token en el query string',
    serialized.includes('CEBO123456')
      ? 'ENCONTRADO: revisar attributes/redact y transform/strip-query en ' +
          'infra/otel-collector/otel-collector.angular.yml'
      : 'url.full eliminado',
  );

  record(
    !serialized.includes('url.full'),
    'no viaja ninguna URL completa',
    serialized.includes('url.full') ? 'ENCONTRADO url.full' : 'sin url.full',
  );

  const plantilla = trace.spans?.[0]?.tags?.find((t) => t.key === 'app.route.template');
  record(
    plantilla?.value === '/auth/verify-email',
    'la plantilla de ruta sobrevive intacta',
    `app.route.template = ${plantilla?.value ?? '(ausente)'}`,
  );

  report();
}

function report() {
  console.log('');
  for (const { ok, title, detail } of results) {
    console.log(`  ${ok ? '✓' : '✗'} ${title}`);
    console.log(`      ${detail}`);
  }

  console.log('');
  if (failed) {
    console.error('✗ verify-angular-tracing — la cadena no está completa\n');
    console.error('  Levantá el entorno con:');
    console.error(
      '    docker compose -f infra/otel-collector/docker-compose.observability.yml up -d\n',
    );
    process.exit(1);
  }

  console.log('✓ verify-angular-tracing — Angular → Collector → Jaeger, con privacidad\n');
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (key !== undefined && argv[i + 1] !== undefined) {
      options[key] = argv[i + 1];
    }
  }
  return options;
}

await main();
