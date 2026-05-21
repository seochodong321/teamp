import React, { useState, useRef } from 'react'
import { useStore } from '../../store/useStore.js'
import styles from '../ProjectPage.module.css'

const fmtDate = (iso) => {
  const d = new Date(iso)
  const mo = d.getMonth() + 1
  const da = d.getDate()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${mo}/${da} ${hh}:${mm}`
}

export default function BoardTab({ project, currentUser, isLeader, defaultView = 'list', defaultGlobal = false }) {
  const { addAnnouncement, deleteAnnouncement, addComment, deleteComment, addReply, deleteReply } = useStore()

  const [boardView, setBoardView]     = useState(defaultView)
  const [selectedAnnId, setSelectedAnnId] = useState(null)
  const [annTitle, setAnnTitle]       = useState('')
  const [annContent, setAnnContent]   = useState('')
  const [annIsGlobal, setAnnIsGlobal] = useState(defaultGlobal)
  const [annFile, setAnnFile]         = useState(null)
  const [commentText, setCommentText] = useState('')
  const [replyingTo, setReplyingTo]   = useState(null)
  const [replyText, setReplyText]     = useState('')
  const fileRef = useRef(null)

  // 항상 live 데이터 참조 (댓글 추가 시 자동 반영)
  const liveAnn = selectedAnnId
    ? project.announcements.find((a) => a.id === selectedAnnId) || null
    : null

  const openDetail = (ann) => {
    setSelectedAnnId(ann.id)
    setCommentText('')
    setReplyingTo(null)
    setReplyText('')
    setBoardView('detail')
  }

  const handleWriteAnn = () => {
    if (!annTitle.trim() || !annContent.trim()) return
    addAnnouncement(project.id, { title: annTitle, content: annContent, isGlobal: annIsGlobal, fileName: annFile?.name || null })
    setBoardView('list')
  }

  const handleAddComment = () => {
    if (!commentText.trim() || !liveAnn) return
    addComment(project.id, liveAnn.id, commentText.trim())
    setCommentText('')
  }

  const handleAddReply = (commentId) => {
    if (!replyText.trim() || !liveAnn) return
    addReply(project.id, liveAnn.id, commentId, replyText.trim())
    setReplyText('')
    setReplyingTo(null)
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
                  onClick={() => openDetail(ann)}>
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
                    {(ann.comments?.length > 0) && (
                      <span className={styles.commentCount}>💬 {ann.comments.length}</span>
                    )}
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

      {boardView === 'detail' && liveAnn && (
        <div className={styles.detailWrap}>
          <button className={styles.backBtn} onClick={() => setBoardView('list')}>← 목록으로</button>
          <div className={styles.detailCard}>
            <div className={styles.detailHeader}>
              {liveAnn.isGlobal && <span className={styles.noticeBadge}>📢 공지</span>}
              <h2 className={styles.detailTitle}>{liveAnn.title}</h2>
              <div className={styles.detailMeta}>
                <div className={styles.detailAuthorAvatar}>{liveAnn.author.charAt(0)}</div>
                <span className={styles.detailAuthor}>{liveAnn.author}</span>
                <span className={styles.dot}>·</span>
                <span className={styles.detailDate}>{liveAnn.createdAt}</span>
              </div>
            </div>
            <div className={styles.detailDivider} />
            <div className={styles.detailContent}>{liveAnn.content}</div>
            {liveAnn.fileName && (
              <div className={styles.detailFile}>
                <span>📎</span><span>{liveAnn.fileName}</span>
              </div>
            )}
            {(liveAnn.authorId === currentUser.id || isLeader) && (
              <div className={styles.detailActions}>
                <button className={styles.deleteBtn}
                  onClick={() => { deleteAnnouncement(project.id, liveAnn.id); setBoardView('list') }}>
                  🗑️ 삭제하기
                </button>
              </div>
            )}
          </div>

          {/* 댓글 섹션 */}
          <div className={styles.commentSection}>
            <h4 className={styles.commentSectionTitle}>
              댓글 {(liveAnn.comments || []).length}개
            </h4>

            {(liveAnn.comments || []).map((comment) => (
              <div key={comment.id} className={styles.commentItem}>
                <div className={styles.cmtAvatar}>{comment.author.charAt(0)}</div>
                <div className={styles.cmtBody}>
                  <div className={styles.cmtMeta}>
                    <span className={styles.cmtAuthor}>{comment.author}</span>
                    <span className={styles.cmtDate}>{fmtDate(comment.createdAt)}</span>
                  </div>
                  <p className={styles.cmtContent}>{comment.content}</p>
                  <div className={styles.cmtActionRow}>
                    <button className={styles.cmtActionBtn}
                      onClick={() => { setReplyingTo(replyingTo === comment.id ? null : comment.id); setReplyText('') }}>
                      ↩ 대댓글
                    </button>
                    {(comment.authorId === currentUser.id || isLeader) && (
                      <button className={`${styles.cmtActionBtn} ${styles.cmtDeleteBtn}`}
                        onClick={() => deleteComment(project.id, liveAnn.id, comment.id)}>
                        삭제
                      </button>
                    )}
                  </div>

                  {/* 대댓글 목록 */}
                  {(comment.replies || []).length > 0 && (
                    <div className={styles.replyList}>
                      {(comment.replies || []).map((reply) => (
                        <div key={reply.id} className={styles.replyItem}>
                          <div className={styles.cmtAvatarSm}>{reply.author.charAt(0)}</div>
                          <div className={styles.cmtBody}>
                            <div className={styles.cmtMeta}>
                              <span className={styles.cmtAuthor}>{reply.author}</span>
                              <span className={styles.cmtDate}>{fmtDate(reply.createdAt)}</span>
                            </div>
                            <p className={styles.cmtContent}>{reply.content}</p>
                            {(reply.authorId === currentUser.id || isLeader) && (
                              <div className={styles.cmtActionRow}>
                                <button className={`${styles.cmtActionBtn} ${styles.cmtDeleteBtn}`}
                                  onClick={() => deleteReply(project.id, liveAnn.id, comment.id, reply.id)}>
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 대댓글 입력 */}
                  {replyingTo === comment.id && (
                    <div className={styles.replyInputRow}>
                      <input
                        className={styles.cmtInput}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="대댓글을 입력하세요..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddReply(comment.id) }
                          if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') }
                        }}
                      />
                      <button className={styles.cmtSubmitBtn} disabled={!replyText.trim()}
                        onClick={() => handleAddReply(comment.id)}>등록</button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* 댓글 입력 */}
            <div className={styles.commentInputRow}>
              <div className={styles.cmtAvatar}>{currentUser.name.charAt(0)}</div>
              <input
                className={styles.cmtInput}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="댓글을 입력하세요..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddComment() }
                }}
              />
              <button className={styles.cmtSubmitBtn} disabled={!commentText.trim()}
                onClick={handleAddComment}>등록</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
