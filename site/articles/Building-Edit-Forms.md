---
title: Building Blazor Edit Forms
date: 2021-08-02
oneliner: How to build Blazor Edit Forms that manage state.
precis: How to build Blazor Edit Forms that manage state.
published: 2021-08-02
---
# Managing Form Edit State in Blazor

You've edited data in a form.  You click on a link in the navigation bar, click the back button, hit a favourite link.  Do you really want to exit the form ? Maybe, maybe not.  What you probably want is to be at least warned if you have unsaved data in the form you are exiting.

![Dirty Editor](/siteimages/Articles/Edit-Forms/Dirty-Exit.png)

This code is part of a larger Blazor Database template project. The repository for the project is [Blazor.Database Repository](https://github.com/ShaunCurtis/Blazor.Database).

The demo site is here - [https://cec-blazor-database.azurewebsites.net/](https://cec-blazor-server.azurewebsites.net/).

## Form Exits

There are three (controlled) ways a user can exit a form:
1. Intra Form Navigation - Clicking on an Exit button within the form.
2. Intra Application Navigation - Clicking on a link in a navigation bar outside the form, clicking on the forward or back buttons on the browser.
3. Extra Application Navigation - entering a new Url in the address bar, clicking on a favourite, closing the browser Tab or application.

We have no control over killing the browser - say a reboot or system crash - so I won't consider that here.

## Form Edit State

The first step is to track edit state - are any of the current entered values different from the stored values?  Out-of-the-box Blazor has no mechanisms to do this.  We need an edit state manager.

This is implemented as two classes.
1. `EditStateService` - is a scoped service that holds the state of the current edit form during the SPA session.
2. `EditFormState` - is a component that interacts with the `EditContext` within a form.  It stores the initial `Model` values and any user updates in an `EditFieldCollection`.  It updates the `EditStateService` as any changes take place.

### EditStateService

`EditStateService` is a scoped service state container that tracks the edit state of the current form.

```csharp
public class EditStateService
{
    private bool _isDirty;
    public object RecordID { get; set; }
    public bool IsDirty => _isDirty && !string.IsNullOrWhiteSpace(this.Data) && !string.IsNullOrWhiteSpace(this.Data) && this.RecordID != null;
    public string Data { get; set; }
    public string EditFormUrl { get; set; }
    public bool ShowEditForm => (!String.IsNullOrWhiteSpace(EditFormUrl)) && IsDirty;
    public bool DoFormReload { get; set; }

    public event EventHandler RecordSaved;
    public event EventHandler<EditStateEventArgs> EditStateChanged;

    public void SetEditState(string data)
    {
        this.Data = data;
        this._isDirty = true;
    }

    public void ClearEditState()
    {
        this.Data = null;
        this._isDirty = false;
    }

    public void ResetEditState()
    {
        this.RecordID = null;
        this.Data = null;
        this._isDirty = false;
        this.EditFormUrl = string.Empty;
    }

    public void NotifyRecordSaved()
        => RecordSaved?.Invoke(this, EventArgs.Empty);

    public void NotifyEditStateChanged(bool dirtyState)
        => EditStateChanged?.Invoke(this, EditStateEventArgs.NewArgs(dirtyState));
}
```

### EditFormState

`EditFormState` is a UI control with no UI output - like `EditForm`.  It's placed within an `EditForm` and captures the cascaded `EditContext`, and the `EditStateService` through dependency injection.  It exposes an `EditStateChanged` event and an `IsDirty` property.

`EditFormState` reads all the write properties from the `EditContext` and saves them to an `EditFields` collection.

`EditField` looks like this.  Note all but `EditedValue` are `init` record type properties.

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

`EditFormState` Properties/Fields

```csharp
private bool disposedValue;
private EditFieldCollection EditFields = new EditFieldCollection();

[CascadingParameter] public EditContext EditContext { get; set; }

[Inject] private EditStateService EditStateService { get; set; }
[Inject] private IJSRuntime _js { get; set; }

```
When the component is initilaised it:

1. Loads `EditFields` from `EditContext.Model`.
2. Checks the `EditStateService` and if it's dirty gets and deserializes `Data`.
3. Sets the `EditedValue` for each `EditField` to the saved `Data` value.
4. Applies the saved `Data` values to the `EditContext.Model`.
5. Hooks up `FieldChanged` to `OnFieldChanged` on `EditContext` to get all the user edits.
6. Hooks up `OnSave` to `RecordSaved` on `EditStateService` to reset `EditFields`.

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

/// Populates EditFields with the initla values from the loaded model
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

/// Applies the saved edit state to EditFields
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
            this.EditStateChanged.InvokeAsync(true);
    }
}

/// Sets the Model values to the saved edit state values
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

`EditFormState.FieldChanged` is triggered by a input change:
1. Reads the current `IsDirty`.
2. Gets the property and new value from the `FieldChangedEventArgs`.
3. Sets the `EditField` in the `EditFieldCollection`.
4. Checks if the Edit State has changed and if so invokes the `EditStateChanged` event.
5. Updates the `EditStateService` edit state.  Either updates it if the edit state is dirty or clears it if the edit state is clean.
6. Sets/resets the `PageExitCheck` - more later.

