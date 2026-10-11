import { describe, expect, it } from "vitest"
import { type ProfileRef, TaxonomyError, buildTaxonomy, validateTaxonomy } from "./graph"
import { type TaxonomyFiles, nicheCurationSchema, taxonomyFilesSchema } from "./schema"

const profile = (slug: string, artists: string[] = [], related: string[] = []): ProfileRef => ({
  slug,
  name: slug.replace(/-/g, " "),
  artists: artists.map((name) => ({ name })),
  relatedNiches: related,
})

const PROFILES: ProfileRef[] = [
  profile("new-gen-rap"),
  profile("rage", ["Playboi Carti", "Ken Carson", "Some Unverified Rapper"], ["jerk"]),
  profile("jerk", ["Nettspend"]),
  profile("vamp", ["Playboi Carti"], ["not a real niche"]),
  profile("dark-avant-garde"),
  profile("archive-fashion"),
  profile("cloud-rap"),
]

const FILES: TaxonomyFiles = taxonomyFilesSchema.parse({
  hubs: [
    {
      slug: "underground",
      name: "Underground",
      description: "The umbrella hub.",
      children: ["music", "fashion"],
    },
    {
      slug: "music",
      name: "Music",
      description: "Underground music.",
      children: ["new-gen-rap", "cloud-rap"],
    },
    {
      slug: "fashion",
      name: "Fashion",
      description: "Underground fashion.",
      children: ["vamp", "dark-avant-garde", "archive-fashion"],
    },
  ],
  niches: [
    {
      slug: "vamp",
      aliases: ["Opium Fashion", "vamp aesthetic"],
      featuredOrder: 2,
      extraStores: ["ssense"],
    },
    { slug: "rage", featuredOrder: 1 },
  ],
  edges: [
    { from: "new-gen-rap", type: "parent", to: "rage" },
    { from: "new-gen-rap", type: "parent", to: "jerk" },
    { from: "rage", type: "similar_scene", to: "cloud-rap" },
    { from: "vamp", type: "fashion_of", to: "rage" },
    { from: "vamp", type: "overlapping_aesthetic", to: "dark-avant-garde" },
    { from: "dark-avant-garde", type: "overlapping_aesthetic", to: "archive-fashion" },
  ],
  tags: [
    {
      slug: "fit-pics",
      name: "fit pics",
      group: "fit-pics",
      description: "Outfit photos and breakdowns.",
      keywords: ["fit check", "outfit"],
      niches: ["vamp", "archive-fashion"],
    },
  ],
  artists: [
    {
      slug: "playboi-carti",
      name: "Playboi Carti",
      aliases: ["Carti"],
      spotifyId: "699OTQXzgjhIYAHMy9RyPD",
      imageUrl: null,
    },
    { slug: "ken-carson", name: "Ken Carson", spotifyId: "3gBZUcNeVumkeeJ19CY2sX", imageUrl: null },
    { slug: "nettspend", name: "Nettspend", spotifyId: "2jl4qd6UbzeCmImT4nWbtA", imageUrl: null },
  ],
  brands: [
    {
      slug: "rick-owens",
      name: "Rick Owens",
      description: "Brutalist luxury from Paris.",
      officialUrl: "https://www.rickowens.eu/",
      linkedTo: ["dark-avant-garde", "archive-fashion", "vamp"],
    },
  ],
  communities: [
    {
      slug: "yvl",
      type: "identity",
      name: "YVL",
      aliases: ["Young Vamp Life"],
      description: "Young Vamp Life, the Opium-era identity.",
      sources: ["https://example.com/yvl"],
      niches: ["vamp", "rage"],
    },
  ],
})

const graph = () => buildTaxonomy({ profiles: PROFILES, files: FILES })

describe("alias resolution", () => {
  it("resolves names, slugs and aliases case- and punctuation-insensitively", () => {
    const taxonomy = graph()
    expect(taxonomy.resolve("OPIUM FASHION")).toBe("vamp")
    expect(taxonomy.resolve("opium-fashion")).toBe("vamp")
    expect(taxonomy.resolve("  Vamp   Aesthetic ")).toBe("vamp")
    expect(taxonomy.resolve("dark avant garde")).toBe("dark-avant-garde")
    expect(taxonomy.resolve("young vamp life")).toBe("yvl")
    expect(taxonomy.resolve("carti", "artist")).toBe("playboi-carti")
    expect(taxonomy.resolve("nope")).toBeUndefined()
  })

  it("filters resolution by node type", () => {
    expect(graph().resolve("Opium Fashion", "artist")).toBeUndefined()
  })
})

