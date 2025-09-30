// Плагин для Lampa: Удаление трейлеров + Вход в аккаунт Rezka с выбором зеркала
// Версия: 1.1 (сентябрь 2025)

(function() {
    'use strict';

    // Конфиг зеркал Rezka по умолчанию
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
        token: Lampa.Storage.get('rezka_token', '') // Для API
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

        // Запрос авторизации (упрощённый, адаптируй под API Rezka)
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
                    onSuccess(data);
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

    // Пробуем следующее зеркало при ошибке
    function tryNextMirror() {
        var currentMirror = Lampa.Storage.get('rezka_mirror', defaultMirrors[0]);
        var index = defaultMirrors.indexOf(currentMirror);
        var nextMirror = defaultMirrors[(index + 1) % defaultMirrors.length];
        Lampa.Storage.set('rezka_mirror', nextMirror);
        storage.mirror = nextMirror;
        Lampa.Noty.show('Переключено на зеркало: ' + nextMirror);
        loginRezka(); // Повторяем попытку
    }

    // Парсер для Rezka
    function rezkaParser(url, onSuccess, onError) {
        var mirror = Lampa.Storage.get('rezka_mirror', defaultMirrors[0]);
        var fullUrl = mirror + (url.startsWith('/') ? '' : '/') + url;

        // Если есть токен, добавляем в заголовки
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

    // Заглушка для парсинга (адаптируй под HTML/JSON Rezka)
    function parseRezkaData(data) {
        // Парсинг DOM или JSON, возвращает массив {title: '', url: '', ...}
        return []; // Замени на реальный парсер
    }

    // Добавляем настройки в интерфейс Lampa
    Lampa.Settings.add('rezka_plugin', {
        title: 'Rezka + No Trailers',
        subtitle: 'Настройки плагина для Rezka',
        fields: [
            {
                type: 'input',
                name: 'rezka_mirror',
                title: 'Зеркало Rezka',
                value: storage.mirror,
                placeholder: 'Введите URL, например, https://rezka.ag'
            },
            {
                type: 'input',
                name: 'rezka_login',
                title: 'Логин Rezka',
                value: storage.login,
                placeholder: 'Ваш логин'
            },
            {
                type: 'input',
                name: 'rezka_password',
                title: 'Пароль Rezka',
                value: storage.password,
                placeholder: 'Ваш пароль',
                password: true
            }
        ],
        onChange: function(values) {
            Lampa.Storage.set('rezka_mirror', values.rezka_mirror || defaultMirrors[0]);
            Lampa.Storage.set('rezka_login', values.rezka_login || '');
            Lampa.Storage.set('rezka_password', values.rezka_password || '');
            storage.mirror = values.rezka_mirror || defaultMirrors[0];
            storage.login = values.rezka_login || '';
            storage.password = values.rezka_password || '';
            Lampa.Noty.show('Настройки сохранены. Проверяем авторизацию...');
            loginRezka();
        }
    });

    // Хуки Lampa
    Lampa.Listener.follow('app', function(e) {
        if (e.type == 'playlist:append') {
            e.data.items = removeTrailers(e.data.items);
        }
    });

    Lampa.Listener.follow('source', function(e) {
        if (e.name == 'rezka') {
            e.parser = rezkaParser;
            e.mirrors = defaultMirrors;
        }
    });

    // Автоматическая попытка входа при старте
    if (storage.login && storage.password) {
        loginRezka();
    }

    console.log('Rezka Auth + NoTrailer плагин загружен!');
})();
