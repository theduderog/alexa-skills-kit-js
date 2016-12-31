'use strict';

var unirest = require('unirest');
var Q = require('q');

var HOST = 'howmuchphe.org',
    ORIGIN = 'https://' + HOST,
    REFERER = ORIGIN,
    USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36';

function HMPClient(email, password, userId, profileId, favorites) {
    this._email= email;
    this._password = password;
    this._userId = userId;
    this._profileId = profileId;
    this._favorites = favorites;
}

HMPClient.prototype.login = function () {
    var deferred = Q.defer();

    unirest.post('https://howmuchphe.org/site/login')
    .headers({
        'Accept': '*/*',
        'Host': HOST,
        'Origin': ORIGIN,
        'Referer': REFERER,
        'User-Agent': USER_AGENT
    })
    .send({
        'LoginForm[email]': this._email,
        'LoginForm[password]': this._password,
        'LoginForm[rememberMe]': 0
    })
    .end(function (response) {
        if (response.code !== 200) {
            console.log(response.body);
            deferred.reject("Login failed with bad status code: " + response.code);
            return;
        }
        if (!response.cookies.PHPSESSID) {
            deferred.reject("No cookie found");
            return;
        }
        deferred.resolve(response.cookies.PHPSESSID);
    });

    return deferred.promise;
}

module.exports = HMPClient;
