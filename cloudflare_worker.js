// Прокси для Lampa (адаптация из cloudflare_worker.js)
(function() {
    'use strict';
    var proxyUrl = 'https://your-cloudflare-worker.workers.dev/?url='; // Замени на свой worker
    Lampa.Storage.set('proxy_rezka', proxyUrl);
})();
