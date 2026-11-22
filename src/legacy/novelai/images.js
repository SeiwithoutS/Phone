import { preferences } from '../storage/preferences.js'
import { openImageArchive } from '../../runtime/dependencies'
import { runtime } from '../runtime/state.js'

export function loadNovelAISettings() {
    const settings = getNovelAISettings();
    document.getElementById('nai-resolution').value = settings.resolution;
    document.getElementById('nai-steps').value = settings.steps;
    document.getElementById('nai-cfg-scale').value = settings.cfg_scale;
    document.getElementById('nai-sampler').value = settings.sampler;
    document.getElementById('nai-seed').value = settings.seed;
    document.getElementById('nai-uc-preset').value = settings.uc_preset;
    document.getElementById('nai-quality-toggle').checked = settings.quality_toggle;
    document.getElementById('nai-smea').checked = settings.smea;
    document.getElementById('nai-smea-dyn').checked = settings.smea_dyn;
    document.getElementById('nai-default-positive').value = settings.default_positive;
    document.getElementById('nai-default-negative').value = settings.default_negative;
    document.getElementById('nai-cors-proxy').value = settings.cors_proxy;
    document.getElementById('nai-custom-proxy-url').value = settings.custom_proxy_url || '';
    
    // 显示/隐藏自定义代理输入框
    const customProxyGroup = document.getElementById('nai-custom-proxy-group');
    customProxyGroup.style.display = settings.cors_proxy === 'custom' ? 'block' : 'none';
}

export function saveNovelAISettings() {
    // 保存API Key和模型等基础配置
    const novelaiEnabled = document.getElementById('novelai-switch').checked;
    const novelaiModel = document.getElementById('novelai-model').value;
    const novelaiApiKey = document.getElementById('novelai-api-key').value.trim();
    
    preferences.setItem('novelai-enabled', novelaiEnabled);
    preferences.setItem('novelai-model', novelaiModel);
    preferences.setItem('novelai-api-key', novelaiApiKey);
    
    // 保存高级参数配置
    const settings = {
        resolution: document.getElementById('nai-resolution').value,
        steps: parseInt(document.getElementById('nai-steps').value),
        cfg_scale: parseFloat(document.getElementById('nai-cfg-scale').value),
        sampler: document.getElementById('nai-sampler').value,
        seed: parseInt(document.getElementById('nai-seed').value),
        uc_preset: parseInt(document.getElementById('nai-uc-preset').value),
        quality_toggle: document.getElementById('nai-quality-toggle').checked,
        smea: document.getElementById('nai-smea').checked,
        smea_dyn: document.getElementById('nai-smea-dyn').checked,
        default_positive: document.getElementById('nai-default-positive').value,
        default_negative: document.getElementById('nai-default-negative').value,
        cors_proxy: document.getElementById('nai-cors-proxy').value,
        custom_proxy_url: document.getElementById('nai-custom-proxy-url').value
    };
    
    preferences.setItem('novelai-settings', JSON.stringify(settings));
}

export function resetNovelAISettings() {
    preferences.removeItem('novelai-settings');
    loadNovelAISettings();
    alert("Default settings restored.");
}

export function getNovelAISettings() {
    const defaultSettings = {
        resolution: '1024x1024',
        steps: 28,
        cfg_scale: 5,
        sampler: 'k_euler_ancestral',
        seed: -1,
        uc_preset: 1,
        quality_toggle: true,
        smea: true,
        smea_dyn: false,
        default_positive: 'masterpiece, best quality, 1girl, beautiful, detailed face, detailed eyes, long hair, anime style',
        default_negative: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
        cors_proxy: 'https://corsproxy.io/?',
        custom_proxy_url: ''
    };
    
    const saved = preferences.getItem('novelai-settings');
    if (saved) {
        try {
            return {...defaultSettings, ...JSON.parse(saved)};
        } catch (e) {
            return defaultSettings;
        }
    }
    return defaultSettings;
}

export function getCharacterNAIPrompts(chatId) {
    // 获取系统默认配置
    const systemSettings = getNovelAISettings();
    
    // 如果没有指定角色ID或角色不存在，返回系统配置
    if (!chatId || !runtime.state.chats[chatId]) {
        console.log('⚠️ NAI提示词：没有角色，使用系统配置');
        return {
            positive: systemSettings.default_positive,
            negative: systemSettings.default_negative,
            source: 'system'
        };
    }
    
    const chat = runtime.state.chats[chatId];
    const naiSettings = chat.settings.naiSettings || {};
    
    // 选角色就用角色的，选系统就用系统的，就这么简单！
    if (naiSettings.promptSource === 'character') {
        console.log('✅ NAI提示词：使用角色配置');
        console.log('   正面:', naiSettings.characterPositivePrompt || '(空)');
        console.log('   负面:', naiSettings.characterNegativePrompt || '(空)');
        
        return {
            positive: naiSettings.characterPositivePrompt || '',
            negative: naiSettings.characterNegativePrompt || '',
            source: 'character'
        };
    } else {
        console.log('✅ NAI提示词：使用系统配置');
        console.log('   正面:', systemSettings.default_positive || '(空)');
        console.log('   负面:', systemSettings.default_negative || '(空)');
        
        return {
            positive: systemSettings.default_positive,
            negative: systemSettings.default_negative,
            source: 'system'
        };
    }
}

