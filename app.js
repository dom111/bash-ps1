var parsed = $('pre.parsed');

$('#input').on('change', function() {
    $('section.builder div.blocks').empty();
    parsed.html(parse(this.value));
    $('.copy-paste .contents').html(this.value);
});

$('#input').on('keyup', function() {
    $(this).height($(this).prop('scrollHeight') - (parseInt($(this).css('padding-top')) + parseInt($(this).css('padding-bottom'))));

    $(this).change();
});

$('#input').change();

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

$('.global-options input[name="opacity"]').on('change', function() {
    parsed.css('opacity', this.value);
});

$('.specific-options .convert-escape').on('click', function(event) {
    event.preventDefault();

    $('#input').val($('#input').val().replace(/\\x1b|\\033|\\e|\x1b/g, $(this).attr('data-value'))).change();
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
    event.preventDefault();

    $('#input').val($(this).attr('data-content')).keyup();
});

$('.builder .blocks').on('click', '.delete-block', function(event) {
    event.preventDefault();

    $(this).parents('.block').remove();

    $(document).trigger('builder.compile');
});

$(document).on('builder.compile', function() {
    $('#input').val('');

    $('.builder .blocks .block').each(function() {
        var block = $(this).data('block');

        $('#input').val($('#input').val() + block.content);
    });

    $('#input').change();
});

$('.builder .blocks').on('change', 'input, select', function() {
    $(this).parents('.block').trigger('build');
});

new Clipboard('a.copy');

$('a.copy').on('click', function(event) {
    event.preventDefault();
});

$('.sources a[draggable]').on('click', function(event) {
    var type = $(this).attr('data-type');

    event.preventDefault();

    $('.builder .blocks').append($('.templates [data-type="' + type + '"]').clone().data('block', {
        type: type,
        content: '',
        value: ''
    }));
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

$('.blocks').on('build', '.block', function() {
    var block = $(this).data('block');

    if (block.type === 'styling') {
        block.style = parse.defaultStyle;

        $(this).find(':input').each(function() {
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

            if (['bg', 'fg', 'bold', 'dim', 'italic', 'underline', 'blink', 'overline', 'invert', 'hidden', 'strikethrough'].includes(this.name)) {
                block.style[this.name] = value;
            }
            else {
                block[this.name] = value;
            }
        });

        block.value = block.content = parse.buildStyles(block.style);
    }
    else {
        $(this).find(':input').each(function() {
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

    $(this).trigger('colorpicker');
});

$('.blocks').on('colorpicker', function() {
    $(this).find('.colorpicker').colorpicker('destroy').colorpicker();
});
