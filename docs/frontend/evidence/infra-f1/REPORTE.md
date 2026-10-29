# Franja F1 — infraestructura hospitalaria (frontend)

Rama `claude/web-infra-f1`. Evidencia contra la **maqueta** (backend simulado en
el navegador): `playwright/infra-f1-evidencia.mjs`, 68 de 68 comprobaciones en
verde (`resultados.json`) y 141 capturas a 1440, 768 y 390 px en esta carpeta.
Contra la API real **no** se probó: la API de F1 no existe todavía.

## Qué hay

- `core/data-access/infrastructure/`: cliente (una operación por fila del §3 de
  `CONTRATO-F0-F1.md`), tipos, lectura de los `reason` de error, lógica pura
  (árbol, patrón `301-{A..H}`, CSV, reglas de catálogo) y caché del catálogo.
- `core/mock/handlers/infrastructure.*` y `fixtures/infrastructure.data.ts`:
  simulador con los errores del contrato y recuentos derivados del árbol.
  Los quirófanos usan los ids de `procedures.handlers`.
- `shared/components/organisms/tree/`: `app-tree`, árbol ARIA de N niveles.
- `features/admin/medical-organization/infrastructure/`: pestañas
  «Infraestructura» y «Establecimiento», ficha de espacio
  (`/administration/medical-organization/spaces/:id`) y diálogos.

## Supuestos (el contrato no fija la forma interna de la respuesta)

1. `SiteSummary` con `regulatory`, `rowVersion` y `viewer` (`canWriteStructure`,
   `canEditRegulatory`, `canSeeHistory`). El token no trae membresías, así que
   la interfaz no puede deducir admin de organización o de sucursal. Sin
   `viewer` cae al rol de plataforma. Solo refleja: la API decide.
2. Atributos del detalle como conceptos resueltos (`asepsis`, `pressure`…).
3. `GET /care-spaces/:id/history` es una **ruta propuesta**, no contratada.
4. `PATCH /sites/:id/regulatory` devuelve el `SiteSummary`.
5. El catálogo expone la regla de raíz como `parent: null` (si no, hay reserva).
6. `retire-check`, `structure` y `capacity` traen `asOf` (si no, no hay S7).
7. `POST …/declared-capacities` no se sabe qué responde: no se lee.
8. El `openapi.json` de `dev` no declara las claves nuevas del alta de espacio:
   `INFRASTRUCTURE_CONTRACT_PENDING_KEYS` las acepta en el simulador (como
   `REFERRAL_CONTRACT_PENDING_KEYS`) y el cliente las manda a la API real.
   Se borra al regenerar el contrato.

## No hecho, a propósito

- Subir el documento de respaldo de una habilitación (el contrato no describe
  el flujo) y editar la función de un espacio (el PATCH no la lista).
- El simulador no compara `X-Tenant-Id`: un establecimiento «de otro tenant»
  está sembrado aparte y da 404.
- Los códigos SNIS son marcadores de maqueta sin formato oficial.

## Hallazgos del recorrido de navegador (no los veían las pruebas unitarias)

- El validador de contrato del simulador daba 400 a toda alta (claves nuevas).
- `control.valueChanges` emite antes que `form.valueChanges`: las suscripciones
  que leían señales derivadas veían el valor anterior y el `required` de la
  superficie del quirófano no se encendía. Ahora leen el valor del control.
- El interceptor reintenta el estado 0 y el 500: S8/S9 de la ficha tardan.

## Verificación

- `tsc` app y spec limpios; `eslint --max-warnings=0` limpio.
- `ng test --include` sobre consola, `app-tree`, cliente y simulador: 10
  archivos, 169 pruebas; con el banco de componentes, 227. No se corrió la
  suite completa (el entorno compartido se queda sin memoria).
- `ng build --configuration development,demo` en verde.
- Nueve estados M34 vistos en navegador: S1 (prueba), S2, S3, S4 (código
  repetido, 412), S5, S6, S7, S8, S9, en pestaña, ficha y Establecimiento.
- Sin axe ni lector de pantalla: el ARIA del árbol se midió por atributos y por
  foco real con teclado, no con una herramienta de accesibilidad.
