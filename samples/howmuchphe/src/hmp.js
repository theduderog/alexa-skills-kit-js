'use strict';

var unirest = require('unirest');
var Q = require('q');

var COOKIE_NAME = 'PHPSESSID',
    HOST = 'howmuchphe.org',
    ORIGIN = 'https://' + HOST,
    REFERER = ORIGIN,
    USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36';

function HMPClient(email, password, userId, profileId, favorites) {
    this._email= email;
    this._password = password;
    this._userId = userId;
    this._profileId = profileId;
    this._favorites = favorites;

    this._voiceShortcuts = {
        'rice crispy treat': '54973'
    };

    this._favorites = {
        '54973': {

        }
    };
/*
foodId
voiceShortcut
servingSize
weight
protein
phe
exchanges
phe_g
calories
proteinequiv
*/
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
    .followRedirect(false)
    .end(function (response) {
        if (response.code !== 200) {
            console.log(response);
            deferred.reject("Login failed with bad status code: " + response.code);
            return;
        }
        if (!response.cookies[COOKIE_NAME]) {
            deferred.reject("No cookie found");
            return;
        }
        console.log('Logged in: ' + response.cookies[COOKIE_NAME]);
        deferred.resolve(response.cookies[COOKIE_NAME]);
    });

    return deferred.promise;
};

HMPClient.prototype.logout = function (sessionId) {
    var deferred = Q.defer();

    unirest.get('https://howmuchphe.org/site/logout')
    .headers({
        'Accept': '*/*',
        'Host': HOST,
        'Referer': REFERER,
        'User-Agent': USER_AGENT,
        'Cookie': COOKIE_NAME + '=' + sessionId,
    })
    .followRedirect(false)
    .end(function (response) {
        if (response.code !== 302) {
            console.log(response);
            deferred.reject("Logout failed with bad status code: " + response.code);
            return;
        }
        console.log('Logged out: ' + sessionId);
        deferred.resolve(true);
    });

    return deferred.promise;
};

/*
    Required entry fields
        quantity
        unit
        foodId

    Required food item fields:
        foodId
        voiceShortcut
        servingSize
        weight
        protein
        phe
        exchanges
        phe_g
        calories
        proteinequiv
*/
HMPClient.prototype._createEntry = function (sessionId, data) {
    var that = this,
        deferred = Q.defer();

    unirest.post('https://howmuchphe.org/Tracking/Create')
    .headers({
        'Accept': '*/*',
        'Host': HOST,
        'Origin': ORIGIN,
        'Referer': REFERER,
        'User-Agent': USER_AGENT,
        'Cookie': COOKIE_NAME + '=' + sessionId,
    })
    .send({
        'Tracking[userId]': this._userId,
        'Tracking[profileId]': this._profileId,
        'Tracking[foodId]': '54973',
        'Tracking[measureId]': '2',
        'Tracking[proteinequiv]': '0g',
        'Tracking[serving]': '1',
        'Tracking[phe]': '26mg',
        'Tracking[protein]': '0.6g',
        'Tracking[calories]': '90',
        'Tracking[serv_weight_grams]': '22g'
    })
    .followRedirect(false)
    .end(function (response) {
        if (response.code !== 200) {
            console.log(response);
            deferred.reject("Create failed with bad status code: " + response.code);
            return;
        }
        console.log('Added entry with sessionId [' + sessionId + '], userId [' + that._userId + '], profileId [' + that._profileId +']: ' + JSON.stringify(data));
        deferred.resolve(data);
    });

    return deferred.promise;
};

module.exports = HMPClient;
