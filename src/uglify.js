/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.

  This version is suitable for Node.js.  With minimal changes (the
  exports stuff) it should work on any JS platform.

  This file contains the tokenizer/parser.  It is a port to JavaScript
  of parse-js [1], a JavaScript parser library written in Common Lisp
  by Marijn Haverbeke.  Thank you Marijn!

  [1] http://marijn.haverbeke.nl/parse-js/

  Exported functions:

    - tokenizer(code) -- returns a function.  Call the returned
      function to fetch the next token.

    - parse(code) -- returns an AST of the given JavaScript code.

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the same terms as the original code (ZLIB license):

    Copyright 2010 (c) Mihai Bazon <mihai.bazon@gmail.com>
    Based on parse-js (http://marijn.haverbeke.nl/parse-js/).

    This software is provided 'as-is', without any express or implied
    warranty. In no event will the authors be held liable for any
    damages arising from the use of this software.

    Permission is granted to anyone to use this software for any
    purpose, including commercial applications, and to alter it and
    redistribute it freely, subject to the following restrictions:

    1. The origin of this software must not be misrepresented; you must
       not claim that you wrote the original software. If you use this
       software in a product, an acknowledgment in the product
       documentation would be appreciated but is not required.

    2. Altered source versions must be plainly marked as such, and must
       not be misrepresented as being the original software.

    3. This notice may not be removed or altered from any source
       distribution.

 ***********************************************************************/

/* -----[ Tokenizer (constants) ]----- */

var KEYWORDS = array_to_hash([
        "break",
        "case",
        "catch",
        "const",
        "continue",
        "default",
        "delete",
        "do",
        "else",
        "finally",
        "for",
        "function",
        "if",
        "in",
        "instanceof",
        "new",
        "return",
        "switch",
        "throw",
        "try",
        "typeof",
        "var",
        "void",
        "while",
        "with"
]);

var RESERVED_WORDS = array_to_hash([
        "abstract",
        "boolean",
        "byte",
        "char",
        "class",
        "debugger",
        "double",
        "enum",
        "export",
        "extends",
        "final",
        "float",
        "goto",
        "implements",
        "import",
        "int",
        "interface",
        "long",
        "native",
        "package",
        "private",
        "protected",
        "public",
        "short",
        "static",
        "super",
        "synchronized",
        "throws",
        "transient",
        "volatile"
]);

var KEYWORDS_BEFORE_EXPRESSION = array_to_hash([
        "return",
        "new",
        "delete",
        "throw",
        "else"
]);

var KEYWORDS_ATOM = array_to_hash([
        "false",
        "null",
        "true",
        "undefined"
]);

var OPERATOR_CHARS = array_to_hash(characters("+-*&%=<>!?|~^"));

var RE_HEX_NUMBER = /^0x[0-9a-f]+$/i;
var RE_OCT_NUMBER = /^0[0-7]+$/;
var RE_DEC_NUMBER = /^\d*\.?\d*(?:e[+-]?\d*(?:\d\.?|\.?\d)\d*)?$/i;

var OPERATORS = array_to_hash([
        "in",
        "instanceof",
        "typeof",
        "new",
        "void",
        "delete",
        "++",
        "--",
        "+",
        "-",
        "!",
        "~",
        "&",
        "|",
        "^",
        "*",
        "/",
        "%",
        ">>",
        "<<",
        ">>>",
        "<",
        ">",
        "<=",
        ">=",
        "==",
        "===",
        "!=",
        "!==",
        "?",
        "=",
        "+=",
        "-=",
        "/=",
        "*=",
        "%=",
        ">>=",
        "<<=",
        ">>>=",
        "~=",
        "%=",
        "|=",
        "^=",
        "&=",
        "&&",
        "||"
]);

var WHITESPACE_CHARS = array_to_hash(characters(" \n\r\t"));

var PUNC_BEFORE_EXPRESSION = array_to_hash(characters("[{}(,.;:"));

var PUNC_CHARS = array_to_hash(characters("[]{}(),;:"));

var REGEXP_MODIFIERS = array_to_hash(characters("gmsiy"));

/* -----[ Tokenizer ]----- */

function is_alphanumeric_char(ch) {
        ch = ch.charCodeAt(0);
        return (ch >= 48 && ch <= 57) ||
                (ch >= 65 && ch <= 90) ||
                (ch >= 97 && ch <= 122);
};

function is_identifier_char(ch) {
        return is_alphanumeric_char(ch) || ch == "$" || ch == "_";
};

function is_digit(ch) {
        ch = ch.charCodeAt(0);
        return ch >= 48 && ch <= 57;
};

function parse_js_number(num) {
        if (RE_HEX_NUMBER.test(num)) {
                return parseInt(num.substr(2), 16);
        } else if (RE_OCT_NUMBER.test(num)) {
                return parseInt(num.substr(1), 8);
        } else if (RE_DEC_NUMBER.test(num)) {
                return parseFloat(num);
        }
};

function JS_Parse_Error(message, line, col, pos) {
        this.message = message;
        this.line = line;
        this.col = col;
        this.pos = pos;
        try {
                ({})();
        } catch(ex) {
                this.stack = ex.stack;
        };
};

JS_Parse_Error.prototype.toString = function() {
        return this.message + " (line: " + this.line + ", col: " + this.col + ", pos: " + this.pos + ")" + "\n\n" + this.stack;
};

function js_error(message, line, col, pos) {
        throw new JS_Parse_Error(message, line, col, pos);
};

function is_token(token, type, val) {
        return token.type == type && (val == null || token.value == val);
};

var EX_EOF = {};

function tokenizer($TEXT, skip_comments) {

        var S = {
                text           : $TEXT.replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, ''),
                pos            : 0,
                tokpos         : 0,
                line           : 0,
                tokline        : 0,
                col            : 0,
                tokcol         : 0,
                newline_before : false,
                regex_allowed  : false
        };

        function peek() { return S.text.charAt(S.pos); };

        function next(signal_eof) {
                var ch = S.text.charAt(S.pos++);
                if (signal_eof && !ch)
                        throw EX_EOF;
                if (ch == "\n") {
                        S.newline_before = true;
                        ++S.line;
                        S.col = 0;
                } else {
                        ++S.col;
                }
                return ch;
        };

        function eof() {
                return !S.peek();
        };

        function find(what, signal_eof) {
                var pos = S.text.indexOf(what, S.pos);
                if (signal_eof && pos == -1) throw EX_EOF;
                return pos;
        };

        function start_token() {
                S.tokline = S.line;
                S.tokcol = S.col;
                S.tokpos = S.pos;
        };

        function token(type, value) {
                S.regex_allowed = ((type == "operator" && !HOP(UNARY_POSTFIX, value)) ||
                                   (type == "keyword" && HOP(KEYWORDS_BEFORE_EXPRESSION, value)) ||
                                   (type == "punc" && HOP(PUNC_BEFORE_EXPRESSION, value)));
                var ret = {
                        type  : type,
                        value : value,
                        line  : S.tokline,
                        col   : S.tokcol,
                        pos   : S.tokpos,
                        nlb   : S.newline_before
                };
                S.newline_before = false;
                return ret;
        };

        function skip_whitespace() {
                while (HOP(WHITESPACE_CHARS, peek()))
                        next();
        };

        function read_while(pred) {
                var ret = "", ch = peek(), i = 0;
                while (ch && pred(ch, i++)) {
                        ret += next();
                        ch = peek();
                }
                return ret;
        };

        function parse_error(err) {
                js_error(err, S.tokline, S.tokcol, S.tokpos);
        };

        function read_num(prefix) {
                var has_e = false, after_e = false, has_x = false;
                var num = read_while(function(ch, i){
                        if (ch == "x" || ch == "X") {
                                if (has_x) return false;
                                return has_x = true;
                        }
                        if (!has_x && (ch == "E" || ch == "e")) {
                                if (has_e) return false;
                                return has_e = after_e = true;
                        }
                        if (ch == "-") {
                                if (after_e || (i == 0 && !prefix)) return true;
                                return false;
                        }
                        if (ch == "+") return after_e;
                        after_e = false;
                        return is_alphanumeric_char(ch) || ch == ".";
                });
                if (prefix)
                        num = prefix + num;
                var valid = parse_js_number(num);
                if (!isNaN(valid)) {
                        return token("num", valid);
                } else {
                        parse_error("Invalid syntax: " + num);
                }
        };

        function read_escaped_char() {
                var ch = next(true);
                switch (ch) {
                    case "n" : return "\n";
                    case "r" : return "\r";
                    case "t" : return "\t";
                    case "b" : return "\b";
                    case "v" : return "\v";
                    case "f" : return "\f";
                    case "0" : return "\0";
                    case "x" : return String.fromCharCode(hex_bytes(2));
                    case "u" : return String.fromCharCode(hex_bytes(4));
                    default  : return ch;
                }
        };

        function hex_bytes(n) {
                var num = 0;
                for (; n > 0; --n) {
                        var digit = parseInt(next(true), 16);
                        if (isNaN(digit))
                                parse_error("Invalid hex-character pattern in string");
                        num = (num << 4) | digit;
                }
                return num;
        };

        function read_string() {
                return with_eof_error("Unterminated string constant", function(){
                        var quote = next(), ret = "";
                        for (;;) {
                                var ch = next(true);
                                if (ch == "\\") ch = read_escaped_char();
                                else if (ch == quote) break;
                                ret += ch;
                        }
                        return token("string", ret);
                });
        };

        function read_line_comment() {
                next();
                var i = find("\n"), ret;
                if (i == -1) {
                        ret = S.text.substr(S.pos);
                        S.pos = S.text.length;
                } else {
                        ret = S.text.substring(S.pos, i);
                        S.pos = i;
                }
                return token("comment1", ret);
        };

        function read_multiline_comment() {
                next();
                return with_eof_error("Unterminated multiline comment", function(){
                        var i = find("*/", true),
                            text = S.text.substring(S.pos, i),
                            tok = token("comment2", text);
                        S.pos = i + 2;
                        S.newline_before = text.indexOf("\n") >= 0;
                        return tok;
                });
        };

        function read_regexp() {
                return with_eof_error("Unterminated regular expression", function(){
                        var prev_backslash = false, regexp = "", ch, in_class = false;
                        while ((ch = next(true))) if (prev_backslash) {
                                regexp += "\\" + ch;
                                prev_backslash = false;
                        } else if (ch == "[") {
                                in_class = true;
                                regexp += ch;
                        } else if (ch == "]" && in_class) {
                                in_class = false;
                                regexp += ch;
                        } else if (ch == "/" && !in_class) {
                                break;
                        } else if (ch == "\\") {
                                prev_backslash = true;
                        } else {
                                regexp += ch;
                        }
                        var mods = read_while(function(ch){
                                return HOP(REGEXP_MODIFIERS, ch);
                        });
                        return token("regexp", [ regexp, mods ]);
                });
        };

        function read_operator(prefix) {
                function grow(op) {
                        var bigger = op + peek();
                        if (HOP(OPERATORS, bigger)) {
                                next();
                                return grow(bigger);
                        } else {
                                return op;
                        }
                };
                return token("operator", grow(prefix || next()));
        };

        var handle_slash = skip_comments ? function() {
                next();
                switch (peek()) {
                    case "/": read_line_comment(); return next_token();
                    case "*": read_multiline_comment(); return next_token();
                }
                return S.regex_allowed ? read_regexp() : read_operator("/");
        } : function() {
                next();
                switch (peek()) {
                    case "/": return read_line_comment();
                    case "*": return read_multiline_comment();
                }
                return S.regex_allowed ? read_regexp() : read_operator("/");
        };

        function handle_dot() {
                next();
                return is_digit(peek())
                        ? read_num(".")
                        : token("punc", ".");
        };

        function read_word() {
                var word = read_while(is_identifier_char);
                return !HOP(KEYWORDS, word)
                        ? token("name", word)
                        : HOP(OPERATORS, word)
                        ? token("operator", word)
                        : HOP(KEYWORDS_ATOM, word)
                        ? token("atom", word)
                        : token("keyword", word);
        };

        function with_eof_error(eof_error, cont) {
                try {
                        return cont();
                } catch(ex) {
                        if (ex === EX_EOF) parse_error(eof_error);
                        else throw ex;
                }
        };

        function next_token(force_regexp) {
                if (force_regexp)
                        return read_regexp();
                skip_whitespace();
                start_token();
                var ch = peek();
                if (!ch) return token("eof");
                if (is_digit(ch)) return read_num();
                if (ch == '"' || ch == "'") return read_string();
                if (HOP(PUNC_CHARS, ch)) return token("punc", next());
                if (ch == ".") return handle_dot();
                if (ch == "/") return handle_slash();
                if (HOP(OPERATOR_CHARS, ch)) return read_operator();
                if (is_identifier_char(ch)) return read_word();
                parse_error("Unexpected character '" + ch + "'");
        };

        next_token.context = function(nc) {
                if (nc) S = nc;
                return S;
        };

        return next_token;

};

