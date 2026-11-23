import { escapeHtml } from '../../runtime/files'
import { importPromptCollection } from './collection-actions.js'
import { showCustomAlert, showCustomConfirm, showCustomPrompt } from '../dialogs/dialogs.js'
import { renderWorldBookScreen } from './books.js'
import { runtime } from '../runtime/state.js'

export async function handleWorldBookImport(file) {
            if (!file) return;
        
            try {
                const text = await file.text();
                const data = JSON.parse(text.replace(/^\uFEFF/, ''));
                if (await importPromptCollection('worldBooks', data)) {
                    await renderWorldBookScreen();
                    return;
                }
        
                
                if (data.type === 'EPhoneWorldBookBackup') {
                    console.log("检测到 EPhone 备份文件，执行标准导入...");
                    await importWorldBooks(data); 
                } 
                
                else if (data.entries && typeof data.entries === 'object') {
                    console.log("检测到 Tavern AI 世界书文件，执行兼容导入...");
                    await importTavernWorldBook(data, file.name);
                } 
                
                else {
                    throw new Error("文件格式无法识别。请确保您选择的是有效的 EPhone 世界书备份或 Tavern AI 世界书文件。");
                }
        
            } catch (error) {
                console.error("导入世界书时出错:", error);
                await showCustomAlert("Import Failed", `Could not read or apply the file: ${escapeHtml(String(error.message))}`);
            }
        }

export async function importTavernWorldBook(tavernData, fileName) {
            const bookNameSuggestion = fileName.replace(/\.json$/i, ''); 
        
            const newBookName = await showCustomPrompt(
                "Import as Mini Prompts",
                "Enter a name for this Mini Prompts book",
                bookNameSuggestion
            );
        
            if (!newBookName || !newBookName.trim()) {
                alert("Import cancelled because no name was provided.");
                return;
            }
        
            const newEntries = Object.values(tavernData.entries).map(entry => {
                
                return {
                    keys: entry.key || [],
                    comment: entry.comment || '无备注',
                    content: entry.content || '',
                    enabled: !entry.disable 
                };
            }).filter(entry => entry.content); 
        
            if (newEntries.length === 0) {
                alert("The SillyTavern World Info file has no valid entries.");
                return;
            }
        
            const newWorldBook = {
                id: 'wb_' + Date.now(),
                name: newBookName.trim(),
                content: newEntries,
            };
        
            await runtime.db.worldBooks.add(newWorldBook);
            runtime.state.worldBooks.push(newWorldBook); 
            await renderWorldBookScreen(); 
        
            await showCustomAlert("Import Complete", `Imported “${escapeHtml(newBookName)}” from SillyTavern.`);
        }

export async function exportWorldBooks() {
            try {
                const books = await runtime.db.worldBooks.toArray();
        
                if (books.length === 0) {
                    alert("There are no Mini Prompts books to export.");
                    return;
                }
        
                const backupData = {
                    type: 'EPhoneWorldBookBackup', 
                    version: 1,
                    timestamp: Date.now(),
                    books: books.map(({ categoryId, ...book }) => book)
                };
        
                const blob = new Blob(
                    [JSON.stringify(backupData, null, 2)], 
                    { type: 'application/json' }
                );
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `EPhone-WorldBooks-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                URL.revokeObjectURL(url);
                
                await showCustomAlert("Export Complete", "Mini Prompts exported.");
        
            } catch (error) {
                console.error("导出世界书时出错:", error);
                await showCustomAlert("Export Failed", `An error occurred: ${escapeHtml(String(error.message))}`);
            }
        }

export async function importWorldBooks(data) {
            
            try {
                if (data.type !== 'EPhoneWorldBookBackup' || !data.books) {
                    throw new Error("文件格式不正确，这不是一个有效的世界书备份文件。");
                }
        
                const confirmed = await showCustomConfirm(
                    "Import Mini Prompts",
                    "Replace your current Mini Prompts books with this file?",
                    { confirmButtonClass: 'btn-danger', confirmText: '确认覆盖' }
                );
        
                if (!confirmed) return;
        
                await runtime.db.transaction('rw', runtime.db.worldBooks, async tx => {
                    await tx.worldBooks.clear();
                    
                    if (Array.isArray(data.books)) {
                        await tx.worldBooks.bulkPut(data.books.map(({ categoryId, ...book }) => book));
                    }
                });
        
                
                runtime.state.worldBooks = await runtime.db.worldBooks.toArray();
                await renderWorldBookScreen();
        
                await showCustomAlert("Import Complete", "Mini Prompts restored.");
        
            } catch (error) {
                console.error("导入世界书时出错:", error);
                await showCustomAlert("Import Failed", `Could not read or apply the file: ${escapeHtml(String(error.message))}`);
            }
        }
