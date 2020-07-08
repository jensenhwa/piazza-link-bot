var markdown, toMarkdown, unencode;

toMarkdown = require('turndown');

markdown = function(html) {
  var converted, firstImgSrc;
  firstImgSrc = null;
  html = html.replace(/\n/g, '<br>');
  converted = toMarkdown(html, {
    converters: [
      {
        filter: 'p',
        replacement: function(content) {
          return "" + (content.replace(/\\/g, ''));
        }
      }, {
        filter: 'pre',
        replacement: function(content) {
          return "```" + content + "```";
        }
      }, {
        filter: 'tt',
        replacement: function(content) {
          return "`" + content + "`";
        }
      }, {
        filter: 'img',
        replacement: function(innerHTML, node) {
          firstImgSrc = node.getAttribute('src');
          return "<<" + firstImgSrc + "|img>>";
        }
      }, {
        filter: 'a',
        replacement: function(innerHTML, node) {
          var href;
          href = node.getAttribute('href');
          return "<" + href + "|" + innerHTML + ">";
        }
      }, {
        filter: ['strong', 'b'],
        replacement: function(content) {
          return "*" + content + "*";
        }
      }
    ]
  });
  converted = converted.replace(/<<([^\|]+)\|img>>/, '<<$1|img> (attached)>');
  return {
    markdown: converted,
    firstImgSrc: firstImgSrc
  };
};

unencode = function(str) {
  return str.replace(/&#(\d+);/g, function(match, g1) {
    return String.fromCharCode(g1);
  });
};

module.exports = {
  markdown: markdown,
  unencode: unencode
};