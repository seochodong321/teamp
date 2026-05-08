// Teamp 핵심 도메인 타입 정의
// JavaScript 코드베이스 유지하면서 IDE 자동완성/타입 안전성 확보용

export interface Member {
  id: string
  name: string
  role: 'leader' | 'sub-leader' | 'member'
  roomIds: string[]
  memo: string
  affiliation: string
  email: string
}

export interface Room {
  id: string
  name: string
  isDm: boolean
  ownerId?: string
  unread: number
  lastMessage: string
  time: string
  color?: string
  bg?: string
}

export interface Todo {
  id: string
  title: string
  status: 'todo' | 'doing' | 'done'
  assignee: string        // member id
  assigneeName: string
  dueDate: string         // YYYY-MM-DD
  priority: 'high' | 'medium' | 'low'
  createdBy: string
  createdAt: number
}

export interface CalendarEvent {
  id: string
  title: string
  date: string            // YYYY-MM-DD
  time: string
  scope: 'all' | 'room'
  roomIds: string[]
  isPersonal: boolean
  createdBy: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  isGlobal: boolean
  authorId: string
  authorName: string
  createdAt: number
  fileName?: string
  fileUrl?: string
}

export interface Project {
  id: string
  name: string
  emoji: string
  purpose: string
  category: string
  startDate: string       // YYYY-MM-DD
  endDate: string         // YYYY-MM-DD
  status: 'active' | 'collecting' | 'archived'
  leaderId: string
  memberIds: string[]
  members: Member[]
  rooms: Room[]
  todos: Todo[]
  events: CalendarEvent[]
  announcements: Announcement[]
  inviteCode: string
  isPublic: boolean
  isTutorial?: boolean
  progress?: number
  wrapupId?: string
  feedbackDeadline?: string
}

export interface Message {
  id: string
  senderId: string
  senderName: string
  text: string
  type: 'text' | 'image' | 'file' | 'poll' | 'notify'
  time: string
  createdAt: import('firebase/firestore').Timestamp
  fileUrl?: string
  fileName?: string
  options?: PollOption[]  // type === 'poll'
}

export interface PollOption {
  id: number
  label: string
  votes: string[]         // member id 배열
}

export interface DmRoom {
  id: string
  projectId: string
  participants: string[]
  participantNames: Record<string, string>
  createdBy: string
  left: string[]
}

export interface User {
  id: string
  name: string
  email: string
  username: string
  affiliation?: string
  phone?: string
  oneliner?: string
  fcmToken?: string
}

export interface Notification {
  id: string
  type: 'system' | 'dm' | 'projectInvite' | 'join' | 'push'
  text: string
  projectId?: string
  link?: string
  read: boolean
  createdAt: number
}

export interface ProjectInvite {
  id: string
  projectId: string
  projectName: string
  inviterId: string
  inviterName: string
  inviteeId: string
  inviteeName: string
  endDate: string
  status: 'pending' | 'accepted' | 'declined'
}

export interface Connect {
  id: string              // member id
  name: string
  affiliation: string
  email: string
  projectName: string
  connectedAt: string     // YYYY-MM-DD
}

export interface ErrorToast {
  id: string
  message: string
}

export interface ChatToast {
  id: string
  projectId: string
  roomId: string
  senderName: string
  roomName: string
  text: string
}
