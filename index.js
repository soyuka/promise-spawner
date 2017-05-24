var spawn = require('child_process').spawn
var through = require('through2')
var platform = require('os').platform()
var util = require('util')
var eol = require('os').EOL

/**
 * Spawner - a wrapper to promised spawn
 * @param  {Object}  options        modifiers {out: Function|string, err: Function|string}
 * @param  {Object}  spawn_options  options to spawn process (nodejs.org/api/child_process.html)
 * @return {Object}  Wrapper        {Promise sp = spawn, Stream out, Stream err}
 */
var Spawner = function(options, spawn_options) {
  var opt = {}
  var self = this

  if(typeof options == 'object') {
    opt.out = options.out !== undefined ? options.out : opt.out
    opt.err = options.err !== undefined ? options.err : opt.err
  }

  //those are global streams to allow piping of the current running spawn
  this.out = through.obj(function (chunk, enc, callback) {
    this.push(chunk)
    self.data.out.push(chunk)
    return callback()
  })

  this.err = through.obj(function (chunk, enc, callback) {
    this.push(chunk)
    self.data.err.push(chunk)
    return callback()
  })

  var spawn = function() {
    var args = [].slice.call(arguments)
    var last = args.length - 1

    if(!util.isArray(args[last]) && typeof args[last] == 'object') {
      var options = args.pop()
    }

    args = [].concat.apply([], args) //flatten

    var num_commands = args.length
    var commands = []
    var i = 0

    for(i; i < num_commands; i++) {
      commands.push({
        command: this.command,
        args: this.args.concat([args[i]]),
        options: options || spawn_options || {}
      })
    }

    //reset previous spawn datas
    this.data = {out: [], err: []}

    return new Promise((resolve, reject) => {
      var j = 0

      //function to loop through promises commands
      //This handles the catch promise when a command fail
      //Then, we can reject the spawner global promise
      var loop = (array) => {
        var command = array.shift()

        this
          .promise_spawn(command, opt)
          .then(function(code) {
            if(j < num_commands - 1) {
              j++
              return loop(array)
            } else {
              resolve(code)
            }

          }).catch(function(code) {
            reject(code)
          })
      }

      loop(commands)

    })
  }

  //main function wrapper
  return {
    sp: spawn.bind(this),
    spawn: spawn.bind(this),
    out: this.out,
    err: this.err
  }
}

Spawner.prototype = {
  command: platform == 'win32' ? 'cmd.exe' : 'sh',
  args: platform == 'win32' ? ['/s', '/c'] : ['-c'],
  /**
   * Promisify Spawn
   * @param  {Object} command {command, args, spawn_options}
   * @param  {Object} options modifiers from Spawner
   * @return {Promise}         Promise resolve on error code = 0 or reject
   */
  promise_spawn: function(command, options) {
    return new Promise((resolve, reject) => {

      var s = spawn(command.command, command.args, command.options)

      //spawn stdout to the Stream modifier
      //writes data back to global Stream
      s.stdout && s.stdout
        .pipe(this.pipe(options.out))
        .on('data', (d) => {
          this.out.write(d)
        })

      s.stderr && s.stderr
        .pipe(this.pipe(options.err))
        .on('data', (d) => {
          this.err.write(d)
        })

      s.on('close', (code) => {
        if(code === 0) {
          resolve({code: code, data: this.data})
        } else {
          reject({code: code, data: this.data})
        }
      })
    })
  },
  pipe: function(modifier) {
    modifier = modifier === undefined ? '' : modifier

    return through.obj(function (chunk, enc, callback) {
      chunk = typeof modifier == 'function' ? modifier(chunk) : modifier + chunk.toString().replace(eol, '')
      this.push(chunk)
      callback()
    })
  }
}

module.exports = Spawner
