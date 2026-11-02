/* ============================================================================
    El catálogo del atlas anatómico 3D: conteos, procedencia y atribuciones.

    **GENERADO por `scripts/gen-anatomy-ontology-fixture.mjs`. No editar a mano.**
    Las fichas no viajan acá: están en `public/anatomy-atlas-3d/catalog/` y se
    bajan bajo demanda. Este archivo trae lo que la pantalla muestra antes de
    bajar nada: de dónde sale cada cosa y con qué licencia.

    Regla: nada que la fuente no diga se completa. Los nombres y definiciones en
    castellano son traducción automática sin revisión humana, y se rotulan así.

    Regenerar con `yarn mock:anatomy-ontology`.
    ========================================================================== */

/** Una fuente del atlas y cómo hay que atribuirla. */
export interface FuenteDelAtlas3d {
  readonly name: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly attribution: string;
  readonly citationDoi: string;
}

export const ATLAS_3D_META = {
  "uberonRelease": "releases/2026-10-01",
  "structures": 6347,
  "uberonStructures": 6074,
  "fmaOnlyStructures": 273,
  "relations": 7338,
  "definitions": 5152,
  "definitionsEs": 5152,
  "labelsEs": 6347,
  "meshes": 975,
  "compositeStructures": 513,
  "meshesMappedToUberon": 702,
  "netterEntries": 3161,
  "netterMapped": 805,
  "netterUnmapped": 2356,
  "netterRejected": 0,
  "netterNotReviewed": 0,
  "femaleOnlyStructures": 121,
  "femaleOnlyWithMesh": 17,
  "femaleMeshes": 45
} as const;

export const ATLAS_3D_SOURCES: readonly FuenteDelAtlas3d[] = [
  {
    "name": "BodyParts3D",
    "license": "CC-BY-SA 2.1 JP",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.1/jp/",
    "attribution": "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan",
    "citationDoi": "10.1093/nar/gkn613"
  },
  {
    "name": "UBERON (releases/2026-10-01)",
    "license": "CC-BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0/",
    "attribution": "Mungall CJ, Torniai C, Gkoutos GV, Lewis SE, Haendel MA. Uberon, an integrative multi-species anatomy ontology. Genome Biol. 2012;13(1):R5.",
    "citationDoi": "10.1186/gb-2012-13-1-r5"
  },
  {
    "name": "Foundational Model of Anatomy (FMA)",
    "license": "CC-BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0/",
    "attribution": "Rosse C, Mejino JLV. A reference ontology for biomedical informatics: the Foundational Model of Anatomy. J Biomed Inform. 2003;36(6):478-500.",
    "citationDoi": "10.1016/j.jbi.2003.11.007"
  },
  {
    "name": "HuBMAP Human Reference Atlas (Visible Human Female)",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "HuBMAP CCF 3D Reference Object Library (Browne K, Schlehlein H, Herr BW II, Quardokus E, Bueckle A, Börner K. 2024), del Visible Human Project female (NLM), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
    "citationDoi": "10.48539/HBM627.VTKD.892"
  }
];

/**
 * Estructuras exclusivamente femeninas del catálogo. Las que tienen pieza 3D
 * (útero, trompas, ovarios…) vienen del Human Reference Atlas; el resto —la
 * vagina, la vulva— no tiene malla libre y queda como ficha.
 */
export const ATLAS_3D_FEMALE_ONLY_IDS: readonly string[] = ["UBERON:0000002","UBERON:0000051","UBERON:0000086","UBERON:0000453","UBERON:0000458","UBERON:0000459","UBERON:0000460","UBERON:0000461","UBERON:0000474","UBERON:0000992","UBERON:0000995","UBERON:0000996","UBERON:0000997","UBERON:0001295","UBERON:0001296","UBERON:0001297","UBERON:0001302","UBERON:0001303","UBERON:0001304","UBERON:0001307","UBERON:0001319","UBERON:0001342","UBERON:0001344","UBERON:0001346","UBERON:0001472","UBERON:0001987","UBERON:0002118","UBERON:0002119","UBERON:0002247","UBERON:0002337","UBERON:0002411","UBERON:0002450","UBERON:0002493","UBERON:0002512","UBERON:0003885","UBERON:0003889","UBERON:0003974","UBERON:0003975","UBERON:0003984","UBERON:0004014","UBERON:0004084","UBERON:0004085","UBERON:0004547","UBERON:0004983","UBERON:0005011","UBERON:0005012","UBERON:0005048","UBERON:0005049","UBERON:0005056","UBERON:0005205","UBERON:0005298","UBERON:0005299","UBERON:0006608","UBERON:0006640","UBERON:0006642","UBERON:0006644","UBERON:0006652","UBERON:0006653","UBERON:0006690","UBERON:0006878","UBERON:0006960","UBERON:0007181","UBERON:0007182","UBERON:0007589","UBERON:0008322","UBERON:0008323","UBERON:0008330","UBERON:0008798","UBERON:0008847","UBERON:0009853","UBERON:0010145","UBERON:0010146","UBERON:0010150","UBERON:0010391","UBERON:0011283","UBERON:0011375","UBERON:0011380","UBERON:0011826","UBERON:0011830","UBERON:0011831","UBERON:0011894","UBERON:0012249","UBERON:0012276","UBERON:0012317","UBERON:0012499","UBERON:0012648","UBERON:0013129","UBERON:0013191","UBERON:0013192","UBERON:0013249","UBERON:0013250","UBERON:0013262","UBERON:0013515","UBERON:0013758","UBERON:0013759","UBERON:0013760","UBERON:0013761","UBERON:0013769","UBERON:0015173","UBERON:0015243","UBERON:0016486","UBERON:0016487","UBERON:0016505","UBERON:0016632","UBERON:0018343","UBERON:0019198","UBERON:0034963","UBERON:0035258","UBERON:0035465","UBERON:0035962","UBERON:0036292","UBERON:0036441","UBERON:0036523","UBERON:0039288","UBERON:8410010","UBERON:8600058","UBERON:8930040","UBERON:8930047","UBERON:8930070","UBERON:8930078","UBERON:8930088"];
