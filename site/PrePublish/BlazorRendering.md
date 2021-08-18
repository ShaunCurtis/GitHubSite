---
title: Blazor UI Events and Rendering
oneliner: Blazor UI Events and Rendering
precis: Blazor UI Events and Rendering
date: 2021-08-17
published: 2021-08-17
---

# Blazor UI Events and Rendering

## Introduction

One of the most common areas of confusion in Blazor is the UI event and the associated render process.  Associated problems are posted everyday on sites such as StackOverflow.  Hopefully this article clears some of the fog!

## Code

There's no code repository for this article.  There is a single page demo Razor file in the appendix of this article you can use for testing.

 ## The Render Fragment

What is a `RenderFragment`?

For many it looks like this:

```html
<div>
 Hello World
</div>
```

A block of markup in Razor - a string.

Delve into the DotNetCore code repository and you will find:

```csharp
public delegate void RenderFragment(RenderTreeBuilder builder);
```

If you don't fully understand delegates, think of it as a pattern.  Any function that conforms to the pattern can be passed as a `RenderFragment`.  

The pattern dictates your method must:

1. Have one, and only one, parameter of type `RenderTreeBuilder`.
2. Return a `void`.

Let's look at an example:

```csharp
protected void BuildHelloWorld(RenderTreeBuilder builder)
{
    builder.OpenElement(0, "div");
    builder.AddContent(1, "Hello World");
    builder.CloseElement();
}
```

We can rewrite this as a property:

```csharp
protected RenderFragment HelloWorldFragment => (RenderTreeBuilder builder) =>
{
    builder.OpenElement(0, "div");
    builder.AddContent(1, "Hello World");
    builder.CloseElement();
};
```

or:

```csharp
protected RenderFragment HelloWorldFragment => (builder) =>
    {
        builder.OpenElement(0, "div");
        builder.AddContent(1, "Hello World");
        builder.CloseElement();
    };
```

When a Razor file gets compiled, it's transformed by the Razor Compiler into a C# class file.

The component `ADiv.razor`:

```html
<div>
 Hello World
</div>
```

Gets compiled into:

```csharp
namespace Blazr.UIDemo.Pages
{
    public partial class ADiv : Microsoft.AspNetCore.Components.ComponentBase
    {
        protected override void BuildRenderTree(Microsoft.AspNetCore.Components.Rendering.RenderTreeBuilder __builder)
        {
            __builder.AddMarkupContent(0, "<div>\r\n Hello World\r\n</div>");
        }
    }
}
```

## Component Rendering

The base component for Razor pages/components is `ComponentBase`.  This class has a public method  `StateHasChanged` to render the component.

A common problem code snippet:

```csharp
void ButtonClick()
{
    // set some message saying processing
    StateHasChanged();
    // Do some work
    // set some message saying complete
    StateHasChanged();
}
```

The only message that appears is complete.  Why?  Didn't the first `StateHasChanged` re-render the component before "Do Some Work" was called?

Yes, `StateHasChanged` did run.  However, to understand the problem, we need to take a closer look at an abbreviated version of `StateHasChanged` and the component render fragment.

```csharp
protected void StateHasChanged()
{
    if (_hasPendingQueuedRender)
        return;
    else
    {
        _hasPendingQueuedRender = true;
        _renderHandle.Render(_renderFragment);
    }
}

_renderFragment = builder =>
    {
        _hasPendingQueuedRender = false;
        BuildRenderTree(builder);
    };

```
First it checks to see if a render is already queued - `_hasPendingQueuedRender` is `false`.  If one isn't, it sets `_hasPendingQueuedRender` to `true` and calls `_renderHandle.Render` passing it `_renderFragment` (the render fragment for the component).  That's it. 

`_hasPendingQueuedRender` gets set to `false` when the render fragment is actually run.  For the inquisitive, `_renderHandle` gets passed to the component when it's attached (Renderer calling `Attach`) to the RenderTree.

The important bit to understand is that `StateHasChanged` queues the component render fragment `_renderFragment` as a `delegate` onto the Renderer's render queue.  It doesn't execute the render fragment.  That's a `Renderer` job.

If we go back to the button click, it's all sequential synchronous code running on the UI thread.  The renderer doesn't run - and thus service it's render queue - until `ButtonClick` completes.  There's no yielding.

## Blazor UI Events

Let's look at another common problem to understand the UI event process:

```csharp
async void ButtonClick()
{
    // set some message saying processing
    // Call Task.Wait to simulate some yielding async work
    await Task.Wait(1000);
    // set some message saying complete
}
```

Why do we only see the first message?  Add a `StateHasChanged` at the end of the code and it works.
```csharp
async void ButtonClick()
{
    // set some message saying processing
    // Call Task.Wait to simulate some yielding async work
    await Task.Wait(1000);
    // set some message saying complete
    StateHasChanged();
}
```

You might have fixed the display issue, but you haven't solved the problem.

### The Blazor UI Event Pattern

Blazor UI events **ARE NOT** fire-and-forget.  The basic pattern used is:

```csharp
var task = InvokeAsync(EventMethod);
StateHasChanged();
if (!task.IsCompleted)
{
    await task;
    StateHasChanged();
}
```

Our button event gets a `Task` wrapper `task`.  It either runs to a yield event or runs to completion.  At this point `StateHasChanged` gets called and a render event queued and executed.  If `task` has not completed, the handler awaits the task, and calls `StateHasChanged` on completion.

