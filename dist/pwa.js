const installButton = document.getElementById('install');
let installPrompt;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = undefined;
  installButton.hidden = true;
  try {
    await prompt.prompt();
  } catch {
    // Installation is also available from the browser menu.
  }
});

window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  installButton.hidden = true;
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('オフライン用ファイルを登録できませんでした。', error);
  });
}
