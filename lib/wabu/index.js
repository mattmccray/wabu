(function() {
  var BaseFile, Bundle, DEFAULT_OPTIONS, SourceFile, SourceLine, WABU_TEMPLATE, _ref, all_bundles, cs, exec, file_ext, fs, less, merge_objects, path, sys, task_build, task_init, uglify;
  var __hasProp = Object.prototype.hasOwnProperty, __bind = function(func, context) {
    return function(){ return func.apply(context, arguments); };
  }, __extends = function(child, parent) {
    var ctor = function(){};
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    child.prototype.constructor = child;
    if (typeof parent.extended === "function") parent.extended(child);
    child.__super__ = parent.prototype;
  };
  DEFAULT_OPTIONS = {
    enable: true,
    type: 'auto',
    watch: false,
    compress: false,
    quiet: false,
    preserve: false,
    noWrap: false,
    shebang: false
  };
  all_bundles = [];
  fs = require('fs');
  cs = require('coffee-script');
  less = require('less');
  _ref = require('child_process');
  exec = _ref.exec;
  sys = require('sys');
  uglify = require('./uglify');
  path = require('path');
  BaseFile = function(filepath, _arg) {
    var path_info;
    this.options = _arg;
    this.filepath = filepath.trim();
    path_info = this.filepath.split("/");
    this.filename = path_info.pop();
    this.path = path_info.join("/");
    this.ext = file_ext(filepath);
    this.type = (function() {
      if (this.options.type === 'auto') {
        switch (this.ext) {
          case '.js':
            return 'js';
          case '.coffee':
            return 'coffee';
          case '.less':
            return 'less';
          case '.css':
            return 'css';
          default:
            return 'unknown';
        }
      } else {
        return this.options.type;
      }
    }).call(this);
    return this;
  };
  BaseFile.prototype.getPathFor = function(file, leaveExt) {
    var source_file;
    file = file.trim();
    source_file = file[0] === '/' ? file.slice(1) : ("" + (this.path) + "/" + (file));
    if (!(leaveExt)) {
      if (source_file.slice(-(this.ext.length)) !== this.ext) {
        source_file += this.ext;
      }
    }
    return source_file;
  };
  BaseFile.prototype.log = function() {
    if (!(this.options.quiet)) {
      return console.log.apply(console, arguments);
    }
  };
  BaseFile.prototype.dir = function() {
    if (!(this.options.quiet)) {
      return console.dir.apply(console, arguments);
    }
  };
  BaseFile.prototype.err = function() {
    return console.log.apply(console, arguments);
  };
  SourceLine = function(_arg, _arg2) {
    this.file = _arg2;
    this.line = _arg;
    this.type = (function() {
      if (this.line.match(this.requireParser)) {
        return 'require';
      } else if (this.line.match(this.embedParser)) {
        return 'embed';
      } else if (this.line.match(this.base64Parser)) {
        return 'base64';
      } else {
        return 'string';
      }
    }).call(this);
    this.build();
    return this;
  };
  SourceLine.prototype.requireParser = /(\#|\/\/)+\!require (.*)/;
  SourceLine.prototype.embedParser = /([^#|.]*)(#|\/\/)+\!embed\((.*)\)(.*)/;
  SourceLine.prototype.base64Parser = /([^#|.]*)(#|\/\/)+\!base64\((.*)\)(.*)/;
  SourceLine.prototype.build = function() {
    var _ref2, comment, file, match, src;
    switch (this.type) {
      case 'require':
        _ref2 = this.line.match(this.requireParser);
        src = _ref2[0];
        comment = _ref2[1];
        file = _ref2[2];
        path = this.file.getPathFor(file);
        return (this.source_file = SourceFile.findOrCreate(path, this.file.bundle, this.file.options));
      case 'embed':
        match = this.line.match(this.embedParser);
        _ref2 = match;
        src = _ref2[0];
        this.pre = _ref2[1];
        comment = _ref2[2];
        file = _ref2[3];
        this.post = _ref2[4];
        path = this.file.getPathFor(file, true);
        return (this.source_file = SourceFile.findOrCreate(path, this.file.bundle, this.file.options));
      case 'base64':
        _ref2 = this.line.match(this.base64Parser);
        src = _ref2[0];
        comment = _ref2[1];
        file = _ref2[2];
        return (this.source_file = file);
    }
  };
  SourceLine.prototype.toString = function() {
    switch (this.type) {
      case 'require':
        return this.source_file.toString();
      case 'embed':
        return this.source_file.toString(this.pre, this.post);
      case 'base64':
        return '';
      default:
        return this.line;
    }
  };
  SourceFile = function(filepath, _arg, options) {
    var _this;
    this.bundle = _arg;
    _this = this;
    this.watch = function(){ return SourceFile.prototype.watch.apply(_this, arguments); };
    SourceFile.__super__.constructor.call(this, filepath, options);
    this.watched = false;
    this.bundles = [this.bundle];
    this.parse();
    return this;
  };
  __extends(SourceFile, BaseFile);
  SourceFile.prototype.parse = function() {
    var _i, _len, _ref2, contents, line;
    contents = fs.readFileSync(this.filepath, 'utf8');
    delete this.body;
    this.body = [];
    _ref2 = contents.split("\n");
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      line = _ref2[_i];
      this.body.push(new SourceLine(line, this));
    }
    this.log(" : " + (this.filepath));
    this.watch();
    return this;
  };
  SourceFile.prototype.toString = function(pre, post) {
    var _i, _len, _ref2, _result, content, line, lines;
    lines = (function() {
      _result = []; _ref2 = this.body;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        line = _ref2[_i];
        _result.push(line.toString());
      }
      return _result;
    }).call(this);
    content = lines.join("\n");
    return (typeof pre !== "undefined" && pre !== null) ? ("" + (pre) + (content) + (post)) : content;
  };
  SourceFile.prototype.fileChanged = function(curr, prev) {
    var _i, _len, _ref2, _result, bundle, changed_keys, key, value;
    changed_keys = [];
    _ref2 = curr;
    for (key in _ref2) {
      if (!__hasProp.call(_ref2, key)) continue;
      value = _ref2[key];
      if (prev[key] !== curr[key]) {
        changed_keys.push(key);
      }
    }
    if ((function(){ for (var _i=0, _len=changed_keys.length; _i<_len; _i++) { if (changed_keys[_i] === 'size') return true; } return false; }).call(this)) {
      this.parse();
      _result = []; _ref2 = this.bundles;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        bundle = _ref2[_i];
        _result.push((function() {
          try {
            return bundle.build(this.watch);
          } catch (err) {
            this.log("Error building bundle " + (this.bundle.filename));
            this.dir(err);
            return setTimeout(this.watch, 1);
          }
        }).call(this));
      }
      return _result;
    } else {
      return setTimeout(this.watch, 1);
    }
  };
  SourceFile.prototype.watch = function() {
    if (!this.options.watch || this.watched) {
      return null;
    }
    fs.watchFile(this.filepath, {
      persistent: true,
      interval: 1000
    }, __bind(function(curr, prev) {
      fs.unwatchFile(this.filepath);
      this.watched = false;
      try {
        return this.fileChanged(curr, prev);
      } catch (err) {
        this.log(err);
        return null;
      }
    }, this));
    return (this.watched = true);
  };
  SourceFile.cache = {};
  SourceFile.findOrCreate = function(filepath, _arg, options) {
    var _i, _len, _ref2, _ref3, source_file;
    this.bundle = _arg;
    if (filepath in SourceFile.cache) {
      source_file = SourceFile.cache[filepath];
      if (!((function(){ (_ref2 = this.bundle); for (var _i=0, _len=(_ref3 = source_file.bundles).length; _i<_len; _i++) { if (_ref3[_i] === _ref2) return true; } return false; }).call(this))) {
        source_file.bundles.push(this.bundle);
      }
      return source_file;
    } else {
      source_file = new SourceFile(filepath, this.bundle, options);
      SourceFile.cache[filepath] = source_file;
      return source_file;
    }
  };
  Bundle = function(filepath, sourcelist, options) {
    var _i, _len, _ref2, _this, source;
    _this = this;
    this.file_done = function(){ return Bundle.prototype.file_done.apply(_this, arguments); };
    this.file_error = function(){ return Bundle.prototype.file_error.apply(_this, arguments); };
    this.file_save = function(){ return Bundle.prototype.file_save.apply(_this, arguments); };
    this.file_preserve = function(){ return Bundle.prototype.file_preserve.apply(_this, arguments); };
    this.file_compress = function(){ return Bundle.prototype.file_compress.apply(_this, arguments); };
    this.file_compile = function(){ return Bundle.prototype.file_compile.apply(_this, arguments); };
    this.file_assemble = function(){ return Bundle.prototype.file_assemble.apply(_this, arguments); };
    Bundle.__super__.constructor.call(this, filepath, options);
    this.type = (function() {
      if (this.options.type === 'auto') {
        switch (this.ext) {
          case '.js':
          case '.coffee':
            return 'coffee';
          case '.css':
          case '.less':
            return 'less';
          default:
            return 'unknown';
        }
      } else {
        return this.options.type;
      }
    }).call(this);
    this.sourcelist = typeof sourcelist === 'string' ? [sourcelist] : sourcelist;
    this.sources = [];
    _ref2 = this.sourcelist;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      source = _ref2[_i];
      this.sources.push(SourceFile.findOrCreate(source, this, this.options));
    }
    return this;
  };
  __extends(Bundle, BaseFile);
  Bundle.prototype.file_assemble = function(sources, cb) {
    var _i, _len, _ref2, source, source_tar;
    source_tar = "";
    _ref2 = sources;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      source = _ref2[_i];
      source_tar += source.toString() + "\n";
    }
    return this.file_compile(source_tar, cb);
  };
  Bundle.prototype.file_compile = function(source, cb) {
    var compiled;
    if (this.type === 'less') {
      this.file_preserve(this.filepath.replace(this.ext, "." + (this.type)), source, cb);
      less.render(source, {
        compress: this.options.compress,
        optimization: 1
      }, __bind(function(err, css) {
        return (typeof err !== "undefined" && err !== null) ? this.file_error(" ^ " + (err.message) + "\n   " + (err.extract.join('\n    ')), cb) : this.file_save(css, cb);
      }, this));
    }
    if (this.type === 'coffee') {
      this.file_preserve(this.filepath.replace(this.ext, "." + (this.type)), source, cb);
      try {
        compiled = cs.compile(source, {
          noWrap: this.options.noWrap
        });
        return this.file_compress(compiled, cb);
      } catch (err) {
        return this.file_error(" ^ " + (err), cb);
      }
    } else {
      return this.file_compress(source, cb);
    }
  };
  Bundle.prototype.file_compress = function(source, cb) {
    var compressed;
    if (this.options.compress) {
      if (this.type === 'coffee' || this.type === 'js') {
        try {
          compressed = uglify.compress_js(source);
          return this.file_save(compressed, cb);
        } catch (err) {
          this.file_error(" ^ " + (err.message) + " (while compressing)\n   " + (err.stack.split('\n').join('\n    ')), function() {});
          return this.file_save(source, cb);
        }
      } else {
        return this.file_save(source, cb);
      }
    } else {
      return this.file_save(source, cb);
    }
  };
  Bundle.prototype.file_preserve = function(filename, content, cb) {
    if (this.options.preserve) {
      fs.writeFileSync(filename, content);
      return this.log(filename);
    }
  };
  Bundle.prototype.file_save = function(content, cb) {
    var updated_content;
    updated_content = this.options.shebang ? this.options.shebang + "\n\n" + content : content;
    fs.writeFileSync(this.filepath, updated_content);
    return this.file_done(cb);
  };
  Bundle.prototype.file_error = function(msg, cb) {
    this.err(this.filepath);
    this.err(" ^ " + (msg));
    return cb();
  };
  Bundle.prototype.file_done = function(cb) {
    this.log(this.filepath);
    return cb();
  };
  Bundle.prototype.build = function(callback) {
    if (!(this.options.enable)) {
      return null;
    }
    this.file_assemble(this.sources, callback || function() {});
    return this;
  };
  file_ext = function(filename) {
    return "." + filename.split('.').pop();
  };
  merge_objects = function(a, b) {
    var _ref2, c, key, value;
    c = {};
    _ref2 = a;
    for (key in _ref2) {
      if (!__hasProp.call(_ref2, key)) continue;
      value = _ref2[key];
      c[key] = value;
    }
    _ref2 = b;
    for (key in _ref2) {
      if (!__hasProp.call(_ref2, key)) continue;
      value = _ref2[key];
      if (typeof value === "object") {
        c[key] = merge_objects(c[key], value);
      } else {
        c[key] = value;
      }
    }
    return c;
  };
  exports.task_build = (task_build = function(options) {
    var _i, _len, _ref2, _result, bundle, bundle_objs, def, key, value;
    _ref2 = DEFAULT_OPTIONS;
    for (key in _ref2) {
      if (!__hasProp.call(_ref2, key)) continue;
      value = _ref2[key];
      if (!(key in options)) {
        options[key] = value;
      }
    }
    bundle_objs = [];
    _ref2 = all_bundles;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      def = _ref2[_i];
      bundle_objs.push(new Bundle(def.output, def.source, merge_objects(options, def.options)));
    }
    _result = []; _ref2 = bundle_objs;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      bundle = _ref2[_i];
      _result.push(bundle.build());
    }
    return _result;
  });
  exports.task_init = (task_init = function(options) {
    return path.exists('Cakefile', function(exists) {
      var contents;
      if (exists) {
        contents = fs.readFileSync('Cakefile', 'utf8');
        contents += WABU_TEMPLATE;
        fs.writeFileSync('Cakefile', contents, 'utf8');
      } else {
        fs.writeFileSync('Cakefile', WABU_TEMPLATE, 'utf8');
      }
      return sys.puts("Done. (see Cakefile for examples)");
    });
  });
  global.bundle = (exports.bundle = function(output, opts) {
    var _ref2;
    if (!(typeof (_ref2 = opts.source) !== "undefined" && _ref2 !== null)) {
      throw new Error("(" + (output) + ") You must specify at least one source: to a bundle!");
    }
    all_bundles.push({
      output: output,
      source: opts.source,
      options: opts
    });
    return true;
  });
  global.default_options = (exports.default_options = function(options) {
    var _ref2, key, value;
    _ref2 = options;
    for (key in _ref2) {
      if (!__hasProp.call(_ref2, key)) continue;
      value = _ref2[key];
      DEFAULT_OPTIONS[key] = value;
    }
    return DEFAULT_OPTIONS;
  });
  WABU_TEMPLATE = "\nrequire 'wabu/tasks' unless bundle?\n\n# You can specify default options for all bundles here\n#default_options \n#  preserve: yes\n\n# bundle \"lib/wabu.js\",\n#   source: \"src/wabu.coffee\"\n#   preserve: yes\n#   enable: yes\n\n \n# bundle \"lib/wabu/cake.js\",\n#   source: \"src/wabu/cake.coffee\"\n#   enable: yes\n\n# bundle \"lib/wabu/cli.js\",\n#   source: \"src/wabu/cli.coffee\"\n#   enable: yes\n\n# bundle \"lib/wabu/test.js\",\n#   source: [\n#     \"src/wabu/source_file.coffee\"\n#     \"src/wabu/source_line.coffee\"\n#   ]\n#   enable: yes\n";
}).call(this);
