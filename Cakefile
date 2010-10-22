unless bundle?
  try
    require './src/tasks'
  catch err
    require 'wabu'


bundle "lib/wabu/index.js",
  source: "src/wabu.coffee"
  compress: yes

bundle "lib/wabu/cake.js",
  source: "src/cake.coffee"
  compress: yes

bundle "lib/wabu/tasks.js",
  source: "src/tasks.coffee"
  compress: yes

bundle "bin/wabu",
  type: 'coffee'
  source: "src/cli.coffee"
  noWrap: yes
  shebang: "#!/usr/bin/env node"

bundle "lib/wabu/uglify.js",
  type: 'js'
  source: "src/uglify.js"
  compress: yes
