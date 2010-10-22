
DEFAULT_OPTIONS=
  enable: yes
  type: 'auto'
  watch: no
  compress: no
  quiet: no
  preserve: no
  noWrap: no
  shebang: no

all_bundles= []

fs     = require 'fs'
cs     = require 'coffee-script'
less   = require 'less'
{exec} = require 'child_process'
sys    = require 'sys'
uglify = require './uglify'
path   = require 'path'

class BaseFile
  constructor: (filepath, @options)->
    @filepath = filepath.trim()
    path_info = @filepath.split("/")
    @filename = path_info.pop()
    @path = path_info.join("/")
    @ext = file_ext filepath
    @type = if @options.type == 'auto'
      switch @ext
        when '.js' then 'js'
        when '.coffee' then 'coffee'
        when '.less' then 'less'
        when '.css' then 'css'
        else 'unknown'
    else
      @options.type

  getPathFor: (file, leaveExt)->
    file = file.trim()
    source_file = if file[0] == '/' then file[1..] else "#{@path}/#{file}"
    unless leaveExt
      source_file += @ext unless source_file[-(@ext.length)..] == @ext
    source_file

  log: ->
    console.log( arguments... ) unless @options.quiet

  dir: ->
    console.dir( arguments... ) unless @options.quiet

  err: ->
    console.log( arguments... )


