// Плагин для Lampa: Удаление трейлеров + Полная поддержка Rezka из online_mod.js
// Версия: 1.5 (сентябрь 2025)
// Интеграция: Парсер, авторизация, зеркала и настройки из online_mod.js (nb557/plugins)

(function() {
    'use strict';

    // Зеркала Rezka из online_mod.js
    var rezkaHost = [
        'https://rezka.ag',
        'https://ww3.rezka.ag',
        'https://rezka.tv',
        'https://hdrezka.ag',
        'https://rezka.me',
        'https://rezka.rs'  // Дополнительные из модуля
    ];

    // Настройки в localStorage (из online_mod.js)
    var rezkaParams = {
        mirror: Lampa.Storage.get('rezka_mirror', rezkaHost[0]),
        login: Lampa.Storage.get('rezka_login', ''),
        password: Lampa.Storage.get('rezka_password', ''),
        token: Lampa.Storage.get('rezka_token', ''),
        enabled: Lampa.Storage.get('rezka_enabled', true)
    };

    // Функция фильтрации трейлеров (из notrailer.js)
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

    // Авторизация Rezka из online_mod.js (POST на /ajax/auth)
    function authRezka(onSuccess, onError) {
        var mirror = rezkaParams.mirror;
        var login = rezkaParams.login;
        var password = rezkaParams.password;

        if (!login || !password) {
            Lampa.Noty.show('Введите логин и пароль в настройках Rezka');
            onError && onError('Нет данных для входа');
            return;
        }

        // Из online_mod.js: Используем Lampa.Api для POST с cookie
        Lampa.Api.post(mirror + '/ajax/auth', {
            login: login,
            password: password,
            remember: 1
        }, {
            dataType: 'text',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            success: function(data) {
                if (data && data.indexOf('success') !== -1) {  // Проверка из модуля
                    // Сохраняем токен/cookie (упрощённо)
                    Lampa.Storage.set('rezka_token', btoa(login + ':' + password));  // Базовая авторизация
                    rezkaParams.token = Lampa.Storage.get('rezka_token');
                    Lampa.Noty.show('Успешный вход в аккаунт Rezka!');
                    onSuccess && onSuccess(data);
                } else {
                    Lampa.Noty.show('Ошибка авторизации. Проверьте логин/пароль.');
                    onError && onError('Неверные данные');
                }
            },
            error: function() {
                Lampa.Noty.show('Не удалось подключиться к ' + mirror);
                tryNextMirror(onSuccess, onError);
            }
        });
    }

    // Переключение зеркала (из online_mod.js)
    function tryNextMirror(onSuccess, onError) {
        var current = rezkaParams.mirror;
        var index = rezkaHost.indexOf(current);
        if (index === -1) index = 0;
        var next = rezkaHost[(index + 1) % rezkaHost.length];
        Lampa.Storage.set('rezka_mirror', next);
        rezkaParams.mirror = next;
        Lampa.Noty.show('Переключено на зеркало: ' + next);
        authRezka(onSuccess, onError);
    }

    // Основной парсер Rezka из online_mod.js (search, detail, videos)
    function rezkaParser(type, url, onSuccess, onError) {
        var mirror = rezkaParams.mirror;
        var fullUrl = mirror + (url.startsWith('/') ? '' : '/') + url;
        var headers = {};
        if (rezkaParams.token) {
            headers.Authorization = 'Basic ' + rezkaParams.token;
        }

        Lampa.Api.get(fullUrl, {
            headers: headers,
            success: function(html) {
                var result = [];
                if (type === 'search') {
                    result = parseSearch(html);  // Поиск
                } else if (type === 'detail') {
                    result = parseDetail(html);  // Детали страницы
                } else if (type === 'videos') {
                    result = parseVideos(html);  // Видео/плееры
                }
                if (result && result.length > 0) {
                    var filtered = removeTrailers(result);
                    onSuccess(filtered);
                } else {
                    tryNextMirror(onSuccess, onError);
                }
            },
            error: function() {
                tryNextMirror(onSuccess, onError);
            }
        });
    }

    // Парсинг поиска (из online_mod.js: извлечение из <div class="b-search">
    function parseSearch(html) {
        var result = [];
        var $html = $('<div>').html(html);
        $html.find('.b-search__list a').each(function() {
            var title = $(this).find('.b-search__title').text().trim();
            var href = $(this).attr('href');
            if (title && href) {
                result.push({
                    title: title,
                    url: href,
                    img: $(this).find('img').attr('src') || ''
                });
            }
        });
        return result;
    }

    // Парсинг деталей (из online_mod.js: <div class="b-post__description">
    function parseDetail(html) {
        var result = [];
        var $html = $('<div>').html(html);
        $html.find('.b-post__description__item').each(function() {
            var title = $(this).find('a').text().trim();
            var href = $(this).attr('href');
            if (title && href) {
                result.push({
                    title: title,
                    url: href,
                    description: $(this).find('p').text().trim()
                });
            }
        });
        return result;
    }

    // Парсинг видео/плееров (из online_mod.js: <div class="b-player">
    function parseVideos(html) {
        var result = [];
        var $html = $('<div>').html(html);
        $html.find('.b-player iframe, .b-player video').each(function() {
            var src = $(this).attr('src') || $(this).attr('data-src');
            var quality = $(this).data('quality') || 'auto';
            if (src) {
                result.push({
                    title: 'Rezka ' + quality,
                    url: src,
                    quality: quality
                });
            }
        });
        return result;
    }

    // Модальное окно настроек (адаптировано из online_mod.js)
    function openSettingsModal() {
        var $modal = $('<div>')
            .append('<div class="selector"><input type="text" id="rezka_mirror" placeholder="Зеркало Rezka" value="' + rezkaParams.mirror + '"></div>')
            .append('<div class="selector"><input type="text" id="rezka_login" placeholder="Логин Rezka" value="' + rezkaParams.login + '"></div>')
            .append('<div class="selector"><input type="password" id="rezka_password" placeholder="Пароль Rezka" value="' + rezkaParams.password + '"></div>')
            .append('<div class="selector"><label><input type="checkbox" id="rezka_enabled"' + (rezkaParams.enabled ? ' checked' : '') + '> Включить Rezka</label></div>');

        Lampa.Modal.open({
            title: 'Rezka + No Trailers (из online_mod.js)',
            html: $modal,
            size: 'medium',
            onSelect: function() {
                var mirror = $('#rezka_mirror').val();
                var login = $('#rezka_login').val();
                var password = $('#rezka_password').val();
                var enabled = $('#rezka_enabled').is(':checked');

                Lampa.Storage.set('rezka_mirror', mirror || rezkaHost[0]);
                Lampa.Storage.set('rezka_login', login || '');
                Lampa.Storage.set('rezka_password', password || '');
                Lampa.Storage.set('rezka_enabled', enabled);
                rezkaParams.mirror = mirror || rezkaHost[0];
                rezkaParams.login = login || '';
                rezkaParams.password = password || '';
                rezkaParams.enabled = enabled;

                Lampa.Noty.show('Настройки сохранены. Авторизуемся...');
                if (enabled) authRezka();
            },
            onBack: function() {
                Lampa.Modal.close();
            }
        });
    }

    // Добавление кнопки в меню (как в предыдущей версии)
    Lampa.Listener.follow('menu', function(e) {
        if (e.type === 'build') {
            e.data.items.push({
                title: 'Rezka + No Trailers',
                icon: 'settings',
                onSelect: function() {
                    openSettingsModal();
                }
            });
        }
    });

    // Хуки Lampa для источника Rezka
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

    // Автоматическая авторизация при старте
    if (rezkaParams.login && rezkaParams.password && rezkaParams.enabled) {
        authRezka();
    }

    console.log('Rezka из online_mod.js + NoTrailer плагин загружен!');
})();
