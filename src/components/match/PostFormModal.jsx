import React from 'react'
import { todayStr } from '../../store/helpers.js'
import styles from '../../pages/MatchPage.module.css'

const SKILL_PRESETS = ['React', 'Vue', 'Node.js', 'Python', 'Java', 'Spring', 'Flutter', 'iOS', 'Android', 'UI/UX', '기획', '마케팅']

// 팀원 모집글 작성 모달 — 폼 상태는 페이지 소유(form 번들로 주입).
// 모달을 닫아도 초안이 유지되는 기존 동작을 보존하기 위한 구조.
export default function PostFormModal({ form, myLeaderProjects, submitting, error, onClose, onSubmit }) {
  const {
    formProject, setFormProject, formTitle, setFormTitle, formDesc, setFormDesc,
    formDeadline, setFormDeadline, formVisibility, setFormVisibility,
    formKeywords, setFormKeywords, formCustomKeyword, setFormCustomKeyword,
    formSkills, setFormSkills, formCustomSkill, setFormCustomSkill,
  } = form

  const toggleSkill = (skill) =>
    setFormSkills((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill])

  return (
    <div className={styles.backdrop} onClick={() => !submitting && onClose()}>
      <div className={styles.formModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.formModalHeader}>
          <h3 className={styles.formModalTitle}>팀원 모집글 작성</h3>
          <button className={styles.formClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.formBody}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>프로젝트 선택 *</label>
            <select className={styles.formSelect} value={formProject} onChange={(e) => setFormProject(e.target.value)}>
              <option value="">프로젝트를 선택하세요</option>
              {myLeaderProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>모집 제목 *</label>
            <input className={styles.formInput} value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="예) 프론트엔드 개발자 구합니다" />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>상세 설명</label>
            <textarea className={styles.formTextarea} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="프로젝트 소개, 원하는 팀원 유형 등을 자유롭게 적어주세요" rows={4} />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>모집 기한 *</label>
            <input className={styles.formInput} type="date"
              value={formDeadline}
              min={todayStr()}
              onChange={(e) => setFormDeadline(e.target.value)} />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>공개 설정</label>
            <div className={styles.visibilityBtns}>
              <button type="button"
                className={`${styles.visBtn} ${formVisibility === 'public' ? styles.visBtnActive : ''}`}
                onClick={() => setFormVisibility('public')}>
                🌍 전체공개
              </button>
              <button type="button"
                className={`${styles.visBtn} ${formVisibility === 'keyword' ? styles.visBtnActive : ''}`}
                onClick={() => setFormVisibility('keyword')}>
                🔍 부분공개
              </button>
            </div>
            {formVisibility === 'keyword' && (
              <div className={styles.keywordSection}>
                <p className={styles.visNotice}>오픈 풀에는 반영되지 않아요. 키워드 검색 시에만 노출돼요.</p>
                <input
                  className={styles.formInput}
                  value={formCustomKeyword}
                  onChange={(e) => setFormCustomKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && formCustomKeyword.trim()) {
                      e.preventDefault()
                      setFormKeywords((prev) => [...new Set([...prev, formCustomKeyword.trim()])])
                      setFormCustomKeyword('')
                    }
                  }}
                  placeholder="키워드 입력 후 Enter (예: 영화, 스크립터)"
                />
                {formKeywords.length > 0 && (
                  <div className={`${styles.skillTags} ${styles.skillTagsMt}`}>
                    {formKeywords.map((k) => (
                      <button key={k} className={`${styles.skillTag} ${styles.skillTagRemove}`}
                        onClick={() => setFormKeywords((prev) => prev.filter((x) => x !== k))}>
                        {k} ✕
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>필요 스킬</label>
            <div className={styles.skillPresets}>
              {SKILL_PRESETS.map((s) => (
                <button key={s} type="button"
                  className={`${styles.skillPresetBtn} ${formSkills.includes(s) ? styles.skillPresetActive : ''}`}
                  onClick={() => toggleSkill(s)}>{s}</button>
              ))}
            </div>
            <div className={styles.customSkillRow}>
              <input className={styles.formInput} value={formCustomSkill}
                onChange={(e) => setFormCustomSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && formCustomSkill.trim()) {
                    e.preventDefault()
                    setFormSkills((prev) => [...new Set([...prev, formCustomSkill.trim()])])
                    setFormCustomSkill('')
                  }
                }}
                placeholder="직접 입력 후 Enter" />
            </div>
            {formSkills.length > 0 && (
              <div className={`${styles.skillTags} ${styles.skillTagsMtMd}`}>
                {formSkills.map((s) => (
                  <button key={s} className={`${styles.skillTag} ${styles.skillTagRemove}`}
                    onClick={() => setFormSkills((prev) => prev.filter((x) => x !== s))}>
                    {s} ✕
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {error && <p className={styles.formError}>{error}</p>}
        {(!formProject || !formTitle.trim() || !formDeadline) && (
          <p className={styles.formHint}>
            필수 항목을 채워주세요: {[
              !formProject      && '프로젝트 선택',
              !formTitle.trim() && '모집 제목',
              !formDeadline     && '모집 기한',
            ].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className={styles.formFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>취소</button>
          <button className={styles.submitBtn} onClick={onSubmit}
            disabled={!formTitle.trim() || !formProject || !formDeadline || submitting}>
            {submitting ? '등록 중...' : '모집글 등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