/* -----[ Parser (constants) ]----- */

var UNARY_PREFIX = array_to_hash([
        "typeof",
        "void",
        "delete",
        "--",
        "++",
        "!",
        "~",
        "-",
        "+"
]);

var UNARY_POSTFIX = array_to_hash([ "--", "++" ]);

var ASSIGNMENT = (function(a, ret, i){
        while (i < a.length) {
                ret[a[i]] = a[i].substr(0, a[i].length - 1);
                i++;
        }
        return ret;
})(
        ["+=", "-=", "/=", "*=", "%=", ">>=", "<<=", ">>>=", "~=", "%=", "|=", "^=", "&="],
        { "=": true },
        0
);

var PRECEDENCE = (function(a, ret){
        for (var i = 0, n = 1; i < a.length; ++i, ++n) {
                var b = a[i];
                for (var j = 0; j < b.length; ++j) {
                        ret[b[j]] = n;
                }
        }
        return ret;
})(
        [
                ["||"],
                ["&&"],
                ["|"],
                ["^"],
                ["&"],
                ["==", "===", "!=", "!=="],
                ["<", ">", "<=", ">=", "in", "instanceof"],
                [">>", "<<", ">>>"],
                ["+", "-"],
                ["*", "/", "%"]
        ],
        {}
);

var STATEMENTS_WITH_LABELS = array_to_hash([ "for", "do", "while", "switch" ]);

var ATOMIC_START_TOKEN = array_to_hash([ "atom", "num", "string", "regexp", "name" ]);

/* -----[ Parser ]----- */

function NodeWithToken(str, start, end) {
        this.name = str;
        this.start = start;
        this.end = end;
};

NodeWithToken.prototype.toString = function() { return this.name; };

