(function () {
    'use strict';

    // --- 1. Удаляем трейлеры из карточек ---
    Lampa.Listener.follow('full', function (e) {
        if (e.type === 'complite') {
            e.object.activity.render().find('.view--trailer').remove();
        }
    });

    // --- 2. Настройки для Rezka ---
    // === Настройки для Rezka ===
    Lampa.SettingsApi.add({
        component: 'rezka_mod',
        name: 'online_mod_rezka2_name',
        type: 'input',
        default: '',
        description: 'Логин или email для HDRezka'
    });

    Lampa.SettingsApi.add({
        component: 'rezka_mod',
        name: 'online_mod_rezka2_password',
        type: 'input',
        default: '',
        description: 'Пароль для HDRezka'
    });

    // Кнопка "Войти"
    Lampa.SettingsApi.add({
        component: 'rezka_mod',
        name: 'rezka_login_button',
        type: 'button',
        label: 'Войти в HDRezka',
        onClick: function () {
            rezka2Login(function () {
                Lampa.Noty.show('✅ Успешный вход в HDRezka');
            }, function () {
                Lampa.Noty.show('❌ Ошибка входа в HDRezka');
            });
        }
    });

    // Кнопка "Выйти"
    Lampa.SettingsApi.add({
        component: 'rezka_mod',
        name: 'rezka_logout_button',
        type: 'button',
        label: 'Выйти из HDRezka',
        onClick: function () {
            rezka2Logout(function () {
                Lampa.Noty.show('🔓 Вышли из HDRezka');
            });
        }
    });

    // Индикатор статуса (авторизован / нет)
    Lampa.SettingsApi.add({
        component: 'rezka_mod',
        name: 'rezka_status',
        type: 'static',
        label: function () {
            return Lampa.Storage.get('online_mod_rezka2_status', 'false') === 'true'
                ? '🟢 Авторизован'
                : '🔴 Не авторизован';
        }
    });

    // === Функции логина/логаута ===
    function rezka2Login(success, error) {
        var host = Utils.rezka2Mirror();
        var url = host + '/ajax/login/';
        var postdata = 'login_name=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_name', ''));
        postdata += '&login_password=' + encodeURIComponent(Lampa.Storage.get('online_mod_rezka2_password', ''));
        postdata += '&login_not_save=0';

        network.clear();
        network.timeout(8000);
        network.silent(url, function (json) {
            if (json && (json.success || json.message === 'Уже авторизован на сайте. Необходимо обновить страницу!')) {
                Lampa.Storage.set('online_mod_rezka2_status', 'true');
                if (success) success();
            } else {
                Lampa.Storage.set('online_mod_rezka2_status', 'false');
                if (json && json.message) Lampa.Noty.show(json.message);
                if (error) error();
            }
        }, function (a, c) {
            Lampa.Noty.show(network.errorDecode(a, c));
            if (error) error();
        }, postdata, {
            withCredentials: true
        });
    }

    function rezka2Logout(success, error) {
        var url = Utils.rezka2Mirror() + '/logout/';
        network.clear();
        network.timeout(8000);
        network.silent(url, function () {
            Lampa.Storage.set('online_mod_rezka2_status', 'false');
            if (success) success();
        }, function (a, c) {
            Lampa.Storage.set('online_mod_rezka2_status', 'false');
            Lampa.Noty.show(network.errorDecode(a, c));
            if (error) error();
        }, false, {
            dataType: 'text',
            withCredentials: true
        });
    }

})();
