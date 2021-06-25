---
title: Building a Blazor Database Pipeline
date: 2021-06-04
oneliner: article describes how to develop a framework for working with databases in Blazor.
precis: This article describes how to develop a framework for working with databases in Blazor. It looks at how to build the data pipeline using patterns, generics and conventions into a generic, abstract code base.
published: 2021-06-04
---

# Building a Blazor Database Pipeline

Publish Date: 2021-06-04
Last Updated: 2021-06-04

## Introduction

This article describes how to develop a framework for working with databases in Blazor. It looks at how to build a generic, abstract code base  for the data pipeline using patterns, generics and conventions.  The article uses the out-of-the-box Blazor template WeatherForecast dataset to demonstrate the principles and methodologies used.  

## Initial Setup

The starting point for this project is *Blazor.App*.  It's a Github repository containing a version of the out-of-the-box Blazor template configured to run in both Server and WASM modes.

I won't go into detail on how it's configured, but there are two projects:

1. *Blazor.App* is a Blazor WASM project.  It provides the library code for both the WASM and Server SPAs, along with the Web Assembly startup code for the WASM SPA.  
2. *Blazor.Web* is the web server for both the Server and WASM SPA entry points.  It provides the Blazor Server Hub services and the WASM API controllers.

*Blazor.Web* starts the Blazor Server Application.  There's a menu option to switch to the Blazor WASM SPA.  Each uses a different colour template, so you can see which SPA you are in.

Take the solution and rename it *Blazor.Db*, changing the root folder name and the solution file name.  We'll keep the two projects as is.  You're free to rename them as you wish.

## Application

The basic application design looks like this.

![Basic Application Design](/siteimages/articles/blazor-db/basic-design.png)

We separate our code into three units with clearly defined interfaces between the units.  This article covers the *Data Layer* and the *Core Application*.

## Data

The diagram below shows the design detail.

![Data Application Detail](/siteimages/articles/blazor-db/Data-Application-Detail.png)

### Interfaces

To develop generic code we need to define and use a set of interfaces that define the key properties and methods.

### IDbRecord

Add an *Interfaces* folder to *Data* in *Blazor.App* and add a new interface *IDbRecord.cs*.  This is the common interface implemented by all our model data classes.

```CSharp
public interface IDbRecord<TRecord> 
    where TRecord : class, IDbRecord<TRecord>, new()
{
    /// ID for the Table
    public Guid GUID { get; }

    /// Default Field to use to display the record in the UI
    public string DisplayName { get; }

    /// Method to get the EF DbSet name for the database
    public string GetDbSetName() 
        => new TRecord().GetType().Name;
}
```

1. `GUID` is the key identity field for all the records.
2. `DisplayName` provides a common Name property used throughout the application. 
3.  `GetDbSetName` is a method to get/define the `DbSet` name used by the Entity Framework DBContext.  By default it returns the class name, but it can be defined in a model class to use a differnet name.  `WeatherForecast` does just that because we're using plural table names (for demo purposes).

### Refactor WeatherForecast

Update `WeatherForecast` as shown below.  Create a folder in *Data* called *ModelClasses* and move `WeatherForcast` into it.

```CSharp
public record WeatherForecast : IDbRecord<WeatherForecast>
{
    [Key] public Guid GUID {get; init;}
    public DateTimeOffset Date { get; init; }
    public int TemperatureC { get; init; }
    [NotMapped] public int TemperatureF 
        => 32 + (int)(TemperatureC / 0.5556);
    public string Summary { get; init; }
    [NotMapped] public string DisplayName 
        => $"Weather Forecast for {this.Date.ToShortDateString()}";
    public string GetDbSet()
        => "WeatherForecasts";
}
```

1. Now defined as a `record` to make it immutable with `init` setters.
2. Implements the `IDbRecord` interface.
3. Has a `Guid` identity property marked with `[key]`.
4. Date is now of type `DataTimeOffset` - the proper way to do date/time.
5. `TemperatureF` and `DisplayName` are marked as `[NotMapped]` so EF doesn't attempt to retrieve them from the table.
6. `DisplayName` setter building the record name.
7. `GetDbSet` returning *WeatherForecasts* as the `DbSet` name will be different from the class name.

## Data Layer

## Add Dependancies

Add the following dependencies to the project:

```xml
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="5.0.5" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="5.0.5" />
```

