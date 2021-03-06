'use strict';

var unirest = require('unirest');
var Q = require('q');
var cheerio = require('cheerio');
var _ = require('lodash');

var COOKIE_NAME = 'PHPSESSID',
    HOST = 'howmuchphe.org',
    ORIGIN = 'https://' + HOST,
    REFERER = ORIGIN,
    USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36';

function HMPClient(email, password, userId) {
    this._email= email;
    this._password = password;
    this._userId = userId;

    this._voiceShortcuts = {
        'rice crispy treats': '54973',
        'american cheese singles': '54366',
        'banana bread': '62263',
        'nutty butter': '61147',
        'biscuits': '62035',
        'broccoli': '53251',
        'coconut milk': '51340',
        'cucumbers': '53287',
        'french fries': '52382',
        'waffles': '51667',
        'cambrooke bread': '54336',
        'oatmeal': '57422',
        'pasta': '62040',
        'seaweed': '52978',
        'rice': '62003',
        'skinny pop': '61891',
        'spinach': '53355',
        'goldfish': '51465',
        'olive oil': '55142',
        'butter': '55132'
    };

    /*
        servingSize - units per serving
        weight - grams per serving
        protein - protein per serving
        phe - mg phe per serving
        calories - calories per serving
        proteinequiv - protein equivs per serving
    */
    this._running = false;
    this._foodCache = {};
    this._writeId = 0;
    this._outstandingWrites = {};
}

HMPClient.prototype.getShortcuts = function () {
    return Object.keys(this._voiceShortcuts);
}

HMPClient.prototype.stop = function () {
    this._running = false;
    this._foodCache = {};
    return Q.allSettled(_.values(this._outstandingWrites));
}

HMPClient.prototype.calculateEntry = function (sessionId, shortcut, quantityStr, unit) {
    var foodId = this._voiceShortcuts[shortcut],
        quantity, servings;
    if (!foodId) {
        throw 'Unknown voice shortcut: ' + shortcut;
    }
    if (!quantityStr) {
        throw 'Missing quantity information';
    }
    quantity = Number.parseFloat(quantityStr);
    if (Number.isNaN(quantity)) {
        throw 'Bad quantity: ' + quantityStr;
    }
    if (unit === 'gram' || unit === 'grams') {
        //quantity is in grams
        servings = quantity / servingData.weight;
    }
    else if (unit === 'unit' || unit === 'units' || unit === 'piece' || unit === 'pieces') {
        //quantity is in servings
        servings = quantity;
    }
    else {
        throw "Unknown unit: " + unit;
    }
    if (!this._foodCache[foodId]) {
        this._foodCache[foodId] = this._fetchEntry(sessionId, foodId);
    }
    return this._foodCache[foodId].then(function (servingData) {
        return {
            foodId: foodId,
            measureId: '2',
            serving: servings,
            phe: servings * servingData.phe,
            protein: servings * servingData.protein,
            calories: servings * servingData.calories,
            proteinequiv: servings * servingData.proteinequiv,
            serv_weight_grams: servings * servingData.weight
        }
    });
}

HMPClient.prototype.createEntry = function (sessionId, profileId, data) {
    var that = this,
        writeId;

    this._writeId += 1;
    writeId = this._writeId.toString();
    this._outstandingWrites[writeId] = this._createEntry(sessionId, profileId, data).then(
        function (result) {
            delete that._outstandingWrites[writeId];
            return result;
        },
        function (error) {
            delete that._outstandingWrites[writeId];
            return error;
        }
    );
}

HMPClient.prototype.login = function () {
    var deferred = Q.defer();

    console.log('Logging in email [' + this._email + ']');

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
        console.log('Logged in sessionId [' + response.cookies[COOKIE_NAME] + ']');

        deferred.resolve(response.cookies[COOKIE_NAME]);
    });

    return deferred.promise;
};

