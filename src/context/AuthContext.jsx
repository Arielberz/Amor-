import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../firebase/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser)
    setLoading(false)
  }), [])

  const login = (code) => signInWithEmailAndPassword(auth, import.meta.env.VITE_BUSINESS_EMAIL, code)
  return <AuthContext.Provider value={{ user, loading, login, logout: () => signOut(auth) }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
