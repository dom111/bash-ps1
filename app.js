(function($) {
    $(function() {
        var parsed = $('pre.parsed'),
        input = $('#input'),
        colours = $('[name="colours"]'),
        cursor = $('[name="cursor"]'),
        light = $('[name="light"]'),

        _updateBuilder = function() {
            $('section.builder div.blocks').empty();

            parse.extract(input.val()).forEach(function(block) {
                _addBuilderBlock(block);
            });
        },
        _addBuilderBlock = function(block) {
            var blocksContainer = $('section.builder div.blocks'),
            template = $('.templates [data-type="' + block.type + '"]').clone();

            template.attr('data-value', block.value).attr('data-content', block.content);

            if (block.type === 'styling') {
                $.each(parse.parseStyles(block.value), function(key, value) {
                    var element = template.find('[name="' + key + '"]');

                    if (element.is('[type="checkbox"]')) {
                        element.prop('checked', value);
                    }
                    else if (element.is('[type="text"]')) {
                        element.val(value);
                    }
                    else if (element.is('[type="color"]')) {
                        if (value.match(/^256-/)) {
                            value = parse.rgbToHex(parse.term256ToRgb(value.replace(/^256-/, '')));
                        }
                        else if (value.match(/^true-/)) {
                            value = parse.rgbToHex(value.replace(/^true-/, '').split(/\-/));
                        }
                        else if (value === '39' || value === '49') {
                            value = ''; // TODO: change this dynamically based on light/dark theme
                        }
                        // 16 colours
                        // value should be 30-37, 40-47, 90-97 or 100-107 _only_ here
                        else if (!value.match(/^#/)) {
                            var bright = value > 50;
                            value = value % 10;

                            if (bright) {
                                value += 8;
                            }

                            value = parse.rgbToHex(parse.term16ToRgb(value));
                        }

                        element.val(value);
                    }
                });

                block.style = parse.parseStyles(block.value);

                if (block.style.bg == 49) {
                    template.find('[name="bg-default"]').prop('checked', true);
                    template.find('[name="bg"]').hide().attr('disabled');
                }

                if (block.style.fg == 39) {
                    template.find('[name="fg-default"]').prop('checked', true);
                    template.find('[name="fg"]').hide().attr('disabled');
                }
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
        _shareLink = function() {
            var url = window.location.href.replace(/#.+/, '');

            if (input.val()) {
                url += '#!input=' + btoa(input.val()) + '&' + $('.global-options input:checked').serialize();
            }

            if (window.location.href != url) {
                history.pushState(history.state, url, url);
            }

            return url;
        },
        _updateDisplay = function() {
            parsed.html(parse(input.val()));
            $('.copy-paste .contents').html(input.val());
            input.height(0).height(input.prop('scrollHeight') - (parseInt(input.css('padding-top')) + parseInt(input.css('padding-bottom'))));
        },
        _loadFromHash = function() {
            if (window.location.hash) {
                var data = window.location.hash.replace(/^#!/, ''),
                elements = {
                    input: input,
                    colours: colours,
                    cursor: cursor,
                    light: light
                };

                $('.global-options [type="checkbox"]').prop('checked', false).trigger('change');

                data.split(/&/).forEach(function(item) {
                    var data = item.split(/=/),
                    element = elements[data[0]],
                    value;

                    if (element === input) {
                        value = atob(data[1]);
                    }
                    else {
                        value = data[1];
                    }

                    if (element) {
                        if (element.is('[type="radio"], [type="checkbox"]')) {
                            element.filter('[value="' + value + '"]').prop('checked', true).trigger('change');
                        }
                        else {
                            element.val(value).trigger('change');
                        }
                    }
                });
            }
        };

        new Clipboard('.share', {
            text: _shareLink
        });

        $('.share').on('click', function(event) {
            event.preventDefault();

            $('.url-copied').removeClass('hidden').show();

            window.setTimeout(function() {
                $('.url-copied').fadeOut('slow');
            }, 5000);
        });


        input.on('change', function() {
            _updateBuilder();
            _updateDisplay();
        });

        $('pre.parsed').on('click', 'span.block:not(.styling)', function() {
            var value = prompt('Enter desired preview text:', $(this).attr('data-preview'));

            if (value) {
                $(this).attr('data-preview', value);
            }
            else {
                $(this).removeAttr('data-preview');
            }
        });

        $('.global-options input[type="checkbox"]').on('change', function() {
            if (this.checked) {
                parsed.addClass(this.name);
            }
            else {
                parsed.removeClass(this.name);
            }
        });

        $('.global-options input[type="radio"]').on('change', function() {
            parsed.removeClass(function() {
                return Array.from(this.classList).filter(function(className) {
                    return className.match(/cursor-/);
                }).join(' ');
            });

            if (this.checked) {
                parsed.addClass(this.name + '-' + this.value);
            }
        });

        $('.global-options input[name="colours"]').on('change', function(event) {
            if (!this.checked) {
                return;
            }

            if (this.value === '256') {
                if (input.val().match(/\b38;2;|\b48;2;/)) {
                    if (confirm('Would you like to convert all existing colours to the 256 colour palette? (You can use the back button to undo)')) {
                        _shareLink();

                        input.val(input.val().replace(/38;2;(\d+);(\d+);(\d+)/, function(string, r, g, b) {
                            return '38;5;' + parse.rgbToTerm256([r, g, b]).replace(/256-/, '');
                        }).replace(/48;2;(\d+);(\d+);(\d+)/g, function(string, r, g, b) {
                            return '48;5;' + parse.rgbToTerm256([r, g, b]).replace(/256-/, '');
                        }));

                        _updateDisplay();
                        _updateBuilder();
                        _shareLink();
                    }
                    else {
                        event.preventDefault();

                        return false;
                    }
                }
            }
            else if (this.value === '16') {
                if (input.val().match(/\b38;2;|\b48;2;|\b38;5;|\b48;5;/)) {
                    if (confirm('Would you like to convert all existing colours to the 16 colour palette? (You can use the back button to undo)')) {
                        _shareLink();

                        input.val(input.val().replace(/38;2;(\d+);(\d+);(\d+)/g, function(string, r, g, b) {
                            return '38;5;' + parse.rgbToTerm16([r, g, b]);
                        }).replace(/48;2;(\d+);(\d+);(\d+)/g, function(string, r, g, b) {
                            return '48;5;' + parse.rgbToTerm16([r, g, b], true);
                        }).replace(/38;5;(\d+)/g, function(string, id) {
                            return parse.rgbToTerm16(parse.term256ToRgb(id));
                        }).replace(/48;5;(\d+)/g, function(string, id) {
                            return parse.rgbToTerm16(parse.term256ToRgb(id), true);
                        }));

                        _updateDisplay();
                        _updateBuilder();
                        _shareLink();
                    }
                    else {
                        event.preventDefault();

                        return false;
                    }
                }
            }
        });

        $('.global-options input[name="opacity"]').on('change', function() {
            parsed.css('opacity', this.value);
        });

        $('.specific-options .convert-escape').on('click', function(event) {
            event.preventDefault();

            input.val(input.val().replace(/\\x1b|\\033|\\e|\x1b/g, $(this).attr('data-value')));

            _updateDisplay();
        });

        $('.specific-options .wrap-styling').on('click', function(event) {
            event.preventDefault();

            $('.blocks .block').each(function() {
                var block = $(this).data('block');

                if (block.type === 'styling') {
                    if (!block.content.match(/^\\\[|\\\]/)) {
                        block.content = '\\[' + block.content + '\\]';
                    }
                }
            });

            $(document).trigger('builder.compile');
        });

        $('.load-example').on('click', function(event) {
            var example = $(this).attr('data-content');

            event.preventDefault();
            _shareLink();

            if (example.match(/\b[34]8;2;/)) {
                if ($('.global-options [name="colours"]').val() != 'true') {
                    $('.global-options [name="colours"][value="true"]').prop('checked', true);
                }
            }
            else if (example.match(/\b[34]8;5;/)) {
                if ($('.global-options [name="colours"]').val() != '256') {
                    $('.global-options [name="colours"][value="256"]').prop('checked', true);
                }
            }

            input.val(example);

            _updateBuilder();
            _updateDisplay();
            _shareLink();
        });

        $('.builder .blocks').on('click', '.delete-block', function(event) {
            event.preventDefault();

            $(this).parents('.block').remove();

            $(document).trigger('builder.compile');
        });

        $(document).on('builder.compile', function() {
            input.val('');

            $('.builder .blocks .block').each(function() {
                var block = $(this).data('block');

                input.val(input.val() + block.content);
            });

            _updateDisplay();
        });

        $('.builder .blocks').on('change', 'input, select', function() {
            $(this).parents('.block').trigger('build');
        });

        $('.builder .blocks').on('change', '[name="fg-default"], [name="bg-default"]', function() {
            var container = $(this).parents('.checkbox');

            if (this.checked) {
                container.next().hide().attr('disabled');
            }
            else {
                container.next().show().removeAttr('disabled');
            }
        });

        if (Clipboard.isSupported()) {
            new Clipboard('a.copy');
        }
        else {
            $('body').addClass('no-clipboard');
        }

        $('a.copy').on('click', function(event) {
            event.preventDefault();
        });

        $('.sources a[draggable]').on('click', function(event) {
            var type = $(this).attr('data-type'),
            block = {
                type: type,
                content: '',
                value: ''
            },
            template = $('.templates [data-type="' + type + '"]').clone().data('block', block);

            event.preventDefault();

            $('.builder .blocks').append(template);

            template.find('[name="wrap"]').prop('checked', true).trigger('change');
            template.find('[name="bg-default"]').prop('checked', true).trigger('change');
            template.find('[name="fg-default"]').prop('checked', true).trigger('change');
        });

        $('.sources a[draggable]').on('dragstart', function(event) {
            event.originalEvent.dataTransfer.setData("type", $(this).attr('data-type'));
            event.originalEvent.dataTransfer.setData("value", '');
            event.originalEvent.dataTransfer.setData("content", '');
        });

        $('.builder .blocks').on('dragstart', '.block .panel-heading', function(event) {
            var parent = $(this).parents('.block'),
            block = parent.data('block');
            event.originalEvent.dataTransfer.setData("type", block.type);
            event.originalEvent.dataTransfer.setData("value", block.value);
            event.originalEvent.dataTransfer.setData("content", block.content);
            // parent.addClass('remove').after('<div class="block col-md-3 placeholder"></div>');
            parent.addClass('placeholder').after('<div class="block col-md-3 placeholder"></div>');
        });

        $('.sources a[draggable]').on('dragend', function() {
            $('.blocks').find('.placeholder').remove();
        });

        // TODO: debounce
        $('.blocks').on('dragover', function(event) {
            var parent = $(event.target).parents('.block');

            event.preventDefault();
            event.stopPropagation();

            if ($(event.target).is('.placeholder')) {
                return;
            }

            $(this).find('.placeholder').remove();

            // add element to before/after this .block
            if (parent.is('div')) {
                if ((parent.offset().left + parent.width() - event.pageX) > (parent.width() / 2)) {
                    parent.before('<div class="block col-md-3 placeholder"></div>');
                }
                else {
                    parent.after('<div class="block col-md-3 placeholder"></div>');
                }
            }
            // add to start/end of the container
            else {
                if (($(this).offset().left + $(this).width() - event.pageX) > ($(this).width() / 2)) {
                    $(this).prepend('<div class="block col-md-3 placeholder"></div>');
                }
                else {
                    $(this).append('<div class="block col-md-3 placeholder"></div>');
                }
            }
        });

        $(window).on('scroll', (function(last, offset) {
            var debounce = (1000 / 60);
            return function() {
                if (Date.now() - last > debounce) {
                    last = Date.now();

                    if ($(window).scrollTop() >= (offset - 15)) {
                        if (!parsed.hasClass('detached')) {
                            parsed.css({
                                width: parsed.width() + 35,
                                left: parsed.offset().left - 10
                            }).addClass('detached').after('<pre class="dummy terminal visibility-hidden"></pre>');
                        }
                    }
                    else {
                        if (parsed.hasClass('detached')) {
                            parsed.removeClass('detached').css({
                                width: 'auto',
                                left: 0
                            }).parent().find('.dummy').remove();
                        }
                        else {
                            if (parsed.offset().top != offset) {
                                offset = parsed.offset().top;
                            }
                        }
                    }
                }
            };
        })(Date.now(), parsed.offset().top));

        $('.blocks').on('build', '.block', function() {
            var block = $(this).data('block'),
            inputs = $(this).find(':input');

            if (block.type === 'styling') {
                block.style = $.extend({}, parse.defaultStyle);

                inputs.filter(':not([name="bg-default"], [name="fg-default"])').each(function() {
                    var value;

                    if ($(this).is('select')) {
                        value = $(this).val();
                    }
                    else if ($(this).is('[type="checkbox"]')) {
                        value = this.checked;
                    }
                    else if ($(this).is('[type="radio"]')) {
                        if (this.checked) {
                            value = this.value;
                        }
                    }
                    else {
                        value = this.value;
                    }

                    if (this.name === 'bg' || this.name === 'fg') {
                        if ($('[name="colours"]:checked').val() === '16') {
                            block.style[this.name] = parse.rgbToTerm16(parse.hexToRgb(value), this.name == 'bg');
                        }
                        else if ($('[name="colours"]:checked').val() === '256') {
                            block.style[this.name] = parse.simplifyColour('256-' + parse.rgbToTerm256(parse.hexToRgb(value)), this.name == 'bg');
                        }
                        else {
                            block.style[this.name] = parse.simplifyColour('true-' + parse.hexToRgb(value).join('-'), this.name == 'bg');
                        }
                    }
                    else if (['bold', 'dim', 'italic', 'underline', 'blink', 'overline', 'invert', 'hidden', 'strikethrough'].includes(this.name)) {
                        block.style[this.name] = value;
                    }
                    else {
                        block[this.name] = value;
                    }
                });

                inputs.filter('[name="bg-default"], [name="fg-default"]').each(function() {
                    if (this.checked) {
                        if (this.name === 'fg-default') {
                            block.style.fg = '39';
                        }
                        else if (this.name === 'bg-default') {
                            block.style.bg = '49';
                        }
                    }
                });

                block.value = block.content = parse.buildStyles(block.style);
            }
            else {
                inputs.each(function() {
                    if ($(this).is('select')) {
                        block[this.name] = $(this).val();
                    }
                    else if ($(this).is('[type="checkbox"]')) {
                        block[this.name] = this.checked;
                    }
                    else if ($(this).is('[type="radio"]')) {
                        if (this.checked) {
                            block[this.name] = this.value;
                        }
                    }
                    else {
                        block[this.name] = this.value;
                    }
                });

                if ((block.type === 'token') || (block.type === 'text')) {
                    block.content = block.value;
                }
                else if (block.type === 'command') {
                    block.content = '$(' + block.value + ')';
                }
            }

            if (block.wrap) {
                block.content = '\\[' + block.content + '\\]';
            }

            $(document).trigger('builder.compile');
        });

        $('.blocks').on('dragleave', function(event) {
            event.preventDefault();
            event.stopPropagation();

            // $(this).find('.placeholder').remove(); // TODO: this causes weirdness with the placeholder
        });

        $('.blocks').on('drop', function(event) {
            var type = event.originalEvent.dataTransfer.getData("type"),
            value = event.originalEvent.dataTransfer.getData("value"),
            content = event.originalEvent.dataTransfer.getData("content"),
            parent = $(event.target).parents('.block:not(.placeholder)'),
            block = $('.templates [data-type="' + type + '"]').clone().data('block', {
                type: type,
                content: content,
                value: value
            });

            event.preventDefault();
            event.stopPropagation();

            if ($(event.target).is('.placeholder')) {
                $('.placeholder').replaceWith(block);
            }
            else if (parent.is('.block')) {
                // add element to before/after this .block
                parent.after(block);
            }
            else {
                // add to start/end of the container
                $(this).append(block);
            }

            block.trigger('build');

            $(this).find('.placeholder').remove();
        });

        $(window).on("popstate", function(e) {
            _loadFromHash();
        });

        _loadFromHash();
    });
})(jQuery);
