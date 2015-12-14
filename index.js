'use strict'

var opbeat = require('opbeat').start()
var fs = require('fs')
var http = require('http')
var handlebars = require('handlebars')
var afterAll = require('after-all')
var AWS = require('aws-sdk')

var s3 = new AWS.S3()
var tmpl = handlebars.compile(fs.readFileSync('index.handlebars').toString())
var BUCKET = 'watson-printbin'
var names = {}

var server = http.createServer(function (req, res) {
  if (req.method !== 'GET' || req.url !== '/') {
    res.statusCode = 404
    res.end()
    return
  }

  fetchDocuments(function (err, docs) {
    if (err) {
      opbeat.captureError(err)
      res.statusCode = 500
      res.end()
      return
    }

    var html = tmpl({ docs: docs })
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

function fetchDocuments (cb) {
  fetchKeys(function (err, keys) {
    if (err) return cb(err)

    var next = afterAll(function (err) {
      if (err) return cb(err)
      cb(null, docs)
    })

    var docs = keys.map(function (key) {
      var doc = { key: key, name: names[key] }

      if (!doc.name) {
        console.log('Caching document name for %s...', key)
        var done = next()
        var params = { Bucket: BUCKET, Key: key }
        s3.headObject(params, function (err, data) {
          if (err) return done(err)
          doc.name = names[key] = data.Metadata.name || key
          done()
        })
      }

      return doc
    })
  })
}

function fetchKeys (cb) {
  s3.listObjects({ Bucket: BUCKET }, function (err, data) {
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
