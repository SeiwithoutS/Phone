import { runtime } from '../runtime/state.js'

export function parseMarkdown(text) {
            if (!text || typeof text !== 'string') return '';

            
            text = text.replace(/!h\{(.*?)\}/g, '<span class="diary-highlight">$1</span>');
            text = text.replace(/!u\{(.*?)\}/g, '<span class="diary-underline">$1</span>');
            text = text.replace(/!e\{(.*?)\}/g, '<span class="diary-emphasis">$1</span>');
            text = text.replace(/!w\{(.*?)\}/g, '<span class="diary-handwritten">$1</span>');
            text = text.replace(/!m\{(.*?)\}/g, '<span class="diary-messy">$1</span>');
            
            
            
            text = text.replace(/\|\|(.*?)\|\|/g, '<span class="spoiler">$1</span>');
              

            
            text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/\~\~(.*?)\~\~/g, '<s>$1</s>'); 
            text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

            return text;
        }

export async function migrateOldRedPacketData() {
            console.log("开始检查并迁移旧的红包数据...");
            let migrationCount = 0;
            
            const allChats = Object.values(runtime.state.chats);
        
            for (const chat of allChats) {
                let needsDbUpdate = false;
                for (const msg of chat.history) {
                    
                    if (msg.type === 'red_packet' && msg.packetType === 'direct' && msg.role === 'assistant' && msg.hasOwnProperty('receiver') && !msg.hasOwnProperty('receiverName')) {
                        
                        msg.receiverName = msg.receiver;
                        delete msg.receiver;
                        
                        needsDbUpdate = true; 
                        migrationCount++;
                    }
                }
                
                if (needsDbUpdate) {
                    console.log(`在聊天 "${chat.name}" 中发现并修复了旧红包数据。`);
                    await runtime.db.chats.put(chat);
                }
            }
        
            if (migrationCount > 0) {
                console.log(`数据迁移完成！总共修复了 ${migrationCount} 条红包记录。`);
                alert(`Repaired ${migrationCount} old red-envelope messages. EPhone will reload to apply the changes.`);
                location.reload(); 
            } else {
                console.log("未发现需要迁移的旧红包数据。");
            }
        }
