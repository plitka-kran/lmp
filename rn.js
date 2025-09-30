// Плагин для Lampa: Полная Rezka (из online_mod.js) + Удаление трейлеров + Дополнения
// Версия: 2.0 (сентябрь 2025)

(function() {
    'use strict';

    var rezkaHost = [
        'https://rezka.ag',
        'https://ww3.rezka.ag',
        'https://rezka.tv',
        'https://hdrezka.ag',
        'https://rezka.me',
        'https://rezka.rs',
        'https://kvk.zone'
    ];

    var rezkaParams = {
        mirror: Lampa.Storage.get('rezka_mirror', rezkaHost[0]),
        login: Lampa.Storage.get('rezka_login', ''),
        password: Lampa.Storage.get('rezka_password', ''),
        token: Lampa.Storage.get('rezka_token', ''),
        enabled: Lampa.Storage.get('rezka_enabled', true),
        proxy: Lampa.Storage.get('rezka_proxy', false),
        cookie: Lampa.Storage.get('rezka_cookie', '')
    };

    function rezkaMirror() {
        var url = Lampa.Storage.get('rezka_mirror', '') + '';
        if (!url) return rezkaHost[0];
        if (url.indexOf('://') == -1) url = 'https://' + url;
        if (url.charAt(url.length - 1) === '/') url = url.substring(0, url.length - 1);
        return url;
    }

    function getProxy(name) {
        if (rezkaParams.proxy && name === 'rezka') {
            return 'https://your-cloudflare-worker.workers.dev/?url='; // Замени на свой worker, если есть
        }
        return '';
    }

    var userAgent = Lampa.Storage.field('not_mobile') ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' : Utils.baseUserAgent();

    function removeTrailers(items) {
        if (!items || !Array.isArray(items)) return items;
        return items.filter(function(item) {
            var title = (item.title || '').toLowerCase();
            var url = (item.url || '').toLowerCase();
            return !(
                title.includes('trailer') ||
                title.includes('трейлер') ||
                url.includes('trailer') ||
                url.includes('/trailer/') ||
                title.includes('clip') ||
                title.includes('клип')
            );
        });
    }

    function authRezka(onSuccess, onError) {
        var mirror = rezkaMirror();
        var login = rezkaParams.login;
        var password = rezkaParams.password;

        if (!login || !password) {
            Lampa.Noty.show('Введите логин и пароль в настройках Rezka');
            onError && onError('Нет данных');
            return;
        }

        var cookie = rezkaParams.cookie || 'PHPSESSID=' + Math.random().toString(36).substring(7);
        Lampa.Storage.set('rezka_cookie', cookie);

        var headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': mirror,
            'Referer': mirror + '/',
            'User-Agent': userAgent,
            'Cookie': cookie
        };

        Lampa.Api.post(mirror + '/ajax/auth', 'login=' + encodeURIComponent(login) + '&password=' + encodeURIComponent(password) + '&remember=1', {
            headers: headers,
            dataType: 'text',
            success: function(data) {
                if (data && data.indexOf('success') !== -1) {
                    Lampa.Storage.set('rezka_token', btoa(login + ':' + password));
                    rezkaParams.token = Lampa.Storage.get('rezka_token');
                    Lampa.Noty.show('Вход в Rezka успешен!');
                    onSuccess && onSuccess(data);
                } else {
                    Lampa.Noty.show('Ошибка авторизации');
                    onError && onError('Неверные данные');
                }
            },
            error: function() {
                Lampa.Noty.show('Ошибка соединения с ' + mirror);
                tryNextMirror(onSuccess, onError);
            }
        });
    }

    function tryNextMirror(onSuccess, onError) {
        var current = rezkaParams.mirror;
        var index = rezkaHost.indexOf(current);
        var next = rezkaHost[(index + 1) % rezkaHost.length];
        Lampa.Storage.set('rezka_mirror', next);
        rezkaParams.mirror = next;
        Lampa.Noty.show('Зеркало: ' + next);
        authRezka(onSuccess, onError);
    }

    function rezkaParser(type, url, onSuccess, onError) {
        if (!rezkaParams.enabled) return onError('Rezka отключена');
        var mirror = getProxy('rezka') || rezkaMirror();
        var fullUrl = mirror + (url.startsWith('/') ? '' : '/') + url;
        var headers = {
            'Origin': mirror,
            'Referer': mirror + '/',
            'User-Agent': userAgent,
            'Cookie': rezkaParams.cookie
        };
        if (rezkaParams.token) headers.Authorization = 'Basic ' + rezkaParams.token;

        var prox = getProxy('rezka');
        if (prox) fullUrl = prox + encodeURIComponent(fullUrl);

        Lampa.Api.get(fullUrl, { headers: headers }, {
            success: function(html) {
                var result = [];
                var $html = $('<div>').html(html);
                if (type === 'search') {
                    $html.find('.b-search__list a').each(function() {
                        var title = $(this).find('.b-search__title').text().trim();
                        var href = $(this).attr('href');
                        var img = $(this).find('img').attr('src') || '';
                        if (title && href) result.push({ title, url: href, img });
                    });
                } else if (type === 'detail') {
                    $html.find('.b-post__description__item a').each(function() {
                        var title = $(this).text().trim();
                        var href = $(this).attr('href');
                        var desc = $(this).closest('.b-post__description__item').find('p').text().trim();
                        if (title && href) result.push({ title, url: href, description: desc });
                    });
                } else if (type === 'videos') {
                    $html.find('.b-player iframe, .b-player video').each(function() {
                        var src = $(this).attr('src') || $(this).attr('data-src');
                        var quality = $(this).data('quality') || 'auto';
                        if (src) result.push({ title: 'Rezka ' + quality, url: src, quality });
                    });
                }
                if (result.length > 0) {
                    var filtered = removeTrailers(result);
                    onSuccess(filtered);
                } else {
                    if (html.match(/<form[^>]*login/i)) {
                        Lampa.Noty.show('Требуется авторизация');
                        authRezka(function() { rezkaParser(type, url, onSuccess, onError); });
                    } else {
                        tryNextMirror(onSuccess, onError);
                    }
                }
            },
            error: function() {
                tryNextMirror(onSuccess, onError);
            }
        });
    }

    function openSettingsModal() {
        var $modal = $('<div>')
            .append('<div class="selector"><input type="text" id="rezka_mirror" placeholder="Зеркало[](https://rezka.ag)" value="' + rezkaParams.mirror + '"></div>')
            .append('<div class="selector"><input type="text" id="rezka_login" placeholder="Логин" value="' + rezkaParams.login + '"></div>')
            .append('<div class="selector"><input type="password" id="rezka_password" placeholder="Пароль" value="' + rezkaParams.password + '"></div>')
            .append('<div class="selector"><label><input type="checkbox" id="rezka_enabled"' + (rezkaParams.enabled ? ' checked' : '') + '> Включить Rezka</label></div>')
            .append('<div class="selector"><label><input type="checkbox" id="rezka_proxy"' + (rezkaParams.proxy ? ' checked' : '') + '> Прокси (Cloudflare)</label></div>');

        Lampa.Modal.open({
            title: 'Rezka Full + No Trailers',
            html: $modal,
            size: 'medium',
            onSelect: function() {
                var mirror = $('#rezka_mirror').val();
                var login = $('#rezka_login').val();
                var password = $('#rezka_password').val();
                var enabled = $('#rezka_enabled').is(':checked');
                var proxy = $('#rezka_proxy').is(':checked');

                Lampa.Storage.set('rezka_mirror', mirror || rezkaHost[0]);
                Lampa.Storage.set('rezka_login', login || '');
                Lampa.Storage.set('rezka_password', password || '');
                Lampa.Storage.set('rezka_enabled', enabled);
                Lampa.Storage.set('rezka_proxy', proxy);
                rezkaParams.mirror = mirror || rezkaHost[0];
                rezkaParams.login = login || '';
                rezkaParams.password = password || '';
                rezkaParams.enabled = enabled;
                rezkaParams.proxy = proxy;

                Lampa.Noty.show('Сохранено. Авторизуемся...');
                if (enabled) authRezka();
            },
            onBack: function() { Lampa.Modal.close(); }
        });
    }

    Lampa.Listener.follow('menu', function(e) {
        if (e.type === 'build') {
            e.data.items.push({
                title: 'Rezka Full + No Trailers',
                icon: 'settings',
                onSelect: openSettingsModal
            });
        }
    });

    Lampa.Listener.follow('source', function(e) {
        if (e.name === 'rezka' && rezkaParams.enabled) {
            e.parser = rezkaParser;
            e.mirrors = rezkaHost;
        }
    });

    Lampa.Listener.follow('app', function(e) {
        if (e.type === 'playlist:append') {
            e.data.items = removeTrailers(e.data.items);
        }
    });

    if (rezkaParams.login && rezkaParams.password && rezkaParams.enabled) {
        authRezka();
    }

    console.log('Rezka Full + NoTrailer плагин загружен!');
})();
