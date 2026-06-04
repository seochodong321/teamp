import React from 'react'
import { useStore } from '../store/useStore.js'
import { useShallow } from 'zustand/react/shallow'
import styles from './ConfirmDialog.module.css'

export default function ConfirmDialog() {
  const { confirmDialog, dismissConfirm } = useStore(
    useShallow((s) => ({ confirmDialog: s.confirmDialog, dismissConfirm: s.dismissConfirm }))
  )
  if (!confirmDialog) return null

  return (
    <>
      <div className={styles.backdrop} onClick={() => dismissConfirm(false)} />
      <div className={styles.dialog}>
        <p className={styles.message}>{confirmDialog.message}</p>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={() => dismissConfirm(false)}>취소</button>
          <button className={styles.confirmBtn} onClick={() => dismissConfirm(true)}>확인</button>
        </div>
      </div>
    </>
  )
}
