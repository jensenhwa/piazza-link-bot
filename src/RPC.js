const axios = require('axios').default
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const tough = require('tough-cookie')

axiosCookieJarSupport(axios)

const cookieJar = new tough.CookieJar()

var apiURL = 'https://piazza.com/logic/api'

var RPC = function (method, params) {
  let headers = {}
  if (cookieJar.getCookiesSync(apiURL).length) {
    console.log(cookieJar.getCookiesSync(apiURL))
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

module.exports = RPC