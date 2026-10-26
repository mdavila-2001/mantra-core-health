/* ============================================================================
    Rutas de las pantallas portadas desde la bóveda.

    ARCHIVO GENERADO por scripts/port-vistas-alovida.mjs. Tres marcos: la portada
    va sin marco —es su propio lienzo de punta a punta—, el buscador va bajo el
    marco público, y los cinco módulos de sesión bajo el marco con nav y header.

    Cada pantalla se carga por demanda: son 126, y ninguna sesión
    las abre todas. El title y el arquetipo salen de la ficha de la bóveda.
    ========================================================================== */

import { Routes } from '@angular/router';

export const ALOVIDA_ROUTES: Routes = [
  {
    path: 'home',
    title: "AloVida — la plataforma de operaciones de salud de Mantra Core",
    loadComponent: () => import('@features/alovida/inicio/portada/portada').then((m) => m.InicioPortada),
  },
  {
    path: 'explore',
    loadComponent: () =>
      import('@features/alovida/shell/alovida-public-shell').then((m) => m.AlovidaPublicShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'finder-list' },
      {
        path: 'finder-list',
        title: "V65-01·L · Buscador",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/buscar/buscador-listado/buscador-listado').then((m) => m.BuscarBuscadorListado),
      },
      {
        path: 'practitioners-list',
        title: "V65-02·L · Profesionales",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/buscar/profesionales-listado/profesionales-listado').then((m) => m.BuscarProfesionalesListado),
      },
      {
        path: 'medications-list',
        title: "V65-03·L · Medicamentos y farmacias",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/buscar/medicamentos-listado/medicamentos-listado').then((m) => m.BuscarMedicamentosListado),
      },
      {
        path: 'hospitals-list',
        title: "V65-04·L · Hospitales y clínicas",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/buscar/hospitales-listado/hospitales-listado').then((m) => m.BuscarHospitalesListado),
      },
      {
        path: 'laboratories-list',
        title: "V65-05·L · Laboratorios e imagen",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/buscar/laboratorios-listado/laboratorios-listado').then((m) => m.BuscarLaboratoriosListado),
      },
      {
        path: 'insurers-list',
        title: "V65-06·L · Aseguradoras y convenios",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/buscar/aseguradoras-listado/aseguradoras-listado').then((m) => m.BuscarAseguradorasListado),
      },
      {
        path: 'practitioner-profile-detail',
        title: "V65-07·D · Perfil del profesional",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/alovida/buscar/perfil-profesional-detalle/perfil-profesional-detalle').then((m) => m.BuscarPerfilProfesionalDetalle),
      },
      {
        path: 'organization-profile-detail',
        title: "V65-08·D · Perfil de la organización",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/alovida/buscar/perfil-organizacion-detalle/perfil-organizacion-detalle').then((m) => m.BuscarPerfilOrganizacionDetalle),
      },
      {
        path: 'pharmacy-profile-detail',
        title: "V65-09·D · Perfil de la farmacia",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/alovida/buscar/perfil-farmacia-detalle/perfil-farmacia-detalle').then((m) => m.BuscarPerfilFarmaciaDetalle),
      },
      {
        path: 'laboratory-profile-detail',
        title: "V65-10·D · Perfil del laboratorio",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/alovida/buscar/perfil-laboratorio-detalle/perfil-laboratorio-detalle').then((m) => m.BuscarPerfilLaboratorioDetalle),
      },
      {
        path: 'insurer-profile-detail',
        title: "V65-11·D · Perfil de la aseguradora",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/alovida/buscar/perfil-aseguradora-detalle/perfil-aseguradora-detalle').then((m) => m.BuscarPerfilAseguradoraDetalle),
      },
      {
        path: 'nearby-detail',
        title: "V65-12·D · Cerca mío",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/alovida/buscar/cercania-detalle/cercania-detalle').then((m) => m.BuscarCercaniaDetalle),
      },
      {
        path: 'followed-and-saved-list',
        title: "V65-13·L · Seguidos y guardados",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/buscar/seguidos-y-guardados-listado/seguidos-y-guardados-listado').then((m) => m.BuscarSeguidosYGuardadosListado),
      },
      {
        path: 'rate-care-form',
        title: "V65-14·F · Calificar la atención",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/buscar/calificar-la-atencion-formulario/calificar-la-atencion-formulario').then((m) => m.BuscarCalificarLaAtencionFormulario),
      },
    ],
  },
  {
    path: 'shared-data',
    loadComponent: () =>
      import('@features/alovida/shell/alovida-shell').then((m) => m.AlovidaShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'internal-versions-scan' },
      {
        path: 'internal-versions-scan',
        title: "V02-08·A · Registrar el resultado del escaneo",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/versiones-internas-escanear/versiones-internas-escanear').then((m) => m.DatosCompartidosVersionesInternasEscanear),
      },
      {
        path: 'internal-versions-list',
        title: "V02-08·L · Versiones (archivos)",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/versiones-internas-listado/versiones-internas-listado').then((m) => m.DatosCompartidosVersionesInternasListado),
      },
      {
        path: 'files-delete',
        title: "V02-01·A · Eliminar el archivo",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/archivos-eliminar/archivos-eliminar').then((m) => m.DatosCompartidosArchivosEliminar),
      },
      {
        path: 'files-form',
        title: "V02-01·F · Nuevo archivo",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/archivos-formulario/archivos-formulario').then((m) => m.DatosCompartidosArchivosFormulario),
      },
      {
        path: 'files-list',
        title: "V02-01·L · Archivos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/archivos-listado/archivos-listado').then((m) => m.DatosCompartidosArchivosListado),
      },
      {
        path: 'files-get-link',
        title: "V02-01·A · Obtener el enlace de descarga",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/archivos-obtener-enlace/archivos-obtener-enlace').then((m) => m.DatosCompartidosArchivosObtenerEnlace),
      },
      {
        path: 'files-upload',
        title: "V02-01·A · Subir el contenido de un archivo",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/archivos-subir/archivos-subir').then((m) => m.DatosCompartidosArchivosSubir),
      },
      {
        path: 'content-detail',
        title: "V02-02 · Contenido",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/contenido-detalle/contenido-detalle').then((m) => m.DatosCompartidosContenidoDetalle),
      },
      {
        path: 'links-form',
        title: "V02-03·F · Nuevo vínculo",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/vinculos-formulario/vinculos-formulario').then((m) => m.DatosCompartidosVinculosFormulario),
      },
      {
        path: 'links-list',
        title: "V02-03·L · Vínculos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/vinculos-listado/vinculos-listado').then((m) => m.DatosCompartidosVinculosListado),
      },
      {
        path: 'versions-form',
        title: "V02-04·F · Nueva versión",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/versiones-formulario/versiones-formulario').then((m) => m.DatosCompartidosVersionesFormulario),
      },
      {
        path: 'versions-list',
        title: "V02-04·L · Versiones (archivos)",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/versiones-listado/versiones-listado').then((m) => m.DatosCompartidosVersionesListado),
      },
      {
        path: 'contact-points-form',
        title: "V02-05·F · Nuevo punto de contacto",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/puntos-de-contacto-formulario/puntos-de-contacto-formulario').then((m) => m.DatosCompartidosPuntosDeContactoFormulario),
      },
      {
        path: 'contact-points-list',
        title: "V02-05·L · Puntos de contacto",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/puntos-de-contacto-listado/puntos-de-contacto-listado').then((m) => m.DatosCompartidosPuntosDeContactoListado),
      },
      {
        path: 'contact-points-verify',
        title: "V02-05·A · Verificar el punto de contacto",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/puntos-de-contacto-verificar/puntos-de-contacto-verificar').then((m) => m.DatosCompartidosPuntosDeContactoVerificar),
      },
      {
        path: 'addresses-form',
        title: "V02-06·F · Nueva dirección",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/direcciones-formulario/direcciones-formulario').then((m) => m.DatosCompartidosDireccionesFormulario),
      },
      {
        path: 'addresses-list',
        title: "V02-06·L · Direcciones",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/direcciones-listado/direcciones-listado').then((m) => m.DatosCompartidosDireccionesListado),
      },
      {
        path: 'identifiers-form',
        title: "V02-07·F · Nuevo identificador",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/identificadores-formulario/identificadores-formulario').then((m) => m.DatosCompartidosIdentificadoresFormulario),
      },
      {
        path: 'identifiers-list',
        title: "V02-07·L · Identificadores",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/identificadores-listado/identificadores-listado').then((m) => m.DatosCompartidosIdentificadoresListado),
      },
      {
        path: 'derivatives-form',
        title: "V02-09·F · Nuevo derivado",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/derivados-formulario/derivados-formulario').then((m) => m.DatosCompartidosDerivadosFormulario),
      },
      {
        path: 'derivatives-list',
        title: "V02-09·L · Derivados",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/datos-compartidos/derivados-listado/derivados-listado').then((m) => m.DatosCompartidosDerivadosListado),
      },
    ],
  },
  {
    path: 'vocabulary',
    loadComponent: () =>
      import('@features/alovida/shell/alovida-shell').then((m) => m.AlovidaShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'versions-import' },
      {
        path: 'versions-import',
        title: "V03-01·A · Importar conceptos",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/terminologia/versiones-importar/versiones-importar').then((m) => m.TerminologiaVersionesImportar),
      },
      {
        path: 'versions-list',
        title: "V03-01·L · Versiones de conjuntos de valor",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/terminologia/versiones-listado/versiones-listado').then((m) => m.TerminologiaVersionesListado),
      },
      {
        path: 'versions-publish',
        title: "V03-01·A · Publicar la versión",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/terminologia/versiones-publicar/versiones-publicar').then((m) => m.TerminologiaVersionesPublicar),
      },
      {
        path: 'value-set-expansion-form',
        title: "V03-04·F · Expandir un conjunto de valores",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/terminologia/expansion-de-conjunto-de-valores-formulario/expansion-de-conjunto-de-valores-formulario').then((m) => m.TerminologiaExpansionDeConjuntoDeValoresFormulario),
      },
      {
        path: 'code-systems-form',
        title: "V03-05·F · Nuevo sistema de códigos",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/terminologia/sistemas-de-codigos-formulario/sistemas-de-codigos-formulario').then((m) => m.TerminologiaSistemasDeCodigosFormulario),
      },
      {
        path: 'code-systems-list',
        title: "V03-05·L · Sistemas de códigos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/terminologia/sistemas-de-codigos-listado/sistemas-de-codigos-listado').then((m) => m.TerminologiaSistemasDeCodigosListado),
      },
      {
        path: 'system-versions-form',
        title: "V03-06·F · Nueva versión del sistema de códigos",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/terminologia/versiones-de-sistema-formulario/versiones-de-sistema-formulario').then((m) => m.TerminologiaVersionesDeSistemaFormulario),
      },
      {
        path: 'system-versions-list',
        title: "V03-06·L · Versiones del sistema de códigos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/terminologia/versiones-de-sistema-listado/versiones-de-sistema-listado').then((m) => m.TerminologiaVersionesDeSistemaListado),
      },
      {
        path: 'concept-deprecation-form',
        title: "V03-08·F · Retirar un concepto",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/terminologia/deprecacion-de-concepto-formulario/deprecacion-de-concepto-formulario').then((m) => m.TerminologiaDeprecacionDeConceptoFormulario),
      },
      {
        path: 'designations-form',
        title: "V03-09·F · Nueva designación",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/terminologia/designaciones-formulario/designaciones-formulario').then((m) => m.TerminologiaDesignacionesFormulario),
      },
      {
        path: 'designations-list',
        title: "V03-09·L · Designaciones",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/terminologia/designaciones-listado/designaciones-listado').then((m) => m.TerminologiaDesignacionesListado),
      },
      {
        path: 'properties-form',
        title: "V03-10·F · Propiedades del concepto",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/terminologia/propiedades-formulario/propiedades-formulario').then((m) => m.TerminologiaPropiedadesFormulario),
      },
      {
        path: 'properties-list',
        title: "V03-10·L · Propiedades",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/terminologia/propiedades-listado/propiedades-listado').then((m) => m.TerminologiaPropiedadesListado),
      },
      {
        path: 'relationships-form',
        title: "V03-11·F · Nueva relación",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/terminologia/relaciones-formulario/relaciones-formulario').then((m) => m.TerminologiaRelacionesFormulario),
      },
      {
        path: 'relationships-list',
        title: "V03-11·L · Relaciones",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/terminologia/relaciones-listado/relaciones-listado').then((m) => m.TerminologiaRelacionesListado),
      },
      {
        path: 'catalog-policies-form',
        title: "V03-12·F · Política de catálogo",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/terminologia/politicas-de-catalogo-formulario/politicas-de-catalogo-formulario').then((m) => m.TerminologiaPoliticasDeCatalogoFormulario),
      },
      {
        path: 'catalog-policies-list',
        title: "V03-12·L · Políticas de catálogo",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/terminologia/politicas-de-catalogo-listado/politicas-de-catalogo-listado').then((m) => m.TerminologiaPoliticasDeCatalogoListado),
      },
      {
        path: 'value-sets-form',
        title: "V03-13·F · Nuevo conjunto de valores",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/terminologia/conjuntos-de-valor-formulario/conjuntos-de-valor-formulario').then((m) => m.TerminologiaConjuntosDeValorFormulario),
      },
      {
        path: 'value-sets-list',
        title: "V03-13·L · Conjuntos de valor",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/terminologia/conjuntos-de-valor-listado/conjuntos-de-valor-listado').then((m) => m.TerminologiaConjuntosDeValorListado),
      },
      {
        path: 'concept-lookup-list',
        title: "V03-02·L · Consulta de concepto",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/terminologia/consulta-de-concepto-listado/consulta-de-concepto-listado').then((m) => m.TerminologiaConsultaDeConceptoListado),
      },
      {
        path: 'catalog-translation-form',
        title: "V03-03·F · Traducción entre catálogos",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/terminologia/traduccion-entre-catalogos-formulario/traduccion-entre-catalogos-formulario').then((m) => m.TerminologiaTraduccionEntreCatalogosFormulario),
      },
      {
        path: 'concepts-list',
        title: "V03-07·L · Conceptos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/terminologia/conceptos-listado/conceptos-listado').then((m) => m.TerminologiaConceptosListado),
      },
      {
        path: 'value-set-expansion-detail',
        title: "V03-14 · Expansión del conjunto de valores",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/alovida/terminologia/expansion-de-conjunto-de-valores-detalle/expansion-de-conjunto-de-valores-detalle').then((m) => m.TerminologiaExpansionDeConjuntoDeValoresDetalle),
      },
    ],
  },
  {
    path: 'institutions',
    loadComponent: () =>
      import('@features/alovida/shell/alovida-shell').then((m) => m.AlovidaShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'organizations-list' },
      {
        path: 'organizations-list',
        title: "V04-01·L · Organizaciones",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/directorio/organizaciones-listado/organizaciones-listado').then((m) => m.DirectorioOrganizacionesListado),
      },
      {
        path: 'organizations-verify',
        title: "V04-01·A · Verificar la organización",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/directorio/organizaciones-verificar/organizaciones-verificar').then((m) => m.DirectorioOrganizacionesVerificar),
      },
      {
        path: 'memberships-deactivate',
        title: "V04-02·A · Dar de baja la membresía",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/directorio/membresias-dar-de-baja/membresias-dar-de-baja').then((m) => m.DirectorioMembresiasDarDeBaja),
      },
      {
        path: 'memberships-form',
        title: "V04-02·F · Nueva membresía",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/directorio/membresias-formulario/membresias-formulario').then((m) => m.DirectorioMembresiasFormulario),
      },
      {
        path: 'memberships-list',
        title: "V04-02·L · Membresías",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/directorio/membresias-listado/membresias-listado').then((m) => m.DirectorioMembresiasListado),
      },
      {
        path: 'branch-assignments-form',
        title: "V04-03·F · Asignar la membresía a una sucursal",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/directorio/asignaciones-de-sucursal-formulario/asignaciones-de-sucursal-formulario').then((m) => m.DirectorioAsignacionesDeSucursalFormulario),
      },
      {
        path: 'roles-form',
        title: "V04-04·F · Cambiar el rol de la membresía",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/directorio/roles-formulario/roles-formulario').then((m) => m.DirectorioRolesFormulario),
      },
      {
        path: 'transfers-form',
        title: "V04-05·F · Transferir la membresía entre sucursales",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/directorio/transferencias-formulario/transferencias-formulario').then((m) => m.DirectorioTransferenciasFormulario),
      },
      {
        path: 'branches-form',
        title: "V04-06·F · Nueva sucursal",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/directorio/sucursales-formulario/sucursales-formulario').then((m) => m.DirectorioSucursalesFormulario),
      },
      {
        path: 'branches-list',
        title: "V04-06·L · Sucursales",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/directorio/sucursales-listado/sucursales-listado').then((m) => m.DirectorioSucursalesListado),
      },
      {
        path: 'child-organizations-form',
        title: "V04-07·F · Nueva organización hija",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/directorio/organizaciones-hijas-formulario/organizaciones-hijas-formulario').then((m) => m.DirectorioOrganizacionesHijasFormulario),
      },
      {
        path: 'organizations-form',
        title: "V04-01·F · Nueva organización",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/directorio/organizaciones-formulario/organizaciones-formulario').then((m) => m.DirectorioOrganizacionesFormulario),
      },
      {
        path: 'organizations-suspend',
        title: "V04-01·A · Suspender la organización",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/directorio/organizaciones-suspender/organizaciones-suspender').then((m) => m.DirectorioOrganizacionesSuspender),
      },
    ],
  },
  {
    path: 'people',
    loadComponent: () =>
      import('@features/alovida/shell/alovida-shell').then((m) => m.AlovidaShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'patients-form' },
      {
        path: 'patients-form',
        title: "V05-01·F · Nuevo paciente",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/personas/pacientes-formulario/pacientes-formulario').then((m) => m.PersonasPacientesFormulario),
      },
      {
        path: 'patients-merge',
        title: "V05-01·A · Fusionar pacientes",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/personas/pacientes-fusionar/pacientes-fusionar').then((m) => m.PersonasPacientesFusionar),
      },
      {
        path: 'patients-list',
        title: "V05-01·L · Pacientes",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/pacientes-listado/pacientes-listado').then((m) => m.PersonasPacientesListado),
      },
      {
        path: 'patients-revert',
        title: "V05-01·A · Revertir la fusión",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/personas/pacientes-revertir/pacientes-revertir').then((m) => m.PersonasPacientesRevertir),
      },
      {
        path: 'identity-links-form',
        title: "V05-02·F · Nuevo vínculo de identidad",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/personas/vinculos-de-identidad-formulario/vinculos-de-identidad-formulario').then((m) => m.PersonasVinculosDeIdentidadFormulario),
      },
      {
        path: 'identity-links-list',
        title: "V05-02·L · Vínculos de identidad",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/vinculos-de-identidad-listado/vinculos-de-identidad-listado').then((m) => m.PersonasVinculosDeIdentidadListado),
      },
      {
        path: 'portal-proxies-form',
        title: "V05-04·F · Nuevo apoderado de portal",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/personas/apoderados-de-portal-formulario/apoderados-de-portal-formulario').then((m) => m.PersonasApoderadosDePortalFormulario),
      },
      {
        path: 'portal-proxies-list',
        title: "V05-04·L · Apoderados de portal",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/apoderados-de-portal-listado/apoderados-de-portal-listado').then((m) => m.PersonasApoderadosDePortalListado),
      },
      {
        path: 'related-persons-form',
        title: "V05-05·F · Nueva persona relacionada",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/personas/personas-relacionadas-formulario/personas-relacionadas-formulario').then((m) => m.PersonasRelacionadasFormulario),
      },
      {
        path: 'related-persons-list',
        title: "V05-05·L · Personas relacionadas",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/personas-relacionadas-listado/personas-relacionadas-listado').then((m) => m.PersonasRelacionadasListado),
      },
      {
        path: 'credentials-list',
        title: "V05-06·L · Credenciales",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/credenciales-listado/credenciales-listado').then((m) => m.PersonasCredencialesListado),
      },
      {
        path: 'credentials-verify',
        title: "V05-06·A · Verificar la credencial",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/personas/credenciales-verificar/credenciales-verificar').then((m) => m.PersonasCredencialesVerificar),
      },
      {
        path: 'people-list',
        title: "V05-07·L · Personas",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/personas-listado/personas-listado').then((m) => m.PersonasListado),
      },
      {
        path: 'people-record-death',
        title: "V05-07·A · Registrar la defunción",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/personas/personas-registrar-defuncion/personas-registrar-defuncion').then((m) => m.PersonasRegistrarDefuncion),
      },
      {
        path: 'account-links-form',
        title: "V05-08·F · Nuevo vínculo de cuenta",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/personas/vinculos-de-cuenta-formulario/vinculos-de-cuenta-formulario').then((m) => m.PersonasVinculosDeCuentaFormulario),
      },
      {
        path: 'account-links-list',
        title: "V05-08·L · Vínculos de cuenta",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/vinculos-de-cuenta-listado/vinculos-de-cuenta-listado').then((m) => m.PersonasVinculosDeCuentaListado),
      },
      {
        path: 'practitioners-form',
        title: "V05-09·F · Nuevo profesional",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/personas/profesionales-formulario/profesionales-formulario').then((m) => m.PersonasProfesionalesFormulario),
      },
      {
        path: 'practitioners-list',
        title: "V05-09·L · Profesionales",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/profesionales-listado/profesionales-listado').then((m) => m.PersonasProfesionalesListado),
      },
      {
        path: 'jurisdiction-authorizations-form',
        title: "V05-10·F · Nueva autorización de jurisdicción",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/personas/autorizaciones-de-jurisdiccion-formulario/autorizaciones-de-jurisdiccion-formulario').then((m) => m.PersonasAutorizacionesDeJurisdiccionFormulario),
      },
      {
        path: 'jurisdiction-authorizations-list',
        title: "V05-10·L · Autorizaciones de jurisdicción",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/autorizaciones-de-jurisdiccion-listado/autorizaciones-de-jurisdiccion-listado').then((m) => m.PersonasAutorizacionesDeJurisdiccionListado),
      },
      {
        path: 'specialties-form',
        title: "V05-11·F · Nueva especialidad",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/personas/especialidades-formulario/especialidades-formulario').then((m) => m.PersonasEspecialidadesFormulario),
      },
      {
        path: 'specialties-list',
        title: "V05-11·L · Especialidades",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/especialidades-listado/especialidades-listado').then((m) => m.PersonasEspecialidadesListado),
      },
      {
        path: 'own-summary-list',
        title: "V05-03·L · Resumen propio",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/personas/resumen-propio-listado/resumen-propio-listado').then((m) => m.PersonasResumenPropioListado),
      },
    ],
  },
  {
    path: 'access',
    loadComponent: () =>
      import('@features/alovida/shell/alovida-shell').then((m) => m.AlovidaShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'emergency-access-form' },
      {
        path: 'emergency-access-form',
        title: "V06-05·F · Acceso de emergencia",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/acceso-de-emergencia-formulario/acceso-de-emergencia-formulario').then((m) => m.AccesosAccesoDeEmergenciaFormulario),
      },
      {
        path: 'patient-clinical-access-form',
        title: "V06-06·F · Otorgar acceso clínico",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/accesos-clinicos-del-paciente-formulario/accesos-clinicos-del-paciente-formulario').then((m) => m.AccesosClinicosDelPacienteFormulario),
      },
      {
        path: 'patient-clinical-access-list',
        title: "V06-06·L · Accesos clínicos del paciente",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/accesos-clinicos-del-paciente-listado/accesos-clinicos-del-paciente-listado').then((m) => m.AccesosClinicosDelPacienteListado),
      },
      {
        path: 'care-relationships-form',
        title: "V06-01·F · Nueva relación de cuidado",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/relaciones-de-cuidado-formulario/relaciones-de-cuidado-formulario').then((m) => m.AccesosRelacionesDeCuidadoFormulario),
      },
      {
        path: 'care-relationships-list',
        title: "V06-01·L · Relaciones de cuidado",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/relaciones-de-cuidado-listado/relaciones-de-cuidado-listado').then((m) => m.AccesosRelacionesDeCuidadoListado),
      },
      {
        path: 'care-relationships-revoke',
        title: "V06-01·A · Revocar la relación de cuidado",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/accesos/relaciones-de-cuidado-revocar/relaciones-de-cuidado-revocar').then((m) => m.AccesosRelacionesDeCuidadoRevocar),
      },
      {
        path: 'legal-representations-form',
        title: "V06-02·F · Nueva representación legal",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/representaciones-legales-formulario/representaciones-legales-formulario').then((m) => m.AccesosRepresentacionesLegalesFormulario),
      },
      {
        path: 'legal-representations-list',
        title: "V06-02·L · Representaciones legales",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/representaciones-legales-listado/representaciones-legales-listado').then((m) => m.AccesosRepresentacionesLegalesListado),
      },
      {
        path: 'legal-representations-revoke',
        title: "V06-02·A · Revocar la representación legal",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/accesos/representaciones-legales-revocar/representaciones-legales-revocar').then((m) => m.AccesosRepresentacionesLegalesRevocar),
      },
      {
        path: 'clinical-access-list',
        title: "V06-03·L · Accesos clínicos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/accesos-clinicos-listado/accesos-clinicos-listado').then((m) => m.AccesosClinicosListado),
      },
      {
        path: 'clinical-access-revoke',
        title: "V06-03·A · Revocar el acceso clínico",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/accesos/accesos-clinicos-revocar/accesos-clinicos-revocar').then((m) => m.AccesosClinicosRevocar),
      },
      {
        path: 'decisions-evaluate',
        title: "V06-04·A · Evaluar una decisión de autorización",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/accesos/decisiones-evaluar/decisiones-evaluar').then((m) => m.AccesosDecisionesEvaluar),
      },
      {
        path: 'cache-invalidate',
        title: "V06-07·A · Invalidar la caché del PDP",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/alovida/accesos/cache-invalidar/cache-invalidar').then((m) => m.AccesosCacheInvalidar),
      },
      {
        path: 'permission-categories-form',
        title: "V06-08·F · Nueva categoría de permiso",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/categorias-de-permiso-formulario/categorias-de-permiso-formulario').then((m) => m.AccesosCategoriasDePermisoFormulario),
      },
      {
        path: 'permission-categories-list',
        title: "V06-08·L · Categorías de permiso",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/categorias-de-permiso-listado/categorias-de-permiso-listado').then((m) => m.AccesosCategoriasDePermisoListado),
      },
      {
        path: 'permissions-form',
        title: "V06-09·F · Nuevo permiso",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/permisos-formulario/permisos-formulario').then((m) => m.AccesosPermisosFormulario),
      },
      {
        path: 'permissions-list',
        title: "V06-09·L · Permisos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/permisos-listado/permisos-listado').then((m) => m.AccesosPermisosListado),
      },
      {
        path: 'resource-scope-form',
        title: "V06-10·F · Nueva concesión de alcance",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/alcance-de-recurso-formulario/alcance-de-recurso-formulario').then((m) => m.AccesosAlcanceDeRecursoFormulario),
      },
      {
        path: 'resource-scope-list',
        title: "V06-10·L · Concesiones de alcance de recurso",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/alcance-de-recurso-listado/alcance-de-recurso-listado').then((m) => m.AccesosAlcanceDeRecursoListado),
      },
      {
        path: 'roles-form',
        title: "V06-11·F · Nuevo rol",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/roles-formulario/roles-formulario').then((m) => m.AccesosRolesFormulario),
      },
      {
        path: 'roles-list',
        title: "V06-11·L · Roles",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/roles-listado/roles-listado').then((m) => m.AccesosRolesListado),
      },
      {
        path: 'field-permissions-form',
        title: "V06-12·F · Configurar el enmascaramiento de campos",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/permisos-de-campo-formulario/permisos-de-campo-formulario').then((m) => m.AccesosPermisosDeCampoFormulario),
      },
      {
        path: 'field-permissions-list',
        title: "V06-12·L · Permisos de campo",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/permisos-de-campo-listado/permisos-de-campo-listado').then((m) => m.AccesosPermisosDeCampoListado),
      },
      {
        path: 'role-permissions-form',
        title: "V06-13·F · Asignar permisos al rol",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/permisos-del-rol-formulario/permisos-del-rol-formulario').then((m) => m.AccesosPermisosDelRolFormulario),
      },
      {
        path: 'role-permissions-list',
        title: "V06-13·L · Permisos del rol",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/permisos-del-rol-listado/permisos-del-rol-listado').then((m) => m.AccesosPermisosDelRolListado),
      },
      {
        path: 'access-policies-form',
        title: "V06-14·F · Nueva política de acceso",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/politicas-de-acceso-formulario/politicas-de-acceso-formulario').then((m) => m.AccesosPoliticasDeAccesoFormulario),
      },
      {
        path: 'access-policies-list',
        title: "V06-14·L · Políticas de acceso",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/politicas-de-acceso-listado/politicas-de-acceso-listado').then((m) => m.AccesosPoliticasDeAccesoListado),
      },
      {
        path: 'permission-grants-form',
        title: "V06-15·F · Nueva concesión de permiso",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/concesiones-de-permiso-formulario/concesiones-de-permiso-formulario').then((m) => m.AccesosConcesionesDePermisoFormulario),
      },
      {
        path: 'permission-grants-list',
        title: "V06-15·L · Concesiones de permiso",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/concesiones-de-permiso-listado/concesiones-de-permiso-listado').then((m) => m.AccesosConcesionesDePermisoListado),
      },
      {
        path: 'role-assignments-form',
        title: "V06-16·F · Asignar un rol",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/alovida/accesos/asignaciones-de-rol-formulario/asignaciones-de-rol-formulario').then((m) => m.AccesosAsignacionesDeRolFormulario),
      },
      {
        path: 'role-assignments-list',
        title: "V06-16·L · Asignaciones de rol",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/alovida/accesos/asignaciones-de-rol-listado/asignaciones-de-rol-listado').then((m) => m.AccesosAsignacionesDeRolListado),
      },
    ],
  },
];
