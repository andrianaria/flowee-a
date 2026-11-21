import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { createDemoState, validateState, type LedgerState } from "./ledger.ts"

/** A synchronous, atomic JSON store for one localhost process. No production services. */
export function createStore(filename: string) {
  function read(): LedgerState {
    if (!existsSync(filename)) {
      const initial = createDemoState()
      write(initial)
      return initial
    }
    try { return validateState(JSON.parse(readFileSync(filename, "utf8"))) }
    catch { throw new Error("The local data file is invalid; restore it or reset the demo data") }
  }
  function write(state: LedgerState): void {
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
    const temporary = filename + ".tmp"
    writeFileSync(temporary, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 })
    renameSync(temporary, filename)
  }
  return {
    getState: read,
    mutateState<T>(update: (state: LedgerState) => T): T {
      const state = read()
      const result = update(state)
      write(state)
      return result
    },
    reset(): LedgerState { const state = createDemoState(); write(state); return state },
  }
}
// This application intentionally supports one local process, not a shared hosted service.
const localStore = createStore(join(process.env.FLOWEE_DATA_DIR || join(process.cwd(), ".data"), "flowee.json"))
export const getState = localStore.getState
export const mutateState = localStore.mutateState
export const resetState = localStore.reset
