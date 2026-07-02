import React, { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { initAnalytics } from './analytics.js'
import { useStore } from './store/useStore.js'
import { useSession } from './app/useSession.js'
import { useChatToastWatchers } from './app/useChatToastWatchers.js'
import Spinner from './components/Spinner.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// 인증 전 페이지는 즉시 로드 (로그인/가입 화면은 빠르게 보여야 함)
import LoginPage          from './pages/LoginPage.jsx'
import JoinPage           from './pages/JoinPage.jsx'
import Layout             from './components/Layout.jsx'
import LandingPage        from './pages/LandingPage.jsx'
import SetupUsernamePage  from './pages/SetupUsernamePage.jsx'
import LegalPage          from './pages/LegalPage.jsx'
import VerifyEmailPage    from './pages/VerifyEmailPage.jsx'
import { TERMS_DATA }     from './legal/termsData.js'
import { PRIVACY_DATA }   from './legal/privacyData.js'
import { GUIDELINES_DATA } from './legal/guidelinesData.js'

// 인증 후 페이지는 lazy load — 초기 번들에서 분리
const HomePage          = lazy(() => import('./pages/HomePage.jsx'))
const ProjectPage       = lazy(() => import('./pages/ProjectPage.jsx'))
const ChatPage          = lazy(() => import('./pages/ChatPage.jsx'))
const ProfilePage       = lazy(() => import('./pages/ProfilePage.jsx'))
const ConnectPage       = lazy(() => import('./pages/ConnectPage.jsx'))
const WrapupPage        = lazy(() => import('./pages/WrapupPage.jsx'))
const MatchPage         = lazy(() => import('./pages/MatchPage.jsx'))
const HelpPage          = lazy(() => import('./pages/HelpPage.jsx'))
const MessagesPage      = lazy(() => import('./pages/MessagesPage.jsx'))
const CalendarPage      = lazy(() => import('./pages/CalendarPage.jsx'))
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage.jsx'))
const AdminPage         = lazy(() => import('./pages/AdminPage.jsx'))
const NotFoundPage      = lazy(() => import('./pages/NotFoundPage.jsx'))
const PricingPage           = lazy(() => import('./pages/PricingPage.jsx'))
const StudentVerifyPage     = lazy(() => import('./pages/StudentVerifyPage.jsx'))

function PrivateRoute({ children, ready }) {
  const isLoggedIn          = useStore((s) => s.isLoggedIn)
  const needsUsernameSetup  = useStore((s) => s.needsUsernameSetup)
  if (!ready) return <Spinner size={40} label="팀프 불러오는 중…" />
  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (needsUsernameSetup)  return <Navigate to="/setup-username" replace />
  return children
}

// App = 라우터 셸. 세션 수명주기(인증·실시간 구독)는 useSession,
// 백그라운드 채팅 토스트는 useChatToastWatchers — src/app/ 참조.
export default function App() {
  const isLoggedIn = useStore((s) => s.isLoggedIn)

  // PMF 퍼널 계측 초기화 — 비동기·fire-and-forget, 실패해도 앱 무관
  useEffect(() => { initAnalytics() }, [])

  const { msgWatchersRef, dmMsgWatchersRef } = useChatToastWatchers()
  const ready = useSession({ msgWatchersRef, dmMsgWatchersRef })

  return (
    <BrowserRouter>
      <AppRoutes ready={ready} isLoggedIn={isLoggedIn} />
    </BrowserRouter>
  )
}

function AppRoutes({ ready, isLoggedIn }) {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<Spinner size={36} label="불러오는 중..." />}>
        <Routes>
          <Route path="/u/:username" element={<PublicProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/setup-username" element={<SetupUsernamePage />} />
          <Route path="/terms"        element={<LegalPage data={TERMS_DATA} />} />
          <Route path="/privacy"      element={<LegalPage data={PRIVACY_DATA} />} />
          <Route path="/guidelines"   element={<LegalPage data={GUIDELINES_DATA} />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* 루트: 비로그인 → 랜딩, 로그인 → /home 리다이렉트 */}
          <Route path="/" element={
            !ready ? <Spinner /> : isLoggedIn ? <Navigate to="/home" replace /> : <LandingPage />
          } />

          {/* 인증된 레이아웃 (pathless) */}
          <Route element={<PrivateRoute ready={ready}><Layout /></PrivateRoute>}>
            <Route path="/admin"                           element={<AdminPage />} />
            <Route path="/home"                            element={<HomePage />} />
            <Route path="/project/:projectId"              element={<ProjectPage />} />
            <Route path="/project/:projectId/chat/:roomId" element={<ChatPage />} />
            <Route path="/project/:projectId/wrapup"       element={<WrapupPage />} />
            <Route path="/profile"                         element={<ProfilePage />} />
            <Route path="/connect"                         element={<ConnectPage />} />
            <Route path="/match"                           element={<MatchPage />} />
            <Route path="/calendar"                        element={<CalendarPage />} />
            <Route path="/messages"                        element={<MessagesPage />} />
            <Route path="/help"                            element={<HelpPage />} />
            <Route path="/pricing"                         element={<PricingPage />} />
            <Route path="/verify-student"                  element={<StudentVerifyPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
