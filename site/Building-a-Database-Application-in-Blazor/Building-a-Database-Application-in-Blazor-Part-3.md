---
title: Part 3 - Building Edit and View UI Components
oneliner: This article describes building the Edit and View UI components for a Blazor Database Application.
precis: This article describes building the Edit and View UI components for a Blazor Database Application.
date: 2021-07-04
published: 2020-10-03
---

# Part 3 - View Components - CRUD Edit and View Operations in the UI

::: warning
These articles are currently being updated.  Most of the text and code is correct, but...
:::

## Introduction

This is the third in a series of articles looking at how to build and structure a Database Application in Blazor. The articles so far are:

1. Project Structure and Framework.
2. Services - Building the CRUD Data Layers.
3. View Components - CRUD Edit and View Operations in the UI.
4. UI Components - Building HTML/CSS Controls.
5. View Components - CRUD List Operations in the UI.

This article looks in detail at building reusable CRUD presentation layer components, specifically Edit and View functionality.  There are significant changes since the first release.

I find it interesting that most programmers try and automate Edit And View forms by building a control factory rather than boilerplating everything else. Most forms are unique to their record set.  Certain fields can be grouped together and put on the same line.  Text fields change in length depending on how many characters they need.  Building a factory to handle this, plus the added complication of linkages between the control, the dataclass instance and validation, doesn't seem worth it.  The configuration dataset becomes more complicated than the form it's trying to mimic.  For those reasons there's no form factory here, just a set of libary UI component classes to standardise form building.

## Sample Project, Code and Demo Site

