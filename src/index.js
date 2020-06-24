/* vim: set ft=javascript ts=2 et sw=2 tw=80: */

var config = require('./config')
var RegexBot = require('./regexbot')
var RetryFilter = require('./retryfilter')
var Piazza = require('./RPC')
var urlregex = /\/class\/([^?]*)\?cid=(.*)/
var TurndownService = require('turndown')
var turndownService = new TurndownService()
var randomiser = function (max) {
  return Math.floor(Math.random() * max)
}
var regexbot = new RegexBot(config, randomiser)
var retryFilter = new RetryFilter(config)

const { WebClient, ErrorCode } = require('@slack/web-api')
const { createEventAdapter } = require('@slack/events-api')
const user = Piazza('user.login', {
  email: 'hwaj+388@umich.edu',
  pass: 'UA5#4mnPE4RKfgVG'
}).then((user) => {
  console.log('logged in as' + user.name)
}).catch(function (error) {
  console.log('Failed to login to Piazza: ', error)
})

// Create a web client to send messages back to Slack
const web = new WebClient(config.slack_api_token)

const slackEvents = createEventAdapter(config.events.signing_secret)

// Listen for messages
slackEvents.on('message', (message) => {
  console.log('Received a message')
  if (message.subtype === 'bot_message' || message.hasOwnProperty('bot_id')) {
    return
  }

  console.log('Accepted a message: ' + JSON.stringify(message))

  function messageOkay (message) {
    // Make the retry filter remember this message
    retryFilter.addMessage(message)

    regexbot.respond(message.text, (reply) => {
      console.log('Responding with: ' + reply)

      var replyMessage = {
        channel: message.channel,
        text: reply,
      }

      // If bot is configured to reply as a thread, or if the message that
      // triggered the bot was already a threaded reply, then add a 'thread_ts'
      // so that the bot replies inside the thread.
      if (config.reply_as_thread || message.thread_ts !== undefined) {
        replyMessage.thread_ts = message.thread_ts || message.ts
      }

      postMessage(replyMessage)
    })
  }

  function messageIsDuplicate (message) {
    console.log('Message is a duplicate')
  }

  retryFilter.filter(message, messageOkay, messageIsDuplicate)
})

slackEvents.on('link_shared', (event) => {
  let unfurl = {
    channel: event.channel,
    ts: event.message_ts,
    unfurls: {}
  }
  for (const link of event.links) {
    let findings = link.url.match(urlregex)
    console.log(findings)
    Piazza('content.get', {
      nid: findings[1],
      cid: findings[2]
    })
      .then((res) => {
        console.log(res.data.result.history[0].content)
        postContent = turndownService.turndown(res.data.result.history[0].content)
        msgAttachment = {
          color: '#3e7aab',
          title: turndownService.turndown(res.data.result.history[0].subject),
          title_link: 'https://piazza.com/class/' + findings[1] + '?cid=' + findings[2],
          text: postContent,
          mrkdwn_in: ['text'],
          fields: [],
        }
        msgAttachment.fields.push(constructStatusField(res.data.result))
        console.log(msgAttachment)
        anons = new Set()
        authors = new Set()
        for (entry of res.data.result.history) {
          authors.add(entry.uid)
          if (entry.anon !== 'no')
            anons.add(entry.uid)
        }
        return Piazza('network.get_users', { ids: Array.from(authors), nid: 'k4iv85stjw02kh' })
      })
      .then((res) => {

        msgAttachment.fields.push({
          title: res.data.result.length > 1 ? 'Authors' : 'Author',
          value: res.data.result.map(function (e) {
            if (anons.has(e.id)) {
              return e.name + ' (anon)'
            } else {
              return e.name
            }
          }).join('\n'),
          short: true,
        })
        console.log(msgAttachment)
        unfurl.unfurls[link.url] = {
          text: '@' + findings[2] + ' attached:',
          attachments: JSON.stringify([msgAttachment])
        }
      })
      .catch((err) => {
        console.log(err.toJSON())
      })
    //
  }
  // web.chat.unfurl(unfurl);
})

slackEvents.on('error', console.error)

function postMessage (options) {
  web.chat.postMessage(options)
    .catch((error) => {
      if (error.code === ErrorCode.PlatformError) {
        // a platform error occurred, `error.message` contains error information, `error.data` contains the entire resp
        console.error(error.message)
        console.info(error.data)
      } else {
        // some other error occurred
        console.error(error)
      }
    })
}

(async () => {
  // Start the built-in server
  const server = await slackEvents.start(config.events.port)

  // Log a message when the server is ready
  console.log(`Listening for events on ${server.address().port}`)
  config.build(config.events.port)
})()

function constructStatusField (res) {
  let statusText = []
  let statusEmoji = ':white_check_mark:'
  if (res.type === 'note') {
    statusEmoji = ':notebook:'
  } else if (res.no_answer > 0) {
    statusEmoji = ':x:'
    statusText.push('No answer.')
  } else {
    let instructor_handled = false
    for (node of res.children) {
      if (node.type === 's_answer') {
        let pending = 'Student answered. '
        instructor_endorsed = false
        for (e of node.tag_endorse) {
          if (e.admin) {
            instructor_endorsed = true
            instructor_handled = true
            break
          }
        }
        pending += instructor_endorsed ? '[Endorsed]' : '[Unendorsed]'
        statusText.push(pending)
      } else if (node.type === 'i_answer') {
        instructor_handled = true
        statusText.push('Instructor answered.')
      }
    }
    statusEmoji = instructor_handled ? ':white_check_mark:' : ':warning:'
  }

  if (res.no_answer_followup > 0) {
    statusEmoji = ':x:'
    statusText.unshift(res.no_answer_followup.toString() + ' unresolved ' +
    res.no_answer_followup > 1 ? ' followups.' : ' followup.')
  }
  return {
    title: 'Status ' + statusEmoji,
    value: statusText.join('\n'),
    short: true,
  }
}