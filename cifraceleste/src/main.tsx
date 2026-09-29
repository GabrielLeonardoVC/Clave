/**
 * main — ponto de entrada.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { ProvedorAviso, ProvedorConfirmacao } from './components/ui'
import { inicializar } from './lib/store'
import { escutarInstalacao } from './lib/pwa'
import './index.css'

inicializar()
escutarInstalacao()

const raiz = document.getElementById('root')
if (!raiz) {
  throw new Error('Elemento #root não encontrado no index.html.')
}

createRoot(raiz).render(
  <StrictMode>
    <ProvedorAviso>
      <ProvedorConfirmacao>
        <App />
      </ProvedorConfirmacao>
    </ProvedorAviso>
  </StrictMode>,
)
