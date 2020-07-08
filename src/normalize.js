var TurndownService = require('turndown');
var turndownService = new TurndownService({codeBlockStyle: 'fenced'})
turndownService.addRule('paragraph', {
  filter: 'p',
  replacement: function(content) {
    return "" + (content.replace(/\\/g, ''));
  }
})
turndownService.addRule('teletype', {
  filter: 'tt',
  replacement: function(content) {
    return "`" + content + "`";
  }
})
turndownService.addRule('image', {
  filter: 'img',
  replacement: function(innerHTML, node) {
    firstImgSrc = node.getAttribute('src');
    return "<<" + firstImgSrc + "|img>>";
  }
})
turndownService.addRule('link', {
  filter: 'a',
  replacement: function(innerHTML, node) {
    var href;
    href = node.getAttribute('href');
    return "<" + href + "|" + innerHTML + ">";
  }
})
turndownService.addRule('bold', {
  filter: ['strong', 'b'],
  replacement: function(content) {
    return "*" + content + "*";
  }
})

var markdown = function(html) {
  var converted, firstImgSrc;
  firstImgSrc = null;
  html = html.replace(/\n/g, '<br>');
  converted = turndownService.turndown(html)
  converted = converted.replace(/<<([^\|]+)\|img>>/, '<<$1|img> (attached)>');
  return {
    markdown: converted,
    firstImgSrc: firstImgSrc
  };
};

var unencode = function(str) {
  return str.replace(/&#(\d+);/g, function(match, g1) {
    return String.fromCharCode(g1);
  });
};

module.exports = {
  markdown: markdown,
  unencode: unencode
};