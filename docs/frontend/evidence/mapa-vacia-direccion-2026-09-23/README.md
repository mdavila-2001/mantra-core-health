# El mapa vacía la dirección escrita; «Listo, guardamos…» sólo para lectores — 2026-09-23

Dos pedidos del cliente del 22/09:

- **D-06**: «si una toca una dirección en el mapa, el textfield de ubicación debe ponerse en
  blanco sí o sí». Tocar el plano (poner el pin o correrlo) vacía el campo de dirección y muestra
  «Volvé a escribir la dirección para este punto.»; volver a escribir se lleva el aviso.
- **D-07**: al confirmar el punto, «Listo, guardamos esta dirección.» ya no se ve. Sigue en la
  página sólo para lectores de pantalla, con su anuncio, porque para quien no ve el plano es la
  única señal de que la confirmación ocurrió.

Guion: `playwright/mapa-vacia-direccion.mjs` — **85 comprobaciones, todas en verde**, en una sola
pasada por las cinco pantallas. Red sin respuestas 4xx/5xx. Consola sin errores propios de estas
pantallas: los avisos de CSP por scripts en línea que aparecen en todas las rutas (el inicio de
sesión incluido, que este cambio no toca; ver `src/server/security-headers.ts`) se excluyen de
forma explícita y se cuentan: 10 en la corrida.

Datos: cuenta sintética de la maqueta `paciente@alovida.mock` para el editor; las altas se
recorren sin sesión con datos sintéticos (los documentos que piden laboratorio e imagenología se
adjuntan con la imagen de prueba del repo, `playwright/fixtures/upload-document.png`). Las
direcciones que escribe el guion («Calle Warnes #350», «Calle Sucre #88») son distintas de los
ejemplos de cada campo, para que en la captura un campo vacío (su ejemplo en gris) no se confunda
con lo escrito.

## Qué comprueba el guion en cada mapa

En siete mapas —editor del paciente (domicilio), alta del paciente (domicilio y trabajo), alta de
la aseguradora (casa matriz), alta del laboratorio (central y una sucursal) y alta de
imagenología (central y una sucursal)— las mismas diez:

1. la dirección está escrita; 2. sin tocar el mapa no hay aviso; 3. tocar el mapa vacía el campo;
4. el aviso aparece con su texto; 5. el aviso es una región viva cortés, que no roba el foco;
6. al confirmar, la confirmación ocupa una caja de 1×1 (no se ve); 7. pero está en la página con
su anuncio y su texto; 8. ningún nodo con «Listo, guardamos» se pinta en la vista; 9. volver a
escribir se lleva el aviso; 10. correr el pin vuelve a vaciar el campo.

Además, en el editor: la dirección de trabajo no recibe aviso por el mapa del domicilio, y a
375 y 768 px no hay desborde horizontal.

## Capturas y lo que se miró en cada una

| Captura | Viewport · tema | Qué se miró | Resultado |
|---|---|---|---|
| `despues-editor-domicilio-1-vaciada-1440-claro.png` | 1440 · claro | «Domicilio» vacío (muestra su ejemplo); el aviso justo debajo del campo, antes del mapa; la dirección de trabajo intacta y sin aviso | OK |
| `despues-editor-domicilio-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado: no aparece «Listo, guardamos»; quedan el aviso de que la calle se escribe a mano y «Volver a ubicarme» | OK |
| `despues-editor-domicilio-3-1440-oscuro.png` | 1440 · oscuro | Aviso legible sobre la tarjeta oscura, pin visible, campo vacío | OK |
| `despues-editor-domicilio-4-375-claro.png` | 375 · claro | Campo vacío con el aviso en dos líneas, sin desborde; la barra fija de acciones queda al pie | OK |
| `despues-editor-domicilio-5-768-claro.png` | 768 · claro | Campo vacío con el aviso en una línea, sin desborde; las cinco pestañas entran | OK |
| `despues-alta-domicilio-1-vaciada-1440-claro.png` | 1440 · claro | «Línea de dirección 1» vacía; el aviso encabeza el bloque del mapa, pegado al campo | OK |
| `despues-alta-domicilio-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |
| `despues-alta-domicilio-3-1440-oscuro.png` | 1440 · oscuro | Aviso legible sobre la tarjeta oscura del alta; pin visible | OK |
| `despues-alta-trabajo-1-vaciada-1440-claro.png` | 1440 · claro | Lo mismo en el paso del trabajo, con su propio campo y su propio aviso | OK |
| `despues-alta-trabajo-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |
| `despues-aseguradora-1-vaciada-1440-claro.png` | 1440 · claro | «Dirección» vacía; el aviso junto al mapa de la casa matriz (ver observación 1) | OK |
| `despues-aseguradora-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |
| `despues-laboratorio-central-1-vaciada-1440-claro.png` | 1440 · claro | «Dirección legal de la central» vacía, con su error de obligatorio; el aviso entre el campo y el mapa | OK |
| `despues-laboratorio-central-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |
| `despues-laboratorio-sucursal-1-vaciada-1440-claro.png` | 1440 · claro | «Dirección de la sucursal 1» vacía; el aviso justo debajo, dentro de la tarjeta de la sucursal | OK |
| `despues-laboratorio-sucursal-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible; «Agregar sucursal» sigue debajo | OK |
| `despues-imagenologia-central-1-vaciada-1440-claro.png` | 1440 · claro | Como en el laboratorio: campo vacío con su error de obligatorio y el aviso antes del mapa | OK |
| `despues-imagenologia-central-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |
| `despues-imagenologia-sucursal-1-vaciada-1440-claro.png` | 1440 · claro | Dirección de la sucursal vacía y su aviso dentro de su tarjeta | OK |
| `despues-imagenologia-sucursal-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |

Las cuatro capturas de imagenología salen de una repetición de ese recorrido (22 comprobaciones
en verde): en la pasada general, la de la central quedó tomada antes de que la tarjeta se
pintara y salió en blanco, aunque sus comprobaciones habían pasado.

## Observaciones, no defectos de este cambio

1. **Direcciones obligatorias** (aseguradora, y la central de laboratorio e imagenología): cuando
   el mapa vacía el campo, el campo muestra también su error de obligatorio. En la aseguradora,
   además, el aviso queda junto al mapa y no junto al campo, porque entre los dos está «Nombre
   comercial». El error señala el campo y el aviso explica por qué quedó vacío; si se prefiere no
   marcarlo en rojo hasta que la persona vuelva a tocarlo, es un cambio chico en cada alta.
2. El pin sin confirmar es un círculo claro que sobre el plano claro contrasta poco; en tema oscuro
   se ve bien. Es el estilo del mapa, que este cambio no toca.
3. En tema oscuro, la atribución del mapa («Leaflet | © OpenStreetMap contributors») y el enlace
   «Iniciá sesión» de las altas casi no se leen. Tampoco los toca este cambio.

## No cubierto

- El tema oscuro de la aseguradora, el laboratorio y la imagenología; en 375 y 768 sólo se miró
  el editor.
- **Editor del médico y alta del médico**: el cambio todavía no está hecho en esas dos pantallas.
