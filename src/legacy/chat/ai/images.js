import { preferences } from '../../storage/preferences.js'
import { getCharacterNAIPrompts, getNovelAISettings } from '../../novelai/images.js'
import { openImageArchive } from '../../../runtime/dependencies'

export async function createNovelAiMessage(chat, msgData, baseMessage) {
    // NovelAI图片分享 - 调用NovelAI API生成高质量图片
    try {
        console.log('📸 NovelAI图片生成开始，AI提供的prompt:', msgData.prompt);

        // 获取角色的NAI提示词配置（系统或角色专属）
        const naiPrompts = getCharacterNAIPrompts(chat.id);

        // 构建最终的提示词：AI的prompt + 配置的提示词
        const aiPrompt = msgData.prompt || 'a beautiful scene';
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

        console.log('✅ NAI图片生成成功！');

        // 创建naiimag消息
        return {
            ...baseMessage,
            type: 'naiimag',
            imageUrl: imageDataUrl,
            prompt: aiPrompt,
            fullPrompt: finalPositivePrompt // 保存完整提示词供查看
        };
    } catch (error) {
        console.error('❌ NAI图片生成失败:', error);
        // 失败时降级为文本消息
        return {
            ...baseMessage,
            content: `[图片生成失败: ${error.message}]`
        };
    }
}