function parse($TEXT, strict_mode, embed_tokens) {

        var S = {
                input: tokenizer($TEXT, true),
                token: null,
                prev: null,
                peeked: null,
                in_function: 0,
                in_loop: 0,
                labels: []
        };

        S.token = next();

        function is(type, value) {
                return is_token(S.token, type, value);
        };

        function peek() { return S.peeked || (S.peeked = S.input()); };

        function next() {
                S.prev = S.token;
                if (S.peeked) {
                        S.token = S.peeked;
                        S.peeked = null;
                } else {
                        S.token = S.input();
                }
                return S.token;
        };

        function prev() {
                return S.prev;
        };

        function croak(msg, line, col, pos) {
                var ctx = S.input.context();
                js_error(msg,
                         line != null ? line : ctx.tokline,
                         col != null ? col : ctx.tokcol,
                         pos != null ? pos : ctx.tokpos);
        };

        function token_error(token, msg) {
                croak(msg, token.line, token.col);
        };

        function unexpected(token) {
                if (token == null)
                        token = S.token;
                token_error(token, "Unexpected token: " + token.type + " (" + token.value + ")");
        };

        function expect_token(type, val) {
                if (is(type, val)) {
                        return next();
                }
                token_error(S.token, "Unexpected token " + S.token.type + ", expected " + type);
        };

        function expect(punc) { return expect_token("punc", punc); };

        function can_insert_semicolon() {
                return !strict_mode && (
                        S.token.nlb || is("eof") || is("punc", "}")
                );
        };

        function semicolon() {
                if (is("punc", ";")) next();
                else if (!can_insert_semicolon()) unexpected();
        };

        function as() {
                return slice(arguments);
        };

        function parenthesised() {
                expect("(");
                var ex = expression();
                expect(")");
                return ex;
        };

        function add_tokens(str, start, end) {
                return new NodeWithToken(str, start, end);
        };

        var statement = embed_tokens ? function() {
                var start = S.token;
                var stmt = $statement();
                stmt[0] = add_tokens(stmt[0], start, prev());
                return stmt;
        } : $statement;

        function $statement() {
                if (is("operator", "/")) {
                        S.peeked = null;
                        S.token = S.input(true); // force regexp
                }
                switch (S.token.type) {
                    case "num":
                    case "string":
                    case "regexp":
                    case "operator":
                    case "atom":
                        return simple_statement();

                    case "name":
                        return is_token(peek(), "punc", ":")
                                ? labeled_statement(prog1(S.token.value, next, next))
                                : simple_statement();

                    case "punc":
                        switch (S.token.value) {
                            case "{":
                                return as("block", block_());
                            case "[":
                            case "(":
                                return simple_statement();
                            case ";":
                                next();
                                return as("block");
                            default:
                                unexpected();
                        }

                    case "keyword":
                        switch (prog1(S.token.value, next)) {
                            case "break":
                                return break_cont("break");

                            case "continue":
                                return break_cont("continue");

                            case "debugger":
                                semicolon();
                                return as("debugger");

                            case "do":
                                return (function(body){
                                        expect_token("keyword", "while");
                                        return as("do", prog1(parenthesised, semicolon), body);
                                })(in_loop(statement));

                            case "for":
                                return for_();

                            case "function":
                                return function_(true);

                            case "if":
                                return if_();

                            case "return":
                                if (S.in_function == 0)
                                        croak("'return' outside of function");
                                return as("return",
                                          is("punc", ";")
                                          ? (next(), null)
                                          : can_insert_semicolon()
                                          ? null
                                          : prog1(expression, semicolon));

                            case "switch":
                                return as("switch", parenthesised(), switch_block_());

                            case "throw":
                                return as("throw", prog1(expression, semicolon));

                            case "try":
                                return try_();

                            case "var":
                                return prog1(var_, semicolon);

                            case "const":
                                return prog1(const_, semicolon);

                            case "while":
                                return as("while", parenthesised(), in_loop(statement));

                            case "with":
                                return as("with", parenthesised(), statement());

                            default:
                                unexpected();
                        }
                }
        };

        function labeled_statement(label) {
                S.labels.push(label);
                var start = S.token, stat = statement();
                if (strict_mode && !HOP(STATEMENTS_WITH_LABELS, stat[0]))
                        unexpected(start);
                S.labels.pop();
                return as("label", label, stat);
        };

        function simple_statement() {
                return as("stat", prog1(expression, semicolon));
        };

        function break_cont(type) {
                var name = is("name") ? S.token.value : null;
                if (name != null) {
                        next();
                        if (!member(name, S.labels))
                                croak("Label " + name + " without matching loop or statement");
                }
                else if (S.in_loop == 0)
                        croak(type + " not inside a loop or switch");
                semicolon();
                return as(type, name);
        };

        function for_() {
                expect("(");
                var has_var = is("keyword", "var");
                if (has_var)
                        next();
                if (is("name") && is_token(peek(), "operator", "in")) {
                        // for (i in foo)
                        var name = S.token.value;
                        next(); next();
                        var obj = expression();
                        expect(")");
                        return as("for-in", has_var, name, obj, in_loop(statement));
                } else {
                        // classic for
                        var init = is("punc", ";") ? null : has_var ? var_() : expression();
                        expect(";");
                        var test = is("punc", ";") ? null : expression();
                        expect(";");
                        var step = is("punc", ")") ? null : expression();
                        expect(")");
                        return as("for", init, test, step, in_loop(statement));
                }
        };

        function function_(in_statement) {
                var name = is("name") ? prog1(S.token.value, next) : null;
                if (in_statement && !name)
                        unexpected();
                expect("(");
                return as(in_statement ? "defun" : "function",
                          name,
                          // arguments
                          (function(first, a){
                                  while (!is("punc", ")")) {
                                          if (first) first = false; else expect(",");
                                          if (!is("name")) unexpected();
                                          a.push(S.token.value);
                                          next();
                                  }
                                  next();
                                  return a;
                          })(true, []),
                          // body
                          (function(){
                                  ++S.in_function;
                                  var loop = S.in_loop;
                                  S.in_loop = 0;
                                  var a = block_();
                                  --S.in_function;
                                  S.in_loop = loop;
                                  return a;
                          })());
        };

        function if_() {
                var cond = parenthesised(), body = statement(), belse;
                if (is("keyword", "else")) {
                        next();
                        belse = statement();
                }
                return as("if", cond, body, belse);
        };

        function block_() {
                expect("{");
                var a = [];
                while (!is("punc", "}")) {
                        if (is("eof")) unexpected();
                        a.push(statement());
                }
                next();
                return a;
        };

        var switch_block_ = curry(in_loop, function(){
                expect("{");
                var a = [], cur = null;
                while (!is("punc", "}")) {
                        if (is("eof")) unexpected();
                        if (is("keyword", "case")) {
                                next();
                                cur = [];
                                a.push([ expression(), cur ]);
                                expect(":");
                        }
                        else if (is("keyword", "default")) {
                                next();
                                expect(":");
                                cur = [];
                                a.push([ null, cur ]);
                        }
                        else {
                                if (!cur) unexpected();
                                cur.push(statement());
                        }
                }
                next();
                return a;
        });

        function try_() {
                var body = block_(), bcatch, bfinally;
                if (is("keyword", "catch")) {
                        next();
                        expect("(");
                        if (!is("name"))
                                croak("Name expected");
                        var name = S.token.value;
                        next();
                        expect(")");
                        bcatch = [ name, block_() ];
                }
                if (is("keyword", "finally")) {
                        next();
                        bfinally = block_();
                }
                if (!bcatch && !bfinally)
                        croak("Missing catch/finally blocks");
                return as("try", body, bcatch, bfinally);
        };

        function vardefs() {
                var a = [];
                for (;;) {
                        if (!is("name"))
                                unexpected();
                        var name = S.token.value;
                        next();
                        if (is("operator", "=")) {
                                next();
                                a.push([ name, expression(false) ]);
                        } else {
                                a.push([ name ]);
                        }
                        if (!is("punc", ","))
                                break;
                        next();
                }
                return a;
        };

        function var_() {
                return as("var", vardefs());
        };

        function const_() {
                return as("const", vardefs());
        };

        function new_() {
                var newexp = expr_atom(false), args;
                if (is("punc", "(")) {
                        next();
                        args = expr_list(")");
                } else {
                        args = [];
                }
                return subscripts(as("new", newexp, args), true);
        };

        function expr_atom(allow_calls) {
                if (is("operator", "new")) {
                        next();
                        return new_();
                }
                if (is("operator") && HOP(UNARY_PREFIX, S.token.value)) {
                        return make_unary("unary-prefix",
                                          prog1(S.token.value, next),
                                          expr_atom(allow_calls));
                }
                if (is("punc")) {
                        switch (S.token.value) {
                            case "(":
                                next();
                                return subscripts(prog1(expression, curry(expect, ")")), allow_calls);
                            case "[":
                                next();
                                return subscripts(array_(), allow_calls);
                            case "{":
                                next();
                                return subscripts(object_(), allow_calls);
                        }
                        unexpected();
                }
                if (is("keyword", "function")) {
                        next();
                        return subscripts(function_(false), allow_calls);
                }
                if (HOP(ATOMIC_START_TOKEN, S.token.type)) {
                        var atom = S.token.type == "regexp"
                                ? as("regexp", S.token.value[0], S.token.value[1])
                                : as(S.token.type, S.token.value);
                        return subscripts(prog1(atom, next), allow_calls);
                }
                unexpected();
        };

        function expr_list(closing, allow_trailing_comma) {
                var first = true, a = [];
                while (!is("punc", closing)) {
                        if (first) first = false; else expect(",");
                        if (allow_trailing_comma && is("punc", closing))
                                break;
                        a.push(expression(false));
                }
                next();
                return a;
        };

        function array_() {
                return as("array", expr_list("]", !strict_mode));
        };

        function object_() {
                var first = true, a = [];
                while (!is("punc", "}")) {
                        if (first) first = false; else expect(",");
                        if (!strict_mode && is("punc", "}"))
                                // allow trailing comma
                                break;
                        var name = as_property_name();
                        expect(":");
                        var value = expression(false);
                        a.push([ name, value ]);
                }
                next();
                return as("object", a);
        };

        function as_property_name() {
                switch (S.token.type) {
                    case "num":
                    case "string":
                        return prog1(S.token.value, next);
                }
                return as_name();
        };

        function as_name() {
                switch (S.token.type) {
                    case "name":
                    case "operator":
                    case "keyword":
                    case "atom":
                        return prog1(S.token.value, next);
                    default:
                        unexpected();
                }
        };

        function subscripts(expr, allow_calls) {
                if (is("punc", ".")) {
                        next();
                        return subscripts(as("dot", expr, as_name()), allow_calls);
                }
                if (is("punc", "[")) {
                        next();
                        return subscripts(as("sub", expr, prog1(expression, curry(expect, "]"))), allow_calls);
                }
                if (allow_calls && is("punc", "(")) {
                        next();
                        return subscripts(as("call", expr, expr_list(")")), true);
                }
                if (allow_calls && is("operator") && HOP(UNARY_POSTFIX, S.token.value)) {
                        return prog1(curry(make_unary, "unary-postfix", S.token.value, expr),
                                     next);
                }
                return expr;
        };

        function make_unary(tag, op, expr) {
                if ((op == "++" || op == "--") && !is_assignable(expr))
                        croak("Invalid use of " + op + " operator");
                return as(tag, op, expr);
        };

        function expr_op(left, min_prec) {
                var op = is("operator") ? S.token.value : null;
                var prec = op != null ? PRECEDENCE[op] : null;
                if (prec != null && prec > min_prec) {
                        next();
                        var right = expr_op(expr_atom(true), prec);
                        return expr_op(as("binary", op, left, right), min_prec);
                }
                return left;
        };

        function expr_ops() {
                return expr_op(expr_atom(true), 0);
        };

        function maybe_conditional() {
                var expr = expr_ops();
                if (is("operator", "?")) {
                        next();
                        var yes = expression(false);
                        expect(":");
                        return as("conditional", expr, yes, expression(false));
                }
                return expr;
        };

        function is_assignable(expr) {
                switch (expr[0]) {
                    case "dot":
                    case "sub":
                        return true;
                    case "name":
                        return expr[1] != "this";
                }
        };

        function maybe_assign() {
                var left = maybe_conditional(), val = S.token.value;
                if (is("operator") && HOP(ASSIGNMENT, val)) {
                        if (is_assignable(left)) {
                                next();
                                return as("assign", ASSIGNMENT[val], left, maybe_assign());
                        }
                        croak("Invalid assignment");
                }
                return left;
        };

        function expression(commas) {
                if (arguments.length == 0)
                        commas = true;
                var expr = maybe_assign();
                if (commas && is("punc", ",")) {
                        next();
                        return as("seq", expr, expression());
                }
                return expr;
        };

        function in_loop(cont) {
                try {
                        ++S.in_loop;
                        return cont();
                } finally {
                        --S.in_loop;
                }
        };

        return as("toplevel", (function(a){
                while (!is("eof"))
                        a.push(statement());
                return a;
        })([]));

};

