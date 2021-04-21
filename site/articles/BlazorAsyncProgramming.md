---
title: Async Programming in Blazor
oneliner: A guide to async programming in Blazor.
precis: This article provides a guide to async programming in Blazor. 
date: 2021-04-20
published: 2020-11-11
---

# Async Programming in Blazor

This article provides an insight into async programming in Blazor.  I make no claim to be an expert: this is a summary of my recent experiences and knowledge acquisition.  There's some original content, but most of what I've written has been gleaned from other author's work.  There's a list of links at the bottom to articles, blogs and other material I've found useful, and have mined in writing this article.

This is a major revision to the earlier article published in November 2020, concentrating on use rather than theory.


Blazor applications rely on remote databases and services and need to handle latency and delay.  Understanding and using async methodologies is a key skill Blazor programmers need to acquire.

## What do you know about Async(hronous) Programming?

Most of us believe we understand what async programming is.  I started developing Blazor applications with that delusion.  I soon became painfully aware of just how shallow that knowledge was. Yes, sure, I knew what it was and could explain it in broad terms. But actually write structured and well behaved code? There followed a somewhat painful lesson in humility.

## So, What is Async(hronous) Programming?

Put simply, asynchronous programming lets us multi-task - like driving a car whilst talking to the passenger.  There's a very good explanation on the Microsoft Docs site describing [how to make a parallel task hot or sequential luke warm breakfast](https://docs.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/async/).

## When should we use it?

There are three principle situations were asynchronous processes have significant advantages over a single sequential process:

1. Processor Intensive Operations - such as complex mathematical calculations.
2. I/0 Operations - where tasks are offloaded to either subsystems on the same computer, or run on remote computers.
3. Improved User Interface experience.

In processor intensive operations, you want multiple processors or cores.  Hand off most of the processing to these cores and the program can interact with the UI on the main process updating progress and handling user interaction.  Multi-tasking on the same processor buys nothing.  The program doen't need more balls to juggle, just more jugglers.

On the other hand I/O operations don't need multiple processors.  They dispatch requests to sub-systems or remote services and await responses.  It's multi-tasking that now buys time - set up and monitor several tasks at once and wait for them to complete.  Wait time becomes dependant on the longest running task, not the sum of the tasks.

Run everything serially and the User Interface gets locked whever a task is running.  Asynchronous tasks free up the UI process. The UI can interact with the user while tasks are running.

In Blazor we're principly interested in I/O and UI operations.  Any serious processor intensive operations should be handled by a service.

## Tasks, Threading, Scheduling, Contexts

There's an excellent article [here by David Deley](https://www.codeproject.com/Articles/5299501/Async-Await-Explained-with-Diagrams-and-Examples) that explains things better than I did in the orginal version of this article.  I'll not regurgitate it.  If you want to understand what's going on under the hood, read it.

Blazor, like desktop applications, has a `SynchronisationContext` UI thread.  All UI code must run in this context.  Blazor server has the `SynchronisationContext` and a threadpool.  Web Assembly has only one thread - a limitation imposed by the browser.  It may change in the future, but at present, `Task.Run` doesn't do what you think it should do in Web Assembly.  Block that thread and deadlock.

## Asnyc in the UI

The Blazor UI is driven by events.  The initial render events, and then button clicks, data entry, ...


### Component Events

Component events have both synchronous and asynchronous versions.  `OnInitialized` and `OnInitialisedAsync` - often shortened to `OnInitialised{Async}`.  Which should you use?  My view, and it's personal not best practice, is forget the synchronous versions.  Go async from the start.  If you intend to get data from somewhere it's almost certainly going to involve  asynchronous behaviour.

The standard patterns for `OnInitializedAsync` are:

```csharp
protected async override Task OnInitializedAsync()
{
    // sync or async code
    await base.OnInitializedAsync();
}
```

```csharp
protected override Task OnInitializedAsync()
{
    // some sync code
    return Task.CompletedTask;
}
```

The `ComponentBase` implementation is:

```csharp
protected virtual Task OnInitializedAsync()
    => Task.CompletedTask;
```

In my *Blazor.Database* repo the `RecordFormBase` implementation looks like:

```csharp
protected async override Task OnInitializedAsync()
{
    // Get the record - code separated out so can be called outside the `OnInitializedAsync` event
    await LoadRecordAsync();
    await base.OnInitializedAsync();
}
```

The same patterns apply to `OnParametersSet{Async}` and `OnAfterRender{Async}`.

Note that the sync version of each event is called - and therefore completes - before the async version.

#### Component Render Events

In the component process it's important to understand when render events occur.  The main render occurs after the `OnParametersSet{Async}` events complete.  However, an initial render occurs if (and only if) `OnInitializedAsync` yields before completing.  This provides the opportunity to display a "loading" message/component/notification during the component initilaization process.

The following simple page demonstrates this:
  
