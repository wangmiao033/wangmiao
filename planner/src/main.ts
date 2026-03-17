import './style.css'
import { mountApp } from './planner/app'

mountApp(document.querySelector<HTMLDivElement>('#app')!)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // ignore
    })
  })
}
