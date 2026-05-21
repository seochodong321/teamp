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

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100dvh', gap: 16,
          fontFamily: 'Pretendard, sans-serif', color: '#333', padding: 24,
          textAlign: 'center',
        }}>
          <span style={{ fontSize: 48 }}>😵</span>
          <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>문제가 발생했어요</p>
          <p style={{ fontSize: 14, color: '#888', margin: 0 }}>
            잠시 후 다시 시도해주세요
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '10px 24px',
              background: '#534AB7', color: '#fff', border: 'none',
              borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