```csharp
@page "/testasync"
<div>
    <h3>@_message</h3>
</div>
@code {    
    private string _message = "Starting";

    protected async override Task OnInitializedAsync()
    {
        _message = "Sync Code running";
        await Task.Delay(2000);
        _message = "Async Code completed";
    }
}
```

### UI Events

UI events originate from the user.  We'll concentrate on mouse clicks on buttons here for the examples.

Here's a simple Razor page component.
```html
@page "/asyncbuttons"
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
    <div class="row pt-2">
        <div class="col-6">
            @value1
        </div>
        <div class="col-6">
            <button class="btn btn-warning" @onclick="(e) => this.OnClick(e)">Click</button>
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

These work fine.  Now let's introduce a `Task`.

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

This also works. Finally let's make `DoSomethingAsync` operate in a true async manner and yield.

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

Now `Value1` only shows *Onclick started*.  The second update isn't displayed.  Put a break in the code at the end of `OnClick`.  `value1` is set to *Onclick complete* but the UI shows the previous value.

The temptation now is to call `StateHasChanged` at the end to fix the problem.  It'll work, but you're only masking the real problem.  So what's happening?  

Blazor loads the `OnClick` event into the `SynchronisationContext` queue as an asynchronous operation that looks something like:

```csharp
Await {UIEvent code as Task};
Invoke(StateHasChanged);
```
In example one and two look at what `OnClick` is returning - a void.  The event loaded on the `SynchronisationContext` has nothing to wait on.

 - In the first codeblock, the code is all synchronous so runs to completion before the UI update.
 - In the second block, we may have wrapped things in Tasks, but it's all synchronous so again runs to completion - calling `Task.Yield()` without an `await` kicks it off but doesn't wait on it.
 - In the final codeblock there's a proper yield on an `await`.  This yields back to the queued UI event code in the `SynchronisationContext`.  There's no Task to wait on, so it runs to completion,  re-rendering the component before `DoSomethingAsync` completes.  `Task.Yield()` re-schedules itself and any subsequent code as a new `Task` on the `SynchronisationContext` queue after the UI event, allowing the UI event task to complete first.

This problem is solved by changing the event handler to return a `Task`.

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

Now the UI event task has something to wait on and only re-renders when the event handler `Task` completes.  The UI event task still yields to the `SynchronisationContext` queue, letting it continue with other tasks.

You often see this pattern.  It's overkill, just wrapping a `Task` inside another `Task`.

```csharp
<button class="btn btn-warning" @onclick="async (e) => await this.OnClick(e)">Click</button>
```

## Component Events and EventCallbacks

Consider this code:

```csharp
<MyComponent @onclick="() => OnClick()">Hello<MyComponent>
```

Components aren't html elements.  There's no `OnClick` event on `MyComponent` unless you've created an EventCallback.

The code below shows the code patterns to use for full async behaviour through components.  `BtnClick` in the component uses `InvokeAsync` to call the EventCallback.  In the parent the delegate registered with the `OnClick` EventCallback passes an awaitable  Task back to the component. Async all the way. 

##### UIButton.razor
```csharp
<button class="btn btn-warning" @onclick="this.BtnClick">@ChildContent</button>

@code {
    [Parameter] public EventCallback<MouseEventArgs> OnClick { get; set; }
    [Parameter] public RenderFragment ChildContent { get; set; }

    private async Task BtnClick(MouseEventArgs e)
        => await OnClick.InvokeAsync(e);
}
```
##### Test.razor
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

## Service Events

Another source of events in the UI is service events to which a component has subscribed.  The most common are notifications of data changes - normally lists or data objects.

The base pattern for these looks like this:

```csharp
private async void OnRecordChange(object sender, EventArgs e)
{
    // Do something
    await this.InvokeAsync(StateHasChanged);
}
```

In this case the handler is declared void.  The code's invoked like this `RecordChanged?.Invoke(this, EventArgs.Empty)`.  There's no await and no expectation of a return value. `OnRecordChange` is the top level event.  It may need to run async code and await certain operations so can be declared `async`.  The event is also outside the component rendering process, so if the UI needs updating, such as on a list change, `StateHasChanged` needs to be invoked.

`InvokeAsync` is a `ComponentBase` method that looks like this:

```csharp
protected Task InvokeAsync(Func<Task> workItem)
    => _renderHandle.Dispatcher.InvokeAsync(workItem);

protected Task InvokeAsync(Action workItem)
    => _renderHandle.Dispatcher.InvokeAsync(workItem);
```  

`_renderHandle` is passed to components when they are attached to the RenderTree by the RenderTreeBuilder.  `InvokeAsync` uses the supplied `SynchronisationContext` `Dispatcher` to invoke `StateHasChanged`, ensuring the `Func` or `Action` passed is run on the UI thread.

## Async In Services

Async code in services depends on what your trying to do.  I'll look at two very common uses here:

### EF Database Operations

Entity Framework database operations can all be run async.  Below is a standard call in a dataservice into a `DbContext` to get a list.  Note `ToListAsync` gets the list asynchronously and returns a `Task`.

```csharp
public override async Task<List<TRecord>> GetRecordListAsync<TRecord>()
    => await this.DBContext
    .CreateDbContext()
    .GetDbSet<TRecord>()
    .ToListAsync() ?? new List<TRecord>();
