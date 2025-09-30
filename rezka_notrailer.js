(function () {
    // --- 1. Удаление трейлеров ---
    Lampa.Listener.follow('full', function (e) {
        if (e.type === 'complite' && e.data && e.data.results) {
            e.data.results = e.data.results.filter(function (item) {
                return item.name.toLowerCase().indexOf('трейлер') === -1;
            });
        }
    });

    // --- 2. Настройки Rezka ---
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

    Lampa.SettingsApi.add({
        component: 'rezka_mod',
        name: 'online_mod_proxy_rezka2_mirror',
        type: 'toggle',
        default: false,
        description: 'Проксировать зеркало HDRezka'
    });

    // --- 3. Авторизация ---
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

    // --- 4. Запросы через зеркало/прокси ---
    function rezka2FillCookie(opts, success, error) {
        var prox = Utils.proxy('rezka2');
        var proxy_mirror = Lampa.Storage.field('online_mod_proxy_rezka2_mirror') === true;
        var host = (!prox && !proxy_mirror) ? 'https://rezka.ag' : Utils.rezka2Mirror();

        opts.url = host + opts.url;
        opts.withCredentials = true;

        if (prox) opts.url = prox + opts.url;

        if (success) success();
    }

    // --- 5. Поиск по Rezka ---
    function search(query, callback) {
        var opts = {
            url: '/search/?do=search&subaction=search&q=' + encodeURIComponent(query),
            headers: {}
        };
        rezka2FillCookie(opts, function () {
            network.silent(opts.url, function (html) {
                var results = [];
                var doc = Lampa.Parser.makeDOM(html);
                doc.querySelectorAll('.b-content__inline_item').forEach(function (item) {
                    var title = item.querySelector('.b-content__inline_item-link a').textContent.trim();
                    var link = item.querySelector('.b-content__inline_item-link a').getAttribute('href');
                    var poster = item.querySelector('img').getAttribute('src');
                    results.push({ title: title, url: link, poster: poster });
                });
                callback(results);
            }, function () {
                callback([]);
            }, false, { withCredentials: true });
        }, function () {
            callback([]);
        });
    }

    // --- 6. Получение ссылок (фильмы/сериалы) ---
    function movie(data, callback) {
        var path = data.url.replace(/^https?:\/\/[^/]+/, '');
        var opts = { url: path, headers: {} };

        rezka2FillCookie(opts, function () {
            network.silent(opts.url, function (html) {
                var match = html.match(/initCDNSeriesEvents\((.*?)\)/) || html.match(/initCDNMoviesEvents\((.*?)\)/);
                if (match) {
                    try {
                        var json = JSON.parse(match[1].replace(/'/g, '"'));
                        callback([{ title: 'Rezka', file: json.url }]);
                    } catch (e) {
                        callback([]);
                    }
                } else {
                    callback([]);
                }
            }, function () {
                callback([]);
            }, false, { withCredentials: true });
        }, function () {
            callback([]);
        });
    }

    // --- 7. Регистрация источника Rezka ---
    Lampa.Source.add('rezka_mod', {
        title: 'Rezka',
        search: search,
        movie: movie,
        tv: movie
    });

})();
