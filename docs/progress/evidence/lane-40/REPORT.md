# Informe de evidencia — carril 40 (CORR-10)

Fecha: 2026-10-11  
Rama: `justin/mockup-corr-40-sacar-perfil-publico` sobre `origin/mockup` (`b912aa3e`).

## Resultado

La sección de perfil deja de describirse como una configuración de vitrina pública: el editor y el título de ruta dicen “Editar perfil”, se quitó el texto “Cómo le ven las personas que consultan su perfil” y se eliminó el acceso duplicado “Configurar mi perfil”. Se conserva el acceso general “Editar perfil”, el logo del consultorio y el resto de datos profesionales.

La ficha pública y el directorio siguen disponibles para pacientes. También se conserva “Mis artículos”. El propietario confirmó el 2026-10-13 que ambos se conservan; la decisión quedó registrada en `docs/progress/DECISIONS.md`.

## Evidencia visual

`scripts/corr-evidencia.sh 40 --antes` y `scripts/corr-evidencia.sh 40` corrieron contra `http://127.0.0.1:4200`, con `CORR_USUARIO=medica`, Playwright y un worker. Ambas corridas: 1 prueba, 16 celdas, 0 fallos. Las matrices están en `MATRIZ-visual-antes.md` y `MATRIZ-visual.md`, y las capturas correspondientes en `fotos/antes/` y `fotos/despues/`.

La matriz posterior informa 16/16 celdas correctas en perfil, edición y directorio para 375, 768 y 1440 px, temas claro y oscuro donde aplica, sin errores de consola ni scroll horizontal. `/my-account/preview` queda registrada como ruta retirada. La prueba adicional de ficha pública del directorio pasó 1/1 y guardó `fotos/despues/directorio-ficha-medico-paciente-1440.png`.

## Verificaciones

| Verificación | Resultado |
|---|---|
| `corepack yarn typecheck` | PASS |
| ESLint dirigido a los archivos modificados | PASS |
| Specs dirigidos de perfil, directorio público y rutas | PASS · 13 archivos, 442 pruebas |
| Playwright `scripts/corr-evidencia.sh 40 --antes` | PASS · 1 prueba, 16 celdas |
| Playwright `scripts/corr-evidencia.sh 40` | PASS · 1 prueba, 16 celdas |
| Playwright `playwright/corr-40-public-directory.spec.ts --workers=1` | PASS · 1/1 |
| `corepack yarn test --watch=false` | FAIL · 769 archivos pasaron, 4 fallaron; 10.612 pruebas pasaron y 69 fallaron. Son fallos de la suite amplia; esta corrida no establece que coincidan con las tres rojas E2E documentadas por el repo. |
| `playwright/carril-19-route-health.spec.ts --workers=1` | BLOQUEADA · la prueba inició, pero `apiViva` devolvió `false`; falló el `beforeAll` del paciente y las otras 3 pruebas no corrieron. La API local no estaba disponible. |

El lint global conocido del repositorio no se usó como criterio de esta edición: el lint dirigido sobre los archivos tocados sí pasó.

## Observación de datos de prueba

La ficha de directorio usada por el escenario trae una coma inicial en el nombre visible del médico. La prueba normaliza ese signo para comprobar identidad y especialidad. No se modificó el dato ni la pantalla por quedar fuera de CORR-10.

## Archivos relevantes

- `src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.html`
- `src/app/features/account/my-profile/practitioner-profile/practitioner-profile-view/practitioner-profile-view.html`
- `src/app/app.routes.ts`
- `playwright/corr-40-public-directory.spec.ts`