``` 
And `UpdateContext` is async and returns a `Task`.

```csharp
public override async Task<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record)
{
    var context = this.DBContext.CreateDbContext();
    context.Entry(record).State = EntityState.Modified;
    return await this.UpdateContext(context);
}
```

### API Call Operations

The API calls for the two same operations above look like this.  `GetFromJsonAsync`, `PostAsJsonAsync` and `ReadFromJsonAsync` are all async.

```csharp
public override async Task<List<TRecord>> GetRecordListAsync<TRecord>()
    => await this.HttpClient.GetFromJsonAsync<List<TRecord>>($"/api/{GetRecordName<TRecord>()}/list");
```

```csharp
public override async Task<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record)
{
    var response = await this.HttpClient.PostAsJsonAsync<TRecord>($"/api/{GetRecordName<TRecord>()}/update", record);
    var result = await response.Content.ReadFromJsonAsync<DbTaskResult>();
    return result;
}
```

These code snippets come from a series of articles and Repo.
 - [CodeProject Article here](https://www.codeproject.com/Articles/5279560/Building-a-Database-Application-in-Blazor-Part-1-P)
 - [Blazor.Database Repo here](https://github.com/ShaunCurtis/Blazor.Database)

## Blocking and Deadlocking

At some point you'll face the Deadlock. Async code that either always locks, or locks under load. In Blazor, this manifests itself as a locked page. The lights are on but there's no one at home. You've killed the application process running your SPA instance. The only way out is to reload the page (F5).

The normal reason is blocking code - program execution on the application thread is halted waiting for a task to complete that's further down the queue. The halt blocks execution of the code it's waiting on. Deadlock. Move the task to the threadpool, the task completes and the block unblocks. However, no UI updates happen. Shifting code to the taskpool to unblock the application thread isn't the answer. Nor is blocking threadpool threads.  Under load the application may block all the threads available.

Here's so classic blocking code - in this case a button click event in the UI.

```csharp
public void ButtonClicked()
{
    var task = this.SomeService.GetAListAsync();
    task.Wait();
}
```

and more:

```csharp
public void GetAListAsync()
{
    var task = myDataContext.somedataset.GetListAsync();
    var ret = task.Result;
}
```

*Task.Wait()* and *task.Result* are blocking actions.  They stop execution on the thread and wait for *task* to complete. *Task* can't complete because the thread is blocked.  Unless you really understand what you're doing - you probably won't be reading this if you do - **don't use them**.  If you think you need to, re-think your design. 

## Recommendations

1. **Async and Await All The Way**. Don't mix synchronous and asynchronous methods.  Start at the bottom - the data or process interface - and code async all the way up though the data and business/logic layers to the UI.  Blazor components implement both async and sync events, so there's no reason for sync if your base library provides async interfaces.  
2. Only assign processor intensive tasks to the threadpool.  Don't assign normal tasks to the threadpool because you can.
3. Don't use *Task.Run()* in your libraries. Keep that decision as far up in the application code as possible. Make your libraries context agnostic.  
4. Never block in your libraries.  Seems obvious but... if you absolutely must block do it in the front end.
5. Always use *async* and *await*, don't try and get fancy.
6. If your library provides both async and sync calls, code them separately.  "Code it once" best practice doesn't apply here.  NEVER call one from the other if you don't want to shoot yourself in the foot at some point!
7. Only use *async void* for class based event handlers.  Never anywhere else.

#### Useful Resources and Sources of Knowledge

[David Deley Async/Await Explained](https://www.codeproject.com/Articles/5299501/Async-Await-Explained-with-Diagrams-and-Examples)

[Async Programming - Microsoft](https://docs.microsoft.com/en-us/dotnet/csharp/async#:~:text=C%23%20has%20a%20language-level%20asynchronous%20programming%20model%20which,is%20known%20as%20the%20Task-based%20Asynchronous%20Pattern%20%28TAP%29.)

[Stephen Cleary - A Tour of Task and other articles](https://blog.stephencleary.com/2014/04/a-tour-of-task-part-0-overview.html)

[Eke Peter - Understanding Async, Avoiding Deadlocks in C#](https://medium.com/rubrikkgroup/understanding-async-avoiding-deadlocks-e41f8f2c6f5d)

[Stephen Cleary - MSDN - Best Practices in Asynchronous Programming](https://docs.microsoft.com/en-us/archive/msdn-magazine/2013/march/async-await-best-practices-in-asynchronous-programming)

Many StackOverflow Answers to Questions

