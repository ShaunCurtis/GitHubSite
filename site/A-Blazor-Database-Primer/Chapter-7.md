---
title: Chapter 7 - Adding Sorting and Paging to the List Form
oneliner: Adding Sorting and Paging to the List Form
precis: Adding Sorting and Paging to the List Form
date: 2021-08-13
published: 2021-08-13
---

# Chapter 7 - Adding Sorting and Paging to the List Form

In this chapter we will add sorting and paging to the WeatherForecast list form.

## Refactoring the Form

We need to refactor our current `WeatherForecastListForm` to separate out the boilerplate code so we can re-use it in other list forms.  We'll place all the boilerplate code in `ListFormBase`.  This is an abstract class using generics and the `TRecord` generic type we have already used in the data and core domain code.

### ListFormBase

Add a *BaseForms* folder to *Blazr.Primer.UI/Forms*, and add a `ListFormBase` class.  This is the initial code:

```csharp
using Blazr.Primer.Core;
using Microsoft.AspNetCore.Components;
using System;
using System.Threading.Tasks;

namespace Blazr.Primer.UI.Forms
{
    public abstract class ListFormBase<TRecord> : ComponentBase, IDisposable
        where TRecord : class, IRecord, new()
    {
        private bool _isFirstRender = true;

        protected IViewService<TRecord> ViewService { get; set; }

        [Inject] private Func<object, object> serviceDelegate { get; set; }

        [Inject] private NavigationManager NavManager { get; set; }

        public override async Task SetParametersAsync(ParameterView parameters)
        {
            parameters.SetParameterProperties(this);
            if (_isFirstRender)
            {
                LoadViewService();
                await this.LoadRecords();
                this.ViewService.RecordListHasChanged += OnListChanged;
                _isFirstRender = false;
            }
            await base.SetParametersAsync(ParameterView.Empty);
        }
        
        protected virtual void LoadViewService()
            => this.ViewService = (IViewService<TRecord>)this.serviceDelegate(new TRecord());

        protected virtual async ValueTask LoadRecords()
            => await this.ViewService.GetRecordsAsync();

        protected void OnListChanged(object sender, EventArgs e)
            => this.InvokeAsync(this.StateHasChanged);

        protected virtual void Exit()
            => this.NavManager.NavigateTo("/");

        public void Dispose()
            => this.ViewService.RecordListHasChanged -= OnListChanged;
    }
}
```

1. The component is `abstract`, you can't use it directly.
2. The component implements `IDisposable` as we are hooking up events which we need to dispose correctly.
3. `TRecord` has the regular constraints.
4. All the required services are loaded in `SetParametersAsync`.  This ensures everything is up and running before, prior to `OnInitialized{Async}`.
5. `serviceDelegate` is a function delegate that gets injected as a Service.  We will look at the service implementation shortly. 
6. `LoadViewService` uses `serviceDelegate` to get the service for an instance of `TRecord`.
7. `LoadRecordsAsync` is virtual, so can be overidden.  It calls `IViewService.GetRecordsAsync()` to populate the ViewService.
8. The component hooks up to the View `RecordListHasChanged` in `SetParametersAsync`, and unhooks in `Dispose`.
9. When `OnListChanged` gets invoked on a list change event, the component re-renders, showing the updated list.

We'll modify `WeatherForecastListForm` later when we've added more UI Components.

### ServiceCollectionExtensions

In *Razr.Primer* we update `ServiceCollectionExtensions`

```csharp
        private static void AddCommonServices(this IServiceCollection services)
        {
            services.AddScoped<IDataConnector, DataConnector>();
            services.AddScoped<WeatherForecastViewService>();
            AddViewServiceManager(services);
        }
        private static void AddViewServiceManager(this IServiceCollection services)
        {
            services.AddScoped<Func<object, object>>(
                serviceProvider => key =>
                {
                    switch (key)
                    {
                        case WeatherForecast t1:
                            return serviceProvider.GetService<WeatherForecastViewService>();

                        default:
                            throw new NotImplementedException($"You are attempting to switch to a non-existant service for {key.GetType().Name}");
                    }
                }
                );
        }
```

`AddViewServiceManager` adds a scoped delegate of type `Func<object, object>`.  It gets passes an object and returns an object.  `key` is the passed object.  The switch tests if key is a `WeatherForecast`.  If so it returns `WeatherForecastViewService`.

