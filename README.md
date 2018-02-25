# bisquit :cookie:

bisquit is a minimalist JavaScript library for building **interactive UIs with server-side rendering and logic**. It supports nested components, tied to distinct backend controllers, which handle custom events defined as HTML attributes. The backend processes the events, and tells bisquit what to do: replace some part of the DOM with a server-side rendered snippet, or call a client-side event or trigger an event on another component. Any programming language can be used in the backend.

It's easier to use than you think. Read on.

## Requirements

Before loading bisquit.js, you will have to load:

* jQuery;
* [form2js](https://github.com/maxatwork/form2js) (we rely on it for gathering input field data in structured objects).

## Getting started

### The bisquit client-side markup

#### Defining a component

A component can be defined on any DOM container:

```html
<div class="bsqt-component"
        data-component="Task" 
        data-remote-controller="/controller/task/1">
</div>
```

* `data-component` defines the component name. You can use the same component name multiple times in your page, as long as you don't nest components having the same name (for example, the above snippet can be repeated for each task in a task list, but tied to distinct remote controller URLs).
* `data-remote-controller` defines the URL of the backend controller coupled with this component.

Neat, huh? Let's do something with our newly created component.

#### Event handlers

Let's add a checkbox and let's define a `data-on-change` handler.

```html
<div class="bsqt-component"
        data-component="Task" 
        data-remote-controller="/controller/task/1"
        data-on-change="update">
    Done: <input type="checkbox" name="done" value="1" />
</div>
```

* `data-on-change` defines the event name to generate whenever a jQuery `change` event is fired within that component, for example by input controls.

Now, what happens when the checkbox is clicked?

bisquit will POST the following request to _/controller/task/1_:

```
_event: update
data: { done: 1 }
```

Note that `data` is a stringified JSON representation of the input data.
We'll cover the controller response later. Now let's see a more sophisticated example:

```html
<div class="bsqt-component"
        data-component="Task" 
        data-remote-controller="/controller/task/1">
    
    <h3>Task #1</h3>
    
    <div data-on-change="update-status">
        Done: <input type="checkbox" name="done" value="1" />
    </div>
    
    <div data-on-change="update-owner">
        Owner:
        <select name="owner">...</select>
    </div>
</div>
```

As you can see, a handler can be attached to any container: we defined two `data-on-change` handlers with distinct scopes. This way, distict bisquit events will be fired according to where the original change event was triggered. 

You can even attach handlers to individual controls:

```html
<select name="owner" data-on-change="update-owner">
    ...
</select>
```

Summarizing, this is the full hierarchy of a bisquit component:

* the component itself (`data-component="Task"`)
    * an event handler (`data-on-change="update"`)
        * an element which fires trigger events (`<select>`)

The component defines the URL of the remote controller. The event handler defines the bisquit event to generate whenever a trigger event is caught.
As we have seen, the event handler might coincide either with the component or the triggering element.

We covered `data-on-change`. But we have more. Please welcome `data-on-click`:

```html
<a href="#" data-on-click="delete">Delete this task</a>
```

Note that if you want to trigger an event which belongs to another component, you can name it explicitely:

```html
<a href="#" data-on-click="TaskList:reload">Reload tasks</a>
```

(In this example, we're targeting the `TaskList` component.)

#### Defining what data is collected

Note that by default bisquit will only send the value of the changed element to the remote controller. If you want to always send more data, you can use the `data-scope` attribute along with `data-on-change`:

```html
<div data-on-change="update" data-scope=".task-details">
    <div class="task-details">
        Done: <input type="checkbox" name="done" value="1" /><br />
        Owner:
        <select name="owner">
            ...
        </select>
    </div>
</div>
```

This will tell bisquit to collect all data within `.task-details` and send it to the server whenever a `data-on-change` is handled.

* `data-scope` expects a jQuery selector, which is searched downwards (among children of the node where it is defined) or, if none, upwards (among ancestors). The closest is taken. The special value `data-scope="this"` can be used to refer to the current node.

Data is collected with [form2js](https://github.com/maxatwork/form2js) so you can use its syntax in order to get a more complex object. This might change in the future and form2js might become optional; in that case you might have to provide the same functionality on the server side while parsing the input data.


#### Supplying parameters

If you want to supply parameters to the server you can use the `data-param-*` syntax:

```html
<a href="#" data-on-click="update-status" data-param-newstatus="done">Mark as Done</a><br />
<a href="#" data-on-click="update-status" data-param-newstatus="archived">Mark as Archived</a>
```

Important remarks about `data-param-*` attributes:

* you can define as many as you want;
* they are not limited to `data-on-click` handlers: you can use them with any other handler;
* they can be set on any element between the triggering element and the component: the full hierarchy between those two will be traversed and they will be collected, **regardless** of any `data-scope` attribute (`data-scope` only affects input controls).

#### Keyboard events

The `data-on-change` handler is fine for checkboxes, radio buttons, and selects, but not for textual inputs and textareas, because jQuery will fire the `change` event only when the field loses focus. This is not ideal.

In order to allow real-time saving of changes, bisquit will fire the `data-on-change` handler for textual controls also while user types (thus listening for the `keyup` jQuery event).

* The event is fired 500ms after user stops typing, in order to avoid too many calls to the server-side controller (this delay is configurable with the global `bisquit.config.keyUpDelay` variable).
* The `bsqt-pending-component-action` class is applied to the control while a remote call is in progress (the supplied stylesheet will display a small spinner, as a feedback to the user that their changes are being saved in real time).
* Bisquit will assume that the server will not apply any changes to the DOM in response to a keyup-generated `data-on-change`, and will ignore any. This prevents issues with users losing their focus while typing.

### Client-side event handling

So, now you know how to craft your markup in order to generate bisquit events. Here's how they are handled:

1. If we have a client-side handling function, call it.
2. If not, call the remote server-side controller.

We'll see the remote controllers below. For now, let's see how to define a client-side event handler:

```javascript
var mytask = bisquit.component('Task');
mytask.on('change-priority', function () {
    alert("Priority was changed!");
});
```

This is not very interesting, as it's something you can do with bare jQuery code. However it gets more useful whenever you want to call such client-side handlers from the server-side controller within a response to another event. See below for a full example.

### Server-side event handling

While a remote call is spawned, bisquit will temporarily place a `<div class="bsqt-component-overlay"></div>` element over the component in order prevent the user from clicking on things (the default stylesheet applies some opacity in order to give feedback that an operation is in progress). An overlay is **not** applied if the event was triggered from a keyup event (see above) and can be disabled by adding a `data-no-overlay` attribute to the triggering element _or_ the component element or any intermediate element along their hierarchy. You might want to disable overlay whenever the server is not expected to alter the DOM.

You can also customize the position of the overlay. As we said, it will be placed over the whole component by default (because we don't know what part is going to be altered by the server in its response), but if you know you can define a `data-overlay=".foo"` attribute containing the selector of an existing element which will be covered. Also such attribute can be defined in any element along the triggering element -> component hierarchy (the innermost found will apply).

#### Server-side logic

As we said, the server side implementation of a controller will get a POST with two parameters:

* `_event` containing the event name;
* `data` containing a stringified JSON with the collected data.

A controller should validate everything and never trust a single bit of such input - but you already know this, right?

Now let's see the juicy part: after the server performs its operations, it is expected to reply with a JSON object in the body of the response.

The basic response is a simple `{}`. This means no action will take place on the client-side, except for removing the overlay (if any) and the `bsqt-pending-component-action` class.

#### Altering the interface

In response to an event, a controller might want to tell the client-side to alter the DOM of the component. Let's start from the simple case:

```json
{
    html: "<div class=\"bsqt-component\" data-component=\"Task\" data-remote-controller=\"/controller/task/1\"></div>"
}
```

This response will tell bisquit to **replace the full component** with the given HTML.

If we want to replace only a part of it, let's add a selector in the `target` parameter:

```json
{
    target: ".info",
    html: "<span class=\"info\"><b>Foo bar</b></span>"
}
```

This will look for `.info` within our component. You're allowed to alter/replace/remove any other component which is nested inside the current one (for example, our _TaskList_ can reload its full contents which include several _Task_ components). However note that that no controller can alter things outside the current component.

If you want to replace the contents of an element, you can use `inner` instead of `html`:

```json
{
    target: ".info",
    inner: "<b>Foo bar</b>"
}
```

#### Triggering more events from the server-side

In addition to altering the interface, the server-side controller can ask bisquit to trigger more events. For example:

```json
{
    trigger: [{
        component: "TaskList",
        event: "reload"
    }]
}
```

This is handy for two purposes:

* whenever you need to send an event to an outer component (for example, after deleting a _Task_ you want to reload the full _TaskList_);
* whenever you want to execute client-side code, which you defined as a client-side event handler.

Multiple events can be fired, that's why `trigger` is an array. Also, the `component` parameter can be omitted, in which case the current one will be addressed. An additional `data` parameter, containing an **array**, can be supplied to the event. See below for a full example:

```json
{
    trigger: [{
        component: "MyApp",
        event: "show-alert",
        data: ["Your changes were saved successfully!"]
    }]
}
```

On the client-side you would have defined the following:

```javascript
bisquit.component('MyApp').on('show-alert', function (msg) {
    alert(msg);
});
```

### bisquit API

#### Triggering bisquit events programmatically

`data-on-change` and `data-on-click` handlers are handy for most forms and buttons; however there are situations where you have more sophisticated interaction (for example a drag-and-drop library). In these cases you want to trigger a bisquit event manually. You can do it by calling the jQuery's `.trigger()` method on the component or any of its inner elements:

```javascript
$('.task-details').trigger('bisquit.event', {
    component: 'Task',
    event: 'update',
    data: { priority: 10 }
});
```

These parameters can be supplied:

* `event` is the event name you want to trigger;
* `component` can be omitted (the first one in the hierarchy will catch the event);
* `data` can be omitted;
* `onDone` can be a function callback to call after the event is handled (either client-side or server-side);
* `noOverlay` can be set to true if you want to prevent an overlay to be applied while doing a remote call;
* `overlay` can contain a selector for custom placement of the overlay (see above).

#### Triggering handlers programmatically

Suppose you defined a handler like this:

```html
<div class="task-details" data-on-change="update" data-scope="this">
    ...
</div>
```

You can call it programmatically this way:

```javascript
$('.task-details').trigger('bisquit.trigger', {
    trigger: 'change'
});
```

This is also handy if you want to define custom handlers. Suppose you have a drag-and-drop interface for reordering items, you can define a custom `data-on-reorder` handler somewhere in your component.

```html
<div class="tasks" data-on-reorder="update-order">
    ...
</div>
```

```javascript
$('.tasks').trigger('bisquit.trigger', {
    trigger: 'reorder',
    data: { new_order: [3, 4, 1] }
});
```

## License & Author

Licensed under the terms of the MIT license.

(c) 2018, Alessandro Ranellucci ([Bobuild](https://www.bobuild.com/)).

