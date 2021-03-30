---
title: Part 5 - View Components - CRUD List Operations in the UI
oneliner: This article describes how to build the View Components.
precis: This article looks in detail at building reusable List Presentation Layer components and deploying them in both Server and WASM projects.
date: 2020-10-05
published: 2020-10-03
---

# Building a Database Application in Blazor 
## Part 5 - View Components - CRUD List Operations in the UI

::: danger
This article and all the others in this series is a building site.  Total revamp.  See CodeProject for the most recent released version which is very out-of-date
:::

## Introduction

This article is the fourth in a series on Building Blazor Database Applications. The articles so far are:

1. Project Structure and Framework.
2. Services - Building the CRUD Data Layers.
3. View Components - CRUD Edit and View Operations in the UI.
4. UI Components - Building HTML/CSS Controls.
5. View Components - CRUD List Operations in the UI.
6. A walk through detailing how to add weather stations and weather station data to the application.

This article looks in detail at building reusable List Presentation Layer components and deploying them in both Server and WASM projects.

## Repository and Database

The repository for the articles has move to [CEC.Blazor.SPA Repository](https://github.com/ShaunCurtis/CEC.Blazor.SPA).  [CEC.Blazor GitHub Repository](https://github.com/ShaunCurtis/CEC.Blazor) is obselete and will be removed.

There's a SQL script in /SQL in the repository for building the database.

[You can see the Server and WASM versions of the project running here on the same site](https://cec-blazor-server.azurewebsites.net/).

Serveral classes described here are part of the separate *CEC.Blazor.Core* library.  The Github is [here](https://github.com/ShaunCurtis/CEC.Blazor.Core), and is available as a Nuget Package.

## List Functionality

List components present more challenges than other CRUD components.  Functionality expected in a professional level list control includes:
* Paging to handle large data sets
* Column formatting to control column width and data overflow
* Sorting on individual columns
* Filtering - not covered here.


## The Base Forms

`ListFormBase` is the base form for all lists. It inherits from `ComponentBase`.

```csharp
    public abstract class ListFormBase<TRecord> : ComponentBase, IDisposable where TRecord : class, IDbRecord<TRecord>, new()
    {
        /// Callbacks for Edit/View/New/Exit Actions
        [Parameter] public EventCallback<int> EditRecord { get; set; }
        [Parameter] public EventCallback<int> ViewRecord { get; set; }
        [Parameter] public EventCallback<int> NewRecord { get; set; }
        [Parameter] public EventCallback ExitAction { get; set; }

        /// Controller Data Service
        [Inject] protected IFactoryControllerService<TRecord> Service { get; set; }
        [Inject] protected NavigationManager NavManager { get; set; }

        /// Booleans for Service and Recordlist state
        protected bool IsLoaded => this.Service?.HasRecords ?? false;
        protected bool HasService => this.Service != null;

        protected override async Task OnInitializedAsync()
        {
            if (this.HasService)
            {
                await this.Service.GetRecordsAsync();
                this.Service.ListHasChanged += OnListChanged;
            }
        }

        /// Call StatehasChanged if list changed
        protected void OnListChanged(object sender, EventArgs e)
            => this.InvokeAsync(this.StateHasChanged);

        /// Event handlers to call EventCallbacks
        protected virtual void Edit(int id)
            => this.EditRecord.InvokeAsync(id);
        protected virtual void View(int id)
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

        /// IDisosable Interface implementation
        public void Dispose()
            => this.Service.ListHasChanged -= OnListChanged;
    }
```

### Paging

Paging is implemented through a `Paginator` class and a `PaginatorControl` component.  

#### Paginator

The Controller Service holds the `Paginator` instance used by the list form.  The code is self explanatory.

```csharp
public class Paginator
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
    public int BlockSize { get; set; } = 10;
    public int RecordCount { get; set; } = 0;
    public event EventHandler PageChanged;

    public int LastPage => (int)((RecordCount / PageSize) + 0.5);
    public int LastBlock => (int)((LastPage / BlockSize) + 1.5);
    public int CurrentBlock => (int)((Page / BlockSize) + 1.5);
    public int StartBlockPage => ((CurrentBlock - 1) * BlockSize) + 1;
    public int EndBlockPage => StartBlockPage + BlockSize;
    public bool HasBlocks => ((RecordCount / (PageSize * BlockSize)) + 0.5) > 1;
    public bool HasPagination => (RecordCount / PageSize) > 1;

    public Paginator(int pageSize, int blockSize)
    {
        this.BlockSize = blockSize;
        this.PageSize = pageSize;
    }

    public void ToPage(int page)
    {
        if (!this.Page.Equals(page))
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
        => this.ToPage((int)((RecordCount / PageSize) + 0.5));

    public void NextBlock()
    {
        if (CurrentBlock != LastBlock)
        {
            var calcpage = (CurrentBlock * PageSize * BlockSize) + 1;
            this.Page = calcpage > LastPage ? LastPage : LastPage;
            this.PageChanged?.Invoke(this, EventArgs.Empty);
        }
    }
    public void PreviousBlock()
    {
        if (CurrentBlock != 1)
        {
            this.Page = ((CurrentBlock - 1) * PageSize * BlockSize) - 1;
            this.PageChanged?.Invoke(this, EventArgs.Empty);
        }
    }
}
```
#### PaginatorControl

The code again is self-explanatory, building out a Bootstrap ButtonGroup.
```html
@namespace Blazor.SPA.Components

@if (this.hasPaginator)
{
    <nav aria-label="...">
        <ul class="pagination">
            <li class="page-item">
                <a class="page-link" @onclick="() => this.Paginator.ToStart()">&vert;&lt;</a>
            </li>
            @if (this.Paginator.HasBlocks)
            {
                <li class="page-item">
                    <a class="page-link" @onclick="() => this.Paginator.PreviousBlock()">&lt;&lt;</a>
                </li>
            }
            @for (var i = this.Paginator.StartBlockPage; i < this.Paginator.EndBlockPage; i++)
            {
                var pageNo = i;
                @if (pageNo > this.Paginator.LastPage) break;
                @if (pageNo == this.Paginator.Page)
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
                        <a class="page-link" @onclick="() => this.Paginator.ToPage(pageNo)">@pageNo</a>
                    </li>
                }
            }
            @if (this.Paginator.HasBlocks)
            {
                <li class="page-item">
                    <a class="page-link" @onclick="() => this.Paginator.NextBlock()">&gt;&gt;</a>
                </li>
            }
            <li class="page-item">
                <a class="page-link" @onclick="() => this.Paginator.ToEnd()">&gt;&vert;</a>
            </li>
        </ul>
    </nav>
}

@code {
    [Parameter] public Paginator Paginator { get; set; }
    private bool hasPaginator => this.Paginator != null && this.Paginator.HasPagination;
}
```

### Weather Forecast List Forms

There are three list forms in the solution.  They demonstrate different UI approaches.

1. The classic web page approach using different RouteViews (Pages) for the record viewer and editor.
2. The modal dialog approach - opening and closing modal dialogs within the list RouteView.
3. The inline dialog approach - opening and closing a section within the RouteView to display/edit the record.

The standard `WeatherForecastListForm` looks like this.  It inherits from `ListFormBase` with `WeatherForecast` as `TRecord`.  It assigns the `WeatherForecastControllerService` to the base `IFactoryControllerService` property `Service`.

```csharp
// Blazor.Database/Components/Forms/WeatherForecast/WeatherForecastListForm.razor.cs
public partial class WeatherForecastListForm : ListFormBase<WeatherForecast>
{
    [Inject] private WeatherForecastControllerService ControllerService { get; set; }

    protected override async Task OnInitializedAsync()
    {
        this.Service = this.ControllerService;
        await base.OnInitializedAsync();
    }
}
```

The razor markup.  Note the `PaginatorControl` in the botton button row linked to the `Service.Paginator`.  Paging is event driven.  `PaginatorControl` paging requests are handled directly by `Paginator` in the controller service.  Updates trigger a `ListChanged` event in the service which triggers a UI update in the List Form.

```html
@namespace Blazor.Database.Components
@inherits ListFormBase<WeatherForecast>

<h1>Weather Forecasts</h1>

<UILoader Loaded="this.IsLoaded">
    <UIDataTable TRecord="WeatherForecast" Records="this.ControllerService.Records" class="table">
        <Head>
            <UIDataTableHeaderColumn>ID</UIDataTableHeaderColumn>
            <UIDataTableHeaderColumn>Date</UIDataTableHeaderColumn>
            <UIDataTableHeaderColumn>Temp. (C)</UIDataTableHeaderColumn>
            <UIDataTableHeaderColumn>Temp. (F)</UIDataTableHeaderColumn>
            <UIDataTableHeaderColumn>Summary</UIDataTableHeaderColumn>
            <UIDataTableHeaderColumn class="max-column">Description</UIDataTableHeaderColumn>
            <UIDataTableHeaderColumn class="text-right">Actions</UIDataTableHeaderColumn>
        </Head>
        <RowTemplate>
            <UIDataTableRow>
                <UIDataTableColumn>@context.ID</UIDataTableColumn>
                <UIDataTableColumn> @context.Date.ToShortDateString()</UIDataTableColumn>
                <UIDataTableColumn>@context.TemperatureC</UIDataTableColumn>
                <UIDataTableColumn>@context.TemperatureF</UIDataTableColumn>
                <UIDataTableColumn>@context.Summary</UIDataTableColumn>
                <UIDataTableMaxColumn>@context.Description</UIDataTableMaxColumn>
                <UIDataTableColumn class="text-right text-nowrap">
                    <UIButton AdditionalClasses="btn-sm btn-secondary" ClickEvent="() => this.View(context.ID)">View</UIButton>
                    <UIButton AdditionalClasses="btn-sm btn-primary" ClickEvent="() => this.Edit(context.ID)">Edit</UIButton>
                </UIDataTableColumn>
            </UIDataTableRow>
        </RowTemplate>
    </UIDataTable>
    <UIContainer>
        <UIFormRow>
            <UIColumn Cols="8">
                <PaginatorControl Paginator="this.ControllerService.Paginator"></PaginatorControl>
            </UIColumn>
            <UIButtonColumn Cols="4">
                <UIButton Show="true" AdditionalClasses="btn-success" ClickEvent="() => this.New()">New Record</UIButton>
                <UIButton AdditionalClasses="btn-secondary" ClickEvent="this.Exit">Exit</UIButton>
            </UIButtonColumn>
        </UIFormRow>
    </UIContainer>
</UILoader>
```

`WeatherForecastListModalForm` is a little different. It has a Modal Dialog control and overrides the default Edit/View/New event handlers to open the Editor/Viewer forms in the modal dialog.  Note:
1. The `Id` passed in `ModalOptions`.
2. The modal dialog returning a `Task` that can be waited on until the modal dialog closes.
3. 

```csharp
// Blazor.Database/Components/Forms/WeatherForecast/WeatherForecastListModalForm.razor.cs
public partial class WeatherForecastListModalForm : ListFormBase<WeatherForecast>
{
    [Inject] private WeatherForecastControllerService ControllerService { get; set; }

    private BaseModalDialog Modal { get; set; }

    protected override async Task OnInitializedAsync()
    {
        if (this.HasService)
        {
            await this.ControllerService.GetRecordsAsync();
            this.ControllerService.ListHasChanged += OnListChanged;
        }
    }

    protected override async void Edit(int id)
    {
        var options = new ModalOptions();
        options.Set("Id", id);
        await this.Modal.ShowAsync<WeatherForecastEditorForm>(options);
    }

    protected override async void View(int id)
    {
        var options = new ModalOptions();
        options.Set("Id", id);
        await this.Modal.ShowAsync<WeatherForecastViewerForm>(options);
    }

    protected override async void New()
    {
        var options = new ModalOptions();
        options.Set("Id", -1);
        await this.Modal.ShowAsync<WeatherForecastEditorForm>(options);
    }
}
```

The razor markup only differs in declaring a `BaseModalDialog` component.
```html
<UILoader Loaded="this.IsLoaded">
    .....
    <BaseModalDialog @ref="this.Modal"></BaseModalDialog>
</UILoader>
``` 

### The Views

The application declares a set of intermediate Views for the list forms.  These are common to both the WASM and Server SPAs

#### WeatherForecastComponent

This is the multi RouteView implementation.  Event handlers are hooked up `WeatherForecastListForm` to route to the different RouteViews through the `NavigationManager`.

```html
@namespace Blazor.Database.Components

<WeatherForecastListForm EditRecord="this.GoToEditor" ViewRecord="this.GoToViewer" NewRecord="this.GoToNew"></WeatherForecastListForm>

@code {

    [Inject] NavigationManager NavManager { get; set; }

    protected override Task OnInitializedAsync()
    {
        return base.OnInitializedAsync();
    }

    public void GoToEditor(int id)
    => this.NavManager.NavigateTo($"/weather/edit/{id}");

    public void GoToNew()
    => this.NavManager.NavigateTo($"/weather/edit/-1");

    public void GoToViewer(int id)
    => this.NavManager.NavigateTo($"/weather/view/{id}");

}
```
The modal implementation is simple.  It already handles editor/viewer state though the modal dialogs.  You don't really need it as you could declare `WeatherForecastListModalForm` directly in the RouteView.

```html
@namespace Blazor.Database.Components

<WeatherForecastListModalForm></WeatherForecastListModalForm>
```

The inline dialog is the most complex.  It uses Ids to show/hide the Editor/Viewer through `UIBase`.

```html
@namespace Blazor.Database.Components

<UIBase Show="this.ShowEditor">
    <WeatherForecastEditorForm ID="this.editorId" ExitAction="this.CloseDialog"></WeatherForecastEditorForm>
</UIBase>
<UIBase Show="this.ShowViewer">
    <WeatherForecastViewerForm ID="this.editorId" ExitAction="this.CloseDialog"></WeatherForecastViewerForm>
</UIBase>

<WeatherForecastListForm EditRecord="this.GoToEditor" ViewRecord="this.GoToViewer" NewRecord="this.GoToNew" ExitAction="Exit"></WeatherForecastListForm>

```
```csharp
@code {

    [Inject] NavigationManager NavManager { get; set; }

    private int editorId = 0;
    private int viewerId = 0;

    private bool ShowViewer => this.viewerId != 0;
    private bool ShowEditor => this.editorId != 0;

    public void GoToEditor(int id)
        => SetIds(id, 0);

    public void GoToNew()
        => SetIds(-1, 0);

    public void GoToViewer(int id)
        => SetIds(0, id);

    public void CloseDialog()
        => SetIds(0, 0);

    public void Exit()
        => this.NavManager.NavigateTo("/");

    private void SetIds(int editorId, int viewerId)
    {
        this.editorId = editorId;
        this.viewerId = viewerId;
    }
}
```




## Wrap Up
That wraps up this article.  Some key points to note:
1. There's no differences in code between a Blazor Server and a Blazor WASM.
2. Almost all functionality is implemented in the library components.  Most of the application code is Razor markup for the individual record fields.
3. Async functionality is used throughout the components and CRUD data access.
    
## History

* 25-Sep-2020: Initial version.
* 17-Nov-2020: Major Blazor.CEC library changes.  Change to ViewManager from Router and new Component base implementation.
* 7-Feb-2021: Major updates to Services, project structure and data editing.