We use this to define which View Service is associated with which data record type as defined in `ListFormBase`:

```csharp
this.ViewService = (IViewService<TRecord>)this.serviceDelegate(new TRecord());
```

We call the injected delegate, passing an instance of `TRecord` and get back the associated ViewService, cast as a `IViewService`.

## Paging

There are two options we have in implementing paging:

1. **Expensive/Easy** - we drag the full data set up to the View or Paging control and only display one page of the data.  This is realatively easy to code, but expensive as we haul atound large data sets.
2. **Cheap/Complex** - we pass paging data down to the data domain and only retrieve and pass around a dataset containing the page required.  This is a little more complex to code, but cheap on the amount of data we haul around.
   
We take the Cheap/Complex option - it's more scaleable.

We will see the full pager class later in this chapter.  For now we define a simple `RecordPagingData` data class containing the essential data for the data domain.  This includes paging and sorting information.

```csharp
// Directory : BlazorDB.Core/Data
namespace Blazr.Primer.Core.Data
{
    public class RecordPagingData
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
        public bool Sort { get; set; } = false;
        public string SortColumn { get; set; } = string.Empty;
        public bool SortDescending { get; set; } = false;
    }
}
```

## Broker Updates

Add the **System.Linq.Dynamic.Core** Nuget package to *BlazorDB.Data*.

Add a new method definition to `IDataBroker`.

```csharp
// File: BlazorDb.Core/Interfaces/IDataBroker.cs
public ValueTask<List<TRecord>> SelectPagedRecordsAsync<TRecord>(RecordPagingData pagingData) where TRecord : class, IRecord, new();
public ValueTask<int> SelectRecordListCountAsync<TRecord>() where TRecord : class, IRecord, new();
```

Add an implementation to `DataBroker`.

```csharp
// File: BlazorDb.Data/Brokers/DataBroker.cs
public virtual ValueTask<List<TRecord>> SelectPagedRecordsAsync<TRecord>(RecordPagingData pagingData) where TRecord : class, IRecord, new()
    => throw new InvalidOperationException($"The SelectPagedRecordsAsync method is not implements for this Broker.");

public virtual ValueTask<int> SelectRecordListCountAsync<TRecord>() where TRecord : class, IRecord, new()
    => throw new InvalidOperationException($"The SelectRecordListCountAsync method is not implements for this Broker.");
```

Add the Server implementation to `ServerDataBroker`.

```csharp
// File: BlazorDb.Data/Brokers/ServerDataBroker.cs
using System.Linq.Dynamic.Core;

.....

public async override ValueTask<List<TRecord>> SelectPagedRecordsAsync<TRecord>(RecordPagingData pagingData)
{
    var dbset = await dataStore.GetDataSet<TRecord>();
    if (pagingData.Sort)
    {
        try
        {
            dbset = dbset
                .AsQueryable()
                .OrderBy(pagingData.SortDescending ? $"{pagingData.SortColumn} descending" : pagingData.SortColumn)
                .ToList();
        }
        catch 
        {
            throw new InvalidOperationException("Error in sorting data set.  This is normally caused by an invalid column name.");
        }
    }
    return dbset
        .Skip(pagingData.StartRecord)
        .Take(pagingData.PageSize)
        .ToList();
}

public override async ValueTask<int> SelectRecordListCountAsync<TRecord>()
{
    var dbset = await dataStore.GetDataSet<TRecord>();
    return dbset.Count;
}
```
This method uses Dynamic Linq to order the list if `Sort` is true, and then Linq `Skip` and `Take` methods to get the data page.

Add the API implementation to `APIDataBroker`.

```csharp
// File: BlazorDb.Data/Brokers/APIDataBroker.cs
public override async ValueTask<List<TRecord>> SelectPagedRecordsAsync<TRecord>(RecordPagingData pagingData)
{
    var response = await this.HttpClient.PostAsJsonAsync($"/api/{GetRecordName<TRecord>()}/listpaged", pagingData);
    return await response.Content.ReadFromJsonAsync<List<TRecord>>();
}

public override async ValueTask<int> SelectRecordListCountAsync<TRecord>()
    => await this.HttpClient.GetFromJsonAsync<int>($"/api/{GetRecordName<TRecord>()}/count");
```

