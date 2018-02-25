# bisquit :cookie:

bisquit is a minimalist JavaScript library for building **interactive UIs with server-side rendering and logic**. It supports nested components, tied to distinct backend controllers, which handle custom events defined as HTML attributes. The backend processes the events, and tells bisquit what to do: replace some part of the DOM with a server-side rendered snippet, or call a client-side event or trigger an event on another component. Any programming language can be used in the backend.

It's easier to use than you think. Read on.

## Requirements

Before loading biscuit.js, you will have to load [form2js](https://github.com/maxatwork/form2js). We rely on it for gathering input field data in structured objects.

## Getting started

### Defining a component

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

### Event handlers

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
done: 1
```

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

### Defining what data is collected

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

### Handling clicks

We covered `data-on-change`. But we have more. Please welcome `data-on-click`:

```html
<a href="#" data-on-click="delete">Delete this task</a>
```

### Supplying parameters

If you want to supply parameters to the server you can use the `data-param-*` syntax:

```html
<a href="#" data-on-click="update-status" data-param-newstatus="done">Mark as Done</a><br />
<a href="#" data-on-click="update-status" data-param-newstatus="archived">Mark as Archived</a>
```

Important remarks about `data-param-*` attributes:

* you can define as many as you want;
* they are not limited to `data-on-click` handlers: you can use them with any other handler;
* they can be set on any element between the triggering element and the component: the full hierarchy between those two will be traversed and they will be collected, **regardless** of any `data-scope` attribute (`data-scope` only affects input controls).

_...to be continued..._

