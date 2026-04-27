import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDagiyf6Na75mbeLGwTOLWdjYhx33aWapg',
  authDomain: 'teamp-7923c.firebaseapp.com',
  projectId: 'teamp-7923c',
  storageBucket: 'teamp-7923c.firebasestorage.app',
  messagingSenderId: '322925743978',
  appId: '1:322925743978:web:9f00a649fc2f69e4245f13',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)