/**
 Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

 http://aws.amazon.com/apache2.0/

 or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 */

'use strict';

var HMPClient = require('./hmp'),
    hmp;

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    var APP_ID = "amzn1.ask.skill.5f59a48b-390e-4ed3-913a-0238b59af26d";
    try {
        //console.log(event);
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */

        if (event.session.application.applicationId !== APP_ID) {
            context.fail("Invalid Application ID");
         }

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId
        + ", sessionId=" + session.sessionId);

    handleStart();
}

/**
 * Called when the user invokes the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId
        + ", sessionId=" + session.sessionId);

    handleLaunch(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId
        + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // dispatch custom intents to handlers here
    if ("ListShortcutsIntent" === intentName) {
        handleListShortcutsRequest(intent, session, callback);
    } else if ("SetProfileIntent" === intentName) {
        handleSetProfileRequest(intent, session, callback);
    } else if ("RecordIntent" === intentName) {
        handleRecordRequest(intent, session, callback);
    } else if ("AMAZON.RepeatIntent" === intentName) {
        handleRepeatRequest(intent, session, callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        handleGetHelpRequest(intent, session, callback);
    } else if ("AMAZON.StopIntent" === intentName) {
        handleFinishSessionRequest(intent, session, callback);
    } else if ("AMAZON.CancelIntent" === intentName) {
        handleFinishSessionRequest(intent, session, callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId
        + ", sessionId=" + session.sessionId);

    // Add any cleanup logic here
}

// ------- Skill specific business logic -------

var CARD_TITLE = "How Much Phe"; // Be sure to change this for your skill.

function handleStart() {
    if (!process.env.HMP_EMAIL) {
        throw "Missing HMP_EMAIL env var";
    }
    if (!process.env.HMP_PASSWORD) {
        throw "Missing HMP_PASSWORD env var";
    }
    if (!process.env.HMP_USER_ID) {
        throw "Missing HMP_USER_ID env var";
    }
    hmp = new HMPClient(process.env.HMP_EMAIL, process.env.HMP_PASSWORD, process.env.HMP_USER_ID);
}

function handleLaunch(callback) {
    var sessionAttributes = {},
        speechOutput = "Ready to record phe.",
        repromptText = speechOutput,
        shouldEndSession = false;
    hmp.login().then(
        function (sessionId) {
            sessionAttributes['hmpSessionId'] = sessionId;
            callback(sessionAttributes,
                buildSpeechletResponse(CARD_TITLE, speechOutput, repromptText, shouldEndSession));
        },
        function (error) {
            speechOutput = "Could not login.";
            repromptText = speechOutput;
            shouldEndSession = true;
            callback(sessionAttributes,
                buildSpeechletResponse(CARD_TITLE, speechOutput, repromptText, shouldEndSession));
        }
    );
}

function handleSetProfileRequest(intent, session, callback) {
    var sessionAttributes = {},
        name = intent.slots.Name.value,
        speechOutput = "These are the items you can tell me to record. Rice, Spinach, Waffles, and Oatmeal.",
        repromptText = speechOutput,
        shouldEndSession = false;
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, repromptText, shouldEndSession));
}

function handleListShortcutsRequest(intent, session, callback) {
    var sessionAttributes = {},
        speechOutput = "These are the items you can tell me to record. Rice, Spinach, Waffles, and Oatmeal.",
        repromptText = speechOutput,
        shouldEndSession = false;
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, repromptText, shouldEndSession));
}

function handleRecordRequest(intent, session, callback) {
    var sessionAttributes = {},
        quantity = intent.slots.Quantity.value,
        unit = intent.slots.Unit.value,
        shortcut = intent.slots.Shortcut.value,
        shouldEndSession = false,
        speechOutput, repromptText;

    console.log(intent);
    console.log("quantity: " + intent.slots.Quantity.value);
    console.log("unit: " + intent.slots.Unit.value);
    console.log("item: " + intent.slots.FavItem.value);
    console.log("name: " + intent.slots.Name.value);

    speechOutput = "Recorded " + quantity + " " + unit + " of " + item + " for " + name + ".";
    repromptText = speechOutput;
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, repromptText, shouldEndSession));
}

function handleFinishSessionRequest(intent, session, callback) {
    // End the session with a "Good bye!" if the user wants to quit the game
    callback(session.attributes,
        buildSpeechletResponseWithoutCard("Good bye!", "", true));
}

function handleRepeatRequest(intent, session, callback) {
    // Repeat the previous speechOutput and repromptText from the session attributes if available
    // else start a new game session
    if (!session.attributes || !session.attributes.speechOutput) {
        handleLaunch(callback);
    } else {
        callback(session.attributes,
            buildSpeechletResponseWithoutCard(session.attributes.speechOutput, session.attributes.repromptText, false));
    }
}

function handleGetHelpRequest(intent, session, callback) {
    // Ensure that session.attributes has been initialized
    if (!session.attributes) {
        session.attributes = {};
    }

    var speechOutput = "Tell me to record phe or to list favorites.",
        repromptText = speechOutput,
        shouldEndSession = false;
    callback(session.attributes,
        buildSpeechletResponseWithoutCard(speechOutput, repromptText, shouldEndSession));
}

// ------- Helper functions to build responses -------


function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: title,
            content: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildSpeechletResponseWithoutCard(output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}
