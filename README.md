`regexbot`: slackbot with configurable regexes
==============================================

[![Build Status](https://travis-ci.org/sjmelia/regexbot.svg)](https://travis-ci.org/sjmelia/regexbot)

Simple slackbot for responding to messages matching a regex.

Setup
-----

1. Create a [new bot user](https://my.slack.com/services/new/bot) to get a slack api token.
2. `cp config.js.example config.js`
3. Edit `config.js` to have your slack api token and selected regexes.

Matching
--------

`config.js` contains a list of regexes, and a corresponding message to show.
A simple search and replace for numbers in square brackets then fills in the
matches - `[0]` for the whole string, `[1]` for the first match, and so on.
See `config.js.example` for examples.