export async function generateNovelAIImage() {
    const apiKey = document.getElementById('novelai-api-key').value.trim();
    const model = document.getElementById('novelai-model').value;
    const prompt = document.getElementById('nai-test-prompt').value.trim();
    
    if (!apiKey) {
        alert("Configure your NovelAI API key.");
        return;
    }
    
    if (!prompt) {
        alert("Enter a prompt.");
        return;
    }
    
    const settings = getNovelAISettings();
    const negativePrompt = document.getElementById('nai-test-negative').value.trim();
    
    const statusDiv = document.getElementById('nai-test-status');
    const resultDiv = document.getElementById('nai-test-result');
    const errorDiv = document.getElementById('nai-test-error');
    const generateBtn = document.getElementById('nai-generate-btn');
    
    statusDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";
    
    try {
        const [width, height] = settings.resolution.split('x').map(Number);
        
        // ★★★ V4/V4.5 和 V3 使用不同的请求体格式 ★★★
        let requestBody;
        
        if (model.includes('nai-diffusion-4')) {
            // V4/V4.5 使用新格式 (params_version: 3)
            requestBody = {
                input: prompt,
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
                            base_caption: prompt,
                            char_captions: []
                        },
                        use_coords: false,
                        use_order: true
                    },
                    // V4专用负面提示词格式
                    v4_negative_prompt: {
                        caption: {
                            base_caption: negativePrompt,
                            char_captions: []
                        },
                        legacy_uc: false
                    },
                    negative_prompt: negativePrompt,
                    deliberate_euler_ancestral_bug: false,
                    prefer_brownian: true
                    // 注意：不包含 stream 参数，使用标准ZIP响应而非msgpack流
                }
            };
        } else {
            // V3 及更早版本使用旧格式
            requestBody = {
                input: prompt,
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
                    negative_prompt: negativePrompt
                }
            };
        }
        
        console.log('📤 发送请求到 NovelAI API');
        console.log('📊 使用模型:', model);
        console.log('📋 请求体:', JSON.stringify(requestBody, null, 2));
        
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
        
        // ★★★ Chrome浏览器专用处理：避免headers中包含非ISO-8859-1字符 ★★★
        const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
        let fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify(requestBody)
        };
        
        // 针对Chrome浏览器：确保所有header值都是纯ASCII
        if (isChrome) {
            console.log('🔧 检测到Chrome浏览器，启用headers兼容性处理');
            const cleanHeaders = {};
            for (const [key, value] of Object.entries(fetchOptions.headers)) {
                // 确保header值只包含ASCII字符（ISO-8859-1兼容）
                cleanHeaders[key] = value.replace(/[^\x00-\xFF]/g, '');
            }
            fetchOptions.headers = cleanHeaders;
        }
        
        const response = await fetch(apiUrl, fetchOptions);
        
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
        if (contentType && contentType.includes('text/event-stream')) {
            console.log('检测到 SSE 流式响应，开始解析...');
            statusDiv.textContent = "Receiving image data…";
            
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
                
                // 直接显示图片
                const imageUrl = URL.createObjectURL(imageBlob);
                document.getElementById('nai-result-image').src = imageUrl;
                statusDiv.style.display = 'none';
                resultDiv.style.display = 'block';
                console.log('✅ 图片显示成功！🎨');
                return;
            }
            
            // 否则当作 ZIP 处理
            console.log('当作 ZIP 文件处理...');
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            zipBlob = new Blob([bytes]);
            console.log('ZIP Blob 大小:', zipBlob.size);
            
        } else {
            // 非流式响应，直接读取
            zipBlob = await response.blob();
            console.log('收到数据，类型:', zipBlob.type, '大小:', zipBlob.size);
        }
        
        // NovelAI始终返回ZIP格式，需要解压
        try {
            
            statusDiv.textContent = "Extracting images…";
            
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
            
            // 创建图片URL并显示
            const imageUrl = URL.createObjectURL(imageBlob);
            console.log('生成的图片URL:', imageUrl);
            
            document.getElementById('nai-result-image').src = imageUrl;
            statusDiv.style.display = 'none';
            resultDiv.style.display = 'block';
            
        } catch (zipError) {
            console.error('ZIP解压失败:', zipError);
            // 如果解压失败，尝试直接作为图片显示
            console.log('尝试直接作为图片显示...');
            
            if (zipBlob.type.startsWith('image/')) {
                const imageUrl = URL.createObjectURL(zipBlob);
                document.getElementById('nai-result-image').src = imageUrl;
                statusDiv.style.display = 'none';
                resultDiv.style.display = 'block';
            } else {
                throw new Error('图片格式处理失败: ' + zipError.message);
            }
        }
        
    } catch (error) {
        console.error('NovelAI生成失败:', error);
        statusDiv.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'Generation failed: ' + error.message;
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate Image";
    }
}
