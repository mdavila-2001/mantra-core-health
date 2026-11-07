# Carril A — evidencia

Estados: **TESTED** (dobles) · **VERIFIED_FUNCTIONAL_ONLY** (simulador `development,demo`, admin@alovida.mock). **VERIFIED (API real): no se ejecutó.**

| Archivo | Qué es |
|---|---|
| `portada-ANTES.png` / `portada-DESPUES.png` / `portada-DESPUES-pestana2.png` | Portada antes (2 tarjetas, 21 enlaces) y después (1 tarjeta, 2 pestañas, 12 enlaces). El sidebar encima del texto es un artefacto del `fullPage`. |
| `captura.mjs` | Script de las capturas (Chromium preinstalado, sin `networkidle`). |
| `pw-portada.png` | Captura del spec `playwright/menu-gestion-a.spec.ts`. |
| `test-final.log` | Vitest: `core/navigation` + `features/dashboard`. 316/317; la falla es la previa de abajo. |
| `lint.log`, `typecheck.log` | Limpios (0 errores). |
| `test-patient-home-baseline-dev.log` | Reproducción independiente de la falla previa. |

## Falla previa en `dev` (no es de este PR)

`patient-home.spec.ts › PatientHome › sin ficha de paciente no pide citas ni historia` falla con
«Expected one matching request … found none» (`answerOwnProfile`, línea 136).

Reproducción independiente, sin ningún cambio de esta rama (árbol = `origin/dev` b9748c52f):

```bash
node scripts/generate-env.mjs && node scripts/generate-component-index.mjs
NODE_OPTIONS=--max-old-space-size=6144 yarn ng test --include 'src/app/features/dashboard/patient-home/*.spec.ts' --watch=false
```

Resultado: 1 falla, 19 pasan (log arriba). Ningún archivo de este PR toca `patient-home`.

## Resultado del pre-push gate

Va en la descripción del PR: grabarlo aquí cambiaría el SHA que el gate prueba.
