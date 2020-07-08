const axios = require('axios').default
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const tough = require('tough-cookie')

axiosCookieJarSupport(axios)

const cookieJar = new tough.CookieJar()

var apiURL = 'https://piazza.com/logic/api'

var RPC = function (method, params) {
  let headers = {}
  if (cookieJar.getCookiesSync(apiURL).length) {
    headers = { 'CSRF-Token': cookieJar.getCookiesSync(apiURL)[1].value }
  }
  let tempURL = apiURL + '?method=' + method + '&aid=' +
    (new Date()).getTime().toString(36) + Math.round(Math.random() * 1679616).toString(36)
  return axios.post(tempURL, {
    method: method,
    params: params
  }, {
    jar: cookieJar,
    headers: headers,
    withCredentials: true
  })
}

async function login() {
  let response
  try {
    response = await RPC('user.login', {
      email: 'hwaj+388@umich.edu',
      pass: 'UA5#4mnPE4RKfgVG'
    })
  } catch (error) {
    console.error(error)
  }
  console.log("logged in as " + response.data.result)
}

async function getPost(nid, post) {
  let response
  try {
    response = await RPC('content.get', {nid: nid, cid: post})
  } catch (error) {
    console.error(error)
  }

  return response.data.result
}

async function getUsers(nid, authors) {
  let response
  try {
    response = await RPC('network.get_users', { ids: Array.from(authors), nid: nid })
  } catch (error) {
    console.error(error)
  }

  return response.data.result
}

module.exports.login = login;
module.exports.getPost = getPost;
module.exports.getUsers = getUsers;
