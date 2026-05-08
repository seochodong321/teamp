// 앱 전체에서 공유하는 상수 모음

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
  { id: 'purple', label: '보라',  gradient: 'linear-gradient(135deg, #3C3489 0%, #7B6FD4 100%)' },
  { id: 'teal',   label: '청록',  gradient: 'linear-gradient(135deg, #0D7C6B 0%, #34D399 100%)' },
  { id: 'amber',  label: '호박',  gradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)' },
  { id: 'coral',  label: '코랄',  gradient: 'linear-gradient(135deg, #9F1239 0%, #FB7185 100%)' },
  { id: 'night',  label: '심야',  gradient: 'linear-gradient(135deg, #1E1B4B 0%, #6366F1 100%)' },
  { id: 'rose',   label: '로즈',  gradient: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)' },
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
