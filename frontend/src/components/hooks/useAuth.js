import { useContext } from 'react'
import { AuthCtx } from '../authContext'

export function useAuth(){
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
