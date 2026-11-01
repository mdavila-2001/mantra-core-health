/* ============================================================================
    Construcción del árbol para el grafo visual de medicamentos.

    Estructura jerárquica:
    Compuesto Químico (Principio Activo)
      ├── Indicación Terapéutica (Para qué se usa)
      │     └── Grupo según código ATC
      └── Marcas Comerciales (Equivalentes farmacéuticos)
            ├── Marca 1 ──> Farmacias / Proveedores con stock y precio
            └── Marca 2 ──> Farmacias / Proveedores con stock y precio
    ========================================================================== */

import type { TarjetaDeMedicamento } from '@core/data-access/public-marketplace/public-marketplace.types';
import {
  layoutTree,
  type GraphNode,
  type PlacedTree,
} from '../../../../glossary/glossary-graph.layout';
import type {
  EstadoDeRama,
  ProveedorDeMarca,
  RamaDeMarca,
} from '../medication-tree/medication-tree.logic';
import type { SelectedMedicationNodeDetail } from './medication-graph.types';

/**
 * Construye el árbol de nodos del compuesto químico para el layout visual.
 */
export function buildMedicationTree(
  medication: TarjetaDeMedicamento,
  rama: EstadoDeRama | undefined,
  searchTerm: string | null = null,
): GraphNode {
  const marcasDatos: readonly RamaDeMarca[] =
    rama?.estado === 'datos'
      ? rama.marcas
      : medication.brands.map((b) => ({ marca: b, proveedores: [] }));

  const searchClean = searchTerm?.trim().toLowerCase() ?? '';

  // 1. Rama de uso terapéutico
  const usoNode: GraphNode = {
    key: `uso:${medication.conceptId}`,
    kind: 'term',
    label: medication.therapeuticGroup,
    sublabel: `Código ATC: ${medication.atcCode}`,
    tone: 'petrol',
    definition: 'Indicación terapéutica oficial según clasificación internacional ATC.',
    expandable: false,
    expanded: false,
    loading: false,
    children: [],
  };

  const grupoUso: GraphNode = {
    key: `grupo:uso:${medication.conceptId}`,
    kind: 'group',
    label: 'Para qué se usa',
    sublabel: 'Uso terapéutico',
    tone: 'petrol',
    expandable: false,
    expanded: true,
    loading: false,
    children: [usoNode],
  };

  // 2. Rama de marcas comerciales y farmacias proveedoras
  const marcaNodes: GraphNode[] = marcasDatos.map((m) => {
    const coincideBusqueda =
      searchClean !== '' && m.marca.toLowerCase().includes(searchClean);

    const farmaciaNodes: GraphNode[] = m.proveedores.map((p) => ({
      key: `prov:${medication.conceptId}:${m.marca}:${p.slug}`,
      kind: 'term',
      label: p.nombre,
      sublabel: p.ciudad ?? 'Farmacia de la red',
      tone: p.enStock ? 'mint' : 'neutral',
      definition: p.enStock ? '● En stock hoy' : '○ Sin stock hoy',
      expandable: false,
      expanded: false,
      loading: false,
      children: [],
    }));

    const cantProv = m.proveedores.length;
    const sublabelMarca =
      rama?.estado === 'carga'
        ? 'Buscando farmacias…'
        : cantProv === 0
          ? 'Ninguna farmacia la publica hoy'
          : cantProv === 1
            ? '1 farmacia con oferta'
            : `${cantProv} farmacias con oferta`;

    return {
      key: `marca:${medication.conceptId}:${m.marca}`,
      kind: 'term',
      label: m.marca,
      sublabel: sublabelMarca,
      tone: coincideBusqueda ? 'aqua' : 'sage',
      definition: `Marca comercial de ${medication.genericName}`,
      expandable: farmaciaNodes.length > 0,
      expanded: true,
      loading: rama?.estado === 'carga',
      children: farmaciaNodes,
    };
  });

  const cantMarcas = marcasDatos.length;
  const grupoMarcas: GraphNode = {
    key: `grupo:marcas:${medication.conceptId}`,
    kind: 'group',
    label: `Marcas comerciales (${cantMarcas})`,
    sublabel: 'Equivalentes disponibles',
    tone: 'sage',
    expandable: false,
    expanded: true,
    loading: rama?.estado === 'carga',
    children: marcaNodes,
  };

  // Raíz: Compuesto Químico Concreto
  const rootNode: GraphNode = {
    key: `compuesto:${medication.conceptId}`,
    kind: 'term',
    conceptId: medication.conceptId,
    label: medication.genericName,
    sublabel: `ATC ${medication.atcCode} · ${medication.requiresPrescription ? 'Con receta' : 'Venta libre'}`,
    tone: 'aqua',
    definition: `Compuesto químico activo · ${medication.therapeuticGroup}`,
    expandable: true,
    expanded: true,
    loading: false,
    children: [grupoUso, grupoMarcas],
  };

  return rootNode;
}

