# Contrato — «Servicios recibidos» de la historia del paciente

- Fecha: 2026-10-25 · Módulo: M08 `clinical` · Pantallas: `/my-account/medical-record?seccion=servicios`
  y la ficha del médico (`/medical-records/:profileId`, última pestaña).
- Estado: **publicado por la API** (`GET /clinical/patients/:patientProfileId/received-services`) y servido
  igual por el simulador (`src/app/core/mock/handlers/received-services.handlers.ts`).

## Qué es

Lo que se le **hizo** al paciente: las **intervenciones médicas realizadas** y las **vacunas**. La intervención
es un tipo de servicio, junto a la vacuna. El tipo es un concepto extensible del servidor
(`vs_received_service_type`): un tipo que el cliente no conoce llega como `OTHER` y se dibuja con su etiqueta.

Qué **no** es un servicio recibido, porque ya tiene su pestaña: la consulta (vive en «Atenciones»), el
laboratorio y la imagenología (viven en «Resultados»), las recetas y los diagnósticos.

## `GET /clinical/patients/:patientProfileId/received-services?limit=`

Misma política de acceso que `GET /clinical/patients/:id/summary`: el titular, quien lo representa, quien
atiende con turno o con un acceso que el paciente autorizó, y la emergencia. El cliente no autoriza nada
(`ReceivedServicesClient` solo pide). La lectura deja su asiento en la bitácora de acceso antes de responder.

| Parámetro | Qué | Por defecto |
|---|---|---|
| `limit` | Tope de la lista (máximo 500) | 50 |

```json
{
  "patientProfileId": "uuid",
  "items": [
    {
      "id": "uuid",
      "type": "INTERVENTION",
      "typeConceptId": "uuid",
      "serviceConceptId": "uuid",
      "statusConceptId": "uuid",
      "performedAt": "2026-08-12T14:30:00.000Z",
      "performerProfileId": "uuid",
      "performerName": "Dra. Valeria Rojas Mendoza",
      "practiceSiteId": "uuid",
      "practiceSiteName": "Clínica Los Olivos",
      "resultText": "Tolerancia adecuada. Control en dos semanas.",
      "cost": { "amount": "350.00", "currencyCode": "BOB", "source": "INVOICE_LINE" }
    }
  ],
  "limit": 100,
  "truncated": false,
  "costsVisible": true
}
```

- `type`: `INTERVENTION` · `VACCINATION` · `OTHER`. El concepto del tipo viaja siempre en `typeConceptId`.
- `serviceConceptId`, `statusConceptId`, `outcomeConceptId`: conceptos; la etiqueta sale de terminología
  (`TerminologyClient.readConceptLabels`). Nunca se pinta un identificador.
- `performerName` y `practiceSiteName` vienen **resueltos por el servidor**: el paciente no puede leer el
  padrón de profesionales y no podría resolverlos desde `performerProfileId`. Ausentes si no están registrados.
- Orden: del más reciente al más antiguo. Un caso quirúrgico y su procedimiento principal son **un** servicio.
- `truncated: true` cuando el tope cortó la lista: la pantalla lo dice, no lo calla.

### Quién ve el dinero

`costsVisible` lo decide la API según quién pide:

| Quién | `costsVisible` | `cost` |
|---|---|---|
| El titular o quien lo representa | `true` | el importe, o `null` si no hay cobro registrado |
| Personal clínico y superadministrador | `false` | siempre `null` — **no significa «sin cobro»** |

El importe es un decimal exacto como texto (`"350.00"`), nunca `number`. `source` dice de dónde sale: la línea
de factura enlazada (`INVOICE_LINE`) o la suma de los cargos del caso (`CHARGE_ITEMS`). Con monedas distintas
entre los cargos no se suma y `cost` es `null`.

### La cobertura del seguro no se expone

El reparto que le corresponde al paciente se publica por pedido, con una explicación de beneficios firmada
(`PatientSettlementService`, que hoy resuelve pedidos de farmacia y de diagnóstico). Mostrar acá una cobertura
leída de las líneas de reclamo, sin esa publicación, exhibiría un reparto que el seguro todavía no confirmó.
Ni el contrato ni el simulador la traen.

## Cómo lo consume el front

`ReceivedServicesClient` (`core/data-access/received-services/`) hace la lectura y normaliza los `null`.
`app-received-services-panel` (`shared/components/organisms/received-services-panel/`) es el panel que
montan las dos pantallas, así que el paciente y el médico leen lo mismo:

- **Historia del paciente**: 6.ª pestaña, al final, sin mover los enlaces `?seccion=` que ya circulan.
  Se monta solo con la pestaña activa (lo proyectado se crea aun cerrado) y falla aislada.
- **Historia vacía**: si el resumen no trae nada más, se pregunta por los servicios (`limit=1`) antes de
  declararla vacía. Quien solo recibió vacunas o una intervención no tiene la historia vacía. Si esa pregunta
  falla se asume que sí tiene servicios: decir «vacía» sería afirmar lo que no se sabe.
- **Ficha del médico**: última pestaña, también aislada; un error de esta lectura no tumba el expediente.
- **PDF «Descargar historia completa»**: sección «Servicios recibidos» al final. Si la lectura falla, la
  sección no se imprime y el aviso lo dice: el papel no afirma «sin servicios».

## Escenario de la maqueta

`src/app/core/mock/fixtures/received-services.ts` es el escenario canónico, el mismo que usan las pruebas del
front y el mockup de la app móvil: dos intervenciones (infiltración articular con línea de factura, apendicectomía
con cargos del caso) y dos vacunas (influenza y antitetánica, sin cobro). Dev, test y mockup tienen que mostrar
lo mismo.