### Add a DbContext

Add a *DbContexts* folder to *Data* and add a new class *InMemoryWeatherDbContext.cs*.

```CSharp
public class InMemoryWeatherDbContext : DbContext
{
 public DbSet<WeatherForecast> WeatherForecast { get; set; }

    public InMemoryWeatherDbContext(DbContextOptions<InMemoryWeatherDbContext> options)
        : base(options)
        => this.BuildInMemoryDatabase();

   
    private void BuildInMemoryDatabase()
    {
        var conn = this.Database.GetDbConnection();
        conn.Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = "CREATE TABLE [WeatherForecasts]([ID] UNIQUEIDENTIFIER PRIMARY KEY, [Date] [smalldatetime] NOT NULL, [TemperatureC] [int] NOT NULL, [Summary] [varchar](255) NULL)";
        cmd.ExecuteNonQuery();
        foreach (var forecast in this.NewForecasts)
        {
            cmd.CommandText = $"INSERT INTO WeatherForecasts([ID] ,[Date], [TemperatureC], [Summary]) VALUES('{forecast.GUID}', '{forecast.Date.LocalDateTime.ToLongDateString()}', {forecast.TemperatureC}, '{forecast.Summary}')";
            cmd.ExecuteNonQuery();
        }
    }

    private static readonly string[] Summaries = new[]
    {
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
    };

    private List<WeatherForecast> NewForecasts
    {
        get
        {
            {
                var rng = new Random();
                return Enumerable.Range(1, 80).Select(index => new WeatherForecast
                {
                    GUID = Guid.NewGuid(),
                    Date = DateTime.Now.AddDays(index),
                    TemperatureC = rng.Next(-20, 55),
                    Summary = Summaries[rng.Next(Summaries.Length)]
                }).ToList();
            }
        }
    }
}
```

1. Defines one `DbSet` for `WeatherForecasts`.
2. Defines methods and properties to build the database when the `DbContext` is created. We get an empty SQLite database instance whenever the context is initialised so we need to populate it.

The final piece of the data layer is the external interface for our Core Application Layer to use.  This is a `Broker`.  In our case a data broker to provide basic CRUD and list functionality.  Brokers are often referred to as a *shim* - a thin translation layer.

#### DbContextExtensions

This is an extension class for `DbContext`.  The single method gets a `DbSet` based on the provided `TRecord`.  This method gets the `DbSet` object for the specified `TRecord`.

If `TRecord` is `WeatherForecast`, the `dbSetName` is *WeatherForecasts*.  This method uses reflection to get the `WeatherForecasts` object from the current `DbContext`.

```csharp
    public static class DbContextExtensions
    {
        public static DbSet<TRecord> GetDbSet<TRecord>(this DbContext context) where TRecord : class, IDbRecord<TRecord>, new()
        {
            var dbSetName = new TRecord().GetDbSetName();
            var pinfo = context.GetType().GetProperty(dbSetName);
            DbSet<TRecord> dbSet = null;
            try
            {
                dbSet = (DbSet<TRecord>)pinfo.GetValue(context);
            }
            catch
            {
                throw new InvalidOperationException($"{dbSetName} does not have a matching DBset ");
            }
            Debug.Assert(dbSet != null);
            return dbSet;
        }
    }
```

### Data Brokers

Brokers are always accessed though interfaces.

#### IDataBroker

Note that generics are applied to the methods not the interface.  We define `TRecord` must be a class, implement `IDbRecord` and have a `new` with no arguments.

```csharp
    public interface IDataBroker
    {
        public ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<TRecord> SelectRecordAsync<TRecord>(Guid id) where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<int> SelectRecordListCountAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<bool> UpdateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<bool> InsertRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<bool> DeleteRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new();
    }
```

#### BaseDataBroker

`BaseDataBroker` is a base abstract class to implement this interface. it doesn't do a lot except return new records, an empty list and define the constraint conditions on `TRecord`.

```csharp
    public abstract class BaseDataBroker : IDataBroker
    {
        public virtual ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(new List<TRecord>());
        public virtual ValueTask<TRecord> SelectRecordAsync<TRecord>(Guid id) where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(new TRecord());
        public virtual ValueTask<int> SelectRecordListCountAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(0);
        public virtual ValueTask<bool> UpdateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(false);
        public virtual ValueTask<bool> InsertRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(false);
        public virtual ValueTask<bool> DeleteRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(false);
    }
```