/* -----[ Utilities ]----- */

function curry(f) {
        var args = slice(arguments, 1);
        return function() { return f.apply(this, args.concat(slice(arguments))); };
};

function prog1(ret) {
        if (ret instanceof Function)
                ret = ret();
        for (var i = 1, n = arguments.length; --n > 0; ++i)
                arguments[i]();
        return ret;
};

function array_to_hash(a) {
        var ret = {};
        for (var i = 0; i < a.length; ++i)
                ret[a[i]] = true;
        return ret;
};

function slice(a, start) {
        return Array.prototype.slice.call(a, start == null ? 0 : start);
};

function characters(str) {
        return str.split("");
};

function member(name, array) {
        for (var i = array.length; --i >= 0;)
                if (array[i] === name)
                        return true;
        return false;
};

function HOP(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
};

/* -----[ Exports ]----- */

exports.tokenizer = tokenizer;
exports.parse = parse;
exports.slice = slice;
exports.curry = curry;
exports.member = member;
exports.array_to_hash = array_to_hash;
exports.PRECEDENCE = PRECEDENCE;
exports.KEYWORDS_ATOM = KEYWORDS_ATOM;
exports.RESERVED_WORDS = RESERVED_WORDS;
exports.KEYWORDS = KEYWORDS;
exports.ATOMIC_START_TOKEN = ATOMIC_START_TOKEN;
exports.OPERATORS = OPERATORS;
exports.is_alphanumeric_char = is_alphanumeric_char;

var jsp = {};
jsp.tokenizer = tokenizer;
jsp.parse = parse;
jsp.slice = slice;
jsp.curry = curry;
jsp.member = member;
jsp.array_to_hash = array_to_hash;
jsp.PRECEDENCE = PRECEDENCE;
jsp.KEYWORDS_ATOM = KEYWORDS_ATOM;
jsp.RESERVED_WORDS = RESERVED_WORDS;
jsp.KEYWORDS = KEYWORDS;
jsp.ATOMIC_START_TOKEN = ATOMIC_START_TOKEN;
jsp.OPERATORS = OPERATORS;
jsp.is_alphanumeric_char = is_alphanumeric_char;



/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.

  This version is suitable for Node.js.  With minimal changes (the
  exports stuff) it should work on any JS platform.

  This file implements some AST processors.  They work on data built
  by parse-js.

  Exported functions:

    - ast_mangle(ast, include_toplevel) -- mangles the
      variable/function names in the AST.  Returns an AST.  Pass true
      as second argument to mangle toplevel names too.

    - ast_squeeze(ast) -- employs various optimizations to make the
      final generated code even smaller.  Returns an AST.

    - gen_code(ast, beautify) -- generates JS code from the AST.  Pass
      true (or an object, see the code for some options) as second
      argument to get "pretty" (indented) code.

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under a ZLIB license:

    Copyright 2010 (c) Mihai Bazon <mihai.bazon@gmail.com>

    This software is provided 'as-is', without any express or implied
    warranty. In no event will the authors be held liable for any
    damages arising from the use of this software.

    Permission is granted to anyone to use this software for any
    purpose, including commercial applications, and to alter it and
    redistribute it freely, subject to the following restrictions:

    1. The origin of this software must not be misrepresented; you must
       not claim that you wrote the original software. If you use this
       software in a product, an acknowledgment in the product
       documentation would be appreciated but is not required.

    2. Altered source versions must be plainly marked as such, and must
       not be misrepresented as being the original software.

    3. This notice may not be removed or altered from any source
       distribution.

 ***********************************************************************/

var slice = jsp.slice,
    member = jsp.member,
    PRECEDENCE = jsp.PRECEDENCE,
    OPERATORS = jsp.OPERATORS;

/* -----[ helper for AST traversal ]----- */

function ast_walker(ast) {
        function _vardefs(defs) {
                return defs.map(function(def){
                        var a = [ def[0] ];
                        if (def.length > 1)
                                a[1] = walk(def[1]);
                        return a;
                });
        };
        var walkers = {
                "string": function(str) {
                        return [ "string", str ];
                },
                "num": function(num) {
                        return [ "num", num ];
                },
                "name": function(name) {
                        return [ "name", name ];
                },
                "toplevel": function(statements) {
                        return [ "toplevel", statements.map(walk) ];
                },
                "block": function(statements) {
                        var out = [ "block" ];
                        if (statements != null)
                                out.push(statements.map(walk));
                        return out;
                },
                "var": function(defs) {
                        return [ "var", _vardefs(defs) ];
                },
                "const": function(defs) {
                        return [ "const", _vardefs(defs) ];
                },
                "try": function(t, c, f) {
                        return [
                                "try",
                                t.map(walk),
                                c != null ? [ c[0], c[1].map(walk) ] : null,
                                f != null ? f.map(walk) : null
                        ];
                },
                "throw": function(expr) {
                        return [ "throw", walk(expr) ];
                },
                "new": function(ctor, args) {
                        return [ "new", walk(ctor), args.map(walk) ];
                },
                "switch": function(expr, body) {
                        return [ "switch", walk(expr), body.map(function(branch){
                                return [ branch[0] ? walk(branch[0]) : null,
                                         branch[1].map(walk) ];
                        }) ];
                },
                "break": function(label) {
                        return [ "break", label ];
                },
                "continue": function(label) {
                        return [ "continue", label ];
                },
                "conditional": function(cond, t, e) {
                        return [ "conditional", walk(cond), walk(t), walk(e) ];
                },
                "assign": function(op, lvalue, rvalue) {
                        return [ "assign", op, walk(lvalue), walk(rvalue) ];
                },
                "dot": function(expr) {
                        return [ "dot", walk(expr) ].concat(slice(arguments, 1));
                },
                "call": function(expr, args) {
                        return [ "call", walk(expr), args.map(walk) ];
                },
                "function": function(name, args, body) {
                        return [ "function", name, args.slice(), body.map(walk) ];
                },
                "defun": function(name, args, body) {
                        return [ "defun", name, args.slice(), body.map(walk) ];
                },
                "if": function(conditional, t, e) {
                        return [ "if", walk(conditional), walk(t), walk(e) ];
                },
                "for": function(init, cond, step, block) {
                        return [ "for", walk(init), walk(cond), walk(step), walk(block) ];
                },
                "for-in": function(has_var, key, hash, block) {
                        return [ "for-in", has_var, key, walk(hash), walk(block) ];
                },
                "while": function(cond, block) {
                        return [ "while", walk(cond), walk(block) ];
                },
                "do": function(cond, block) {
                        return [ "do", walk(cond), walk(block) ];
                },
                "return": function(expr) {
                        return [ "return", walk(expr) ];
                },
                "binary": function(op, left, right) {
                        return [ "binary", op, walk(left), walk(right) ];
                },
                "unary-prefix": function(op, expr) {
                        return [ "unary-prefix", op, walk(expr) ];
                },
                "unary-postfix": function(op, expr) {
                        return [ "unary-postfix", op, walk(expr) ];
                },
                "sub": function(expr, subscript) {
                        return [ "sub", walk(expr), walk(subscript) ];
                },
                "object": function(props) {
                        return [ "object", props.map(function(p){
                                return [ p[0], walk(p[1]) ];
                        }) ];
                },
                "regexp": function(rx, mods) {
                        return [ "regexp", rx, mods ];
                },
                "array": function(elements) {
                        return [ "array", elements.map(walk) ];
                },
                "stat": function(stat) {
                        return [ "stat", walk(stat) ];
                },
                "seq": function() {
                        return [ "seq" ].concat(slice(arguments).map(walk));
                },
                "label": function(name, block) {
                        return [ "label", name, walk(block) ];
                },
                "with": function(expr, block) {
                        return [ "with", walk(expr), walk(block) ];
                },
                "atom": function(name) {
                        return [ "atom", name ];
                }
        };

        var user = {};
        var stack = [];
        function walk(ast) {
                if (ast == null)
                        return null;
                try {
                        stack.push(ast);
                        var type = ast[0];
                        var gen = user[type];
                        if (gen) {
                                var ret = gen.apply(ast, ast.slice(1));
                                if (ret != null)
                                        return ret;
                        }
                        gen = walkers[type];
                        return gen.apply(ast, ast.slice(1));
                } finally {
                        stack.pop();
                }
        };

        function with_walkers(walkers, cont){
                var save = {}, i;
                for (i in walkers) if (HOP(walkers, i)) {
                        save[i] = user[i];
                        user[i] = walkers[i];
                }
                try { return cont(); }
                finally {
                        for (i in save) if (HOP(save, i)) {
                                if (!save[i]) delete user[i];
                                else user[i] = save[i];
                        }
                }
        };

        return {
                walk: walk,
                with_walkers: with_walkers,
                parent: function() {
                        return stack[stack.length - 2]; // last one is current node
                },
                stack: function() {
                        return stack;
                }
        };
};

