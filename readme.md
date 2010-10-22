# Web App Bundler Utility

By M@ McCray, based on [http://gist.github.com/637154](http://gist.github.com/637154)

---

I built this for how I like to work, so YMMV.

## Installation

    npm install wabu

## Overview

WABU is built on top of Cake. Once your `Cakefile` is setup correctly, you can use either the supplied `wabu` or stock `cake` commands to build your web app bundles.


## Bundles?

Bundles are a collection of multiple source files, all jammed together into a single distribution file.

There are two main kinds of bundle types, at this point. JavaScript, and CSS. JavaScript bundles can automatically compile CoffeeScript, and allow you to `require` other files to be inlined. For CSS bundles, the same is available using LESS.

In your source files you have access to some macros that wabu will use when compiling.

* **require [path]** -- Will include the contents of the file at `path`.
* **embed([path])** -- Will include the contents of the file at `path`, wrapping them in whatever other text was found on the calling line.

In a CoffeeScript file, it might look like this:

    #!require backbone
    
    class MyView extends View
      @VIEW: """#!embed(templates/my-view.html)"""

      constructor: ->
        super
        @template = _.template(MyView.VIEW)
      
      render: ->
        $(@el).html @template( @model.toJSON() )
      


## Cakefile

Before you can build your bundles, you need to setup your `Cakefile`. If you run `wabu init` it will create (or append to) a `Cakefile` the necessary code and some examples. Which looks ike this:

    require 'wabu/tasks' unless bundle?
    
    # You can specify default options for all bundles here
    # default_options 
    #   preserve: yes
    
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
    
    # bundle "lib/wabu/extra.js",
    #   source: [
    #     "src/wabu/source_file.coffee"
    #     "src/wabu/source_line.coffee"
    #   ]
    #   enable: yes

It will add the `build` task and two functions (`bundle` and `default_options`) to the `global` context (which is normally not good, but for a build script it's fine).

## Defining Bundles

As you can tell for the aforementioned Cakefile examples, you define bundles by calling the `bundle` function:

    bundle(output_filename, options)`

The support options are:

* `source: [PATH]` - [**REQUIRED**] - File(s) to include in the bundle. Can be a single file, or array.
* `enable: yes|no` - Ignores any bundle marked 'no.' Default: no
* `type: 'auto|js|css|coffee|less'` - Determines if source files need to be compiled. Default: 'auto'
* `compress: yes|no` - Default: no
* `preserve: yes|no` - If `yes`, it will save a copy of the assembled file before compiling it. Default: no
* `noWrap: yes|no` - For CoffeeScript. Setting to `yes` prevents the wrapping closure. Default: no
* `shebang: no|[STRING]` -- If a shebang is defined, it will automatically add to the top of the file. Default: no

## Building Bundles

You can build your bundle(s) from the command line like this:

    wabu build

Or like this:

    cake build

You can override the bundle options by setting some flags:

    wabu --compress --preserve build

Available options:

    -w, --watch        Watch files for change and automatically recompile
    -c, --compress     Compress files
    -q, --quiet        Suppress STDOUT messages
    -p, --preserve     Saves assembled source files