### Testing

We can now test `ServerDataBroker`.

Add some helper methods to `WeatherForecastHelper`

```csharp
/.....

public static ValueTask<List<WeatherForecast>> GetPagedWeatherForecastListAsync(List<WeatherForecast> list, RecordPagingData pagingData)
    => ValueTask.FromResult(list
        .Skip(pagingData.StartRecord)
        .Take(pagingData.PageSize)
        .ToList());

public static ValueTask<int> GetWeatherForecastListCountAsync(List<WeatherForecast> list)
    => ValueTask.FromResult(list.Count);

```

Add a `Theory` method to `DataBrokerTests`.  We use a `Theory` so we can test various normal and boundary conditions, such as requesting a page that doesn't exist.

```csharp
// File: BlazorDb.Test/Unit/DataBrokerTests.cs
[Theory]
[InlineData(55, 2, 10, 10)]
[InlineData(15, 2, 10, 5)]
[InlineData(5, 2, 10, 0)]
[InlineData(0, -1, 10, 0)]
public async void DataBrokerShouldGetPagedWeatherForecastsAsync(int noOfRecords, int page, int pageSize, int expectedCount)
{
    // define
    var pagingData = new RecordPagingData
    {
        Page = page,
        PageSize = pageSize,
        Sort = false,
        SortColumn = "ID",
        SortDescending = false
    };
    var records = WeatherForcastUtils.CreateRandomWeatherForecastList(noOfRecords);

    var weatherForecastDataStore = new WeatherDataStore();
    weatherForecastDataStore.OverrideWeatherForecastDateSet(records);
    var dataBroker = new ServerDataBroker(weatherForecastDataStore: weatherForecastDataStore);
    var testRecordIndex = (page - 1) * pageSize;

    // test
    var retrievedRecords = await dataBroker.SelectPagedRecordsAsync<WeatherForecast>(pagingData);

    // assert
    Assert.IsType<List<WeatherForecast>>(retrievedRecords);
    Assert.Equal(retrievedRecords.Count, expectedCount);
    if (expectedCount > 0)
        Assert.Equal(retrievedRecords[0].ID, records[testRecordIndex].ID);
}

[Theory]
[InlineData(55, 55)]
[InlineData(1000, 1000)]
[InlineData(0, 0)]
public async void DataBrokerShouldGetXWeatherForecastsAsync(int noOfRecords, int expectedCount)
{
    // define
    var records = WeatherForecastHelper.CreateRandomWeatherForecastList(noOfRecords);
    var weatherForecastDataStore = new WeatherDataStore();
    weatherForecastDataStore.OverrideWeatherForecastDateSet(records);
    var dataBroker = new ServerDataBroker(weatherForecastDataStore: weatherForecastDataStore);

    // test
    var retrievedRecordCount = await dataBroker.SelectRecordListCountAsync<WeatherForecast>();

    // assert
    Assert.Equal(expectedCount, retrievedRecordCount);
}
```

The Tests:
1. Assert we have the right type of list.
2. Assert we have the correct number of records.
3. Assert we have the correct first record by ID if we are expecting to retrieving any records.

## Connector Updates

Add a method definition to `IDataConnector`

```csharp
// File: BlazorDb.Core/Interfaces/IDataConnector.cs
public ValueTask<List<TRecord>> GetPagedRecordsAsync<TRecord>(RecordPagingData pagingData) where TRecord : class, IRecord, new();
public ValueTask<List<TRecord>> GetPagedRecordsAsync<TRecord>(RecordPagingData pagingData) where TRecord : class, IRecord, new();
public ValueTask<int> GetRecordCountAsync<TRecord>() where TRecord : class, IRecord, new();
```

Add an implementation to `DataBroker`.

```csharp
// File: BlazorDb.Core/Connectors/DataConnector.cs
public ValueTask<List<TRecord>> GetPagedRecordsAsync<TRecord>(RecordPagingData pagingData) where TRecord : class, IRecord, new()
    => dataBroker.SelectPagedRecordsAsync<TRecord>(pagingData);

public ValueTask<List<TRecord>> GetPagedRecordsAsync<TRecord>(RecordPagingData pagingData) where TRecord : class, IRecord, new()
    => dataBroker.SelectPagedRecordsAsync<TRecord>(pagingData);

public ValueTask<int> GetRecordCountAsync<TRecord>() where TRecord : class, IRecord, new()
    => dataBroker.SelectRecordListCountAsync<TRecord>();
```

