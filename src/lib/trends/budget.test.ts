import { describe, expect, it } from "vitest"
import { createBudget } from "./budget"

describe("createBudget", () => {
  it("refuses reservations that would exceed the cap", () => {
    const budget = createBudget(0.25)
    expect(budget.reserve(0.2)).not.toBeNull()
    expect(budget.reserve(0.1)).toBeNull()
    expect(budget.committedUsd()).toBeCloseTo(0.2, 10)
  })

  it("frees headroom when a job costs less than estimated", () => {
    const budget = createBudget(0.25)
    budget.reserve(0.2)?.settle(0.05)
    expect(budget.committedUsd()).toBeCloseTo(0.05, 10)
    expect(budget.reserve(0.15)).not.toBeNull()
  })

  it("keeps the estimate when the actual cost is unknown, and settles once", () => {
    const budget = createBudget(1)
    const reservation = budget.reserve(0.3)
    reservation?.settle(null)
    reservation?.settle(0.9)
    expect(budget.committedUsd()).toBeCloseTo(0.3, 10)
  })
})
