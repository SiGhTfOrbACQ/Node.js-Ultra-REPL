var util = require('util');
var path = require('path');
var EventEmitter = require('events').EventEmitter;

var Iterable = require('../lib/Iterable').Iterable;
var Context = require('./Context');

module.exports = Evaluator;

function Evaluator(){
  EventEmitter.call(this);
  this.contexts = new Iterable;
  this.current = new Context(true);
  this.iterator =  this.contexts.__iterator__();
  this.contexts.add('global', this.current);
  var self = this;
  Object.defineProperty(this.current, 'columns', { get: function(){ return self.columns } });
  this.tryContext = new Context;
}


Evaluator.prototype = {
  __proto__: Object.create(EventEmitter.prototype),
  constructor: Evaluator,

  get index(){    return this.iterator.current },
  get count(){    return this.contexts.count() },
  get ctx(){      return this.current.ctx      },

  get builtins(){ return this.current.builtins },
  get hiddens(){  return this.current.hiddens  },
  get protos(){   return this.current.protos   },
  get colors(){   return this.current.colors   },
  get depth(){    return this.current.depth    },
  get name(){     return this.current.name     },
  get _(){        return this.current.ctx._    },

  set builtins(v){ this.current.builtins = v },
  set hiddens(v){  this.current.hiddens = v  },
  set protos(v){   this.current.protos = v   },
  set colors(v){   this.current.colors = v   },
  set depth(v){    this.current.depth = v    },
  set name(v){     this.current.name = v     },
  set _(v){        this.current.ctx._ = v    },

  create: function create(){
    var context = new Context;
    this.contexts.add(context.name, context);
    var self = this;
    Object.defineProperty(context, 'columns', { get: function(){ return self.columns } });
    this.iterator.current = this.contexts.count() - 1;
    return this.current = context;
  },

  change: function change(to){
    var context = this.iterator.advance(to);
    if (context && this.current.ctx === context.ctx) {
      return new Error("no other contexts");
    }
    return this.current = context;
  },

  remove: function remove(){
    if (this.current.ctx === global) {
      return new Error("can't remove global");
    }
    var current = this.current;
    this.contexts.remove(this.current.name);
    if (this.iterator.current === this.contexts.count()) {
      this.iterator.current--;
    }
    this.current = this.iterator.item();
    return current;
  },

  reset: function reset(){
    if (this.current.ctx === global) {
      return new Error("can't reset global");
    }
    for (var i in require.cache) {
     delete require.cache[i];
    }
    return this.current.initialize();
  },

  evaluate: function evaluate(code){
    var output = {
      status: 'success',
      code: code.trim()
    };
    output.result = syntaxTry(code);
    if (output.result.name === 'SyntaxError') {
      output.status = 'syntax_error';
    } else {
      output.code = output.result;
      try {
        output.result = this.tryContext.runCode(output.code);
      } catch (e) {
        output.result = e;
        output.status = e.name === 'SyntaxError' ? 'syntax_error' : 'error';
      }
      if (output.status !== 'syntax_error') {
        try {
          output.result = this.current.runCode(output.code);
          output.status = 'success';
        } catch (e) {
          output.result = e;
          output.status = 'error';
        }
      }
    }
    this.current.history.push(output);
    return output;
  }
};


function parsify(src){
  try {
    Function(src);
    return true;
  } catch (e) {
    return e;
  }
}

function syntaxTry(src){
  var result;
  src = src || '';
  if ((result = parsify(src)) === true) return src;
  src += ';';
  if ((result = parsify(src)) === true) return src;
  src = '( ' + src + '\n)';
  if ((result = parsify(src)) === true) return src;
  return result;
}

function scoped(cmd) {
  cmd.replace(/^\s*function\s*([_\w\$]+)/g, '$1 = function $1' + cmd)
  cmd.replace(/^\s*var\s*([_\w\$]+)(.*)$/g, 'global.$1$2');
  return cmd;
};