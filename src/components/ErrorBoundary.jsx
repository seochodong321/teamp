import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  // key prop이 바뀌면(라우트 이동) React가 컴포넌트를 새로 마운트해서 자동 리셋됨
  // App.jsx에서 <ErrorBoundary key={location.pathname}> 으로 사용

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100dvh', gap: 16,
          fontFamily: 'Pretendard, sans-serif', padding: 24, textAlign: 'center',
        }}>
          <span style={{ fontSize: 48 }}>😵</span>
          <p style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>
            이 페이지에서 문제가 발생했어요
          </p>
          <p style={{ fontSize: 14, color: '#888', margin: 0, lineHeight: 1.6 }}>
            잠시 후 다시 시도하거나<br />다른 페이지로 이동해주세요
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              onClick={() => { window.location.href = '/home' }}
              style={{
                padding: '10px 20px', background: '#f5f5f5', color: '#444',
                border: '1px solid #e0e0e0', borderRadius: 10,
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              홈으로
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px', background: '#534AB7', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              새로고침
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
