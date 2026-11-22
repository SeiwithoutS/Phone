import { runtime } from '../runtime/state.js'

export function applyCustomFont(fontUrl, isPreviewOnly = false) {
                    if (!fontUrl) {
                        runtime.dynamicFontStyle.innerHTML = '';
                        document.getElementById('font-preview').style.fontFamily = '';
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

export async function resetToDefaultFont() {
                    runtime.dynamicFontStyle.innerHTML = ''; 
                    runtime.state.globalSettings.fontUrl = '';
                    await runtime.db.globalSettings.put(runtime.state.globalSettings);
                    document.getElementById('font-url-input').value = '';
                    document.getElementById('font-preview').style.fontFamily = '';
                    alert("Default font restored.");
                }
