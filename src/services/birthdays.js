import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'

// 오늘 생일인 팀원 감지 → 전체방 케이크 메시지 + Firestore 알림 전송
// birthdayLogs/{YYYY}_{memberId}_{projectId} 로 중복 방지
export async function checkBirthdays(projects, myUid) {
  const now     = new Date()
  const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayKey = `${now.getFullYear()}-${todayMD}`

  // 하루에 한 번만 — localStorage로 빠른 중복 방지
  const lastCheck = localStorage.getItem('teamp-birthday-check')
  if (lastCheck === todayKey) return
  localStorage.setItem('teamp-birthday-check', todayKey)

  const activeProjects = projects.filter((p) => p.status === 'active' && !p.isTutorial)

  // ── 내 생일 자축 (본인 기기에서 직접 체크) ──
  try {
    const mySnap = await getDoc(doc(db, 'users', myUid))
    if (mySnap.exists()) {
      const myData = mySnap.data()
      const myBD = myData.birthday?.slice(5) // "YYYY-MM-DD" → "MM-DD"
      if (myBD === todayMD) {
        for (const project of activeProjects) {
          const logId  = `${now.getFullYear()}_${myUid}_${project.id}`
          const logRef = doc(db, 'birthdayLogs', logId)
          try {
            const logSnap = await getDoc(logRef)
            if (logSnap.exists()) continue
            await setDoc(logRef, { sentAt: serverTimestamp(), sentBy: myUid })
          } catch { continue }

          const allRoom = project.rooms?.find((r) => r.name === '전체' && !r.isDm)
          const link = allRoom ? `/project/${project.id}/chat/${allRoom.id}` : `/project/${project.id}`

          if (allRoom) {
            addDoc(collection(db, 'rooms', allRoom.id, 'messages'), {
              senderId: 'system', senderName: '팀프', type: 'notify',
              text: `🎂 오늘은 ${myData.name} 님의 생일이에요! 다 같이 축하해요 🎉`,
              time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              createdAt: serverTimestamp(),
            }).catch(() => {})
          }

          addDoc(collection(db, 'notifications'), {
            targetUserId: myUid, type: 'birthday',
            fromUserId: myUid, // 발신자 본인 검증 (보안 규칙)
            text: `🎉 ${myData.name} 님, 생일을 진심으로 축하해요! 함께한 팀원들 모두 오늘 하루 응원하고 있어요 🎂`,
            projectId: project.id,
            projectName: project.name,
            link, read: false,
            createdAt: serverTimestamp(),
          }).catch(() => {})
        }
      }
    }
  } catch {}

  // ── 팀원 생일 체크 (나 제외) ──
  const memberIdSet = new Set()
  activeProjects.forEach((p) => {
    p.members?.forEach((m) => { if (m.id !== myUid) memberIdSet.add(m.id) })
  })
  if (memberIdSet.size === 0) return

  const birthdayMembers = []
  await Promise.all([...memberIdSet].map(async (uid) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) {
        const d = snap.data()
        if (d.birthday?.slice(5) === todayMD) birthdayMembers.push({ id: uid, name: d.name || '팀원' })
      }
    } catch {}
  }))
  if (birthdayMembers.length === 0) return

  for (const member of birthdayMembers) {
    const sharedProjects = activeProjects.filter((p) => p.memberIds?.includes(member.id))
    for (const project of sharedProjects) {
      const logId  = `${now.getFullYear()}_${member.id}_${project.id}`
      const logRef = doc(db, 'birthdayLogs', logId)
      try {
        const logSnap = await getDoc(logRef)
        if (logSnap.exists()) continue
        await setDoc(logRef, { sentAt: serverTimestamp(), sentBy: myUid })
      } catch { continue }

      const allRoom = project.rooms?.find((r) => r.name === '전체' && !r.isDm)
      const link = allRoom ? `/project/${project.id}/chat/${allRoom.id}` : `/project/${project.id}`

      if (allRoom) {
        addDoc(collection(db, 'rooms', allRoom.id, 'messages'), {
          senderId: 'system', senderName: '팀프', type: 'notify',
          text: `🎂 오늘은 ${member.name} 님의 생일이에요! 다 같이 축하해요 🎉`,
          time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          createdAt: serverTimestamp(),
        }).catch(() => {})
      }

      // 생일 당사자에게 따뜻한 개인 알림
      addDoc(collection(db, 'notifications'), {
        targetUserId: member.id, type: 'birthday',
        fromUserId: myUid, // 발신자 본인 검증 (보안 규칙)
        text: `🎉 ${member.name} 님, 생일을 진심으로 축하해요! 함께한 팀원들 모두 오늘 하루 응원하고 있어요 🎂`,
        projectId: project.id,
        projectName: project.name,
        link, read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {})
    }
  }
}