/* -----[ Scope and mangling ]----- */

function Scope(parent) {
        this.names = {};        // names defined in this scope
        this.mangled = {};      // mangled names (orig.name => mangled)
        this.rev_mangled = {};  // reverse lookup (mangled => orig.name)
        this.cname = -1;        // current mangled name
        this.refs = {};         // names referenced from this scope
        this.uses_with = false; // will become TRUE if eval() is detected in this or any subscopes
        this.uses_eval = false; // will become TRUE if with() is detected in this or any subscopes
        this.parent = parent;   // parent scope
        this.children = [];     // sub-scopes
        if (parent) {
                this.level = parent.level + 1;
                parent.children.push(this);
        } else {
                this.level = 0;
        }
};

var base54 = (function(){
        var DIGITS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_";
        return function(num) {
                var ret = "";
                do {
                        ret = DIGITS.charAt(num % 54) + ret;
                        num = Math.floor(num / 54);
                } while (num > 0);
                return ret;
        };
})();

Scope.prototype = {
        has: function(name) {
                for (var s = this; s; s = s.parent)
                        if (HOP(s.names, name))
                                return s;
        },
        has_mangled: function(mname) {
                for (var s = this; s; s = s.parent)
                        if (HOP(s.rev_mangled, mname))
                                return s;
        },
        toJSON: function() {
                return {
                        names: this.names,
                        uses_eval: this.uses_eval,
                        uses_with: this.uses_with
                };
        },

        next_mangled: function() {
                // we must be careful that the new mangled name:
                //
                // 1. doesn't shadow a mangled name from a parent
                //    scope, unless we don't reference the original
                //    name from this scope OR from any sub-scopes!
                //    This will get slow.
                //
                // 2. doesn't shadow an original name from a parent
                //    scope, in the event that the name is not mangled
                //    in the parent scope and we reference that name
                //    here OR IN ANY SUBSCOPES!
                //
                // 3. doesn't shadow a name that is referenced but not
                //    defined (possibly global defined elsewhere).
                for (;;) {
                        var m = base54(++this.cname), prior;

                        // case 1.
                        prior = this.has_mangled(m);
                        if (prior && this.refs[prior.rev_mangled[m]] === prior)
                                continue;

                        // case 2.
                        prior = this.has(m);
                        if (prior && prior !== this && this.refs[m] === prior && !prior.has_mangled(m))
                                continue;

                        // case 3.
                        if (HOP(this.refs, m) && this.refs[m] == null)
                                continue;

                        // I got "do" once. :-/
                        if (!is_identifier(m))
                                continue;

                        return m;
                }
        },
        get_mangled: function(name, newMangle) {
                if (this.uses_eval || this.uses_with) return name; // no mangle if eval or with is in use
                var s = this.has(name);
                if (!s) return name; // not in visible scope, no mangle
                if (HOP(s.mangled, name)) return s.mangled[name]; // already mangled in this scope
                if (!newMangle) return name;                      // not found and no mangling requested

                var m = s.next_mangled();
                s.rev_mangled[m] = name;
                return s.mangled[name] = m;
        },
        define: function(name) {
                if (name != null)
                        return this.names[name] = name;
        }
};

function ast_add_scope(ast) {

        var current_scope = null;
        var w = ast_walker(), walk = w.walk;
        var having_eval = [];

        function with_new_scope(cont) {
                current_scope = new Scope(current_scope);
                try {
                        var ret = current_scope.body = cont();
                        ret.scope = current_scope;
                        return ret;
                }
                finally {
                        current_scope = current_scope.parent;
                }
        };

        function define(name) {
                return current_scope.define(name);
        };

        function reference(name) {
                current_scope.refs[name] = true;
        };

        function _lambda(name, args, body) {
                return [ this[0], define(name), args, with_new_scope(function(){
                        args.map(define);
                        return body.map(walk);
                })];
        };

        return with_new_scope(function(){
                // process AST
                var ret = w.with_walkers({
                        "function": _lambda,
                        "defun": _lambda,
                        "with": function(expr, block) {
                                for (var s = current_scope; s; s = s.parent)
                                        s.uses_with = true;
                        },
                        "var": function(defs) {
                                defs.map(function(d){ define(d[0]) });
                        },
                        "const": function(defs) {
                                defs.map(function(d){ define(d[0]) });
                        },
                        "try": function(t, c, f) {
                                if (c != null) return [
                                        "try",
                                        t.map(walk),
                                        with_new_scope(function(){
                                                return [ define(c[0]), c[1].map(walk) ];
                                        }),
                                        f != null ? f.map(walk) : null
                                ];
                        },
                        "name": function(name) {
                                if (name == "eval")
                                        having_eval.push(current_scope);
                                reference(name);
                        },
                        "for-in": function(has_var, name) {
                                if (has_var) define(name);
                                else reference(name);
                        }
                }, function(){
                        return walk(ast);
                });

                // the reason why we need an additional pass here is
                // that names can be used prior to their definition.

                // scopes where eval was detected and their parents
                // are marked with uses_eval, unless they define the
                // "eval" name.
                having_eval.map(function(scope){
                        if (!scope.has("eval")) while (scope) {
                                scope.uses_eval = true;
                                scope = scope.parent;
                        }
                });

                // for referenced names it might be useful to know
                // their origin scope.  current_scope here is the
                // toplevel one.
                function fixrefs(scope, i) {
                        // do children first; order shouldn't matter
                        for (i = scope.children.length; --i >= 0;)
                                fixrefs(scope.children[i]);
                        for (i in scope.refs) if (HOP(scope.refs, i)) {
                                // find origin scope and propagate the reference to origin
                                for (var origin = scope.has(i), s = scope; s; s = s.parent) {
                                        s.refs[i] = origin;
                                        if (s === origin) break;
                                }
                        }
                };
                fixrefs(current_scope);

                return ret;
        });

};

/* -----[ mangle names ]----- */

function ast_mangle(ast, do_toplevel) {
        var w = ast_walker(), walk = w.walk, scope;

        function get_mangled(name, newMangle) {
                if (!do_toplevel && !scope.parent) return name; // don't mangle toplevel
                return scope.get_mangled(name, newMangle);
        };

        function _lambda(name, args, body) {
                if (name) name = get_mangled(name);
                body = with_scope(body.scope, function(){
                        args = args.map(function(name){ return get_mangled(name) });
                        return body.map(walk);
                });
                return [ this[0], name, args, body ];
        };

        function with_scope(s, cont) {
                var _scope = scope;
                scope = s;
                for (var i in s.names) if (HOP(s.names, i)) {
                        get_mangled(i, true);
                }
                try { var ret = cont(); ret.scope = s; return ret; }
                finally { scope = _scope; };
        };

        function _vardefs(defs) {
                return defs.map(function(d){
                        return [ get_mangled(d[0]), walk(d[1]) ];
                });
        };

        return w.with_walkers({
                "function": _lambda,
                "defun": _lambda,
                "var": function(defs) {
                        return [ "var", _vardefs(defs) ];
                },
                "const": function(defs) {
                        return [ "const", _vardefs(defs) ];
                },
                "name": function(name) {
                        return [ "name", get_mangled(name) ];
                },
                "try": function(t, c, f) {
                        return [ "try",
                                 t.map(walk),
                                 c ? with_scope(c.scope, function(){
                                         return [ get_mangled(c[0]), c[1].map(walk) ];
                                 }) : null,
                                 f != null ? f.map(walk) : null ];
                },
                "toplevel": function(body) {
                        return with_scope(this.scope, function(){
                                return [ "toplevel", body.map(walk) ];
                        });
                },
                "for-in": function(has_var, name, obj, stat) {
                        return [ "for-in", has_var, get_mangled(name), walk(obj), walk(stat) ];
                }
        }, function() {
                return walk(ast_add_scope(ast));
        });
};