The problem in `ButtonClick` is it yields, but having passed the event handler a `void`, the event handler has nothing to await.  It runs to completion before the yielding code runs to completion.  There's no second render event.

The solution is to make `ButtonClick` return a `Task`:

```csharp
async Task ButtonClick()
{
    // set some message saying processing
    // Call Task.Wait to simulate some yielding async work
    await Task.Wait(1000);
    // set some message saying complete
    StateHasChanged();
}
```

Now the event handler `task` has something to await.

This same pattern is used by almost all UI events.  You can also see it used in `OnInitializedAsync` and `OnParametersSetAsync`.

So what's best practice?  When to use `void` and `Task` in an event handler?

In general don't mix the `async` keyword with `void`.  If in doubt pass a `Task`.

## Wrap Up

The key information to take from this article is:

1. `RenderFragment` is a delegate - it's a block of code that uses a `RenderTreeBuilder` to build out html markup.
2. `StateHasChanged` doesn't render the component or execute a `RenderFragment`.  It pushes a `RenderFragment` onto the Renderer's queue.
3. UI Event handlers need to yield to give the `Renderer` thread time to run it's render queue.
4. UI Event Handlers are not fire-and-forget.
5. Don't declare an event handler like this `async void UiEvent()`.  If it's async, then it's `async Task UiEvent()`.

## Appendix

### The Demo Page

This is a standalone page that demonstrates some of the issues and solutions discussed above.  The long running tasks are real number crunching methods (finding prime numbers) to demo real sync and async long running operations.  The async version calls `Task.Yield` to yield execution control every time a prime number is found.  you can use this page to test out various scenarios.

```html
@page "/"
@using System.Diagnostics;
@using Microsoft.AspNetCore.Components.Rendering;

<h1>UI Demo</h1>

@MyDiv

@MyOtherDiv

<div class="container">
    <div class="row">
        <div class="col-4">
            <span class="col-form-label">Primes to Calculate: </span><input class="form-control" @bind-value="this.primesToCalculate" />
        </div>
        <div class="col-8">
            <button class="btn @buttoncolour" @onclick="Clicked1">Click Event</button>
            <button class="btn @buttoncolour" @onclick="Clicked2">Click Async Void Event</button>
            <button class="btn @buttoncolour ms-2" @onclick="ClickedAsync">Click Async Task Event</button>
            <button class="btn @buttoncolour" @onclick="Reset">Reset</button>
        </div>
    </div>
</div>
```
```csharp
@code{
    bool workingstate;
    string buttoncolour => workingstate ? "btn-danger" : "btn-success";
    string MyDivColour => workingstate ? "bg-warning" : "bg-primary";
    string myOtherDivColour => workingstate ? "bg-danger" : "bg-dark";
    long tasklength = 0;
    long primesToCalculate = 10;
    string message = "Waiting for some action!";

    private async Task Reset()
    {
        message = "Waiting for some action!";
        workingstate = false;
    }

    private async Task ClickedAsync()
    {
        workingstate = true;
        message = "Processing";
        await LongYieldingTaskAsync();
        message = $"Complete : {DateTime.Now.ToLongTimeString()}";
        workingstate = false;
    }

    private void Clicked1()
    {
        workingstate = true;
        message = "Processing";
        LongTaskAsync();
        message = $"Complete : {DateTime.Now.ToLongTimeString()}";
        workingstate = false;
    }

    private async void Clicked2()
    {
        workingstate = true;
        message = "Processing";
        await Task.Yield();
        await LongTaskAsync();
        message = $"Complete : {DateTime.Now.ToLongTimeString()}";
        workingstate = false;
    }

    private RenderFragment MyDiv => (RenderTreeBuilder builder) =>
    {
        builder.AddMarkupContent(0, $"<div class='text-white {MyDivColour} m-2 p-2'>{message}</div>");
    };

    private RenderFragment MyOtherDiv => (builder) =>
    {
        builder.OpenElement(0, "div");
        builder.AddAttribute(1, "class", $"text-white {myOtherDivColour} m-2 p-2");
        builder.AddMarkupContent(0, message);
        builder.CloseElement();
    };

    public Task LongTaskAsync()
    {
        var watch = new Stopwatch();

        var num = primesToCalculate * 1;
        watch.Start();
        var counter = 0;
        for (long x = 0; x <= num; x++)
        {
            for (long i = 0; i <= (10000); i++)
            {
                bool isPrime = true;
                for (long j = 2; j < i; j++)
                {
                    if (i % j == 0)
                    {
                        isPrime = false;
                        break;
                    }
                }
                if (isPrime)
                {
                    counter++;
                }
            }
        }
        watch.Stop();
        tasklength = watch.ElapsedMilliseconds;
        return Task.CompletedTask;
    }

    public async Task LongYieldingTaskAsync()
    {
        var watch = new Stopwatch();

        var num = primesToCalculate * 1;
        watch.Start();
        var counter = 0;
        for (long x = 0; x <= num; x++)
        {
            for (long i = 0; i <= (10000); i++)
            {
                bool isPrime = true;
                for (long j = 2; j < i; j++)
                {
                    if (i % j == 0)
                    {
                        isPrime = false;
                        break;
                    }
                }
                if (isPrime)
                {
                    counter++;
                    await Task.Yield();
                }
            }
        }
        watch.Stop();
        tasklength = watch.ElapsedMilliseconds;
    }
}
```