### Testing

Add a `Theory` method to `DataConnectorTests`.  We use a `Theory` so we can test various normal and boundary conditions, such as requesting a page that doesn't exist.

```csharp
// File: BlazorDb.Test/Unit/DataConnectorTests.cs
[Theory]
[InlineData(55, 2, 10, 10)]
[InlineData(15, 2, 10, 5)]
[InlineData(5, 2, 10, 0)]
[InlineData(0, -1, 10, 0)]
public async void DataConnectorShouldGetPagedWeatherForecastsAsync(int noOfRecords, int page, int pageSize, int expectedCount)
{
    // define
    var pagingData = new RecordPagingData
    {
        Page = page,
        PageSize = pageSize,
        Sort = false,
        SortColumn = "ID",
        SortDescending = false
    };

    var dataBrokerMock = new Mock<IDataBroker>();
    var dataConnector = new DataConnector(dataBroker: dataBrokerMock.Object);
    var records = WeatherForcastUtils.CreateRandomWeatherForecastList(noOfRecords);
    dataBrokerMock.Setup(broker =>
        broker.SelectPagedRecordsAsync<WeatherForecast>(pagingData))
        .Returns(WeatherForcastUtils.GetPagedWeatherForecastListAsync(records, pagingData));

    var testRecordIndex = (page - 1) * pageSize;
    // test
    var retrievedRecords = await dataConnector.GetPagedRecordsAsync<WeatherForecast>(pagingData);

    // assert
    Assert.IsType<List<WeatherForecast>>(retrievedRecords);
    Assert.Equal(retrievedRecords.Count, expectedCount);
    if (expectedCount > 0)
        Assert.Equal(retrievedRecords[0].ID, records[testRecordIndex].ID);
    dataBrokerMock.Verify(broker => broker.SelectPagedRecordsAsync<WeatherForecast>(pagingData), Times.Once);
    dataBrokerMock.VerifyNoOtherCalls();
}

[Theory]
[InlineData(55, 55)]
[InlineData(1000, 1000)]
[InlineData(0, 0)]
public async void DataBrokerShouldGetXWeatherForecastsAsync(int noOfRecords, int expectedCount)
{
    // define
    var dataBrokerMock = new Mock<IDataBroker>();
    var dataConnector = new DataConnector(dataBroker: dataBrokerMock.Object);
    var records = WeatherForecastHelper.CreateRandomWeatherForecastList(noOfRecords);
    dataBrokerMock.Setup(broker =>
        broker.SelectRecordListCountAsync<WeatherForecast>())
        .Returns(WeatherForecastHelper.GetWeatherForecastListCountAsync(records));

    // test
    var retrievedRecordCount = await dataConnector.GetRecordCountAsync<WeatherForecast>();

    // assert
    Assert.Equal(expectedCount, retrievedRecordCount);
}
```

Update `WeatherForecastHelper`

```csharp
....
public static ValueTask<List<WeatherForecast>> GetPagedWeatherForecastListAsync(List<WeatherForecast> list, RecordPagingData pagingData)
    => ValueTask.FromResult(list
        .Skip(pagingData.StartRecord)
        .Take(pagingData.PageSize)
        .ToList());
```

The Tests:
1. Assert we have the right type of list.
2. Assert we have the correct number of records.
3. Assert we have the correct first record by ID if we are expecting to retrieving any records.
4. Verify we only called `SelectPagedRecordsAsync` once.
5. Verifies no other calls were made to `IDataBroker`.

## RecordPager

At this point we need to define the `RecordPager` class.  This class is responsible for managing paging operations.

1. The Pager indexing is zero based which works with the calls into the data layers, but requires a set of "Display" properties to use in the `PagingControl`.
2. Most of the code is self evident.  
3. There's an event `PageChanged` which is raised whenever the page changes.  This is what the ViewService hooks up to.

