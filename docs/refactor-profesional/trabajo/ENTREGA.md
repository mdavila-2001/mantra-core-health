# Entrega — fase 11

## Qué cambió para las personas

**Paciente · «Mis citas».** Al entrar ve primero lo que viene («Próximas», la más cercana
arriba) y el historial después, el más reciente primero. «Pedir una cita» está arriba en todos
los anchos y lleva a la sección de reserva con el foco puesto. En el teléfono la búsqueda queda a
la vista y el resto de los filtros se abre con «Más filtros», que dice cuántos hay activos. En
escritorio ya no se cortan «Todos los estados» ni «DD/MM/AAAA».

**Paciente · panel.** «Viernes 18 de septiembre» en lugar de «Viernes 18 De Septiembre».

**Médica · teléfono.** El selector de organización baja al menú lateral como estaba diseñado;
antes cada pantalla lanzaba un error y el selector se quedaba apretado en la barra superior.

**Médica · Consultas.** A 1440 px la columna de acciones entra entera. En anchos menores, una
sombra en el borde avisa que hay más columnas. Con lector de pantalla, cada fila se nombra por
el paciente y no por un código interno.

**Médica · panel.** «Ver mi agenda de hoy» es la acción principal, arriba a la derecha; las
cifras («Secciones disponibles», «Organizaciones») pasan al final.

**Paciente · órdenes y resultados.** «Reservar hora» ya no está apagado: lleva a «Mis citas»
con «En un laboratorio» elegido. Los botones de descargar y compartir dicen de qué estudio son.

**Todo el producto.** Las transiciones usan una sola escala de tiempos; con «reducir
movimiento» siguen anuladas.

**Equipo.** `yarn start` funciona en un clon limpio de `mockup`; `yarn lint` vuelve a verde.

Comparación antes/después con el mismo contexto: `capturas/antes/` ↔ `capturas/despues/` y
`capturas/e2e/`.

## Qué no cambió

Rutas, permisos, contratos de API, persistencia, estados M34, navegación global, identidad
visual. Ninguna función se retiró.

## Mantenimiento

- Tokens: `src/styles.css` (movimiento: `--dur-*`, `--ease-*`; ver `docs/design-system/motion.md`).
- Orden de citas: `features/account/appointments/upcoming-and-past.ts` (pura, con pruebas).
- Tablas: `app-data-table` acepta `rowLabel`; pasarlo en toda tabla nueva.
- Agregar una variante: usar las ranuras existentes (`page-header [page-actions]`) antes de
  crear un componente.
- Checks: `yarn lint`, `yarn typecheck`, `yarn build`, `yarn test`, y el E2E del refactor con
  `E2E_BASE_URL=http://localhost:<puerto> yarn pw <spec> --workers=1`.

## Gobierno

Responsables: los del equipo según el reparto vigente del repo; este documento no nombra a
nadie nuevo. Para un patrón nuevo: necesidad, consumidores, estados, accesibilidad y coste —
en una entrada de `DECISIONES.md`.

## Reversión

Cada incremento es un commit atómico sólo de frontend (tabla en `PLAN_SITUADO.md`).
`git revert <sha>` lo deshace sin tocar datos. Tras revertir: `yarn build` y el E2E del
refactor.

## Limitaciones conocidas

Ver `QA_FINAL.md` § «No ejecutado» y `HALLAZGOS.md` (H-10, H-13, H-14, H-15, H-17 abiertos).

## Seguimiento con usuarios (protocolo listo, no ejecutado)

Tarea neutral: «Tenés una cita esta semana. ¿Cuándo es? Después, pedí una nueva con tu
médica». Medir: tiempo hasta decir la fecha, si encuentra «Pedir una cita» sin ayuda, y si usa
el menú o el botón. 5 participantes, teléfono y escritorio.

## Integración

PR contra `mockup` (no `dev`); el merge lo hace una persona. Nada se desplegó.
