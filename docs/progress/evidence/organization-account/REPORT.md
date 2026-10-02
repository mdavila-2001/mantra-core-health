# La cuenta de organización ES la organización — evidencia (01/10/2026)

Rama `justin/organization-account` sobre `origin/mockup` (28d52275). Sólo front y maqueta.

## Qué cambia
- Claim opcional `accountKind` (`PERSON` | `ORGANIZATION`) y `SessionStore.isOrganizationAccount`.
  Sin el claim (API anterior) se deduce: tenant `PHARMACY`/`DIAGNOSTIC_CENTER`/`PAYER` y sin perfil de paciente ni profesional.
- Avatar y menú de la cuenta muestran la organización (nombre, iniciales, tipo), no la persona.
- «Mi perfil» (`MyAccount`) elige antes de montar: organización → `OrganizationProfile`; persona → `MyProfile`.
  Tiene que decidirse arriba porque `MyProfile` pide el resumen de paciente en su constructor.
- Farmacia: la ficha (`PharmacyProfile`) pasa a ser «Perfil de la farmacia» dentro de «Mi perfil».
  Aseguradora y laboratorio: datos de la organización del directorio y, la aseguradora, su ficha de regulador.
- «Ficha de la farmacia» sale del menú. `/administration/pharmacy-profile` redirige a `/my-account`
  (`SECCIONES_REDIRIGIDAS`, mismo patrón que `my-account/loyalty`).
- Maqueta: farmacia, laboratorio y aseguradora son `ORGANIZATION` y se llaman por la organización;
  `aseguradora.staff` y el visitador son `PERSON`.

## Evidencia (escalera de `15-claim-ladder.md`)
| Qué | Resultado | Comando |
|---|---|---|
| Typecheck app + specs | exit 0 | `yarn typecheck` · `npx tsc -p tsconfig.spec.json --noEmit` |
| Lint de lo tocado | 0 errores | `yarn eslint <rutas>` |
| Build | termina; sólo avisos de presupuesto ya existentes | `yarn build` |
| Specs dirigidos (sesión, MyAccount, OrganizationProfile, shell, navegación) | pasan | `yarn test --watch=false --include=…` |
| Navegador, 13 casos, 1 trabajador, Chrome local | **13 passed** | `organization-account.spec.ts` |

El navegador comprueba, para farmacia, laboratorio y aseguradora: sin renglón «Ficha de …», avatar y menú con el nombre
de la organización, «Mi perfil» con el título del tipo y los datos, redirección de la ruta vieja con sus tres pestañas
y, a 375 y 768 px, que el área de contenido no desborda. Capturas en esta carpeta (claro, 1440 / 768 / 375).

## Lo que NO está verificado o no es de este cambio
- **Modo oscuro:** sin captura. Sólo se usan tokens; no se midió.
- **Suite unitaria completa:** 9 484 pasan, **70 fallan en 7 archivos**: `pharmacy-inbox` (15, falla igual en `origin/mockup` limpio),
  `access-tree` (`received-claims` de más; no toca este diff), `resumen`, `patient-spending`, `procedures-block`, `follow-up-block`.
  `pharmacy-profile.spec` falló 31 en la corrida completa y **pasa aislado**: no se pudo atribuir la causa en la corrida completa.
- **Encabezado a 375 px:** desborda también en `/administration/pharmacy`, que no se tocó (control en el spec). Es del marco, no de esta ficha.
- **Contra la API real nada.** El claim `accountKind` todavía no lo emite el backend.
- Playwright: se usó el Chrome instalado (`channel: 'chrome'`), porque el Chromium de Playwright no está descargado. `portal-farmacia.spec.ts`
  ya estaba desactualizado (8 renglones vs 9) antes de este cambio; sólo se le quitó la ficha.

## Fase 2 (otra tarjeta, `mantra-core-health-api`, `dev`)
Emitir `accountKind` en `iam-auth.service.ts` (ORGANIZATION = membresía OWNER y sin `person_account_links`) y guardar el
`display_name` del dueño = nombre legal de la organización al registrarla. Logo de organización: no hay columna en
`directory.tenants`; va por el modelo (`.puml`), no a mano.
