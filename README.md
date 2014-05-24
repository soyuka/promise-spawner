promise-spawner
===============

Promise multiple spawner with stdout/stderr streams and error handling

## Examples

### Basic command example

```javascript
var spawner = new Spawner()

spawner
	.spawn('echo hello', 'echo world')
	.then(function(code) {
		expect(code).to.equal(0)
		//to access out/err datas use
		console.log(this.data.out, this.data.err)
		//with this example, this.data.out will look like this:
		expect(this.data.out).to.eql(['out: hello', 'out: world'])
	})
```

### Basic failing command example

```javascript
var spawner = new Spawner()

spawner
	.spawn('exit 1', 'this will not be executed!')
	.catch(function(code) {
		console.log('Script failed with code ', code)
	})
```

### Modifiers and streaming

```javascript
var modifiers = {
	out: function(d) { return d },
	err: 'this is an error: '
}

var spawner = new Spawner(modifiers)

//spawner gives you global streams from spawned stdout and stderr
spawner.out.pipe(stdout)
spawner.err.pipe(stdout)

spawner
	//this will print "hello\n world\n err\n done\n" to the stdout
	.spawn(['echo hello', 'echo world'], 'echo err >&2', ['sleep 0', 'echo done && exit 0'])
	.then(function(code) {
		exepect(this.data.err[0]).to.equal('err')

		return spawner.spawn('echo next')
	})
	.then(function(code) {
		expect(this.data.out[0]).to.equal('next')
	})
```

## API

#### `Spawner(options, spawn_options)`
- options: modifiers: `{out: Function|String, err: Function|String}`
- spawn_options: [http://nodejs.org/api/child_process.html](http://nodejs.org/api/child_process.html)

#### `new Spawner()` 
- spawn: `Function(command, ...)` where `command` can be an Array or a String - returns a `Promise`
- sp: shortcut to spawn
- out: global out stream
- err: global err stream



