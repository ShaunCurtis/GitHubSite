---
title: Part 4 - UI Components
oneliner: This article describes how to build UI Components.
precis: This article looks at the components we use in the UI and then focuses on how to build generic UI Components from HTML and CSS.
date: 2021-07-04
published: 2020-10-03
---

# Building a Database Application in Blazor 
## Part 4 - UI Components

::: danger
This set of articles are currently being updated
:::

## Introduction

This article is the fourth in a series on Building Blazor Database Applications.  This article looks at the components we use in the UI and then focuses on how to build generic UI Components from HTML and CSS.

1. Project Structure and Framework.
2. Services - Building the CRUD Data Layers.
3. View Components - CRUD Edit and View Operations in the UI.
4. UI Components - Building HTML/CSS Controls.
5. View Components - CRUD List Operations in the UI.

## Repository and Database

The repository for the articles has move to [CEC.Blazor.SPA Repository](https://github.com/ShaunCurtis/CEC.Blazor.SPA).  [CEC.Blazor GitHub Repository](https://github.com/ShaunCurtis/CEC.Blazor) is obselete and will be removed.

There's a SQL script in /SQL in the repository for building the database.

[You can see the Server and WASM versions of the project running here on the same site](https://cec-blazor-database.azurewebsites.net/).

### Components

For a detailed look at components read my article [A Dive into Blazor Components](https://shauncurtis.github.io/articles/Blazor-Components.html).

Everything in the Blazor UI, other than the start page, is a component.  Yes App, Router,... they're all components.  Not all components emit Html.

You can divide components into four categories:
1. RouteViews - these are the top level components.  Views are combined with a Layout to make the display window.
2. Layouts - Layouts combine with Views to make up the display window.
3. Forms - Forms are logical collections of controls.  Edit forms, display forms, list forms, data entry wizards are all classic forms.  Forms contain controls - not HTML.
4. Controls - Controls either display something - emit HTML - or do some unit of work.  Text boxes, dropdowns, buttons, grids are all classic Hrtml emitting controls. App, Router, Validation are controls that do units of work.

### RouteViews

RouteViews are application specific.  The only difference between a RouteView and a Form is a RouteView declares one or more routes through the `@Page` directive - or directly as a `[RouteAttribute]` on a class.  On the `Router` component declared in the root `App`,  `AppAssembly` specifies the assembly that `Router` trawls on initialization to find all the declared routes.

In the application RouteViews are declared in the WASM application library and are common to both WASM and Server SPAs. 

The Weather Forecast Viewer and List Views are shown below.

```csharp
// Blazor.Database/RouteViews/Weather/WeatherViewer.cs
@page "/weather/view/{ID:Guid}"
@namespace Blazor.Database.RouteViews

<WeatherForecastViewerForm ID="this.ID" ExitAction="this.ExitToList"></WeatherForecastViewerForm>

@code {
    [Parameter] public Guid ID { get; set; }

    [Inject] public NavigationManager NavManager { get; set; }

    private void ExitToList()
        => this.NavManager.NavigateTo("/fetchdata");
}
```


```csharp
// Blazor.Database/RouteViews/Weather/FetchData.cs
@page "/fetchdata"
@namespace Blazor.Database.RouteViews

<WeatherForecastListForm EditRecord="this.GoToEditor" ViewRecord="this.GoToViewer" NewRecord="this.GoToNew" ExitAction="Exit"></WeatherForecastListForm>

@code {

    [Inject] NavigationManager NavManager { get; set; }

    private bool _isWasm => NavManager?.Uri.Contains("wasm", StringComparison.CurrentCultureIgnoreCase) ?? false;

    public void GoToEditor(Guid id)
    => this.NavManager.NavigateTo($"weather/edit/{id}");

    public void GoToNew()
    => this.NavManager.NavigateTo($"weather/edit/{Guid.Empty}");

    public void GoToViewer(Guid id)
    => this.NavManager.NavigateTo($"weather/view/{id}");

    public void Exit()
    {
        if (_isWasm)
            this.NavManager.NavigateTo($"/wasm");
        else
            this.NavManager.NavigateTo($"/");
    }

}
```

### Forms

We saw Forms in the last article.  They're specific to the application.

The code below shows the Weather Viewer.  It's all UI Controls, no HTML markup.

```html
// Blazor.Database/Forms/WeatherForecast/WeatherForecastViewerForm.razor
@namespace Blazor.Database.Forms
@inherits RecordFormBase<WeatherForecast>

<UIContainer>
    <UIFormRow>
        <UIColumn>
            <h2>Weather Forecast Viewer</h2>
        </UIColumn>
    </UIFormRow>
</UIContainer>
<UILoader Loaded="this.IsLoaded">
    <UIContainer>
        <UIFormRow>
            <UILabelColumn>
                Date
            </UILabelColumn>
            <UIInputColumn Cols="3">
                <InputReadOnlyText Value="@this.ControllerService.Record.Date.ToShortDateString()"></InputReadOnlyText>
            </UIInputColumn>
            <UIColumn Cols="7"></UIColumn>
        </UIFormRow>
        <UIFormRow>
            <UILabelColumn>
                Temperature &deg;C
            </UILabelColumn>
            <UIInputColumn Cols="2">
                <InputReadOnlyText Value="@this.ControllerService.Record.TemperatureC.ToString()"></InputReadOnlyText>
            </UIInputColumn>
            <UIColumn Cols="8"></UIColumn>
        </UIFormRow>
        <UIFormRow>
            <UILabelColumn>
                Temperature &deg;f
            </UILabelColumn>
            <UIInputColumn Cols="2">
                <InputReadOnlyText Value="@this.ControllerService.Record.TemperatureF.ToString()"></InputReadOnlyText>
            </UIInputColumn>
            <UIColumn Cols="8"></UIColumn>
        </UIFormRow>
        <UIFormRow>
            <UILabelColumn>
                Summary
            </UILabelColumn>
            <UIInputColumn Cols="9">
                <InputReadOnlyText Value="@this.ControllerService.Record.Summary"></InputReadOnlyText>
            </UIInputColumn>
        </UIFormRow>
    </UIContainer>
</UILoader>
<UIContainer>
    <UIFormRow>
        <UIButtonColumn>
            <UIButton AdditionalClasses="btn-secondary" ClickEvent="this.Exit">Exit</UIButton>
        </UIButtonColumn>
    </UIFormRow>
</UIContainer>
```

The code behind page is relatively simple - the complexity is in the boilerplate code in the parent classes.  It loads the record specific Controller service.

```csharp
// Blazor.Database/Forms/WeatherForecast/WeatherForecastViewerForm.razor.cs
public partial class WeatherForecastViewerForm : RecordFormBase<WeatherForecast>
{

    [Inject] private WeatherForecastViewService ViewService { get; set; }

    protected async override Task OnInitializedAsync()
    {
        this.Service = this.ViewService;
        await base.OnInitializedAsync();
    }
}
```

## UI Controls

UI Controls emit HTML and CSS markup.  All the controls here are based on the Bootstrap CSS Framework.  All controls inherit from `ComponentBase` and UI Controls inherit from `UIComponent`.

#### AppComponentBase

`AppComponentBase` inherits from `ComponentBase` and adds functionality to manage splatter attributes and the `Childcontent` render fragment.

```csharp
public class AppComponentBase : ComponentBase
{
    [Parameter] public RenderFragment ChildContent { get; set; }

    [Parameter(CaptureUnmatchedValues = true)] public IDictionary<string, object> UserAttributes { get; set; } = new Dictionary<string, object>();

    protected virtual List<string> UnwantedAttributes { get; set; } = new List<string>();

    protected Dictionary<string, object> SplatterAttributes
    {
        get
        {
            var list = new Dictionary<string, object>();
            foreach (var item in UserAttributes)
            {
                if (!UnwantedAttributes.Any(item1 => item1.Equals(item.Key)))
                    list.Add(item.Key, item.Value);
            }
            return list;
        }
    }
}
```

#### UIComponent

`UIComponent` inherits from `AppComponentBase`.  It builds an HTML DIV block that you can turn on or off.

Lets look at some of `UIComponent` in detail.

The HTML block tag can be set using the `Tag` parameter.  It can only be set by inherited classes.

```csharp
[Parameter] public string Tag { get; set; } = null;
protected virtual string HtmlTag => this.Tag ?? "div";
```

The control Css class is built using a `CssBuilder` class.  Inheriting classes can add Css to the `CssClasses` collection.  External css can be set using the `class` attribute on the control.

```csharp
protected virtual List<string> CssClasses { get; private set; } = new List<string>();
protected string CssClass
    => CSSBuilder.Class()
        .AddClass(CssClasses)
        .AddClassFromAttributes(this.UserAttributes)
        .Build();
```

The control can be hidden or disabled with two parameters.  When `Show` is true `ChildContent` is displayed.  When `Show` is false `HideContent` is displayed if it isn't `null`, otherwise nothing is displayed.

```csharp
[Parameter] public bool Show { get; set; } = true;
[Parameter] public bool Disabled { get; set; } = false;
[Parameter] public EventCallback<MouseEventArgs> ClickEvent { get; set; }
```

Finally the control sets the attributes to remove from the splatter attributes.

```csharp
protected override List<string> UnwantedAttributes { get; set; } = new List<string>() { "class" };
```

The control builds the `RenderTree` in code.

```csharp
protected override void BuildRenderTree(RenderTreeBuilder builder)
{
    if (this.Show)
    {
        builder.OpenElement(0, this.HtmlTag);
        if (!string.IsNullOrWhiteSpace(this.CssClass)) builder.AddAttribute(1, "class", this.CssClass);
        if (Disabled) builder.AddAttribute(2, "disabled");
        if (ClickEvent.HasDelegate)
            builder.AddAttribute(3, "onclick", EventCallback.Factory.Create<MouseEventArgs>(this, ClickEvent));
        builder.AddMultipleAttributes(3, this.SplatterAttributes);
        builder.AddContent(4, ChildContent);
        builder.CloseElement();
    }
}
```

### Some Examples

The rest of the article looks at a few of the UI controls in more detail.

#### UIButton

This is a standard Bootstrap Button. 
1. `Type` is set through the `type` attribute.
2. A Css Class is added.
3. The button colour is set through the `class` attribute.
4. The Tag is set to `button`
5. `ButtonClick`, `Show` and `Disabled` are handled by the base component.

```csharp
// Blazor.SPA/Components/UIComponents/Forms/UIButtons.cs
public class UIButton : UIComponent
{
    public UIButton()
        => this.CssClasses.Add("btn mr-1");

    protected override string HtmlTag => "button";
}
```

Here's some code showing the control in use.

```html
<UIButton Show="true" Disabled="this._dirtyExit" class="btn-dark" ClickEvent="() => this.Exit()">Exit</UIButton>
```

#### UILoader

This is a wrapper control designed to save implementing error checking in child content. It only renders child content when `State` is `Loaded`.  It displays alternative content when the view is loading or in error.

```csharp
@namespace Blazor.SPA.Components
@inherits ComponentBase
@if (this.State == ComponentState.Loaded)
{
    @this.ChildContent
}
else if (this.State == ComponentState.InError)
{
    if (this.ErrorContent != null)
    {
        @this.ErrorContent
    }
    else
    {
        <div class="m-2 p-2">Error Loading Content</div>
    }
}
else
{
    if (this.LoadingContent != null)
    {
        @this.LoadingContent
    }
    else
    {
        <div class="m-2 p-2">Loading......</div>
    }
}
@code{

    [Parameter] public RenderFragment ChildContent { get; set; }
    [Parameter] public RenderFragment LoadingContent { get; set; }
    [Parameter] public RenderFragment ErrorContent { get; set; }
    [Parameter] public ComponentState State { get; set; } = ComponentState.Loaded;

}
```

You can see the control in use in the Edit and View forms.

#### UIContainer/UIRow/UIColumn

These controls create the BootStrap grid system - i.e. container, row and column - by building out DIVs with the correct Css.

```csharp
public class UIContainer : UIComponent
{
    public UIContainer()
        => CssClasses.Add("container - fluid");
}
```

```csharp
class UIRow : UIComponent
{
    public UIRow()
        => CssClasses.Add("row");
}
```

```csharp
public class UIColumn : UIComponent
{
    [Parameter] public virtual int Cols { get; set; } = 0;

    public UIColumn()
        => CssClasses.Add(this.Cols > 0 ? $"col-{this.Cols}" : $"col");
}
```

```csharp
public class UILabelColumn : UIColumn
{
    [Parameter] public override int Cols { get; set; } = 2;
    [Parameter] public string FormCss { get; set; } = "form-label";

    public UILabelColumn()
        => this.CssClasses.Add(this.FormCss);
}
```

Here's some code showing the controls in use.

```html
<UIContainer>
    <UIRow>
        <UILabelColumn Columns="2">
            Date
        </UILabelColumn>
        ............
    </UIRow>
..........
</UIContainer>
```

## Wrap Up
This article provides an overview on how to build UI Controls with components, and examines some example components in detail.  You can see all the library UIControls in the GitHub Repository

Some key points to note:
1. They are simple, most of the functionality can be built in the base component.
2. UI Controls abstract markup from higher level components such as Forms and Views.
3. UI Controls give control and discipline over the HTML and CSS markup.
4. View and Form components are much cleaner and easier to view.
5. Use as little or as much abstraction as you wish.
6. Controls, such as `UILoader`, just make life easier!

Check the readme in the repository for the latest version of the article set.

## History

* 21-Sep-2020: Initial version.
* 17-Nov-2020: Major Blazor.CEC library changes.  Change to ViewManager from Router and new Component base implementation.
* 29-Mar-2021: Major updates to Services, project structure and data editing.
* 24-June-2021: revisions to data layers.

