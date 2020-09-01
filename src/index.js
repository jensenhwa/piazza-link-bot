/* vim: set ft=javascript ts=2 et sw=2 tw=80: */

var config = require('./config')
var RegexBot = require('./regexbot')
var RetryFilter = require('./retryfilter')
var Piazza = require('./RPC')
var urlregex = /\/class\/([^?]*)\?cid=(.*)/
var normalize = require('./normalize')
var randomiser = function (max) {
  return Math.floor(Math.random() * max)
}
var regexbot = new RegexBot(config, randomiser)
var retryFilter = new RetryFilter(config)

const { WebClient, ErrorCode } = require('@slack/web-api')
const { createEventAdapter } = require('@slack/events-api')

Piazza.login()

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
        unfurl_links: true
      }

      // If bot is configured to reply as a thread, or if the message that
      // triggered the bot was already a threaded reply, then add a 'thread_ts'
      // so that the bot replies inside the thread.
      if (config.reply_as_thread || message.thread_ts !== undefined) {
        replyMessage.thread_ts = message.thread_ts || message.ts
      }
      console.log("replying:")
      console.log(replyMessage)

      web.chat.postMessage(replyMessage)
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
    })
  }

  function messageIsDuplicate (message) {
    console.log('Message is a duplicate')
  }

  retryFilter.filter(message, messageOkay, messageIsDuplicate)
})

slackEvents.on('link_shared', (event) => {
  console.log("unfurling links from the following event:")
  console.log(event)
  let unfurl = {
    channel: event.channel,
    ts: event.message_ts,
    unfurls: {}
  }
  handle_links(event.links).then((results) => {
      for (let i = 0; i < results.length; i++) {
        unfurl.unfurls[results[i].url] = results[i].resp
      }
      console.log("Unfurling with:")
      console.log(unfurl)
      web.chat.unfurl(unfurl).then((resp) => {
        console.log('Unfurling complete.')
      })
    }
  )
})

slackEvents.on('error', console.error)



function handle_links (links) {
  const promises = []
  for (const link of links) {
    promises.push(unfurl_piazza(link.url))
  }
  return Promise.all(promises)
}


function unfurl_piazza (url) {
  let findings = url.match(urlregex)
  const nid = findings[1]
  const post = findings[2]
  let msgAttachment
  let anons
  return new Promise(resolve => {
    Piazza.getPost(nid, post)
      .then((res) => {
        const postContent = normalize.markdown(res.history[0].content)
        console.log(postContent)
        let date = new Date(res.history[0].created)
        date = date.getTime() / 1000
        msgAttachment = {
          blocks: [
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": `*<https://piazza.com/class/${nid}?cid=${post}|${normalize.unencode(res.history[0].subject)}>*\n${postContent.markdown}`,
              },
              "fields": []
            },
          ],
          color: '#3e7aab'
        }

        for (const img of postContent.images) {
          msgAttachment.blocks.push({
            "type": "image",
            "image_url": img,
            "alt_text": "Piazza photo"
          })
        }
        msgAttachment.blocks.push({
            "type": "context",
            "elements": [
              {
                "type": "image",
                "image_url": "https://images-na.ssl-images-amazon.com/images/I/712ey5%2Bl2%2BL._SY355_.png",
                "alt_text": "images"
              },
              {
                "type": "mrkdwn",
                "text": '<\!date^' + date.toString() + '^Post updated {date_pretty} at {time}|' + res.history[0].created + '>'
              }
            ]
          })
        msgAttachment.blocks[0].fields.push(constructStatusField(res))
        anons = new Set()
        const authors = new Set()
        for (let i = 0; i < res.history.length; i++) {
          let entry = res.history[i]
          if ('uid' in entry)
            authors.add(entry.uid)
          else
            anons.add(entry.uid_a)
        }
        return Piazza.getUsers(nid, Array.from(authors))
      })
      .then((res) => {
        console.log(res)
        msgAttachment.blocks[0].fields.push({
          type: "mrkdwn",
          text: (res.length > 1 ? '*Authors*\n' : '*Author*\n') + res.map(function (e) {
            if (anons.has(e.id)) {
              return e.name + ' (anon)'
            } else {
              return e.name
            }
          }).join('\n')
        })
        console.log(JSON.stringify(msgAttachment))
        resolve({ url: url, resp: msgAttachment })
      })
      .catch((err) => {
        console.log(err)
      })
  })
}


function constructStatusField (res) {
  let statusText = []
  let statusEmoji
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
        let instructor_endorsed = false
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
    statusText.unshift(res.no_answer_followup.toString() + ' unresolved ' + (res.no_answer_followup > 1 ? 'followups.' : 'followup.'))
  }
  return {
    type: "mrkdwn",
    text: '*Status ' + statusEmoji + '*\n' + statusText.join('\n')
  }
}

// function getAnonymousIcon(id) {
//   var nr = parseInt(id.replace("a_", "")) + 1;
//   var rnd = P.note_view.content.id.charCodeAt(P.note_view.content.id.length - 1);
//   var bigPrimes = [23, 29, 31, 37]; // 36 primes
//   var idx = bigPrimes[rnd % bigPrimes.length] * nr + rnd;
//   var names = ['anon_icon-01', 'anon_icon-02', 'anon_icon-03', 'anon_icon-04', 'anon_icon-05', 'anon_icon-06', 'anon_icon-07', 'anon_icon-08', 'anon_icon-09'];
//   var namesC = ['Atom', 'Helix', 'Mouse', 'Beaker', 'Calc', 'Comp', 'Gear', 'Scale', 'Poet'];
//   var level = parseInt((nr - 1) / names.length);
//   var title = namesC[idx % names.length];
//   if (level > 0) {
//     title += " " + (level + 1);
//   }
//   return {icon:names[idx % names.length], title:title};
// }
(async () => {
  // Start the built-in server
  const server = await slackEvents.start(config.events.port)

  // Log a message when the server is ready
  console.log(`Listening for events on ${server.address().port}`)
  config.build(config.events.port)
})()