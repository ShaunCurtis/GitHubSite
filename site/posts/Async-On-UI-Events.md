---
title: Blazor Async Behaviour on UI Events
precis: What Async patterns to use for UI events in Blazor
date: 2020-10-01
---

# Blazor Async Behaviour on UI Events


If you're new to Blazor you can get a little confused about how to wire up event handlers to events in Blazor Components.

Let's look at what looks like a simple example:

```html
<div class="container m-2 px-3 p-t bg-light">
    <div class="row pt-2">
        <div class="col-12">
            <h3>Event Buttons</h3>
        </div>
    </div>
    <div class="row pt-2">
        <div class="col-6">
            @value1
        </div>
        <div class="col-6">
            <button class="btn btn-warning" @onclick="this.OnClick">Click</button>
        </div>
    </div>
</div>
```
```csharp
@code {
    private string value1 = "notset";

    private void OnClick(MouseEventArgs e)
    {
        value1 = "Onclick started";
            // run some synchronous code
        value1 = "Onclick complete";
    }
}
```

This works fine, `Value1` has the correct value.

Now lets add an async method into `OnClick`.

```csharp
@code {
    private async void Onclick(MouseEventArgs e)
    {
        value1 = "Onclick started";
        await DoSomethingAsync();
        value1 = "Onclick complete";
    }

    private Task DoSomethingAsync()
    {
        Task.Yield();
        return Task.CompletedTask;
    }
}
```

This still works fine.  Finally lets change the async method to do some real async work.

```csharp
@code {
    private async void OnClick(MouseEventArgs e)
    {
        value1 = "Onclick started";
        await DoSomethingAsync();
        value1 = "Onclick complete";
    }

    private async Task DoSomethingAsync()
    {
        await Task.Yield();
    }
}
```

Now it doesn't work.  `Value1` shows *Onclick Started*.

## So what's going on?

All code gets executed on the `SynchronisationContext` thread, unless othewise instructed.  In WASM there is only one thread, so no decisions on where to run the code.  When the user clicks on a button the internal event handler code does something like this:

```csharp
Await {UIEvent code as task};
Invoke(StateHasChanged);
```

If the UI event code is all synchronous it runs to completion before `StateHasChanged` causes a re-render of the component. In case 2 above, it's still all synchronous code.  Wrapping some sync code in a Task doesn't make in asynchronous. It still executes synchronously to completion on the `SynchronisationContext`.

In case 3 however, we introduce real asynchronous behaviour with `await Task.Yield()`.  The call instructs the `SynchronisationContext` scheduler to bump the code following the call (in this case just passing back a completed task token) down it's queue and do whatever it's got scheduled next.  `OnClick` is awaiting the completion of `DoSomethingAsync` so it yields up the stack.  At this point we have a break.  The internal Event handler doesn't have a Task handle on Onclick - it's declared void so there's nothing to await -  and runs to completion, invoking `StateHasChanged` and re-rendering the UI.  DoSomething finally gets run, passing a completed Task to OnClick which completes, updating the text.  However at this point it's too late, the component has already re-endered so although `Value1` contains the correct value, the rendered value is the old one.

To resolve this problem we can declare `OnClick` like this:

```csharp
@code {
    private async Task OnClick(MouseEventArgs e)
    {
        value1 = "Onclick started";
        await DoSomethingAsync();
        value1 = "Onclick complete";
    }
}
```

Now the internal event hanlder gets passed a Task for `OnClick` which it awaits and only updates the UI when `OnClick` has run to completion.

You will see the following pattern used on html element events:

```csharp
<button class="btn btn-warning" @onclick="async (e) => await this.OnClick(e)">Click</button>
```

This isn't required.  It's overkill, wrapping a `Task` in a `Task`.

## Component Events and EventCallbacks

A common problem I see is this:

```csharp
<MyComponent @onclick="() => OnClick()">Hello<MyComponent>
```

Components aren't html elements.  There's no `OnClick` event on `MyComponent` unless you've created an EventCallback.

The code below shows the code patterns to use for full async behaviour through components.  `BtnClick` in the component uses `InvokeAsync` to call the EventCallback.  In the parent the delegate registered with the `OnClick` EventCallback passes an awaitable  Task back to the component. Async all the way. 

```csharp
<button class="btn btn-warning" @onclick="this.BtnClick">@ChildContent</button>

@code {
    [Parameter] public EventCallback<MouseEventArgs> OnClick { get; set; }
    [Parameter] public RenderFragment ChildContent { get; set; }

    private async Task BtnClick(MouseEventArgs e)
        => await OnClick.InvokeAsync(e);
}
```

```html
<div class="row pt-2">
    <div class="col-6">
        @value5
    </div>
    <div class="col-6">
        <UIButton OnClick="OnclickComponent">click me</UIButton>
    </div>
</div>
```

```csharp
private string value5 = "notset";

private async Task OnclickComponent(MouseEventArgs e)
{
    value5 = "Onclick started";
    await Task.Delay(2000);
    await DoSomethingAsync();
    value5 = "Onclick complete";
}
```




