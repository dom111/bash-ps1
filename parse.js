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

        values = values.replace(/\b48;5;(\d+)\b/, '48_5_$1').replace(/\b38;5;(\d+)\b/, '38_5_$1')
            .replace(/\b48;2;(\d+);(\d+);(\d+)\b/, '48_2_$1_$2_$3').replace(/\b38;2;(\d+);(\d+);(\d+)\b/, '38_2_$1_$2_$3');
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
                newStyle.fg = 'true-' + match[1] + '-' + match[2] + '-' + match[3];
            }
            else if (match = value.match(/^38_5_(\d+)$/)) {
                newStyle.fg = '256-' + match[1];
            }
            else if (match = value.match(/^(3|9)[0-79]$/)) {
                newStyle.fg = value;
            }

            if (match = value.match(/^^48_2_(\d+)_(\d+)_(\d+)$/)) {
                newStyle.bg = 'true-' + match[1] + '-' + match[2] + '-' + match[3];
            }
            else if (match = value.match(/^48_5_(\d+)$/)) {
                newStyle.bg = '256-' + match[1];
            }
            else if (match = value.match(/^(4|10)[0-79]$/)) {
                newStyle.bg = value;
            }

        });

        return newStyle;
    },
    _buildStyles = function(style) {
        var styleString = '\\e[';

        [{key:'bg',n:48}, {key:'fg',n:38}].forEach(function(obj) {
            var match;

            if (match = style[obj.key].match(/true-(\d+)-(\d+)-(\d+)/)) {
                styleString += obj.n + ';2;' + match[1] + ';' + match[2] + ';' + match[3] + ';';
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
            styling: /^(?:\\\[)?(?:\\033|\\e|\\x1[bB]|\x1b)\[([^m]*)m(?:\\\])?/,
            command: /^(?:\\\[)?(?:\\?`([^`]+)\\?`|\\?\$\(([^)]+)\))(?:\\\])?/,
            octal: /^(?:\\\])?\\(\d{3})(?:\\\])?/,
            hex: /^(?:\\\])?\\x([0-9a-fA-F]{2})(?:\\\])?/,
            token: /^(?:\\\])?(\\[!#$@\\aAdhHjlnsTtuvVWw])(?:\\\])?/,
            variable: /^(?:\\\])?\$\{?(\w+|\?)\}?(?:\\\])?/,
            text: /^(?:\\\])?([\S\s])(?:\\\])?/
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
            var match,
            newStyle,

            _escape = function(s) {
                s = s || "";

                return s.replace(/"/g, "&quot;");
            };

            if (block.type === 'styling') {
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

            _addBuilderBlock(block);
        });

        code += '<span class="next-command"></span>';


        if (code.match(/<span class="styling/)) {
            code += '</span>';
        }

        return code;
    },
    _addBuilderBlock = function(block) {
        var blocksContainer = $('section.builder div.blocks'),
        template = $('.templates [data-type="' + block.type + '"]').clone();

        template.attr('data-value', block.value).attr('data-content', block.content);

        if (block.type === 'styling') {
            $.each(_parseStyles(block.value), function(key, value) {
                var element = template.find('[name="' + key + '"]');

                if (element.is('[type="checkbox"], [type="radio"]')) {
                    element.prop('checked', value);
                }
                else if (element.is('[type="text"]')) {
                    element.val(value);
                }
            });

            template.find('.input-group-addon.bg').addClass('bg-' + (block.style.bg || _defaultStyle.bg));
            template.find('.input-group-addon.fg').addClass('bg-' + (block.style.fg || _defaultStyle.fg));
        }
        else {
            template.find('[name="value"]').val(block.value);
        }

        if (block.wrap) {
            template.find('[name="wrap"]').prop('checked', true);
        }

        template.data('block', block);

        blocksContainer.append(template);
    },
    parse = function(string) {
        return _process(_extract(string));
    },

    // store out here to build once and re-use
    _colours = [],
    _rgbToTerm = function(r, g, b) {
        var _buildColours = function() {
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
        },
        _best = function(candidates, source) {
            return candidates.slice(0).sort(function(x, y) {
                return (Math.abs(x[0] - source[0]) + Math.abs(x[1] - source[1]) + Math.abs(x[2] - source[2])) - (Math.abs(y[0] - source[0]) + Math.abs(y[1] - source[1]) + Math.abs(y[2] - source[2])) || (x[3] - y[3]); // prefer lower colour numbers
            })[0];
        };

        if (!_colours.length) {
            _buildColours();
        }

        return (_best(_colours, [r, g, b]) || [])[3];
    };

    parse.extract = _extract;
    parse.process = _process;
    parse.parseStyles = _parseStyles;
    parse.rgbToTerm = _rgbToTerm;
    parse.buildStyles = _buildStyles;
    parse.defaultStyle = _defaultStyle;

    return parse;
})();