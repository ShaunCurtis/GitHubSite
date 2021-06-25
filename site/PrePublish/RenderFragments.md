---
title: Render Fragments in Blazor
date: 2021-06-04
oneliner: An article describing Render Fragments in Blazor.
precis: This article looks at RenderFragements in Blazor, what they are and how to use them.
published: 2021-06-04
---

# Render Fragments in Blazor

Publish Date: 2021-06-04
Last Updated: 2021-06-04

## Overview

What is a `RenderFragment`?  Simple question, but from answering many questions on Stack Overflow and other sites, it obvious there's a lot of people a little confused.  This short article looks at what they are, how they're used and how to create one.  

## Code and Examples

There's no repository or example site.

## RenderFragment

To quote the official Microsoft documentation.

> A RenderFragement represents a segment of UI content, implemented as a delegate that writes the content to a RenderTreeBuilder.

The `RenderTreeBuilder` is even more succinct:

> Provides methods for building a collection of RenderTreeFrame entries.

So what does that mean.  It's a delegate defined in *Microsoft.AspNetCore.Components* as follows:

```csharp
public delegate void RenderFragment(RenderTreeBuilder builder);
```

If you don't fully understand delegates think of it as a pattern.  Any function that conforms to the pattern can passed as a `RenderFragment`.  

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

The method conforms to the pattern.  It also uses the provided RenderTreeBuilder to build the content: a simple hello world html div.  Each call to the builder adds what is called a `RenderTreeFrame`.  Note each frame is sequentially numbered.

Let's look at this is action.  Below is the code for a simple Razor component with the route */renderer*

```csharp
@page "/renderer"
@namespace Microsoft.AspNetCore.Components.Rendering

<h3>Renderer</h3>
@HelloWorld
@HelloWorld2

@code {

    protected RenderFragment HelloWorld { get; set; }

    protected override void OnInitialized()
    {
        this.HelloWorld = this.BuildHelloWorld;
        base.OnInitialized();
    }

    protected void BuildHelloWorld(RenderTreeBuilder builder)
    {
        builder.OpenElement(0, "div");
        builder.AddContent(1, "Hello World");
        builder.CloseElement();
    }

    protected RenderFragment HelloWorld2 => (builder) =>
    {
        builder.OpenElement(0, "div");
        builder.AddContent(1, "Hello World 2");
        builder.CloseElement();
    };
}
```

Note the two ways to define and assign a `RenderFragment`:

1. The first defines a method `BuildHelloWorld` that conforms to the pattern and assigns it to the `RenderFragment` property `HelloWorld` in `OnInitialised`.
2. The second defines the `RenderFragment` property `HelloWorld2` and assigns an anonymous method directly to it.

Both properties are rendered on the Razor markup section of the component.

Moving on.

```csharp
@page "/renderer"
@namespace Microsoft.AspNetCore.Components.Rendering

<h3>Renderer</h3>
<div class="m-3">
<button class="btn btn-secondary" @onclick="SwitchMessage">Switch</button>
</div>
@HelloWorld

@code {
    protected bool messageswitch;

    protected RenderFragment HelloWorld => (builder) =>
    {
        builder.OpenElement(0, "div");
        if (!messageswitch)
        {
            builder.AddAttribute(1, "class", "m-3 p-2");
            builder.AddContent(2, "Hello World");
        }
        else
        {
            builder.AddAttribute(1, "class", "m-3 p-2 bg-warning");
            builder.AddContent(2, "Hello World Switched");
        }
        builder.CloseElement();
    };

    private void SwitchMessage(MouseEventArgs e)
        => this.messageswitch = !this.messageswitch;
}
```

We've added logic to `HelloWorld`.  It's just a normal C# method, so can run logic and call other methods.

Let's now modify our code a little further:

