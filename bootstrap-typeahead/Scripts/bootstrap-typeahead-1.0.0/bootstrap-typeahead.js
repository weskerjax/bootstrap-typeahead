(function($) {
    "use strict";

    var Typeahead = function(element, options) {
    	this._cache = {};
    	
        this.$element = $(element);
        this.options = $.extend({}, $.fn.typeahead.defaults, options);
        this.itemToString = this.options.itemToString || this.itemToString;
        this.matcher = this.options.matcher || this.matcher;
        this.sorter = this.options.sorter || this.sorter;
        this.select = this.options.select || this.select;
        this.autoSelect = typeof(this.options.autoSelect) === 'boolean' ? this.options.autoSelect : true;
        this.highlighter = this.options.highlighter || this.highlighter;
        this.updater = this.options.updater || this.updater;
        this.source = this.options.source;
        this.delay = typeof(this.options.delay) === 'number' ? this.options.delay : 250;
        this.$menu = $(this.options.menu);
        this.menuMaxHeight = this.options.menuMaxHeight || 0;
        this.shown = false;
        this.listen();
        this.showHintOnFocus = typeof(this.options.showHintOnFocus) === 'boolean' ? this.options.showHintOnFocus : false;
    };

    Typeahead.prototype = {

        constructor : Typeahead,
        
        itemToString: function(item) {
            return $.map(item, function(v) { return v; }).join(' | ');
        },

        select : function() {            
            var item = this.$menu.find('.active').data('item');
            if(this.autoSelect || item) {
                this.$element.val(this.updater(item)).change();
                this.$element.trigger('selected.typeahead', [item]);
            }
            return this.hide();            
        },

        updater : function(item) {
            return item.value;
        },

        setSource : function(source) {
            this.source = source;
        },

        show : function() {
            var pos = $.extend({}, this.$element.position(), {
                height : this.$element[0].offsetHeight
            }), scrollHeight;

            scrollHeight = typeof this.options.scrollHeight === 'function' ? this.options.scrollHeight
                    .call()
                    : this.options.scrollHeight;

            /* 輔助選單最高大小 */
            if(this.menuMaxHeight){
                this.$menu.css({
                    'max-height': this.menuMaxHeight,
                    'overflow-y' : 'auto'
                });
            }        
                    
            this.$menu.insertAfter(this.$element).css({
                top : pos.top + pos.height + scrollHeight,
                left : pos.left
            }).show().scrollTop(0);

            this.shown = true;
            return this;
        },

        hide : function() {
            this.$menu.hide();
            this.shown = false;
            return this;
        },

        lookup : function(query) {
            if (typeof (query) !== 'undefined' && query !== null) {
                this.query = query;
            } else {
                this.query = this.$element.val() || '';
            }

            if (this.query.length < this.options.minLength) {
                return this.shown ? this.hide() : this;
            }

            var worker = $.proxy(function() {
            	if(this._cache[this.query]){
            		this.process(this._cache[this.query]);
            	}
            	else if($.isFunction(this.source)){
            		this.source(this.query, $.proxy(this.process, this));
            	}
            	else if(this.source){
            		this.process(this.source);
            	}
            }, this);

            clearTimeout(this.lookupWorker);
            this.lookupWorker = setTimeout(worker, this.delay);
        },

        process : function(items) {
            var that = this;
            items = $.grep(items, function(item) {
                return that.matcher(item);
            });

            items = this.sorter(items);

            if (!items.length) {
                return this.shown ? this.hide() : this;
            }

            if (this.options.items === 'all') {
                return this.render(items).show();
            }

        	if(!this._cache[this.query]){
        		this._cache[this.query] = items;
        	}
            
            return this.render(items.slice(0, this.options.items)).show();
        },

        matcher : function(item) {
        	if(!item){ return false; }
            return ~this.itemToString(item).toLowerCase().indexOf(this.query.toLowerCase());
        },

        sorter : function(items) {
            var beginswith = [];
            var caseSensitive = [];
            var caseInsensitive = [];
            var item;

            while ((item = items.shift())) {
                var string = this.itemToString(item);
                if (!string.toLowerCase().indexOf(this.query.toLowerCase())) {
                    beginswith.push(item);
                } else if (~string.indexOf(this.query)) {
                    caseSensitive.push(item);
                } else {
                    caseInsensitive.push(item);
                }
            }

            return beginswith.concat(caseSensitive, caseInsensitive);
        },

        highlighter : function(item) {
            var itemString = this.itemToString(item);
            var query = this.query.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&');
            return itemString.replace(new RegExp('(' + query + ')', 'ig'), function ($0, match) {
                return '<b>' + match + '</b>';
            });            
        },

        render : function(items) {
            var that = this;

            items = $(items).map(function(i, item) {
                i = $(that.options.item).data('item', item);
                i.find('a').html(that.highlighter(item));
                return i[0];
            });

            if (this.autoSelect) {
                items.first().addClass('active');
            }
            this.$menu.html(items);
            return this;
        },

        next : function(event) {
            var active = this.$menu.find('.active').removeClass('active');
            var next = active.next();

            if (!next.length) {
                next = $(this.$menu.find('li')[0]);
            }

            next.addClass('active');
            this.menuScrollHandle(next);
        },

        prev : function(event) {
            var active = this.$menu.find('.active').removeClass('active');
            var prev = active.prev();

            if (!prev.length) {
                prev = this.$menu.find('li').last();
            }

            prev.addClass('active');
            this.menuScrollHandle(prev);
        },
        menuScrollHandle : function($activeEl) {
            var top = $activeEl.position().top;
            var height = $activeEl.height();
            var menuTop = this.$menu.scrollTop();
            var menuHeight = this.$menu.height();
            
            if (top < 1) {
                this.$menu.scrollTop(menuTop + top);
            } else if ((top + height) > menuHeight) {
                var delta = top + height - menuHeight;
                this.$menu.scrollTop(menuTop + delta);
            }
        },

        listen : function() {
            this.$element.on('focus', $.proxy(this.focus, this)).on('blur',
                    $.proxy(this.blur, this)).on('keypress',
                    $.proxy(this.keypress, this)).on('keyup',
                    $.proxy(this.keyup, this));

            if (this.eventSupported('keydown')) {
                this.$element.on('keydown', $.proxy(this.keydown, this));
            }

            this.$menu.on('click', $.proxy(this.click, this)).on('mouseenter',
                    'li', $.proxy(this.mouseenter, this)).on('mouseleave',
                    'li', $.proxy(this.mouseleave, this));
        },

        destroy : function() {
            this.$element.data('typeahead', null);
            this.$element.off('focus').off('blur').off('keypress').off('keyup');

            if (this.eventSupported('keydown')) {
                this.$element.off('keydown');
            }

            this.$menu.remove();
        },

        eventSupported : function(eventName) {
            var isSupported = eventName in this.$element;
            if (!isSupported) {
                this.$element.setAttribute(eventName, 'return;');
                isSupported = typeof this.$element[eventName] === 'function';
            }
            return isSupported;
        },

        move : function(e) {
            if (!this.shown) {
                return;
            }

            switch (e.keyCode) {
            case 9: // tab
            case 13: // enter
            case 27: // escape
                e.preventDefault();
                break;

            case 38: // up arrow
                e.preventDefault();
                this.prev();
                break;

            case 40: // down arrow
                e.preventDefault();
                this.next();
                break;
            }

            e.stopPropagation();
        },

        keydown : function(e) {
            this.suppressKeyPressRepeat = ~$.inArray(e.keyCode,[ 40, 38, 9, 13, 27 ]);
            if (!this.shown && e.keyCode == 40) {
                this.lookup("");
            } else {
                this.move(e);
            }
        },

        keypress : function(e) {
            if (this.suppressKeyPressRepeat) {
                return;
            }
            this.move(e);
        },

        keyup : function(e) {
            switch (e.keyCode) {
            case 40: // down arrow
            case 39: // right arrow
            case 38: // up arrow
            case 37: // left arrow
            case 16: // shift
            case 17: // ctrl
            case 18: // alt
                break;

            case 9: // tab
            case 13: // enter
                if (!this.shown) { return; }
                this.select();
                break;

            case 27: // escape
                if (!this.shown) { return; }
                this.hide();
                break;
            default:
                this.lookup();
            }

            e.stopPropagation();
            e.preventDefault();
        },

        focus : function(e) {
            if (!this.focused) {
                this.focused = true;
                if (this.options.minLength === 0 && !this.$element.val()
                        || this.options.showHintOnFocus) {
                    this.lookup();
                }
            }
        },

        blur : function(e) {
            this.focused = false;
            if (!this.mousedover && this.shown) {
                this.hide();
            }
        },

        click : function(e) {
            e.stopPropagation();
            e.preventDefault();
            this.select();
            this.$element.focus();
        },

        mouseenter : function(e) {
            this.mousedover = true;
            this.$menu.find('.active').removeClass('active');
            $(e.currentTarget).addClass('active');
        },

        mouseleave : function(e) {
            this.mousedover = false;
            if (!this.focused && this.shown) {
                this.hide();
            }
        }

    };

    
    
    var old = $.fn.typeahead;

    $.fn.typeahead = function(option) {
        var arg = arguments;
        var options = (typeof(option) == 'object' && option);

        return this.each(function() {
            var $this = $(this);
            var data = $this.data('typeahead');
            if (!data) {
                data = new Typeahead(this, options);
                $this.data('typeahead', data);
            }

            if (typeof option == 'string') {
                if (arg.length > 1) {
                    data[option].apply(data, Array.prototype.slice.call(arg, 1));
                } else {
                    data[option]();
                }
            }
        });
    };

    
    $.fn.typeahead.defaults = {
        source : [],
        items : 8,
        menu : '<ul class="typeahead dropdown-menu"></ul>',
        item : '<li><a href="#"></a></li>',
        minLength : 1,
        scrollHeight : 0,
        autoSelect : true
    };

    $.fn.typeahead.Constructor = Typeahead;

    $.fn.typeahead.noConflict = function() {
        $.fn.typeahead = old;
        return this;
    };

//    $(document).on('focus.typeahead.data-api', '[data-provide="typeahead"]', function(e) {
//        var $this = $(this);
//        if ($this.data('typeahead')){ return; }
//            
//        $this.typeahead($this.data());
//    });

})(window.jQuery);
