---
title: Building a more Flexible App in Blazor
date: 2021-04-09
oneliner: This article shows how to build a flexible version of the Blazor root UI component.
precis: App is the Root Component in the Balzor UI.  This article shows how to build a more flexible version of App.
published: 2021-03-10
---

# Building a flexible App Component in Blazor

Publish Date: 2021-04-09
Last Updated: 2021-04-09

## Overview

`App` is the root component in the Blazor UI.  This article looks how it functions and shows how to:

1. Add Dynamic Layouts - changing the default layout at runtime.
2. Add Dynamic Routes - add and remove extra routes at runtime.
3. Add Dynamic RouteViews - changing out the RouteView component directly without Routing.

![EditForm](https://shauncurtis.github.io/siteimages/Articles/Editor-Controls/EditFormState.png)

## Code and Examples

The repository contains a project that implements the controls for all the articles in this series.  You can find it [here](https://github.com/ShaunCurtis/Blazor.Database).

The example site is here [https://cec-blazor-database.azurewebsites.net/](https://cec-blazor-database.azurewebsites.net/).

You can see the test form described later at [https://cec-blazor-database.azurewebsites.net//testeditor](https://cec-blazor-database.azurewebsites.net//testeditor).

> The Repo is a Work In Progress for future articles so will change and develop.

## The Blazor Application

`App` - normally defined in *App.razor* - is the root component in the Blazor RenderTree.  It's common across Web Assembly and Server contexts.

In the Web Assembly context the startup page contains an element placeholder:

```html
....
<body>
    <div id="app">Loading...</div>
    ...
</body>
``` 
Which gets replaced when `Program` starts in the Web Assembly context.  The code line that defines which elemwent gets replaced with what component is:
```csharp
    // Replace the app id element with the component App
    builder.RootComponents.Add<App>("#app");
```

In the Server context `App` is declared directly as a component in Razor.  It gets pre-rendered by the server and then updated by the Blazor Server client in the browser. 

```html
...
<body>
    <component type="typeof(Blazor.App)" render-mode="ServerPrerendered" />
...
</body>
```

## The App Component

`App` looks like this - a standard Razor component.

It declares `Router` as it's local root component and sets `AppAssembly` to Assembly containing `Program`.  When Router gets rendered, which is only when `App` starts, it trawls `Assembly` to find all of it's routes. It has two `RenderFragments`, `Found` and `NotFound`.  When triggered by a routing event it looks for a route match.  If it finds one it renders `Found`, otherwise it renders `NotFound`.

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

`RouteView` is declared within `Found`.  `RouteData` is set to the router's current `routeData` object and `DefaultLayout` set to an application Layout `Type`.  `RouteView` renders `RouteData.Type` as a component within a Layout and applies any parameters in `RouteData.RouteValues`.

`NotFound` declares the `LayoutView` component, specifying a layout to use and some child content to render.

## RouteViewService

first we need a Service for state management.  This is `RouteViewService`.  To start, we set it up and add it to the WASM and Server Services.  The Server version a Singleton, but if you have user specific requirments then you may need to make it scoped or have two separate services to manage application and user contexts.

```csharp
public class RouteViewService 
{
  ....
}
``` 

In the Server it's added to `Startup` in `ConfigServices`.

```csharp
services.AddSingleton<RouteViewService>();
```

In the Web Assembly context it's added to `Program`.

```csharp
builder.Services.AddScoped<RouteViewService>();
```

## RenderFragments

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

`RouteViewManager` replaces `Routeview`.  It's based on `RouteView` and has all the functionality of `RouteView`.  We'll look at the key functionality in sections: it's rather large to show in it's entirety.

When the router changes, `routeData` changes.  As a parameter on `RouteViewManager` this precipitates a call to `SetParametersAsync` on `RouteViewManager` through the `Renderer`.  `RouteViewManager` checks it has a valid `RouteData` and renders the component.  It also resets the `ViewData` to null because `ViewData` has precedence in the render process.  We're routing so we don't want to laod the last view.  The code is below.
  
```csharp
public await Task SetParametersAsync(ParameterView parameters)
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
    await this.RenderAsync();
}
```

`Render` is set up to work from wherever it's called. `_RenderEventQueued` tracks if we have a render event in the queue, and prevents stacking multiple render events.

```csharp
public async Task RenderAsync() => await InvokeAsync(() =>
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
    else if (RouteData != null)
    {
        builder.OpenComponent(0, RouteData.PageType);
        foreach (var kvp in RouteData.RouteValues)
        {
            builder.AddAttribute(1, kvp.Key, kvp.Value);
        }
        builder.CloseComponent();
    }
    else 
    {
        builder.OpenElement(0, "div");
        builder.AddContent(1, "No Route or View Configured to Display");
        builder.CloseElement();
    }
};
```

While this may seem a little convoluted, each `RenderFragment` is responsible for rendering a single component, and adding it's *child* as the `ChildContent`.

## Dynamic Layouts

Out-of-the-box Blazor layouts are defined at compile time and fixed at runtime.  `@Layout` is Razor talk that gets transposed when the Razor is pre-compiled to:

```csharp
[Microsoft.AspNetCore.Components.LayoutAttribute(typeof(MainLayout))]
[Microsoft.AspNetCore.Components.RouteAttribute("/")]
[Microsoft.AspNetCore.Components.RouteAttribute("/index")]
public partial class Index : Microsoft.AspNetCore.Components.ComponentBase
....
```

To change Layouts dynamically we need somewhere to store the layout - in our case  we're using  `RouteViewService`. It can be set from any component that injects the service.

```csharp
public class RouteViewService
{
    public Type Layout { get; set; }
    ....
}
```

The layout is used by `RouteViewManager`.  `RouteViewManager` defines a readonly property `_pageLayoutType` to get the Layout.  It uses the null coalescing operator to get the layout on precedence.

```csharp
private Type _pageLayoutType => RouteData?.PageType.GetCustomAttribute<LayoutAttribute>()?.LayoutType
    ?? RouteViewService.Layout
    ?? DefaultLayout;
```

`_pageLayoutType` is applied to the component in the `_layoutViewFragment` render fragment.

```csharp
private RenderFragment _layoutViewFragment => builder =>
{
    builder.OpenComponent<LayoutView>(0);
    builder.AddAttribute(1, nameof(LayoutView.Layout), _pageLayoutType);
    builder.AddAttribute(2, nameof(LayoutView.ChildContent), _renderComponentWithParameters);
    builder.CloseComponent();
};
```

We'll see changing the layout in action later on the example page.

## Dynamic Routing

Dynamic Routing is a little more complicated.  `Router` is a sealed box, so it's take it as-is or re-write it.  Unless you must, don't.  With dynamic routing we're not looking to change existing routes, just add and remove dynamic routes.

Routes are defined at compile time and are internal to the `Router` Component.  It trawls any assemblies provided and builds a route dictionary of component/route pairs that it uses to match the Url provided by the Navigation Manager when a navigation event occurs.  The Router wires into the `NavigationManager.LocationChanged` event to trigger route changes.

RouteView Razor Pages are labelled like this:
```html
@page "/"
@page "/index"
```

This is Razor talk, and gets transposed into the following in the C# class when pre-compiled.

```csharp
[Microsoft.AspNetCore.Components.RouteAttribute("/")]
[Microsoft.AspNetCore.Components.RouteAttribute("/index")]
public partial class Index : Microsoft.AspNetCore.Components.ComponentBase
.....
```

When `Router` finds a match for a Url it renders `Found` which renders our new `RouteViewManager`.  `RouteViewManager` builds out the Layout and adds a new instance of the component defined in `RouteData`.

Let's look at what the router does when it doesn't find a route.

Routing is triggered by the Navigation Manager.  It either:
1. Intercepts navigation in the DOM - anchors, etc.
2. Is activated by a UI component calling it's `NavigateTo` method.

In either case the `LocationChanged` invokes any registered delegates passing them a `LocationChangedEventArgs` struct.

```csharp
public readonly struct LocationChangedEventArgs
{
  public string Location { get; } // The new location
  public bool IsNavigationIntercepted { get; }  
}
```
  
`IsNavigationIntercepted` is set to `ForceLoad` - default false - if the result of calling `NavigateTo` otherwise it's true.

If we can avoid causing a hard navigation event in `Router`, we can add a component in `NotFound` to handle additional dynamic routing.  Not too difficult, it is our code!  We'll look at an enhanced `NavLink` control to help us further on. 

Routing stil works with a hard navigation event, but the application reloads: we'll soon see problem navigation events in testing!

### CustomRouteData

`CustomRouteData` holds the information needed to make routing decisions.

The class looks like this with inline detailed explanations.  

```csharp
    public class CustomRouteData
    {
        /// The standard RouteData.
        public RouteData RouteData { get; private set; }
        /// The PageType to load on a match 
        public Type PageType { get; set; }
        /// The Regex String to define the route
        public string RouteMatch { get; set; }
        /// Parameter values to add to the Route when created name/defaultvalue
        public SortedDictionary<string, object> ComponentParameters { get; set; } = new SortedDictionary<string, object>();

        /// Method to check if we have a route match
        public bool IsMatch(string url)
        {
            // get the match
            var match = Regex.Match(url, this.RouteMatch,RegexOptions.IgnoreCase);
            if (match.Success)
            {
                // create new dictionary object to add to the RouteData
                var dict = new Dictionary<string, object>();
                //  check we have the same or fewer groups as parameters to map the to
                if (match.Groups.Count >= ComponentParameters.Count)
                {
                    var i = 1;
                    // iterate through the parameters and add the next match
                    foreach (var pars in ComponentParameters)
                    {
                        string matchValue = string.Empty;
                        if (i < match.Groups.Count)
                            matchValue = match.Groups[i].Value;
                        //  Use a StypeSwitch object to do the Type Matching and create the dictionary pair 
                        var ts = new TypeSwitch()
                            .Case((int x) =>
                            {
                                if (int.TryParse(matchValue, out int value))
                                    dict.Add(pars.Key, value);
                                else
                                    dict.Add(pars.Key, pars.Value);
                            })
                            .Case((float x) =>
                            {
                                if (float.TryParse(matchValue, out float value))
                                    dict.Add(pars.Key, value);
                                else
                                    dict.Add(pars.Key, pars.Value);
                            })
                            .Case((decimal x) =>
                            {
                                if (decimal.TryParse(matchValue, out decimal value))
                                    dict.Add(pars.Key, value);
                                else
                                    dict.Add(pars.Key, pars.Value);
                            })
                            .Case((string x) =>
                            {
                                dict.Add(pars.Key, matchValue);
                            });

                        ts.Switch(pars.Value);
                        i++;
                    }
                }
                // create a new RouteData object and assign it to the RouteData property. 
                this.RouteData = new RouteData(this.PageType, dict);
            }
            return match.Success;
        }

        /// Method to check if we have a route match and return the RouteData
        public bool IsMatch(string url, out RouteData routeData)
        {
            routeData = this.RouteData;
            return IsMatch(url);
        }
    }
```

## Updates to the RouteViewService

The relevant sections in `RouteViewService` are shown below. `Routes` holds the list of custom routes - it's left open so you can customize it. 
```csharp
public List<CustomRouteData> Routes { get; private set; } = new List<CustomRouteData>();

public bool GetRouteMatch(string url, out RouteData routeData)
{
    var route = Routes.FirstOrDefault(item => item.IsMatch(url));
    if (route != null && !EqualityComparer<RouteData>.Default.Equals(route))
    {
        routeData = route.RouteData;
        return true;
    }
    else
    {
        routeData = null;
        return false;
    }
}
```

For test purposes the class `new` method creates some test routes.

```csharp
public RouteViewService()
{
    var componentParameters = new SortedDictionary<string, object>();
    componentParameters.Add("ID", 0);
    var route = new CustomRouteData() { PageType = typeof(Counter), RouteMatch = @"^\/counted\/(\d+)", ComponentParameters = componentParameters };
    Routes.Add(route);
    Routes.Add(new CustomRouteData() { PageType = typeof(Counter), RouteMatch = @"^\/counters" });
    Routes.Add(new CustomRouteData() { PageType = typeof(RouteViewer), RouteMatch = @"^\/routeviewer" });
}
```

## The RouteNotFoundManager Component

`RouteNotFoundManager` is a simpler version of `RouteViewManager`.  We'll look at the relevant sections below.

`SetParametersAsync` is called when the component is loaded.  It gets the local Url and calls `GetRouteMatch` on `RouteViewService`.

```csharp
public Task SetParametersAsync(ParameterView parameters)
{
    parameters.SetParameterProperties(this);
    // Get the route url
    var url = $"/{NavManager.Uri.Replace(NavManager.BaseUri, "")}";
    // check if we have a custom route and if so use it
    if (RouteViewService.GetRouteMatch(url, out var routedata))
        _routeData = routedata;
    // if The layout is blank show the ChildContent without a layout 
    if (_pageLayoutType == null)
        _renderHandle.Render(ChildContent);
    // otherwise show the route or ChildContent inside the layout
    else
        _renderHandle.Render(_ViewFragment);
    return Task.CompletedTask;
}
```

`_ViewFragment` builds either a `RouteViewManager` if it finds a custom route or the contents of `RouteNotFoundManager`. 
  
```csharp
/// Layouted Render Fragment
private RenderFragment _ViewFragment => builder =>
{
    // check if we have a RouteData object and if so load the RouteViewManager, otherwise the ChildContent
    if (_routeData != null)
    {
        builder.OpenComponent<RouteViewManager>(0);
        builder.AddAttribute(1, nameof(RouteViewManager.DefaultLayout), _pageLayoutType);
        builder.AddAttribute(1, nameof(RouteViewManager.RouteData), _routeData);
        builder.CloseComponent();
    }
    else
    {
        builder.OpenComponent<LayoutView>(0);
        builder.AddAttribute(1, nameof(LayoutView.Layout), _pageLayoutType);
        builder.AddAttribute(2, nameof(LayoutView.ChildContent), this.ChildContent);
        builder.CloseComponent();
    }
};
```

## Switching the Route View Without Routing

Switching the RouteView without routing has several possible applications.  These are some I've used:

1. Hide direct access to the page, and only be able to navigate to it within the application.
2. Multipart forms/processes with a single entry point.  The state of the saved form/process dictates which form gets loaded.
3. Context dependant forms or information.  Login/logout/signup is a good example.  The same page but with a different routeviews loaded.

### ViewData

The equivalent to `RouteData`.  It needs no explaining.

```csharp
public class ViewData
{
    /// Gets the type of the View.
    public Type ViewType { get; set; }

    /// Gets the type of the page matching the route.
    public Type LayoutType { get; set; }

    /// Parameter values to add to the Route when created
    public Dictionary<string, object> ViewParameters { get; private set; } = new Dictionary<string, object>();

    /// Constructs an instance of <see cref="ViewData"/>.
    public ViewData(Type viewType, Dictionary<string, object> viewValues = null)
    {
        if (viewType == null) throw new ArgumentNullException(nameof(viewType));
        this.ViewType = viewType;
        if (viewValues != null) this.ViewParameters = viewValues;
    }
}
```

All the functionality is implemented in `RouteViewManager`.

### RouteViewManager

First some properties and fields. 
```csharp
/// The size of the History list used for Views.
[Parameter] public int ViewHistorySize { get; set; } = 10;

/// Gets and sets the view data.
public ViewData ViewData
{
    get => this._ViewData;
    protected set
    {
        this.AddViewToHistory(this._ViewData);
        this._ViewData = value;
    }
}

/// Property that stores the View History.  It's size is controlled by ViewHistorySize
public SortedList<DateTime, ViewData> ViewHistory { get; private set; } = new SortedList<DateTime, ViewData>();

/// Gets the last view data.
public ViewData LastViewData
{
    get
    {
        var newest = ViewHistory.Max(item => item.Key);
        if (newest != default) return ViewHistory[newest];
        else return null;
    }
}

/// Method to check if <param name="view"> is the current View
public bool IsCurrentView(Type view) => this.ViewData?.ViewType == view;

/// Boolean to check if we have a View set
public bool HasView => this._ViewData?.ViewType != null;

/// Internal ViewData used by the component
private ViewData _ViewData { get; set; }
```

A set of `LoadViewAsync` to provide a variety of ways to load a new view.  The main method sets the internal `viewData` field and calls `Render` to re-render the component.

```csharp
// The main method
public await Task LoadViewAsync(ViewData viewData = null)
{
    if (viewData != null) this.ViewData = viewData;
    if (ViewData == null)
    {
        throw new InvalidOperationException($"The {nameof(RouteViewManager)} component requires a non-null value for the parameter {nameof(ViewData)}.");
    }
    await this.RenderAsync();
}

public async Task LoadViewAsync(Type viewtype)
    => await this.LoadViewAsync(new ViewData(viewtype, new Dictionary<string, object>()));

public async Task LoadViewAsync<TView>(Dictionary<string, object> data = null)
    => await this.LoadViewAsync(new ViewData(typeof(TView), data));
```

The `_renderComponentWithParameters` property render fragment contains the code that builds out the RouteView component.  If there's a valid `_ViewData` object, it uses the `ViewData`.  If not it uses `RouteData`.

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
    else if (RouteData != null)
    {
        builder.OpenComponent(0, RouteData.PageType);
        foreach (var kvp in RouteData.RouteValues)
        {
            builder.AddAttribute(1, kvp.Key, kvp.Value);
        }
        builder.CloseComponent();
    }
    else 
    {
        builder.OpenElement(0, "div");
        builder.AddContent(1, "No Route or View Configured to Display");
        builder.CloseElement();
    }
};
```

```csharp
```

```csharp
```


 

