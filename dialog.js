"use strict";

var builder = require('botbuilder');

var https = require('https');
var querystring = require('querystring');
var prompts = require('./prompts.js');

var model = process.env.LUIS_MODEL;
var recognizer = new builder.LuisRecognizer(model)
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });

module.exports = dialog
    
    .matches('book', [
        confirmQuery, searchProfiles
    ])
    .matches('LoadProfile', [
        confirmUsername, getProfile
    ])
    
    .onDefault([sendInstructions]);

function confirmQuery(session, args, next) {
    session.dialogData.entities = args.entities;
    var query = builder.EntityRecognizer.findEntity(args.entities, 'query');

    if (query) {
        next({ response: query.entity });
    } else {
        builder.Prompts.text(session, 'Where do you want to go?');
    }
}

var options = [
    'Book a Flight',
    'Book Train',
    'Book a Cab'
    
]

function sendInstructions(session, results, next) {
    builder.Prompts.choice(session, 'What you want me to book for you?', options);
    next();
}

function searchProfiles(session, results, next) {
    var query = session.dialogData.query = results.response;
    if (!query) {
        session.endDialog('Request cancelled...');
    } else {
        executeSearch(query, function (profiles) {
            var totalCount = profiles.total_count;
            if (totalCount == 0) {
                session.endDialog('Sorry, no results found.');
            } else if (totalCount > 10) {
                session.endDialog('More than 10 results were found. Please provide a more restrictive query.');
            } else {
                session.dialogData.property = null;
                var thumbnails = profiles.items.map(function(item) { return getProfileThumbnail(session, item)});
                var message = new builder.Message(session).attachments(thumbnails).attachmentLayout('carousel');
                session.send(message);
            }
        });
    }
}

function confirmUsername(session, args, next) {
    session.dialogData.entities = args.entities;

    var username = builder.EntityRecognizer.findEntity(args.entities, 'username');
    if (username) {
        next({ response: username.entity });
    } else {
        builder.Prompts.text(session, 'What is the username?');
    }
}

function getProfile(session, results, next) {
    var username = results.response;

    if (username.entity) username = session.dialogData.username = username.entity;
    else session.dialogData.user = username;

    if (!username) {
        session.endDialog('Request cancelled.');
    } else {
        loadProfile(username, function (profile) {
            if (profile && profile.message !== 'Not Found') {
                var message = new builder.Message(session).attachments([getProfileThumbnail(session, profile)]);
                session.send(message);

                next();
            } else {
                session.endDialog('Sorry, couldn\'t find a profile with that name. You can do a search for a profile.');
            }
        });
    }
}

// -- helper functions

function getProfileThumbnail(session, profile) {
    var thumbnail = new builder.ThumbnailCard(session);
    thumbnail.title(profile.login);
    thumbnail.images([builder.CardImage.create(session, profile.avatar_url)]);

    if(profile.name) thumbnail.subtitle(profile.name);

    var text = '';
    if (profile.company) text += profile.company + ' \n';
    if (profile.email) text += profile.email + ' \n';
    if (profile.bio) text += profile.bio;
    thumbnail.text(text);

    thumbnail.tap(new builder.CardAction.openUrl(session, profile.html_url));
    return thumbnail;
}

function executeSearch(query, callback) {
    getLocationCoordinates(query, function (loc) {
        console.log(loc);
    }); 
    loadData('/search/users?q=' + querystring.escape(query), callback);
}

function getLocationCoordinates(query, callback) {
    var options = {
        host: 'maps.googleapis.com',
        port: 443,
        path: '/maps/api/geocode/json?address='+query+'&key=AIzaSyC8XNQG2h9awgr45aSdRoids6UuWEGCong',
        method: 'GET',
        headers: {
            
        }
    };
    
    var request = https.request(options, function (response) {
        var data = '';
        response.on('data', function (chunk) { data += chunk; });
        response.on('end', function () {
            callback(JSON.parse(data));
        });
    });
    request.end();
}

function loadProfile(username, callback) {
    loadData('/users/' + querystring.escape(username), callback);
}

function loadData(path, callback) {
    var options = {
        host: 'api.github.com',
        port: 443,
        path: path,
        method: 'GET',
        headers: {
            'User-Agent': 'sample-bot'
        }
    };
    var profile;
    var request = https.request(options, function (response) {
        var data = '';
        response.on('data', function (chunk) { data += chunk; });
        response.on('end', function () {
            callback(JSON.parse(data));
        });
    });
    request.end();
}