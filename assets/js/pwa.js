if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('../sw.js?v=645');
      await registration.update();
    } catch (_) {}
  });
}
