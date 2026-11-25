import { runtime } from '../runtime/state.js'

export function applyCustomFont(fontUrl, isPreviewOnly = false) {
                    if (!fontUrl) {
                        if (isPreviewOnly) document.getElementById('font-preview').style.fontFamily = '';
                        else runtime.dynamicFontStyle.innerHTML = '';
                        return;
                    }
                    const fontName = 'custom-user-font';
                    const newStyle = `
                        @font-face {
                          font-family: '${fontName}';
                          src: url('${fontUrl}');
                          font-display: swap;
                        }`;
                    if (isPreviewOnly) {
                        const previewStyle = document.getElementById('preview-font-style') || document.createElement('style');
                        previewStyle.id = 'preview-font-style';
                        previewStyle.innerHTML = newStyle;
                        if (!document.getElementById('preview-font-style')) document.head.appendChild(previewStyle);
                        document.getElementById('font-preview').style.fontFamily = `'${fontName}', 'bulangni', sans-serif`;
                    } else {
                        runtime.dynamicFontStyle.innerHTML = `
                            ${newStyle}
                            body {
                              font-family: '${fontName}', 'bulangni', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            }`;
                    }
                }

function fontSizePercent(value) {
  return Number.isFinite(value) ? Math.max(85, Math.min(130, value)) : 100
}

export function applyAppFontSize() {
  document.documentElement.style.setProperty('--app-font-size', fontSizePercent(runtime.state.globalSettings.appFontSize) + '%')
}

export function renderFontSettings() {
  const settings = runtime.state.globalSettings
  document.getElementById('font-url-input').value = settings.fontUrl || ''
  document.getElementById('app-font-size').value = fontSizePercent(settings.appFontSize)
  applyCustomFont(settings.fontUrl, true)
  previewAppFontSize()
}

function previewAppFontSize() {
  const size = document.getElementById('app-font-size').valueAsNumber
  document.getElementById('app-font-size-value').value = size + '%'
  document.getElementById('font-preview').style.fontSize = (size / fontSizePercent(runtime.state.globalSettings.appFontSize)) + 'em'
}

export function bindFontSettings() {
  const url = document.getElementById('font-url-input')
  const size = document.getElementById('app-font-size')
  const save = document.getElementById('save-font-btn')
  const reset = document.getElementById('reset-font-btn')
  url.addEventListener('input', () => applyCustomFont(url.value.trim(), true))
  size.addEventListener('input', previewAppFontSize)

  const persist = async (fontUrl, appFontSize) => {
    const db = runtime.db
    save.disabled = reset.disabled = true
    try {
      await db.transaction('rw', db.globalSettings, async tx => {
        const current = await tx.globalSettings.get('main') ?? runtime.state.globalSettings
        await tx.globalSettings.put({ ...current, fontUrl, appFontSize })
      })
      Object.assign(runtime.state.globalSettings, { fontUrl, appFontSize })
      applyCustomFont(fontUrl)
      applyAppFontSize()
      renderFontSettings()
    } catch {
      // Storage reports the failed write to the app.
    } finally {
      save.disabled = reset.disabled = false
    }
  }
  save.addEventListener('click', () => void persist(url.value.trim(), size.valueAsNumber))
  reset.addEventListener('click', () => void persist('', 100))
}