#### InMemoryDataBroker

Finally we define the in memory broker for our SQLite database. 

```csharp
    public class InMemoryDataBroker<TDbContext> :
        BaseDataBroker,
        IDataBroker
        where TDbContext : DbContext
    {

        protected virtual IDbContextFactory<TDbContext> DBContext { get; set; } = null;

        private DbContext _dbContext;

        public InMemoryDataBroker(IConfiguration configuration, IDbContextFactory<TDbContext> dbContext)
        {
            this.DBContext = dbContext;
            _dbContext = this.DBContext.CreateDbContext();
        }

        public override async ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>()
        {
            var dbset = _dbContext.GetDbSet<TRecord>();
            return await dbset.ToListAsync() ?? new List<TRecord>();
        }

        public override async ValueTask<TRecord> SelectRecordAsync<TRecord>(Guid id)
        {
            var dbset = _dbContext.GetDbSet<TRecord>();
            return await dbset.FirstOrDefaultAsync(item => ((IDbRecord<TRecord>)item).GUID == id) ?? default;
        }

        public override async ValueTask<int> SelectRecordListCountAsync<TRecord>()
        {
            var dbset = _dbContext.GetDbSet<TRecord>();
            return await dbset.CountAsync();
        }

        public override async ValueTask<bool> UpdateRecordAsync<TRecord>(TRecord record)
        {
            _dbContext.Entry(record).State = EntityState.Modified;
            var x = await _dbContext.SaveChangesAsync();
            return x == 1;
        }

        public override async ValueTask<bool> InsertRecordAsync<TRecord>(TRecord record)
        {
            var dbset = _dbContext.GetDbSet<TRecord>();
            dbset.Add(record);
            var x = await _dbContext.SaveChangesAsync();
            return x == 1;
        }

        public override async ValueTask<bool> DeleteRecordAsync<TRecord>(TRecord record)
        {
            _dbContext.Entry(record).State = EntityState.Deleted;
            var x = await _dbContext.SaveChangesAsync();
            return x == 1;
        }
    }
```

1. We used generics on a method by method basis and get the DbSet for the `TRecord` type defined at runtime.
2. Each method uses the `GetDbSet` extension we declared above to get the correct EF `DbSet` object and then runs the appropriate `DbSet` method. 
3. In this implementation we use a single DbContext, rather than one per operartion because we are dealing with an in-memory instance. Each DbContext would be a new copy database!

### Comment

At this point we have our data layer black box defined, with an interface to access it.  Why do it this way?  Simple, separate out our core application from the underlying data source.  If we design it right we can switch to pulling the weather forecasts from a provider and only our broker needs will change.  Get it wrong and we have to redesign everything.

## Core Application Code

We move on to defining the core application.

### Connectors

Connectors provide the interface between the application code and brokers.  The black box data interface for the application code.

### IDataServiceConnector

This is the interface definition.

```csharp
public interface IDataServiceConnector
{
    ValueTask<bool> AddRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new();
    ValueTask<TModel> GetRecordByIdAsync<TModel>(Guid ModelId) where TModel : class, IDbRecord<TModel>, new();
    ValueTask<bool> ModifyRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new();
    ValueTask<bool> RemoveRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new();
    ValueTask<int> GetRecordCountAsync<TModel>() where TModel : class, IDbRecord<TModel>, new();
    ValueTask<List<TModel>> GetAllRecordsAsync<TModel>() where TModel : class, IDbRecord<TModel>, new();
}
```  

### ModelDataServiceConnector

The main model connector implements `IDataServiceConnector`, gets the `IDataBroker` by dependenct injection, and makes the necessary calls into the broker.

```csharp
public class ModelDataServiceConnector :
    IDataServiceConnector
{
    private readonly IDataBroker dataBroker;
    public ModelDataServiceConnector(IDataBroker dataBroker)
    {
        this.dataBroker = dataBroker;
    }

    public async ValueTask<bool> AddRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.InsertRecordAsync<TModel>(model);
    public async ValueTask<List<TModel>> GetAllRecordsAsync<TModel>() where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.SelectAllRecordsAsync<TModel>();
    public async ValueTask<TModel> GetRecordByIdAsync<TModel>(Guid modelId) where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.SelectRecordAsync<TModel>(modelId);
    public async ValueTask<bool> ModifyRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.UpdateRecordAsync<TModel>(model);
    public async ValueTask<bool> RemoveRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.DeleteRecordAsync<TModel>(model);
    public async ValueTask<int> GetRecordCountAsync<TModel>() where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.SelectRecordListCountAsync<TModel>();
}
```

