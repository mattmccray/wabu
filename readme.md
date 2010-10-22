# Web App Bundler Utility

By M@ McCray, based on [http://gist.github.com/637154](http://gist.github.com/637154)

---

I built this for how I like to work, so YMMV.

This script defines one task: `build`. It will assemble multiple .coffee (or .less)
files and compile them into a single .js (or .css) file. There are two main ways
you can use it. Define the target and list all the source files to assemble into
it. Or you can add special comments in your source that it will look for and 
automatically load (and keep track of, if using --watch). Example:

    #!require utils

This will load, and optionally watch for changes to, a utils.coffee file located in the
same directory as the source file.
