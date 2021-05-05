---
title: Blazor Async Behaviour on UI Events
precis: What Async patterns to use for UI events in Blazor
date: 2020-10-01
---

# UI Event Behaviour in Blazor

This short article describes how Blazor handles UI events and the programming patterns you should use.

The classic asynchronous pattern for events is the "fire and forget" pattern:

```csharp
void EventHandlerMethod(args)
// or
async void EventHandlerMethod(args)
```

The the event caller doesn't expect a return, so the event handler method should return a `void`.

Blazor UI *events* aren't fire and forget.  They're loaded by the Blazor runtime onto the `SynchronisationContext` thread and look something like:

```csharp
Await {UIEvent code as task};
Component Invoke(StateHasChanged);
```

The event handler is called and awaited and then `StateHasChanged` is called on the component that owns the event.  This ensures that whatever actions the event caused are captured in the re-render event. 


## Test.Razor

We need a test page with some support code:

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
            <button class="btn btn-primary" @onclick="this.OnClick">Click</button>
        </div>
    </div>
</div>
```
```csharp
@code {
    private string value1 = "not set";
}
```

## The Void Pattern

Let's look at a simple void pattern example that works:

```csharp
private void OnClick(MouseEventArgs e)
{
    value1 = "Onclick started";
        // run some synchronous code
    value1 = "Onclick complete";
}
```

Why?  All the code is synchronous.  The event handler completes before `StateHasChanged` is called.
This works fine, `Value1` has the correct value.

Now lets add an async method into `OnClick` that still works.

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
        // some sync code
        return Task.CompletedTask;
    }
}
```
Why?  All the code is still synchronous.  `DoSomethingAsync` may return a `Task` but it doesn't yield.  The event handler completes before `StateHasChanged` is called.

Finally let's make `DoSomethingAsync` yield - such as doing an API call or getting data from a database - and see the problem.

```csharp
private async void OnClick(MouseEventArgs e)
{
    value1 = "Onclick started";
    await DoSomethingAsync();
    value1 = "Onclick complete";
}

private async Task DoSomethingAsync()
    => await Task.Yield();
```

Why?  `DoSomethingAsync` yields back to `OnClick` before it completes.  `OnClick` yields back to the Blazor event which has nothing to wait on - `OnClick` returned a `void` - so runs to completion and calls `StateHasChanged`.  The Blazor event completes before `OnClick` completes.

The temptation is to add a call the `StateHasChanged` like this:

```csharp
private async void OnClick(MouseEventArgs e)
{
    value1 = "Onclick started";
    await DoSomethingAsync();
    value1 = "Onclick complete";
    StateHasChanged();
}
```

Which is not the eight answer!

## The Task Pattern

This is the final async code above changed so `OnClick` returns a Task.  This now works correctly.

```csharp
private async Task OnClick(MouseEventArgs e)
{
    value1 = "Onclick started";
    await DoSomethingAsync();
    value1 = "Onclick complete";
}

private async Task DoSomethingAsync()
    => await Task.Yield();
```

Why? The Blazor event now has a Task to wait on and only runs `StateHasChanged` when `OnClick` returns a completed Task.

## The Await Task Pattern

You will see the following pattern used on html element events:

```csharp
<button class="btn btn-warning" @onclick="async (e) => await this.OnClick(e)">Click</button>
```

This isn't required.  It's overkill, wrapping a `Task` in a `Task`.

## Component Events and EventCallbacks

A common error is:

```csharp
<MyComponent @onclick="() => OnClick()">Hello<MyComponent>
```

Components aren't html elements.  There's no `OnClick` event on `MyComponent` unless you've created an EventCallback.

The code below is for a simple button control.

```csharp
// UIButton.razor
<button class="btn btn-warning" @onclick="this.BtnClick">@ChildContent</button>

@code {
    [Parameter] public EventCallback<MouseEventArgs> OnClick { get; set; }
    [Parameter] public RenderFragment ChildContent { get; set; }

    private async Task BtnClick(MouseEventArgs e)
        => await OnClick.InvokeAsync(e);
}
```

Note that the `BtnClick` event handler uses the `Task` pattern, invokes the EventCallback asynchronously and waits it.

The *Test.razor* code looks like this:

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

The parent `OnclickComponent` delegate registered with the `OnClick` EventCallback passes an awaitable Task back to the component.  It's `async` and `Task` based all the way. 

## When to use the Void Pattern

Only use the void pattern on true class based events.  The code below shows a simple service which generates a new randon number when `NewNumber` is called and triggers the `NumberChanged` event when the number changes.

```csharp
public class RandomNumberService
{
    public int Value => _Value;
    private int _Value = 0;
    public event EventHandler NumberChanged;

    public void NewNumber()
    {
        var rand = new Random();
        NotifyNumberChanged(rand.Next(0, 100));
    }

    public void NotifyNumberChanged(int value)
    {
        if (!value.Equals(_Value))
        {
            _Value = value;
            // only trigger event if it has delegates registered
            NumberChanged?.Invoke(this, EventArgs.Empty);
        }
    }
}
```

And the code that registers for the event.  Note that `OnNumberChange` invokes `StateHasChanged` rather than calling it directly.  You don't know which thread the service code is being executed on, so you need to ensure `StateHasChanged` is run on the UI thread.  `InvokeAsync` - a public `ComponentBase` method - ensures that it is.

```csharp
protected override Task OnInitializedAsync()
{
    this.RdmService.NumberChanged += this.OnNumberChange;
    return base.OnInitializedAsync();
}

private void OnNumberChange(object sender, EventArgs e)
    => this.InvokeAsync(StateHasChanged);
```





