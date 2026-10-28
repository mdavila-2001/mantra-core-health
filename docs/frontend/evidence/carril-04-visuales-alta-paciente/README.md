# Correcciones visuales del alta de paciente — carril 04

Evidencia de `/auth/register/patient` antes y después del carril 04, sobre lo que dejó el carril 03
(contactos de emergencia sumados con el «+»). Capturadas contra `yarn start:demo` (backend
simulado), con un servidor levantado desde cero para cada fase: el «antes» es `dev` sin los cambios
y el «después» es esta rama.

| Archivo | Qué muestra |
|---|---|
| `antes/descripcion-al-enfocar-*.png`, `despues/descripcion-al-enfocar-*.png` | «Documento de identidad» enfocado. Antes no aparecía ninguna explicación; después aparece el globo. |
| `antes/contacto-extra-*.png`, `despues/contacto-extra-*.png` | El primer contacto sumado. Antes: «Quitar este contacto» en texto, relación sin glifo y sin descripciones. Después: quitar de ícono a la derecha, glifo en la relación y explicación en los tres datos. |
| `antes/quitar-contacto-*.png`, `despues/quitar-contacto-*.png` | Tocar «quitar» con un nombre escrito. Antes se borraba sin preguntar; después pide «Quitar / Conservar». |

| `despues/anios-desde-1910-*.png` | La grilla de años de «Fecha de nacimiento» en su primera página: 1910–1939, entera. Antes era 1890–1919, con 1890–1909 atenuados. Ninguna página empieza antes de `minDate`; el recorrido es 1980–2009 → 1950–1979 → 1920–1949 → 1910–1939, y hacia adelante 1940 → 1970 → 2000. Los años posteriores a `maxDate` (2027–2029) no se ven. |

Cada par va a 1440 px y a 375 px.

## Lo que se observó

- La explicación del campo no aparecía en NINGÚN formulario: el selector de `form-field.css` dejó de
  coincidir cuando entró `.form-field-body` (el envoltorio del ícono). Arreglado ahí, alcanza a toda
  la aplicación, no sólo a esta pantalla.
- Con la casilla vacía, «quitar» la saca sin preguntar; con algo escrito pregunta antes. Vale para
  nombres, celulares y contactos.
- 375 px sin desborde horizontal; el diálogo entra completo en el teléfono.

## Lo que cubren las pruebas y no las fotos

`playwright/carril-04-visuales-alta-paciente.spec.ts`, una prueba por requisito (REQ-04-001 a
REQ-04-009): glifo en cada campo de los cinco pasos, descripción al apuntar y al enfocar, navegación
de ícono con nombre accesible, confirmación al quitar, tarjetas de ayuda debajo a 1440/768/375,
pasos como nodos navegables y el alta completa hasta la pantalla de éxito.

Pedido en la revisión del carril: una fecha de nacimiento escrita a mano fuera de 1910–hoy
(«20/02/1800», «01/01/2999») decía «Ingrese su fecha de nacimiento.», como si estuviera vacía.
Ahora dice «Ingrese una fecha desde 1910 hasta hoy.» y no deja pasar de paso; una fecha que no
existe («31/02/2000») pide revisar el formato. Lo cubren la última prueba del spec del carril,
`date-picker.spec.ts` (el aviso `textProblem`) y `error-message.spec.ts` (el texto).

## Fuera de alcance, a propósito

- «Quitar la ubicación» sigue con ícono y texto: no es una lista, y un «−» suelto junto al mapa se
  confunde con el zoom.
- La fecha lleva el calendario y el teléfono la bandera en lugar del glifo genérico: es el contrato
  del motor de formularios.
- El globo de la explicación se apoya sobre el rótulo mientras el campo está enfocado. Así lo diseñó
  el componente compartido; el rótulo sigue siendo el nombre accesible.
