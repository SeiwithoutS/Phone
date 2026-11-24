import { publishChatPost } from '../../../features/social/activity'
import { preferences } from '../../storage/preferences.js'
import { processMentions } from '../groups.js'
import { getCharacterNAIPrompts, getNovelAISettings } from '../../novelai/images.js'
import { renderQzonePosts, updateUnreadIndicator } from '../../qzone/feed.js'
import { openImageArchive } from '../../../runtime/dependencies'
import { runtime } from '../../runtime/state.js'

export async function publishAiPost(chat, chatId, actor, msgData, isViewingThisChat) {
    const newPost = {
        type: msgData.postType,
        content: msgData.content || '',
        publicText: msgData.publicText || '',
        hiddenContent: msgData.hiddenContent || '',
        image_prompt: msgData.image_prompt || '', // <--- 把这行加回来
        timestamp: Date.now(),
        authorId: chatId,
        authorGroupId: chat.groupId, // 【核心新增】记录作者的分组ID
        visibleGroupIds: null
    };

    // 如果是naiimag类型，调用NovelAI API生成高质量图片（限制最多2张）
    if (msgData.postType === 'naiimag' && msgData.prompt) {
        try {
            // 支持 prompt 为数组（多张图片）或字符串（单张图片）
            // 动态限制最多2张NAI图片
            const prompts = Array.isArray(msgData.prompt) ? msgData.prompt.slice(0, 2) : [msgData.prompt];
            console.log(`📸 动态NovelAI图片生成开始，共${prompts.length}张图片`);

            // 存储生成的图片URL
            const generatedImageUrls = [];

            // 逐个生成图片
            for (let i = 0; i < prompts.length; i++) {
                const aiPrompt = prompts[i];
                console.log(`生成第${i + 1}张图片，prompt:`, aiPrompt);

                // 获取角色的NAI提示词配置（系统或角色专属）
                const naiPrompts = getCharacterNAIPrompts(chat.id);

                // 构建最终的提示词：AI的prompt + 配置的提示词
                const finalPositivePrompt = aiPrompt + ', ' + naiPrompts.positive;
                const finalNegativePrompt = naiPrompts.negative;

                console.log(`📝 使用${naiPrompts.source === 'character' ? '角色专属' : '系统'}提示词配置`);
                console.log('最终正面提示词:', finalPositivePrompt);
                console.log('最终负面提示词:', finalNegativePrompt);

                // 获取NAI设置（从localStorage读取）
                const apiKey = preferences.getItem('novelai-api-key');
                const model = preferences.getItem('novelai-model') || 'nai-diffusion-4-5-full';
                const settings = getNovelAISettings();

                if (!apiKey) {
                    throw new Error('NovelAI API Key未配置。请在NovelAI设置中填写API Key。');
                }

                const [width, height] = settings.resolution.split('x').map(Number);

                // ★★★ V4/V4.5 和 V3 使用不同的请求体格式 ★★★
                let requestBody;

                if (model.includes('nai-diffusion-4')) {
                    // V4/V4.5 使用新格式 (params_version: 3)
                    requestBody = {
                        input: finalPositivePrompt,
                        model: model,
                        action: 'generate',
                        parameters: {
                            params_version: 3,  // V4必须使用版本3
                            width: width,
                            height: height,
                            scale: settings.cfg_scale,
                            sampler: settings.sampler,
                            steps: settings.steps,
                            seed: settings.seed === -1 ? Math.floor(Math.random() * 9999999999) : settings.seed,
                            n_samples: 1,
                            ucPreset: settings.uc_preset,
                            qualityToggle: settings.quality_toggle,
                            autoSmea: false,
                            dynamic_thresholding: false,
                            controlnet_strength: 1,
                            legacy: false,
                            add_original_image: true,
                            cfg_rescale: 0,
                            noise_schedule: 'karras',  // V4使用karras
                            legacy_v3_extend: false,
                            skip_cfg_above_sigma: null,
                            use_coords: false,
                            legacy_uc: false,
                            normalize_reference_strength_multiple: true,
                            inpaintImg2ImgStrength: 1,
                            characterPrompts: [],
                            // V4专用提示词格式
                            v4_prompt: {
                                caption: {
                                    base_caption: finalPositivePrompt,
                                    char_captions: []
                                },
                                use_coords: false,
                                use_order: true
                            },
                            // V4专用负面提示词格式
                            v4_negative_prompt: {
                                caption: {
                                    base_caption: finalNegativePrompt,
                                    char_captions: []
                                },
                                legacy_uc: false
                            },
                            negative_prompt: finalNegativePrompt,
                            deliberate_euler_ancestral_bug: false,
                            prefer_brownian: true
                            // 注意：不包含 stream 参数，使用标准ZIP响应而非msgpack流
                        }
                    };
                } else {
                    // V3 及更早版本使用旧格式
                    requestBody = {
                        input: finalPositivePrompt,
                        model: model,
                        action: 'generate',
                        parameters: {
                            width: width,
                            height: height,
                            scale: settings.cfg_scale,
                            sampler: settings.sampler,
                            steps: settings.steps,
                            seed: settings.seed === -1 ? Math.floor(Math.random() * 9999999999) : settings.seed,
                            n_samples: 1,
                            ucPreset: settings.uc_preset,
                            qualityToggle: settings.quality_toggle,
                            sm: settings.smea,
                            sm_dyn: settings.smea_dyn,
                            dynamic_thresholding: false,
                            controlnet_strength: 1,
                            legacy: false,
                            add_original_image: false,
                            cfg_rescale: 0,
                            noise_schedule: 'native',
                            negative_prompt: finalNegativePrompt
                        }
                    };
                }

                console.log('🚀 发送NAI请求:', requestBody);

                // ★★★ 根据模型选择不同的API端点 ★★★
                let apiUrl;

                // V4/V4.5 模型使用流式端点
                if (model.includes('nai-diffusion-4')) {
                    // V4/V4.5 默认使用流式端点
                    apiUrl = 'https://image.novelai.net/ai/generate-image-stream';
                } else {
                    // V3 及更早版本使用标准端点
                    apiUrl = 'https://image.novelai.net/ai/generate-image';
                }

                let corsProxy = settings.cors_proxy;

                // 如果选择了自定义代理，使用自定义URL
                if (corsProxy === 'custom') {
                    corsProxy = settings.custom_proxy_url || '';
                }

                // 如果有代理，添加到URL前面
                if (corsProxy && corsProxy !== '') {
                    apiUrl = corsProxy + encodeURIComponent(apiUrl);
                }

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + apiKey
                    },
                    body: JSON.stringify(requestBody)
                });

                console.log('Response status:', response.status);
                console.log('Response headers:', [...response.headers.entries()]);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('API错误响应:', errorText);
                    throw new Error(`API请求失败 (${response.status}): ${errorText}`);
                }

                // NovelAI API返回的是ZIP文件，需要解压
                const contentType = response.headers.get('content-type');
                console.log('Content-Type:', contentType);

                // 检查是否为 SSE 流式响应
                let zipBlob;
                let imageDataUrl;
                if (contentType && contentType.includes('text/event-stream')) {
                    console.log('检测到 SSE 流式响应，开始解析...');

                    // 读取整个流
                    const text = await response.text();
                    console.log('收到 SSE 数据，大小:', text.length);

                    // 解析 SSE 格式，提取最后的 data: 行
                    const lines = text.trim().split('\n');
                    let base64Data = null;

                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i].trim();
                        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                            const dataContent = line.substring(6); // 移除 'data: ' 前缀

                            // 尝试解析 JSON
                            try {
                                const jsonData = JSON.parse(dataContent);

                                // V4.5 流式端点：event_type 为 "final" 时包含最终图片
                                if (jsonData.event_type === 'final' && jsonData.image) {
                                    base64Data = jsonData.image;
                                    console.log('✅ 找到 final 事件的图片数据');
                                    break;
                                }

                                // 兼容其他格式
                                if (jsonData.data) {
                                    base64Data = jsonData.data;
                                    console.log('从 JSON.data 中提取图片数据');
                                    break;
                                }
                                if (jsonData.image) {
                                    base64Data = jsonData.image;
                                    console.log('从 JSON.image 中提取图片数据');
                                    break;
                                }
                            } catch (e) {
                                // 如果不是 JSON，直接作为 base64 数据
                                base64Data = dataContent;
                                console.log('直接使用 base64 数据');
                                break;
                            }
                        }
                    }

                    if (!base64Data) {
                        throw new Error('无法从 SSE 响应中提取图片数据');
                    }

                    // V4.5 流式端点返回的是 PNG base64，不是 ZIP
                    // 检查是否为 PNG (以 iVBORw0KGgo 开头) 或 JPEG (以 /9j/ 开头)
                    const isPNG = base64Data.startsWith('iVBORw0KGgo');
                    const isJPEG = base64Data.startsWith('/9j/');

                    if (isPNG || isJPEG) {
                        console.log('✅ 检测到直接的图片 base64 数据 (PNG/JPEG)');
                        // 将 base64 转为 Blob
                        const binaryString = atob(base64Data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const imageBlob = new Blob([bytes], { type: isPNG ? 'image/png' : 'image/jpeg' });
                        console.log('图片 Blob 创建成功，大小:', imageBlob.size);

                        // 转换为dataURL用于后续处理
                        const reader = new FileReader();
                        imageDataUrl = await new Promise((resolve, reject) => {
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(imageBlob);
                        });
                        console.log('✅ 图片转换成功！🎨');
                    } else {
                        // 否则当作 ZIP 处理
                        console.log('当作 ZIP 文件处理...');
                        const binaryString = atob(base64Data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        zipBlob = new Blob([bytes]);
                        console.log('ZIP Blob 大小:', zipBlob.size);
                    }
                } else {
                    // 非流式响应，直接读取
                    zipBlob = await response.blob();
                    console.log('收到数据，类型:', zipBlob.type, '大小:', zipBlob.size);
                }

                // 如果还没有imageDataUrl（即需要解压ZIP）
                if (!imageDataUrl && zipBlob) {
                    // NovelAI始终返回ZIP格式，需要解压
                    try {

                        // 解压ZIP文件
                        const zip = await openImageArchive(zipBlob);
                        console.log('ZIP文件内容:', Object.keys(zip.files));

                        // 查找第一个图片文件（通常是image_0.png）
                        let imageFile = null;
                        for (let filename in zip.files) {
                            if (filename.match(/\.(png|jpg|jpeg|webp)$/i)) {
                                imageFile = zip.files[filename];
                                console.log('找到图片文件:', filename);
                                break;
                            }
                        }

                        if (!imageFile) {
                            throw new Error('ZIP文件中未找到图片');
                        }

                        // 提取图片数据
                        const imageBlob = await imageFile.async('blob');
                        console.log('提取的图片大小:', imageBlob.size);

                        // 创建图片URL
                        const reader = new FileReader();
                        imageDataUrl = await new Promise((resolve, reject) => {
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(imageBlob);
                        });
                        console.log('✅ 图片解压成功！');
                    } catch (zipError) {
                        console.error('ZIP解压失败:', zipError);
                        throw new Error('图片解压失败: ' + zipError.message);
                    }
                }

                console.log(`✅ NAI图片${i + 1}生成成功！`);
                generatedImageUrls.push(imageDataUrl);
            }

            // 将生成的图片URL保存到动态中
            newPost.imageUrls = generatedImageUrls;

            // 保持向后兼容，单张图片时也设置 imageUrl
            if (generatedImageUrls.length === 1) {
                newPost.imageUrl = generatedImageUrls[0];
            }

            newPost.prompt = msgData.prompt;
            newPost.imageCount = generatedImageUrls.length;
            console.log(`✅ 动态NovelAI图片全部生成完成: ${generatedImageUrls.length}张`);
        } catch (error) {
            console.error('❌ 动态NAI图片生成失败:', error);
            // 失败时仍然发布动态，但添加错误信息
            newPost.content = (newPost.content || newPost.publicText || '') + `\n[图片生成失败: ${error.message}]`;
        }
    }

    await runtime.db.qzonePosts.add(newPost);
    if (actor) await publishChatPost(actor.id, newPost);
    updateUnreadIndicator(runtime.unreadPostsCount + 1);
    if (isViewingThisChat && document.getElementById('qzone-screen').classList.contains('active')) {
        await renderQzonePosts();
    }
}

