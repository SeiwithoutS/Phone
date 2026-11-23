import { useSyncExternalStore } from 'react'
import type { LocalDatabase } from '../../storage/database'
import { bankCurrency, currencyEvent } from './bank'

function subscribe(listener: () => void) {
  window.addEventListener(currencyEvent, listener)
  return () => window.removeEventListener(currencyEvent, listener)
}

export function useBankCurrency(database?: LocalDatabase) {
  return useSyncExternalStore(subscribe, () => bankCurrency(database))
}