### ViewServices

The final bit of the data jigsaw are the ViewServices.  These interface directly with the UI.

### IModelViewService

`IModelViewService` defines the standard interface used for simple model data classes.

```csharp
public interface IModelViewService<TRecord>
    where TRecord : class, new()
{
    public Guid Id { get; }
    public TRecord Record { get; }
    public List<TRecord> Records { get; }
    public int RecordCount { get; }
    public bool IsRecord { get; }
    public bool HasRecords { get; }
    public bool IsNewRecord { get; }
    public event EventHandler RecordHasChanged;
    public event EventHandler ListHasChanged;

    public ValueTask ResetServiceAsync();
    public ValueTask ResetRecordAsync();
    public ValueTask ResetListAsync();
    public ValueTask GetRecordsAsync();
    public ValueTask<bool> SaveRecordAsync();
    public ValueTask<bool> GetRecordAsync(Guid id);
    public ValueTask<bool> NewRecordAsync();
    public ValueTask<bool> DeleteRecordAsync();
}
```

### BaseModelViewService

`BaseModelViewService` provides an abstract implementation of ModelViewService.

```csharp
    public abstract class BaseModelViewService<TRecord> :
        IDisposable,
        IModelViewService<TRecord>
        where TRecord : class, IDbRecord<TRecord>, new()
    {
        public Guid Id { get; } = Guid.NewGuid();

        public TRecord Record
        {
            get => _record;
            private set
            {
                this._record = value;
                this.RecordHasChanged?.Invoke(value, EventArgs.Empty);
            }
        }
        private TRecord _record = null;

        public List<TRecord> Records
        {
            get => _records;
            private set
            {
                this._records = value;
                this.ListHasChanged?.Invoke(value, EventArgs.Empty);
            }
        }
        private List<TRecord> _records = null;
        public bool IsRecord => this.Record != null;
        public bool HasRecords => this.Records != null && this.Records.Count > 0;
        public bool IsNewRecord => this.Record != null && this.Record.GUID == Guid.Empty;
        protected IDataServiceConnector DataServiceConnector { get; set; }
        public int RecordCount => throw new NotImplementedException();

        public event EventHandler RecordHasChanged;
        public event EventHandler ListHasChanged;

        public BaseModelViewService(IDataServiceConnector dataServiceConnector)
        {
            this.DataServiceConnector = dataServiceConnector;
        }

        public async ValueTask ResetServiceAsync()
        {
            await this.ResetListAsync();
            await this.ResetRecordAsync();
        }
        public ValueTask ResetListAsync()
        {
            this.Records = null;
            return ValueTask.CompletedTask;
        }
        public ValueTask ResetRecordAsync()
        {
            this.Record = null;
            return ValueTask.CompletedTask;
        }
        public async ValueTask GetRecordsAsync()
        {
            this.Records = await DataServiceConnector.GetAllRecordsAsync<TRecord>();
            this.ListHasChanged?.Invoke(null, EventArgs.Empty);
        }
        public async ValueTask<bool> GetRecordAsync(Guid id)
        {
            if (id != Guid.Empty)
                this.Record = await DataServiceConnector.GetRecordByIdAsync<TRecord>(id);
            else
                this.Record = new TRecord();
            return this.IsRecord;
        }
        public async ValueTask<int> GetRecordListCountAsync()
            => await DataServiceConnector.GetRecordCountAsync<TRecord>();
        public async ValueTask<bool> SaveRecordAsync()
        {
            var result = false;
            if (this.IsNewRecord)
                result = await DataServiceConnector.AddRecordAsync<TRecord>(this.Record);
            else
                result = await DataServiceConnector.ModifyRecordAsync(this.Record);
            await this.GetRecordsAsync();
            return result;
        }
        public async ValueTask<bool> DeleteRecordAsync()
        => await DataServiceConnector.RemoveRecordAsync<TRecord>(this.Record);

        protected async void OnPageChanged(object sender, EventArgs e)
            => await this.GetRecordsAsync();
        protected void NotifyRecordChanged(object sender, EventArgs e)
            => this.RecordHasChanged?.Invoke(sender, e);
        protected void NotifyListChanged(object sender, EventArgs e)
            => this.ListHasChanged?.Invoke(sender, e);

        public ValueTask<bool> NewRecordAsync()
        {
            this.Record = new TRecord();
            return ValueTask.FromResult(false);
        }

        public virtual void Dispose()
        {
        }
    }
```

