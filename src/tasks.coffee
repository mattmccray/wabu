throw "Meant for inclusion in your Cakefile!" unless option?

cake = require './cake' unless option?
unless wabu?
  try
    wabu = require '../wabu'
  catch ex
    try
      wabu = require './wabu'
    catch ex
      wabu = require 'wabu'


option '-w', '--watch',      'Watch files for change and automatically recompile'
option '-c', '--compress',   'Compress files'
option '-q', '--quiet',      'Suppress STDOUT messages'
option '-p', '--preserve',   'Saves assembled source files'

global.task_build = wabu.task_build
global.task_init = wabu.task_init

task 'build', "Assembles and compiles all sources files", (opts) ->
  task_build(opts)

# task 'init', "Assembles and compiles all sources files", (opts) ->
#   wabu.task_init(opts)
