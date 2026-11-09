import { createContext, useContext } from 'react'
export interface AccountUser { workspace?: string; kind: 'owner' | 'google'; name: string; email: string | null; expiresAt: number; rememberedUntil?: number | null }
export const AccountContext = createContext<{ user: AccountUser | null; logout: () => Promise<void>; busy: boolean } | null>(null)
export const useAccount = () => useContext(AccountContext)