export async function commentOnPost(chat, msgData) {
    const postToComment = await runtime.db.qzonePosts.get(parseInt(msgData.postId)); // 修复: action -> msgData
    if (postToComment) {
        if (!postToComment.comments) postToComment.comments = [];

        const commenterName = msgData.name || chat.originalName; // 修复: action -> msgData

        const createCommentObject = (text, meaning = null, replyTo = null) => ({
            commenterName,
            text: processMentions(text, chat),
            meaning,
            replyTo,
            timestamp: Date.now()
        });

        if (msgData.stickerMeaning) {
            const sticker = runtime.state.userStickers.find(s => s.name === msgData.stickerMeaning); // 修复: action -> msgData
            if (sticker) {
                postToComment.comments.push(createCommentObject(sticker.url, sticker.name, msgData.replyTo || null)); // 修复: action -> msgData
            } else {
                console.warn(`AI 尝试评论一个不存在的表情: "${msgData.stickerMeaning}"`); // 修复: action -> msgData
                postToComment.comments.push(createCommentObject(`[表情: ${msgData.stickerMeaning}]`, null, msgData.replyTo || null)); // 修复: action -> msgData
            }
        } else if (Array.isArray(msgData.comments)) { // 修复: action -> msgData
            msgData.comments.forEach(commentText => { // 修复: action -> msgData
                if (typeof commentText === 'string' && commentText.trim()) {
                    postToComment.comments.push(createCommentObject(commentText, null, msgData.replyTo || null)); // 修复: action -> msgData
                }
            });
        } else if (typeof msgData.commentText === 'string' && msgData.commentText.trim()) { // 修复: action -> msgData
            postToComment.comments.push(createCommentObject(msgData.commentText, null, msgData.replyTo || null)); // 修复: action -> msgData
        }

        await runtime.db.qzonePosts.update(postToComment.id, { comments: postToComment.comments });
        updateUnreadIndicator(runtime.unreadPostsCount + 1);
        console.log(`后台活动: 角色 "${chat.name}" 评论了动态 #${msgData.postId}`); // 修复: action -> msgData

        if (!chat.commentCooldowns) chat.commentCooldowns = {};
        chat.commentCooldowns[msgData.postId] = Date.now(); // 修复: action -> msgData
    }
}

