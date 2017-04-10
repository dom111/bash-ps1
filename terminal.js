(function($) {
    // @url http://stackoverflow.com/a/41034697/3145856
    $.fn.getCursorPosition = function() {
        var parent = this.get(0),
        selection = window.getSelection(),
        position = -1,
        node;

        if (selection.focusNode) {
            if ($(selection.focusNode).parents(function(node) {
                return node === parent;
            }).length) {
                node = selection.focusNode; 
                position = selection.focusOffset;

                while (node) {
                    if (node === parent) {
                        break;
                    }

                    if (node.previousSibling) {
                        node = node.previousSibling;
                        position += node.textContent.length;
                    }
                    else {
                        node = node.parentNode;

                        if (!node) {
                            break;
                        }
                    }
                }
            }
        }

        return position;
    };

    $.fn.setCursorPosition = function(chars) {
        var createRange = function(node, chars, range) {
            if (!range) {
                range = document.createRange();
                range.selectNode(node);
                range.setStart(node, 0);
            }

            if (chars.count === 0) {
                range.setEnd(node, chars.count);
            }
            else if (node && chars.count >0) {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent.length < chars.count) {
                        chars.count -= node.textContent.length;
                    }
                    else {
                        range.setEnd(node, chars.count);
                        chars.count = 0;
                    }
                }
                else {
                    for (var i = 0; i < node.childNodes.length; i++) {
                        range = createRange(node.childNodes[i], chars, range);

                        if (chars.count === 0) {
                            break;
                        }
                    }
                }
            }

            return range;
        };

        if (chars >= 0) {
            var selection = window.getSelection();

            range = createRange($(this).get(0), { count: chars });

            if (range) {
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);

                return true;
            }

            return false;
        }
    };

    $(function() {
        $('.terminal').each(function() {
            $(this)
                .attr('autocomplete', 'off')
                .attr('autocorrect', 'off')
                .attr('autocapiatlise', 'off')
                .attr('spellcheck', 'false')
                .wrap('<div class="terminal-wrap"></div>');
        }).on('input', function() {
            var content = parse($(this).text()),
            pos;

            if (content != $(this).html()) {
                pos = $(this).getCursorPosition();

                $(this).html(content);
                $(this).setCursorPosition(pos);
                $(this).trigger('update').trigger('change');
            }
        }).on('paste', function(e) {
            var text = e.originalEvent.clipboardData.getData('text/plain');

            e.preventDefault();

            document.execCommand('insertHTML', false, text);
        }).on('change update', function() {
            $(this).trigger('input');
        });
    });
})(jQuery);
