# Datos de farmacia en dev (2026-10-30)

Relevamiento de la sesión `servidores`, hecho solo con lecturas contra la base de `api-dev` el 2026-10-30. No
se escribió nada.

## Conteo

```sql
with ft as (select t.id from directory.tenants t
  join terminology.catalog_concepts c on c.id = t.tenant_type_concept_id where c.code = 'PHARMACY')
select 'tenants PHARMACY', count(*) from ft
union all select 'pharmacy.pharmacies', count(*) from pharmacy.pharmacies
union all select 'pharmacy.pharmacy_sites', count(*) from pharmacy.pharmacy_sites
union all select 'pharmacy.pharmacy_products', count(*) from pharmacy.pharmacy_products
union all select 'pharmacy.pharmacy_product_categories', count(*) from pharmacy.pharmacy_product_categories
union all select 'pharmacy.pharmacy_price_lists', count(*) from pharmacy.pharmacy_price_lists
union all select 'pharmacy.pharmacy_product_prices', count(*) from pharmacy.pharmacy_product_prices
union all select 'pharmacy.pharmacy_integration_connections', count(*) from pharmacy.pharmacy_integration_connections
union all select 'pharmacy_inventory.inventory_locations', count(*) from pharmacy_inventory.inventory_locations
union all select 'pharmacy_inventory.inventory_stock_positions', count(*) from pharmacy_inventory.inventory_stock_positions
union all select 'pharmacy_inventory.inventory_ledger_entries', count(*) from pharmacy_inventory.inventory_ledger_entries
union all select 'practice.practice_sites de tenants PHARMACY', count(*) from practice.practice_sites where tenant_id in (select id from ft)
union all select 'clinical.medication_requests', count(*) from clinical.medication_requests;
```

**Resultado del 2026-10-30:**
- 9 tenants de tipo PHARMACY: los 7 `CARGA_*` del 28/10, más `CARGA_NOMBRE_COMERCIAL_511` y `PRUEBA_FARMACIA`.
- Todas las demás tablas del módulo están en 0, y también `clinical.medication_requests` en todo dev.

**Qué quiere decir:** no hay farmacias, sucursales, catálogo, stock ni recetas. Nada del módulo se puede ver con
datos sin cargarlos antes.

**Llaves:**
- `pharmacy_sites` → `pharmacy_id` y `practice_site_id`.
- `products`, `categories` y `price_lists` → `pharmacy_id`.
- `product_prices` y `stock_positions` → `pharmacy_product_id`.
- `ledger` → farmacia, sitio y producto.
- `integration_connections` → `pharmacy_id` y `pharmacy_site_id`.

## Cuentas que entran (2026-10-30)

- **Farmacia:** `admin.<farmacia>@alovida.test`, por ejemplo `admin.farmacorp-s-a@alovida.test`. Tiene los roles
  `USER` y `PHARMACY_STAFF`, y es `ROLE_ADMIN` de su organización.
- **Médico:** cuentas `PRACTITIONER` `@alovida.test`. `servidores` probó una y entra.
- **Paciente:** no hay ninguna con correo. Hay que crearla, con datos inventados.
- **Clave:** la de la carga del 28/10, que está solo en el servidor. `SEED_DEMO_PASSWORD` no sirve con estas
  cuentas.

## Cómo cargar

- **Herramienta:** la versionada, API #1076, que corre pasos de seed en proceso con `seed-cli`
  (`src/common/seed/`) y se enciende con variables `SEED_*`. Un paso nuevo de farmacia encaja ahí.
- **Qué no se reutiliza:** los guiones sueltos del 28/10, que escriben SQL y llevan la clave en el código.

## Simulador del ERP (FAR-07)

No está desplegado en el servidor, y `api-dev` no tiene ninguna variable `PHARM*` ni `ERP*`.
