# Centros médicos (CM-00): cableado compartido en `dev` — evidencia de navegador

Fecha: 2026-10-25 · Rama: `itzan/cm-00-shared-wiring-dev`, fusionada con `origin/dev`.
Front servido con la configuración `development,demo` (la de `start:demo`, con el simulador); cuentas `*@alovida.mock`, cualquier contraseña.
Chromium; tema oscuro con la preferencia guardada `mantra-core-health.theme=dark` y
`data-theme="dark"` comprobado en cada captura oscura.

## CM-06 · publicar un procedimiento (rol administración)

`admin@alovida.mock` → `/administration/services-catalog/procedure-offers` →
«Publicar un procedimiento» → «colono» → «10.02.02 Colonoscopia total» → precio 600 → Publicar.

- «Publicados»: 0 → 1, y sigue en 1 después de recargar.
- Mensajes de consola «no cumple el contrato»: 0. Page errors: 0.

## CM-08 · pedir un estudio en modo procedimiento (rol médica)

`medica@alovida.mock` → expediente de un paciente sintético → consulta → «Abrir encuentro» →
«Formulario médico» → «Laboratorio e imagenología» → tipo «Procedimiento» →
«Glucosa en sangre» (no pedido antes).

- «Que elija el paciente» viene marcado por defecto.
- «Estudios pedidos»: 4 → 5, sin mensaje de error.
- Mensajes «no cumple el contrato»: 0. Page errors: 0.

## Capturas

| Archivo | Tema | Viewport | Qué muestra |
|---|---|---|---|
| `cm06-claro-1440-form.png` | claro | 1440×900 | formulario de publicación completo |
| `cm06-claro-1440-final.png` | claro | 1440×900 | «Publicados» con la fila nueva |
| `cm06-oscuro-1440-final.png` | oscuro | 1440×900 | ídem |
| `cm06-claro-390-final.png` | claro | 390×844 | ídem, sin overflow horizontal |
| `cm06-oscuro-390-final.png` | oscuro | 390×844 | ídem |
| `cm08-claro-1440-form.png` | claro | 1440×900 | pedido con «Que elija el paciente» marcado |
| `cm08-claro-1440-final.png` | claro | 1440×900 | lista con el estudio nuevo |
| `cm08-oscuro-1440-final.png` | oscuro | 1440×900 | ídem |
| `cm08-claro-390-final.png` | claro | 390×844 | ídem, sin overflow horizontal |
| `cm08-oscuro-390-final.png` | oscuro | 390×844 | ídem |

En 390×844 `scrollWidth` es igual al ancho del viewport y no hay botones recortados; lo
único fuera de pantalla es el cajón lateral cerrado.
