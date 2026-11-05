import { createContext, useContext } from 'react'

export interface DeploymentAccess {
  available: boolean;
  reason?: 'setup' | 'unavailable';
  checking?: boolean;
  retry?: () => void;
}
// Standalone local App usage retains its existing engine behavior.
export const DeploymentContext = createContext<DeploymentAccess>({ available: true })
export const useDeployment = () => useContext(DeploymentContext)
