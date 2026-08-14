/* ============================================================================
    Rutas de las pantallas portadas desde la bóveda.

    ARCHIVO GENERADO por scripts/port-vistas-redsat.mjs. Tres marcos: la portada
    va sin marco —es su propio lienzo de punta a punta—, el buscador va bajo el
    marco público, y los cinco módulos de sesión bajo el marco con nav y header.

    Cada pantalla se carga por demanda: son 126, y ninguna sesión
    las abre todas. El title y el arquetipo salen de la ficha de la bóveda.
    ========================================================================== */

import { Routes } from '@angular/router';

export const REDSAT_ROUTES: Routes = [
  {
    path: 'inicio',
    title: "AloVida — la plataforma de operaciones de salud de Mantra Core",
    loadComponent: () => import('@features/redsat/inicio/portada/portada').then((m) => m.InicioPortada),
  },
  {
    path: 'buscar',
    loadComponent: () =>
      import('@features/redsat/shell/redsat-public-shell').then((m) => m.RedsatPublicShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'buscador-listado' },
      {
        path: 'buscador-listado',
        title: "V65-01·L · Buscador",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/buscar/buscador-listado/buscador-listado').then((m) => m.BuscarBuscadorListado),
      },
      {
        path: 'profesionales-listado',
        title: "V65-02·L · Profesionales",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/buscar/profesionales-listado/profesionales-listado').then((m) => m.BuscarProfesionalesListado),
      },
      {
        path: 'medicamentos-listado',
        title: "V65-03·L · Medicamentos y farmacias",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/buscar/medicamentos-listado/medicamentos-listado').then((m) => m.BuscarMedicamentosListado),
      },
      {
        path: 'hospitales-listado',
        title: "V65-04·L · Hospitales y clínicas",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/buscar/hospitales-listado/hospitales-listado').then((m) => m.BuscarHospitalesListado),
      },
      {
        path: 'laboratorios-listado',
        title: "V65-05·L · Laboratorios e imagen",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/buscar/laboratorios-listado/laboratorios-listado').then((m) => m.BuscarLaboratoriosListado),
      },
      {
        path: 'aseguradoras-listado',
        title: "V65-06·L · Aseguradoras y convenios",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/buscar/aseguradoras-listado/aseguradoras-listado').then((m) => m.BuscarAseguradorasListado),
      },
      {
        path: 'perfil-profesional-detalle',
        title: "V65-07·D · Perfil del profesional",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/redsat/buscar/perfil-profesional-detalle/perfil-profesional-detalle').then((m) => m.BuscarPerfilProfesionalDetalle),
      },
      {
        path: 'perfil-organizacion-detalle',
        title: "V65-08·D · Perfil de la organización",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/redsat/buscar/perfil-organizacion-detalle/perfil-organizacion-detalle').then((m) => m.BuscarPerfilOrganizacionDetalle),
      },
      {
        path: 'perfil-farmacia-detalle',
        title: "V65-09·D · Perfil de la farmacia",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/redsat/buscar/perfil-farmacia-detalle/perfil-farmacia-detalle').then((m) => m.BuscarPerfilFarmaciaDetalle),
      },
      {
        path: 'perfil-laboratorio-detalle',
        title: "V65-10·D · Perfil del laboratorio",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/redsat/buscar/perfil-laboratorio-detalle/perfil-laboratorio-detalle').then((m) => m.BuscarPerfilLaboratorioDetalle),
      },
      {
        path: 'perfil-aseguradora-detalle',
        title: "V65-11·D · Perfil de la aseguradora",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/redsat/buscar/perfil-aseguradora-detalle/perfil-aseguradora-detalle').then((m) => m.BuscarPerfilAseguradoraDetalle),
      },
      {
        path: 'cercania-detalle',
        title: "V65-12·D · Cerca mío",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/redsat/buscar/cercania-detalle/cercania-detalle').then((m) => m.BuscarCercaniaDetalle),
      },
      {
        path: 'seguidos-y-guardados-listado',
        title: "V65-13·L · Seguidos y guardados",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/buscar/seguidos-y-guardados-listado/seguidos-y-guardados-listado').then((m) => m.BuscarSeguidosYGuardadosListado),
      },
      {
        path: 'calificar-la-atencion-formulario',
        title: "V65-14·F · Calificar la atención",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/buscar/calificar-la-atencion-formulario/calificar-la-atencion-formulario').then((m) => m.BuscarCalificarLaAtencionFormulario),
      },
    ],
  },
  {
    path: 'datos-compartidos',
    loadComponent: () =>
      import('@features/redsat/shell/redsat-shell').then((m) => m.RedsatShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'versiones-internas-escanear' },
      {
        path: 'versiones-internas-escanear',
        title: "V02-08·A · Registrar el resultado del escaneo",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/versiones-internas-escanear/versiones-internas-escanear').then((m) => m.DatosCompartidosVersionesInternasEscanear),
      },
      {
        path: 'versiones-internas-listado',
        title: "V02-08·L · Versiones (archivos)",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/versiones-internas-listado/versiones-internas-listado').then((m) => m.DatosCompartidosVersionesInternasListado),
      },
      {
        path: 'archivos-eliminar',
        title: "V02-01·A · Eliminar el archivo",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/archivos-eliminar/archivos-eliminar').then((m) => m.DatosCompartidosArchivosEliminar),
      },
      {
        path: 'archivos-formulario',
        title: "V02-01·F · Nuevo archivo",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/archivos-formulario/archivos-formulario').then((m) => m.DatosCompartidosArchivosFormulario),
      },
      {
        path: 'archivos-listado',
        title: "V02-01·L · Archivos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/archivos-listado/archivos-listado').then((m) => m.DatosCompartidosArchivosListado),
      },
      {
        path: 'archivos-obtener-enlace',
        title: "V02-01·A · Obtener el enlace de descarga",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/archivos-obtener-enlace/archivos-obtener-enlace').then((m) => m.DatosCompartidosArchivosObtenerEnlace),
      },
      {
        path: 'archivos-subir',
        title: "V02-01·A · Subir el contenido de un archivo",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/archivos-subir/archivos-subir').then((m) => m.DatosCompartidosArchivosSubir),
      },
      {
        path: 'contenido-detalle',
        title: "V02-02 · Contenido",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/contenido-detalle/contenido-detalle').then((m) => m.DatosCompartidosContenidoDetalle),
      },
      {
        path: 'vinculos-formulario',
        title: "V02-03·F · Nuevo vínculo",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/vinculos-formulario/vinculos-formulario').then((m) => m.DatosCompartidosVinculosFormulario),
      },
      {
        path: 'vinculos-listado',
        title: "V02-03·L · Vínculos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/vinculos-listado/vinculos-listado').then((m) => m.DatosCompartidosVinculosListado),
      },
      {
        path: 'versiones-formulario',
        title: "V02-04·F · Nueva versión",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/versiones-formulario/versiones-formulario').then((m) => m.DatosCompartidosVersionesFormulario),
      },
      {
        path: 'versiones-listado',
        title: "V02-04·L · Versiones (archivos)",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/versiones-listado/versiones-listado').then((m) => m.DatosCompartidosVersionesListado),
      },
      {
        path: 'puntos-de-contacto-formulario',
        title: "V02-05·F · Nuevo punto de contacto",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/puntos-de-contacto-formulario/puntos-de-contacto-formulario').then((m) => m.DatosCompartidosPuntosDeContactoFormulario),
      },
      {
        path: 'puntos-de-contacto-listado',
        title: "V02-05·L · Puntos de contacto",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/puntos-de-contacto-listado/puntos-de-contacto-listado').then((m) => m.DatosCompartidosPuntosDeContactoListado),
      },
      {
        path: 'puntos-de-contacto-verificar',
        title: "V02-05·A · Verificar el punto de contacto",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/puntos-de-contacto-verificar/puntos-de-contacto-verificar').then((m) => m.DatosCompartidosPuntosDeContactoVerificar),
      },
      {
        path: 'direcciones-formulario',
        title: "V02-06·F · Nueva dirección",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/direcciones-formulario/direcciones-formulario').then((m) => m.DatosCompartidosDireccionesFormulario),
      },
      {
        path: 'direcciones-listado',
        title: "V02-06·L · Direcciones",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/direcciones-listado/direcciones-listado').then((m) => m.DatosCompartidosDireccionesListado),
      },
      {
        path: 'identificadores-formulario',
        title: "V02-07·F · Nuevo identificador",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/identificadores-formulario/identificadores-formulario').then((m) => m.DatosCompartidosIdentificadoresFormulario),
      },
      {
        path: 'identificadores-listado',
        title: "V02-07·L · Identificadores",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/identificadores-listado/identificadores-listado').then((m) => m.DatosCompartidosIdentificadoresListado),
      },
      {
        path: 'derivados-formulario',
        title: "V02-09·F · Nuevo derivado",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/derivados-formulario/derivados-formulario').then((m) => m.DatosCompartidosDerivadosFormulario),
      },
      {
        path: 'derivados-listado',
        title: "V02-09·L · Derivados",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/datos-compartidos/derivados-listado/derivados-listado').then((m) => m.DatosCompartidosDerivadosListado),
      },
    ],
  },
  {
    path: 'terminologia',
    loadComponent: () =>
      import('@features/redsat/shell/redsat-shell').then((m) => m.RedsatShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'versiones-importar' },
      {
        path: 'versiones-importar',
        title: "V03-01·A · Importar conceptos",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/terminologia/versiones-importar/versiones-importar').then((m) => m.TerminologiaVersionesImportar),
      },
      {
        path: 'versiones-listado',
        title: "V03-01·L · Versiones de conjuntos de valor",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/terminologia/versiones-listado/versiones-listado').then((m) => m.TerminologiaVersionesListado),
      },
      {
        path: 'versiones-publicar',
        title: "V03-01·A · Publicar la versión",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/terminologia/versiones-publicar/versiones-publicar').then((m) => m.TerminologiaVersionesPublicar),
      },
      {
        path: 'expansion-de-conjunto-de-valores-formulario',
        title: "V03-04·F · Expandir un conjunto de valores",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/terminologia/expansion-de-conjunto-de-valores-formulario/expansion-de-conjunto-de-valores-formulario').then((m) => m.TerminologiaExpansionDeConjuntoDeValoresFormulario),
      },
      {
        path: 'sistemas-de-codigos-formulario',
        title: "V03-05·F · Nuevo sistema de códigos",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/terminologia/sistemas-de-codigos-formulario/sistemas-de-codigos-formulario').then((m) => m.TerminologiaSistemasDeCodigosFormulario),
      },
      {
        path: 'sistemas-de-codigos-listado',
        title: "V03-05·L · Sistemas de códigos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/terminologia/sistemas-de-codigos-listado/sistemas-de-codigos-listado').then((m) => m.TerminologiaSistemasDeCodigosListado),
      },
      {
        path: 'versiones-de-sistema-formulario',
        title: "V03-06·F · Nueva versión del sistema de códigos",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/terminologia/versiones-de-sistema-formulario/versiones-de-sistema-formulario').then((m) => m.TerminologiaVersionesDeSistemaFormulario),
      },
      {
        path: 'versiones-de-sistema-listado',
        title: "V03-06·L · Versiones del sistema de códigos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/terminologia/versiones-de-sistema-listado/versiones-de-sistema-listado').then((m) => m.TerminologiaVersionesDeSistemaListado),
      },
      {
        path: 'deprecacion-de-concepto-formulario',
        title: "V03-08·F · Retirar un concepto",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/terminologia/deprecacion-de-concepto-formulario/deprecacion-de-concepto-formulario').then((m) => m.TerminologiaDeprecacionDeConceptoFormulario),
      },
      {
        path: 'designaciones-formulario',
        title: "V03-09·F · Nueva designación",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/terminologia/designaciones-formulario/designaciones-formulario').then((m) => m.TerminologiaDesignacionesFormulario),
      },
      {
        path: 'designaciones-listado',
        title: "V03-09·L · Designaciones",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/terminologia/designaciones-listado/designaciones-listado').then((m) => m.TerminologiaDesignacionesListado),
      },
      {
        path: 'propiedades-formulario',
        title: "V03-10·F · Propiedades del concepto",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/terminologia/propiedades-formulario/propiedades-formulario').then((m) => m.TerminologiaPropiedadesFormulario),
      },
      {
        path: 'propiedades-listado',
        title: "V03-10·L · Propiedades",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/terminologia/propiedades-listado/propiedades-listado').then((m) => m.TerminologiaPropiedadesListado),
      },
      {
        path: 'relaciones-formulario',
        title: "V03-11·F · Nueva relación",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/terminologia/relaciones-formulario/relaciones-formulario').then((m) => m.TerminologiaRelacionesFormulario),
      },
      {
        path: 'relaciones-listado',
        title: "V03-11·L · Relaciones",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/terminologia/relaciones-listado/relaciones-listado').then((m) => m.TerminologiaRelacionesListado),
      },
      {
        path: 'politicas-de-catalogo-formulario',
        title: "V03-12·F · Política de catálogo",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/terminologia/politicas-de-catalogo-formulario/politicas-de-catalogo-formulario').then((m) => m.TerminologiaPoliticasDeCatalogoFormulario),
      },
      {
        path: 'politicas-de-catalogo-listado',
        title: "V03-12·L · Políticas de catálogo",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/terminologia/politicas-de-catalogo-listado/politicas-de-catalogo-listado').then((m) => m.TerminologiaPoliticasDeCatalogoListado),
      },
      {
        path: 'conjuntos-de-valor-formulario',
        title: "V03-13·F · Nuevo conjunto de valores",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/terminologia/conjuntos-de-valor-formulario/conjuntos-de-valor-formulario').then((m) => m.TerminologiaConjuntosDeValorFormulario),
      },
      {
        path: 'conjuntos-de-valor-listado',
        title: "V03-13·L · Conjuntos de valor",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/terminologia/conjuntos-de-valor-listado/conjuntos-de-valor-listado').then((m) => m.TerminologiaConjuntosDeValorListado),
      },
      {
        path: 'consulta-de-concepto-listado',
        title: "V03-02·L · Consulta de concepto",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/terminologia/consulta-de-concepto-listado/consulta-de-concepto-listado').then((m) => m.TerminologiaConsultaDeConceptoListado),
      },
      {
        path: 'traduccion-entre-catalogos-formulario',
        title: "V03-03·F · Traducción entre catálogos",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/terminologia/traduccion-entre-catalogos-formulario/traduccion-entre-catalogos-formulario').then((m) => m.TerminologiaTraduccionEntreCatalogosFormulario),
      },
      {
        path: 'conceptos-listado',
        title: "V03-07·L · Conceptos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/terminologia/conceptos-listado/conceptos-listado').then((m) => m.TerminologiaConceptosListado),
      },
      {
        path: 'expansion-de-conjunto-de-valores-detalle',
        title: "V03-14 · Expansión del conjunto de valores",
        data: { arquetipo: 'detalle' },
        loadComponent: () =>
          import('@features/redsat/terminologia/expansion-de-conjunto-de-valores-detalle/expansion-de-conjunto-de-valores-detalle').then((m) => m.TerminologiaExpansionDeConjuntoDeValoresDetalle),
      },
    ],
  },
  {
    path: 'directorio',
    loadComponent: () =>
      import('@features/redsat/shell/redsat-shell').then((m) => m.RedsatShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'organizaciones-listado' },
      {
        path: 'organizaciones-listado',
        title: "V04-01·L · Organizaciones",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/directorio/organizaciones-listado/organizaciones-listado').then((m) => m.DirectorioOrganizacionesListado),
      },
      {
        path: 'organizaciones-verificar',
        title: "V04-01·A · Verificar la organización",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/directorio/organizaciones-verificar/organizaciones-verificar').then((m) => m.DirectorioOrganizacionesVerificar),
      },
      {
        path: 'membresias-dar-de-baja',
        title: "V04-02·A · Dar de baja la membresía",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/directorio/membresias-dar-de-baja/membresias-dar-de-baja').then((m) => m.DirectorioMembresiasDarDeBaja),
      },
      {
        path: 'membresias-formulario',
        title: "V04-02·F · Nueva membresía",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/directorio/membresias-formulario/membresias-formulario').then((m) => m.DirectorioMembresiasFormulario),
      },
      {
        path: 'membresias-listado',
        title: "V04-02·L · Membresías",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/directorio/membresias-listado/membresias-listado').then((m) => m.DirectorioMembresiasListado),
      },
      {
        path: 'asignaciones-de-sucursal-formulario',
        title: "V04-03·F · Asignar la membresía a una sucursal",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/directorio/asignaciones-de-sucursal-formulario/asignaciones-de-sucursal-formulario').then((m) => m.DirectorioAsignacionesDeSucursalFormulario),
      },
      {
        path: 'roles-formulario',
        title: "V04-04·F · Cambiar el rol de la membresía",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/directorio/roles-formulario/roles-formulario').then((m) => m.DirectorioRolesFormulario),
      },
      {
        path: 'transferencias-formulario',
        title: "V04-05·F · Transferir la membresía entre sucursales",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/directorio/transferencias-formulario/transferencias-formulario').then((m) => m.DirectorioTransferenciasFormulario),
      },
      {
        path: 'sucursales-formulario',
        title: "V04-06·F · Nueva sucursal",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/directorio/sucursales-formulario/sucursales-formulario').then((m) => m.DirectorioSucursalesFormulario),
      },
      {
        path: 'sucursales-listado',
        title: "V04-06·L · Sucursales",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/directorio/sucursales-listado/sucursales-listado').then((m) => m.DirectorioSucursalesListado),
      },
      {
        path: 'organizaciones-hijas-formulario',
        title: "V04-07·F · Nueva organización hija",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/directorio/organizaciones-hijas-formulario/organizaciones-hijas-formulario').then((m) => m.DirectorioOrganizacionesHijasFormulario),
      },
      {
        path: 'organizaciones-formulario',
        title: "V04-01·F · Nueva organización",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/directorio/organizaciones-formulario/organizaciones-formulario').then((m) => m.DirectorioOrganizacionesFormulario),
      },
      {
        path: 'organizaciones-suspender',
        title: "V04-01·A · Suspender la organización",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/directorio/organizaciones-suspender/organizaciones-suspender').then((m) => m.DirectorioOrganizacionesSuspender),
      },
    ],
  },
  {
    path: 'personas',
    loadComponent: () =>
      import('@features/redsat/shell/redsat-shell').then((m) => m.RedsatShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pacientes-formulario' },
      {
        path: 'pacientes-formulario',
        title: "V05-01·F · Nuevo paciente",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/personas/pacientes-formulario/pacientes-formulario').then((m) => m.PersonasPacientesFormulario),
      },
      {
        path: 'pacientes-fusionar',
        title: "V05-01·A · Fusionar pacientes",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/personas/pacientes-fusionar/pacientes-fusionar').then((m) => m.PersonasPacientesFusionar),
      },
      {
        path: 'pacientes-listado',
        title: "V05-01·L · Pacientes",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/pacientes-listado/pacientes-listado').then((m) => m.PersonasPacientesListado),
      },
      {
        path: 'pacientes-revertir',
        title: "V05-01·A · Revertir la fusión",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/personas/pacientes-revertir/pacientes-revertir').then((m) => m.PersonasPacientesRevertir),
      },
      {
        path: 'vinculos-de-identidad-formulario',
        title: "V05-02·F · Nuevo vínculo de identidad",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/personas/vinculos-de-identidad-formulario/vinculos-de-identidad-formulario').then((m) => m.PersonasVinculosDeIdentidadFormulario),
      },
      {
        path: 'vinculos-de-identidad-listado',
        title: "V05-02·L · Vínculos de identidad",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/vinculos-de-identidad-listado/vinculos-de-identidad-listado').then((m) => m.PersonasVinculosDeIdentidadListado),
      },
      {
        path: 'apoderados-de-portal-formulario',
        title: "V05-04·F · Nuevo apoderado de portal",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/personas/apoderados-de-portal-formulario/apoderados-de-portal-formulario').then((m) => m.PersonasApoderadosDePortalFormulario),
      },
      {
        path: 'apoderados-de-portal-listado',
        title: "V05-04·L · Apoderados de portal",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/apoderados-de-portal-listado/apoderados-de-portal-listado').then((m) => m.PersonasApoderadosDePortalListado),
      },
      {
        path: 'personas-relacionadas-formulario',
        title: "V05-05·F · Nueva persona relacionada",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/personas/personas-relacionadas-formulario/personas-relacionadas-formulario').then((m) => m.PersonasRelacionadasFormulario),
      },
      {
        path: 'personas-relacionadas-listado',
        title: "V05-05·L · Personas relacionadas",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/personas-relacionadas-listado/personas-relacionadas-listado').then((m) => m.PersonasRelacionadasListado),
      },
      {
        path: 'credenciales-listado',
        title: "V05-06·L · Credenciales",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/credenciales-listado/credenciales-listado').then((m) => m.PersonasCredencialesListado),
      },
      {
        path: 'credenciales-verificar',
        title: "V05-06·A · Verificar la credencial",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/personas/credenciales-verificar/credenciales-verificar').then((m) => m.PersonasCredencialesVerificar),
      },
      {
        path: 'personas-listado',
        title: "V05-07·L · Personas",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/personas-listado/personas-listado').then((m) => m.PersonasListado),
      },
      {
        path: 'personas-registrar-defuncion',
        title: "V05-07·A · Registrar la defunción",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/personas/personas-registrar-defuncion/personas-registrar-defuncion').then((m) => m.PersonasRegistrarDefuncion),
      },
      {
        path: 'vinculos-de-cuenta-formulario',
        title: "V05-08·F · Nuevo vínculo de cuenta",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/personas/vinculos-de-cuenta-formulario/vinculos-de-cuenta-formulario').then((m) => m.PersonasVinculosDeCuentaFormulario),
      },
      {
        path: 'vinculos-de-cuenta-listado',
        title: "V05-08·L · Vínculos de cuenta",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/vinculos-de-cuenta-listado/vinculos-de-cuenta-listado').then((m) => m.PersonasVinculosDeCuentaListado),
      },
      {
        path: 'profesionales-formulario',
        title: "V05-09·F · Nuevo profesional",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/personas/profesionales-formulario/profesionales-formulario').then((m) => m.PersonasProfesionalesFormulario),
      },
      {
        path: 'profesionales-listado',
        title: "V05-09·L · Profesionales",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/profesionales-listado/profesionales-listado').then((m) => m.PersonasProfesionalesListado),
      },
      {
        path: 'autorizaciones-de-jurisdiccion-formulario',
        title: "V05-10·F · Nueva autorización de jurisdicción",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/personas/autorizaciones-de-jurisdiccion-formulario/autorizaciones-de-jurisdiccion-formulario').then((m) => m.PersonasAutorizacionesDeJurisdiccionFormulario),
      },
      {
        path: 'autorizaciones-de-jurisdiccion-listado',
        title: "V05-10·L · Autorizaciones de jurisdicción",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/autorizaciones-de-jurisdiccion-listado/autorizaciones-de-jurisdiccion-listado').then((m) => m.PersonasAutorizacionesDeJurisdiccionListado),
      },
      {
        path: 'especialidades-formulario',
        title: "V05-11·F · Nueva especialidad",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/personas/especialidades-formulario/especialidades-formulario').then((m) => m.PersonasEspecialidadesFormulario),
      },
      {
        path: 'especialidades-listado',
        title: "V05-11·L · Especialidades",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/especialidades-listado/especialidades-listado').then((m) => m.PersonasEspecialidadesListado),
      },
      {
        path: 'resumen-propio-listado',
        title: "V05-03·L · Resumen propio",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/personas/resumen-propio-listado/resumen-propio-listado').then((m) => m.PersonasResumenPropioListado),
      },
    ],
  },
  {
    path: 'accesos',
    loadComponent: () =>
      import('@features/redsat/shell/redsat-shell').then((m) => m.RedsatShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'acceso-de-emergencia-formulario' },
      {
        path: 'acceso-de-emergencia-formulario',
        title: "V06-05·F · Acceso de emergencia",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/acceso-de-emergencia-formulario/acceso-de-emergencia-formulario').then((m) => m.AccesosAccesoDeEmergenciaFormulario),
      },
      {
        path: 'accesos-clinicos-del-paciente-formulario',
        title: "V06-06·F · Otorgar acceso clínico",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/accesos-clinicos-del-paciente-formulario/accesos-clinicos-del-paciente-formulario').then((m) => m.AccesosClinicosDelPacienteFormulario),
      },
      {
        path: 'accesos-clinicos-del-paciente-listado',
        title: "V06-06·L · Accesos clínicos del paciente",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/accesos-clinicos-del-paciente-listado/accesos-clinicos-del-paciente-listado').then((m) => m.AccesosClinicosDelPacienteListado),
      },
      {
        path: 'relaciones-de-cuidado-formulario',
        title: "V06-01·F · Nueva relación de cuidado",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/relaciones-de-cuidado-formulario/relaciones-de-cuidado-formulario').then((m) => m.AccesosRelacionesDeCuidadoFormulario),
      },
      {
        path: 'relaciones-de-cuidado-listado',
        title: "V06-01·L · Relaciones de cuidado",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/relaciones-de-cuidado-listado/relaciones-de-cuidado-listado').then((m) => m.AccesosRelacionesDeCuidadoListado),
      },
      {
        path: 'relaciones-de-cuidado-revocar',
        title: "V06-01·A · Revocar la relación de cuidado",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/accesos/relaciones-de-cuidado-revocar/relaciones-de-cuidado-revocar').then((m) => m.AccesosRelacionesDeCuidadoRevocar),
      },
      {
        path: 'representaciones-legales-formulario',
        title: "V06-02·F · Nueva representación legal",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/representaciones-legales-formulario/representaciones-legales-formulario').then((m) => m.AccesosRepresentacionesLegalesFormulario),
      },
      {
        path: 'representaciones-legales-listado',
        title: "V06-02·L · Representaciones legales",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/representaciones-legales-listado/representaciones-legales-listado').then((m) => m.AccesosRepresentacionesLegalesListado),
      },
      {
        path: 'representaciones-legales-revocar',
        title: "V06-02·A · Revocar la representación legal",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/accesos/representaciones-legales-revocar/representaciones-legales-revocar').then((m) => m.AccesosRepresentacionesLegalesRevocar),
      },
      {
        path: 'accesos-clinicos-listado',
        title: "V06-03·L · Accesos clínicos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/accesos-clinicos-listado/accesos-clinicos-listado').then((m) => m.AccesosClinicosListado),
      },
      {
        path: 'accesos-clinicos-revocar',
        title: "V06-03·A · Revocar el acceso clínico",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/accesos/accesos-clinicos-revocar/accesos-clinicos-revocar').then((m) => m.AccesosClinicosRevocar),
      },
      {
        path: 'decisiones-evaluar',
        title: "V06-04·A · Evaluar una decisión de autorización",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/accesos/decisiones-evaluar/decisiones-evaluar').then((m) => m.AccesosDecisionesEvaluar),
      },
      {
        path: 'cache-invalidar',
        title: "V06-07·A · Invalidar la caché del PDP",
        data: { arquetipo: 'modal' },
        loadComponent: () =>
          import('@features/redsat/accesos/cache-invalidar/cache-invalidar').then((m) => m.AccesosCacheInvalidar),
      },
      {
        path: 'categorias-de-permiso-formulario',
        title: "V06-08·F · Nueva categoría de permiso",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/categorias-de-permiso-formulario/categorias-de-permiso-formulario').then((m) => m.AccesosCategoriasDePermisoFormulario),
      },
      {
        path: 'categorias-de-permiso-listado',
        title: "V06-08·L · Categorías de permiso",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/categorias-de-permiso-listado/categorias-de-permiso-listado').then((m) => m.AccesosCategoriasDePermisoListado),
      },
      {
        path: 'permisos-formulario',
        title: "V06-09·F · Nuevo permiso",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/permisos-formulario/permisos-formulario').then((m) => m.AccesosPermisosFormulario),
      },
      {
        path: 'permisos-listado',
        title: "V06-09·L · Permisos",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/permisos-listado/permisos-listado').then((m) => m.AccesosPermisosListado),
      },
      {
        path: 'alcance-de-recurso-formulario',
        title: "V06-10·F · Nueva concesión de alcance",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/alcance-de-recurso-formulario/alcance-de-recurso-formulario').then((m) => m.AccesosAlcanceDeRecursoFormulario),
      },
      {
        path: 'alcance-de-recurso-listado',
        title: "V06-10·L · Concesiones de alcance de recurso",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/alcance-de-recurso-listado/alcance-de-recurso-listado').then((m) => m.AccesosAlcanceDeRecursoListado),
      },
      {
        path: 'roles-formulario',
        title: "V06-11·F · Nuevo rol",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/roles-formulario/roles-formulario').then((m) => m.AccesosRolesFormulario),
      },
      {
        path: 'roles-listado',
        title: "V06-11·L · Roles",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/roles-listado/roles-listado').then((m) => m.AccesosRolesListado),
      },
      {
        path: 'permisos-de-campo-formulario',
        title: "V06-12·F · Configurar el enmascaramiento de campos",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/permisos-de-campo-formulario/permisos-de-campo-formulario').then((m) => m.AccesosPermisosDeCampoFormulario),
      },
      {
        path: 'permisos-de-campo-listado',
        title: "V06-12·L · Permisos de campo",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/permisos-de-campo-listado/permisos-de-campo-listado').then((m) => m.AccesosPermisosDeCampoListado),
      },
      {
        path: 'permisos-del-rol-formulario',
        title: "V06-13·F · Asignar permisos al rol",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/permisos-del-rol-formulario/permisos-del-rol-formulario').then((m) => m.AccesosPermisosDelRolFormulario),
      },
      {
        path: 'permisos-del-rol-listado',
        title: "V06-13·L · Permisos del rol",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/permisos-del-rol-listado/permisos-del-rol-listado').then((m) => m.AccesosPermisosDelRolListado),
      },
      {
        path: 'politicas-de-acceso-formulario',
        title: "V06-14·F · Nueva política de acceso",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/politicas-de-acceso-formulario/politicas-de-acceso-formulario').then((m) => m.AccesosPoliticasDeAccesoFormulario),
      },
      {
        path: 'politicas-de-acceso-listado',
        title: "V06-14·L · Políticas de acceso",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/politicas-de-acceso-listado/politicas-de-acceso-listado').then((m) => m.AccesosPoliticasDeAccesoListado),
      },
      {
        path: 'concesiones-de-permiso-formulario',
        title: "V06-15·F · Nueva concesión de permiso",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/concesiones-de-permiso-formulario/concesiones-de-permiso-formulario').then((m) => m.AccesosConcesionesDePermisoFormulario),
      },
      {
        path: 'concesiones-de-permiso-listado',
        title: "V06-15·L · Concesiones de permiso",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/concesiones-de-permiso-listado/concesiones-de-permiso-listado').then((m) => m.AccesosConcesionesDePermisoListado),
      },
      {
        path: 'asignaciones-de-rol-formulario',
        title: "V06-16·F · Asignar un rol",
        data: { arquetipo: 'formulario' },
        loadComponent: () =>
          import('@features/redsat/accesos/asignaciones-de-rol-formulario/asignaciones-de-rol-formulario').then((m) => m.AccesosAsignacionesDeRolFormulario),
      },
      {
        path: 'asignaciones-de-rol-listado',
        title: "V06-16·L · Asignaciones de rol",
        data: { arquetipo: 'listado' },
        loadComponent: () =>
          import('@features/redsat/accesos/asignaciones-de-rol-listado/asignaciones-de-rol-listado').then((m) => m.AccesosAsignacionesDeRolListado),
      },
    ],
  },
];
