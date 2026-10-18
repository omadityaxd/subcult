"use client"

import { useSyncExternalStore } from "react"
import { writeCookie } from "./cookies"
import type { TodayEdition } from "./edition"
import {
  ISSUES_KEY,
  ISSUE_COOKIE,
  type IssueArchive,
  compactIssue,
  encodeIssueCookie,
  issueNumber,
  recordIssue,
} from "./issues"

const EMPTY: IssueArchive = { issues: [] }
let cache: IssueArchive | null = null
const listeners = new Set<() => void>()

function read(): IssueArchive {
  if (cache) return cache
  if (typeof window === "undefined") return EMPTY
  try {
    const parsed = JSON.parse(localStorage.getItem(ISSUES_KEY) ?? "null") as IssueArchive | null
    cache = parsed && Array.isArray(parsed.issues) ? parsed : EMPTY
  } catch {
    cache = EMPTY
  }
  return cache
}

function write(next: IssueArchive): void {
  cache = next
  try {
    localStorage.setItem(ISSUES_KEY, JSON.stringify(next))
  } catch {
    // Storage full: the archive just stops growing.
  }
  listeners.forEach((listener) => listener())
}

/** Records today's issue (once per local day) and returns its number. */
export function keepIssue(edition: TodayEdition, day: string): number {
  const archive = read()
  const no = issueNumber(archive, day)
  write(recordIssue(archive, compactIssue(edition, no, day)))
  writeCookie(ISSUE_COOKIE, encodeIssueCookie(no, day))
  return no
}

export function useIssueArchive(): IssueArchive {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
    () => EMPTY,
  )
}
