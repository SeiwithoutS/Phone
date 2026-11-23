export function uploadImageLocally() {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.oncancel = () => resolve(null);
        input.accept = 'image/*'; // 只接受图片文件

        input.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onerror = () => resolve(null);
                reader.onload = readerEvent => {
                    resolve(readerEvent.target.result); // 返回Base64字符串
                };
                reader.readAsDataURL(file);
            } else {
                resolve(null); // 用户关闭了文件选择框
            }
        };

        input.click();
    });
}
