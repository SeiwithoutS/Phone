import { createIconButton } from '../../components/icons'
import { launcherLabels, cphoneLabels } from '../../features/appearance/launcher-labels'
import { fileDataUrl, imageSource } from '../../runtime/files'
import { runtime } from '../runtime/state.js'

const launchers = {
    ephone: { names: 'appNames', images: 'appIcons', defaults: 'DEFAULT_APP_ICONS', labels: launcherLabels, prefix: 'icon-img-', label: '.home-app-label' },
    cphone: { names: 'cphoneAppNames', images: 'cphoneAppIcons', defaults: 'DEFAULT_CPHONE_ICONS', labels: cphoneLabels, prefix: 'cphone-icon-img-', label: '.label' },
};

function launcherImage(settings, launcher, id) {
    return imageSource(String(settings[launcher.images]?.[id] ?? runtime[launcher.defaults]?.[id] ?? ''));
}

export function applyLauncherAppearance(phone) {
    const launcher = launchers[phone];
    const settings = runtime.state.globalSettings;
    if (!settings) return;
    for (const [id, defaultName] of Object.entries(launcher.labels)) {
        const img = document.getElementById(launcher.prefix + id);
        if (!img) continue;
        const tile = img.closest('button');
        const label = tile?.querySelector(launcher.label);
        const name = settings[launcher.names]?.[id] || defaultName;
        if (label) label.textContent = name;
        if (tile) tile.setAttribute('aria-label', name);
        const fallback = tile?.querySelector('[data-app-initial]');
        if (fallback) fallback.textContent = name.charAt(0);
        const url = launcherImage(settings, launcher, id);
        img.hidden = !url;
        img.onerror = () => { img.hidden = true; };
        if (url) {
            if (img.getAttribute('src') !== url) img.src = url;
        } else img.removeAttribute('src');
    }
}

export function applyAppIcons() {
    applyLauncherAppearance('ephone');
}

export function renderLauncherSettings(phone) {
    const grid = document.getElementById(phone === 'ephone' ? 'icon-settings-grid' : 'cphone-icon-settings-grid');
    const launcher = launchers[phone];
    const settings = runtime.state.globalSettings;
    settings[launcher.names] ??= {};
    settings[launcher.images] ??= {};
    grid.replaceChildren();
    for (const [id, defaultName] of Object.entries(launcher.labels)) {
        const row = document.createElement('div');
        row.className = 'icon-setting-item launcher-setting-row';
        row.dataset.iconId = id;
        const preview = createIconButton('plus', 'Upload image for ' + defaultName);
        preview.classList.add('launcher-preview');
        const thumbnail = document.createElement('img');
        thumbnail.className = 'icon-preview';
        thumbnail.alt = '';
        thumbnail.onerror = () => { thumbnail.hidden = true; };
        const initial = document.createElement('span');
        initial.setAttribute('aria-hidden', 'true');
        preview.prepend(initial, thumbnail);

        const fields = document.createElement('div');
        fields.className = 'launcher-setting-fields';
        const name = document.createElement('input');
        name.type = 'text';
        name.maxLength = 36;
        name.placeholder = defaultName;
        name.setAttribute('aria-label', defaultName + ' display name');
        const url = document.createElement('input');
        url.type = 'url';
        url.placeholder = 'Image URL (optional)';
        url.setAttribute('aria-label', defaultName + ' image URL');
        const file = document.createElement('input');
        file.type = 'file';
        file.accept = 'image/*';
        file.hidden = true;
        const error = document.createElement('small');
        error.className = 'phone-app-error';
        error.setAttribute('role', 'alert');
        fields.append(name, url, file, error);

        function refresh(fillUrl = true) {
            name.value = settings[launcher.names][id] || defaultName;
            const source = launcherImage(settings, launcher, id);
            if (fillUrl) url.value = source.startsWith('http') ? source : '';
            thumbnail.hidden = !source;
            if (source) thumbnail.src = source;
            else thumbnail.removeAttribute('src');
            initial.textContent = name.value.charAt(0);
        }
        name.oninput = () => {
            const value = name.value.trim();
            if (!value || value === defaultName) delete settings[launcher.names][id];
            else settings[launcher.names][id] = value;
            initial.textContent = (value || defaultName).charAt(0);
        };
        url.onchange = () => {
            const source = imageSource(url.value);
            error.textContent = url.value.trim() && !source ? 'Enter a valid HTTP(S) image URL.' : '';
            url.setAttribute('aria-invalid', String(Boolean(error.textContent)));
            if (error.textContent) return;
            settings[launcher.images][id] = source;
            refresh();
        };
        preview.onclick = () => file.click();
        file.onchange = async () => {
            const image = file.files?.[0];
            file.value = '';
            if (!image) return;
            row.dataset.readingImage = 'true';
            try {
                const source = image.size <= 4 * 1024 * 1024 && imageSource(await fileDataUrl(image));
                if (!source) throw new Error('Choose a supported image up to 4 MB.');
                settings[launcher.images][id] = source;
                error.textContent = '';
                url.removeAttribute('aria-invalid');
                refresh();
            } catch (failure) {
                error.textContent = failure.message || 'The image could not be read.';
            } finally {
                delete row.dataset.readingImage;
            }
        };
        const reset = createIconButton('reset', 'Restore default name and image for ' + defaultName);
        const clear = createIconButton('trash', 'Remove image for ' + defaultName);
        const resetRow = clearImage => {
            if (clearImage) settings[launcher.images][id] = '';
            else {
                delete settings[launcher.images][id];
                delete settings[launcher.names][id];
            }
            error.textContent = '';
            url.removeAttribute('aria-invalid');
            refresh();
        };
        reset.onclick = () => resetRow(false);
        clear.onclick = () => resetRow(true);
        const actions = document.createElement('div');
        actions.className = 'launcher-setting-actions';
        actions.append(reset, clear);
        row.append(preview, fields, actions);
        grid.append(row);
        refresh();
    }
}