// function ast_has_side_effects(ast) {
//         var w = ast_walker();
//         var FOUND_SIDE_EFFECTS = {};
//         function _found() { throw FOUND_SIDE_EFFECTS };
//         try {
//                 w.with_walkers({
//                         "new": _found,
//                         "call": _found,
//                         "assign": _found,
//                         "defun": _found,
//                         "var": _found,
//                         "const": _found,
//                         "throw": _found,
//                         "return": _found,
//                         "break": _found,
//                         "continue": _found,
//                         "label": _found,
//                         "function": function(name) {
//                                 if (name) _found();
//                         }
//                 }, function(){
//                         w.walk(ast);
//                 });
//         } catch(ex) {
//                 if (ex === FOUND_SIDE_EFFECTS)
//                         return true;
//                 throw ex;
//         }
// };

/* -----[
   - compress foo["bar"] into foo.bar,
   - remove block brackets {} where possible
   - join consecutive var declarations
   - various optimizations for IFs:
     - if (cond) foo(); else bar();  ==>  cond?foo():bar();
     - if (cond) foo();  ==>  cond&&foo();
     - if (foo) return bar(); else return baz();  ==> return foo?bar():baz(); // also for throw
     - if (foo) return bar(); else something();  ==> {if(foo)return bar();something()}
   ]----- */
var sys = require("sys");
function warn(msg) {
        sys.debug(msg);
};

function ast_squeeze(ast, options) {
        options = defaults(options, {
                make_seqs: true,
                dead_code: true,
                no_warnings: false
        });

        var w = ast_walker(), walk = w.walk;

        function is_constant(node) {
                return node[0] == "string" || node[0] == "num";
        };

        function rmblock(block) {
                if (block != null && block[0] == "block" && block[1] && block[1].length == 1)
                        block = block[1][0];
                return block;
        };

        function _lambda(name, args, body) {
                return [ this[0], name, args, tighten(body.map(walk)) ];
        };

        // we get here for blocks that have been already transformed.
        // this function does two things:
        // 1. discard useless blocks
        // 2. join consecutive var declarations
        function tighten(statements) {
                var cur, prev;
                for (var i = 0, ret1 = []; i < statements.length; ++i) {
                        cur = statements[i];
                        if (cur[0] == "block") {
                                if (cur[1]) {
                                        ret1.push.apply(ret1, cur[1]);
                                }
                        } else {
                                ret1.push(cur);
                        }
                }
                prev = null;
                for (var i = 0, ret2 = []; i < ret1.length; ++i) {
                        cur = ret1[i];
                        if (prev && ((cur[0] == "var" && prev[0] == "var") ||
                                     (cur[0] == "const" && prev[0] == "const"))) {
                                prev[1] = prev[1].concat(cur[1]);
                        } else {
                                ret2.push(cur);
                                prev = cur;
                        }
                }
                if (options.dead_code) {
                        var a = [], has_quit = false;
                        ret2.forEach(function(st){
                                if (has_quit) {
                                        if (member(st[0], [ "function", "defun" , "var", "const" ])) {
                                                a.push(st);
                                        }
                                        else if (!options.no_warnings)
                                                warn("Removing unreachable code: " + gen_code(st, true));
                                }
                                else {
                                        a.push(st);
                                        if (member(st[0], [ "return", "throw", "break", "continue" ]))
                                                has_quit = true;
                                }
                        });
                        ret2 = a;
                }
                if (!options.make_seqs)
                        return ret2;
                prev = null;
                for (var i = 0, ret3 = []; i < ret2.length; ++i) {
                        cur = ret2[i];
                        if (!prev) {
                                ret3.push(cur);
                                if (cur[0] == "stat") prev = cur;
                        } else if (cur[0] == "stat" && prev[0] == "stat") {
                                prev[1] = [ "seq", prev[1], cur[1] ];
                        } else {
                                ret3.push(cur);
                                prev = null;
                        }
                }
                return ret3;
        };

        function best_of(ast1, ast2) {
                return gen_code(ast1).length > gen_code(ast2[0] == "stat" ? ast2[1] : ast2).length ? ast2 : ast1;
        };

        function aborts(t) {
                if (t[0] == "block" && t[1] && t[1].length > 0)
                        t = t[1][t[1].length - 1]; // interested in last statement
                if (t[0] == "return" || t[0] == "break" || t[0] == "continue" || t[0] == "throw")
                        return true;
        };

        function make_conditional(c, t, e) {
                if (c[0] == "unary-prefix" && c[1] == "!") {
                        return e ? [ "conditional", c[2], e, t ] : [ "binary", "||", c[2], t ];
                } else {
                        return e ? [ "conditional", c, t, e ] : [ "binary", "&&", c, t ];
                }
        };

        function empty(b) {
                return !b || (b[0] == "block" && (!b[1] || b[1].length == 0));
        };

        return w.with_walkers({
                "sub": function(expr, subscript) {
                        if (subscript[0] == "string") {
                                var name = subscript[1];
                                if (is_identifier(name)) {
                                        return [ "dot", walk(expr), name ];
                                }
                        }
                },
                "if": function(c, t, e) {
                        c = walk(c);
                        t = walk(t);
                        e = walk(e);
                        var negated = c[0] == "unary-prefix" && c[1] == "!";
                        if (empty(t)) {
                                if (negated) c = c[2];
                                else c = [ "unary-prefix", "!", c ];
                                t = e;
                                e = null;
                        }
                        if (empty(e)) {
                                e = null;
                        } else {
                                if (negated) {
                                        c = c[2];
                                        var tmp = t; t = e; e = tmp;
                                }
                        }
                        if (empty(e) && empty(t))
                                return [ "stat", c ];
                        var ret = [ "if", c, t, e ];
                        if (t[0] == "stat") {
                                if (e) {
                                        if (e[0] == "stat") {
                                                ret = best_of(ret, [ "stat", make_conditional(c, t[1], e[1]) ]);
                                        }
                                }
                                else {
                                        ret = best_of(ret, [ "stat", make_conditional(c, t[1]) ]);
                                }
                        }
                        else if (e && t[0] == e[0] && (t[0] == "return" || t[0] == "throw")) {
                                ret = best_of(ret, [ t[0], make_conditional(c, t[1], e[1] ) ]);
                        }
                        else if (e && aborts(t)) {
                                ret = [ [ "if", c, t ] ];
                                if (e[0] == "block") {
                                        if (e[1]) ret = ret.concat(e[1]);
                                }
                                else {
                                        ret.push(e);
                                }
                                ret = walk([ "block", ret ]);
                        }
                        return ret;
                },
                "toplevel": function(body) {
                        return [ "toplevel", tighten(body.map(walk)) ];
                },
                "switch": function(expr, body) {
                        var last = body.length - 1;
                        return [ "switch", walk(expr), body.map(function(branch, i){
                                var block = tighten(branch[1].map(walk));
                                if (i == last && block.length > 0) {
                                        var node = block[block.length - 1];
                                        if (node[0] == "break" && !node[1])
                                                block.pop();
                                }
                                return [ branch[0] ? walk(branch[0]) : null, block ];
                        }) ];
                },
                "function": _lambda,
                "defun": _lambda,
                "block": function(body) {
                        if (body) return rmblock([ "block", tighten(body.map(walk)) ]);
                },
                "binary": function(op, left, right) {
                        left = walk(left);
                        right = walk(right);
                        var best = [ "binary", op, left, right ];
                        if (is_constant(left) && is_constant(right)) {
                                var val = null;
                                switch (op) {
                                    case "+": val = left[1] + right[1]; break;
                                    case "*": val = left[1] * right[1]; break;
                                    case "/": val = left[1] / right[1]; break;
                                    case "-": val = left[1] - right[1]; break;
                                    case "<<": val = left[1] << right[1]; break;
                                    case ">>": val = left[1] >> right[1]; break;
                                    case ">>>": val = left[1] >>> right[1]; break;
                                }
                                if (val != null) {
                                        best = best_of(best, [ typeof val == "string" ? "string" : "num", val ]);
                                }
                        }
                        return best;
                },
                "conditional": function(c, t, e) {
                        return make_conditional(walk(c), walk(t), walk(e));
                },
                "try": function(t, c, f) {
                        return [
                                "try",
                                tighten(t.map(walk)),
                                c != null ? [ c[0], tighten(c[1].map(walk)) ] : null,
                                f != null ? tighten(f.map(walk)) : null
                        ];
                }
        }, function() {
                return walk(ast);
        });

};

/* -----[ re-generate code from the AST ]----- */

var DOT_CALL_NO_PARENS = jsp.array_to_hash([
        "name",
        "array",
        "string",
        "dot",
        "sub",
        "call",
        "regexp"
]);

