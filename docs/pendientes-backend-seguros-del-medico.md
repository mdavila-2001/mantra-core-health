# Pendiente de backend — con qué seguros trabaja el médico

**Estado:** el cliente, el simulador y la ficha ya lo implementan. El backend real todavía no.

## Por qué

«Mi perfil» del médico no decía con qué aseguradoras trabaja (pedido del
28/09/2026). Es lo primero que un paciente pregunta antes de pedir la cita.

El dato **ya existe en la base**: `insurance.network_provider_memberships`
vincula una red de prestadores (`provider_networks`, que es de una
aseguradora) con un prestador, y para un médico lleva
`practitioner_role_assignment_id`. La aseguradora lo carga con
`POST /provider-networks/:id/memberships` al sumarlo a su red.

Lo que falta es **leerlo desde el lado del médico**. Hoy la única lectura es
`GET /insurance-carriers/:id`, que devuelve `memberCount` por red: sirve a la
aseguradora para contar su red, no al médico para saber en cuáles está.

## El contrato que ya pide el cliente

```
GET /practitioners/:practitionerProfileId/insurance-networks   → 200
```

```ts
class PractitionerInsuranceNetworkDto {
  @ApiProperty({ format: 'uuid' }) membershipId: string;
  @ApiProperty({ format: 'uuid' }) carrierId: string;
  /** El nombre comercial de la aseguradora, no la razón social. */
  @ApiProperty() carrierName: string;
  @ApiProperty() networkName: string;
  @ApiProperty({ format: 'date', nullable: true }) effectiveFrom: string | null;
  @ApiProperty({ format: 'date', nullable: true }) effectiveTo: string | null;
}

class PractitionerInsuranceNetworkPageDto {
  items: PractitionerInsuranceNetworkDto[];
  count: number;
}
```

Una fila por **membresía**. Si una aseguradora tiene al médico en dos redes,
van dos filas: la ficha las junta en una sola por aseguradora
(`segurosVisibles` en `practitioner-profile.ts`).

### Qué filas entran

- Membresía con `status_concept_id` = activa (`INS.MEMBERSHIP_ACTIVE`).
- Red con `status_concept_id` = activa (`INS.NETWORK_ACTIVE`).
- Vigente hoy: `effective_from` nulo o ≤ hoy, y `effective_to` nulo o ≥ hoy.
- Del médico, por cualquiera de dos caminos:
  1. **Por la práctica donde atiende** — el camino de hoy.
     `InsuranceBackboneService.addMembership` crea **toda** membresía con
     `provider_type_concept_id = INS.PROVIDER_TYPE_PRACTICE` y `practice_id`, y
     nunca llena `practitioner_role_assignment_id`. Así que la membresía de la
     práctica cuenta para cada médico con una asignación de rol **activa** en
     esa práctica (`practice.practitioner_role_assignments`, la misma fuente
     que `GET /practitioners/:id/sites`), incluido su consultorio propio.
  2. **Individual** — `practitioner_role_assignment_id` apunta a una
     asignación de rol de ese perfil. Hoy ninguna ruta la crea; se lee igual
     para que el día que exista no haya que tocar la lectura.

  Si los dos caminos dan la misma membresía, va una sola fila.

Orden: el cliente ordena por nombre de aseguradora, así que no hace falta
ordenar del lado del servidor.

### Autorización

Es el mismo dato que publica cualquier aseguradora en su cartilla. Mismo
criterio que `GET /practitioners/:id/sites`: exige sesión, y cualquier sesión
puede leer el de cualquier profesional. **No** es tenant-scoped a la
aseguradora: el médico no pertenece al tenant de la aseguradora que lo sumó.

### Lista vacía

`{ items: [], count: 0 }` con `200`, nunca `404`. «Ninguna aseguradora lo
tiene en su red» es un estado normal y la ficha lo dice con palabras; un `404`
la haría decir que no se pudo leer.

## Qué hace la ficha con cada respuesta

| Respuesta             | Qué se ve en «Datos personales»                    |
| --------------------- | -------------------------------------------------- |
| Filas                 | Un chip por aseguradora; la red en el `title`.     |
| `items: []`           | «Ninguna aseguradora te tiene en su red todavía».  |
| Error (404, 5xx, red) | «No pudimos traer tus seguros…» — nunca «ninguna». |

## Dónde está del lado del cliente

- Cliente: `InsuranceClient.listNetworksOfPractitioner`
  (`src/app/core/data-access/insurance/insurance.client.ts`).
- Simulador: `redesDelProfesional` en
  `src/app/core/mock/handlers/insurance.handlers.ts`.
- Ficha: renglón «Seguros con los que trabaja» en
  `practitioner-profile-view.html`, `data-testid="perfil-seguros"`.
