/**
 * Captura por pantalla del Carril F: `node playwright/carril-f/pantallas.mjs <antes|despues> [filtro]`
 * Cada pantalla se fotografía a 1440 y 390, en claro y oscuro, y se audita el
 * texto visible (ISO, uuid, coordenadas, desborde horizontal). Resultado en
 * `evidencias/carril-f-2026-10-12/<fase>/` + `auditoria-<fase>.json`.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { lanzar, contexto, entrar, ir, capturar, auditarCrudos, VISTAS, TEMAS, SALIDA } from './lib.mjs';

const fase = process.argv[2] ?? 'antes';
const filtro = process.argv[3];

/** `usuario` null = sin sesión. `esperar` = selector que prueba que la pantalla pintó. */
export const PANTALLAS = [
  { id: '01-auth', usuario: null, ruta: '/auth', esperar: '[data-testid="login-identifier"]' },
  { id: '02-registro', usuario: null, ruta: '/auth/register', esperar: 'main, app-auth-split, h1' },
  { id: '03-inicio-paciente', usuario: 'paciente@alovida.mock', ruta: '/dashboard', esperar: 'h1' },
  { id: '04-inicio-medica', usuario: 'medica@alovida.mock', org: 'Mi consultorio', ruta: '/dashboard', esperar: 'h1' },
  { id: '05-inicio-farmacia', usuario: 'farmacia@alovida.mock', ruta: '/dashboard', esperar: 'h1' },
  { id: '06-mi-perfil', usuario: 'paciente@alovida.mock', ruta: '/my-account', esperar: 'h1' },
  { id: '07-mis-citas', usuario: 'paciente@alovida.mock', ruta: '/my-account/appointments', esperar: 'h1' },
  { id: '08-agenda-medica', usuario: 'medica@alovida.mock', org: 'Clínica', ruta: '/schedule', esperar: 'h1' },
  { id: '09-ficha-clinica-medica', usuario: 'medica@alovida.mock', org: 'Clínica', ruta: '/medical-records', esperar: 'h1' },
  { id: '15-ficha-paciente-medica', usuario: 'medica@alovida.mock', org: 'Clínica', ruta: '/medical-records/c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0', esperar: '.tabs__list' },
  { id: '10-historia-paciente', usuario: 'paciente@alovida.mock', ruta: '/my-account/medical-record', esperar: 'h1' },
  { id: '11-farmacia-pedidos', usuario: 'farmacia@alovida.mock', ruta: '/administration/pharmacy-orders', esperar: 'h1' },
  { id: '12-farmacia-inventario', usuario: 'farmacia@alovida.mock', ruta: '/administration/pharmacy-inventory', esperar: 'h1' },
  { id: '13-resultados', usuario: 'paciente@alovida.mock', ruta: '/my-account/diagnostic-results', esperar: 'h1' },
  { id: '14-ordenes', usuario: 'paciente@alovida.mock', ruta: '/my-account/diagnostic-orders', esperar: 'h1' },
];

async function main() {
  // Tras editar, `ng serve` recompila: sin esta espera la primera captura sale con el estado viejo.
  if (fase === 'despues') await new Promise((r) => setTimeout(r, Number(process.env.ESPERA_MS ?? 25_000)));
  mkdirSync(`${SALIDA}/${fase}`, { recursive: true });
  const navegador = await lanzar();
  const auditoria = {};
  const lista = PANTALLAS.filter((p) => !filtro || filtro.split(',').some((f) => p.id.includes(f)));
  // SOLO=1440-claro,390-oscuro limita las variantes (para iterar rápido).
  const solo = process.env.SOLO?.split(',');
  // Se agrupa por (usuario, org) para iniciar sesión una vez por contexto.
  const grupos = new Map();
  for (const p of lista) {
    const k = `${p.usuario}|${p.org ?? ''}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  for (const vista of VISTAS) {
    for (const tema of TEMAS) {
      if (solo && !solo.includes(`${vista.id}-${tema}`)) continue;
      for (const [, pantallas] of grupos) {
        const ctx = await contexto(navegador, { ancho: vista.ancho, alto: vista.alto, tema });
        const pagina = await ctx.newPage();
        const errores = [];
        pagina.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
        try {
          if (pantallas[0].usuario) await entrar(pagina, pantallas[0].usuario, { organizacion: pantallas[0].org });
          for (const p of pantallas) {
            try {
              await ir(pagina, p.ruta, p.esperar);
              await capturar(pagina, fase, p.id, vista.id, tema);
              auditoria[`${p.id}|${vista.id}|${tema}`] = { ...(await auditarCrudos(pagina)), errores: [...errores] };
            } catch (e) {
              auditoria[`${p.id}|${vista.id}|${tema}`] = { fallo: String(e).slice(0, 200) };
            }
          }
        } catch (e) {
          for (const p of pantallas) auditoria[`${p.id}|${vista.id}|${tema}`] = { fallo: `sesión: ${String(e).slice(0, 160)}` };
        }
        await ctx.close();
      }
    }
  }
  // Una ejecución parcial (filtro) suma a la auditoría existente en vez de pisarla.
  const archivo = `${SALIDA}/auditoria-${fase}.json`;
  const previa = existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : {};
  writeFileSync(archivo, JSON.stringify({ ...previa, ...auditoria }, null, 1));
  const fallos = Object.entries(auditoria).filter(([, v]) => v.fallo);
  console.log(`${Object.keys(auditoria).length} capturas · ${fallos.length} con fallo`);
  for (const [k, v] of fallos) console.log('  ✘', k, v.fallo);
  await navegador.close();
}
main();
