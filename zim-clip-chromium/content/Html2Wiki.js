/**
 *  Objet de conversion de code HTML en syntaxe wiki
 *  
 *  Syntax rules:
 *  -------------
 *    
 *  {Function} open:
 *      called when a DOM node is opened. It receives that node as a 
 *      parameter and MUST return a string describing the opening of the 
 *      node in the wiki syntax.
 *  
 *  {Function} close:
 *      Called when a DOM node is closed. It receives that node as a 
 *      parameter and MUST return a string describing the closing of the 
 *      node in the wiki syntax.
 *  
 *  {Function} postClose:
 *      Called when a DOM Node is closed. It receives the wiki string 
 *      generated for that node. If it returns something, it will replace 
 *      the generated string.
 *  
 *  {Boolean} raw:
 *      Flag indicating that the content of a node parsed by that rule 
 *      should be rendered in the wiki string as is, without parsing.
 *  
 *  @param {String} name Liste des règles de conversion 
 */
class Html2Wiki {
    
    /**
     * 
     * @param {String} name Ruleset name
     * @param {Object} rules Rules
     */
    static addRuleset (name, rules) {
        Html2Wiki.rulesets[name] = rules;
    }

    static getRuleset (name) {
        return Html2Wiki.rulesets[name] || null;
    }

    /**
     * 
     * @param {String} name Ruleset name
     */
    constructor (name) {
        this.use(name);
    }

    use (rulesetName) {
        /**
         *  @private
         *  @type {String}
         */
        this.name = rulesetName;
        if (!Html2Wiki.rulesets[this.name]) {
            console.warn('rules not defined'); // eslint-disable-line no-console
            Html2Wiki.rulesets[this.name] = {};
        }
    }

    /**
     *  Return a defined rule.
     *  
     *  @param {String} name Rule name
     *  @return {Object} The rule if it is defined or null.
     */
    getRule (name) {
        if (this.hasRule(name)) {
            return Html2Wiki.rulesets[this.name][name];
        }
        return null;
    }
        
    findRule (node) {
        var nodeName = node.nodeName.toLowerCase();
        if (this.hasRule(nodeName)) {
            return Html2Wiki.rulesets[this.name][nodeName];
        }
        if (/^h\d$/.test(nodeName) && this.hasRule('h')) {
            return Html2Wiki.rulesets[this.name].h;
        }
        if ((nodeName === 'ul' || nodeName === 'ol') && this.hasRule('list')) {
            return Html2Wiki.rulesets[this.name].list;
        }
        if (node.src) {
            return Html2Wiki.rulesets[this.name].src;
        }
        return Html2Wiki.DEFAULT_RULE;
    }
    
    hasRule (name) {
        return Html2Wiki.rulesets[this.name].hasOwnProperty(name);
    }
        
    cleanText (text) {
        text = text.replace(Html2Wiki.RE_NEW_LINE, ' ');
        //text = text.replace(Html2Wiki.RE_LEADING_SPACES, '');
        text = text.replace(Html2Wiki.RE_SPACES, ' ');
        return text;
    }
        
    /**
     *  Read an DOM node and convert it in a wiki string
     *  
     *  @param {Node} node Noeud à convertir
     *  @return {String} String representation
     */
    read (node) {
        if (node.nodeType === Node.TEXT_NODE) {
            // Text node
            return this.cleanText(node.nodeValue);
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            // node
            return this.getNode(node);
        } 
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
                node.childNodes.length > 0) {
            // fragment
            return this.getChildNodes(node.childNodes);
        }
        return '';
    }
    
    /**
     *  @param {Node[]} childNodes List of nodes
     *  @return {String} String representation
     */
    getChildNodes (childNodes) {
        var res = '',
            append = '',
            i = 0,
            n = childNodes.length;
        for (i = 0; i < n; i += 1) {
            append = this.getNode(childNodes[i]);
            if (append === ' ' && res.endsWith("\n")) { // eslint-disable-line quotes
                append = '';
            } else {
                append = append.replace(Html2Wiki.RE_RIGHT_SPACES, '');
            }
            res += append;
        }
        return res;
    }
        
    /**
     *  @param {Node} node
     *  @return {String}
     */
    getNode (node) {
        var out = '',
            nodeName = node.nodeName.toLowerCase(),
            rule = null,
            current,
            postOut = null;
        // Avoid script and style
        if (nodeName === 'script' || nodeName === 'style') {
            return '';
        }
        // text node
        if (node.nodeType === Node.TEXT_NODE) {
            return this.cleanText(node.nodeValue);
        }
        rule = this.findRule(node);
        if (rule.open) {
            current = rule.open(node);
        }
        // read children
        if (rule.raw) {
            current += node.textContent.trim();
        } else if (node.childNodes.length > 0) {
            current += this.getChildNodes(node.childNodes);
        }
        // close
        if (rule.close) {
            current += rule.close(node);
        }
        if (rule.postClose) {
            postOut = rule.postClose(current);
            if (postOut) {
                current = postOut;
            }
        }        
        out += current;
        
        return out;
    }
}

