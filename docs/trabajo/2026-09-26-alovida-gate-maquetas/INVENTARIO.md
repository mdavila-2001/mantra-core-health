# Inventario — pantallas de `features/alovida/` contra la API real

- Fecha: 2026-09-26 · Rama: `pablo/alovida-gate-estaticas-2026-09-26` (base `test`).
- Objetivo: que en el build con API real (`production-api`, el del deploy TEST) ningún usuario
  llegue a una pantalla con datos de ejemplo, sin perder las maquetas en `mockup`.
- Mecanismo: interruptor de entorno `designMockups` (`PUBLIC_DESIGN_MOCKUPS`), mismo patrón que
  `campaignsDemo`. Encendido en `environment.ts`/`environment.development.ts` (maqueta);
  fijado en `false` en `production-api`, `real-api` y `e2e-real`. El gate vive en
  `src/app/features/alovida/design-mockup-gate.ts` y envuelve al archivo **generado**
  `alovida.routes.ts` desde `app.routes.ts`, así que sobrevive a una regeneración de la bóveda.

## Clases

- **(a) conectada**: la pantalla lee la API. Con el gate apagado redirige a su URL canónica
  (`/search/…`), que monta el mismo componente con `data.pantallaReal` —sin el aviso de
  «Referencia de diseño»—.
- **(b) equivalente**: maqueta estática cuya tarea ya hace una pantalla conectada de otra
  feature. Redirige a esa pantalla (conservando la query). Se comprobó en el código del destino
  que llama al endpoint correspondiente.
- **(c) sin equivalente**: con el gate apagado no se registra; cae en el comodín `**` (404).
  Ningún menú visible enlaza a ellas (ver `design-mockup-gate.spec.ts`).

Las fichas `perfil-*-detalle` además aceptan slug en los dos modos
(`/buscar/perfil-farmacia-detalle/:slug` → `/f/:slug`): la ficha pública real (`PublicProfile`,
`GET /public/profiles/:prefijo/:slug`) es la versión conectada de V65-07…11.

Rutas de la bóveda montadas fuera del archivo generado (`app.routes.ts`, ya con
`data.pantallaReal`): `/posts`, `/search`, `/search/symptoms` (`SintomasPublico`, reusa
`SymptomCheck` con el buscador público), `/search/practitioners|medications|hospitals|diagnostics|insurers|map`
y `/promotions/:campaignId`. Todas **(a)**; no cambian.

## Rutas de `alovida.routes.ts` (126)

