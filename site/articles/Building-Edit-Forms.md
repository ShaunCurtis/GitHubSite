---
title: Building Blazor Edit Forms
date: 2021-08-02
oneliner: How to build Blazor Edit Forms that manage state.
precis: How to build Blazor Edit Forms that manage state.
published: 2021-08-02
---
# Managing Form Edit State in Blazor

To set the context of this article, there have been many discussions, articles and proposals since Blazor was first released on how to handle edit forms. Specifically how to stop, or at least warn, the user when leaving a dirty form. The problem is not specific to Blazor: all Single Page Applications and Web Sites face the same challenges.

In a classic web form, every navigation is a get or a post back to the server. We can use the Browser `window.beforeunload` event to warn a user that they have unsaved data on the page. Not great, but at least something - we'll be using it later. This technique falls flat in SPAs. What looks to the outsider like a navigation event isn't. The NavigationManager intercepts any navigation attempt from the page, triggers its own LocationChanged event and sinks the request. The Router, wired into this event, does its wizardry, and loads the new component set into the page. No real browser navigation takes place, so there's nothing for the browser's beforeunload event to catch.

It's up to the programmer to write code that stops a user moving away from a dirty form. That's easier said than done when your application depends on the URL navigation pretext. Toolbars, navigation side bars and many buttons submit URLs to navigate around the application. Think of the out-of-the-box Blazor template. There's all the links in the left navigation, about in the top bar.

Personally, I have a serious issue with the whole routing charade: an SPA is an application, not a website, but I think I must be a minority of one! This article is for the majority.

All Blazor edit state solutions I've come across were cludges in one way or another, I've created more that one myself. What the community hoped for were changes in NetCore 5, specifically some extra functionality in NavigationManager to cancel or block navigation requests. That didn't happen: I don't think there was team concensus on the right solution, so we're back to square one.

What I cover in this article is my latest approach to the problem. It's not perfect, but I don't think we will ever get a near perfect solution until we get some new browser standards allowing a switch to SPA mode and control over toolbar navigation.

Our goal is to hit the user in one of two ways if they try and exit a dirty form.  There are no side doors!

![Dirty Editor](/siteimages/Articles/Edit-Forms/Dirty-Exit.png)

![Dirty Editor](/siteimages/Articles/edit-forms/Dirty-App-Exit.png)

## Code Repository and Demo Site

