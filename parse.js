var parse = (function() {
    var _currentStyle = {
        bg: '49',
        fg: '39',

        bold: false,            // \e[1m
        dim: false,             // \e[2m
        italic: false,          // \e[3m
        underline: false,       // \e[4m
        blink: false,           // \e[5m
        overline: false,        // \e[6m
        invert: false,          // \e[7m
        hidden: false,          // \e[8m
        strikethrough: false    // \e[9m
    },
    _defaultStyle = $.extend({}, _currentStyle),

    _parseStyles = function(values) {
        var classes = [],
        newStyle = $.extend({}, _currentStyle);

        values = values.replace(/\b48;5;(\d+)\b/, '48_5_$1').replace(/\b38;5;(\d+)\b/, '38_5_$1').replace(/\b48;2;(\d+);(\d+);(\d+)\b/, '48_2_$1_$2_$3').replace(/\b38;2;(\d+);(\d+);(\d+)\b/, '38_2_$1_$2_$3');
        values.split(/;/).forEach(function(value) {
            if (value == 0) {
                newStyle = $.extend({}, _defaultStyle);
            }

            if (value == 1) {
                newStyle.bold = true;
            }

            if (value == 2) {
                newStyle.dim = true;
            }

            if (value == 3) {
                newStyle.italic = true;
            }

            if (value == 4) {
                newStyle.underline = true;
            }

            if (value == 5) {
                newStyle.blink = true;
            }

            if (value == 6) {
                newStyle.overline = true;
            }

            if (value == 7) {
                newStyle.invert = true;
            }

            if (value == 8) {
                newStyle.hidden = true;
            }

            if (value == 9) {
                newStyle.strikethrough = true;
            }

            if (value == 21) {
                newStyle.bold = false;
            }

            if (value == 22) {
                newStyle.dim = false;
            }

            if (value == 23) {
                newStyle.italic = false;
            }

            if (value == 24) {
                newStyle.underline = false;
            }

            if (value == 25) {
                newStyle.blink = false;
            }

            if (value == 26) {
                newStyle.overline = false;
            }

            if (value == 27) {
                newStyle.invert = false;
            }

            if (value == 28) {
                newStyle.hidden = false;
            }

            if (value == 29) {
                newStyle.strikethrough = false;
            }

            if (match = value.match(/^38_2_(\d+)_(\d+)_(\d+)$/)) {
                newStyle.fg = _simplifyColour('true-' + match.slice(1).join('-'));
            }
            else if (match = value.match(/^38_5_(\d+)$/)) {
                newStyle.fg = _simplifyColour('256-' + match[1]);
            }
            else if (match = value.match(/^(3|9)[0-79]$/)) {
                newStyle.fg = value;
            }

            if (match = value.match(/^^48_2_(\d+)_(\d+)_(\d+)$/)) {
                newStyle.bg = _simplifyColour('true-' + match.slice(1).join('-'), true);
            }
            else if (match = value.match(/^48_5_(\d+)$/)) {
                newStyle.bg = _simplifyColour('256-' + match[1], true);
            }
            else if (match = value.match(/^(4|10)[0-79]$/)) {
                newStyle.bg = value;
            }
        });

        return newStyle;
    },
    _simplifyColour = function(colour, bg) {
        var match,
        prefix = bg ? '4' : '3',
        brightPrefix = bg ? '10' : '9';

        if (match = colour.match(/^true-(\d+)-(\d+)-(\d+)/)) {
            if (match = _rgbToTerm256(match.slice(1), true)) {
                colour = '256-' + match;
            }
        }

        if (match = colour.match(/^256-(\d+)/)) {
            if (match[1] < 16) {
                if (match[1] < 8) {
                    colour = prefix + match[1];
                }
                else {
                    colour = brightPrefix + (match[1] % 8);
                }
            }
            else if (match[1] == 16) {
                colour = prefix + '0';
            }
            else if (match[1] == 231) {
                colour = brightPrefix + '7';
            }
        }

        return colour;
    },
    _buildStyles = function(style) {
        var styleString = '\\e[';

        [{key:'bg',n:48}, {key:'fg',n:38}].forEach(function(obj) {
            var match;

            if (match = style[obj.key].match(/true-(\d+)-(\d+)-(\d+)/)) {
                styleString += obj.n + ';2;' + match.slice(1).join(';');
            }
            else if (match = style[obj.key].match(/256-(\d+)/)) {
                styleString += obj.n + ';5;' + match[1] + ';';
            }
            else if (style[obj.key]) {
                styleString += style[obj.key] + ';';
            }
        });

        ['bold', 'dim', 'italic', 'underline', 'blink', 'overline', 'invert', 'hidden', 'strikethrough'].forEach(function(property, i) {
            if (style[property]) {
                styleString += ++i + ';';
            }
        });

        styleString = styleString.replace(/;$/, '');

        return styleString + 'm';
    },
    _extract = function(string) {
        var patterns = {
            stylingReset: /^(?:\\\[)?(?:\\033|\\e|\\x1[bB]|\x1b)\[(0)m(?:\\\])?/,
            styling: /^(?:\\\[)?(?:\\033|\\e|\\x1[bB]|\x1b)\[([^m]*)m(?:\\\])?/,
            command: /^(?:\\\[)?(?:\\?`([^`]+)\\?`|\\?\$\(([^)]+)\))(?:\\\])?/,
            octal: /^\\(\d{3})/,
            hex: /^\\x([0-9a-fA-F]{2})/,
            token: /^( |\\[!#$@\\0aAdehHjlnsTtuvVWw])/,
            variable: /^\$\{?(\w+|\?)\}?/,
            text: /^([\S\s])/
        },
        data = [],
        match, last, matched;

        while (string) {
            matched = false;

            Object.keys(patterns).forEach(function(type) {
                if (!matched && (match = string.match(patterns[type]))) {
                    matched = true;

                    if (type === 'text' && data.length && (last = data[data.length - 1]).type === 'text') {
                        last.content += match[0];
                        last.value += match[0];
                    }
                    else if (type == 'command') {
                        data.push({
                            type: type,
                            content: match[0],
                            value: match[1] || match[2] || '',
                            wrap: (match[0].match(/^\\\[/) && match[0].match(/\\\]$/))
                        });
                    }
                    else {
                        data.push({
                            type: type,
                            content: match[0],
                            value: match[1],
                            wrap: (match[0].match(/^\\\[/) && match[0].match(/\\\]$/))
                        });
                    }

                    string = string.replace(patterns[type], '');
                }
            });
        }

        return data;
    },
    _process = function(data) {
        var code = '',
        inSpan = false,

        _getStyle = function() {
            var classes = [];

            if (_currentStyle.invert) {
                classes.push('bg-' + _currentStyle.fg);
                classes.push('fg-' + _currentStyle.bg);
            }
            else {
                classes.push('bg-' + _currentStyle.bg);
                classes.push('fg-' + _currentStyle.fg);
            }

            ['bold', 'dim', 'italic', 'underline', 'overline', 'strikethrough', 'blink', 'hidden'].forEach(function(key) {
                if (_currentStyle[key]) {
                    classes.push(key);
                }
            });

            return ' ' + classes.join(' ');
        };

        _currentStyle = $.extend({}, _defaultStyle);

        data.forEach(function(block) {
            var _escape = function(s) {
                s = s || "";

                return s.replace(/"/g, "&quot;");
            };

            if (block.type.match(/styling/)) {
                if (code.match(/<span class="block styling/)) {
                    code += '</span>';
                }

                $.extend(_currentStyle, block.style = _parseStyles(block.value));

                code += '<span class="block styling' + _getStyle() + '" data-content="' + _escape(block.content) + '" data-value="' + _escape(block.value) + '" data-type="' + block.type + '" style="' + ((block.style.fg + '').match(/true-/) ? (block.style.fg + '').replace(/true-/, 'color: rgb(').replace(/$/, ');').replace(/\-/g, ',') : '') + ((block.style.bg + '').match(/true-/) ? (block.style.bg + '').replace(/\-/g, ',').replace(/true,/, 'background-color: rgb(').replace(/$/, ')') : '') + '"><span class="content">' + block.content + '</span>';
            }
            else if (block.type === 'command') {
                code += '<span class="block ' + block.type + '" data-content="' + _escape(block.content) + '" data-value="' + _escape(block.value) + '"><span class="content">' + (block.wrap ? '<span class="wrap">\\[</span>' : '') + '$(' + block.value + ')' + (block.wrap ? '<span class="wrap">\\]</span>' : '') + '</span></span>';
            }
            else if (block.type === 'token') {
                code += '<span class="block ' + block.type + '" data-content="' + _escape(block.content) + '" data-value="' + _escape(block.value) + '" data-type="' + block.type + '"><span class="content">' + block.content + '</span></span>';
            }
            else if (block.type === 'text') {
                code += '<span class="block ' + block.type + '" data-content="' + _escape(block.content) + '" data-value="' + _escape(block.value) + '" data-type="' + block.type + '">' + block.content + '</span>';
            }
            else if (block.type === 'variable') {
                code += '<span class="block ' + block.type + '" data-content="' + _escape(block.content) + '" data-value="' + _escape(block.value) + '" data-type="' + block.type + '"><span class="content">' + block.content + '</span></span>';
            }
            else if (block.type === 'hex') {
                code += '<span class="block ' + block.type + '" data-content="' + _escape(block.content) + '" data-value="' + _escape(String.fromCharCode(parseInt(block.value, 16))) + '" data-type="' + block.type + '"><span class="content">' + block.content + '</span></span>';
            }
            else if (block.type === 'octal') {
                code += '<span class="block ' + block.type + '" data-content="' + _escape(block.content) + '" data-value="' + _escape(String.fromCharCode(parseInt(block.value, 8))) + '" data-type="' + block.type + '"><span class="content">' + block.content + '</span></span>';
            }
        });

        code += '<span class="cursor"></span>';


        if (code.match(/<span class="block styling/)) {
            code += '</span>';
        }

        return code;
    },
    parse = function(string) {
        return _process(_extract(string));
    },

    // store out here to build once and re-use
    _colours = (function() {
        var _colours = [];
        _colours.push([0, 0, 0, 0]);
        _colours.push([128, 0, 0, 1]);
        _colours.push([0, 128, 0, 2]);
        _colours.push([128, 128, 0, 3]);
        _colours.push([0, 0, 128, 4]);
        _colours.push([128, 0, 128, 5]);
        _colours.push([0, 128, 128, 6]);
        _colours.push([192, 192, 192, 7]);
        _colours.push([128, 128, 128, 8]);
        _colours.push([255, 0, 0, 9]);
        _colours.push([0, 255, 0, 10]);
        _colours.push([255, 255, 0, 11]);
        _colours.push([0, 0, 255, 12]);
        _colours.push([255, 0, 255, 13]);
        _colours.push([0, 255, 255, 14]);
        _colours.push([255, 255, 255, 15]);

        [0, 95, 135, 175, 215, 255].forEach(function(r) {
            [0, 95, 135, 175, 215, 255].forEach(function(g) {
                [0, 95, 135, 175, 215, 255].forEach(function(b) {
                    _colours.push([r, g, b, 16 + parseInt('' + Math.floor((r / 255) * 5) + Math.floor((g / 255) * 5) + Math.floor((b / 255) * 5), 6)]);
                });
            });
        });

        [8, 18, 28, 38, 48, 58, 68, 78, 88, 98, 108, 118, 128, 138, 148, 158, 168, 178, 188, 198, 208, 218, 228, 238].forEach(function(s) {
            _colours.push([s, s, s, 232 + Math.floor(s / 10)]);
        });

        return _colours;
    })(),
    _getClosest = function(candidates, source) {
        return candidates.slice(0).sort(function(x, y) {
            return (Math.abs(x[0] - source[0]) + Math.abs(x[1] - source[1]) + Math.abs(x[2] - source[2])) - (Math.abs(y[0] - source[0]) + Math.abs(y[1] - source[1]) + Math.abs(y[2] - source[2])) || (x[3] - y[3]); // prefer lower colour numbers
        })[0];
    },
    _rgbToTerm16 = function(rgb, bg) {
        return _simplifyColour('256-' + (_getClosest(_colours.slice(0, 16), rgb) || [])[3], bg);
    },
    _rgbToTerm256 = function(rgb, exact) {
        if (exact) {
            exact = _colours.filter(function(colour) {
                return colour[0] == rgb[0] && colour[1] == rgb[1] && colour[2] === rgb[2];
            })[0] || [];

            return exact[3];
        }

        return (_getClosest(_colours, rgb) || [])[3];
    },
    _term16ToRgb = function(id) {
        // TODO: defaults based on selected option?
        if (id == 49) {
            return _colours[0].slice(0, 3);
        }
        else if (id == 39) {
            return _colours[7].slice(0, 3);
        }
        // normal
        else if (id < 50) {
            return _colours[id % 10].slice(0, 3);
        }
        // bright
        else {
            return _colours[(id % 10) + 8].slice(0, 3);
        }
    },
    _term256ToRgb = function(id) {
        var value = [];

        if (_colours[id][3] == id) {
            return _colours[id].slice(0, 3);
        }

        $.each(_colours, function(colour) {
            if (colour[3] == id) {
                value = colour.slice(0, 3);
            }
        });

        return value;
    },
    _hexToRgb = function(hex) {
        var r = 0, g = 0, b = 0;

        hex = hex.replace(/^#/, '');

        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        }
        else if (hex.length === 6) {
            r = parseInt(hex[0] + hex[1], 16);
            g = parseInt(hex[2] + hex[3], 16);
            b = parseInt(hex[4] + hex[5], 16);
        }

        return [r, g, b];
    },
    _rgbToHex = function(rgb) {
        return '#' + rgb.map(function(n) {
            return (0 + n.toString(16)).substr(-2);
        }).join('');
    };

    // export for component use
    parse.extract = _extract;
    parse.process = _process;

    parse.rgbToTerm256 = _rgbToTerm256;
    parse.rgbToTerm16 = _rgbToTerm16;
    parse.term256ToRgb = _term256ToRgb;
    parse.term16ToRgb = _term16ToRgb;
    parse.simplifyColour = _simplifyColour;
    parse.hexToRgb = _hexToRgb;
    parse.rgbToHex = _rgbToHex;

    parse.parseStyles = _parseStyles;
    parse.buildStyles = _buildStyles;
    parse.defaultStyle = _defaultStyle;

    return parse;
})();