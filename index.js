var spawn = require('child_process').spawn
  , through = require('through2')
  , Promise = require('bluebird')
  , platform = require('os').platform()
  , eol = require('os').EOL

/**
 * Spawner - a wrapper to promised spawn
 * @param  {Object}  options        modifiers {out: Function|string, err: Function|string}
 * @param  {Object}  spawn_options  options to spawn process (nodejs.org/api/child_process.html)
 * @return {Object}  Wrapper        {sp = spawn = Promise, Stream out, Stream err}
 */
var Spawner = function(options, spawn_options) {

  var self = this
  var opt = {out: 'out: ', err: 'err: '}

  if(typeof options == 'object') {
    opt.out = options.out !== undefined ? options.out : opt.out
    opt.err = options.err !== undefined ? options.err : opt.err
  }

  //those are global streams to allow piping of the current running spawn
  self.out = this.pipe().on('data', function(d) {
    self.data.out.push(new Buffer(d).toString().replace(eol, ''))
  })
  self.err = this.pipe().on('data', function(d) {
    self.data.err.push(new Buffer(d).toString().replace(eol, ''))
  })

  var spawn = function() {

    var args = [].slice.call(arguments)
        args = [].concat.apply([], args) //flatten

    var num_commands = args.length
        , commands = []
        , i = 0

    for(i; i < num_commands; i++) {
      commands.push({
        command: self.command,
        args: self.args.concat([args[i]]),
        options: spawn_options || {}
      })
    }

    //reset previous spawn datas
    self.data = {out: [], err: []}

    return new Promise(function(resolve, reject) {
      var j = 0

      //function to loop through promises commands
      //doing like this to handle the catch promise when previous command fail and to reject spawner global promise
      var loop = function(array) {
        var command = array.shift()

        self
          .promise_spawn.call(self, command, opt)
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

    }).bind(self)
  }

  //main function wrapper
  return {
    sp: spawn,
    spawn: spawn,
    out: self.out,
    err: self.err
  }
}

Spawner.prototype = {
  //directly from nodejs exec code, allows to run string commands with ease
  command: platform == 'win32' ? 'cmd.exe' : 'sh',
  args: platform == 'win32' ? ['/s', '/c'] : ['-c'],
  /**
   * Promisify Spawn
   * @param  {Object} command {command, args, spawn_options}
   * @param  {Object} options modifiers from Spawner
   * @return {Promise}         Promise resolve on error code = 0 or reject
   */
  promise_spawn: function(command, options) {
    var self = this

    return new Promise(function(resolve, reject) {

      var s = spawn(command.command, command.args, command.options)

      //spawn stdout to the Stream modifier
      //writes data back to global Stream
      s.stdout
        .pipe(self.pipe(options.out))
        .on('data', function(d) {
          self.out.write(d)
        })

      s.stderr
        .pipe(self.pipe(options.err))
        .on('data', function(d) {
          self.err.write(d)
        })

      s.on('close', function(code) {
        if(code === 0)
          resolve(code)
        else
          reject(code)
      })
    })

  },
  pipe: function(modifier) {
    modifier = modifier === undefined ? '' : modifier

    return through.obj(function (chunk, enc, callback) {
      chunk = typeof modifier == 'function' ? modifier(chunk) : modifier + chunk
      this.push(chunk)
      callback()
    })
  }
}

module.exports = Spawner
