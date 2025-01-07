'use strict'

const fs = require('fs')
const { v4: uuid } = require('uuid')
const ps = require('ps-node')
const unoconv = require('unoconv2')
const formats = require('../lib/data/formats.json')
const pkg = require('../package.json')

module.exports.handleUpload = (request, reply) => {
  const convertToFormat = request.params.format
  const data = request.payload
  if (data.file) {
    const startTime = Date.now()
    const nameArray = data.file.hapi.filename.split('.')
    const fileEndingOriginal = nameArray.pop()
    const temporaryName = uuid()
    const pathPre = process.cwd() + '/uploads/' + temporaryName
    const fileNameTempOriginal = pathPre + '.' + fileEndingOriginal
    const file = fs.createWriteStream(fileNameTempOriginal)

    file.on('error', (error) => {
      console.error(error)
    })

    data.file.pipe(file)

    data.file.on('end', (err) => {
      if (err) {
        console.error(err)
        reply(err)
      } else {
        (function processConvert(retries = 0) {
          unoconv.convert(fileNameTempOriginal, convertToFormat, (err, result) => {
            if (err && retries < 3) {
              console.error(`error converting, retrying ${retries + 1}`)
              processConvert(retries + 1)
            } else if (err) {
              console.error(err)
              console.log('Errored in ' + (Date.now() - startTime) + 'ms')
              fs.unlink(fileNameTempOriginal, error => {
                if (error) {
                  console.error("4", error)
                } else {
                  console.log(`${fileNameTempOriginal} deleted`)
                }
              })
              reply(err)
            } else {
              console.log('finished converting in ' + (Date.now() - startTime) + 'ms')
              reply(result)
                .on('finish', () => {
                  fs.unlink(fileNameTempOriginal, error => {
                    if (error) {
                      console.error(error)
                    } else {
                      console.log(`${fileNameTempOriginal} deleted`)
                    }
                  })
                })
            }
          })
        })()
      }
    })
  }
}

module.exports.showFormats = (request, reply) => {
  reply(formats)
}

module.exports.showFormat = (request, reply) => {
  const params = request.params
  const format = params ? formats[request.params.type] : false
  if (!format) {
    reply('Format type not found').code(404)
  } else {
    reply(format)
  }
}

module.exports.showVersions = (request, reply) => {
  const versions = {}
  Object.keys(pkg.dependencies).forEach((item) => {
    versions[item] = pkg.dependencies[item]
  })
  reply(versions)
}

module.exports.healthcheck = (request, reply) => {
  ps.lookup({ arguments: /unoconv/i, psargs: 'ux' }, (err, resultList) => {
    unoconv.detectSupportedFormats((err) => {
      if (resultList.length > 0 && !err) {
        reply({ uptime: process.uptime() })
      } else {
        reply({ error: 'unoconv not running' }).code(500)
      }
    })
  });
}
