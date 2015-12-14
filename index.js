'use strict'

var opbeat = require('opbeat').start()
var fs = require('fs')
var http = require('http')
var handlebars = require('handlebars')
var AWS = require('aws-sdk')

var s3 = new AWS.S3()
var tmpl = handlebars.compile(fs.readFileSync('index.handlebars').toString())

var server = http.createServer(function (req, res) {
  if (req.method !== 'GET' || req.url !== '/') {
    res.statusCode = 404
    res.end()
    return
  }

  fetchKeys(function (err, keys) {
    if (err) {
      opbeat.captureError(err)
      res.statusCode = 500
      res.end()
      return
    }

    var html = tmpl({ jobs: keys })
    res.writeHead(200, {
      'Content-Length': Buffer.byteLength(html),
      'Content-Type': 'text/html'
    })
    res.end(html)
  })
})

server.listen(process.env.PORT, function () {
  console.log('Server listening on port', server.address().port)
})

function fetchKeys (cb) {
  var params = {
    Bucket: 'watson-printbin'
  }
  s3.listObjects(params, function (err, data) {
    if (err) return cb(err)
    var keys = data.Contents
      .sort(function (a, b) {
        return b.LastModified.getTime() - a.LastModified.getTime()
      })
      .map(function (obj) {
        return obj.Key
      })
    cb(null, keys)
  })
}