HMPClient.prototype.logout = function (sessionId) {
    var that = this,
        deferred = Q.defer();

    console.log('Logging out sessionId [' + sessionId + ']');

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
        console.log('Logged out sessionId [' + sessionId + ']');
        deferred.resolve(true);
    });

    return deferred.promise;
};

HMPClient.prototype.start = function (sessionId) {
    var that = this,
        batchPromise = Q(null),
        batches = _.chunk(Object.keys(this._voiceShortcuts), 3);

    this._running = true;
    batches.forEach(function (batch) {
        batchPromise = batchPromise.then(function() {
            if (!that._running) {
                console.log('Stopped caching');
                return;
            }
            console.log('Fetching new batch: ' + batch);
            let batchPromiseList = _.map(batch, function (shortcut) {
                let foodId = that._voiceShortcuts[shortcut];
                if (!that._foodCache[foodId]) {
                    that._foodCache[foodId] = that._fetchEntry(sessionId, foodId);
                }
                return that._foodCache[foodId];
            });
            return Q.allSettled(batchPromiseList);
        });
    });
}

HMPClient.prototype._fetchEntry = function (sessionId, foodId) {
    var that = this,
        deferred = Q.defer();

    console.log('Fetching entry with sessionId [' + sessionId + '] and foodId [' + foodId + ']');

    unirest.get('https://howmuchphe.org/food/view/' + foodId)
    .headers({
        'Accept': '*/*',
        'Host': HOST,
        'Origin': ORIGIN,
        'Referer': REFERER,
        'User-Agent': USER_AGENT,
        'Cookie': COOKIE_NAME + '=' + sessionId,
    })
    .followRedirect(false)
    .end(function (response) {
        if (response.code !== 200) {
            console.log('Fetched failed for sessionId [' + sessionId + '] and foodId [' + foodId + ']: ' + response.code);
            deferred.reject("Fetch failed with bad status code: " + response.code);
            return;
        }
        var data = that._scrapeEntry(response.body);
        console.log('Fetched entry with sessionId [' + sessionId + '] and foodId [' + foodId + ']: ' + JSON.stringify(data));
        deferred.resolve(data);
    });

    return deferred.promise;
};

function numFromTable(table, id) {
    return Number.parseFloat(table.find('tr#' + id + ' td.value').text());
}

HMPClient.prototype._scrapeEntry = function (html) {
    var $ = cheerio.load(html),
        table = $('table#hmp-data');

    // console.log(table.html());
    return {
        servingSize: numFromTable(table, 'servingSize'),
        weight: numFromTable(table, 'weight'),
        protein: numFromTable(table, 'protein'),
        phe: numFromTable(table, 'phe'),
        calories: numFromTable(table, 'calories'),
        proteinequiv: numFromTable(table, 'proteinequiv')
    };
};

HMPClient.prototype._createEntry = function (sessionId, profileId, data) {
    var that = this,
        deferred = Q.defer();

    if (Object.keys(data).length < 8) {
        throw "Bad data: " + JSON.stringify(data);
    }

    console.log('Adding entry with sessionId [' + sessionId + '], userId [' + that._userId + '], profileId [' + profileId +']: ' + JSON.stringify(data));

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
        'Tracking[profileId]': profileId,
        'Tracking[foodId]': data.foodId,
        'Tracking[measureId]': data.measureId,
        'Tracking[proteinequiv]': data.proteinequiv + 'g',
        'Tracking[serving]': data.serving,
        'Tracking[phe]': data.phe + 'mg',
        'Tracking[protein]': data.protein + 'g',
        'Tracking[calories]': data.calories,
        'Tracking[serv_weight_grams]': data.serv_weight_grams + 'g'
    })
    .followRedirect(false)
    .end(function (response) {
        if (response.code !== 200) {
            console.log(response);
            deferred.reject("Create failed with bad status code: " + response.code);
            return;
        }
        console.log('Added entry with sessionId [' + sessionId + '], userId [' + that._userId + '], profileId [' + profileId +']: ' + JSON.stringify(data));
        deferred.resolve(data);
    });

    return deferred.promise;
};

module.exports = HMPClient;