describe("validation", () => {
  it("accepts the fixture", () => {
    expect(validateTaxonomy({ profiles: PROFILES, files: FILES })).toEqual([])
  })

  it("rejects an alias that duplicates another niche", () => {
    const files = {
      ...FILES,
      niches: [
        ...FILES.niches,
        nicheCurationSchema.parse({ slug: "jerk", aliases: ["vamp aesthetic"] }),
      ],
    }
    const problems = validateTaxonomy({ profiles: PROFILES, files })
    expect(problems.some((p) => /"vamp aesthetic".*collides with (vamp|jerk)/.test(p))).toBe(true)
  })

  it("rejects unknown nodes, wrong endpoint types, duplicates and self-loops", () => {
    const files = {
      ...FILES,
      edges: [
        ...FILES.edges,
        { from: "rage", type: "similar_scene" as const, to: "ghost" },
        { from: "rage", type: "tagged" as const, to: "jerk" },
        { from: "cloud-rap", type: "similar_scene" as const, to: "rage" },
        { from: "jerk", type: "related" as const, to: "jerk" },
      ],
    }
    const problems = validateTaxonomy({ profiles: PROFILES, files })
    expect(problems).toEqual(
      expect.arrayContaining([
        'similar_scene edge to unknown node "ghost"',
        "tagged cannot connect niche → niche (rage → jerk)",
        "duplicate edge cloud-rap similar_scene rage",
        'self-loop related on "jerk"',
      ]),
    )
  })

  it("rejects parent cycles and slug collisions across types", () => {
    const files = {
      ...FILES,
      edges: [...FILES.edges, { from: "rage", type: "parent" as const, to: "new-gen-rap" }],
      brands: [...FILES.brands, { ...FILES.brands[0], slug: "rage", name: "Rage Brand" }],
    }
    const problems = validateTaxonomy({ profiles: PROFILES, files })
    expect(problems.some((p) => p.startsWith("parent cycle"))).toBe(true)
    expect(problems).toContain('slug "rage" used by both niche and brand')
    expect(() => buildTaxonomy({ profiles: PROFILES, files })).toThrow(TaxonomyError)
  })
})

describe("relationship graph", () => {
  it("navigates parents, children and branches", () => {
    const taxonomy = graph()
    expect(taxonomy.children("new-gen-rap")).toEqual(["rage", "jerk"])
    expect(taxonomy.parents("rage")).toEqual(["new-gen-rap"])
    expect(taxonomy.branchOf("rage")).toBe("music")
    expect(taxonomy.branchOf("vamp")).toBe("fashion")
    expect(taxonomy.branchOf("underground")).toBeUndefined()
  })

  it("links only verified artists named in profiles", () => {
    const taxonomy = graph()
    expect(taxonomy.artistsOf("rage").map((a) => a.slug)).toEqual(["playboi-carti", "ken-carson"])
    expect(taxonomy.nichesOfArtist("playboi-carti")).toEqual(["rage", "vamp"])
  })

  it("turns resolvable relatedNiches into related edges and drops the rest", () => {
    const related = graph().edges.filter((edge) => edge.type === "related")
    expect(related).toEqual([{ from: "rage", type: "related", to: "jerk" }])
  })

  it("labels adjacent niches by relationship type and direction", () => {
    const taxonomy = graph()
    expect(taxonomy.adjacent("rage")).toEqual([
      { slug: "cloud-rap", label: "Same scene" },
      { slug: "vamp", label: "The fit" },
      { slug: "jerk", label: "Related" },
    ])
    expect(taxonomy.adjacent("vamp")).toEqual([
      { slug: "rage", label: "The sound" },
      { slug: "dark-avant-garde", label: "Same aesthetic" },
    ])
  })

  it("recommends two-hop neighbours, never the niche itself or direct links", () => {
    const recs = graph().recommend("vamp")
    expect(recs).toContain("archive-fashion")
    expect(recs).not.toContain("vamp")
    expect(recs).not.toContain("rage")
    expect(recs).not.toContain("dark-avant-garde")
    expect(new Set(recs).size).toBe(recs.length)
  })

  it("returns nothing rather than filler when nothing clears the bar", () => {
    expect(graph().recommend("cloud-rap")).not.toContain("archive-fashion")
    expect(graph().recommend("not-a-niche")).toEqual([])
  })

  it("exposes tags, brands, communities and featured order", () => {
    const taxonomy = graph()
    expect(taxonomy.tagsOf("vamp").map((t) => t.slug)).toEqual(["fit-pics"])
    expect(taxonomy.brandsOf("vamp").map((b) => b.slug)).toEqual(["rick-owens"])
    expect(taxonomy.communitiesOf("rage").map((c) => c.slug)).toEqual(["yvl"])
    expect(taxonomy.featured()).toEqual(["rage", "vamp"])
    expect(taxonomy.curation("vamp")?.extraStores).toEqual(["ssense"])
  })
})