/**
 *  Règle de conversion par défaut
 *  @type Object
 */
Html2Wiki.DEFAULT_RULE = {
    open: function () {
        'use strict';
        return '';
    },
    close: function () {
        'use strict';
        return '';
    }
};

Html2Wiki.RE_NEW_LINE = new RegExp("[\t\n\r]", 'gm'); // eslint-disable-line
Html2Wiki.RE_SPACES = new RegExp(' {2,}', 'g');
Html2Wiki.RE_LEADING_SPACES = new RegExp('^ {2,}', 'gm');
Html2Wiki.RE_NOT_WHITE_SPACE = new RegExp('\\S');
Html2Wiki.RE_RIGHT_SPACES = new RegExp(' {2,}$', 'gm');

Html2Wiki.rulesets = {};

Html2Wiki.addRuleset('zim', {
    'a': {
        open: function (node) {return node.href ? '[[' + node.href + '|' : '';},
        close: function (node) {return node.href ? ']]' : '';}
    },
    
    'abbr': {
        open: function () {return '';},
        close: function (node) {return node.title ? ' (' + node.title + ')' : '';}
    },
    
    'blockquote': {
        open: function () {return '';},
        close: function () {return '';},
        postClose: function (content) {
            var w = content.trim().split('\n'),
                n = w.length,
                i = 0;
            for (i = 0; i < n; i += 1) {
                w[i] = '> ' + w[i];
            }
            return '\n' + w.join('\n') + '\n';
        }
    },
    
    'br': {
        open: function () {return '';},
        close: function () {return '\n';}
    },

    'caption': {
        open: function () {return '';},
        close: function () {return '\n';},
        postClose: function (content) {
            return content.trim();
        }
    },

    'code': {
        open: function () {return '\'\'';},
        close: function () {return '\'\'';}
    },
    
    'del': {
        open: function () {return '~~';},
        close: function (node) {return (node.datetime ? ' (' + node.datetime + ')' : '') + '~~';}
    },

    'dd': {
        open: function () {return '';},
        close: function () {return '';},
        postClose: function (content) {
            var w = content.trim().split('\n'),
                n = w.length,
                i = 0;
            for (i = 0; i < n; i += 1) {
                w[i] = '    ' + w[i];
            }
            return w.join('\n');
        }
    },

    'dl': {
        open: function () {return '\n';},
        close: function () {return '\n';}
    },
    
    'dt': {
        open: function (node) {return node.previousElementSibling ? '\n' :  '';},
        close: function () {return ':\n';}
    },

    'em': {
        open: function () {return '//';},
        close: function () {return '//';}
    },

    'i': {
        open: function () {return '//';},
        close: function () {return '//';}
    },
    
    'figure': {
        open: function () {return '\n';},
        close: function () {return '\n';}
    },
    
    'h': {
        raw: true,
        prefixes: {},
        getPrefix: function (level) {
            if (!this.prefixes[level]) {
                let prefix = '=',
                    len = 7 - level;
                if (len > 1) {
                    prefix = prefix.padEnd(len, '=');
                }
                this.prefixes[level] = prefix;
            }
            return this.prefixes[level];
        },
        open: function (node) {
            return `\n${this.getPrefix(Number(node.nodeName.charAt(1)))} `;
        },
        close: function (node) {
            return ` ${this.getPrefix(Number(node.nodeName.charAt(1)))}\n`;
        }
    },
    
    'img': {
        pics: [],
        init: function () {
            this.pics = [];
        },
        getPics: function () {
            return this.pics;
        },
        open: function (node) {
            var name = node.getAttribute('data-zimclip-name') || node.src.split('/').pop();
            this.pics.push({name: name, url: node.src});
            return '{{./' + name;
        },
        close: function () {
            return '}}'; 
        }
    },

    'li': {
        open: function (node) {
            var prefix = '',
                bullet = '* ',
                parent = node.parentNode,
                nodeName = parent.nodeName.toLowerCase(),
                prev;
            if (nodeName === 'ol') {
                bullet = 1;
                prev = node.previousElementSibling;
                while (prev) {
                    bullet += 1;
                    prev = prev.previousElementSibling;
                }
                bullet = bullet + '. ';
            }
            while (parent) {
                nodeName = parent.nodeName.toLowerCase();
                if (nodeName === 'ul' || nodeName === 'ol') {
                    parent = parent.parentNode;
                } else if (nodeName === 'li') {
                    parent = parent.parentNode;
                    prefix += '\t';
                } else {
                    break;
                }
            }
            return prefix + bullet;
        },
        close: function (node) {
            return node.nextElementSibling ? '\n' : '';
        }
    },
    
    'list': {
        open: function () {return '\n';},
        close: function (node) {
            let parentName = node.parentNode.nodeName.toLowerCase();
            return parentName === 'li' || parentName === 'dd' ? '' : '\n'; 
        }
    },

    'mark': {
        open: function () {return '__';},
        close: function () {return '__';}
    },

    'p': {
        open: function () {return '\n';},
        close: function () {return '\n';}
    },
    
    'pre': {
        raw: true,
        open: function () {return '\n\'\'\'\n';},
        close: function () {return '\n\'\'\'\n';}
    },
    
    'q': {
        open: function () {return '"';},
        close: function (node) {
            return '"' + (node.cite ? ' ([[' + node.cite + ']])' : ''); 
        }
    },
    
    'strong': {
        open: function () { return '**';  },
        close: function () { return '**'; }
    },
    
    'b': {
        open: function () { return '**';  },
        close: function () { return '**'; }
    },
    
    'src': {
        open: function (node) {return '\n[[' + node.src;},
        close: function () {return ']]\n';}
    },
    
    'table': {
        open: function () { return '\n'; },
        close: function () { return '\n'; }
    },
    'td': {
        open: function () { return ''; },
        close: function () { return ' | '; }
    },
    'th': {
        open: function () { return ''; },
        close: function () { return ' | '; }
    },
    
    'time': {
        open: function () {return '';},
        close: function (node) {
            return node.datetime ? ' (' + node.datetime + ')' : '';
        }
    },
    
    'tr': {
        open: function () { return '\n| '; },
        close: function () { return ''; }/*, 
        postClose: function (content) {
            return content.trim();
        }*/
    }
});
// XXX Need to be registred AFTER zim ruleset
Html2Wiki.addRuleset('md', Object.assign({}, Html2Wiki.getRuleset('zim'), {
    a: {
        open: function (node) {
            return node.href ? '[' : '';
        },
        close: function (node) {
            return node.href ? `](${node.href})` : '';
        }
    },
    
    code: {
        open: function () {
            return '``';
        },
        close: function () {
            return '``';
        }
    },
    
    del: {
        open: function (node) {
            return '--' + (node.datetime ? node.datetime + '|' : '');
        },
        close: function () {
            return '--';
        }
    },
    
    figcaption: {
        open: function () {
            return "\n----\n"; // eslint-disable-line quotes
        },
        close: function () {
            return '';
        }
    },
    
    figure: {
        open: function () {
            return "\n----\n"; // eslint-disable-line quotes
        },
        close: function () {
            return "\n"; // eslint-disable-line quotes
        }
    },
    
    h: {
        raw: true,
    
        prefixes: {},
    
        getPrefix: function (level) {
            if (!this.prefixes[level]) {
                let prefix = '#';
                if (level > 1) {
                    prefix = prefix.padEnd(level, '#');
                }
                this.prefixes[level] = prefix;
            }
            return this.prefixes[level];
        },
    
        open: function (node) {
            return `\n${this.getPrefix(Number(node.nodeName.charAt(1)))} `;
        },
    
        close: function () {
            return "\n"; // eslint-disable-line quotes
        }
    },
    
    img: {
        pics: [],
        init: function () {
            this.pics = [];
        },
        getPics: function () {
            return this.pics;
        },
        open: function (node) {
            var name = node.getAttribute('data-zimclip-name') || node.src.split('/').pop();
            this.pics.push({name: name, url: node.src});
            return `![${node.alt || ''}](./${name})`;
        },
        close: function () {
            return '';
        }
    },
    
    pre: {
        open: function () {
            return '';
        },
        close: function () {
            return '';
        },
        postClose: function (content) {
            var w = content.trim().split("\n"), // eslint-disable-line quotes
                n = w.length,
                i = 0;
            for (i = 0; i < n; i += 1) {
                w[i] = '    ' + w[i];
            }
            return "\n" + w.join("\n") + "\n"; // eslint-disable-line quotes
        }
    }
}));