function gen_code(ast, beautify) {
        if (beautify) beautify = defaults(beautify, {
                indent_start : 0,
                indent_level : 4,
                quote_keys   : false,
                space_colon  : false
        });
        var indentation = 0,
            newline = beautify ? "\n" : "",
            space = beautify ? " " : "";

        function indent(line) {
                if (line == null)
                        line = "";
                if (beautify)
                        line = repeat_string(" ", beautify.indent_start + indentation * beautify.indent_level) + line;
                return line;
        };

        function with_indent(cont, incr) {
                if (incr == null) incr = 1;
                indentation += incr;
                try { return cont.apply(null, slice(arguments, 1)); }
                finally { indentation -= incr; }
        };

        function add_spaces(a) {
                if (beautify)
                        return a.join(" ");
                var b = [];
                for (var i = 0; i < a.length; ++i) {
                        var next = a[i + 1];
                        b.push(a[i]);
                        if (next &&
                            ((/[a-z0-9_\x24]$/i.test(a[i].toString()) && /^[a-z0-9_\x24]/i.test(next.toString())) ||
                             (/[\+\-]$/.test(a[i].toString()) && /^[\+\-]/.test(next.toString())))) {
                                b.push(" ");
                        }
                }
                return b.join("");
        };

        function add_commas(a) {
                return a.join("," + space);
        };

        function parenthesize(expr) {
                var gen = make(expr);
                for (var i = 1; i < arguments.length; ++i) {
                        var el = arguments[i];
                        if ((el instanceof Function && el(expr)) || expr[0] == el)
                                return "(" + gen + ")";
                }
                return gen;
        };

        function best_of(a) {
                if (a.length == 1) {
                        return a[0];
                }
                if (a.length == 2) {
                        var b = a[1];
                        a = a[0];
                        return a.length <= b.length ? a : b;
                }
                return best_of([ a[0], best_of(a.slice(1)) ]);
        };

        function needs_parens(expr) {
                if (expr[0] == "function") {
                        // dot/call on a literal function requires the
                        // function literal itself to be parenthesized
                        // only if it's the first "thing" in a
                        // statement.  This means that the parent is
                        // "stat", but it could also be a "seq" and
                        // we're the first in this "seq" and the
                        // parent is "stat", and so on.  Messy stuff,
                        // but it worths the trouble.
                        var a = slice($stack), self = a.pop(), p = a.pop();
                        while (true) {
                                if (p[0] == "stat") return true;
                                if ((p[0] == "seq" && p[1] === self) ||
                                    (p[0] == "call" && p[1] === self) ||
                                    (p[0] == "binary" && p[2] === self)) {
                                        self = p;
                                        p = a.pop();
                                } else {
                                        return false;
                                }
                        }
                }
                return !HOP(DOT_CALL_NO_PARENS, expr[0]);
        };

        function make_num(num) {
                var str = num.toString(10), a = [ str.replace(/^0\./, ".") ], m;
                if (Math.floor(num) === num) {
                        a.push("0x" + num.toString(16).toLowerCase(), // probably pointless
                               "0" + num.toString(8)); // same.
                        if ((m = /^(.*?)(0+)$/.exec(num))) {
                                a.push(m[1] + "e" + m[2].length);
                        }
                } else if ((m = /^0?\.(0+)(.*)$/.exec(num))) {
                        a.push(m[2] + "e-" + (m[1].length + 1),
                               str.substr(str.indexOf(".")));
                }
                return best_of(a);
        };

        var generators = {
                "string": make_string,
                "num": make_num,
                "name": make_name,
                "toplevel": function(statements) {
                        return make_block_statements(statements)
                                .join(newline + newline);
                },
                "block": make_block,
                "var": function(defs) {
                        return "var " + add_commas(defs.map(make_1vardef)) + ";";
                },
                "const": function(defs) {
                        return "const " + add_commas(defs.map(make_1vardef)) + ";";
                },
                "try": function(tr, ca, fi) {
                        var out = [ "try", make_block(tr) ];
                        if (ca) out.push("catch", "(" + ca[0] + ")", make_block(ca[1]));
                        if (fi) out.push("finally", make_block(fi));
                        return add_spaces(out);
                },
                "throw": function(expr) {
                        return add_spaces([ "throw", make(expr) ]) + ";";
                },
                "new": function(ctor, args) {
                        args = args.length > 0 ? "(" + add_commas(args.map(make)) + ")" : "";
                        return add_spaces([ "new", parenthesize(ctor, "seq", "binary", "conditional", "assign", function(expr){
                                var w = ast_walker(), has_call = {};
                                try {
                                        w.with_walkers({
                                                "call": function() { throw has_call },
                                                "function": function() { return this }
                                        }, function(){
                                                w.walk(expr);
                                        });
                                } catch(ex) {
                                        if (ex === has_call)
                                                return true;
                                        throw ex;
                                }
                        }) + args ]);
                },
                "switch": function(expr, body) {
                        return add_spaces([ "switch", "(" + make(expr) + ")", make_switch_block(body) ]);
                },
                "break": function(label) {
                        var out = "break";
                        if (label != null)
                                out += " " + make_name(label);
                        return out + ";";
                },
                "continue": function(label) {
                        var out = "continue";
                        if (label != null)
                                out += " " + make_name(label);
                        return out + ";";
                },
                "conditional": function(co, th, el) {
                        return add_spaces([ parenthesize(co, "assign", "seq", "conditional"), "?",
                                            parenthesize(th, "seq"), ":",
                                            parenthesize(el, "seq") ]);
                },
                "assign": function(op, lvalue, rvalue) {
                        if (op && op !== true) op += "=";
                        else op = "=";
                        return add_spaces([ make(lvalue), op, make(rvalue) ]);
                },
                "dot": function(expr) {
                        var out = make(expr), i = 1;
                        if (needs_parens(expr))
                                out = "(" + out + ")";
                        while (i < arguments.length)
                                out += "." + make_name(arguments[i++]);
                        return out;
                },
                "call": function(func, args) {
                        var f = make(func);
                        if (needs_parens(func))
                                f = "(" + f + ")";
                        return f + "(" + add_commas(args.map(make)) + ")";
                },
                "function": make_function,
                "defun": make_function,
                "if": function(co, th, el) {
                        var out = [ "if", "(" + make(co) + ")", el ? make_then(th) : make(th) ];
                        if (el) {
                                out.push("else", make(el));
                        }
                        return add_spaces(out);
                },
                "for": function(init, cond, step, block) {
                        var out = [ "for" ];
                        init = (init != null ? make(init) : "").replace(/;*\s*$/, ";" + space);
                        cond = (cond != null ? make(cond) : "").replace(/;*\s*$/, ";" + space);
                        step = (step != null ? make(step) : "").replace(/;*\s*$/, "");
                        var args = init + cond + step;
                        if (args == "; ; ") args = ";;";
                        out.push("(" + args + ")", make(block));
                        return add_spaces(out);
                },
                "for-in": function(has_var, key, hash, block) {
                        var out = add_spaces([ "for", "(" ]);
                        if (has_var)
                                out += "var ";
                        out += add_spaces([ make_name(key) + " in " + make(hash) + ")", make(block) ]);
                        return out;
                },
                "while": function(condition, block) {
                        return add_spaces([ "while", "(" + make(condition) + ")", make(block) ]);
                },
                "do": function(condition, block) {
                        return add_spaces([ "do", make(block), "while", "(" + make(condition) + ")" ]) + ";";
                },
                "return": function(expr) {
                        var out = [ "return" ];
                        if (expr != null) out.push(make(expr));
                        return add_spaces(out) + ";";
                },
                "binary": function(operator, lvalue, rvalue) {
                        var left = make(lvalue), right = make(rvalue);
                        // XXX: I'm pretty sure other cases will bite here.
                        //      we need to be smarter.
                        //      adding parens all the time is the safest bet.
                        if (member(lvalue[0], [ "assign", "conditional", "seq" ]) ||
                            lvalue[0] == "binary" && PRECEDENCE[operator] > PRECEDENCE[lvalue[1]]) {
                                left = "(" + left + ")";
                        }
                        if (member(rvalue[0], [ "assign", "conditional", "seq" ]) ||
                            rvalue[0] == "binary" && PRECEDENCE[operator] >= PRECEDENCE[rvalue[1]]) {
                                right = "(" + right + ")";
                        }
                        return add_spaces([ left, operator, right ]);
                },
                "unary-prefix": function(operator, expr) {
                        var val = make(expr);
                        if (!(expr[0] == "num" || (expr[0] == "unary-prefix" && !HOP(OPERATORS, operator + expr[1])) || !needs_parens(expr)))
                                val = "(" + val + ")";
                        return operator + (jsp.is_alphanumeric_char(operator.charAt(0)) ? " " : "") + val;
                },
                "unary-postfix": function(operator, expr) {
                        var val = make(expr);
                        if (!(expr[0] == "num" || (expr[0] == "unary-postfix" && !HOP(OPERATORS, operator + expr[1])) || !needs_parens(expr)))
                                val = "(" + val + ")";
                        return val + operator;
                },
                "sub": function(expr, subscript) {
                        var hash = make(expr);
                        if (needs_parens(expr))
                                hash = "(" + hash + ")";
                        return hash + "[" + make(subscript) + "]";
                },
                "object": function(props) {
                        if (props.length == 0)
                                return "{}";
                        return "{" + newline + with_indent(function(){
                                return props.map(function(p){
                                        var key = p[0], val = make(p[1]);
                                        if (beautify && beautify.quote_keys) {
                                                key = make_string(key);
                                        } else if (typeof key == "number") {
                                                key = make_num(key);
                                        } else if (!is_identifier(key)) {
                                                key = make_string(key);
                                        }
                                        return indent(add_spaces(beautify && beautify.space_colon
                                                                 ? [ key, ":", val ]
                                                                 : [ key + ":", val ]));
                                }).join("," + newline);
                        }) + newline + indent("}");
                },
                "regexp": function(rx, mods) {
                        return "/" + rx + "/" + mods;
                },
                "array": function(elements) {
                        if (elements.length == 0) return "[]";
                        return add_spaces([ "[", add_commas(elements.map(make)), "]" ]);
                },
                "stat": function(stmt) {
                        return make(stmt).replace(/;*\s*$/, ";");
                },
                "seq": function() {
                        return add_commas(slice(arguments).map(make));
                },
                "label": function(name, block) {
                        return add_spaces([ make_name(name), ":", make(block) ]);
                },
                "with": function(expr, block) {
                        return add_spaces([ "with", "(" + make(expr) + ")", make(block) ]);
                },
                "atom": function(name) {
                        return make_name(name);
                },
                "comment1": function(text) {
                        return "//" + text + "\n";
                },
                "comment2": function(text) {
                        return "/*" + text + "*/";
                }
        };

        // The squeezer replaces "block"-s that contain only a single
        // statement with the statement itself; technically, the AST
        // is correct, but this can create problems when we output an
        // IF having an ELSE clause where the THEN clause ends in an
        // IF *without* an ELSE block (then the outer ELSE would refer
        // to the inner IF).  This function checks for this case and
        // adds the block brackets if needed.
        function make_then(th) {
                var b = th;
                while (true) {
                        var type = b[0];
                        if (type == "if") {
                                if (!b[3])
                                        // no else, we must add the block
                                        return make([ "block", [ th ]]);
                                b = b[3];
                        }
                        else if (type == "while" || type == "do") b = b[2];
                        else if (type == "for" || type == "for-in") b = b[4];
                        else break;
                }
                return make(th);
        };

        function make_function(name, args, body) {
                var out = "function";
                if (name) {
                        out += " " + make_name(name);
                }
                out += "(" + add_commas(args.map(make_name)) + ")";
                return add_spaces([ out, make_block(body) ]);
        };

        function make_string(str) {
                // return '"' +
                //         str.replace(/\x5c/g, "\\\\")
                //         .replace(/\r?\n/g, "\\n")
                //         .replace(/\t/g, "\\t")
                //         .replace(/\r/g, "\\r")
                //         .replace(/\f/g, "\\f")
                //         .replace(/[\b]/g, "\\b")
                //         .replace(/\x22/g, "\\\"")
                //         .replace(/[\x00-\x1f]|[\x80-\xff]/g, function(c){
                //                 var hex = c.charCodeAt(0).toString(16);
                //                 if (hex.length < 2)
                //                         hex = "0" + hex;
                //                 return "\\x" + hex;
                //         })
                //         + '"';
                return JSON.stringify(str); // STILL cheating.
        };

        function make_name(name) {
                return name.toString();
        };

        function make_block_statements(statements) {
                for (var a = [], last = statements.length - 1, i = 0; i <= last; ++i) {
                        var stat = statements[i];
                        var code = make(stat);
                        if (code != ";") {
                                if (!beautify && i == last)
                                        code = code.replace(/;+\s*$/, "");
                                a.push(code);
                        }
                }
                return a.map(indent);
        };

        function make_switch_block(body) {
                var n = body.length;
                if (n == 0) return "{}";
                return "{" + newline + body.map(function(branch, i){
                        var has_body = branch[1].length > 0, code = with_indent(function(){
                                return indent(branch[0]
                                              ? add_spaces([ "case", make(branch[0]) + ":" ])
                                              : "default:");
                        }, 0.5) + (has_body ? newline + with_indent(function(){
                                return make_block_statements(branch[1]).join(newline);
                        }) : "");
                        if (!beautify && has_body && i < n - 1)
                                code += ";";
                        return code;
                }).join(newline) + newline + indent("}");
        };

        function make_block(statements) {
                if (!statements) return ";";
                if (statements.length == 0) return "{}";
                return "{" + newline + with_indent(function(){
                        return make_block_statements(statements).join(newline);
                }) + newline + indent("}");
        };

        function make_1vardef(def) {
                var name = def[0], val = def[1];
                if (val != null)
                        name = add_spaces([ name, "=", make(val) ]);
                return name;
        };

        var $stack = [];

        function make(node) {
                var type = node[0];
                var gen = generators[type];
                if (!gen)
                        throw new Error("Can't find generator for \"" + type + "\"");
                $stack.push(node);
                var ret = gen.apply(type, node.slice(1));
                $stack.pop(node);
                return ret;
        };

        return make(ast);
};

