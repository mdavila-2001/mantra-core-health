# Evidencia — «Seguros con los que trabaja» en Mi perfil del médico

Fecha: 28/09/2026 · Rol: médica (`medica@alovida.mock`) · Ruta: `/my-account`,
pestaña «Datos personales» · Backend: simulador (`mockBackend: true`, cambiado
sólo en la copia local para la corrida y revertido; la API real todavía no sirve
el dato, ver `docs/pendientes-backend-seguros-del-medico.md`).

Navegador: Chromium (Playwright), `ng serve`, espera por selector
(`[data-testid="perfil-seguros"]`), nunca `networkidle`.

| Viewport  | Chips                                                     | Overflow horizontal |
| --------- | --------------------------------------------------------- | ------------------- |
| 390x844   | Alianza Seguros · Caja Nacional de Salud · Seguros Andina | no                  |
| 768x1024  | ídem                                                      | no                  |
| 1024x768  | ídem                                                      | no                  |
| 1440x900  | ídem                                                      | no                  |
| 1920x1080 | ídem                                                      | no                  |

En los cinco, el `title` de cada chip es la red («Red de prestadores …»).

Consola: sólo ruido del entorno, igual con o sin este cambio — CSP de
`ng serve` sobre scripts en línea, dos fuentes `poppins-*.woff2` que no
cargan, y los mosaicos de OpenStreetMap del mapa de «Dónde atiendo», que el
proxy de la sesión bloquea. Ningún error viene del renglón nuevo.

Los estados vacío (`[]`) y caído (`null`) no se capturaron en navegador: el
simulador no tiene un interruptor para forzarlos. Están cubiertos en
`practitioner-profile-view.spec.ts` («los seguros con los que trabaja») y en
`practitioner-profile.spec.ts`.

No se capturó el tema oscuro.

Capturas: `mi-perfil-<viewport>.png` (pantalla) y `renglon-<viewport>.png`
(el renglón solo).