```csharp
@page "/renderer"
@namespace Microsoft.AspNetCore.Components.Rendering

@RenderComponent

@code {
    protected bool messageswitch;

    protected RenderFragment HelloWorld => (builder) =>
    {
        builder.OpenElement(0, "div");
        if (!messageswitch)
        {
            builder.AddAttribute(1, "class", "m-3 p-2");
            builder.AddContent(2, "Hello World");
        }
        else
        {
            builder.AddAttribute(1, "class", "m-3 p-2 bg-warning");
            builder.AddContent(2, "Hello World Switched");
        }
        builder.CloseElement();
    };

    private RenderFragment RenderComponent => (builder) =>
    {
        builder.OpenElement(0, "div");
        builder.OpenElement(1, "button");
        builder.AddAttribute(2, "class", "btn btn-dark");
        builder.AddAttribute(4, "onclick", EventCallback.Factory.Create<MouseEventArgs>(this, SwitchMessage));
        builder.AddContent(3, "Switch");
        builder.CloseElement();
        builder.CloseElement();
        builder.AddContent(5, HelloWorld);
    };

    private void SwitchMessage(MouseEventArgs e)
    => this.messageswitch = !this.messageswitch;
}
```

We've now moved all the markup into render fragments.  Note how the `onclick` event is registered using `EventCallback.Factory`.

It's important to uderstand at this point what's actually going on.  We're coding within the context of a Razor component.  This is a level of abstraction above a standard C# class.  The Razor pre-compiler takes our Razor component and builds out a C# class file which is what actually gets compiled and used at runtime.

Let's extract our code from the Razor component and build a standard C# class to render.

```csharp
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Rendering;
using Microsoft.AspNetCore.Components.Web;
using System.Threading.Tasks;

namespace Blazor.Starter.Pages
{
    [RouteAttribute("/render")]
    public class RendererComponent : IComponent
    {
        private RenderHandle _renderHandle;
        private bool messageswitch;

        public void Attach(RenderHandle renderHandle)
        {
            _renderHandle = renderHandle;
        }

        public Task SetParametersAsync(ParameterView parameters)
        {
            parameters.SetParameterProperties(this);
            this.Render();
            return Task.CompletedTask;
        }

        public void Render()
            => _renderHandle.Render(RenderComponent);

        private void RenderComponent(RenderTreeBuilder builder)
        {
            builder.OpenElement(0, "div");
            builder.OpenElement(1, "button");
            builder.AddAttribute(2, "class", "btn btn-dark");
            builder.AddAttribute(4, "onclick", EventCallback.Factory.Create<MouseEventArgs>(this, SwitchMessage));
            builder.AddContent(3, "Switch");
            builder.CloseElement();
            builder.CloseElement();
            builder.AddContent(5, HelloWorld);
        }

        private RenderFragment HelloWorld => (builder) =>
        {
            builder.OpenElement(0, "div");
            if (!messageswitch)
            {
                builder.AddAttribute(1, "class", "m-3 p-2");
                builder.AddContent(2, "Hello World");
            }
            else
            {
                builder.AddAttribute(1, "class", "m-3 p-2 bg-warning");
                builder.AddContent(2, "Hello World Switched");
            }
            builder.CloseElement();
        };

        private void SwitchMessage(MouseEventArgs e)
        {
            this.messageswitch = !this.messageswitch;
            Render();
        }

    }
}
```

Points to note in the above code:
1. The class uses the custom attribute `RouteAttribute` to define the route.
2. The class inherits from `IComponent`.  All components must inherit from `IComponent`.
3. The class implements `Attach` which is called when the component is attached to the render tree.  It gets passed a `RenderHandle`.  The component uses this to render itself.
4. The class implements `SetParametersAsync` which is called when the component is first rendered, and whenever any `Parameters` are changed.  In our case never as we have no `Parameters` defined.  It calls the class method  `Render`.
5. The rest of the code is copied from the Razor component.

`Render` calls `Render` on the `RenderHandle` we received when the component was attached to the render tree.  We pass it the `RenderComponent` method as a delegate.  Calling `Render` queues the passed delegate onto the Renderer's render queue.  This is where the code actually gets executed.  Being a delegate it gets executed in the context of it's owning object instance.  We re-render the component when `SwitchMessage` is called because we are no longer within the Razor component framework and re-rendering isn't automatic. 


### Component Numbering

It's seems logical to use iterators to automate the numbering of component elements.  DON'T.  The numbering system is used by the diffing engine to decide which bits of the DOM need updating and which bits don't.  Numbering must be consistent within a `RenderFragment`.  If you're rendering a list, use `OpenRegion` and `CloseRegion` within each iteration.  Each region has it's own number space.