/**
 * Calcula la disposición espacial en el plano (nodos, curvas de enlace y dimensiones).
 */
export function layoutMedicationGraph(
  medication: TarjetaDeMedicamento,
  rama: EstadoDeRama | undefined,
  searchTerm: string | null = null,
): PlacedTree {
  const tree = buildMedicationTree(medication, rama, searchTerm);
  return layoutTree(tree);
}

/**
 * Resuelve la explicación detallada para el paciente cuando pulsa en un nodo.
 */
export function resolveNodeDetail(
  node: GraphNode,
  medication: TarjetaDeMedicamento,
  rama: EstadoDeRama | undefined,
): SelectedMedicationNodeDetail {
  const [tipo, , marcaNombre, provSlug] = node.key.split(':');

  if (tipo === 'prov') {
    const marcas = rama?.estado === 'datos' ? rama.marcas : [];
    const marcaObj = marcas.find((m) => m.marca === marcaNombre);
    const provObj: ProveedorDeMarca | undefined = marcaObj?.proveedores.find(
      (p) => p.slug === provSlug,
    );

    return {
      type: 'pharmacy',
      title: provObj?.nombre ?? node.label,
      subtitle: provObj?.ciudad ? `Ubicada en ${provObj.ciudad}` : 'Farmacia asociada',
      genericName: medication.genericName,
      brandName: marcaNombre,
      pharmacyName: provObj?.nombre ?? node.label,
      pharmacySlug: provSlug,
      city: provObj?.ciudad ?? null,
      inStock: provObj?.enStock ?? null,
      explanation:
        `Esta farmacia tiene registrada la marca «${marcaNombre}» (cuyo compuesto activo es ` +
        `«${medication.genericName}»). ${
          provObj?.enStock
            ? 'Reporta disponibilidad en estantería para hoy.'
            : 'Actualmente reporta sin stock inmediato en esta sucursal.'
        }`,
    };
  }

  if (tipo === 'marca') {
    const marcas = rama?.estado === 'datos' ? rama.marcas : [];
    const marcaObj = marcas.find((m) => m.marca === marcaNombre);
    const cantProv = marcaObj?.proveedores.length ?? 0;

    return {
      type: 'brand',
      title: marcaNombre,
      subtitle: `Marca comercial de ${medication.genericName}`,
      genericName: medication.genericName,
      brandName: marcaNombre,
      pharmacyCount: cantProv,
      explanation:
        `«${marcaNombre}» es un nombre comercial registrado por el laboratorio. ` +
        `Su sustancia química activa es **${medication.genericName}**. Si su médico le recetó ` +
        `este compuesto, cualquier marca equivalente con el mismo principio activo y concentración produce el mismo efecto. ` +
        (cantProv > 0
          ? `Actualmente se encuentra en ${cantProv} farmacia(s) de la red.`
          : 'Ninguna farmacia de la red la tiene publicada hoy.'),
    };
  }

  if (tipo === 'uso') {
    return {
      type: 'use',
      title: medication.therapeuticGroup,
      subtitle: `Clasificación ATC: ${medication.atcCode}`,
      genericName: medication.genericName,
      atcCode: medication.atcCode,
      therapeuticGroup: medication.therapeuticGroup,
      explanation:
        `El compuesto «${medication.genericName}» está clasificado en el grupo terapéutico ` +
        `«${medication.therapeuticGroup}» bajo el código oficial ATC ${medication.atcCode}. ` +
        `Consulte siempre con un profesional de la salud o farmacéutico para indicaciones y dosis exactas.`,
    };
  }

  // Por defecto: Compuesto Químico Raíz
  return {
    type: 'compound',
    title: medication.genericName,
    subtitle: `Compuesto químico activo (DCI) · ATC ${medication.atcCode}`,
    genericName: medication.genericName,
    atcCode: medication.atcCode,
    therapeuticGroup: medication.therapeuticGroup,
    requiresPrescription: medication.requiresPrescription,
    brands: medication.brands,
    pharmacyCount: medication.pharmacyCount,
    explanation:
      `«${medication.genericName}» es el principio activo o compuesto químico concreto. ` +
      `Es el ingrediente que realiza la acción terapéutica. Se vende bajo diferentes nombres ` +
      `comerciales (${medication.brands.join(', ') || 'genéricos'}) que comparten la misma molécula activa. ` +
      (medication.requiresPrescription
        ? 'Este medicamento requiere receta médica para su dispensación.'
        : 'Este medicamento es de venta libre (sin receta médica requerida).'),
  };
}
