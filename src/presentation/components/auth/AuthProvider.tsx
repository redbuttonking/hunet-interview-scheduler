'use client'

// 인증 상태를 전역으로 관리하는 컨텍스트 프로바이더
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/infrastructure/firebase/config'
import { COLLECTIONS } from '@/infrastructure/firebase/collections'
import { UserRole } from '@/domain/model/User'

const INACTIVITY_TIMEOUT = 60 * 60 * 1000 // 1시간
const CHECK_INTERVAL = 60 * 1000           // 1분마다 체크
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']

interface AuthUser {
  uid: string
  email: string
  name: string
  role: UserRole
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const lastActivityRef = useRef(0)

  // 비활성 자동 로그아웃: 1시간 동안 아무 동작 없으면 로그아웃
  useEffect(() => {
    if (!user) return

    // 로그인(또는 마운트) 시점을 기준으로 활동 시간 초기화
    lastActivityRef.current = Date.now()
    const updateActivity = () => { lastActivityRef.current = Date.now() }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }))

    const timer = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT) {
        firebaseSignOut(auth)
      }
    }, CHECK_INTERVAL)

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, updateActivity))
      clearInterval(timer)
    }
  }, [user])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            name: data.name,
            role: data.role,
          })
        } else {
          // Firestore 문서 없으면 비인증 처리
          await firebaseSignOut(auth)
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext는 AuthProvider 내부에서만 사용 가능합니다.')
  return ctx
}
