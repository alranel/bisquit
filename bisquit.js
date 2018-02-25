// ':textall' jQuery pseudo-selector for all text input types
(function($) {
  var types = ('text search number email datetime datetime-local date '
        + 'month week time tel url color range').split(' ');
  var len = types.length;
  $.expr[':']['textall'] = function(elem) {
    var type = elem.getAttribute('type');
    if (!type) return true;
    for (var i = 0; i < len; i++) {
      if (type === types[i])
        return true;
    }
    return false;
  };
})(jQuery);

// TODO: instead of installing bisquit in the global namespace we might want to
// install it within jQuery since we depend on it anyway.
var bisquit = {
    // This is supposed to be called as bisquit.component(name):
    component: function (componentName) {
        if (!bisquit[componentName])
            bisquit[componentName] = new bisquit._base (componentName);
        
        return bisquit[componentName];
    },
    // This is the base class for components.
    // It's not supposed to be instantiated directly.
    _base: function (id) {
        this.id = id;
        
        // Check that the component is defined in the DOM.
        var $el = this.getEl();
        if ($el.length == 0)
            console.error("bisquit component '" + this.id + "' was not found in the DOM");
    },
    config: {
        // Delay between last keyUp event and event trigger.
        keyUpDelay: 500
    }
};

// The on() method can be used to assign a handler to a local event.
bisquit._base.prototype.on = function (eventName, handler) {
    this[eventName] = handler;
};

// The getEl() method retrieves the .bsqt-component element in the DOM.
// If a jQuery element is supplied, it will limit search to it.
// Note that multiple element might be returned.
bisquit._base.prototype.getEl = function ($el) {
    var $set = $el
        ? $el.find('.bsqt-component').addBack('.bsqt-component')
        : $('.bsqt-component');
    
    var id = this.id;
    return $set.filter(function() {
        return $(this).data('component') == id;
    });
};

