import React from 'react'
import styles from '../../pages/ProfilePage.module.css'

// 프로필 편집 모달 — 폼 상태는 페이지 소유(form 번들 주입).
// 닉네임 중복확인(checkUsername)·저장(onSave)은 페이지 오케스트레이션 그대로 사용.
export default function EditProfileModal({ form, usernameStatus, usernameSuggestion, checkUsername, saving, onSave, onClose }) {
  const {
    editName, setEditName, editUsername, setEditUsername,
    editOneliner, setEditOneliner, editAffiliation, setEditAffiliation,
    editPhone, setEditPhone,
    editBirthYear, setEditBirthYear, editBirthMonth, setEditBirthMonth, editBirthDay, setEditBirthDay,
  } = form

  return (
    <div className={styles.backdrop} onClick={() => !saving && onClose()}>
      <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.editModalHeader}>
          <h2 className={styles.editModalTitle}>프로필 편집</h2>
          <button className={styles.closeBtn} onClick={() => !saving && onClose()}>✕</button>
        </div>

        <div className={styles.editModalBody}>
          <div className={styles.editField}>
            <label className={styles.editLabel}>이름 *</label>
            <input className={styles.editInput} value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="실명 또는 닉네임" disabled={saving} />
          </div>

          <div className={styles.editField}>
            <label className={styles.editLabel}>@아이디 <span className={styles.editLabelHint}>영문·숫자·_ 3~20자</span></label>
            <div className={styles.inputWrap}>
              <span className={styles.inputAtPrefix}>@</span>
              <input className={`${styles.editInput} ${styles.editInputPadded}`}
                value={editUsername}
                onChange={(e) => { setEditUsername(e.target.value); checkUsername(e.target.value) }}
                placeholder="나만의 아이디" maxLength={20} disabled={saving} />
              {usernameStatus === 'ok' && (
                <span className={styles.inputStatusRight}>
                  <span className={`${styles.inputStatusIcon} ${styles.inputStatusIconOk}`}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5L5.5 10L11 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span className={styles.inputStatusTextOk}>사용 가능</span>
                </span>
              )}
              {usernameStatus === 'taken' && (
                <span className={styles.inputStatusRight}>
                  <span className={`${styles.inputStatusIcon} ${styles.inputStatusIconTaken}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                  </span>
                  <span className={styles.inputStatusTextTaken}>이미 사용 중</span>
                  {usernameSuggestion && (
                    <button
                      type="button"
                      className={styles.usernameSuggestBtn}
                      onClick={() => { setEditUsername(usernameSuggestion); checkUsername(usernameSuggestion) }}>
                      @{usernameSuggestion} 사용하기
                    </button>
                  )}
                </span>
              )}
              {usernameStatus === 'checking' && <span className={styles.inputSpinner} />}
            </div>
          </div>

          <div className={styles.editField}>
            <label className={styles.editLabel}>
              팀프 원라이너
              <span className={styles.editLabelHint}>한 줄로 자신을 표현해보세요 ✨</span>
            </label>
            <input className={styles.editInput} value={editOneliner}
              onChange={(e) => setEditOneliner(e.target.value.slice(0, 50))}
              placeholder="예) 무엇이든 만들어보고 싶은 디자이너" maxLength={50} disabled={saving} />
            <span className={styles.editCount}>{editOneliner.length}/50</span>
          </div>

          <div className={styles.editField}>
            <label className={styles.editLabel}>소속</label>
            <input className={styles.editInput} value={editAffiliation}
              onChange={(e) => setEditAffiliation(e.target.value)}
              placeholder="예) OO대학교 컴퓨터공학과" disabled={saving} />
          </div>

          <div className={styles.editField}>
            <label className={styles.editLabel}>핸드폰 번호</label>
            <input className={styles.editInput} value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="010-0000-0000" type="tel" disabled={saving} />
          </div>

          <div className={styles.editField}>
            <label className={styles.editLabel}>생년월일</label>
            <div className={styles.birthRow}>
              <select className={`${styles.editInput} ${styles.birthYear}`} value={editBirthYear}
                onChange={(e) => setEditBirthYear(e.target.value)}>
                <option value="">년도</option>
                {Array.from({ length: 36 }, (_, i) => 2010 - i).map((y) => (
                  <option key={y} value={String(y)}>{y}년</option>
                ))}
              </select>
              <select className={`${styles.editInput} ${styles.birthField}`} value={editBirthMonth}
                onChange={(e) => { setEditBirthMonth(e.target.value); setEditBirthDay('') }}>
                <option value="">월</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m).padStart(2, '0')}>{m}월</option>
                ))}
              </select>
              <select className={`${styles.editInput} ${styles.birthField}`} value={editBirthDay}
                onChange={(e) => setEditBirthDay(e.target.value)} disabled={!editBirthMonth}>
                <option value="">일</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d).padStart(2, '0')}>{d}일</option>
                ))}
              </select>
            </div>
          </div>

          <p className={styles.editHint}>
            💡 이메일은 로그인 정보라 변경할 수 없어요
          </p>
        </div>

        <div className={styles.editModalFooter}>
          <button className={styles.editCancel} onClick={onClose} disabled={saving}>
            취소
          </button>
          <button className={styles.editSave} onClick={onSave} disabled={saving}>
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