class SourceLine
  requireParser: /(\#|\/\/)+\!require (.*)/
  embedParser: /([^#|.]*)(#|\/\/)+\!embed\((.*)\)(.*)/
  base64Parser: /([^#|.]*)(#|\/\/)+\!base64\((.*)\)(.*)/

  constructor: (@line, @file) ->
    @type = if @line.match(@requireParser)
      'require'
    else if @line.match(@embedParser)
      'embed'
    else if @line.match(@base64Parser)
      'base64'
    else
      'string'
    @build()

  build: ->
    switch @type
      when 'require'
        [src, comment, file] = @line.match(@requireParser)
        path = @file.getPathFor(file)
        @source_file = SourceFile.findOrCreate path, @file.bundle, @file.options

      when 'embed'
        match = @line.match(@embedParser)
        [src, @pre, comment, file, @post] = match
        path = @file.getPathFor(file, yes)
        @source_file = SourceFile.findOrCreate path, @file.bundle, @file.options

      when 'base64'
        [src, comment, file] = @line.match(@base64Parser)
        @source_file = file

  toString: ->
    switch @type
      when 'require' then  @source_file.toString()
      when 'embed' then @source_file.toString(@pre, @post)
      when 'base64' then ''
      else @line


class SourceFile extends BaseFile
  constructor: (filepath, @bundle, options) ->
    super filepath, options
    @watched= no
    @bundles= [@bundle]
    @parse()

  parse: ->
    contents = fs.readFileSync @filepath, 'utf8'
    delete @body
    @body = []

    for line in contents.split "\n"
      @body.push( new SourceLine( line, this ) )

    @log " : #{@filepath}"
    @watch()
    this

  toString: (pre, post)->
    lines = line.toString() for line in @body
    content = lines.join "\n"
    if pre?
      "#{pre}#{content}#{post}"
    else
      content

  fileChanged: (curr, prev)->
    changed_keys = []
    for key, value of curr
      changed_keys.push key if prev[key] != curr[key]
    if 'size' in changed_keys
      @parse()
      for bundle in @bundles
        try
          bundle.build(@watch)
        catch err
          @log "Error building bundle #{@bundle.filename}"
          @dir err
          setTimeout @watch, 1
    else
      setTimeout @watch, 1

  watch: =>
    return if not @options.watch or @watched
    fs.watchFile @filepath, persistent:true, interval:1000, (curr, prev) =>
      fs.unwatchFile @filepath
      @watched= no
      try
        @fileChanged(curr, prev)
      catch err
        @log err
        null
    @watched= yes

  @cache: {}

  @findOrCreate: (filepath, @bundle, options) ->
    if filepath of SourceFile.cache
      source_file = SourceFile.cache[filepath]
      source_file.bundles.push(@bundle) unless @bundle in source_file.bundles
      source_file
    else
      source_file = new SourceFile filepath, @bundle, options
      SourceFile.cache[filepath] = source_file
      source_file


class Bundle extends BaseFile

  constructor: (filepath, sourcelist, options) ->
    super filepath, options
    # Be a bit smarter about this, at some point... (based on sourcelist)
    @type = if @options.type == 'auto'
      switch @ext
        when '.js', '.coffee' then 'coffee'
        when '.css', '.less' then 'less'
        else 'unknown'
    else
      @options.type
    @sourcelist = if typeof sourcelist == 'string' then [ sourcelist ] else sourcelist
    @sources = []
    for source in @sourcelist
      @sources.push SourceFile.findOrCreate source, this, @options 


  file_assemble: (sources, cb) =>
    source_tar = ""
    for source in sources
      source_tar += source.toString() +"\n"
    @file_compile source_tar, cb
    
  file_compile: (source, cb)=>

    if @type == 'less'
      @file_preserve @filepath.replace(@ext, ".#{@type}"), source, cb
      less.render source, {compress: @options.compress, optimization: 1}, (err, css) =>
        if err?
          @file_error " ^ #{err.message}\n   #{err.extract.join('\n    ')}" , cb
        else
          @file_save css, cb

    if @type == 'coffee'
      @file_preserve @filepath.replace(@ext, ".#{@type}"), source, cb
      try
        compiled = cs.compile source, noWrap:@options.noWrap
        @file_compress compiled, cb
      catch err
        @file_error " ^ #{err}", cb

    else
      @file_compress source, cb

  file_compress: (source, cb)=>

    if @options.compress
      if @type == 'coffee' or @type == 'js'
        try
          compressed = uglify.compress_js source
          @file_save compressed, cb
        catch err
          @file_error " ^ #{err.message} (while compressing)\n   #{err.stack.split('\n').join('\n    ')}", ->
          @file_save source, cb
          
      else
        @file_save source, cb

    else
      @file_save source, cb
    

  file_preserve: (filename, content, cb)=>
    if @options.preserve
      fs.writeFileSync filename, content
      @log filename
    
  file_save: (content, cb)=>
    updated_content = if @options.shebang then @options.shebang +"\n\n"+ content else content
    fs.writeFileSync @filepath, updated_content
    @file_done(cb)

  file_error: (msg, cb)=>
    @err @filepath
    @err " ^ #{msg}"
    cb()
  
  file_done: (cb)=>
    @log @filepath
    cb()

  build: (callback)->
    return unless @options.enable
    @file_assemble(@sources, (callback || ->))
    this

file_ext= (filename) ->
  "."+ filename.split('.').pop()

merge_objects= (a, b)->
  c = {}
  for key, value of a
    c[key] = value

  for key, value of b
    if typeof value == "object"
      c[key] = merge_objects(c[key], value)
    else
      c[key] = value
  c

exports.task_build = task_build= (options)->
  # Assign default options, where applicable
  for key, value of DEFAULT_OPTIONS
    options[key] = value unless key of options

  bundle_objs = []
  bundle_objs.push( new Bundle def.output, def.source, merge_objects(options, def.options) ) for def in all_bundles
  bundle.build() for bundle in bundle_objs

exports.task_init = task_init= (options)->
  path.exists 'Cakefile', (exists) ->
    if exists
      contents = fs.readFileSync 'Cakefile', 'utf8'
      contents += WABU_TEMPLATE
      fs.writeFileSync 'Cakefile', contents, 'utf8'
    else
      fs.writeFileSync 'Cakefile', WABU_TEMPLATE, 'utf8'
    sys.puts "Done. (see Cakefile for examples)"

global.bundle = exports.bundle= (output, opts)->
  throw new Error("(#{output}) You must specify at least one source: to a bundle!") unless opts.source?
  all_bundles.push output:output, source:opts.source, options:opts
  yes

global.default_options = exports.default_options= (options)->
  for key, value of options
    DEFAULT_OPTIONS[key] = value
  DEFAULT_OPTIONS


WABU_TEMPLATE="""

require 'wabu' unless bundle?

#default_options preserve: yes

# bundle "lib/wabu.js",
#   source: "src/wabu.coffee"
#   preserve: yes
#   enable: yes

 
# bundle "lib/wabu/cake.js",
#   source: "src/wabu/cake.coffee"
#   enable: yes

# bundle "lib/wabu/cli.js",
#   source: "src/wabu/cli.coffee"
#   enable: yes

# bundle "lib/wabu/test.js",
#   source: [
#     "src/wabu/source_file.coffee"
#     "src/wabu/source_line.coffee"
#   ]
#   enable: yes

"""