The repository for the articles has moved to [Blazor.Database Repository](https://github.com/ShaunCurtis/Blazor.Database).  All previous repos are obselete and will be removed shortly.

There's a SQL script in /SQL in the repository for building the database.

The demo site has changed now the Server and WASM have been combined.  The site starts in Server mode - [https://cec-blazor-database.azurewebsites.net/](https://cec-blazor-database.azurewebsites.net/).

The List Form
![Weather Forecast Viewer](/siteimages/Articles/Database/FetchData-List.png)

The Modal Viewer
![Weather Forecast Viewer](/siteimages/Articles/Database/WeatherForecast-Viewer.png)

The Inline Editor
![Weather Forecast Viewer](/siteimages/Articles/Database/WeatherForecast-Editor.png)

Edit State Control
![Weather Forecast Viewer](/siteimages/Articles/Database/Editor-dirty-Exit.png)


Several custom controls are used in the forms.  The detail on these is covered in separate articles:

Code Project Articles:
- [EditFormState Control](https://www.codeproject.com/Articles/5297299/A-Blazor-Edit-Form-State-Control)
- [EditValidationState Control](https://www.codeproject.com/Articles/5297302/A-Blazor-Validation-Control) 
- [InlineDialog Control](https://www.codeproject.com/Articles/5297432/A-Blazor-Inline-Dialog-Control)
- [ModalDialog Control](https://www.codeproject.com/Articles/5294466/A-Blazor-Modal-Dialog-Editor)

This Repo Originals:

- [EditFormState](articles/Building-Edit-Forms.html)
- [EditValidationState Control](/articles/validationformstate.html) 
- [InlineDialog Control](/articles/inline-dialog.html)
- [ModalDialog Control](/articles/bootstrap-modal-dialog.html)

## The Base Forms

All Razor based UI components inherit from `ComponentBase` unless otherwise specified. All source files can be viewed on the Github site, and I include references or links to specific code files at appropriate places in the article.  In most places you need to read through the code for detailed commentary on functionality.

### RecordFormBase

`RecordFormBase` is the base abstract class used by the record forms. It inherits from `ComponentBase`.  Instances of Record Forms can exist in several UI contexts:
 
1. As the root component in a RouteView, where the RouteView passes the form the `Id` via a Parameter.
2. Within a modal dialog in a list or other component.  The ID is passed to the form through a `DialogOptions` class.  
3. As an inline editor within another component such as a list, where the component passes the form the `Id` via a Parameter.

`RecordFormBase` detects if it is within a modal dialog context by checking for a cascaded `IModalDialog` object.  There are two sets of dependancies:  
1. The `Id` of the record.  This is either passed as a `Parameter` if the form is hosted in a RouteView or other component, or in a public `ModalOptions` property of `IModalDialog`.
2. The Exit mechanism.  The form exits by either:
   1.  Calling close on `Modal` if it's in a modal context.
   2.  Calling the `ExitAction` delegate if one if registered.
   3.  The default - exit to the site root.
 
 Namespace : *Razr.SPA.Components*
```csharp
// Namespace: *Razr.SPA.Components*
// Domain: UI Domain
// File: Blazr.SPA/Forms/RecordFormBase.cs
public abstract class RecordFormBase<TRecord> :
    ComponentBase
    where TRecord : class, IDbRecord<TRecord>, new()
{
    [CascadingParameter] public IModalDialog Modal { get; set; }
    [Parameter] public Guid ID { get; set; } = Guid.Empty;
    [Parameter] public EventCallback ExitAction { get; set; }

    [Inject] protected NavigationManager NavManager { get; set; }

    protected IModelViewService<TRecord> Service { get; set; }
    protected virtual bool IsLoaded => this.Service != null && this.Service.Record != null;
    protected virtual ComponentState LoadState => IsLoaded ? ComponentState.Loaded : ComponentState.Loading;
    protected virtual bool HasServices => this.Service != null;
    protected bool IsModal => this.Modal != null;
    protected Guid _modalId { get; set; } = Guid.Empty;
    protected Guid _Id => TryGetModalID() ? _modalId : this.ID;

    protected async override Task OnInitializedAsync()
    {
        // Get the record
        await LoadRecordAsync();
        await base.OnInitializedAsync();
    }

    protected virtual async Task LoadRecordAsync()
        => await this.Service.GetRecordAsync(this._Id);

    protected virtual bool TryGetModalID()
    {
        if (this.IsModal && this.Modal.Options.TryGet<Guid>("Id", out Guid value))
        {
            this._modalId = value;
            return true;
        }
        return false;
    }

    protected virtual async Task Exit()
    {
        // If we're in a modal context, call Close on the cascaded Modal object
        if (this.IsModal)
            this.Modal.Close(ModalResult.OK());
        // If there's a delegate registered on the ExitAction, execute it. 
        else if (ExitAction.HasDelegate)
            await ExitAction.InvokeAsync();
        // else fallback action is to navigate to root
        else
            this.NavManager.NavigateTo("/");
    }
}
```

### EditRecordFormBase

`EditRecordFormBase` is the base editor form. It inherits from `RecordFormBase` and implements editing functionality. `TEditRecord` is the editable class for `TRecord`.

It:
1. Creates an instance of `TEditRecord` caled `Model` and populates it from `TRecord`.
2. Retrieves the dirty dataset from `EditStateService` if one exists.
3. Assigns the `TEditRecord` to the `EditContext` and manages the `EditContext`.
4. Has a set of Boolean Properties to track state and manage button display/disabled state.
5. Saves the record.

The form "locks" the browser page when the form is dirty.
 
```csharp
// Namespace: *Razr.SPA.Components*
// Domain: UI Domain
// File: Blazr.SPA/Forms/EditRecordFormBase.cs
public abstract class EditRecordFormBase<TRecord, TEditRecord> :
    RecordFormBase<TRecord>,
    IDisposable
    where TRecord : class, IDbRecord<TRecord>, new()
    where TEditRecord : class, IEditRecord<TRecord>, new()
{
    [Inject] private IJSRuntime _js { get; set; }
    [Inject] protected EditStateService EditStateService { get; set; }

    protected EditContext EditContext { get; set; }
    protected bool IsDirty => this.EditStateService.IsDirty;
    protected virtual string FormUrl { get; set; }
    protected TEditRecord Model { get; set; }

    // Set of boolean properties/fields used in the razor code and methods to track 
    // state in the form or disable/show/hide buttons.
    protected bool _isNew => this.Service?.IsNewRecord ?? true;
    protected bool _isValid { get; set; } = true;
    protected bool _saveDisabled => !this.IsDirty || !this._isValid;
    protected bool _deleteDisabled => this._isNew || this._confirmDelete || this.IsDirty;
    protected bool _isLoaded { get; set; } = false;
    protected bool _dirtyExit => this.IsDirty;
    protected bool _confirmDelete { get; set; } = false;
    protected bool _isInlineDirty => (!this.IsModal) && this.IsDirty;
    protected string _saveButtonText => this._isNew ? "Save" : "Update";
    protected override ComponentState LoadState => _isLoaded ? ComponentState.Loaded : ComponentState.Loading;

    protected override async Task LoadRecordAsync()
    {
        _isLoaded = false;
        // Get the ID either from a ModalDialog Options or the Id Parameter and set the local id
        var id = this._Id;
        // Check if we have a dirty form reload and if so get the Id from the EditStateService
        if (this.EditStateService.IsDirty)
            id = (Guid)this.EditStateService.RecordID;
        // Get the record
        await this.Service.GetRecordAsync(id);
        // Get a new Edit class instance, populate it from the record and assign it to the EditContext
        this.Model = new TEditRecord();
        this.Model.Populate(this.Service.Record);
        this.EditContext = new EditContext(this.Model);
        // Set up the EditStateService FirmUrl and Record Id
        this.EditStateService.EditFormUrl = FormUrl ?? NavManager.Uri;
        this.EditStateService.RecordID = id;
        _isLoaded = true;
        // wire up the events
        this.EditContext.OnFieldChanged += FieldChanged;
        this.EditStateService.EditStateChanged += OnEditStateChanged;
        // if we have a dirty record or are editing an existing record, run validation
        if (!this._isNew)
            this.EditContext.Validate();
    }

    protected void FieldChanged(object sender, FieldChangedEventArgs e)
        =>  this._confirmDelete = false;

    private void OnEditStateChanged(object sender, EditStateEventArgs e)
    {
        if (this.IsModal) this.Modal.Lock(e.IsDirty);
        this.InvokeAsync(StateHasChanged);
    }

    protected void ValidStateChanged(bool valid)
        => this._isValid = valid;

    protected async Task HandleValidSubmit()
    {
        // Get the readonly record to submit
        var rec = this.Model.GetRecord();
        // Save the record
        await this.Service.SaveRecordAsync(rec);
        // Update the EditStateService to clean
        this.EditStateService.NotifyRecordSaved();
        // Render the component
        await this.InvokeAsync(this.StateHasChanged);
    }

    protected void ResetToRecord()
        =>  this.Model.Populate(this.Service.Record);

    protected void Delete()
    {
        if (!this._isNew)
            this._confirmDelete = true;
    }

    protected async Task ConfirmDelete()
    {
        if (this._confirmDelete)
        {
            await this.Service.DeleteRecordAsync();
            await this.DoExit();
        }
    }

    protected async Task ConfirmExit()
    {
        this.EditStateService.ResetEditState();
        this.SetPageExitCheck(false);
        await this.DoExit();
    }

    protected async Task DoExit(ModalResult result = null)
    {
        result ??= ModalResult.OK();
        if (this.IsModal)
            this.Modal.Close(result);
        if (ExitAction.HasDelegate)
            await ExitAction.InvokeAsync();
        else
            this.NavManager.NavigateTo("/");
    }

    private void SetPageExitCheck(bool action)
        => _js.InvokeAsync<bool>("cecblazor_setEditorExitCheck", action);

    public void Dispose()
    {
        if (this.EditContext != null)
            this.EditContext.OnFieldChanged -= FieldChanged;
    }
}
```
### Edit State Management

The Edit state is managed through three classes:

1. `EditStateService` - a scoped State Service to hold information about a dirty form.
2. `EditFormState` - a component within the `EditForm` Component that tracks the state of the fields within the `EditContext` model class and maintains the state of `EditStateService`.  On initialization it reloads any dirty data stored in `EditStateService`.
3. `RouteViewManager` - a replace component for `RouteView` in `App`.  It injects `EditStateService` and loads a custom "Are You Sure You want to Exit the Form" form if `EditStateService` has a dirty form.

There's also a Js script that's loaded in the base page *site.js*.

```js
// File: Blazr.SPA/wwwroot/site.js
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

You can see the C# interface method in `EditRecordFormBase` above and being called in `ConfirmExit`.

```csharp
protected async Task ConfirmExit()
{
    this.EditStateService.ResetEditState();
    this.SetPageExitCheck(false);
    await this.DoExit();
}

private void SetPageExitCheck(bool action)
    => _js.InvokeAsync<bool>("cecblazor_setEditorExitCheck", action);
```

## Implementing Forms

### WeatherForecastViewerForm

The code for the `WeatherForecastViewerForm` is pretty simple.

1. Inherit from `RecordFormBase` and set `TRecord` as `WeatherForecast`.
2. Get the `WeatherForecastViewService` and assign it to the base `Service` property.

```csharp
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

The majority of the code is component markup in the Razor file.  
1. There's no Html code, it's all components.  We'll look at UI components in detail on the next article.  
2. The layout is based on Bootstrap grids.
3. Column size dictated control size.
4. `UILoader` only loads it's content when we have a record to display.

```html
@namespace Blazr.Database.Forms
@inherits RecordFormBase<WeatherForecast>

<UIContainer>
    <UIFormRow>
        <UIColumn>
            <h2>Weather Forecast Viewer</h2>
        </UIColumn>
    </UIFormRow>
</UIContainer>
<UILoader State="this.LoadState">
    <UIContainer>
        <FormViewControl Label="Date" Value="@this.ViewService.Record.Date.LocalDateTime.ToShortDateString()" IsRow="true" ControlCols="7" />
        <FormViewControl Label="Temperature &deg;C" Value="@this.ViewService.Record.TemperatureC.ToString()" IsRow="true" ControlCols="7" />
        <FormViewControl Label="Temperature &deg;F" Value="@this.ViewService.Record.TemperatureF.ToString()" IsRow="true" ControlCols="7" />
        <FormViewControl Label="Summary" Value="@this.ViewService.Record.Summary" IsRow="true" ControlCols="7" />
    </UIContainer>
</UILoader>
<UIContainer>
    <UIFormRow>
        <UIButtonColumn>
            <UIButton type="button" class="btn-secondary" ClickEvent="this.Exit">Exit</UIButton>
        </UIButtonColumn>
    </UIFormRow>
</UIContainer>
```

### WeatherForecastEditorForm

`WeatherForecastEditorForm` is similar to `WeatherForecastViewerForm`.

The code is again pretty simple.

1. Inherit from `EditRecordFormBase` and set `TRecord` as `WeatherForecast` and `TEditRecord` as `EditWeatherForecast`.
2. Get the `WeatherForecastViewService` and assign it to the base `Service` property.

```csharp
public partial class WeatherForecastEditorForm : EditRecordFormBase<WeatherForecast, EditWeatherForecast>
{

    [Inject] private WeatherForecastViewService ViewService { get; set; }

    protected async override Task OnInitializedAsync()
    {
        //this.FormUrl = "/Weather/Edit";
        this.Service = ViewService;
        await LoadRecordAsync();
    }
}
```
The Razor file is shown below.  It's based on the standard Blazor EditForm with some additional controls.  The same comments made on the Viewer apply here.  In addition:

1. `InlineDialog` is a form locking control.  It's enabled by the `_isInlineDirty` property.  Go to the demo site and edit a record to see it in action. It's only enabled when the form isn't in a modal context.
2. `EditFormState` is the control that tracks the form edit state.  It links with `InlineDialog` to control form locking.
3. `ValidationFormState` is a custom validation control.
4. The buttons are tied to the boolean control properties to manage their state.

The custom controls are covered in separate articles referenced in the Links section. 

```html
@namespace Blazr.Database.Forms
@inherits EditRecordFormBase<WeatherForecast, EditWeatherForecast>

<InlineDialog Lock="this._isInlineDirty" Transparent="false">
    <FormViewTitle>
        <h2>Weather Forecast Editor</h2>
    </FormViewTitle>
    <UILoader State="this.LoadState">
        <EditForm EditContext="this.EditContext" OnValidSubmit="HandleValidSubmit" class=" px-2 py-3">
            <EditFormState/>
            <ValidationFormState ValidStateChanged="this.ValidStateChanged"></ValidationFormState>
            <UIContainer>
                <FormViewRow Title="Unique ID" Value="@this.Model.ID.ToString()" />
                <UIFormRow>
                    <UIColumn MediumColumns="6" Columns=12>
                        <FormEditControl Label="Date" ShowLabel="true" @bind-Value="this.Model.Date" ControlType="typeof(InputDate<DateTimeOffset>)" IsRequired="true" ShowValidation="true" HelperText="Enter the Forecast Date"></FormEditControl>
                    </UIColumn>
                    <UIColumn MediumColumns="6" Columns=12>
                        <FormEditControl Label="Temperature &deg;C" ShowLabel="true" @bind-Value="this.Model.TemperatureC" ControlType="typeof(InputNumber<int>)" IsRequired="true" ShowValidation="true" HelperText="Enter the Temperature"></FormEditControl>
                    </UIColumn>
                </UIFormRow>
                <UIFormRow>
                    <UIColumn MediumColumns="12" Columns=12>
                        <FormEditControl Label="Summary" ShowLabel="true" @bind-Value="this.Model.Summary" IsRequired="true" ShowValidation="true" HelperText="Summarise the Weather"></FormEditControl>
                    </UIColumn>
                </UIFormRow>
            </UIContainer>
            <FormEditButtons ContainerSize="BootstrapSize.XLarge">
                <UIButton type="button" Show="true" Disabled="this._deleteDisabled" class="btn-outline-danger" ClickEvent="() => Delete()">Delete</UIButton>
                <UIButton type="button" Show="this._confirmDelete" class="btn-danger" ClickEvent="() => this.ConfirmDelete()">Confirm Delete</UIButton>
                <UIButton type="button" Show="this.IsDirty" class="btn-outline-warning" ClickEvent="() => this.ResetToRecord()">Reset</UIButton>
                <UIButton type="submit" Show="true" Disabled="this._saveDisabled" class="btn-success">@this._saveButtonText</UIButton>
                <UIButton type="button" Show="this.IsDirty" class="btn-danger" ClickEvent="() => this.ConfirmExit()">Exit Without Saving</UIButton>
                <UIButton type="button" Show="!this.IsDirty" class="btn-dark" ClickEvent="() => this.Exit()">Exit</UIButton>
            </FormEditButtons>
        </EditForm>
    </UILoader>
</InlineDialog>
```

## RouteView Implementations

The RouteView implementation of the viewer is shown below.

1. Declares the `Route` with an ID `Parameter`.
2. Declares the form `WeatherForecastViewerForm`.
3. Passes the `ID` to the form and attaches a delegate to `ExitAction` which returns to the *fetchdata* view.

```html
// WeatherViewer.razor
@page "/weather/view/{ID:guid}"
@namespace Blazr.Database.RouteViews

<WeatherForecastViewerForm ID="this.ID" ExitAction="this.ExitToList"></WeatherForecastViewerForm>

@code {
    [Parameter] public Guid ID { get; set; }

    [Inject] public NavigationManager NavManager { get; set; }

    private void ExitToList()
        => this.NavManager.NavigateTo("/fetchdata");

}
``` 
The editor is exactly the same, but declares the form `WeatherForecastEditorForm`.

```html
// WeatherEditor.razor
@page "/weather/edit/{ID:guid}"
@namespace Blazr.Database.RouteViews

<WeatherForecastEditorForm ID="this.ID" ExitAction="this.ExitToList"></WeatherForecastEditorForm>

@code {

    [Parameter] public Guid ID { get; set; }

    [Inject] public NavigationManager NavManager { get; set; }

    private void ExitToList()
        => this.NavManager.NavigateTo("/fetchdata");
}
```

## Wrap Up

That wraps up this article.  We've shown how to build boilerplate code into base forms and how to implement viewer and editor forms.  We'll look in more detail at the list forms and how the viewer and editors are called in a separate article.   
Some key points to note:
1. The Blazor Server and Blazor WASM code is the same.
2. Almost all the functionality is implemented in library components.  Most of the application code is Razor markup for the individual record fields.
3. The Razor files contains controls, not HTML.
4. Async in used through.

If you're reading this article in the future, check the readme in the repository for the latest version of the article set.

## History

* 19-Sep-2020: Initial version.
* 17-Nov-2020: Major Blazor.CEC library changes.  Change to ViewManager from Router and new Component base implementation.
* 29-Mar-2021: Major updates to Services, project structure and data editing.
* 24-June-2021: revisions to data layers.
* 06-Aug-2012: revisions to reflect the project and library remodelling to the domain model.