```csharp
private async void FieldChanged(object sender, FieldChangedEventArgs e)
{
    var isDirty = EditFields?.IsDirty ?? false;
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
        var stateChange = (EditFields?.IsDirty ?? false) != isDirty;
        isDirty = EditFields?.IsDirty ?? false;
        if (stateChange)
            await this.EditStateChanged.InvokeAsync(isDirty);
        if (isDirty)
            this.SaveEditState();
        else
            this.ClearEditState();
    }
}

private void SaveEditState()
{
    this.SetPageExitCheck(true);
    var jsonData = JsonSerializer.Serialize(this.EditContext.Model);
    EditStateService.SetEditState(jsonData);
}

private void ClearEditState()
{
    this.SetPageExitCheck(false);
    EditStateService.ClearEditState();
}

private void SetPageExitCheck(bool action)
    => _js.InvokeAsync<bool>("cecblazor_setEditorExitCheck", action);

```

1. `OnSave` clears the current edit state and reloads `EditFields` from the update `model`.
2. `NotifyEditStateChanged` notifies `EditStateService` that the edit state has changed.  This raises the `EditStateChanged` event.

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

```

### Extra Site Navigation

This occurs when the user tries to leave the site - closing the browser tab, or clicking on a favourite.  There is no way to stop this directly in Blazor - there's no raised event to link into.  However, the browser does have an event `beforeunload`.  You don't have much control over it, but you can tell the browser to ask the user if they wish to exit the page.

*site.js* defines two functions for adding/removing the event from the browser `window` object.

```js
window.cecblazor_setEditorExitCheck = function (show) {
    if (show) {
        window.addEventListener("beforeunload", cecblazor_showExitDialog);
    }
    else {
        window.removeEventListener("beforeunload", cecblazor_showExitDialog);
    }
}

window.cecblazor_showExitDialog = function (event) {
    event.preventDefault();
    event.returnValue = "There are unsaved changes on this page.  Do you want to leave?";
}
```

This can then be called from Blazor:

```csharp
[Inject] private IJSRuntime _js { get; set; }

private void SetPageExitCheck(bool action)
    => _js.InvokeAsync<bool>("cecblazor_setEditorExitCheck", action);

```

`SetPageExitCheck` is used in setting and clearing the edit state in `EditFormState`

```csharp
private void SaveEditState()
{
    this.SetPageExitCheck(true);
    var jsonData = JsonSerializer.Serialize(this.EditContext.Model);
    EditStateService.SetEditState(jsonData);
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

`RouteViewManager` is based on `RouteView`.  It contains code for handling View Management which isn't shown here.

The key sections for loading are:

```csharp
    public class RouteViewManager : IComponent
    {
        private bool _RenderEventQueued;
        private RenderHandle _renderHandle;

        [Inject] private EditStateService EditStateService { get; set; }
        [Inject] private IJSRuntime _js { get; set; }
        [Inject] private NavigationManager NavManager { get; set; }
        [Inject] private RouteViewService RouteViewService { get; set; }

        [Parameter] public RouteData RouteData { get; set; }

        [Parameter] public Type DefaultLayout { get; set; }

        //... RouteView Code

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
            // we've routed and need to clear the ViewData
            this._ViewData = null;
            // Render the component
            await this.RenderAsync();
        }

        //...  Load Route View Code

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
                ?? RouteViewService.Layout
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
                builder.OpenElement(2, "div");
                builder.AddAttribute(3, "class", "dirty-exit-message");
                {
                    builder.OpenElement(2, "button");
                    builder.AddAttribute(3, "class", "dirty-exit-button");
                    builder.AddAttribute(5, "onclick", EventCallback.Factory.Create<MouseEventArgs>(this, this.DirtyExit));
                    builder.AddContent(6, "Exit and Clear Unsaved Data");
                    builder.CloseElement();
                }
                {
                    builder.OpenElement(2, "button");
                    builder.AddAttribute(3, "class", "load-dirty-form-button");
                    builder.AddAttribute(5, "onclick", EventCallback.Factory.Create<MouseEventArgs>(this, this.LoadDirtyForm));
                    builder.AddContent(6, "Reload Form");
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

            if (_ViewData != null)
            {
                componentType = _ViewData.ViewType;
                parameters = _ViewData.ViewParameters;
            }
            else if (RouteData != null)
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
```

The component has two button event handlers to handle the two Dirty Form options
1. `DirtyExit`
2. `LoadDirtyForm`
   
 and `SetPageExitCheck` to set the browser page exit event.

The RenderFragement code builds out the layout which adds either `_dirtyExitFragment` to build the Dirty Exit view or `_renderComponentWithParameters` to build out the route/view component. 

## The Solution in Action

You can see the solution in action at [https://cec-blazor-database.azurewebsites.net/](https://cec-blazor-server.azurewebsites.net/).

Run the solution go to **FetchData** and click on Edit a record.  You will see:

![Clean Editor](/siteimages/Articles/edit-forms/Clean-Editor.png)

Save/Update disabled, normal Exit and you can go where you want.

Now Change the Temperature, and you will see:

![Dirty Editor](/siteimages/Articles/edit-forms/Dirty-Editor.png)

Now Save is enabled and the Exit button has changed.

Click on a menu link, or hit the browser back button:

![Dirty Editor](/siteimages/Articles/edit-forms/Dirty-Exit.png)

You now get the Dirty Exit Challenge from `RouteViewManager`.  Check what happens on each action.

Finally hit F5 to reload the page.

![Dirty Editor](/siteimages/Articles/edit-forms/Dirty-App-Exit.png)

This time you get the browser challenge - the text depends on the specific browser - they all implement the challenge slightly differently.


