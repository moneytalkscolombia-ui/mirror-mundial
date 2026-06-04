import { h, render } from 'preact'
import MirrorMundial from './MirrorMundial.jsx'
import styles from './styles/tokens.css?inline'

function injectStyles(shadow, cssText) {
  if (typeof CSSStyleSheet !== 'undefined' && shadow.adoptedStyleSheets !== undefined) {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(cssText)
    shadow.adoptedStyleSheets = [sheet]
  } else {
    const style = document.createElement('style')
    style.textContent = cssText
    shadow.appendChild(style)
  }
}

class MirrorMundialElement extends HTMLElement {
  #root = null

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' })
    injectStyles(shadow, styles)
    this.#root = shadow
    render(<MirrorMundial hostElement={this} />, shadow)
  }

  disconnectedCallback() {
    if (this.#root) {
      render(null, this.#root)
      this.#root = null
    }
  }
}

customElements.define('mirror-mundial', MirrorMundialElement)
