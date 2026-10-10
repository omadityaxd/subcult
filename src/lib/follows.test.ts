import { describe, expect, it } from "vitest"
import { followItem, isFollow } from "./follows"
import { toggleSave } from "./saves"

describe("follows", () => {
  const vamp = { slug: "vamp", name: "vamp", tagline: "all black", imageUrl: null }

  it("is a save with a niche: id that links to the niche page", () => {
    expect(followItem(vamp)).toEqual({
      id: "niche:vamp",
      title: "vamp",
      url: "/n/vamp",
      imageUrl: null,
      source: "niche",
      subtitle: "all black",
    })
    expect(isFollow(followItem(vamp))).toBe(true)
  })

  it("lives alongside existing saved items without touching them", () => {
    const existing = toggleSave(
      [],
      {
        id: "spotify:track:1",
        title: "t",
        url: "u",
        imageUrl: null,
        source: "spotify",
        subtitle: null,
      },
      1,
    )
    const next = toggleSave(existing, followItem(vamp), 2)
    expect(next.map((i) => i.id)).toEqual(["niche:vamp", "spotify:track:1"])
    expect(toggleSave(next, followItem(vamp), 3)).toEqual(existing)
  })
})