| # | Ruta | Pantalla | Clase | En production-api |
|---|---|---|---|---|
| 1 | `/inicio` | AloVida — la plataforma de operaciones de salud de Mantra Core | (b) equivalente | → `/` |
| 2 | `/buscar/buscador-listado` | V65-01·L · Buscador | (a) conectada | → `/search` (URL canónica) |
| 3 | `/buscar/profesionales-listado` | V65-02·L · Profesionales | (a) conectada | → `/search/practitioners` (URL canónica) |
| 4 | `/buscar/medicamentos-listado` | V65-03·L · Medicamentos y farmacias | (a) conectada | → `/search/medications` (URL canónica) |
| 5 | `/buscar/hospitales-listado` | V65-04·L · Hospitales y clínicas | (a) conectada | → `/search/hospitals` (URL canónica) |
| 6 | `/buscar/laboratorios-listado` | V65-05·L · Laboratorios e imagen | (a) conectada | → `/search/diagnostics` (URL canónica) |
| 7 | `/buscar/aseguradoras-listado` | V65-06·L · Aseguradoras y convenios | (a) conectada | → `/search/insurers` (URL canónica) |
| 8 | `/buscar/perfil-profesional-detalle` | V65-07·D · Perfil del profesional | (b) equivalente | → `/search/practitioners`; con slug → `/p/:slug` |
| 9 | `/buscar/perfil-organizacion-detalle` | V65-08·D · Perfil de la organización | (b) equivalente | → `/search/hospitals`; con slug → `/o/:slug` |
| 10 | `/buscar/perfil-farmacia-detalle` | V65-09·D · Perfil de la farmacia | (b) equivalente | → `/search/medications`; con slug → `/f/:slug` |
| 11 | `/buscar/perfil-laboratorio-detalle` | V65-10·D · Perfil del laboratorio | (b) equivalente | → `/search/diagnostics`; con slug → `/l/:slug` |
| 12 | `/buscar/perfil-aseguradora-detalle` | V65-11·D · Perfil de la aseguradora | (b) equivalente | → `/search/insurers`; con slug → `/s/:slug` |
| 13 | `/buscar/cercania-detalle` | V65-12·D · Cerca mío | (a) conectada | → `/search/map` (URL canónica) |
| 14 | `/buscar/seguidos-y-guardados-listado` | V65-13·L · Seguidos y guardados | (c) sin equivalente | no se registra (404) |
| 15 | `/buscar/calificar-la-atencion-formulario` | V65-14·F · Calificar la atención | (b) equivalente | → `/search/practitioners` |
| 16 | `/datos-compartidos/versiones-internas-escanear` | V02-08·A · Registrar el resultado del escaneo | (c) sin equivalente | no se registra (404) |
| 17 | `/datos-compartidos/versiones-internas-listado` | V02-08·L · Versiones (archivos) | (c) sin equivalente | no se registra (404) |
| 18 | `/datos-compartidos/archivos-eliminar` | V02-01·A · Eliminar el archivo | (c) sin equivalente | no se registra (404) |
| 19 | `/datos-compartidos/archivos-formulario` | V02-01·F · Nuevo archivo | (c) sin equivalente | no se registra (404) |
| 20 | `/datos-compartidos/archivos-listado` | V02-01·L · Archivos | (c) sin equivalente | no se registra (404) |
| 21 | `/datos-compartidos/archivos-obtener-enlace` | V02-01·A · Obtener el enlace de descarga | (c) sin equivalente | no se registra (404) |
| 22 | `/datos-compartidos/archivos-subir` | V02-01·A · Subir el contenido de un archivo | (c) sin equivalente | no se registra (404) |
| 23 | `/datos-compartidos/contenido-detalle` | V02-02 · Contenido | (c) sin equivalente | no se registra (404) |
| 24 | `/datos-compartidos/vinculos-formulario` | V02-03·F · Nuevo vínculo | (c) sin equivalente | no se registra (404) |
| 25 | `/datos-compartidos/vinculos-listado` | V02-03·L · Vínculos | (c) sin equivalente | no se registra (404) |
| 26 | `/datos-compartidos/versiones-formulario` | V02-04·F · Nueva versión | (c) sin equivalente | no se registra (404) |
| 27 | `/datos-compartidos/versiones-listado` | V02-04·L · Versiones (archivos) | (c) sin equivalente | no se registra (404) |
| 28 | `/datos-compartidos/puntos-de-contacto-formulario` | V02-05·F · Nuevo punto de contacto | (c) sin equivalente | no se registra (404) |
| 29 | `/datos-compartidos/puntos-de-contacto-listado` | V02-05·L · Puntos de contacto | (c) sin equivalente | no se registra (404) |
| 30 | `/datos-compartidos/puntos-de-contacto-verificar` | V02-05·A · Verificar el punto de contacto | (c) sin equivalente | no se registra (404) |
| 31 | `/datos-compartidos/direcciones-formulario` | V02-06·F · Nueva dirección | (c) sin equivalente | no se registra (404) |
| 32 | `/datos-compartidos/direcciones-listado` | V02-06·L · Direcciones | (c) sin equivalente | no se registra (404) |
| 33 | `/datos-compartidos/identificadores-formulario` | V02-07·F · Nuevo identificador | (c) sin equivalente | no se registra (404) |
| 34 | `/datos-compartidos/identificadores-listado` | V02-07·L · Identificadores | (c) sin equivalente | no se registra (404) |
| 35 | `/datos-compartidos/derivados-formulario` | V02-09·F · Nuevo derivado | (c) sin equivalente | no se registra (404) |
| 36 | `/datos-compartidos/derivados-listado` | V02-09·L · Derivados | (c) sin equivalente | no se registra (404) |
| 37 | `/terminologia/versiones-importar` | V03-01·A · Importar conceptos | (b) equivalente | → `/administration/terminology/import` |
| 38 | `/terminologia/versiones-listado` | V03-01·L · Versiones de conjuntos de valor | (b) equivalente | → `/administration/terminology` |
| 39 | `/terminologia/versiones-publicar` | V03-01·A · Publicar la versión | (b) equivalente | → `/administration/terminology` |
| 40 | `/terminologia/expansion-de-conjunto-de-valores-formulario` | V03-04·F · Expandir un conjunto de valores | (c) sin equivalente | no se registra (404) |
| 41 | `/terminologia/sistemas-de-codigos-formulario` | V03-05·F · Nuevo sistema de códigos | (c) sin equivalente | no se registra (404) |
| 42 | `/terminologia/sistemas-de-codigos-listado` | V03-05·L · Sistemas de códigos | (b) equivalente | → `/administration/terminology` |
| 43 | `/terminologia/versiones-de-sistema-formulario` | V03-06·F · Nueva versión del sistema de códigos | (c) sin equivalente | no se registra (404) |
| 44 | `/terminologia/versiones-de-sistema-listado` | V03-06·L · Versiones del sistema de códigos | (c) sin equivalente | no se registra (404) |
| 45 | `/terminologia/deprecacion-de-concepto-formulario` | V03-08·F · Retirar un concepto | (c) sin equivalente | no se registra (404) |
| 46 | `/terminologia/designaciones-formulario` | V03-09·F · Nueva designación | (c) sin equivalente | no se registra (404) |
| 47 | `/terminologia/designaciones-listado` | V03-09·L · Designaciones | (c) sin equivalente | no se registra (404) |
| 48 | `/terminologia/propiedades-formulario` | V03-10·F · Propiedades del concepto | (c) sin equivalente | no se registra (404) |
| 49 | `/terminologia/propiedades-listado` | V03-10·L · Propiedades | (c) sin equivalente | no se registra (404) |
| 50 | `/terminologia/relaciones-formulario` | V03-11·F · Nueva relación | (c) sin equivalente | no se registra (404) |
| 51 | `/terminologia/relaciones-listado` | V03-11·L · Relaciones | (c) sin equivalente | no se registra (404) |
| 52 | `/terminologia/politicas-de-catalogo-formulario` | V03-12·F · Política de catálogo | (c) sin equivalente | no se registra (404) |
| 53 | `/terminologia/politicas-de-catalogo-listado` | V03-12·L · Políticas de catálogo | (c) sin equivalente | no se registra (404) |
| 54 | `/terminologia/conjuntos-de-valor-formulario` | V03-13·F · Nuevo conjunto de valores | (c) sin equivalente | no se registra (404) |
| 55 | `/terminologia/conjuntos-de-valor-listado` | V03-13·L · Conjuntos de valor | (b) equivalente | → `/administration/terminology` |
| 56 | `/terminologia/consulta-de-concepto-listado` | V03-02·L · Consulta de concepto | (b) equivalente | → `/glossary` |
| 57 | `/terminologia/traduccion-entre-catalogos-formulario` | V03-03·F · Traducción entre catálogos | (c) sin equivalente | no se registra (404) |
| 58 | `/terminologia/conceptos-listado` | V03-07·L · Conceptos | (b) equivalente | → `/glossary` |
| 59 | `/terminologia/expansion-de-conjunto-de-valores-detalle` | V03-14 · Expansión del conjunto de valores | (c) sin equivalente | no se registra (404) |
| 60 | `/directorio/organizaciones-listado` | V04-01·L · Organizaciones | (b) equivalente | → `/administration/organizations` |
| 61 | `/directorio/organizaciones-verificar` | V04-01·A · Verificar la organización | (b) equivalente | → `/administration/organizations` |
| 62 | `/directorio/membresias-dar-de-baja` | V04-02·A · Dar de baja la membresía | (c) sin equivalente | no se registra (404) |
| 63 | `/directorio/membresias-formulario` | V04-02·F · Nueva membresía | (b) equivalente | → `/administration/organizations` |
| 64 | `/directorio/membresias-listado` | V04-02·L · Membresías | (b) equivalente | → `/administration/organizations` |
| 65 | `/directorio/asignaciones-de-sucursal-formulario` | V04-03·F · Asignar la membresía a una sucursal | (c) sin equivalente | no se registra (404) |
| 66 | `/directorio/roles-formulario` | V04-04·F · Cambiar el rol de la membresía | (c) sin equivalente | no se registra (404) |
| 67 | `/directorio/transferencias-formulario` | V04-05·F · Transferir la membresía entre sucursales | (c) sin equivalente | no se registra (404) |
| 68 | `/directorio/sucursales-formulario` | V04-06·F · Nueva sucursal | (b) equivalente | → `/administration/organizations` |
| 69 | `/directorio/sucursales-listado` | V04-06·L · Sucursales | (b) equivalente | → `/administration/organizations` |
| 70 | `/directorio/organizaciones-hijas-formulario` | V04-07·F · Nueva organización hija | (b) equivalente | → `/administration/organizations` |
| 71 | `/directorio/organizaciones-formulario` | V04-01·F · Nueva organización | (b) equivalente | → `/administration/organizations/new` |
| 72 | `/directorio/organizaciones-suspender` | V04-01·A · Suspender la organización | (c) sin equivalente | no se registra (404) |
| 73 | `/personas/pacientes-formulario` | V05-01·F · Nuevo paciente | (b) equivalente | → `/administration/patients/new` |
| 74 | `/personas/pacientes-fusionar` | V05-01·A · Fusionar pacientes | (b) equivalente | → `/administration/patients/merge` |
| 75 | `/personas/pacientes-listado` | V05-01·L · Pacientes | (b) equivalente | → `/administration/patients` |
| 76 | `/personas/pacientes-revertir` | V05-01·A · Revertir la fusión | (b) equivalente | → `/administration/patients/merge` |
| 77 | `/personas/vinculos-de-identidad-formulario` | V05-02·F · Nuevo vínculo de identidad | (c) sin equivalente | no se registra (404) |
| 78 | `/personas/vinculos-de-identidad-listado` | V05-02·L · Vínculos de identidad | (c) sin equivalente | no se registra (404) |
| 79 | `/personas/apoderados-de-portal-formulario` | V05-04·F · Nuevo apoderado de portal | (c) sin equivalente | no se registra (404) |
| 80 | `/personas/apoderados-de-portal-listado` | V05-04·L · Apoderados de portal | (c) sin equivalente | no se registra (404) |
| 81 | `/personas/personas-relacionadas-formulario` | V05-05·F · Nueva persona relacionada | (b) equivalente | → `/administration/patients` |
| 82 | `/personas/personas-relacionadas-listado` | V05-05·L · Personas relacionadas | (b) equivalente | → `/administration/patients` |
| 83 | `/personas/credenciales-listado` | V05-06·L · Credenciales | (c) sin equivalente | no se registra (404) |
| 84 | `/personas/credenciales-verificar` | V05-06·A · Verificar la credencial | (c) sin equivalente | no se registra (404) |
| 85 | `/personas/personas-listado` | V05-07·L · Personas | (c) sin equivalente | no se registra (404) |
| 86 | `/personas/personas-registrar-defuncion` | V05-07·A · Registrar la defunción | (c) sin equivalente | no se registra (404) |
| 87 | `/personas/vinculos-de-cuenta-formulario` | V05-08·F · Nuevo vínculo de cuenta | (c) sin equivalente | no se registra (404) |
| 88 | `/personas/vinculos-de-cuenta-listado` | V05-08·L · Vínculos de cuenta | (c) sin equivalente | no se registra (404) |
| 89 | `/personas/profesionales-formulario` | V05-09·F · Nuevo profesional | (c) sin equivalente | no se registra (404) |
| 90 | `/personas/profesionales-listado` | V05-09·L · Profesionales | (c) sin equivalente | no se registra (404) |
| 91 | `/personas/autorizaciones-de-jurisdiccion-formulario` | V05-10·F · Nueva autorización de jurisdicción | (c) sin equivalente | no se registra (404) |
| 92 | `/personas/autorizaciones-de-jurisdiccion-listado` | V05-10·L · Autorizaciones de jurisdicción | (c) sin equivalente | no se registra (404) |
| 93 | `/personas/especialidades-formulario` | V05-11·F · Nueva especialidad | (c) sin equivalente | no se registra (404) |
| 94 | `/personas/especialidades-listado` | V05-11·L · Especialidades | (c) sin equivalente | no se registra (404) |
| 95 | `/personas/resumen-propio-listado` | V05-03·L · Resumen propio | (b) equivalente | → `/my-account` |
| 96 | `/accesos/acceso-de-emergencia-formulario` | V06-05·F · Acceso de emergencia | (c) sin equivalente | no se registra (404) |
| 97 | `/accesos/accesos-clinicos-del-paciente-formulario` | V06-06·F · Otorgar acceso clínico | (c) sin equivalente | no se registra (404) |
| 98 | `/accesos/accesos-clinicos-del-paciente-listado` | V06-06·L · Accesos clínicos del paciente | (c) sin equivalente | no se registra (404) |
| 99 | `/accesos/relaciones-de-cuidado-formulario` | V06-01·F · Nueva relación de cuidado | (c) sin equivalente | no se registra (404) |
| 100 | `/accesos/relaciones-de-cuidado-listado` | V06-01·L · Relaciones de cuidado | (c) sin equivalente | no se registra (404) |
| 101 | `/accesos/relaciones-de-cuidado-revocar` | V06-01·A · Revocar la relación de cuidado | (c) sin equivalente | no se registra (404) |
| 102 | `/accesos/representaciones-legales-formulario` | V06-02·F · Nueva representación legal | (c) sin equivalente | no se registra (404) |
| 103 | `/accesos/representaciones-legales-listado` | V06-02·L · Representaciones legales | (c) sin equivalente | no se registra (404) |
| 104 | `/accesos/representaciones-legales-revocar` | V06-02·A · Revocar la representación legal | (c) sin equivalente | no se registra (404) |
| 105 | `/accesos/accesos-clinicos-listado` | V06-03·L · Accesos clínicos | (c) sin equivalente | no se registra (404) |
| 106 | `/accesos/accesos-clinicos-revocar` | V06-03·A · Revocar el acceso clínico | (c) sin equivalente | no se registra (404) |
| 107 | `/accesos/decisiones-evaluar` | V06-04·A · Evaluar una decisión de autorización | (c) sin equivalente | no se registra (404) |
| 108 | `/accesos/cache-invalidar` | V06-07·A · Invalidar la caché del PDP | (c) sin equivalente | no se registra (404) |
| 109 | `/accesos/categorias-de-permiso-formulario` | V06-08·F · Nueva categoría de permiso | (c) sin equivalente | no se registra (404) |
| 110 | `/accesos/categorias-de-permiso-listado` | V06-08·L · Categorías de permiso | (c) sin equivalente | no se registra (404) |
| 111 | `/accesos/permisos-formulario` | V06-09·F · Nuevo permiso | (c) sin equivalente | no se registra (404) |
| 112 | `/accesos/permisos-listado` | V06-09·L · Permisos | (c) sin equivalente | no se registra (404) |
| 113 | `/accesos/alcance-de-recurso-formulario` | V06-10·F · Nueva concesión de alcance | (c) sin equivalente | no se registra (404) |
| 114 | `/accesos/alcance-de-recurso-listado` | V06-10·L · Concesiones de alcance de recurso | (c) sin equivalente | no se registra (404) |
| 115 | `/accesos/roles-formulario` | V06-11·F · Nuevo rol | (c) sin equivalente | no se registra (404) |
| 116 | `/accesos/roles-listado` | V06-11·L · Roles | (c) sin equivalente | no se registra (404) |
| 117 | `/accesos/permisos-de-campo-formulario` | V06-12·F · Configurar el enmascaramiento de campos | (c) sin equivalente | no se registra (404) |
| 118 | `/accesos/permisos-de-campo-listado` | V06-12·L · Permisos de campo | (c) sin equivalente | no se registra (404) |
| 119 | `/accesos/permisos-del-rol-formulario` | V06-13·F · Asignar permisos al rol | (c) sin equivalente | no se registra (404) |
| 120 | `/accesos/permisos-del-rol-listado` | V06-13·L · Permisos del rol | (c) sin equivalente | no se registra (404) |
| 121 | `/accesos/politicas-de-acceso-formulario` | V06-14·F · Nueva política de acceso | (c) sin equivalente | no se registra (404) |
| 122 | `/accesos/politicas-de-acceso-listado` | V06-14·L · Políticas de acceso | (c) sin equivalente | no se registra (404) |
| 123 | `/accesos/concesiones-de-permiso-formulario` | V06-15·F · Nueva concesión de permiso | (c) sin equivalente | no se registra (404) |
| 124 | `/accesos/concesiones-de-permiso-listado` | V06-15·L · Concesiones de permiso | (c) sin equivalente | no se registra (404) |
| 125 | `/accesos/asignaciones-de-rol-formulario` | V06-16·F · Asignar un rol | (c) sin equivalente | no se registra (404) |
| 126 | `/accesos/asignaciones-de-rol-listado` | V06-16·L · Asignaciones de rol | (c) sin equivalente | no se registra (404) |

Recuento: 7 (a) · 29 (b) · 90 (c). Raíces de módulo con el gate apagado: `/terminologia`,
`/directorio` y `/personas` redirigen como su equivalente de módulo; `/accesos` y
`/datos-compartidos` dan 404.
