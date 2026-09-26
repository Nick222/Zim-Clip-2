

const activate = (id, state) => {
    const element = document.getElementById(id);
    element.parentNode.setAttribute('aria-disabled', !state);
};

async function init() {
    document.body.querySelectorAll('.action').forEach((el) => {
        el.title = chrome.i18n.getMessage(el.title) || el.title;
    });
    const state = await chrome.runtime.sendMessage({action: 'state'});
    activate('markToZim', state.markable);
    activate('clipToZim', state.markable && state.hasSelection);

    document.getElementById('actions').addEventListener('click', async (e) => {
        const target = e.target.closest('.zim-action');
        if (!target || target.parentNode.getAttribute('aria-disabled') === 'true') return;
        chrome.runtime.sendMessage({action: target.id});
        window.close();
    });
    document.getElementById('showOptions').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });
}

init().catch(console.error);
