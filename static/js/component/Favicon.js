'use strict'

/**
 * Build a favicon using text in a canvas
 */
export default class Favicon {
  constructor () {
    this.canvas = document.createElement('canvas')
    this.canvas.height = 64
    this.canvas.width = 64
    this.ctx = this.canvas.getContext('2d')
    this.ctx.font = '40px serif'
    this.lastIcon = null
    this.updateIcon('')
  }

  /**
   * Update favicon
   * @param {String} newIcon Text or emoji to show at bottom of favicon
   */
  updateIcon (newIcon) {
    if (newIcon === this.lastIcon) {
      return // Icon is already set
    }
    this.lastIcon = newIcon

    // Replace icon
    this.ctx.clearRect(0, 0, 64, 64)
    this.ctx.fillText('🎶', 0, 42)
    this.ctx.fillText(newIcon, 24, 60)
    document.querySelector("link[rel='icon']").href = this.canvas.toDataURL()
  }
}
