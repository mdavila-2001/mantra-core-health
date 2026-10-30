# Ubicación primero: mapa → ficha llena (alta de paciente y de profesional)

Chromium contra `ng serve --configuration development,demo` (simulador, no API real), 2026-10-26.

**Qué se vio.** En «Lugares donde vive» (paciente) y «¿Dónde vive?» (profesional) solo está el mapa de Bolivia
con su acercamiento. Distrito, calle y punto GPS **no existen** hasta elegir la localidad. Al elegirla aparece la
ficha con departamento, provincia y municipio ya llenos (Warnes → Santa Cruz / Warnes / Warnes; Sacaba →
Cochabamba / Chapare / Sacaba) y debajo, distrito, calle y GPS.

| Captura | Qué muestra |
|---|---|
| `paciente-1-mapa-primero-1440.png` | Paciente, antes de elegir: mapa y nada más |
| `paciente-2-ficha-llena-1440.png` / `-390.png` | Paciente, ficha llena + distrito, calle, GPS |
| `medico-1-mapa-primero-1440.png` | Profesional, antes de elegir |
| `medico-2-ficha-llena-1440.png` / `-390.png` | Profesional, ficha llena, distrito y calle escritos |

Sin desborde horizontal a 390 px y sin errores de página en los cuatro recorridos.

**No se verificó:** contra la API real, el envío del alta completa (el distrito viaja dentro de la línea de
dirección: cubierto por pruebas unitarias, no por un alta real), tema oscuro, otros navegadores ni otros roles.