### WeatherForecastViewService

`WeatherForecastViewService` is the implementation of `IModelViewService` for a `WeatherForecast`, inheriting from `BaseModelViewService`.

```csharp
public class WeatherForecastViewService : 
    BaseModelViewService<WeatherForecast>, 
    IModelViewService<WeatherForecast>
{
    public WeatherForecastViewService(IDataServiceConnector dataServiceConnector) : base(dataServiceConnector) { }
}
```

### Configuring Services

Create an *Extensions* folder and add a class file called *ServiceCollectionsExtensions.cs*.  This encapsulates all the services defined by the application.  There are two `IServiceCollection` extension methods.  One for *Server*, the other for *WASM*.

```CSharp
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddInMemoryApplicationServices(this IServiceCollection services, IConfiguration configuration)
        {
            // In Memory DB Setup
            var memdbContext = "Data Source=:memory:";
            services.AddDbContextFactory<InMemoryWeatherDbContext>(options => options.UseSqlite(memdbContext), ServiceLifetime.Singleton);
            services.AddSingleton<IDataBroker, InMemoryDataBroker<InMemoryWeatherDbContext>>();
            AddCommonServices(services);
            return services;
        }

        public static IServiceCollection AddAPIApplicationServices(this IServiceCollection services)
        {
            services.AddSingleton<IDataBroker, APIDataBroker>();
            AddCommonServices(services);
            return services;
        }

        private static void AddCommonServices(this IServiceCollection services)
        {
            services.AddScoped<IDataServiceConnector, ModelDataServiceConnector>();
            services.AddScoped<WeatherForecastViewService>();
        }
    }
```

1. Defined as `static`, it only contains extension methods.
2. Defines `AddInMemoryApplicationServices` which contains all the Server specific services.
2. Defines `AddAPIApplicationServices` which contains all the WASM specific services.
2. Defines a DbContextFactory to build instances of `AddInMemoryApplicationServices`.
3. Defines a `AddCommonServices` method which contains all the services common to both WASM and Server versions.

Add `AddInMemoryApplicationServices` to `Startup.cs` in *Blazor.Web*:

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddRazorPages();
    services.AddServerSideBlazor();
    services.AddInMemoryApplicationServices(Configuration);
}
```

Add `AddAPIApplicationServices` to `Program.cs` in *Blazor.App*:

```csharp
public static async Task Main(string[] args)
{
    var builder = WebAssemblyHostBuilder.CreateDefault(args);
    builder.RootComponents.Add<App>("#app");
    builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
    builder.Services.AddAPIApplicationServices();
    await builder.Build().RunAsync();
}
```

## UI

We will look at building a UI Framework in another article.  For now we'll adapt `FetchData` to use our new Data pipeline.

```csharp
@page "/fetchdata"
<h1>Weather Forecasts</h1>
<p>This component demonstrates fetching data from a service.</p>
@if (ViewService.Records == null)
{
    <p><em>Loading...</em></p>
}
else
{
    <table class="table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Temp. (C)</th>
                <th>Temp. (F)</th>
                <th>Summary</th>
            </tr>
        </thead>
        <tbody>
            @foreach (var forecast in this.ViewService.Records)
            {
                <tr>
                    <td>@forecast.Date.LocalDateTime.ToShortDateString()</td>
                    <td>@forecast.TemperatureC</td>
                    <td>@forecast.TemperatureF</td>
                    <td>@forecast.Summary</td>
                </tr>
            }
        </tbody>
    </table>
}

@code {
    [Inject] private WeatherForecastViewService ViewService { get; set; }

    protected async override Task OnInitializedAsync()
    {
        await ViewService.GetRecordsAsync();
        await base.OnInitializedAsync();
    }
}
```

1. We've injected the View Service.
2. We've fetxched the Records in `OnInitializedAsync`.


