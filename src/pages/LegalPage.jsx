import React from 'react'
import { Link } from 'react-router-dom'
import TeampMark from '../components/TeampMark.jsx'
import styles from './LegalPage.module.css'

export default function LegalPage({ data }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <TeampMark size={22} />
          <span className={styles.brandName}>팀프</span>
        </Link>
        <button className={styles.back} onClick={() => window.history.back()}>← 뒤로</button>
      </header>

      <main className={styles.doc}>
        <h1 className={styles.title}>{data.title}</h1>
        <p className={styles.updated}>최종 업데이트: {data.lastUpdated}</p>

        {data.intro && <p className={styles.intro}>{data.intro}</p>}

        <div className={styles.sections}>
          {data.sections.map((sec, i) => (
            <section key={i} className={styles.section}>
              {sec.heading && <h2 className={styles.heading}>{sec.heading}</h2>}
              {sec.paragraphs?.map((para, j) => (
                <p key={j} className={styles.para}>{para}</p>
              ))}
              {sec.items && (
                <ul className={styles.list}>
                  {sec.items.map((item, k) => (
                    <li key={k} className={styles.listItem}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {data.cultureSection && (
          <section className={`${styles.section} ${styles.cultureSection}`}>
            <h2 className={styles.heading}>{data.cultureSection.heading}</h2>
            {data.cultureSection.paragraphs.map((para, i) => (
              <p key={i} className={styles.para}>{para}</p>
            ))}
          </section>
        )}

        <div className={styles.contactBox}>
          <p className={styles.contactLabel}>문의</p>
          <a href={`mailto:${data.contact}`} className={styles.contactLink}>{data.contact}</a>
        </div>
      </main>

      <footer className={styles.footer}>
        <Link to="/terms" className={styles.footerLink}>이용약관</Link>
        <span className={styles.footerDot}>·</span>
        <Link to="/privacy" className={styles.footerLink}>개인정보처리방침</Link>
        <span className={styles.footerDot}>·</span>
        <Link to="/guidelines" className={styles.footerLink}>커뮤니티 가이드라인</Link>
      </footer>
    </div>
  )
}