export async function likePost(chat, msgData, isViewingThisChat) {
    const postToLike = await runtime.db.qzonePosts.get(parseInt(msgData.postId));
    if (postToLike) {
        if (!postToLike.likes) postToLike.likes = [];
        if (!postToLike.likes.includes(chat.name)) {
            postToLike.likes.push(chat.name);
            await runtime.db.qzonePosts.update(postToLike.id, { likes: postToLike.likes });
            updateUnreadIndicator(runtime.unreadPostsCount + 1);
            if (isViewingThisChat && document.getElementById('qzone-screen').classList.contains('active')) {
                await renderQzonePosts();
            }
        }
    }
}

export async function repostFromChat(chat, chatId, msgData) {
    const originalPost = await runtime.db.qzonePosts.get(parseInt(msgData.postId));
    if (originalPost) {
        const newPost = {
            type: 'repost',
            timestamp: Date.now(),
            authorId: chatId,
            authorGroupId: chat.groupId,
            repostComment: msgData.comment || '',
            originalPost: originalPost,
            visibleGroupIds: null
        };
        await runtime.db.qzonePosts.add(newPost);
        updateUnreadIndicator(runtime.unreadPostsCount + 1);
        console.log(`后台活动: 角色 "${chat.name}" 转发了动态 #${msgData.postId}`);
    }
}