/* -----[ Utilities ]----- */

function repeat_string(str, i) {
        if (i <= 0) return "";
        if (i == 1) return str;
        var d = repeat_string(str, i >> 1);
        d += d;
        if (i & 1) d += str;
        return d;
};

function defaults(args, defs) {
        var ret = {};
        if (args === true)
                args = {};
        for (var i in defs) if (HOP(defs, i)) {
                ret[i] = (args && HOP(args, i)) ? args[i] : defs[i];
        }
        return ret;
};

function is_identifier(name) {
        return /^[a-z_$][a-z0-9_$]*$/i.test(name) &&
                !HOP(jsp.KEYWORDS_ATOM, name) &&
                !HOP(jsp.RESERVED_WORDS, name) &&
                !HOP(jsp.KEYWORDS, name);
};

function HOP(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
};

/* -----[ Exports ]----- */

exports.ast_walker = ast_walker;
exports.ast_mangle = ast_mangle;
exports.ast_squeeze = ast_squeeze;
exports.gen_code = gen_code;
exports.ast_add_scope = ast_add_scope;

var pro = {};
pro.ast_walker = ast_walker;
pro.ast_mangle = ast_mangle;
pro.ast_squeeze = ast_squeeze;
pro.gen_code = gen_code;
pro.ast_add_scope = ast_add_scope;



/* -- helpers --*/

var merge_objects;
var __hasProp = Object.prototype.hasOwnProperty;
merge_objects = function(a, b) {
  var _ref, c, key, value;
  c = {};
  _ref = a;
  for (key in _ref) {
    if (!__hasProp.call(_ref, key)) continue;
    value = _ref[key];
    c[key] = value;
  }
  _ref = b;
  for (key in _ref) {
    if (!__hasProp.call(_ref, key)) continue;
    value = _ref[key];
    if (typeof value === "object") {
      c[key] = merge_objects(c[key], value);
    } else {
      c[key] = value;
    }
  }
  return c;
};

function show_copyright(comments) {
  var _i, _len, _ref, c, ret;
  ret = "";
  _ref = comments;
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    c = _ref[_i];
    if (c.type === "comment1") {
      ret += ("//" + (c.value) + "\n");
    } else {

    }
    ret += ("/*" + (c.value) + "*/\n");
  }
  return ret;
};


var default_options_compile = {
  ast: false,
  mangle: true,
  mangle_toplevel: false,
  squeeze: true,
  make_seqs: true,
  dead_code: true,
  beautify: false,
  verbose: false,
  show_copyright: false, // Maybe true?
  out_same_file: false,
  beautify_options: {
          indent_level: 4,
          indent_start: 0,
          quote_keys: false,
          space_colon: false
  },
  output: false            // stdout
}


exports.compress_js = function compress_js(code, options) {
  
  options = merge_objects(default_options_compile, options);

  var ast, c, initial_comments, result, tok;
  result = "";
  if (options.show_copyright) {
    initial_comments = [];
    tok = jsp.tokenizer(code, false);
    c = tok();
    while (/^comment/.test(c.type)) {
      initial_comments.push(c);
      c = tok();
      result += show_copyright(initial_comments);
    }
  }
  try {
    ast = jsp.parse(code);
    options.ast = ast;
    if (options.squeeze) {
      ast = pro.ast_squeeze(ast, {
        make_seqs: options.make_seqs,
        dead_code: options.dead_code
      });
    }
    if (options.mangle) {
      ast = pro.ast_mangle(ast, options.mangle_toplevel);
    }
    result += pro.gen_code(ast, options.beautify && options.beautify_options);
    return result;
  } catch (ex) {
    // sys.debug(ex.stack);
    // sys.debug(sys.inspect(ex));
    // sys.debug(JSON.stringify(ex));
    throw ex;
  }
};