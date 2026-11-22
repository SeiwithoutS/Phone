import { addAvatarToMyLibraryFromURL, closeMyAvatarLibraryModal, handleBatchImportForMyAvatar, handleLocalMyAvatarUpload, openMyAvatarLibraryModal } from '../avatars/libraries.js'
import { deleteCallMessage, hideCallMessageActions, openCallMessageEditor } from './calls.js'
import { createAiResponseEditorBlock, saveEditedAiResponse, openAiResponseEditor } from '../chat/editor.js'
import { showCustomPrompt } from '../dialogs/dialogs.js'

export function bindCallEvents() {
  document.getElementById('cancel-create-countdown-btn').addEventListener('click', () => {
            document.getElementById('create-countdown-modal').classList.remove('visible');
        });

document.getElementById('edit-call-message-btn').addEventListener('click', openCallMessageEditor);

document.getElementById('delete-call-message-btn').addEventListener('click', deleteCallMessage);

document.getElementById('cancel-call-message-action-btn').addEventListener('click', hideCallMessageActions);

document.getElementById('edit-last-response-btn').addEventListener('click', openAiResponseEditor);

document.getElementById('cancel-ai-response-editor-btn').addEventListener('click', () => {
            document.getElementById('ai-response-editor-modal').classList.remove('visible');
        });

document.getElementById('save-ai-response-editor-btn').addEventListener('click', saveEditedAiResponse);

document.getElementById('add-ai-response-block-btn').addEventListener('click', () => {
            
            const container = document.getElementById('ai-response-editor-container');
            const newBlock = createAiResponseEditorBlock('{\n  "type": "text",\n  "content": "在这里输入新消息..."\n}');
            container.appendChild(newBlock);
            newBlock.querySelector('textarea').focus();
        });

document.getElementById('manage-my-avatar-library-btn').addEventListener('click', openMyAvatarLibraryModal);

document.getElementById('close-my-avatar-library-btn').addEventListener('click', closeMyAvatarLibraryModal);

document.getElementById('add-my-avatar-url-btn').addEventListener('click', addAvatarToMyLibraryFromURL);

document.getElementById('add-my-avatar-upload-btn').addEventListener('click', () => {
            document.getElementById('my-avatar-upload-input').click();
        });

document.getElementById('my-avatar-upload-input').addEventListener('change', handleLocalMyAvatarUpload);

document.getElementById('add-my-avatar-batch-btn').addEventListener('click', async () => {
            const placeholderText = `请按照以下格式粘贴，一行一个：\n\n焦虑 2a9wte.jpeg\n大惊失色 or8qf4.png\n没有灵感 njwujh.jpeg`;
            const pastedText = await showCustomPrompt("Batch Import Avatars", placeholderText, '', 'textarea');
            if (pastedText && pastedText.trim()) {
                await handleBatchImportForMyAvatar(pastedText);
            }
        });
}
