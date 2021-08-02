---
title: Part 5 - View Components - CRUD List Operations in the UI
oneliner: This article describes how to build the View Components.
precis: This article looks in detail at building reusable List Presentation Layer components and deploying them in both Server and WASM projects.
date: 2021-07-04
published: 2020-10-03
---

# Building a Database Application in Blazor 
## Part 5 - View Components - CRUD List Operations in the UI

## Introduction

This article is the fifth in a series on Building Blazor Database Applications. The articles so far are:

1. Project Structure and Framework.
2. Services - Building the CRUD Data Layers.
3. View Components - CRUD Edit and View Operations in the UI.
4. UI Components - Building HTML/CSS Controls.
5. View Components - CRUD List Operations in the UI.

This article looks in detail at building reusable List UI components and deploying them in both Server and WASM projects.

## Repository and Database

The repository for the articles has moved to [Blazor.Database Repository](https://github.com/ShaunCurtis/Blazor.Database).  The older repositories are obselete and have been removed.

There's a SQL script in /SQL in the repository for building the database.

[You can see the Server and WASM versions of the project running here on the same site](https://cec-blazor-database.azurewebsites.net/).

## List Functionality

List components present more challenges than other CRUD components.  Functionality expected in a production level list control includes:
* Paging -  to handle large data sets
* Column formatting - to control column width and data overflow
* Sorting - on columns
* Filtering - not covered here.


## The Base Forms

`ListFormBase` is the base abstract form for all lists. It inherits from `ComponentBase`, and contains all the boilerplate code.  `TRecord` is the dataclass it operates on.  The form uses the 

The code is shown below
```csharp
public abstract class ListFormBase<TRecord> : ComponentBase, IDisposable
    where TRecord : class, IDbRecord<TRecord>, new()
{
    [Parameter] public EventCallback<Guid> EditRecord { get; set; }
    [Parameter] public EventCallback<Guid> ViewRecord { get; set; }
    [Parameter] public EventCallback<Guid> NewRecord { get; set; }
    [Parameter] public EventCallback ExitAction { get; set; }

    [Inject] protected NavigationManager NavManager { get; set; }

    protected IModelViewService<TRecord> Service { get; set; }
    protected bool IsLoaded => this.Service?.HasRecords ?? false;
    protected ComponentState LoadState => IsLoaded ? ComponentState.Loaded : ComponentState.Loading;
    protected bool HasService => this.Service != null;

    protected override async Task OnInitializedAsync()
    {
        if (HasService)
        {
            await this.Service.GetRecordsAsync();
            this.Service.ListHasChanged += OnListChanged;
        }
    }

    protected void OnListChanged(object sender, EventArgs e)
        => this.InvokeAsync(this.StateHasChanged);

    protected virtual void Edit(Guid id)
        => this.EditRecord.InvokeAsync(id);

    protected virtual void View(Guid id)
        => this.ViewRecord.InvokeAsync(id);

    protected virtual void New()
        => this.NewRecord.InvokeAsync();

    protected virtual void Exit()
    {
        if (ExitAction.HasDelegate)
            ExitAction.InvokeAsync();
        else
            this.NavManager.NavigateTo("/");
    }

    public void Dispose()
        => this.Service.ListHasChanged -= OnListChanged;
}
```

### Paging and Sorting

Paging and sorting is implemented by a `RecordPager` class that resides in the ControllerService.  There are UI components that interact with the `RecordPager`: `DataPagingControl` and `SortControl`.

You can see `DataPagingControl` in use in a list form - here in the left side of a button row at the bottom of the form

```csharp
<UIContainer>
    <UIFormRow>
        <UIColumn Cols="8">
            <DataPagingControl RecordPager="this.ViewService.RecordPager"></DataPagingControl>
        </UIColumn>
        <UIButtonColumn Cols="4">
            <UIButton type="button" Show="true" class="btn-success" ClickEvent="() => this.New()">New Record</UIButton>
            <UIButton type="button" class="btn-secondary" ClickEvent="this.Exit">Exit</UIButton>
        </UIButtonColumn>
    </UIFormRow>
</UIContainer>
```

And `SortControl` in action in the header row of a list form.
  
```csharp
<head>
    <SortControl RecordPager="this.Service.RecordPager">
        <UIDataTableHeaderColumn SortField="ID">ID</UIDataTableHeaderColumn>
        <UIDataTableHeaderColumn SortField="Date">Date</UIDataTableHeaderColumn>
        ...
    </SortControl>
</head>
```

#### RecordPager

The Controller Service holds the `RecordPager` instance used by list forms.  The code is self explanatory, providing the functionality for paging operations.  It's passed to the Data Service to retrieve the correct sorted page through the `RecordPagingData` class.

```csharp
public class RecordPager
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
    public int BlockSize { get; set; } = 10;
    public int RecordCount { get; set; } = 0;

    public string SortColumn
    {
        get => (!string.IsNullOrWhiteSpace(_sortColumn)) ? _sortColumn : DefaultSortColumn;
        set => _sortColumn = value;
    }

    private string _sortColumn = string.Empty;
    public string DefaultSortColumn { get; set; } = "ID";
    public bool SortDescending { get; set; }

    public RecordPager(int pageSize, int blockSize)
    {
        this.BlockSize = blockSize;
        this.PageSize = pageSize;
    }

    public event EventHandler PageChanged;

    public int LastPage => (int)Math.Ceiling((RecordCount / PageSize) + 0.5);
    public int LastBlock => (int)((LastPage / BlockSize) + 1.5);
    public int CurrentBlock => (int)((Page / BlockSize) + 1.5);
    public int StartBlockPage => ((CurrentBlock - 1) * BlockSize) + 1;
    public int EndBlockPage => StartBlockPage + BlockSize;
    public bool HasBlocks => ((RecordCount / (PageSize * BlockSize)) + 0.5) > 1;
    public bool HasPagination => (RecordCount / PageSize) > 1;

    public void ToPage(int page, bool forceUpdate = false)
    {
        if ((forceUpdate | !this.Page.Equals(page)) && page > 0)
        {
            this.Page = page;
            this.PageChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    public void NextPage()
        => this.ToPage(this.Page + 1);

    public void PreviousPage()
                => this.ToPage(this.Page - 1);

    public void ToStart()
        => this.ToPage(1);

    public void ToEnd()
        => this.ToPage((int)Math.Ceiling((RecordCount / PageSize) + 0.5));

    public void NextBlock()
    {
        if (CurrentBlock != LastBlock)
        {
            var calcpage = (CurrentBlock * BlockSize) + 1;
            this.Page = calcpage > LastPage ? LastPage : LastPage;
            this.PageChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    public void PreviousBlock()
    {
        if (CurrentBlock != 1)
        {
            this.Page = ((CurrentBlock - 2) * PageSize) + 1;
            this.PageChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    public void NotifySortingChanged()
        => this.ToPage(1, true);

    public RecordPagingData GetData => new RecordPagingData()
    {
        Page = this.Page,
        PageSize = this.PageSize,
        BlockSize = this.BlockSize,
        RecordCount = this.RecordCount,
        SortColumn = this.SortColumn,
        SortDescending = this.SortDescending
    };
}
```

#### RecordPagingData

This is the class used to pass data into the dats services.  This has to be passed via json though the api so "keep it simple".

```csharp
    public class RecordPagingData
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
        public int BlockSize { get; set; } = 10;
        public int RecordCount { get; set; } = 0;
        public string SortColumn { get; set; } = string.Empty;
        public bool SortDescending { get; set; } = false;
    }
```

#### DataPagingControl

The code again is self-explanatory, building out a Bootstrap ButtonGroup.  I've kept away from using icons, you can if you wish.

```html
@namespace Blazor.SPA.Components

@if (this.hasPagination)
{
    <nav aria-label="...">
        <ul class="pagination">
            <li class="page-item">
                <a class="page-link" @onclick="() => this.RecordPager.ToStart()">&vert;&lt;</a>
            </li>
            @if (this.RecordPager.HasBlocks)
            {
                <li class="page-item">
                    <a class="page-link" @onclick="() => this.RecordPager.PreviousBlock()">&lt;&lt;</a>
                </li>
            }
            @for (var i = this.RecordPager.StartBlockPage; i < this.RecordPager.EndBlockPage; i++)
            {
                var pageNo = i;
                @if (pageNo > this.RecordPager.LastPage) break;
                @if (pageNo == this.RecordPager.Page)
                {
                    <li class="page-item active">
                        <span class="page-link">
                            @pageNo
                            <span class="sr-only">(current)</span>
                        </span>
                    </li>
                }
                else
                {
                    <li class="page-item">
                        <a class="page-link" @onclick="() => this.RecordPager.ToPage(pageNo)">@pageNo</a>
                    </li>
                }

            }
            @if (this.RecordPager.HasBlocks)
            {
                <li class="page-item">
                    <a class="page-link" @onclick="() => this.RecordPager.NextBlock()">&gt;&gt;</a>
                </li>
            }
            <li class="page-item">
                <a class="page-link" @onclick="() => this.RecordPager.ToEnd()">&gt;&vert;</a>
            </li>
        </ul>
    </nav>
}

@code {
    [Parameter] public RecordPager RecordPager { get; set; }

    private bool hasPagination => this.RecordPager != null && this.RecordPager.HasPagination;
}
```

#### SortControl

The `SortControl` is used in a list header. It cascades itself and provides the interface into the Paginator for the header columns through a set of public helper methods.

```csharp
@namespace Blazor.SPA.Components

<CascadingValue Value="this">
    @ChildContent
</CascadingValue>

@code {

    [Parameter] public RenderFragment ChildContent { get; set; }
    [Parameter] public string NotSortedClass { get; set; } = "sort-column oi oi-resize-height";
    [Parameter] public string AscendingClass { get; set; } = "sort-column oi oi-sort-ascending";
    [Parameter] public string DescendingClass { get; set; } = "sort-column oi oi-sort-descending";
    [Parameter] public EventCallback<SortingEventArgs> Sort { get; set; }
    [Parameter] public RecordPager RecordPager { get; set; }
    public string SortColumm { get; private set; } = string.Empty;
    public bool Descending { get; private set; } = false;

    public string GetIcon(string columnName)
        => !this.SortColumm.Equals(columnName)
        ? this.NotSortedClass
        : this.Descending
            ? this.AscendingClass
            : this.DescendingClass;

    public void NotifySortingChanged(string sortColumn, bool descending = false)
    {
        this.SortColumm = sortColumn;
        this.Descending = descending;
        this.Notify();
    }

    public void NotifySortingDirectionChanged()
    {
        this.Descending = !this.Descending;
        this.Notify();
    }

    private void Notify()
    {
        if (RecordPager != null)
            {
            RecordPager.SortDescending = this.Descending;
            RecordPager.SortColumn = this.SortColumm;
            RecordPager.NotifySortingChanged();
            }
        var args = SortingEventArgs.Get(this.SortColumm, this.Descending);
        if (Sort.HasDelegate) this.Sort.InvokeAsync(args);
    }
}
```

#### UIDataTableHeaderColumn

This is the UI control that builds out each header column in a list.  It builds out the razor and Css class for the header and notifies the captured SortControl on any mouse click events.

```csharp
@namespace Blazor.SPA.Components
@inherits AppComponentBase

@if (_isSortField)
{
    <th class="@this.CssClass" @attributes="this.SplatterAttributes" @onclick="SortClick">
        <span class="@_iconclass"></span>
        @this.ChildContent
    </th>
}
else
{
    <th class="@this.CssClass" @attributes="this.SplatterAttributes">
        @this.ChildContent
    </th>
}

@code {

    [CascadingParameter] public SortControl SortControl { get; set; }
    [Parameter] public string SortField { get; set; } = string.Empty;

    private bool _hasSortControl => this.SortControl != null;
    private bool _isSortField => !string.IsNullOrWhiteSpace(this.SortField);
    private string _iconclass => _hasSortControl && _isSortField ? this.SortControl.GetIcon(SortField) : string.Empty;

    private string CssClass => CSSBuilder.Class("grid-col")
        .AddClass("cursor-hand", _isSortField)
        .AddClassFromAttributes(this.UserAttributes)
        .Build();

    private void SortClick(MouseEventArgs e)
    {
        if (this.SortControl.SortColumm.Equals(this.SortField))
            this.SortControl.NotifySortingDirectionChanged();
        else
            this.SortControl.NotifySortingChanged(this.SortField);
    }
}
```


### Weather Forecast List Forms

There are three list forms in the solution.  They demonstrate different UI approaches.

1. The classic web page approach using different RouteViews (Pages) for the record viewer and editor.
2. The modal dialog approach - opening and closing modal dialogs within the list RouteView.
3. The inline dialog approach - opening and closing a section within the RouteView to display/edit the record.

The standard `WeatherForecastListForm` looks like this.  It inherits from `ListFormBase` with `WeatherForecast` as `TRecord`.  It assigns the `WeatherForecastViewService` to the base `IModelViewService` property `Service`.  Note it has a component Css file defining the custom Css used in the component.

```csharp
// Blazor.Database/Forms/WeatherForecast/WeatherForecastListForm.razor.cs
public partial class WeatherForecastListForm : ListFormBase<WeatherForecast>
{
    [Inject] private WeatherForecastViewService ViewService { get; set; }
    [Parameter] public bool IsModal { get; set; }

    private BaseModalDialog Modal { get; set; }

    protected override async Task OnInitializedAsync()
    {
        this.Service = this.ViewService;
        await base.OnInitializedAsync();
    }
    protected override async void Edit(Guid id)
    {
        if (this.IsModal)
        {
            var options = new ModalOptions();
            options.Set("Id", id);
            await this.Modal.ShowAsync<WeatherForecastEditorForm>(options);
        }
        else
            base.Edit(id);
    }
    protected override async void View(Guid id)
    {
        if (this.IsModal)
        {
            var options = new ModalOptions();
            options.Set("Id", id);
            await this.Modal.ShowAsync<WeatherForecastViewerForm>(options);
        }
        else
            base.View(id);
    }

    protected override async void New()
    {
        if (this.IsModal)
        {
            var options = new ModalOptions();
            options.Set("Id", -1);
            await this.Modal.ShowAsync<WeatherForecastEditorForm>(options);
        }
        else
            base.New();
    }
}
```

The razor markup.  Note:
1. The `SortControl` in the header and the `UIDataTableHeaderColumn` components building the header with the sortable columns.
2. The `DataPagingControl` in the botton button row linked to the `Service.RecordPager`.  Paging is event driven.  `DataPagingControl` paging requests are handled directly by `RecordPager` in the controller service.  Updates trigger a `ListChanged` event in the service which triggers a UI update in the List Form.
3. The `BaseModalDialog` added if the Form is using Modal Dialogs.

```html
@namespace Blazor.Database.Forms
@inherits ListFormBase<WeatherForecast>

<h1>Weather Forecasts</h1>

<UILoader State="this.LoadState">
    <UIDataTable TRecord="WeatherForecast" Records="this.ViewService.Records" class="table">
        <Head>
            <SortControl RecordPager="this.Service.RecordPager">
                <UIDataTableHeaderColumn SortField="Date">Date</UIDataTableHeaderColumn>
                <UIDataTableHeaderColumn SortField="TemperatureC">Temp. (C)</UIDataTableHeaderColumn>
                <UIDataTableHeaderColumn>Temp. (F)</UIDataTableHeaderColumn>
                <UIDataTableHeaderColumn SortField="Summary">Summary</UIDataTableHeaderColumn>
                <UIDataTableHeaderColumn class="max-column">Description</UIDataTableHeaderColumn>
                <UIDataTableHeaderColumn class="text-right">Actions</UIDataTableHeaderColumn>
            </SortControl>
        </Head>
        <RowTemplate>
            <UIDataTableRow>
                <UIDataTableColumn> @context.Date.LocalDateTime.ToShortDateString()</UIDataTableColumn>
                <UIDataTableColumn>@context.TemperatureC</UIDataTableColumn>
                <UIDataTableColumn>@context.TemperatureF</UIDataTableColumn>
                <UIDataTableColumn>@context.Summary</UIDataTableColumn>
                <UIDataTableMaxColumn>@context.Description</UIDataTableMaxColumn>
                <UIDataTableColumn class="text-right text-nowrap">
                    <UIButton type="button" class="btn-sm btn-secondary" ClickEvent="() => this.View(context.ID)">View</UIButton>
                    <UIButton type="button" class="btn-sm btn-primary" ClickEvent="() => this.Edit(context.ID)">Edit</UIButton>
                </UIDataTableColumn>
            </UIDataTableRow>
        </RowTemplate>
    </UIDataTable>
    <UIContainer>
        <UIFormRow>
            <UIColumn Cols="8">
                <DataPagingControl RecordPager="this.ViewService.RecordPager"></DataPagingControl>
            </UIColumn>
            <UIButtonColumn Cols="4">
                <UIButton type="button" Show="true" class="btn-success" ClickEvent="() => this.New()">New Record</UIButton>
                <UIButton type="button" class="btn-secondary" ClickEvent="this.Exit">Exit</UIButton>
            </UIButtonColumn>
        </UIFormRow>
    </UIContainer>
</UILoader>
@if (this.IsModal)
{
    <BaseModalDialog @ref="this.Modal"></BaseModalDialog>
}
```

### The Views

The application declares a set of intermediate Views for the list forms.  These are common to both the WASM and Server SPAs

#### FetchData

This is the multi RouteView implementation.  Event handlers are hooked up `WeatherForecastListForm` to route to the different RouteViews through the `NavigationManager`.

```html
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

#### FetchDataModal

The modal implementation is simple.  It already handles editor/viewer state by enabling `IsModal`.  You don't really need it as you could declare `WeatherForecastListForm` directly in the RouteView.

```html
@page "/fetchdataModal"
@namespace Blazor.Database.RouteViews

<WeatherForecastListForm IsModal="true"></WeatherForecastListForm>
```

The inline dialog is the most complex.  It uses Ids to show/hide the Editor/Viewer through `UIComponent`.

```html
@page "/fetchdataInline"

@namespace Blazor.Database.RouteViews

<UIComponent Show="this.ShowEditor">
    <WeatherForecastEditorForm ID="this.editorId" ExitAction="this.CloseDialog"></WeatherForecastEditorForm>
</UIComponent>
<UIComponent Show="this.ShowViewer">
    <WeatherForecastViewerForm ID="this.viewerId" ExitAction="this.CloseDialog"></WeatherForecastViewerForm>
</UIComponent>

<WeatherForecastListForm EditRecord="this.GoToEditor" ViewRecord="this.GoToViewer" NewRecord="this.GoToNew" ExitAction="Exit"></WeatherForecastListForm>
```
```csharp
@code {

    [Inject] NavigationManager NavManager { get; set; }

    private Guid editorId = Guid.Empty;
    private Guid viewerId = Guid.Empty;

    private bool ShowViewer => this.viewerId != Guid.Empty;
    private bool ShowEditor => this.editorId != Guid.Empty;

    public void GoToEditor(Guid id)
        => SetIds(id, Guid.Empty);

    public void GoToNew()
        => SetIds(Guid.Empty, Guid.Empty);

    public void GoToViewer(Guid id)
        => SetIds(Guid.Empty, id);

    public void CloseDialog()
        => SetIds(Guid.Empty, Guid.Empty);

    public void Exit()
        => this.NavManager.NavigateTo("index");

    private void SetIds(Guid editorId, Guid viewerId)
    {
        this.editorId = editorId;
        this.viewerId = viewerId;
    }
}
```

## Wrap Up
That wraps up this article.  Some key points to note:
1. There's no differences between the Blazor Server and Blazor WASM code base.
2. 90% plus functionality is implemented in the library components as boilerplate generic code.  Most of the application code is Razor markup for the individual record forms.
3. Async functionality is used throughout.

Check the readme in the repository for the latest version of the article set.
    
## History

* 25-Sep-2020: Initial version.
* 17-Nov-2020: Major Blazor.CEC library changes.  Change to ViewManager from Router and new Component base implementation.
* 31-Mar-2021: Major updates to Services, project structure and data editing.
* 24-June-2021: revisions to data layers.
