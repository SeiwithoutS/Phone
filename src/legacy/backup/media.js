import { showCustomAlert, showCustomConfirm } from '../dialogs/dialogs.js'
import { runtime } from '../runtime/state.js'

export async function compressAllLocalImages() {
    
    const confirmed = await showCustomConfirm(
        "Compress Images?",
        "This permanently converts local images to JPEG and may reduce quality.<br><br>Export a backup before continuing.",
        { confirmButtonClass: 'btn-danger', confirmText: '我已了解风险，确认压缩' }
    );

    if (!confirmed) return;

    
    await showCustomAlert("Please wait…", "Compressing local images…");

    let stats = {
        found: 0,
        compressed: 0,
        skipped: 0,
        originalSize: 0,
        newSize: 0
    };

    try {
        
        
        
        
        
        console.log("压缩步骤 1/3: 正在从数据库读取所有相关数据...");
        const tablesToScan = [
            'chats', 'globalSettings', 'qzoneSettings', 
            'userStickers', 'customAvatarFrames'
        ];
        const allData = [];
        for (const tableName of tablesToScan) {
            const table = runtime.db.table(tableName);
            const records = await table.toArray();
            allData.push({ tableName, records });
        }

        
        console.log("压缩步骤 2/3: 正在内存中异步压缩图片，这可能需要一些时间...");
        for (const data of allData) {
            for (const record of data.records) {
                
                await traverseAndCompress(record, stats);
            }
        }
        
        
        console.log("压缩步骤 3/3: 正在将压缩后的数据写回数据库...");
        await runtime.db.transaction('rw', tablesToScan, async tx => {
            for (const data of allData) {
                
                await tx.table(data.tableName).bulkPut(data.records);
            }
        });
        
        
        
        

        
        const reduction = stats.originalSize - stats.newSize;
        const reductionPercent = stats.originalSize > 0 ? (reduction / stats.originalSize * 100).toFixed(2) : 0;

        await showCustomAlert(
            "Compression Complete",
            `Scan complete.<br>Images found: ${stats.found}<br>Compressed: ${stats.compressed}<br>Skipped: ${stats.skipped}<br>Space saved: <strong>${(reduction / 1024 / 1024).toFixed(2)} MB</strong> (${reductionPercent}%).<br><br>Reload to apply all changes.`
        );

    } catch (error) {
        console.error("图片压缩过程中发生错误:", error);
        await showCustomAlert("Compression Failed", `Operation failed: ${error.message}`);
    }
}

export function calculateTotalSizeRecursive(obj, parentKey = '') {
    let totalSize = 0;
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (typeof value === 'string' && value.startsWith('data:image')) {
                
    
                const isExcluded = 
            
                    (parentKey === 'globalSettings' && (key === 'wallpaper' || key === 'cphoneWallpaper' || key === 'globalChatBackground')) ||
            
                    (parentKey === 'widgetData') ||
                  
                    (parentKey === 'settings' && key === 'background') ||
                
                    (parentKey === 'appIcons' || parentKey === 'cphoneAppIcons');

                if (!isExcluded) {
                    totalSize += value.length;
                }
                
            } else if (typeof value === 'object' && value !== null) {
                // 递归调用，将当前key作为新的parentKey传下去
                totalSize += calculateTotalSizeRecursive(value, key);
            }
        }
    }
    return totalSize;
}

export async function displayTotalImageSize() {
    const displayElement = document.getElementById('total-image-size-display');
    if (!displayElement) return;

    displayElement.innerHTML = `
        <span id="image-size-label">Calculating image size…</span>
        <span id="image-size-value">-- MB</span>
    `;

    try {
        let totalBytes = 0;
        const tablesToScan = [
            'chats', 'globalSettings', 'qzoneSettings',
            'userStickers', 'customAvatarFrames'
        ];

        for (const tableName of tablesToScan) {
            const table = runtime.db.table(tableName);
            await table.each(record => {
              
                totalBytes += calculateTotalSizeRecursive(record);
            });
        }

        const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
        
        displayElement.innerHTML = `
            <span id="image-size-label">Local image size</span>
            <span id="image-size-value"><strong>${totalMB} MB</strong></span>
        `;

    } catch (error) {
        console.error("计算图片总大小时出错:", error);
        displayElement.innerHTML = `
            <span id="image-size-label">Image size unavailable</span>
            <span id="image-size-value">Error</span>
        `;
    }
}

export async function traverseAndCompress(obj, stats, parentKey = '') {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (typeof value === 'string' && value.startsWith('data:image')) {
                
            
                const isExcluded = 
                    (parentKey === 'globalSettings' && (key === 'wallpaper' || key === 'cphoneWallpaper' || key === 'globalChatBackground')) ||
                    (parentKey === 'widgetData') ||
                    (parentKey === 'settings' && key === 'background') ||
                    (parentKey === 'appIcons' || parentKey === 'cphoneAppIcons');

                if (isExcluded) {
                
                    continue; 
                }
                
       
                stats.found++; // 计入“找到”
                stats.originalSize += value.length;

         
                const compressedBase64 = await compressImage(value);
                if (compressedBase64 && compressedBase64 !== value) {
                    obj[key] = compressedBase64; 
                    stats.compressed++;
                    stats.newSize += compressedBase64.length;
                } else {
                    // "skipped" 现在只代表 "已压缩或无需压缩"
                    stats.skipped++; 
                    stats.newSize += value.length;
                }
        

            } else if (typeof value === 'object' && value !== null) {
          
                await traverseAndCompress(value, stats, key);
            }
        }
    }
}

export function compressImage(base64Str, options = {}) {
    return new Promise((resolve) => {
 
        if (!base64Str.startsWith('data:image')) {
            console.warn("非图片格式，跳过压缩:", base64Str.substring(0, 50) + "...");
            resolve(base64Str); 
            return;
        }

        const quality = options.quality || 0.5; 
        const maxWidth = options.maxWidth || 800; 

        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((maxWidth / width) * height); // 使用 Math.round 避免小数
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, 0, 0, width, height);

            const newDataUrl = canvas.toDataURL('image/jpeg', quality);

            resolve(newDataUrl);

        };
        img.onerror = () => {
            console.warn("加载图片失败，跳过压缩:", base64Str.substring(0, 50) + "...");
            resolve(base64Str); // 加载失败则返回原始字符串
        };
        img.src = base64Str;
    });
}
