import { createContext, useContext } from 'react'
export interface AccountUser { kind: 'owner' | 'google'; name: string; email: string | null; expiresAt: number }
export const AccountContext = createContext<{ user: AccountUser | null; logout: () => Promise<void>; busy: boolean } | null>(null)
export const useAccount = () => useContext(AccountContext)
