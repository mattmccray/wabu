
cake = require "../lib/wabu/cake"
wabu = require "../lib/wabu"
tasks = require "../lib/wabu/tasks"

task 'init', "Assembles and compiles all sources files", (opts) ->
  task_init(opts)


cake.run('wabu', yes)

