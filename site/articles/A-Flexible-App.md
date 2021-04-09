---
title: Building a more Flexible App in Blazor
date: 2021-04-09
oneliner: This article shows how to build a more flexible version of the Blazor root UI component.
precis: App is the Root Component in the Balzor UI.  This article shows how to build a more flexible version of App.
published: 2021-03-10
---

# Building a flexible App Component in Blazor

Publish Date: 2021-04-09
Last Updated: 2021-04-09

## Overview

`App` is the Root Component in the Balzor UI.  This article shows how to build a more flexible version.

![EditForm](https://shauncurtis.github.io/siteimages/Articles/Editor-Controls/EditFormState.png)

## Code and Examples

The repository contains a project that implements the controls for all the articles in this series.  You can find it [here](https://github.com/ShaunCurtis/Blazor.Database).

The example site is here [https://cec-blazor-database.azurewebsites.net/](https://cec-blazor-database.azurewebsites.net/).

You can see the test form described later at [https://cec-blazor-database.azurewebsites.net//testeditor](https://cec-blazor-database.azurewebsites.net//testeditor).

> The Repo is a Work In Progress for future articles so will change and develop.

## The Blazor App

`App` defined in *App.razor* is the root component in the Blazor RenderTree.

```html
<Router AppAssembly="@typeof(Program).Assembly" PreferExactMatches="@true">
    <Found Context="routeData">
        <RouteView RouteData="@routeData" DefaultLayout="@typeof(MainLayout)" />
    </Found>
    <NotFound>
        <LayoutView Layout="@typeof(MainLayout)">
            <p>Sorry, there's nothing at this address.</p>
        </LayoutView>
    </NotFound>
</Router>
```

In the WASM page loader it's placeholder is declared as follows:

```html
....
<body>
    <div id="app">Loading...</div>
    ...
</body>
``` 
And `Program` loads the component `App` into the element when the WASM code loads in the browser.
```csharp
    builder.RootComponents.Add<App>("#app");
```

In Server mode the component tag is declared directly in the Razor file and get rendered directly. 

```html
...
<body>
    <component type="typeof(Blazor.App)" render-mode="ServerPrerendered" />
...
</body>
```

Going back to `App`, it declares the `Router` Component passing it an assembly for it to trawl to find all of it's routes.  `Router` has two `RenderFragments`, `Found` and `NotFound`. If it gets a route match it renders `Found`, otherwise `NotFound`.

Within `Found` the `RouteView` component is declared.  It takes the `routeData` property from `Router` and the default Layout as a `Type`.  `RouteData` defines the component to render, along with a dictionary of `Parameters` to set on that component.  `DefaultLayout` defines the default layout if the component has no defined layout.

`NotFound` declares the `LayoutView` component, specifying a layout to use and some child content to render.

There are some important points to understand:
1. Routes are defined at compile time and are internal to the `Router` Component.  It trawls any assemblies provided and builds a route dictionary of component/route pairs that it uses to match the Url provided by the Navigation Manager when a navigation event occurs.  The Router wires into the `NavigationManager.LocationChanged` event to trigger route changes.

RouteView Razor Pages are labelled like this:
```html
@page "/"
@page "/index"
```

This is Razor talk, and gets transposed into the following in the C# class when compiled.

```csharp
[Microsoft.AspNetCore.Components.RouteAttribute("/")]
[Microsoft.AspNetCore.Components.RouteAttribute("/index")]
public partial class Index : Microsoft.AspNetCore.Components.ComponentBase
.....
```

These attributes are set at compile time and can't be changed at runtime.

2. What's really happening with routing is the user creates an action - mouse click or similar - which creates a navigation event in the browser.  This gets intercepted by the Blazor js code, cancelled and handed to the `NavigationManager` which triggers a `LocationChanged` event.  the `Router` component is wired into this.  It does a lookup in it's routing table.  It either finds a route, parses out any parameters and passes the component and parameters to `RouteView` as a `RouteData` object, or doesn't find a route.  At this point the `event` context comes into play.  If the click event was a navigation event in the browser - a `href` in an anchor or a Javascript navigation event, then the Url is passed onto to the browser to do a *hard* browser refresh event.  If the navigation was a call to `NavigationManager.NavigateTo` then if `ForceLoad` is true then it does a *hard* browser refresh event, otherwise it renders `NotFound`.

3. Layouts, as Routes, are defined at compile time and fixed at runtime.  `@Layout` is again Razor talk that gets transposed to:

```csharp
[Microsoft.AspNetCore.Components.LayoutAttribute(typeof(MainLayout))]
[Microsoft.AspNetCore.Components.RouteAttribute("/")]
[Microsoft.AspNetCore.Components.RouteAttribute("/index")]
public partial class Index : Microsoft.AspNetCore.Components.ComponentBase
....
```

## What Can We Change

Now we have a good understanding of what is actually going lets look at how to address a few issues that often crop up:

1. Can we make the Layout Dynamic?
2. Can we add Dynamic Routes?
3. Can we change the RouteView component without routing?  We'll look at why later when we discuss how to do it.

The answer to all three is obviously yes: they were leading questions!

### RouteViewService

Before we go into detail on components, we'll need a Service for state management.  This is `RouteViewService`.  To start, we set it up and add it to the WASM and Server Services.  The Server version a Singleton, but if you have user specific requirments then you may need to make it scoped or have two separate services to manage application and user contexts.

```csharp
public class RouteViewService {}
``` 
```csharp
services.AddSingleton<RouteViewService>();
```
```csharp
builder.Services.AddScoped<RouteViewService>();
```

### RenderFragments

What is a `RenderFragement`?  It's not a bunch of makeup code or a string.  Lets look at it's declaration in the Blazor Source code:

```csharp
    public delegate void RenderFragment(RenderTreeBuilder builder);

    public delegate RenderFragment RenderFragment<TValue>(TValue value);
``` 

It's simply a delegate.  Any methods registered with the delegate get passed a `RenderTreeBuilder` object when they get executed.

A declaration such as the one below declares a delegate named `_layoutViewFragement` that holds an anonymous function with the code declared within the body of the function.

```csharp
private RenderFragment _renderDelegate => builder =>
{
    _RenderEventQueued = false;
    // Adds cascadingvalue for the ViewManager
    builder.OpenComponent<CascadingValue<RouteViewManager>>(0);
    builder.AddAttribute(1, "Value", this);
    // Get the layout render fragment
    builder.AddAttribute(2, "ChildContent", this._layoutViewFragment);
    builder.CloseComponent();
};
```

`RenderFragments` are queued with the `Renderer` though the `RenderHandle` which the component gets passed when it's attached to the `RenderTree`. The `Renderer` passes the `RenderFragment` it's `RenderTreeBuilder` instance when it executes the `RenderFragment`.   the `RenderFragment` runs it's code in the context of it's parent object instance and adds things to the `RenderTreeBuilder`.

```csharp
public void Render() {
 ....
    _renderHandle.Render(_renderDelegate);
}
```

### RouteViewManager

`RouteViewManager` replaces `Routeview`.  It's based on `RouteView` and has all the functionality of `RouteView`.  We'll look at the key functionality in sections, it's rather large to show in it's entirety.

When the router changes, `routeData` changes.  As a parameter on `RouteViewManager` this precipitates a call to `SetParametersAsync` on `RouteViewManager` through the `Renderer`.  `RouteViewManager` checks it has a valid `RouteData` and renders the component.  It also resets the `ViewData` to null because `ViewData` has precedence in the render process.  We're routing so we don't want to laod the last view.  The code is below.
  
```csharp
public Task SetParametersAsync(ParameterView parameters)
{
    // Sets the component parameters
    parameters.SetParameterProperties(this);
    // Check if we have either RouteData or ViewData
    if (RouteData == null)
    {
        throw new InvalidOperationException($"The {nameof(RouteView)} component requires a non-null value for the parameter {nameof(RouteData)}.");
    }
    // we've routed and need to clear the ViewData
    this.ViewData = null;
    // Render the component
    this.Render();
    return Task.CompletedTask;
}
```

`Render` is set up to work from wherever it's called. `_RenderEventQueued` tracks if we have a render event in the queue, and prevents stacking multiple render events.

```csharp
public void Render() => InvokeAsync(() =>
    {
        if (!this._RenderEventQueued)
        {
            this._RenderEventQueued = true;
            _renderHandle.Render(_renderDelegate);
        }
    }
);
```

`_renderDelegate` looks like this.  It cascades itself and then adds the `_layoutViewFragment` fragment as it's `ChildContent`.

```csharp
private RenderFragment _renderDelegate => builder =>
{
    // We're being executed so no longer queued
    _RenderEventQueued = false;
    // Adds cascadingvalue for the ViewManager
    builder.OpenComponent<CascadingValue<RouteViewManager>>(0);
    builder.AddAttribute(1, "Value", this);
    // Get the layout render fragment
    builder.AddAttribute(2, "ChildContent", this._layoutViewFragment);
    builder.CloseComponent();
};
```

`_layoutViewFragment` adds the correct layout (more later) and adds `_renderComponentWithParameters` as it's `ChildContent`.

```csharp
private RenderFragment _layoutViewFragment => builder =>
{
    builder.OpenComponent<LayoutView>(0);
    builder.AddAttribute(1, nameof(LayoutView.Layout), _pageLayoutType);
    builder.AddAttribute(2, nameof(LayoutView.ChildContent), _renderComponentWithParameters);
    builder.CloseComponent();
};
```
`_renderComponentWithParameters` makes the decision on whether it's rendering a View of a Route, and adds the appropriate component with it's parameters.  As you can see, views take precedence.

```csharp
private RenderFragment _renderComponentWithParameters => builder =>
{
    if (_ViewData != null)
    {
        // Adds the defined view with any defined parameters
        builder.OpenComponent(0, _ViewData.ViewType);
        if (this._ViewData.ViewParameters != null)
        {
            foreach (var kvp in _ViewData.ViewParameters)
            {
                builder.AddAttribute(1, kvp.Key, kvp.Value);
            }
        }
        builder.CloseComponent();
    }
    else
    {
        builder.OpenComponent(0, RouteData.PageType);
        foreach (var kvp in RouteData.RouteValues)
        {
            builder.AddAttribute(1, kvp.Key, kvp.Value);
        }
        builder.CloseComponent();
    }
};
```

While this may seem a little convoluted, each `RenderFragment` is responsible for rendering a single component, and adding it's *child* as the `ChildContent`.

### Layouts

To dynamically change layouts we use the `RouteViewService` to hold the dynamic default Layout. It can be set from any component that injects the service.

```csharp
public class RouteViewService
{
    public Type Layout { get; set; }
    ....
}
```

`RouteViewManager` injects `RouteViewService`.  `_pageLayoutType` uses the null coalescing operator to get the layout on precedence.

```csharp
private Type _pageLayoutType => RouteData?.PageType.GetCustomAttribute<LayoutAttribute>()?.LayoutType
    ?? RouteViewService.Layout
    ?? DefaultLayout;
```

And then `_layoutViewFragment` applies it to the component.

```csharp
private RenderFragment _layoutViewFragment => builder =>
{
    builder.OpenComponent<LayoutView>(0);
    builder.AddAttribute(1, nameof(LayoutView.Layout), _pageLayoutType);
    builder.AddAttribute(2, nameof(LayoutView.ChildContent), _renderComponentWithParameters);
    builder.CloseComponent();
};
```

We'll see this in action later on the example page.

## Dynamic Routing

Dynamic Routing is a little more complicated because the Router is effectively a sealed box.  You can always re-write the Router.  Unless you have to, don't. So, a little lateral thinking required.

If the Router doesn't find a route, and we have used the NavigationManager to navigate, then the router renders `NotFound`.  Sorting navigation events in our code to only use the NavigationManager is not difficult, we just need to be aware.  The routing will stil work, but in WASM the application gets reloaded, so we'll soon see problem navigation events in testing!  It's not quite so obvious in Server mode as the page loads are much quicker.

So we create a custom router component that picks up the baton when `NotFound` is rendered.

### RouteNotFoundManager

`RouteNotFoundManager` does exactly that.  It's similar to `RouteView`.
  
 