$(function() {
    var handleEvent = function (ev) {
        /*
            ev.trigger: the trigger event name (on-change, on-click etc.)
            ev.target:  the jQuery element that was clicked/changed etc.
            ev.handler: the jQuery element that has the [data-on-change] attribute
            ev.data:    data to supply to the event handler
            ev.keyUp:   whether the event was generated while typing
            ev.onDone:  the cb to execute after the event is handled
        */
        
        if (!ev.data) ev.data = {};
        var eventName   = ev.handler.data(ev.trigger);
        var scope       = ev.handler.data('scope');
        var noOverlay   = null;  // whether to prevent overlay
        var overlay     = null;  // where to apply overlay, populated below
        
        if (scope) {
            // Look downwards and then upwards
            var $scope = (scope == 'this') ? ev.handler : ev.target.find(scope).add(ev.target.closest(scope));
            $.extend(true, ev.data, form2js($scope.get()[0], '.', false));
        } else {
            if (!ev.target.is('[name]:input:disabled')) {
                $.extend(true, ev.data, form2js(ev.target.get()[0], '.', false));
            }
        }
        
        // traverse all parents up to the component and collect their and data-overlay data-param* attributes
        var $parents = ev.target.parentsUntil('.bsqt-component')
            .add(ev.target.closest('.bsqt-component'))
            .add(ev.target);
        $($parents.get().reverse()).each(function () {  // Traverse from innermost to outermost
            var $item = $(this);
            
            // look for data-param-* attributes
            $.each($item.get()[0].attributes, function (i,a) {
                if (a.name.slice(0,11) == 'data-param-') {
                    var param = a.name.slice(11);
                    ev.data[param] = a.value;
                }
            });
            
            if (!overlay && $item.data('overlay')) {
                if ($item.data('overlay') == 'this') {
                    overlay = $item;
                } else {
                    overlay = $item.closest($item.data('overlay'));
                }
            }
            
            if ($item.data('no-overlay')) {
                noOverlay = true;
            }
        });
        
        var events = eventName.split(';');
        $.each(events, function (i, eventName) {
            var tokens = eventName.split(':');
            var componentName = tokens.shift();
            eventName = tokens.join(':');
            if (!eventName) {
                // This means we had no componentName.
                eventName = componentName;
                componentName = ev.handler.closest('.bsqt-component').data('component');
            }
            ev.target.trigger('bisquit.event', [{
                component: componentName,
                event:      eventName,
                data:       ev.data,
                onDone:     ev.onDone,
                keyUp:      ev.keyUp,
                noOverlay:  noOverlay,
                overlay:    overlay
            }]);
        });
    };
    $(document).on('change', '[data-on-change]', function (e) {
        var $this   = $(this);
        var $target = $(e.target);
        handleEvent({
            trigger:    'on-change',
            target:     $target,
            handler:    $this,
            keyUp:      $target.is('input:textall')
        });
        return false;
    });
    $(document).on('click', '[data-on-click]', function (e) {
        var $this = $(this);
        if ($this.data('confirm') && !confirm($this.data('confirm'))) return false;
        handleEvent({
            trigger:    'on-click',
            target:     $(e.target),
            handler:    $this
        });
        return false;
    });
    
    var delay = (function(){
        var timer = 0;
        return function(callback, ms){
            clearTimeout (timer);
            timer = setTimeout(callback, ms);
        };
    })();
    $(document).on('keyup', '[data-on-change] input:textall, [data-on-change] textarea', function (e) {
        var $target = $(this);
        var $handler = $target.closest('[data-on-change]');
        
        $target.addClass('bsqt-pending-component-action');
        var onDone = function () {
            $target.removeClass('bsqt-pending-component-action');
        };
        
        delay(function () {
            handleEvent({
                trigger:    'on-change',
                target:     $target,
                handler:    $handler,
                keyUp:      true,
                onDone:     onDone
            });
        }, bisquit.config.keyUpDelay);
        return false;
    });
    
    $(document).on('bisquit.event', '.bsqt-component', function (e, ev) {
        var $this = $(this);
        
        if (!ev.component) {
            // catch any untargeted event
            ev.component = $this.data('component');
        } else if (ev.component != $this.data('component')) {
            // continue propagation
            return;
        }
        
        e.stopPropagation();
        var component = bisquit.component(ev.component);
        
        // check whether this is implemented as a local event
        if (component[ev.event]) {
            component[ev.event].apply($this, ev.data);
            if (ev.onDone) ev.onDone();
            return;
        }
        
        // we assume that in case of keyUp, the remote event handler will NOT change the DOM
        if (!ev.noOverlay && !ev.keyUp) {
            if (!ev.overlay) ev.overlay = $this;
            $('<div class="bsqt-component-overlay"></div>')
                .width(ev.overlay.width())
                .height(ev.overlay.height())
                .offset(ev.overlay.position())
                .insertBefore(ev.overlay);
        }
        $.ajax({
            url: $this.data('remote-controller'),
            type: 'POST',
            data: {
                _event: ev.event,
                data: JSON.stringify(ev.data)
            }
        }).done(function(res) {
            if ((res.html || res.inner) && !ev.keyUp) {
                var $target = $this;
                if (res.target) $target = $this.find(res.target);
        
                // find current focused input field, if any
                var focused = $target.find('input:focus, textarea:focus')[0];
        
                // if $target contains focus, replaceWith will blur that focus firing a change event
                // which we need to ignore
                if (focused) $(focused).on('change', function (e) { return false; }).blur();
        
                if (res.html) {
                    var $new = $(res.html.trim());
                    $target.replaceWith($new);
                    $target = $new;
                    if (!res.target) $this = $new;
                } else if (res.inner) {
                    $target.html(res.inner);
                }
                
                // restore focus, value and selection
                if (focused) {
                    var newFocus = $target.find('input[name="'+focused.name+'"]:not(:radio):not(:checkbox):not(:file), textarea[name="'+focused.name+'"]')[0];
                    if (newFocus) {
                        newFocus.value          = focused.value;
                        newFocus.selectionStart = focused.selectionStart;
                        newFocus.selectionEnd   = focused.selectionEnd;
                    }
                }
            }
            if (res.trigger) $.each(res.trigger, function (k,v) {
                var $target = v.target ? $this.find(v.target) : $this;
                $target.trigger('bisquit.event', [{
                    component: v.component || component.id,
                    event: v.event,
                    data: v.data
                }]);
            });
            if (ev.onDone) ev.onDone();
        }).always(function () {
            $this.siblings('.bsqt-component-overlay').remove();
            $this.find('.bsqt-component-overlay').remove();
        });
    });
    $(document).on('bisquit.trigger', function (e, ev) {
        var $target = $(e.target).closest('[data-on-' + ev.trigger + ']');
        handleEvent({
            trigger:    'on-' + ev.trigger,
            target:     $target,
            handler:    $target,
            data:       ev.data
        });
    });
});
