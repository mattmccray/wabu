var KEYWORDS=array_to_hash(["break","case","catch","const","continue","default","delete","do","else","finally","for","function","if","in","instanceof","new","return","switch","throw","try","typeof","var","void","while","with"]),RESERVED_WORDS=array_to_hash(["abstract","boolean","byte","char","class","debugger","double","enum","export","extends","final","float","goto","implements","import","int","interface","long","native","package","private","protected","public","short","static","super","synchronized","throws","transient","volatile"]),KEYWORDS_BEFORE_EXPRESSION=array_to_hash(["return","new","delete","throw","else"]),KEYWORDS_ATOM=array_to_hash(["false","null","true","undefined"]),OPERATOR_CHARS=array_to_hash(characters("+-*&%=<>!?|~^")),RE_HEX_NUMBER=/^0x[0-9a-f]+$/i,RE_OCT_NUMBER=/^0[0-7]+$/,RE_DEC_NUMBER=/^\d*\.?\d*(?:e[+-]?\d*(?:\d\.?|\.?\d)\d*)?$/i,OPERATORS=array_to_hash(["in","instanceof","typeof","new","void","delete","++","--","+","-","!","~","&","|","^","*","/","%",">>","<<",">>>","<",">","<=",">=","==","===","!=","!==","?","=","+=","-=","/=","*=","%=",">>=","<<=",">>>=","~=","%=","|=","^=","&=","&&","||"]),WHITESPACE_CHARS=array_to_hash(characters(" \n\r\t")),PUNC_BEFORE_EXPRESSION=array_to_hash(characters("[{}(,.;:")),PUNC_CHARS=array_to_hash(characters("[]{}(),;:")),REGEXP_MODIFIERS=array_to_hash(characters("gmsiy"));function is_alphanumeric_char(a){a=a.charCodeAt(0);return a>=48&&a<=57||a>=65&&a<=90||a>=97&&a<=122}function is_identifier_char(a){return is_alphanumeric_char(a)||a=="$"||a=="_"}function is_digit(a){a=a.charCodeAt(0);return a>=48&&a<=57}function parse_js_number(a){if(RE_HEX_NUMBER.test(a))return parseInt(a.substr(2),16);if(RE_OCT_NUMBER.test(a))return parseInt(a.substr(1),8);if(RE_DEC_NUMBER.test(a))return parseFloat(a)}function JS_Parse_Error(a,b,c,d){this.message=a,this.line=b,this.col=c,this.pos=d;try{({})()}catch(a){this.stack=a.stack}}JS_Parse_Error.prototype.toString=function(){return this.message+" (line: "+this.line+", col: "+this.col+", pos: "+this.pos+")"+"\n\n"+this.stack};function js_error(a,b,c,d){throw new JS_Parse_Error(a,b,c,d)}function is_token(a,b,c){return a.type==b&&(c==null||a.value==c)}var EX_EOF={};function tokenizer(a,b){var c={text:a.replace(/\r\n?|[\n\u2028\u2029]/g,"\n").replace(/^\uFEFF/,""),pos:0,tokpos:0,line:0,tokline:0,col:0,tokcol:0,newline_before:false,regex_allowed:false};function d(){return c.text.charAt(c.pos)}function e(a){var b=c.text.charAt(c.pos++);if(a&&!b)throw EX_EOF;b=="\n"?(c.newline_before=true,++c.line,c.col=0):++c.col;return b}function f(){return!c.peek()}function g(a,b){var d=c.text.indexOf(a,c.pos);if(b&&d==-1)throw EX_EOF;return d}function h(){c.tokline=c.line,c.tokcol=c.col,c.tokpos=c.pos}function i(a,b){c.regex_allowed=a=="operator"&&!HOP(UNARY_POSTFIX,b)||a=="keyword"&&HOP(KEYWORDS_BEFORE_EXPRESSION,b)||a=="punc"&&HOP(PUNC_BEFORE_EXPRESSION,b);var d={type:a,value:b,line:c.tokline,col:c.tokcol,pos:c.tokpos,nlb:c.newline_before};c.newline_before=false;return d}function j(){while(HOP(WHITESPACE_CHARS,d()))e()}function k(a){var b="",c=d(),f=0;while(c&&a(c,f++))b+=e(),c=d();return b}function l(a){js_error(a,c.tokline,c.tokcol,c.tokpos)}function m(a){var b=false,c=false,d=false,e=k(function(e,f){if(e=="x"||e=="X"){if(d)return false;return d=true}if(!d&&(e=="E"||e=="e")){if(b)return false;return b=c=true}if(e=="-"){if(c||f==0&&!a)return true;return false}if(e=="+")return c;c=false;return is_alphanumeric_char(e)||e=="."});a&&(e=a+e);var f=parse_js_number(e);if(isNaN(f))l("Invalid syntax: "+e);else return i("num",f)}function n(){var a=e(true);switch(a){case"n":return"\n";case"r":return"\r";case"t":return"\t";case"b":return"\b";case"v":return"\u000b";case"f":return"\f";case"0":return"\u0000";case"x":return String.fromCharCode(o(2));case"u":return String.fromCharCode(o(4));default:return a}}function o(a){var b=0;for(;a>0;--a){var c=parseInt(e(true),16);isNaN(c)&&l("Invalid hex-character pattern in string"),b=b<<4|c}return b}function p(){return x("Unterminated string constant",function(){var a=e(),b="";for(;;){var c=e(true);if(c=="\\")c=n();else if(c==a)break;b+=c}return i("string",b)})}function q(){e();var a=g("\n"),b;a==-1?(b=c.text.substr(c.pos),c.pos=c.text.length):(b=c.text.substring(c.pos,a),c.pos=a);return i("comment1",b)}function r(){e();return x("Unterminated multiline comment",function(){var a=g("*/",true),b=c.text.substring(c.pos,a),d=i("comment2",b);c.pos=a+2,c.newline_before=b.indexOf("\n")>=0;return d})}function s(){return x("Unterminated regular expression",function(){var a=false,b="",c,d=false;while(c=e(true))if(a)b+="\\"+c,a=false;else if(c=="[")d=true,b+=c;else if(c=="]"&&d)d=false,b+=c;else{if(c=="/"&&!d)break;c=="\\"?a=true:b+=c}var f=k(function(a){return HOP(REGEXP_MODIFIERS,a)});return i("regexp",[b,f])})}function t(a){function b(a){var c=a+d();if(HOP(OPERATORS,c)){e();return b(c)}return a}return i("operator",b(a||e()))}var u=b?function(){e();switch(d()){case"/":q();return y();case"*":r();return y()}return c.regex_allowed?s():t("/")}:function(){e();switch(d()){case"/":return q();case"*":return r()}return c.regex_allowed?s():t("/")};function v(){e();return is_digit(d())?m("."):i("punc",".")}function w(){var a=k(is_identifier_char);return HOP(KEYWORDS,a)?HOP(OPERATORS,a)?i("operator",a):HOP(KEYWORDS_ATOM,a)?i("atom",a):i("keyword",a):i("name",a)}function x(a,b){try{return b()}catch(b){if(b===EX_EOF)l(a);else throw b}}function y(a){if(a)return s();j(),h();var b=d();if(!b)return i("eof");if(is_digit(b))return m();if(b=="\""||b=="'")return p();if(HOP(PUNC_CHARS,b))return i("punc",e());if(b==".")return v();if(b=="/")return u();if(HOP(OPERATOR_CHARS,b))return t();if(is_identifier_char(b))return w();l("Unexpected character '"+b+"'")}y.context=function(a){a&&(c=a);return c};return y}var UNARY_PREFIX=array_to_hash(["typeof","void","delete","--","++","!","~","-","+"]),UNARY_POSTFIX=array_to_hash(["--","++"]),ASSIGNMENT=function(a,b,c){while(c<a.length)b[a[c]]=a[c].substr(0,a[c].length-1),c++;return b}(["+=","-=","/=","*=","%=",">>=","<<=",">>>=","~=","%=","|=","^=","&="],{"=":true},0),PRECEDENCE=function(a,b){for(var c=0,d=1;c<a.length;++c,++d){var e=a[c];for(var f=0;f<e.length;++f)b[e[f]]=d}return b}([["||"],["&&"],["|"],["^"],["&"],["==","===","!=","!=="],["<",">","<=",">=","in","instanceof"],[">>","<<",">>>"],["+","-"],["*","/","%"]],{}),STATEMENTS_WITH_LABELS=array_to_hash(["for","do","while","switch"]),ATOMIC_START_TOKEN=array_to_hash(["atom","num","string","regexp","name"]);function NodeWithToken(a,b,c){this.name=a,this.start=b,this.end=c}NodeWithToken.prototype.toString=function(){return this.name};function parse(a,b,c){var d={input:tokenizer(a,true),token:null,prev:null,peeked:null,in_function:0,in_loop:0,labels:[]};d.token=g();function e(a,b){return is_token(d.token,a,b)}function f(){return d.peeked||(d.peeked=d.input())}function g(){d.prev=d.token,d.peeked?(d.token=d.peeked,d.peeked=null):d.token=d.input();return d.token}function h(){return d.prev}function i(a,b,c,e){var f=d.input.context();js_error(a,b!=null?b:f.tokline,c!=null?c:f.tokcol,e!=null?e:f.tokpos)}function j(a,b){i(b,a.line,a.col)}function k(a){a==null&&(a=d.token),j(a,"Unexpected token: "+a.type+" ("+a.value+")")}function l(a,b){if(e(a,b))return g();j(d.token,"Unexpected token "+d.token.type+", expected "+a)}function m(a){return l("punc",a)}function n(){return!b&&(d.token.nlb||e("eof")||e("punc","}"))}function o(){e("punc",";")?g():n()||k()}function p(){return slice(arguments)}function q(){m("(");var a=U();m(")");return a}function r(a,b,c){return new NodeWithToken(a,b,c)}var s=c?function(){var a=d.token,b=t();b[0]=r(b[0],a,h());return b}:t;function t(){e("operator","/")&&(d.peeked=null,d.token=d.input(true));switch(d.token.type){case"num":case"string":case"regexp":case"operator":case"atom":return v();case"name":return is_token(f(),"punc",":")?u(prog1(d.token.value,g,g)):v();case"punc":switch(d.token.value){case"{":return p("block",A());case"[":case"(":return v();case";":g();return p("block");default:k()};case"keyword":switch(prog1(d.token.value,g)){case"break":return w("break");case"continue":return w("continue");case"debugger":o();return p("debugger");case"do":return function(a){l("keyword","while");return p("do",prog1(q,o),a)}(V(s));case"for":return x();case"function":return y(true);case"if":return z();case"return":d.in_function==0&&i("'return' outside of function");return p("return",e("punc",";")?(g(),null):n()?null:prog1(U,o));case"switch":return p("switch",q(),B());case"throw":return p("throw",prog1(U,o));case"try":return C();case"var":return prog1(E,o);case"const":return prog1(F,o);case"while":return p("while",q(),V(s));case"with":return p("with",q(),s());default:k()}}}function u(a){d.labels.push(a);var c=d.token,e=s();b&&!HOP(STATEMENTS_WITH_LABELS,e[0])&&k(c),d.labels.pop();return p("label",a,e)}function v(){return p("stat",prog1(U,o))}function w(a){var b=e("name")?d.token.value:null;b!=null?(g(),member(b,d.labels)||i("Label "+b+" without matching loop or statement")):d.in_loop==0&&i(a+" not inside a loop or switch"),o();return p(a,b)}function x(){m("(");var a=e("keyword","var");a&&g();if(e("name")&&is_token(f(),"operator","in")){var b=d.token.value;g(),g();var c=U();m(")");return p("for-in",a,b,c,V(s))}var h=e("punc",";")?null:a?E():U();m(";");var i=e("punc",";")?null:U();m(";");var j=e("punc",")")?null:U();m(")");return p("for",h,i,j,V(s))}function y(a){var b=e("name")?prog1(d.token.value,g):null;a&&!b&&k(),m("(");return p(a?"defun":"function",b,function(a,b){while(!e("punc",")"))a?a=false:m(","),e("name")||k(),b.push(d.token.value),g();g();return b}(true,[]),function(){++d.in_function;var a=d.in_loop;d.in_loop=0;var b=A();--d.in_function,d.in_loop=a;return b}())}function z(){var a=q(),b=s(),c;e("keyword","else")&&(g(),c=s());return p("if",a,b,c)}function A(){m("{");var a=[];while(!e("punc","}"))e("eof")&&k(),a.push(s());g();return a}var B=curry(V,function(){m("{");var a=[],b=null;while(!e("punc","}"))e("eof")&&k(),e("keyword","case")?(g(),b=[],a.push([U(),b]),m(":")):e("keyword","default")?(g(),m(":"),b=[],a.push([null,b])):(b||k(),b.push(s()));g();return a});function C(){var a=A(),b,c;if(e("keyword","catch")){g(),m("("),e("name")||i("Name expected");var f=d.token.value;g(),m(")"),b=[f,A()]}e("keyword","finally")&&(g(),c=A()),!b&&!c&&i("Missing catch/finally blocks");return p("try",a,b,c)}function D(){var a=[];for(;;){e("name")||k();var b=d.token.value;g(),e("operator","=")?(g(),a.push([b,U(false)])):a.push([b]);if(!e("punc",","))break;g()}return a}function E(){return p("var",D())}function F(){return p("const",D())}function G(){var a=H(false),b;e("punc","(")?(g(),b=I(")")):b=[];return N(p("new",a,b),true)}function H(a){if(e("operator","new")){g();return G()}if(e("operator")&&HOP(UNARY_PREFIX,d.token.value))return O("unary-prefix",prog1(d.token.value,g),H(a));if(e("punc")){switch(d.token.value){case"(":g();return N(prog1(U,curry(m,")")),a);case"[":g();return N(J(),a);case"{":g();return N(K(),a)}k()}if(e("keyword","function")){g();return N(y(false),a)}if(HOP(ATOMIC_START_TOKEN,d.token.type)){var b=d.token.type=="regexp"?p("regexp",d.token.value[0],d.token.value[1]):p(d.token.type,d.token.value);return N(prog1(b,g),a)}k()}function I(a,b){var c=true,d=[];while(!e("punc",a)){c?c=false:m(",");if(b&&e("punc",a))break;d.push(U(false))}g();return d}function J(){return p("array",I("]",!b))}function K(){var a=true,c=[];while(!e("punc","}")){a?a=false:m(",");if(!b&&e("punc","}"))break;var d=L();m(":");var f=U(false);c.push([d,f])}g();return p("object",c)}function L(){switch(d.token.type){case"num":case"string":return prog1(d.token.value,g)}return M()}function M(){switch(d.token.type){case"name":case"operator":case"keyword":case"atom":return prog1(d.token.value,g);default:k()}}function N(a,b){if(e("punc",".")){g();return N(p("dot",a,M()),b)}if(e("punc","[")){g();return N(p("sub",a,prog1(U,curry(m,"]"))),b)}if(b&&e("punc","(")){g();return N(p("call",a,I(")")),true)}if(b&&e("operator")&&HOP(UNARY_POSTFIX,d.token.value))return prog1(curry(O,"unary-postfix",d.token.value,a),g);return a}function O(a,b,c){(b=="++"||b=="--")&&!S(c)&&i("Invalid use of "+b+" operator");return p(a,b,c)}function P(a,b){var c=e("operator")?d.token.value:null,f=c!=null?PRECEDENCE[c]:null;if(f!=null&&f>b){g();var h=P(H(true),f);return P(p("binary",c,a,h),b)}return a}function Q(){return P(H(true),0)}function R(){var a=Q();if(e("operator","?")){g();var b=U(false);m(":");return p("conditional",a,b,U(false))}return a}function S(a){switch(a[0]){case"dot":case"sub":return true;case"name":return a[1]!="this"}}function T(){var a=R(),b=d.token.value;if(e("operator")&&HOP(ASSIGNMENT,b)){if(S(a)){g();return p("assign",ASSIGNMENT[b],a,T())}i("Invalid assignment")}return a}function U(a){arguments.length==0&&(a=true);var b=T();if(a&&e("punc",",")){g();return p("seq",b,U())}return b}function V(a){try{++d.in_loop;return a()}finally{--d.in_loop}}return p("toplevel",function(a){while(!e("eof"))a.push(s());return a}([]))}function curry(a){var b=slice(arguments,1);return function(){return a.apply(this,b.concat(slice(arguments)))}}function prog1(a){a instanceof Function&&(a=a());for(var b=1,c=arguments.length;--c>0;++b)arguments[b]();return a}function array_to_hash(a){var b={};for(var c=0;c<a.length;++c)b[a[c]]=true;return b}function slice(a,b){return Array.prototype.slice.call(a,b==null?0:b)}function characters(a){return a.split("")}function member(a,b){for(var c=b.length;--c>=0;)if(b[c]===a)return true;return false}function HOP(a,b){return Object.prototype.hasOwnProperty.call(a,b)}exports.tokenizer=tokenizer,exports.parse=parse,exports.slice=slice,exports.curry=curry,exports.member=member,exports.array_to_hash=array_to_hash,exports.PRECEDENCE=PRECEDENCE,exports.KEYWORDS_ATOM=KEYWORDS_ATOM,exports.RESERVED_WORDS=RESERVED_WORDS,exports.KEYWORDS=KEYWORDS,exports.ATOMIC_START_TOKEN=ATOMIC_START_TOKEN,exports.OPERATORS=OPERATORS,exports.is_alphanumeric_char=is_alphanumeric_char;var jsp={};jsp.tokenizer=tokenizer,jsp.parse=parse,jsp.slice=slice,jsp.curry=curry,jsp.member=member,jsp.array_to_hash=array_to_hash,jsp.PRECEDENCE=PRECEDENCE,jsp.KEYWORDS_ATOM=KEYWORDS_ATOM,jsp.RESERVED_WORDS=RESERVED_WORDS,jsp.KEYWORDS=KEYWORDS,jsp.ATOMIC_START_TOKEN=ATOMIC_START_TOKEN,jsp.OPERATORS=OPERATORS,jsp.is_alphanumeric_char=is_alphanumeric_char;var slice=jsp.slice,member=jsp.member,PRECEDENCE=jsp.PRECEDENCE,OPERATORS=jsp.OPERATORS;function ast_walker(a){function b(a){return a.map(function(a){var b=[a[0]];a.length>1&&(b[1]=f(a[1]));return b})}var c={string:function(a){return["string",a]},num:function(a){return["num",a]},name:function(a){return["name",a]},toplevel:function(a){return["toplevel",a.map(f)]},block:function(a){var b=["block"];a!=null&&b.push(a.map(f));return b},"var":function(a){return["var",b(a)]},"const":function(a){return["const",b(a)]},"try":function(a,b,c){return["try",a.map(f),b!=null?[b[0],b[1].map(f)]:null,c!=null?c.map(f):null]},"throw":function(a){return["throw",f(a)]},"new":function(a,b){return["new",f(a),b.map(f)]},"switch":function(a,b){return["switch",f(a),b.map(function(a){return[a[0]?f(a[0]):null,a[1].map(f)]})]},"break":function(a){return["break",a]},"continue":function(a){return["continue",a]},conditional:function(a,b,c){return["conditional",f(a),f(b),f(c)]},assign:function(a,b,c){return["assign",a,f(b),f(c)]},dot:function(a){return["dot",f(a)].concat(slice(arguments,1))},call:function(a,b){return["call",f(a),b.map(f)]},"function":function(a,b,c){return["function",a,b.slice(),c.map(f)]},defun:function(a,b,c){return["defun",a,b.slice(),c.map(f)]},"if":function(a,b,c){return["if",f(a),f(b),f(c)]},"for":function(a,b,c,d){return["for",f(a),f(b),f(c),f(d)]},"for-in":function(a,b,c,d){return["for-in",a,b,f(c),f(d)]},"while":function(a,b){return["while",f(a),f(b)]},"do":function(a,b){return["do",f(a),f(b)]},"return":function(a){return["return",f(a)]},binary:function(a,b,c){return["binary",a,f(b),f(c)]},"unary-prefix":function(a,b){return["unary-prefix",a,f(b)]},"unary-postfix":function(a,b){return["unary-postfix",a,f(b)]},sub:function(a,b){return["sub",f(a),f(b)]},object:function(a){return["object",a.map(function(a){return[a[0],f(a[1])]})]},regexp:function(a,b){return["regexp",a,b]},array:function(a){return["array",a.map(f)]},stat:function(a){return["stat",f(a)]},seq:function(){return["seq"].concat(slice(arguments).map(f))},label:function(a,b){return["label",a,f(b)]},"with":function(a,b){return["with",f(a),f(b)]},atom:function(a){return["atom",a]}},d={},e=[];function f(a){if(a==null)return null;try{e.push(a);var b=a[0],f=d[b];if(f){var g=f.apply(a,a.slice(1));if(g!=null)return g}f=c[b];return f.apply(a,a.slice(1))}finally{e.pop()}}function g(a,b){var c={},e;for(e in a)HOP(a,e)&&(c[e]=d[e],d[e]=a[e]);try{return b()}finally{for(e in c)HOP(c,e)&&(c[e]?d[e]=c[e]:delete d[e])}}return{walk:f,with_walkers:g,parent:function(){return e[e.length-2]},stack:function(){return e}}}function Scope(a){this.names={},this.mangled={},this.rev_mangled={},this.cname=-1,this.refs={},this.uses_with=false,this.uses_eval=false,this.parent=a,this.children=[],a?(this.level=a.level+1,a.children.push(this)):this.level=0}var base54=function(){var a="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_";return function(b){var c="";do c=a.charAt(b%54)+c,b=Math.floor(b/54);while(b>0);return c}}();Scope.prototype={has:function(a){for(var b=this;b;b=b.parent)if(HOP(b.names,a))return b},has_mangled:function(a){for(var b=this;b;b=b.parent)if(HOP(b.rev_mangled,a))return b},toJSON:function(){return{names:this.names,uses_eval:this.uses_eval,uses_with:this.uses_with}},next_mangled:function(){for(;;){var a=base54(++this.cname),b;b=this.has_mangled(a);if(b&&this.refs[b.rev_mangled[a]]===b)continue;b=this.has(a);if(b&&b!==this&&this.refs[a]===b&&!b.has_mangled(a))continue;if(HOP(this.refs,a)&&this.refs[a]==null)continue;if(!is_identifier(a))continue;return a}},get_mangled:function(a,b){if(this.uses_eval||this.uses_with)return a;var c=this.has(a);if(!c)return a;if(HOP(c.mangled,a))return c.mangled[a];if(!b)return a;var d=c.next_mangled();c.rev_mangled[d]=a;return c.mangled[a]=d},define:function(a){if(a!=null)return this.names[a]=a}};function ast_add_scope(a){var b=null,c=ast_walker(),d=c.walk,e=[];function f(a){b=new Scope(b);try{var c=b.body=a();c.scope=b;return c}finally{b=b.parent}}function g(a){return b.define(a)}function h(a){b.refs[a]=true}function i(a,b,c){return[this[0],g(a),b,f(function(){b.map(g);return c.map(d)})]}return f(function(){var j=c.with_walkers({"function":i,defun:i,"with":function(a,c){for(var d=b;d;d=d.parent)d.uses_with=true},"var":function(a){a.map(function(a){g(a[0])})},"const":function(a){a.map(function(a){g(a[0])})},"try":function(a,b,c){if(b!=null)return["try",a.map(d),f(function(){return[g(b[0]),b[1].map(d)]}),c!=null?c.map(d):null]},name:function(a){a=="eval"&&e.push(b),h(a)},"for-in":function(a,b){a?g(b):h(b)}},function(){return d(a)});e.map(function(a){if(!a.has("eval"))while(a)a.uses_eval=true,a=a.parent});function k(a,b){for(b=a.children.length;--b>=0;)k(a.children[b]);for(b in a.refs)if(HOP(a.refs,b))for(var c=a.has(b),d=a;d;d=d.parent){d.refs[b]=c;if(d===c)break}}k(b);return j})}function ast_mangle(a,b){var c=ast_walker(),d=c.walk,e;function f(a,c){if(!b&&!e.parent)return a;return e.get_mangled(a,c)}function g(a,b,c){a&&(a=f(a)),c=h(c.scope,function(){b=b.map(function(a){return f(a)});return c.map(d)});return[this[0],a,b,c]}function h(a,b){var c=e;e=a;for(var d in a.names)HOP(a.names,d)&&f(d,true);try{var g=b();g.scope=a;return g}finally{e=c}}function i(a){return a.map(function(a){return[f(a[0]),d(a[1])]})}return c.with_walkers({"function":g,defun:g,"var":function(a){return["var",i(a)]},"const":function(a){return["const",i(a)]},name:function(a){return["name",f(a)]},"try":function(a,b,c){return["try",a.map(d),b?h(b.scope,function(){return[f(b[0]),b[1].map(d)]}):null,c!=null?c.map(d):null]},toplevel:function(a){return h(this.scope,function(){return["toplevel",a.map(d)]})},"for-in":function(a,b,c,e){return["for-in",a,f(b),d(c),d(e)]}},function(){return d(ast_add_scope(a))})}var sys=require("sys");function warn(a){sys.debug(a)}function ast_squeeze(a,b){b=defaults(b,{make_seqs:true,dead_code:true,no_warnings:false});var c=ast_walker(),d=c.walk;function e(a){return a[0]=="string"||a[0]=="num"}function f(a){a!=null&&a[0]=="block"&&a[1]&&a[1].length==1&&(a=a[1][0]);return a}function g(a,b,c){return[this[0],a,b,h(c.map(d))]}function h(a){var c,d;for(var e=0,f=[];e<a.length;++e)c=a[e],c[0]=="block"?c[1]&&f.push.apply(f,c[1]):f.push(c);d=null;for(var e=0,g=[];e<f.length;++e)c=f[e],d&&(c[0]=="var"&&d[0]=="var"||c[0]=="const"&&d[0]=="const")?d[1]=d[1].concat(c[1]):(g.push(c),d=c);if(b.dead_code){var h=[],i=false;g.forEach(function(a){i?member(a[0],["function","defun","var","const"])?h.push(a):b.no_warnings||warn("Removing unreachable code: "+gen_code(a,true)):(h.push(a),member(a[0],["return","throw","break","continue"])&&(i=true))}),g=h}if(!b.make_seqs)return g;d=null;for(var e=0,j=[];e<g.length;++e)c=g[e],d?c[0]=="stat"&&d[0]=="stat"?d[1]=["seq",d[1],c[1]]:(j.push(c),d=null):(j.push(c),c[0]=="stat"&&(d=c));return j}function i(a,b){return gen_code(a).length>gen_code(b[0]=="stat"?b[1]:b).length?b:a}function j(a){a[0]=="block"&&a[1]&&a[1].length>0&&(a=a[1][a[1].length-1]);if(a[0]=="return"||a[0]=="break"||a[0]=="continue"||a[0]=="throw")return true}function k(a,b,c){return a[0]=="unary-prefix"&&a[1]=="!"?c?["conditional",a[2],c,b]:["binary","||",a[2],b]:c?["conditional",a,b,c]:["binary","&&",a,b]}function l(a){return!a||a[0]=="block"&&(!a[1]||a[1].length==0)}return c.with_walkers({sub:function(a,b){if(b[0]=="string"){var c=b[1];if(is_identifier(c))return["dot",d(a),c]}},"if":function(a,b,c){a=d(a),b=d(b),c=d(c);var e=a[0]=="unary-prefix"&&a[1]=="!";l(b)&&(e?a=a[2]:a=["unary-prefix","!",a],b=c,c=null);if(l(c))c=null;else if(e){a=a[2];var f=b;b=c,c=f}if(l(c)&&l(b))return["stat",a];var g=["if",a,b,c];b[0]=="stat"?c?c[0]=="stat"&&(g=i(g,["stat",k(a,b[1],c[1])])):g=i(g,["stat",k(a,b[1])]):c&&b[0]==c[0]&&(b[0]=="return"||b[0]=="throw")?g=i(g,[b[0],k(a,b[1],c[1])]):c&&j(b)&&(g=[["if",a,b]],c[0]=="block"?c[1]&&(g=g.concat(c[1])):g.push(c),g=d(["block",g]));return g},toplevel:function(a){return["toplevel",h(a.map(d))]},"switch":function(a,b){var c=b.length-1;return["switch",d(a),b.map(function(a,b){var e=h(a[1].map(d));if(b==c&&e.length>0){var f=e[e.length-1];f[0]=="break"&&!f[1]&&e.pop()}return[a[0]?d(a[0]):null,e]})]},"function":g,defun:g,block:function(a){if(a)return f(["block",h(a.map(d))])},binary:function(a,b,c){b=d(b),c=d(c);var f=["binary",a,b,c];if(e(b)&&e(c)){var g=null;switch(a){case"+":g=b[1]+c[1];break;case"*":g=b[1]*c[1];break;case"/":g=b[1]/c[1];break;case"-":g=b[1]-c[1];break;case"<<":g=b[1]<<c[1];break;case">>":g=b[1]>>c[1];break;case">>>":g=b[1]>>>c[1]}g!=null&&(f=i(f,[typeof g=="string"?"string":"num",g]))}return f},conditional:function(a,b,c){return k(d(a),d(b),d(c))},"try":function(a,b,c){return["try",h(a.map(d)),b!=null?[b[0],h(b[1].map(d))]:null,c!=null?h(c.map(d)):null]}},function(){return d(a)})}var DOT_CALL_NO_PARENS=jsp.array_to_hash(["name","array","string","dot","sub","call","regexp"]);function gen_code(a,b){b&&(b=defaults(b,{indent_start:0,indent_level:4,quote_keys:false,space_colon:false}));var c=0,d=b?"\n":"",e=b?" ":"";function f(a){a==null&&(a=""),b&&(a=repeat_string(" ",b.indent_start+c*b.indent_level)+a);return a}function g(a,b){b==null&&(b=1),c+=b;try{return a.apply(null,slice(arguments,1))}finally{c-=b}}function h(a){if(b)return a.join(" ");var c=[];for(var d=0;d<a.length;++d){var e=a[d+1];c.push(a[d]),e&&(/[a-z0-9_\x24]$/i.test(a[d].toString())&&/^[a-z0-9_\x24]/i.test(e.toString())||/[\+\-]$/.test(a[d].toString())&&/^[\+\-]/.test(e.toString()))&&c.push(" ")}return c.join("")}function i(a){return a.join(","+e)}function j(a){var b=x(a);for(var c=1;c<arguments.length;++c){var d=arguments[c];if(d instanceof Function&&d(a)||a[0]==d)return"("+b+")"}return b}function k(a){if(a.length==1)return a[0];if(a.length==2){var b=a[1];a=a[0];return a.length<=b.length?a:b}return k([a[0],k(a.slice(1))])}function l(a){if(a[0]=="function"){var b=slice(w),c=b.pop(),d=b.pop();while(true){if(d[0]=="stat")return true;if(d[0]=="seq"&&d[1]===c||d[0]=="call"&&d[1]===c||d[0]=="binary"&&d[2]===c)c=d,d=b.pop();else return false}}return!HOP(DOT_CALL_NO_PARENS,a[0])}function m(a){var b=a.toString(10),c=[b.replace(/^0\./,".")],d;Math.floor(a)===a?(c.push("0x"+a.toString(16).toLowerCase(),"0"+a.toString(8)),(d=/^(.*?)(0+)$/.exec(a))&&c.push(d[1]+"e"+d[2].length)):(d=/^0?\.(0+)(.*)$/.exec(a))&&c.push(d[2]+"e-"+(d[1].length+1),b.substr(b.indexOf(".")));return k(c)}var n={string:q,num:m,name:r,toplevel:function(a){return s(a).join(d+d)},block:u,"var":function(a){return"var "+i(a.map(v))+";"},"const":function(a){return"const "+i(a.map(v))+";"},"try":function(a,b,c){var d=["try",u(a)];b&&d.push("catch","("+b[0]+")",u(b[1])),c&&d.push("finally",u(c));return h(d)},"throw":function(a){return h(["throw",x(a)])+";"},"new":function(a,b){b=b.length>0?"("+i(b.map(x))+")":"";return h(["new",j(a,"seq","binary","conditional","assign",function(a){var b=ast_walker(),c={};try{b.with_walkers({call:function(){throw c},"function":function(){return this}},function(){b.walk(a)})}catch(a){if(a===c)return true;throw a}})+b])},"switch":function(a,b){return h(["switch","("+x(a)+")",t(b)])},"break":function(a){var b="break";a!=null&&(b+=" "+r(a));return b+";"},"continue":function(a){var b="continue";a!=null&&(b+=" "+r(a));return b+";"},conditional:function(a,b,c){return h([j(a,"assign","seq","conditional"),"?",j(b,"seq"),":",j(c,"seq")])},assign:function(a,b,c){a&&a!==true?a+="=":a="=";return h([x(b),a,x(c)])},dot:function(a){var b=x(a),c=1;l(a)&&(b="("+b+")");while(c<arguments.length)b+="."+r(arguments[c++]);return b},call:function(a,b){var c=x(a);l(a)&&(c="("+c+")");return c+"("+i(b.map(x))+")"},"function":p,defun:p,"if":function(a,b,c){var d=["if","("+x(a)+")",c?o(b):x(b)];c&&d.push("else",x(c));return h(d)},"for":function(a,b,c,d){var f=["for"];a=(a!=null?x(a):"").replace(/;*\s*$/,";"+e),b=(b!=null?x(b):"").replace(/;*\s*$/,";"+e),c=(c!=null?x(c):"").replace(/;*\s*$/,"");var g=a+b+c;g=="; ; "&&(g=";;"),f.push("("+g+")",x(d));return h(f)},"for-in":function(a,b,c,d){var e=h(["for","("]);a&&(e+="var "),e+=h([r(b)+" in "+x(c)+")",x(d)]);return e},"while":function(a,b){return h(["while","("+x(a)+")",x(b)])},"do":function(a,b){return h(["do",x(b),"while","("+x(a)+")"])+";"},"return":function(a){var b=["return"];a!=null&&b.push(x(a));return h(b)+";"},binary:function(a,b,c){var d=x(b),e=x(c);if(member(b[0],["assign","conditional","seq"])||b[0]=="binary"&&PRECEDENCE[a]>PRECEDENCE[b[1]])d="("+d+")";if(member(c[0],["assign","conditional","seq"])||c[0]=="binary"&&PRECEDENCE[a]>=PRECEDENCE[c[1]])e="("+e+")";return h([d,a,e])},"unary-prefix":function(a,b){var c=x(b);b[0]=="num"||b[0]=="unary-prefix"&&!HOP(OPERATORS,a+b[1])||!l(b)||(c="("+c+")");return a+(jsp.is_alphanumeric_char(a.charAt(0))?" ":"")+c},"unary-postfix":function(a,b){var c=x(b);b[0]=="num"||b[0]=="unary-postfix"&&!HOP(OPERATORS,a+b[1])||!l(b)||(c="("+c+")");return c+a},sub:function(a,b){var c=x(a);l(a)&&(c="("+c+")");return c+"["+x(b)+"]"},object:function(a){if(a.length==0)return"{}";return"{"+d+g(function(){return a.map(function(a){var c=a[0],d=x(a[1]);b&&b.quote_keys?c=q(c):typeof c=="number"?c=m(c):is_identifier(c)||(c=q(c));return f(h(b&&b.space_colon?[c,":",d]:[c+":",d]))}).join(","+d)})+d+f("}")},regexp:function(a,b){return"/"+a+"/"+b},array:function(a){if(a.length==0)return"[]";return h(["[",i(a.map(x)),"]"])},stat:function(a){return x(a).replace(/;*\s*$/,";")},seq:function(){return i(slice(arguments).map(x))},label:function(a,b){return h([r(a),":",x(b)])},"with":function(a,b){return h(["with","("+x(a)+")",x(b)])},atom:function(a){return r(a)},comment1:function(a){return"//"+a+"\n"},comment2:function(a){return"/*"+a+"*/"}};function o(a){var b=a;while(true){var c=b[0];if(c=="if"){if(!b[3])return x(["block",[a]]);b=b[3]}else if(c=="while"||c=="do")b=b[2];else if(c=="for"||c=="for-in")b=b[4];else break}return x(a)}function p(a,b,c){var d="function";a&&(d+=" "+r(a)),d+="("+i(b.map(r))+")";return h([d,u(c)])}function q(a){return JSON.stringify(a)}function r(a){return a.toString()}function s(a){for(var c=[],d=a.length-1,e=0;e<=d;++e){var g=a[e],h=x(g);h!=";"&&(!b&&e==d&&(h=h.replace(/;+\s*$/,"")),c.push(h))}return c.map(f)}function t(a){var c=a.length;if(c==0)return"{}";return"{"+d+a.map(function(a,e){var i=a[1].length>0,j=g(function(){return f(a[0]?h(["case",x(a[0])+":"]):"default:")},.5)+(i?d+g(function(){return s(a[1]).join(d)}):"");!b&&i&&e<c-1&&(j+=";");return j}).join(d)+d+f("}")}function u(a){if(!a)return";";if(a.length==0)return"{}";return"{"+d+g(function(){return s(a).join(d)})+d+f("}")}function v(a){var b=a[0],c=a[1];c!=null&&(b=h([b,"=",x(c)]));return b}var w=[];function x(a){var b=a[0],c=n[b];if(!c)throw new Error("Can't find generator for \""+b+"\"");w.push(a);var d=c.apply(b,a.slice(1));w.pop(a);return d}return x(a)}function repeat_string(a,b){if(b<=0)return"";if(b==1)return a;var c=repeat_string(a,b>>1);c+=c,b&1&&(c+=a);return c}function defaults(a,b){var c={};a===true&&(a={});for(var d in b)HOP(b,d)&&(c[d]=a&&HOP(a,d)?a[d]:b[d]);return c}function is_identifier(a){return/^[a-z_$][a-z0-9_$]*$/i.test(a)&&!HOP(jsp.KEYWORDS_ATOM,a)&&!HOP(jsp.RESERVED_WORDS,a)&&!HOP(jsp.KEYWORDS,a)}function HOP(a,b){return Object.prototype.hasOwnProperty.call(a,b)}exports.ast_walker=ast_walker,exports.ast_mangle=ast_mangle,exports.ast_squeeze=ast_squeeze,exports.gen_code=gen_code,exports.ast_add_scope=ast_add_scope;var pro={};pro.ast_walker=ast_walker,pro.ast_mangle=ast_mangle,pro.ast_squeeze=ast_squeeze,pro.gen_code=gen_code,pro.ast_add_scope=ast_add_scope;var merge_objects,__hasProp=Object.prototype.hasOwnProperty;merge_objects=function(a,b){var c,d,e,f;d={},c=a;for(e in c){if(!__hasProp.call(c,e))continue;f=c[e],d[e]=f}c=b;for(e in c){if(!__hasProp.call(c,e))continue;f=c[e],typeof f==="object"?d[e]=merge_objects(d[e],f):d[e]=f}return d};function show_copyright(a){var b,c,d,e,f;f="",d=a;for(b=0,c=d.length;b<c;b++)e=d[b],e.type==="comment1"&&(f+="//"+e.value+"\n"),f+="/*"+e.value+"*/\n";return f}var default_options_compile={ast:false,mangle:true,mangle_toplevel:false,squeeze:true,make_seqs:true,dead_code:true,beautify:false,verbose:false,show_copyright:false,out_same_file:false,beautify_options:{indent_level:4,indent_start:0,quote_keys:false,space_colon:false},output:false};exports.compress_js=function compress_js(a,b){b=merge_objects(default_options_compile,b);var c,d,e,f,g;f="";if(b.show_copyright){e=[],g=jsp.tokenizer(a,false),d=g();while(/^comment/.test(d.type))e.push(d),d=g(),f+=show_copyright(e)}try{c=jsp.parse(a),b.ast=c,b.squeeze&&(c=pro.ast_squeeze(c,{make_seqs:b.make_seqs,dead_code:b.dead_code})),b.mangle&&(c=pro.ast_mangle(c,b.mangle_toplevel)),f+=pro.gen_code(c,b.beautify&&b.beautify_options);return f}catch(a){throw a}}