```csharp
using System;

namespace BlazorDB.Core.Data
{
    public class RecordPager
    {
        public int DisplayPage => this.Page + 1;
        public int DisplayLastPage => this.LastPage + 1;
        public int DisplayLastBlock => this.LastBlock + 1;
        public int DisplayStartBlockPage => this.StartBlockPage + 1;
        public int DisplayEndBlockPage => this.EndBlockPage + 1;

        public bool Enabled { get; set; } = true;
        public int Page { get; private set; } = 0;
        public int RecordCount { get; set; } = 0;
        public int PageSize { get; set; } = 10;
        public int BlockSize { get; set; } = 5;

        public string DefaultSortColumn { get; set; } = "ID";
        public bool Sort { get; set; }
        public bool SortDescending { get; set; }

        public int Block
        {
            get
            {
                var block = (int)Math.Floor((Decimal)(this.Page / this.BlockSize));
                return block < this.LastBlock ? block : LastBlock;
            }
        }

        public int LastPage => (int)Math.Floor((Decimal)((RecordCount - 1) / PageSize));
        public int LastBlock => (int)Math.Floor((Decimal)(this.LastPage / this.BlockSize));
        public int StartBlockPage => (Block * BlockSize);
        public int EndBlockPage => (StartBlockPage + (BlockSize - 1)) > LastPage ? LastPage : StartBlockPage + (BlockSize - 1);
        public bool HasBlocks => this.LastPage > BlockSize;
        public bool HasPagination => this.RecordCount > PageSize;

        public string SortColumn
        {
            get => (!string.IsNullOrWhiteSpace(_sortColumn)) ? _sortColumn : DefaultSortColumn;
            set => _sortColumn = value;
        }

        private string _sortColumn = string.Empty;

        public RecordPagingData PagingData => new RecordPagingData()
        {
            Page = this.Page,
            PageSize = this.PageSize,
            Sort = this.Sort,
            SortColumn = this.SortColumn,
            SortDescending = this.SortDescending
        };

        public event EventHandler PageChanged;

        public bool ToPage(int page, bool forceUpdate = false)
        {
            var move = (forceUpdate | !this.Page.Equals(page)) && page >= 0;
            if (move)
            {
                this.Page = page;
                this.PageChanged?.Invoke(this, EventArgs.Empty);
            }
            return move;
        }

        public bool PageMove(int pages)
        {
            var move = this.Page + pages <= this.LastPage && this.Page + pages >= 0;
            if (move)
                this.ToPage(this.Page + pages);
            return move;
        }

        public bool BlockMove(int blocks)
        {
            var move = this.Block + blocks <= this.LastBlock && this.Block + blocks >= 0;
            if (move)
                this.ToPage((this.Block + blocks) * BlockSize);
            return move;
        }

        public void NotifySortingChanged()
           => this.ToPage(0, true);
    }
}
```

## New UI Components

We need some new UI components for the revised `WeatherForecastListForm`.  All of these are in *Blazor.Primer.UI*

*Components/Base*

Add `UIComponent`.  This is a base component that builds an Html element.

```csharp
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Rendering;
using Microsoft.AspNetCore.Components.Web;
using System.Collections.Generic;

namespace Blazr.Primer.UI.Components
{
    public class UIComponent : UIComponentBase
    {

        [Parameter] public bool Disabled { get; set; } = false;

        [Parameter] public string Tag { get; set; } = null;

        [Parameter] public EventCallback<MouseEventArgs> ClickEvent { get; set; }

        protected virtual List<string> CssClasses { get; private set; } = new List<string>();

        protected virtual string HtmlTag => this.Tag ?? "div";

        protected override List<string> UnwantedAttributes { get; set; } = new List<string>() { "class" };

        protected string CssClass
            => CSSBuilder.Class()
                .AddClass(CssClasses)
                .AddClassFromAttributes(this.UserAttributes)
                .Build();

        protected override void BuildRenderTree(RenderTreeBuilder builder)
        {
            if (this.Show)
            {
                builder.OpenElement(0, this.HtmlTag);
                builder.AddMultipleAttributes(1, this.SplatterAttributes);
                if (!string.IsNullOrWhiteSpace(this.CssClass))
                    builder.AddAttribute(2, "class", this.CssClass);

                if (Disabled)
                    builder.AddAttribute(3, "disabled");

                if (ClickEvent.HasDelegate)
                    builder.AddAttribute(4, "onclick", EventCallback.Factory.Create<MouseEventArgs>(this, ClickEvent));

                builder.AddContent(5, ChildContent);
                builder.CloseElement();
            }
        }
    }
}
```
*Components/GridControls*

