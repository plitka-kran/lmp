// Плагин для Lampa: Удаление трейлеров + Вход в аккаунт Rezka с выбором зеркала
// Версия: 1.4 (сентябрь 2025)
// Исправлено: Настройки через модальное окно вместо settings

(function() {
    'use strict';

    // Конфиг зеркал Rezka
    var defaultMirrors = [
        'https://rezka.ag',
        'https://ww3.rezka.ag',
        'https://rezka.tv',
        'https://hdrezka.ag',
        'https://rezka.me'
    ];

    // Настройки в localStorage
    var storage = {
        mirror: Lampa.Storage.get('rezka_mirror', defaultMirrors[0]),
        login: Lampa.Storage.get('rezka_login', ''),
        password: Lampa.Storage.get('rezka_password', ''),
        token: Lampa.Storage.get('rezka_token', '')
    };

    // Функция фильтрации трейлеров
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

    // Авторизация в Rezka
    function loginRezka(onSuccess, onError) {
        var mirror = Lampa.Storage.get('rezka_mirror', defaultMirrors[0]);
        var login = Lampa.Storage.get('rezka_login', '');
        var password = Lampa.Storage.get('rezka_password', '');

        if (!login || !password) {
            Lampa.Noty.show('Введите логин и пароль в настройках плагина');
            onError && onError('Нет данных для входа');
            return;
        }

        var authUrl = mirror + '/ajax/login/';
        Lampa.Api.post(authUrl, {
            login: login,
            password: password
        }, {
            success: function(data) {
                if (data.success && data.token) {
                    Lampa.Storage.set('rezka_token', data.token);
                    storage.token = data.token;
                    Lampa.Noty.show('Успешный вход в аккаунт Rezka!');
                    onSuccess && onSuccess(data);
                } else {
                    Lampa.Noty.show('Ошибка авторизации. Проверьте логин/пароль.');
                    onError && onError('Неверные данные');
                }
            },
            error: function() {
                Lampa.Noty.show('Не удалось подключиться к ' + mirror);
                tryNextMirror();
            }
        });
    }

    // Пробуем следующее зеркало
    function tryNextMirror() {
        var currentMirror = Lampa.Storage.get('rezka_mirror', defaultMirrors[0]);
        var index = defaultMirrors.indexOf(currentMirror);
        var nextMirror = defaultMirrors[(index + 1) % defaultMirrors.length];
        Lampa.Storage.set('rezka_mirror', nextMirror);
        storage.mirror = nextMirror;
        Lampa.Noty.show('Переключено на зеркало: ' + nextMirror);
        loginRezka();
    }

    // Парсер для Rezka (заглушка, замени на код из online_mod.js, если есть)
    function rezkaParser(url, onSuccess, onError) {
        var mirror = Lampa.Storage.get('rezka_mirror', defaultMirrors[0]);
        var fullUrl = mirror + (url.startsWith('/') ? '' : '/') + url;
        var headers = storage.token ? { 'Authorization': 'Bearer ' + storage.token } : {};

        Lampa.Api.get(fullUrl, {
            headers: headers,
            success: function(data) {
                var parsed = parseRezkaData(data);
                if (parsed && parsed.length > 0) {
                    var filtered = removeTrailers(parsed);
                    onSuccess(filtered);
                } else {
                    tryNextMirror();
                }
            },
            error: function() {
                tryNextMirror();
            }
        });
    }

    // Парсер данных Rezka (заглушка)
    function parseRezkaData(data) {
        // Замени на реальный парсер из online_mod.js, если доступен
        return [];
    }

    // Добавление кнопки в главное меню для открытия настроек
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

    // Модальное окно для настроек
    function openSettingsModal() {
        var $modal = $('<div>')
            .append('<div class="selector"><input type="text" id="rezka_mirror" placeholder="Зеркало Rezka (например, https://rezka.ag)" value="' + storage.mirror + '"></div>')
            .append('<div class="selector"><input type="text" id="rezka_login" placeholder="Логин Rezka" value="' + storage.login + '"></div>')
            .append('<div class="selector"><input type="password" id="rezka_password" placeholder="Пароль Rezka" value="' + storage.password + '"></div>');

        Lampa.Modal.open({
            title: 'Rezka + No Trailers',
            html: $modal,
            size: 'medium',
            onSelect: function() {
                var mirror = $('#rezka_mirror').val();
                var login = $('#rezka_login').val();
                var password = $('#rezka_password').val();

                Lampa.Storage.set('rezka_mirror', mirror || defaultMirrors[0]);
                Lampa.Storage.set('rezka_login', login || '');
                Lampa.Storage.set('rezka_password', password || '');
                storage.mirror = mirror || defaultMirrors[0];
                storage.login = login || '';
                storage.password = password || '';

                Lampa.Noty.show('Настройки сохранены. Проверяем авторизацию...');
                loginRezka();
            },
            onBack: function() {
                Lampa.Modal.close();
            }
        });
    }

    // Хуки Lampa
    Lampa.Listener.follow('app', function(e) {
        if (e.type === 'playlist:append') {
            e.data.items = removeTrailers(e.data.items);
        }
    });

    Lampa.Listener.follow('source', function(e) {
        if (e.name === 'rezka') {
            e.parser = rezkaParser;
            e.mirrors = defaultMirrors;
        }
    });

    // Автоматическая авторизация при старте
    if (storage.login && storage.password) {
        loginRezka();
    }

    console.log('Rezka Auth + NoTrailer плагин загружен!');
})();
