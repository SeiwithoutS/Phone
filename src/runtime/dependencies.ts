import type JSZip from 'jszip'

interface ScreenshotOptions {
  allowTaint?: boolean
  useCORS?: boolean
  scale?: number
  backgroundColor?: string | null
}

type Capture = (element: HTMLElement, options?: ScreenshotOptions) => Promise<HTMLCanvasElement>
declare global {
  interface Window { html2canvas?: Capture }
}

let screenshotLibrary: Promise<Capture> | undefined

function loadScreenshotLibrary(): Promise<Capture> {
  if (window.html2canvas) return Promise.resolve(window.html2canvas)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    script.onload = () => {
      if (window.html2canvas) resolve(window.html2canvas)
      else { script.remove(); reject(new Error('Screenshot library did not initialize.')) }
    }
    script.onerror = () => { script.remove(); reject(new Error('Could not load the screenshot library.')) }
    document.head.append(script)
  })
}

export async function captureScreenshot(element: HTMLElement, options?: ScreenshotOptions) {
  screenshotLibrary ??= loadScreenshotLibrary().catch(error => {
    screenshotLibrary = undefined
    throw error
  })
  const capture = await screenshotLibrary
  return capture(element, options)
}

export async function openImageArchive(blob: Blob): Promise<JSZip> {
  const { default: zip } = await import('jszip')
  return zip.loadAsync(blob)
}
