---
title: Exploring Blazor Component Rendering
date: 2020-11-01
---

# Exploring Blazor Component Rendering

> This article explores the Blazor Component update process with code that demonstrates what is, and isn't happening.

This article started life as some code I wrote to explore what I thought I already understood - the mechanics of Blazor Component Rendering.

## Repo and Site

The code is available in the [AllinOne](https://github.com/ShaunCurtis/AllinOne) Project on GitHub.  The original project demonstrates how to combine Server and WASM under the same roof.  You'll find the code in the Shared Project under *AllinOne.Shared > Components > Controls*, and the counter page *AllinOne.Shared > Components > Views > Counter.razor*.

The application is hosted on Azure at [https://allinoneserver.azurewebsites.net/](https://allinoneserver.azurewebsites.net/).

## The Code

We're going to build a set of counter components that we can cascade in the *Counter* page.

#### Counter

First, we need a basic `Counter` class we can run as a service.  Note the *event* for when `Counter` is incremented.


```csharp
    public class CounterService
    {
        // The counter.
        public int Counter { get; private set; } = 0;

        // An event triggered when we increment the counter
        public event EventHandler CounterChanged;

        // The incrementer method.  Triggers CounterChanged when called
        public void IncrementCounter()
        {
            this.Counter++;
            this.CounterChanged?.Invoke(this, EventArgs.Empty);
        }
    }
```

Add it to `StartUp`(Server) or `Program`(WASM).

```csharp
// Server
    public class Startup
    {
        ......
        public void ConfigureServices(IServiceCollection services)
        {
            .....
            services.AddSingleton<CounterService>();
        }
        .....
    }

// WASM
public class Program
    {
        public static async Task Main(string[] args)
        {
            ....
            builder.Services.AddSingleton<CounterService>();
            ....
        }
    }
```

#### BaseCounter

`BaseCounter` implements the basic counter component functionality.

![example counter](https://github.com/ShaunCurtis/AllinOne/blob/master/images/counter-example.png?raw=true)

A button with two badges and a label between them.  The left badge displays the value in the local `counter` variable, the right badge the `CounterService.Counter` value.  `OnParametersSetAsync` sets the local `counter` to `CounterService.Counter`.  Counter is therefore only updated when `SetParametersAsync` is called on the component by the Render.

```html
@namespace AllinOne.Shared.Components

<table class="border border-primary">
    <tr>
        <td class="text-nowrap">
            <button type="button" class="btn @this.buttoncolor" @onclick="() => this.Service.IncrementCounter()">
                <span class="badge bg-light text-dark mx-1">@this.counter</span>@this.Name <span class="badge bg-dark text-white ml-1">@this.Service.Counter</span>
            </button>
        </td>
        @if (ChildContent != null)
        {
            <td width="90%">
                @ChildContent
            </td>
        }
        @if (Body != null)
        {
            <td width="90%">
                @Body
            </td>
        }
    </tr>
</table>
```
```csharp
@code {

    [Inject] public CounterService Service { get; set; }

    [Parameter] public RenderFragment ChildContent { get; set; }

    [Parameter] public RenderFragment Body { get; set; }

    [Parameter] public string Name { get; set; } = "Add";

    protected virtual string buttonclass => (ChildContent != null || Body != null) ? "col-2" : "col";

    protected virtual string buttoncolor => "btn-secondary";

    protected virtual int counter { get; set; }

    protected override Task OnParametersSetAsync()
    {
        counter = Service.Counter;
        return Task.CompletedTask;
    }

}
```

#### EventCounter

`EventCounter` inherits from `BaseCounter`.  it adds registration of a local `ReRender` event handler with the service `CounterChanged` event.  `ReRender` forces a UI Update through `StateHasChanged` whenever the counter is updated.

```csharp
@inherits BaseCounter

// Markup the same as BaseCounter

@code {

    protected override string buttoncolor => "btn-success";

    protected override Task OnInitializedAsync()
    {
        Service.CounterChanged += ReRender;
        return base.OnInitializedAsync();
    }

    protected void ReRender(object sender, EventArgs e) => this.InvokeAsync(this.StateHasChanged);
}
```

#### CascadedValueCounter

`CascadedValueCounter` inherits from `BaseCounter`.  It adds functionality to capture a cascaded `CascadedCounter` and sets the local `counter` to the captured value.

```csharp
@inherits BaseCounter

// Markup the same as BaseCounter

@code {

    [CascadingParameter(Name ="CascadedCounter")] public int cascadedcounter { get; set; }

    protected override string buttoncolor => "btn-danger";

    protected override Task OnParametersSetAsync()
    {
        counter = cascadedcounter;
        return Task.CompletedTask;
    }
}
```
#### CascadedObjectCounter

`CascadedObjectCounter` inherits from `BaseCounter`.  it adds functionality to capture a cascaded `CascadedService` and sets the local `counter` to the captured `CounterService.Counter`.

```csharp
@inherits BaseCounter

// Markup the same as BaseCounter

@code {

    protected override string buttoncolor => "btn-warning";

    [CascadingParameter(Name = "CascadedService")] public CounterService CascadedService { get; set; }

    protected override Task OnParametersSetAsync()
    {
        counter = CascadedService?.Counter ?? 0;
        return Task.CompletedTask;
    }
}
```

### Counter Page

The final bit is to build a new counter page with various different combinations of counter components in component trees.  Note the root counter, the injected `CounterService` and cascading values.  We've also labelled each component to make referencing easier. 

```html
<h1>Counter</h1>

<table class="border border-primary">
    <tr>
        <td class="text-nowrap">
            <button type="button" class="btn btn-primary" @onclick="() => this.Service.IncrementCounter()">
                Root <span class="badge bg-light text-dark">@this.counter</span><span class="badge bg-dark text-white ml-1">@this.Service.Counter</span>
            </button>
        </td>
        <td width="90%">
            <CascadingValue Name="CascadedService" Value="this.Service">
                <CascadingValue Name="CascadedCounter" Value="this.Service.Counter">

                    <BaseCounter Name="A">
                        <BaseCounter Name="A.A">
                            <BaseCounter Name="A.A.A"></BaseCounter>
                            <BaseCounter Name="A.A.B"><Body>With Body Content</Body></BaseCounter>
                        </BaseCounter>

                        <BaseCounter Name="A.B">
                            <BaseCounter Name="A.B.A">With Child Content</BaseCounter>
                            <BaseCounter Name="A.B.B"></BaseCounter>
                            <EventCounter Name="A.B.C">With Child Content</EventCounter>
                            <EventCounter Name="A.B.D"></EventCounter>
                        </BaseCounter>
                    </BaseCounter>

                    <BaseCounter Name="B">
                        <EventCounter Name="B.A">
                            <BaseCounter Name="B.A.A">With Child Content</BaseCounter>
                            <BaseCounter Name="B.A.B"></BaseCounter>
                        </EventCounter>
                    </BaseCounter>

                    <BaseCounter Name="C">
                        <EventCounter Name="C.A">
                            <BaseCounter Name="C.A.A"></BaseCounter>
                        </EventCounter>
                    </BaseCounter>

                    <EventCounter Name="D">
                        <BaseCounter Name="D.A">has content</BaseCounter>
                    </EventCounter>

                    <BaseCounter Name="E">
                        <BaseCounter Name="E.A">
                            <CascadedObjectCounter Name="E.A.A">With Child Content</CascadedObjectCounter>
                            <CascadedObjectCounter Name="E.A.B"></CascadedObjectCounter>
                            <CascadedValueCounter Name="E.A.C">With Child Content</CascadedValueCounter>
                            <CascadedValueCounter Name="E.A.D"></CascadedValueCounter>
                        </BaseCounter>

                        <EventCounter Name="E.B">
                            <CascadedValueCounter Name="E.B.A">With Child Content</CascadedValueCounter>
                            <CascadedValueCounter Name="E.B.B"></CascadedValueCounter>
                            <CascadedObjectCounter Name="E.B.C">With Child Content</CascadedObjectCounter>
                            <CascadedObjectCounter Name="E.B.D"></CascadedObjectCounter>
                        </EventCounter>
                    </BaseCounter>

                </CascadingValue>
            </CascadingValue>
        </td>
    </tr>
</table>
```
```csharp
@code {

    [Inject] public CounterService Service { get; set; }

    protected virtual int counter { get; set; }

    protected override Task OnParametersSetAsync()
    {
        counter = Service.Counter;
        return Task.CompletedTask;
    }

}
```
## What's going on?

Go to [allinoneserver.azurewebsites.net](https://allinoneserver.azurewebsites.net/?view=AllinOne.Shared.Components.Counter) to see the page in action.

The left value is the value of the local `counter` variable.  If it's not the current value then `SetParametersAsync` wasn't called on the component at the last event (normally a button click).

The right value displays the current `CounterService.Counter`.  If it's up to date then the component was re-rendered through `StateHasChanged` at the last event.  If not, then it wasn't.

- **Blue** is the Root Counter (a BaseCounter)
- **Grey** are BaseCounters
- **Green** are EventCounters
- **Amber** are CascadedObjectCounters
- **Red** are CascadedValueCounters
- **With Child Content** are counters with content in `ChildContent`
- **With Body Content** are counters with content in `Body`

Let's look at some scenarios:

#### Click Root

Most of the children update.  The event has caused a cascaded `SetParametersAsync` on child components.  For example, **A.A** has the both values set to the current value, so `SetParametersAsync` has been called.  Note `SetParametersAsync` calls `StateHasChanged` automatically.

However, **A.A.A** didn't update.  Unlike **A.A.B** it has no child content.  You can see this elsewhere - **B.A.B** and **C.A.A** for example.

![Root](https://github.com/ShaunCurtis/AllinOne/blob/master/images/counter-root.png?raw=true)

#### Click A

We now see just some are updated.  **A** has updated, but only the second value. The button click initiated a call to `StateHasChanged` automatically causing a component render, but `SetParametersAsync` wasn't called.  The child components have reacted in the same way as a root click - only components with child content have updated.

The green counters have all updated -  for example **A.B.C** and **A.B.D** - regardless of whether they have child content or not.  Direct dependents of **A** with child content have had `SetParametersAsync` run, those without child content, or not descendants haven't.  They have rendered through their event handlers wired into the `CounterService.CounterChanged` event.  Note also that any children of EventCounters - **B.B.A** for example - with child content have also updated.

![A](https://github.com/ShaunCurtis/AllinOne/blob/master/images/counter-A.png?raw=true)

#### Click E

Notice that the yellow and red Cascaded Counters with content have updated, but not the ones without content.  Also note that on yellow CascadedObject Counters both values are current, while on the red CascadedValue Counters the left side values haven't updated.  `SetParametersAsync` has run, but the cascaded value hasn't been updated.  It's a primitive so only set when the page loads or Root is clicked.  The object cascade is a pointer to the object which is update to date.

![E](https://github.com/ShaunCurtis/AllinOne/blob/master/images/counter-E.png?raw=true)

#### New Browser Window

Open a new browser Window on the same page.  Put the two side by side.  Click anywhere on one.

What happens depends on whether you're running in Server or WASM mode.  In Server mode, all the green counters (and children with content) get updated in the other window.  In WASM nothing happens.  In Server mode, `CounterService` is running as a singleton, with all copies of the application using the same object, and thus wired to the same event.  In WASM mode, there's no such thing as a Singleton - they run as scoped.

## Conclusions

I could sit here and try to define a set of coding rules to cover the various scenarios.  But.., why attempt jumping through hoops when the kitchen sink approach - service events - just works.

My recommendation is simple, use service events.