The components build out the standard Bootstrap grid components.

`UIContainer`

```csharp
using Microsoft.AspNetCore.Components;

namespace Blazr.Primer.UI.Components
{
    public enum BootstrapSize { ExtraSmall, Small, Medium, Large, XLarge, XXLarge, Fluid }

    public class UIContainer : UIComponent
    {
        [Parameter] public BootstrapSize Size { get; set; } = BootstrapSize.Fluid;

        private string Css => Size switch 
        {
            BootstrapSize.Small => "container-sm",
            BootstrapSize.Medium => "container-md",
            BootstrapSize.Large => "container-lg",
            BootstrapSize.XLarge => "container-xl",
            BootstrapSize.XXLarge => "container-xxl",
            _ => "container-fluid"
        };

        protected override void OnInitialized()
            => CssClasses.Add(Css);
    }
}
```

`UIRow`

```csharp
namespace Blazr.Primer.UI.Components
{
    class UIRow : UIComponent
    {
        public UIRow()
            => CssClasses.Add("row");
    }
}
```

`UIColumn`

```csharp
using Microsoft.AspNetCore.Components;

namespace Blazr.Primer.UI.Components
{
    public class UIColumn : UIComponent
    {
        [Parameter] public virtual int Columns { get; set; } = 0;

        [Parameter] public virtual int SmallColumns { get; set; } = 0;

        [Parameter] public virtual int MediumColumns { get; set; } = 0;

        [Parameter] public virtual int LargeColumns { get; set; } = 0;

        [Parameter] public virtual int XLargeColumns { get; set; } = 0;

        [Parameter] public virtual int XXLargeColumns { get; set; } = 0;

        protected override void OnInitialized()
        {
            CssClasses.Add($"col");
            if (Columns > 0) 
            CssClasses.Add($"col-{this.Columns}");
            if (SmallColumns > 0)
                CssClasses.Add($"col-sm-{this.SmallColumns}");
            if (MediumColumns > 0)
                CssClasses.Add($"col-md-{this.MediumColumns}");
            if (LargeColumns > 0)
                CssClasses.Add($"col-lg-{this.LargeColumns}");
            if (XLargeColumns > 0)
                CssClasses.Add($"col-xl-{this.XLargeColumns}");
            if (XXLargeColumns > 0)
                CssClasses.Add($"col-xxl-{this.XXLargeColumns}");
        }
    }
}
```

`UIButtonColumn`

```csharp
namespace Blazr.Primer.UI.Components
{
    public class UIButtonColumn : UIColumn
    {
        public UIButtonColumn()
        {
            CssClasses.Add("text-right");
        }
    }
}
```

*Components/HtmlControls*

The components build out standard html elements.

`UIButton`

```csharp
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Rendering;
using Microsoft.AspNetCore.Components.Web;

namespace Blazr.Primer.UI.Components
{
    public class UIButton : UIComponent
    {
        public UIButton()
            => this.CssClasses.Add("btn mr-1");

        protected override string HtmlTag => "button";

        protected override void BuildRenderTree(RenderTreeBuilder builder)
        {
            if (this.Show)
            {
                builder.OpenElement(0, this.HtmlTag);
                builder.AddAttribute(1, "class", this.CssClass);
                builder.AddMultipleAttributes(2, this.SplatterAttributes);

                if (!UserAttributes.ContainsKey("type"))
                    builder.AddAttribute(3, "type", "button");

                if (Disabled)
                    builder.AddAttribute(4, "disabled");

                if (ClickEvent.HasDelegate)
                    builder.AddAttribute(5, "onclick", EventCallback.Factory.Create<MouseEventArgs>(this, ClickEvent));

                builder.AddContent(6, ChildContent);
                builder.CloseElement();
            }
        }
    }
}
```

*Components/FormControls*

The components build out standard html elements.

`UIFormRow`

```csharp
namespace Blazr.Primer.UI.Components
{
    public class UIFormRow : UIComponent
    {
        public UIFormRow()
        {
            CssClasses.Add("row form-group");
        }
    }
}
```

## ViewService Updates

We're now ready to update the `ViewService`.

The changes are documented as comments in the code.

