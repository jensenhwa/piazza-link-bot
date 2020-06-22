/* vim: set ft=javascript ts=2 et sw=2 tw=80: */


var config = require('./config');
var RegexBot = require('./regexbot');
var RetryFilter = require('./retryfilter');
var Piazza = require('piazza-api');
var urlregex = /\/class\/([^?]*)\?cid=(.*)/
var randomiser = function (max) {
  return Math.floor(Math.random() * max);
};
var regexbot = new RegexBot(config, randomiser);
var retryFilter = new RetryFilter(config);

const { WebClient, ErrorCode } = require('@slack/web-api');
const { createEventAdapter } = require('@slack/events-api');
const user = Piazza.login('hwaj+388@umich.edu', 'UA5#4mnPE4RKfgVG').then((user) => {
  console.log('logged in as' + user.name)
})

// Create a web client to send messages back to Slack
const web = new WebClient(config.slack_api_token);

const slackEvents = createEventAdapter(config.events.signing_secret);

// Listen for messages
slackEvents.on('message', (message) => {
  console.log('Received a message');
  if (message.subtype === 'bot_message' || message.hasOwnProperty('bot_id')) {
    return;
  }

  console.log('Accepted a message: ' + JSON.stringify(message));

  function messageOkay (message) {
    // Make the retry filter remember this message
    retryFilter.addMessage(message);

    regexbot.respond(message.text, (reply) => {
      console.log('Responding with: ' + reply);

      var replyMessage = {
        channel: message.channel,
        text: reply,
        unfurl_media: false,
        unfurl_links: false
      };

      // If bot is configured to reply as a thread, or if the message that
      // triggered the bot was already a threaded reply, then add a 'thread_ts'
      // so that the bot replies inside the thread.
      if (config.reply_as_thread || message.thread_ts !== undefined) {
        replyMessage.thread_ts = message.thread_ts || message.ts;
      }

      postMessage(replyMessage);
    });
  }

  function messageIsDuplicate (message) {
    console.log('Message is a duplicate');
  }

  retryFilter.filter(message, messageOkay, messageIsDuplicate);
});

slackEvents.on('link_shared', (event) => {
  let unfurl = {
    channel: event.channel,
    ts: event.message_ts,
    unfurls: {}
  };
  for (const link of event.links) {
    let findings = link.url.match(urlregex);
    console.log(findings);
    let content = user.getClassByID(findings[1]).getContentByID(findings[2]);
    console.log(content);
    // unfurl.unfurls[link.url] =
  }
  // web.chat.unfurl(unfurl);
});

slackEvents.on('error', console.error);

function postMessage (options) {
  web.chat.postMessage(options)
    .catch((error) => {
      if (error.code === ErrorCode.PlatformError) {
        // a platform error occurred, `error.message` contains error information, `error.data` contains the entire resp
        console.error(error.message);
        console.info(error.data);
      } else {
        // some other error occurred
        console.error(error);
      }
    });
}

(async () => {
  // Start the built-in server
  const server = await slackEvents.start(config.events.port);

  // Log a message when the server is ready
  console.log(`Listening for events on ${server.address().port}`);
  config.build(config.events.port);
})();
