/** Auditoría axe WCAG AA para la batería responsive del Carril F. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { lanzar, contexto, entrar, ir, VISTAS, TEMAS, SALIDA } from './lib.mjs';

const vistas = [
  { id: 'auth', ruta: '/auth', espera: '[data-testid="login-identifier"]' },
  { id: 'registro', ruta: '/auth/register', espera: 'main, app-auth-split, h1' },
  { id: 'inicio-paciente', usuario: 'paciente@alovida.mock', ruta: '/dashboard', espera: 'h1' },
  { id: 'inicio-medica', usuario: 'medica@alovida.mock', org: 'Mi consultorio', ruta: '/dashboard', espera: 'h1' },
  { id: 'inicio-farmacia', usuario: 'farmacia@alovida.mock', ruta: '/dashboard', espera: 'h1' },
  { id: 'mi-perfil', usuario: 'paciente@alovida.mock', ruta: '/my-account', espera: 'h1' },
  { id: 'mis-citas', usuario: 'paciente@alovida.mock', ruta: '/my-account/appointments', espera: 'h1' },
  { id: 'agenda-medica', usuario: 'medica@alovida.mock', org: 'Clínica', ruta: '/schedule', espera: 'h1' },
  { id: 'ficha-clinica', usuario: 'medica@alovida.mock', org: 'Clínica', ruta: '/medical-records', espera: 'h1' },
  { id: 'historia-paciente', usuario: 'paciente@alovida.mock', ruta: '/my-account/medical-record', espera: 'h1' },
  { id: 'farmacia-pedidos', usuario: 'farmacia@alovida.mock', ruta: '/administration/pharmacy-orders', espera: 'h1' },
  { id: 'farmacia-inventario', usuario: 'farmacia@alovida.mock', ruta: '/administration/pharmacy-inventory', espera: 'h1' },
  { id: 'resultados', usuario: 'paciente@alovida.mock', ruta: '/my-account/diagnostic-results', espera: 'h1' },
  { id: 'ordenes', usuario: 'paciente@alovida.mock', ruta: '/my-account/diagnostic-orders', espera: 'h1' },
];

async function main() {
  const navegador = await lanzar();
  const resultado = {};
  const grupos = new Map();
  for (const vista of vistas) {
    const clave = `${vista.usuario ?? ''}|${vista.org ?? ''}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), vista]);
  }

  try {
    for (const viewport of VISTAS) {
      for (const tema of TEMAS) {
        for (const [, pantallas] of grupos) {
          const ctx = await contexto(navegador, {
            ancho: viewport.ancho,
            alto: viewport.alto,
            tema,
          });
          const page = await ctx.newPage();
          try {
            const primera = pantallas[0];
            if (primera.usuario) {
              await entrar(page, primera.usuario, { organizacion: primera.org });
            }
            for (const pantalla of pantallas) {
              const key = `${pantalla.id}|${viewport.id}|${tema}`;
              try {
                await ir(page, pantalla.ruta, pantalla.espera);
                await page.addScriptTag({ path: join(process.cwd(), 'node_modules/axe-core/axe.min.js') });
                const axe = await page.evaluate(async () => window.axe.run(document, {
                  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
                }));
                resultado[key] = axe.violations.map((v) => ({
                  id: v.id,
                  impact: v.impact,
                  nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
                }));
              } catch (error) {
                resultado[key] = { fallo: String(error).slice(0, 200) };
              }
            }
          } finally {
            await ctx.close();
          }
        }
      }
    }
  } finally {
    await navegador.close();
  }

  mkdirSync(SALIDA, { recursive: true });
  const archivo = join(SALIDA, 'auditoria-axe.json');
  writeFileSync(archivo, JSON.stringify(resultado, null, 2));
  const fallos = Object.entries(resultado).filter(([, v]) => !Array.isArray(v));
  const violaciones = Object.entries(resultado).flatMap(([pantalla, v]) =>
    Array.isArray(v) ? v.map((x) => ({ pantalla, ...x })) : [],
  );
  const resumen = {
    auditadas: Object.keys(resultado).length,
    errores: fallos.length,
    violaciones: violaciones.length,
    reglas: [...new Set(violaciones.map((v) => v.id))],
  };
  console.log(JSON.stringify(resumen, null, 2));
  if (fallos.length || violaciones.length) process.exitCode = 1;
}

main();