```csharp
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Blazr.Primer.Core
{
    // Class is now IDisposable
    public class ViewService<TRecord> :
        IViewService<TRecord>,
        IDisposable
        where TRecord : class, IRecord, new()
    {
        //....
        // New RecordPager 
        public RecordPager RecordPager { get; private set; } = new RecordPager();

        public event EventHandler RecordListHasChanged;

        public ViewService(IDataConnector dataConnector)
        {
            this.dataConnector = dataConnector;
            //  Hookup to the RecordPager PageChanged event
            this.RecordPager.PageChanged += OnPageChanged;
        }

        // Changes to handle recording paging, calling the different DataCopnnector methods to get the paged data
        public async ValueTask GetRecordsAsync()
        {
            if (RecordPager.Enabled)
            {
                this.Records = await dataConnector.GetPagedRecordsAsync<TRecord>(this.RecordPager.PagingData);
                this.RecordPager.RecordCount = await dataConnector.GetRecordCountAsync<TRecord>();
            }
            else
                this.Records = await dataConnector.GetRecordsAsync<TRecord>();
            this.RecordListHasChanged?.Invoke(null, EventArgs.Empty);
        }

        //  Event handler for a page change calling GetRecordsAsync
        protected async void OnPageChanged(object sender, EventArgs e)
            => await this.GetRecordsAsync();

        public void Dispose()
        {
            // Disposing of the event hookup correctly
            this.RecordPager.PageChanged -= OnPageChanged;
        }
    }
}
```

## Sort Control

The `SortControl` provides a set of methods to manage Sorting and header display.  Most of the code is self evident.  It plugs into the `RecordPager` in the `ViewService` to trigger sorting requests.

```html
@namespace Blazr.Primer.UI.Components

<CascadingValue Value="this">
    @ChildContent
</CascadingValue>

```
```csharp
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

## ListContext

`ListContext` is a component class that groups up the sort and paging classes used in a list form
```html
@namespace Blazr.Primer.UI

<CascadingValue Value="RecordPager">
    <SortControl RecordPager="RecordPager">
        @ChildContent
    </SortControl>
</CascadingValue>
```
```csharp
@code {

    [Parameter] public RecordPager RecordPager { get; set; }

    [Parameter] public RenderFragment ChildContent { get; set; }

    protected override void OnInitialized()
    {
        if (this.RecordPager is null)
            throw new InvalidOperationException("No RecordPager has been set on the component");
        base.OnInitialized();
    }
}
```

## WeatherForecastListForm

We're now finally ready to update the `WeatherForecastListForm`.  Changes:

1. Added in the Paging and Exit section using the new UI controls.
2. Configuring the `RecordPager` for this form.

```csharp
@namespace Blazr.Primer.UI.Forms
@inherits ListFormBase<WeatherForecast>

<ListContext RecordPager="ViewService.RecordPager">
    <UIListControl TRecord="WeatherForecast" Records="this.ViewService.Records" IsLoaded="this.ViewService.HasRecordList" HasRecords="this.ViewService.HasRecords" class="table">
        <RowTemplate>
            <UIListColumn SortField="Date" HeaderTitle="Date">@context.Date.ToShortDateString()</UIListColumn>
            <UIListColumn SortField="=TemperatureC" HeaderTitle="Temp &deg; C">@context.TemperatureC</UIListColumn>
            <UIListColumn HeaderTitle="Temp &deg; F">@context.TemperatureF</UIListColumn>
            <UIListColumn SortField="Summary" HeaderTitle="Summary">@context.Summary</UIListColumn>
            <UIListColumn HeaderTitle="Detail" IsMaxColumn="true">@context.Name</UIListColumn>
        </RowTemplate>
    </UIListControl>
    <UIContainer>
        <UIFormRow>
            <UIColumn Cols="8">
                <DataPagingControl></DataPagingControl>
            </UIColumn>
            <UIButtonColumn Cols="4">
                <UIButton type="button" class="btn-secondary" ClickEvent="this.Exit">Exit</UIButton>
            </UIButtonColumn>
        </UIFormRow>
    </UIContainer>
</ListContext>

@code {

    protected override void OnInitialized()
    {
        ViewService.RecordPager.DefaultSortColumn = "Date";
        ViewService.RecordPager.Sort = true;
        base.OnInitialized();
    }
}
```




