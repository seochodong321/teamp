// 앱 전체에서 공유하는 상수 모음

// 프로젝트 멤버 역할 라벨 (이모지 + 한글)
export const ROLE_LABEL = { leader: '👑 리더', 'sub-leader': '⭐ 부리더', member: '팀원' }
// 이모지만 (채팅 등 좁은 공간용 — member는 표식 없음)
export const ROLE_EMOJI = { leader: '👑', 'sub-leader': '⭐', member: '' }

// 정지(banned)된 계정 안내 — 로그인·세션복원 어디서든 동일 문구
export const BANNED_MESSAGE = '이 계정은 이용이 제한됐어요. 문의: support@teamp.kr'

export const FLOWER_TAGS = [
  { id: 'reliable',  emoji: '🌹', label: '믿음직한' },
  { id: 'energetic', emoji: '🌻', label: '에너지 넘치는' },
  { id: 'detailed',  emoji: '🌷', label: '섬세한' },
  { id: 'creative',  emoji: '🌼', label: '아이디어 부자' },
  { id: 'pillar',    emoji: '💐', label: '팀의 기둥' },
  { id: 'diligent',  emoji: '🍀', label: '묵묵히 해내는' },
  { id: 'fast',      emoji: '⚡', label: '빠른 실행력' },
  { id: 'focused',   emoji: '🎯', label: '목표에 집중하는' },
]

// 프로젝트 커버 이미지 프리셋 — CSS gradient 기반 (Storage 불필요)
export const COVER_PRESETS = [
  { id: 'purple', label: '보라',  gradient: 'linear-gradient(135deg, #C4BFEE 0%, #E8E5FA 100%)' },
  { id: 'teal',   label: '청록',  gradient: 'linear-gradient(135deg, #99D6CC 0%, #D1F5EF 100%)' },
  { id: 'amber',  label: '호박',  gradient: 'linear-gradient(135deg, #F5CFA0 0%, #FDE9C9 100%)' },
  { id: 'coral',  label: '코랄',  gradient: 'linear-gradient(135deg, #F5A8B0 0%, #FDCDD2 100%)' },
  { id: 'night',  label: '슬레이트', gradient: 'linear-gradient(135deg, #A5B4D4 0%, #D4DCF0 100%)' },
  { id: 'rose',   label: '라벤더', gradient: 'linear-gradient(135deg, #C9B8EE 0%, #E8DCFA 100%)' },
]

/** project.coverImage 값(프리셋 id 또는 URL)을 style 객체로 변환 */
export function getCoverStyle(project) {
  if (!project?.coverImage) {
    // 기본: 이모지 배경색 (프리셋 미선택 시 무채색)
    return { background: 'var(--bg-secondary)' }
  }
  if (project.coverImage.startsWith('http')) {
    return { backgroundImage: `url(${project.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  const preset = COVER_PRESETS.find((p) => p.id === project.coverImage)
  return preset ? { background: preset.gradient } : { background: 'var(--bg-secondary)' }
}