The repository for the article is [here](https://github.com/ShaunCurtis/Blazr.EditForms).

You can see the code in this article in action on my Blazr Database demo site is here - [https://cec-blazor-database.azurewebsites.net/](https://cec-blazor-database.azurewebsites.net/).  There are straight, inline and modal dialog versions.

## Form Exits

There are three (controlled) ways a user can exit a form:
1. **Intra Form Navigation** - Clicking on an Exit button within the form.
2. **Intra Application Navigation** - Clicking on a link in a navigation bar outside the form, clicking on the forward or back buttons on the browser.
3. **Extra Application Navigation** - entering a new Url in the address bar, clicking on a favourite, closing the browser Tab or application.

We have no control over killing the browser - say a reboot or system crash - so don't consider that here.

## Form Edit State

Before we can intelligently control edit form exits we need to know thwe state of the form - is the data in the form different from the record?  Out-of-the-box Blazor has no mechanisms to do this.  There is a very simplistic attempt at it in `EditContext`, but it's not fit-for-purpose.   We need an edit state manager.

This implementation uses two primary classes.

1. `EditStateService` - is a scoped service that holds the state of the current edit form during the SPA session.
2. `EditFormState` - is a component that interacts with the `EditContext` within a form.  It stores the initial `Model` values in a `EditFieldCollection`, receives updates from the `EditContext` and updates the `EditStateService` as changes take place.

### EditStateService

`EditStateService` is a scoped service state container that tracks the edit state of a form.  It has a set of methods to set and update state, and two events.

```csharp
using System;

namespace Blazr.EditForms
{
    /// <summary>
    /// Service Class for managing Form Edit State
    /// </summary>
    public class EditStateService
    {
        private bool _isDirty;

        public bool IsDirty => _isDirty && !string.IsNullOrWhiteSpace(this.Data) && !string.IsNullOrWhiteSpace(this.Data);
        public string Data { get; set; }
        public string EditFormUrl { get; set; }
        public bool ShowEditForm => (!String.IsNullOrWhiteSpace(EditFormUrl)) && IsDirty;
        public bool DoFormReload { get; set; }

        public event EventHandler RecordSaved;
        public event EventHandler<EditStateEventArgs> EditStateChanged;

        public void SetEditState(string data, string formUrl)
        {
            this.Data = data;
            this.EditFormUrl = formUrl;
            this._isDirty = true;
        }

        public void ClearEditState()
        {
            this.Data = null;
            this._isDirty = false;
            this.EditFormUrl = string.Empty;
        }

        public void ResetEditState()
        {
            this.Data = null;
            this._isDirty = false;
            this.EditFormUrl = string.Empty;
        }

        public void NotifyRecordSaved()
        {
            RecordSaved?.Invoke(this, EventArgs.Empty);
            EditStateChanged?.Invoke(this, EditStateEventArgs.NewArgs(false));
        }

        public void NotifyRecordExit()
            => this.NotifyRecordSaved();

        public void NotifyEditStateChanged(bool dirtyState)
            => EditStateChanged?.Invoke(this, EditStateEventArgs.NewArgs(dirtyState));
    }
}
```

#### EditStateEventArgs

```csharp
using System;

namespace Blazr.EditForms
{
    public class EditStateEventArgs : EventArgs
    {
        public bool IsDirty { get; set; }

        public static EditStateEventArgs NewArgs(bool dirtyState)
            => new EditStateEventArgs { IsDirty = dirtyState };
    }
}
```

### EditFormState

`EditFormState` is a UI control with no UI output.  It's placed within an `EditForm` and captures the cascaded `EditContext`, and the `EditStateService` through dependency injection.  It exposes an `EditStateChanged` event and an `IsDirty` property.

`EditFormState` reads all the write properties from the `EditContext` and saves them to an `EditFields` collection.

##### EditField

`EditField` looks like this.  All but `EditedValue` are `init` record type properties.

```csharp
    public class EditField
    {
        public string FieldName { get; init; }
        public Guid GUID { get; init; }
        public object Value { get; init; }
        public object EditedValue { get; set; }
        public object Model { get; init; }

        public bool IsDirty
        {
            get
            {
                if (Value != null && EditedValue != null) return !Value.Equals(EditedValue);
                if (Value is null && EditedValue is null) return false;
                return true;
            }
        }

        public EditField(object model, string fieldName, object value)
        {
            this.Model = model;
            this.FieldName = fieldName;
            this.Value = value;
            this.EditedValue = value;
            this.GUID = Guid.NewGuid();
        }

        public void Reset()
            => this.EditedValue = this.Value;
    }
```
##### EditFieldCollection

`EditFieldCollection` implements `IEnumerable`.  It provides:
 1.  An `IsDirty` property which checks the state of all the `EditFields` in the collection.
 2. A set of getters and setters for adding and setting the edit state. 

```csharp
    public class EditFieldCollection : IEnumerable
    {
        private List<EditField> _items = new List<EditField>();
        public int Count => _items.Count;
        public Action<bool> FieldValueChanged;
        public bool IsDirty => _items.Any(item => item.IsDirty);

        public void Clear()
            => _items.Clear();

        public void ResetValues()
            => _items.ForEach(item => item.Reset());
..... lots of getters and setters and IEnumerator implementation code
```

#### EditFormState

`EditFormState` Properties/Fields

```csharp
public class EditFormState : ComponentBase, IDisposable
{
    private bool disposedValue;
    private EditFieldCollection EditFields = new EditFieldCollection();

    [CascadingParameter] public EditContext EditContext { get; set; }

    [Inject] private EditStateService EditStateService { get; set; }
    [Inject] private IJSRuntime _js { get; set; }
    [Inject] private NavigationManager NavManager { get; set; }

```
When `EditFormState` initilaises it:

1. Loads the `EditFields` from `EditContext.Model`.
2. Checks the `EditStateService` and if it's dirty gets and deserializes `Data`.
3. Sets the `EditedValue` for each `EditField` to the deserialized `Data` value.
4. Applies the saved `Data` values back to the `EditContext.Model`.
5. Hooks up `FieldChanged` to `OnFieldChanged` on `EditContext` to receive user edits.
6. Hooks up `OnSave` to `RecordSaved` on `EditStateService` to know when to reset.

```csharp
protected override Task OnInitializedAsync()
{
    Debug.Assert(this.EditContext != null);

    if (this.EditContext != null)
    {
        // Populates the EditField Collection
        this.LoadEditState();
        // Wires up to the EditContext OnFieldChanged event
        this.EditContext.OnFieldChanged += this.FieldChanged;
        this.EditStateService.RecordSaved += this.OnSave;
    }
    return Task.CompletedTask;
}

private void LoadEditState()
{
    this.GetEditFields();
    if (EditStateService.IsDirty)
        SetEditState();
}

private void GetEditFields()
{
    var model = this.EditContext.Model;
    this.EditFields.Clear();
    if (model is not null)
    {
        var props = model.GetType().GetProperties();
        foreach (var prop in props)
        {
            if (prop.CanWrite)
            {
                var value = prop.GetValue(model);
                EditFields.AddField(model, prop.Name, value);
            }
        }
    }
}

private void SetEditState()
{
    var recordtype = this.EditContext.Model.GetType();
    object data = JsonSerializer.Deserialize(EditStateService.Data, recordtype);
    if (data is not null)
    {
        var props = data.GetType().GetProperties();
        foreach (var property in props)
        {
            var value = property.GetValue(data);
            EditFields.SetField(property.Name, value);
        }
        this.SetModelToEditState();
        if (EditFields.IsDirty)
            this.NotifyEditStateChanged();
    }
}

private void SetModelToEditState()
{
    var model = this.EditContext.Model;
    var props = model.GetType().GetProperties();
    foreach (var property in props)
    {
        var value = EditFields.GetEditValue(property.Name);
        if (value is not null && property.CanWrite)
            property.SetValue(model, value);
    }
}
```

`FieldChanged` is triggered by the user changing a value in the form. It:
1. Reads the current `IsDirty`.
2. Gets the property and new value from the `FieldChangedEventArgs`.
3. Sets the `EditField` in the `EditFieldCollection`.
4. Checks if the Edit State has changed and if so invokes the `EditStateChanged` event.
5. Updates the `EditStateService` edit state.  Either updates it if the edit state is dirty or clears it if the edit state is clean.
6. Sets/resets the `PageExitCheck` if there is a edit state change - more later.

```csharp
private void FieldChanged(object sender, FieldChangedEventArgs e)
{
    var wasDirty = EditFields?.IsDirty ?? false;
    // Get the PropertyInfo object for the model property
    // Uses reflection to get property and value
    var prop = e.FieldIdentifier.Model.GetType().GetProperty(e.FieldIdentifier.FieldName);
    if (prop != null)
    {
        // Get the value for the property
        var value = prop.GetValue(e.FieldIdentifier.Model);
        // Sets the edit value in the EditField
        EditFields.SetField(e.FieldIdentifier.FieldName, value);
        // Invokes EditStateChanged if changed
        var isStateChange = (EditFields?.IsDirty ?? false) != wasDirty;
        var isDirty = EditFields?.IsDirty ?? false;
        if (isStateChange)
            this.NotifyEditStateChanged();
        if (isDirty)
            this.SaveEditState(isStateChange);
        else
            this.ClearEditState();
    }
}

private void SaveEditState(bool isStateChange)
{
    if (isStateChange)
        this.SetPageExitCheck(true);
    var jsonData = JsonSerializer.Serialize(this.EditContext.Model);
    EditStateService.SetEditState(jsonData, NavManager.Uri);
}

private void ClearEditState()
{
    this.SetPageExitCheck(false);
    EditStateService.ClearEditState();
}

private void SetPageExitCheck(bool action)
    => _js.InvokeAsync<bool>("blazr_setEditorExitCheck", action);
```

1. `OnSave` clears the current edit state and reloads `EditFields` from the update `model`.
2. `NotifyEditStateChanged` notifies `EditStateService` that the edit state has changed.  This raises the `EditStateChanged` event.
3. `Dispose` tidies up.

```csharp
private void OnSave(object sender, EventArgs e)
{
    this.ClearEditState();
    this.LoadEditState();
}

private void NotifyEditStateChanged()
{
    var isDirty = EditFields?.IsDirty ?? false;
    this.EditStateService.NotifyEditStateChanged(isDirty);
}

// IDisposable Implementation
protected virtual void Dispose(bool disposing)
{
    if (!disposedValue)
    {
        if (disposing)
        {
            if (this.EditContext != null)
                this.EditContext.OnFieldChanged -= this.FieldChanged;
        }
        this.EditStateService.RecordSaved -= this.OnSave;
        disposedValue = true;
    }
}

public void Dispose()
{
    // Do not change this code. Put cleanup code in 'Dispose(bool disposing)' method
    Dispose(disposing: true);
    GC.SuppressFinalize(this);
}
```

### Extra Site Navigation

This occurs when the user tries to leave the site - closing the browser tab, or clicking on a favourite.  There is no way to stop this directly in Blazor - there's no raised event to link into.  However, the browser does have an event `beforeunload`.  You don't have much control over it, but you can tell the browser to ask the user if they wish to exit the page.

*site.js* defines two functions for adding/removing the event from the browser `window` object.

```js
window.blazr_setEditorExitCheck = function (show) {
    if (show) {
        window.addEventListener("beforeunload", blazr_showExitDialog);
    }
    else {
        window.removeEventListener("beforeunload", blazr_showExitDialog);
    }
}

window.blazr_showExitDialog = function (event) {
    event.preventDefault();
    event.returnValue = "There are unsaved changes on this page.  Do you want to leave?";
}
```

This can then be called from Blazor:

```csharp
[Inject] private IJSRuntime _js { get; set; }

private void SetPageExitCheck(bool action)
    => _js.InvokeAsync<bool>("blazr_setEditorExitCheck", action);

```

`SetPageExitCheck` is used in setting and clearing the edit state in `EditFormState`

```csharp
private void SaveEditState(bool isStateChange)
{
    if (isStateChange)
        this.SetPageExitCheck(true);
    var jsonData = JsonSerializer.Serialize(this.EditContext.Model);
    EditStateService.SetEditState(jsonData, NavManager.Uri);
}

private void ClearEditState()
{
    this.SetPageExitCheck(false);
    EditStateService.ClearEditState();
}
```

and in `WeatherEditor` to clear the edit state on exitting the form.

```csharp
private void Exit()
{
    this.EditStateService.ResetEditState();
    this.SetPageExitCheck(false);
    NavManager.NavigateTo("/fetchdata");
}
```

### Intra Site Navigation

Intra site navigation is handled by the `Router` defined in `App`.  The actual rendering is handled by `RouteView`.  This is a simpler component to modify than the router.  Our revised process for `RouteView` looks like this:

![RouteViewManager](/siteimages/Articles/edit-forms/RouteViewManager.png)

### RouteViewManager

`RouteViewManager` is based on `RouteView`.  Most of the code is lifted directly from that component.  There's no Razor code, the Html is build directly using `RenderFragments` and `RenderTreeBuilder`

```csharp
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.JSInterop;
using System;
using System.Collections.Generic;
using System.Reflection;
using System.Threading.Tasks;

namespace Blazr.EditForms
{
    public class RouteViewManager : IComponent
    {
        private bool _RenderEventQueued;
        private RenderHandle _renderHandle;

        [Inject] private EditStateService EditStateService { get; set; }

        [Inject] private IJSRuntime _js { get; set; }

        [Inject] private NavigationManager NavManager { get; set; }

        [Parameter] public RouteData RouteData { get; set; }

        [Parameter] public Type DefaultLayout { get; set; }

        public void Attach(RenderHandle renderHandle)
            => _renderHandle = renderHandle;

        public async Task SetParametersAsync(ParameterView parameters)
        {
            // Sets the component parameters
            parameters.SetParameterProperties(this);

            // Check if we have either RouteData or ViewData
            if (RouteData == null)
            {
                throw new InvalidOperationException($"The {nameof(RouteView)} component requires a non-null value for the parameter {nameof(RouteData)}.");
            }
            // Render the component
            await this.RenderAsync();
        }

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

        private RenderFragment _layoutViewFragment => builder =>
        {
            Type _pageLayoutType = RouteData?.PageType.GetCustomAttribute<LayoutAttribute>()?.LayoutType
                ?? DefaultLayout;

            builder.OpenComponent<LayoutView>(0);
            builder.AddAttribute(1, nameof(LayoutView.Layout), _pageLayoutType);
            if (this.EditStateService.IsDirty && this.EditStateService.DoFormReload is not true)
                builder.AddAttribute(2, nameof(LayoutView.ChildContent), _dirtyExitFragment);
            else
            {
                this.EditStateService.DoFormReload = false;
                builder.AddAttribute(3, nameof(LayoutView.ChildContent), _renderComponentWithParameters);
            }
            builder.CloseComponent();
        };

        private RenderFragment _dirtyExitFragment => builder =>
        {
            builder.OpenElement(0, "div");
            builder.AddAttribute(1, "class", "dirty-exit");
            {
                builder.OpenElement(2, "div");
                builder.AddAttribute(3, "class", "dirty-exit-message");
                builder.AddContent(4, "You are existing a form with unsaved data");
                builder.CloseElement();
            }
            {
                builder.OpenElement(5, "div");
                builder.AddAttribute(6, "class", "dirty-exit-message");
                {
                    builder.OpenElement(7, "button");
                    builder.AddAttribute(8, "class", "dirty-exit-button");
                    builder.AddAttribute(9, "onclick", EventCallback.Factory.Create<MouseEventArgs>(this, this.DirtyExit));
                    builder.AddContent(10, "Exit and Clear Unsaved Data");
                    builder.CloseElement();
                }
                {
                    builder.OpenElement(11, "button");
                    builder.AddAttribute(12, "class", "load-dirty-form-button");
                    builder.AddAttribute(13, "onclick", EventCallback.Factory.Create<MouseEventArgs>(this, this.LoadDirtyForm));
                    builder.AddContent(14, "Reload Form");
                    builder.CloseElement();
                }
                builder.CloseElement();
            }
            builder.CloseElement();
        };

        private RenderFragment _renderComponentWithParameters => builder =>
        {
            Type componentType = null;
            IReadOnlyDictionary<string, object> parameters = new Dictionary<string, object>();

            if (RouteData != null)
            {
                componentType = RouteData.PageType;
                parameters = RouteData.RouteValues;
            }

            if (componentType != null)
            {
                builder.OpenComponent(0, componentType);
                foreach (var kvp in parameters)
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

        public async Task RenderAsync() => await InvokeAsync(() =>
        {
            if (!this._RenderEventQueued)
            {
                this._RenderEventQueued = true;
                _renderHandle.Render(_renderDelegate);
            }
        }
        );

        protected Task InvokeAsync(Action workItem)
            => _renderHandle.Dispatcher.InvokeAsync(workItem);

        protected Task InvokeAsync(Func<Task> workItem)
            => _renderHandle.Dispatcher.InvokeAsync(workItem);

        private Task DirtyExit(MouseEventArgs d)
        {
            this.EditStateService.ClearEditState();
            this.SetPageExitCheck(false);
            return RenderAsync();
        }

        private void LoadDirtyForm(MouseEventArgs e)
        {
            this.EditStateService.DoFormReload = true;
            NavManager.NavigateTo(this.EditStateService.EditFormUrl);
        }

        private void SetPageExitCheck(bool action)
            => _js.InvokeAsync<bool>("cecblazor_setEditorExitCheck", action);
    }
}
```

The component has two button event handlers to handle the two dirty form options:
1. `DirtyExit`
2. `LoadDirtyForm`
   
 and `SetPageExitCheck` to set the browser page exit event.

The RenderFragement code builds out the layout which adds either `_dirtyExitFragment` to build the Dirty Exit View or `_renderComponentWithParameters` to build out the route/view component. 

### Adding the Css

Add the following Css to one of the referenced Css files.  In the solution it's in a standalone *site.css* in the library project.

```css
div.dirty-exit {
    width: 400px;
    margin: 10px auto 10px auto;
}

div.dirty-exit-message {
    text-align: center;
    margin: 20px 0px;
    font-size: 1.5rem;
    font-weight: 600;
    font-variant: small-caps;
}

div.dirty-exit button {
    display: inline-block;
    font-size: 1rem;
    font-weight: 400;
    color: #fff;
    vertical-align: middle;
    padding: .4rem .75rem;
    text-align: center;
    margin-right: 1rem;
    border-radius: 0;
    border-style: none;
}

button.dirty-exit-button {
    background-color: #e74a3b;
    border-color: #e74a3b;
}

button.load-dirty-form-button {
    background-color: #1cc88a;
    border-color: #1cc88a;
}
```

## Implementing a Solution

### Solution

Create a Blazor solution from the Server Template.
 - Solution Name: *Blazr.EditForms*
 - Project Name: *Blazr.EditForms.Server*

Add a Razor Library Template project - *Blazr.EditForms*.  Copy all the code from my Repo.

### Blazr.EditForms.Server

Update `Startup`

```csharp
public void ConfigureServices(IServiceCollection services)
{
    ....
    services.AddSingleton<WeatherForecastService>();
    // Add the EditStateService
    services.AddScoped<EditStateService>();
}
```

Update `WeatherForecastService`

```csharp
// Add a method to get a dummy record
public Task<WeatherForecast> GetWeatherForecastAsync(Guid Id)
{
    return Task.FromResult(new WeatherForecast
    {
        Date = DateTime.Now,
        TemperatureC = 12,
        Summary = "Balmy"
    });
}
```

Update `_Hosts.cshtml`

```csharp
<head>
    // extra stylesheets
    <link href="/_content/Blazr.EditForms/site.css" rel="stylesheet" />
    <link href="/Blazr.EditForms.Server.styles.css" rel="stylesheet" />
</head>
.....
    // site Js
    <script src="/_content/Blazr.EditForms/site.js"></script>
</body>
```

Update `NavMenu`

```csharp
// Add two more links
<li class="nav-item px-3">
    <NavLink class="nav-link" href="WeatherForecastEditor">
        <span class="oi oi-list-rich" aria-hidden="true"></span> Editor
    </NavLink>
</li>
<li class="nav-item px-3">
    <NavLink class="nav-link" href="InlineWeatherForecastEditor">
        <span class="oi oi-list-rich" aria-hidden="true"></span> Inline Editor
    </NavLink>
</li>
```

Update `App.razor`, changing out `RouteView` for `RouteViewManager`.

```html
....
<Found Context="routeData">
    <RouteViewManager RouteData="@routeData" DefaultLayout="@typeof(MainLayout)" />
</Found>
....
```

### WeatherForecastEditor

Our base editor form looks like this.  This will work as is, but there's not edit state and no exit/navigation control. 

```html
@page "/WeatherForecastEditor"

@using Blazr.EditForms.Server.Data
@implements IDisposable

<div class="container">
    <div class="row">
        <div class="col-12">
            <h3>Weather Forecast Editor</h3>
        </div>
    </div>
    <EditForm Model="record" OnValidSubmit="SaveRecord">
        <div class="row">
            <div class="col-12">
                <label class="form-label">Date</label>
                <InputDate class="form-control" @bind-Value="record.Date" />
                <div class="valid-feedback">
                    <ValidationMessage For="() => record.Date" />
                </div>
            </div>
        </div>
        <div class="row">
            <div class="col-12">
                <label class="form-label">Temperature</label>
                <InputNumber class="form-control" @bind-Value="record.TemperatureC" />
                <div class="valid-feedback">
                    <ValidationMessage For="() => record.TemperatureC" />
                </div>
            </div>
        </div>
        <div class="row">
            <div class="col-12">
                <label class="form-label">Summary</label>
                <InputText class="form-control" @bind-Value="record.Summary" />
                <div class="valid-feedback">
                    <ValidationMessage For="() => record.Summary" />
                </div>
            </div>
        </div>
        <div class="row mt-2">
            <div class="col-12 text-right">
                <button class="btn btn-success">Submit</button>
                <button class="btn btn-dark" @onclick="Exit">Exit</button>
            </div>
        </div>
    </EditForm>
</div>
```
```csharp
@code {
    [Inject] WeatherForecastService ForecastService { get; set; }
    [Inject] NavigationManager NavManager { get; set; }

    private WeatherForecast record = new WeatherForecast();

    protected override async Task OnInitializedAsync()
    {
        EditService.EditStateChanged += OnEditStateChanged;
    }

    protected Task SaveRecord()
    {
        return Task.CompletedTask;
    }

    protected void Exit()
    {
        NavManager.NavigateTo("/");
    }

    public void Dispose()
    =>  EditService.EditStateChanged -= OnEditStateChanged;
}
```

### Add Edit State Control

Add the `EditFormState` control to the edit form.

```html
    <EditForm Model="record" OnValidSubmit="SaveRecord">
        <EditFormState />
        ....
```

Update the buttons, adding some state control to their display and enable status.

```html
<div class="col-12 text-right">
    @if (_isDirty)
    {
        <button class="btn btn-danger" @onclick="Exit">Exit without Saving</button>
    }
    <button class="btn btn-success" disabled="@_isClean">Submit</button>
    <button class="btn btn-dark" disabled="@_isDirty" @onclick="Exit">Exit</button>
</div>
```

Inject the `EditStateService` and add internal fields to hold the edit state

```csharp
    // inject the EditStateService
    [Inject] EditStateService EditService { get; set; }

    // internal bool fields for state management
    private bool _isDirty;
    private bool _isClean => !_isDirty;
```

Add a `OnEditStateChanged` event handler and attach it to `EditService.EditStateChanged`.  It sets the internal state fields and calls `StateHasChanged` to initiate a render of the form.  Unregister the event handler in `Dispose`.

```csharp
protected override async Task OnInitializedAsync()
{
    this.record = await ForecastService.GetWeatherForecastAsync(Guid.NewGuid());
    EditService.EditStateChanged += OnEditStateChanged;
}

private void OnEditStateChanged(object sender, EditStateEventArgs e)
{
    _isDirty = e.IsDirty;
    StateHasChanged();
}

public void Dispose()
    =>  EditService.EditStateChanged -= OnEditStateChanged;
```

Update `SaveRecord` and `Exit` to notify the service of the state change. 

```csharp
protected Task SaveRecord()
{
    EditService.NotifyRecordSaved();
    return Task.CompletedTask;
}

protected void Exit()
{
    EditService.NotifyRecordExit();
    NavManager.NavigateTo("/");
}
```

## Using the Inline Dialog

The inline dialog adds a little more control, blocking out all intra-application navigation except the browser back/forward buttons.  You can see the code in the Repo.  It's simple to use.

Add an `InlineWeatherForecastEditor` page and copy the contents of `WeatherForecastEditor`.

Add an `InLineDialog` control wrapper around the whole form, with the parameters set as shown.  `Lock` turns it off and on. 

```html
@page "/InlineWeatherForecastEditor"
....
<InlineDialog Transparent="false" Lock="_isDirty">
    <div class="container p-2">
        ....
    </div>
</InlineDialog>
```

## The Solution in Action

Run the solution and go to **Editor**.  You will see:

![Clean Editor](/siteimages/Articles/Edit-Forms/Clean-Form-Editor.png)

Change a value, and you will see:

![Dirty Editor](/siteimages/Articles/Edit-Forms/Dirty-Form-Editor.png)

Click on a menu link, or hit the browser back button:

![Dirty Editor](/siteimages/Articles/Edit-Forms/Dirty-Form-Exit.png)

You now get the Dirty Exit Challenge from `RouteViewManager`.  Check what happens on each action.

Finally hit F5 to reload the page.

![Dirty Editor](/siteimages/Articles/Edit-Forms/Dirty-App-Exit.png)

This time you get the browser challenge - the text depends on the specific browser - they all implement the challenge slightly differently.

Check out the **Inline Editor**

![Dirty Editor](/siteimages/Articles/Edit-Forms/Dirty-Form-Inline-Dialog.png)




