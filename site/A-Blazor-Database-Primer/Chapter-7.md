---
title: Chapter 7 - Adding Sorting and Paging to the List Form
oneliner: Adding Sorting and Paging to the List Form
precis: Adding Sorting and Paging to the List Form
date: 2021-08-13
published: 2021-08-13
---

# Chapter 7 - Adding Sorting and Paging to the List Form

This chapter explains how to add sorting and paging to the WeatherForecast List Form.

## Refactoring the Form

As we start to add more functionality to the List Form we need to extract the common code into a boilerplate form component.

### ListFormBase

Add a *BaseForms* folder to *Blazr.Primer.UI/Forms*.

Add a `ListFormBase` class.  This is the initial code:

```csharp
using Blazr.Primer.Core;
using Microsoft.AspNetCore.Components;
using System.Threading.Tasks;

namespace Blazr.Primer.UI.Forms
{
    public abstract class ListFormBase<TRecord> : ComponentBase
        where TRecord : class, IRecord, new()
    {
        protected IViewService<TRecord> ViewService { get; set; }

        protected override async Task OnInitializedAsync()
        {
            this.LoadViewService();
            await this.LoadRecords();
        }

        protected abstract void LoadViewService();

        protected virtual async ValueTask LoadRecords()
        {
            await this.ViewService.GetRecordsAsync();
        }
    }
}
```

1. The class is `abstract`, you can't use it directly.
2. `TRecord` has the regular constraints.
3. `LoadViewService` is abstract and must be implemented by a child component.
4. `LoadRecordsAsync` is virtual, so can be overidden.  It calls `IViewService.GetRecordsAsync()` to populate the ViewService.

### WeatherForecastListForm

Modify `WeatherForecastListForm` to inherit from `ListFormBase` and implement `LoadViewService`:

```csharp
@namespace Blazr.Primer.UI.Forms
@inherits ListFormBase<WeatherForecast>

.....

@code {
    [Inject] protected WeatherForecastViewService weatherForecastViewService { get; set; }

    protected override void LoadViewService()
        =>  this.ViewService = weatherForecastViewService;
}
```

## Paging

There are two options we have in implementing paging:

1. **Expensive/Easy** - we drag the full data set up to the View or Paging control and only display one page of the data.  This is realatively easy to code, but expensive as we haul atound large data sets.
2. **Cheap/Complex** - we pass paging data down to the data domain and only retrieve and pass around a dataset containing the page required.  This is a little more complex to code, but cheap on the amount of data we haul around.
   
We will take the Cheap/Complex option.  It's much more scaleable.

We will need a full pager class later in this chapter.  For now we define a simple `RecordPagingData` data class containing the essential data for the data domain.  This includes paging and sorting information.

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
```

Add an implementation to `DataBroker`.

```csharp
// File: BlazorDb.Data/Brokers/DataBroker.cs
public virtual ValueTask<List<TRecord>> SelectPagedRecordsAsync<TRecord>(RecordPagingData pagingData) where TRecord : class, IRecord, new()
    => throw new InvalidOperationException($"The SelectPagedRecordsAsync method is not implements for this Broker.");
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
        dbset = dbset
            .AsQueryable()
            .OrderBy(pagingData.SortDescending ? $"{pagingData.SortColumn} descending" : pagingData.SortColumn)
            .ToList();
    }
    return dbset
        .Skip(pagingData.StartRecord)
        .Take(pagingData.PageSize)
        .ToList();
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
```

### Testing

We can now test `ServerDataBroker`.

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
```

Add an implementation to `DataBroker`.

```csharp
// File: BlazorDb.Core/Connectors/DataConnector.cs
public ValueTask<List<TRecord>> GetPagedRecordsAsync<TRecord>(RecordPagingData pagingData) where TRecord : class, IRecord, new()
    => dataBroker.SelectPagedRecordsAsync<TRecord>(pagingData);
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

At this point we need to define the `RecordPager`.  This class is responsible for managing paging operations.

Most of the code is self evident.  There's an event `PageChanged` which is raised whenever the page changes.

```csharp
using System;

namespace BlazorDB.Core.Data
{
    public class RecordPager
    {
        public bool Enabled { get; set; }
        public int Page { get; private set; } = 1;
        public int RecordCount { get; set; } = 0;
        public int PageSize { get; set; } = 25;
        public int BlockSize { get; set; } = 5;
        public string DefaultSortColumn { get; set; } = "ID";
        public bool Sort { get; set; }
        public bool SortDescending { get; set; }

        public int Block => (int)Math.Ceiling((Decimal)(this.Page / this.BlockSize));
        public int LastPage => (int)Math.Ceiling((Decimal)(RecordCount / PageSize));
        public int LastBlock => (int)Math.Ceiling((Decimal)(this.LastPage / this.BlockSize));
        public int StartBlockPage => ((Block - 1) * BlockSize) + 1;
        public int EndBlockPage => StartBlockPage + BlockSize;
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
            var move = (forceUpdate | !this.Page.Equals(page)) && page > 0;
            if (move)
            {
                this.Page = page;
                this.PageChanged?.Invoke(this, EventArgs.Empty);
            }
            return move;
        }

        public bool PageMove(int pages)
        {
            var move = this.Page + pages < this.LastPage && this.Page + pages > 0;
            if (move)
                this.ToPage(this.Page + pages);
            return move;
        }

        public bool BlockMove(int blocks)
        {
            var move = this.Block + blocks < this.LastBlock && this.Block + blocks > 0;
            if (move)
                this.ToPage((((this.Block + blocks) - 1) * BlockSize) + 1);
            return move;
        }

        public void NotifySortingChanged()
           => this.ToPage(1, true);
    }
}
```
