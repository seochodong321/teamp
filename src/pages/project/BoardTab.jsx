import React, { useState, useRef } from 'react'
import { useStore } from '../../store/useStore.js'
import styles from '../ProjectPage.module.css'

export default function BoardTab({ project, currentUser, isLeader, defaultView = 'list', defaultGlobal = false }) {
  const { addAnnouncement, deleteAnnouncement } = useStore()

  const [boardView, setBoardView]     = useState(defaultView)
  const [selectedAnn, setSelectedAnn] = useState(null)
  const [annTitle, setAnnTitle]       = useState('')
  const [annContent, setAnnContent]   = useState('')
  const [annIsGlobal, setAnnIsGlobal] = useState(defaultGlobal)
  const [annFile, setAnnFile]         = useState(null)
  const fileRef = useRef(null)

  const handleWriteAnn = () => {
    if (!annTitle.trim() || !annContent.trim()) return
    addAnnouncement(project.id, { title: annTitle, content: annContent, isGlobal: annIsGlobal, fileName: annFile?.name || null })
    setBoardView('list')
  }

  return (
    <div className={styles.section}>
      {boardView === 'list' && (
        <>
          <div className={styles.boardToolbar}>
            <div>
              <h3 className={styles.boardTitle}>게시판</h3>
              <p className={styles.boardDesc}>모든 팀원이 글을 작성할 수 있어요</p>
            </div>
            <button className={styles.writeBtn}
              onClick={() => { setBoardView('write'); setAnnTitle(''); setAnnContent(''); setAnnIsGlobal(false); setAnnFile(null) }}>
              ✏️ 글쓰기
            </button>
          </div>

          {project.announcements.length === 0 ? (
            <div className={styles.boardEmpty}>
              <div className={styles.boardEmptyIcon}>📋</div>
              <p className={styles.boardEmptyTitle}>아직 게시글이 없어요</p>
              <p className={styles.boardEmptySub}>첫 번째 글을 작성해보세요</p>
              <button className={styles.writeBtn} style={{ marginTop: 12 }}
                onClick={() => { setBoardView('write'); setAnnTitle(''); setAnnContent(''); setAnnIsGlobal(false); setAnnFile(null) }}>
                ✏️ 첫 글 쓰기
              </button>
            </div>
          ) : (
            <div className={styles.boardList}>
              {project.announcements.map((ann) => (
                <div key={ann.id}
                  className={`${styles.boardCard} ${ann.isGlobal ? styles.boardCardNotice : ''}`}
                  onClick={() => { setSelectedAnn(ann); setBoardView('detail') }}>
                  <div className={styles.boardCardLeft}>
                    {ann.isGlobal
                      ? <span className={styles.noticeBadge}>📢 공지</span>
                      : <span className={styles.normalBadge}>일반</span>
                    }
                    <div className={styles.boardCardInfo}>
                      <span className={styles.boardCardTitle}>{ann.title}</span>
                      <span className={styles.boardCardPreview}>{ann.content.slice(0, 60)}{ann.content.length > 60 ? '...' : ''}</span>
                    </div>
                  </div>
                  <div className={styles.boardCardRight}>
                    {ann.fileName && <span className={styles.fileChip}>📎 파일</span>}
                    <span className={styles.boardCardAuthor}>{ann.author}</span>
                    <span className={styles.boardCardDate}>{ann.createdAt}</span>
                    <span className={styles.boardCardArrow}>›</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {boardView === 'write' && (
        <div className={styles.writeWrap}>
          <div className={styles.writeHeader}>
            <button className={styles.backBtn} onClick={() => setBoardView('list')}>← 목록으로</button>
            <h3 className={styles.writeTitle}>새 게시글</h3>
          </div>
          <div className={styles.writeForm}>
            {isLeader && (
              <div className={styles.writeTypeRow}>
                <button type="button"
                  className={`${styles.typeBtn} ${!annIsGlobal ? styles.typeBtnActive : ''}`}
                  onClick={() => setAnnIsGlobal(false)}>📝 일반 게시글</button>
                <button type="button"
                  className={`${styles.typeBtn} ${annIsGlobal ? styles.typeBtnActiveNotice : ''}`}
                  onClick={() => setAnnIsGlobal(true)}>📢 전체 공지</button>
                {annIsGlobal && <span className={styles.noticeHint}>모든 채팅방에 알림이 가요</span>}
              </div>
            )}
            <div className={styles.writeField}>
              <label className={styles.writeLabel}>제목 *</label>
              <input className={styles.writeInput} value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)} placeholder="제목을 입력하세요" autoFocus />
            </div>
            <div className={styles.writeField}>
              <label className={styles.writeLabel}>내용 *</label>
              <textarea className={styles.writeTextarea} value={annContent}
                onChange={(e) => setAnnContent(e.target.value)} placeholder="내용을 입력하세요..." rows={10} />
            </div>
            <div className={styles.writeBottom}>
              <button className={styles.attachBtn} onClick={() => fileRef.current.click()}>
                📎 {annFile ? annFile.name : '파일 첨부'}
              </button>
              <input ref={fileRef} type="file" style={{ display: 'none' }}
                onChange={(e) => setAnnFile(e.target.files[0])} />
              {annFile && <button className={styles.attachRemove} onClick={() => setAnnFile(null)}>✕</button>}
              <div style={{ flex: 1 }} />
              <button className={styles.cancelBtn} onClick={() => setBoardView('list')}>취소</button>
              <button className={styles.submitBtn} onClick={handleWriteAnn}
                disabled={!annTitle.trim() || !annContent.trim()}>게시하기</button>
            </div>
          </div>
        </div>
      )}

      {boardView === 'detail' && selectedAnn && (
        <div className={styles.detailWrap}>
          <button className={styles.backBtn} onClick={() => setBoardView('list')}>← 목록으로</button>
          <div className={styles.detailCard}>
            <div className={styles.detailHeader}>
              {selectedAnn.isGlobal && <span className={styles.noticeBadge}>📢 공지</span>}
              <h2 className={styles.detailTitle}>{selectedAnn.title}</h2>
              <div className={styles.detailMeta}>
                <div className={styles.detailAuthorAvatar}>{selectedAnn.author.charAt(0)}</div>
                <span className={styles.detailAuthor}>{selectedAnn.author}</span>
                <span className={styles.dot}>·</span>
                <span className={styles.detailDate}>{selectedAnn.createdAt}</span>
              </div>
            </div>
            <div className={styles.detailDivider} />
            <div className={styles.detailContent}>{selectedAnn.content}</div>
            {selectedAnn.fileName && (
              <div className={styles.detailFile}>
                <span>📎</span><span>{selectedAnn.fileName}</span>
              </div>
            )}
            {(selectedAnn.authorId === currentUser.id || isLeader) && (
              <div className={styles.detailActions}>
                <button className={styles.deleteBtn}
                  onClick={() => { deleteAnnouncement(project.id, selectedAnn.id); setBoardView('list') }}>
                  🗑️ 삭제하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
