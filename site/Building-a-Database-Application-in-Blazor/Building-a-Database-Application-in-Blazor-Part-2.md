---
title: Part 2 - Building the Services
oneliner: This article describes building the CRUDL data services for a Blazor Database Application.
precis: This article describes how to build the CRUDL data services for a Blazor Database Application.
date: 2021-07-04
published: 2020-10-03
---

# Part 2 - Services - Building the CRUD Data Layers

This the second article in a series on Building Blazor Database Applications.  It describes how to boilerplate the data and business logic layers into generic library code that makes deploying application specific data services simple.  It is a total rewrite from earlier releases.

The articles in the series are:

1. Project Structure and Framework.
2. Services - Building the CRUD Data Layers.
3. View Components - CRUD Edit and View Operations in the UI.
4. UI Components - Building HTML/CSS Controls.
5. View Components - CRUD List Operations in the UI.

## Repository and Database

The repository has moved to [CEC.Database Repository](https://github.com/ShaunCurtis/CEC.Database).  You can use it as a template for developing your own applications.  Previous repositories are obselete and will be removed.

There's a SQL script in /SQL in the repository for building the database.

[You can see the Server and WASM versions of the project running here on the same site](https://cec-blazor-database.azurewebsites.net/).

## Objective

Let's look at our goal before diving into specifics: build library code so declaring a standard UI View service is as simple as this:

```csharp
public class WeatherForecastViewService : BaseModelViewService<WeatherForecast>, IModelViewService<WeatherForecast>
{
    public WeatherForecastViewService(IDataServiceConnector dataServiceConnector) : base(dataServiceConnector) { }
}
```

And declaring a database `DbContext` that looks like:

```csharp
    public class MSSQLWeatherDbContext : DbContext
    {
        public MSSQLWeatherDbContext(DbContextOptions<MSSQLWeatherDbContext> options) : base(options) {}

        public DbSet<WeatherForecast> WeatherForecast { get; set; }
    }
```

Our process for adding a new database entity is:
1. Add the necessary table/view to the database.
2. Define a model data record and if required a model edit class.
2. Define a `DbSet` in the `DbContext`.
3. Define one or more model view services and register them with the Services container.

There will be complications with certain entities, but that doesn't invalidate the approach - 80%+ of the code in the library.

## Services

Blazor uses DI [Dependency Injection] and IOC [Inversion of Control] principles.  If you're unfamiliar with these concepts, do a little [backgound reading](https://www.codeproject.com/Articles/5274732/Dependency-Injection-and-IoC-Containers-in-Csharp) before diving into Blazor.  It'll save you time in the long run!

Blazor Singleton and Transient services are relatively straight forward.  You can read more about them in the [Microsoft Documentation](https://docs.microsoft.com/en-us/aspnet/core/blazor/fundamentals/dependency-injection).  Scoped are a little more complicated.

1. A scoped service object exists for the lifetime of a client application session - note client and not server.  Any application resets, such as F5 or navigation away from the application, resets all scoped services.  A duplicated tab in a browser creates a new application, and a new set of scoped services.
2. A scoped service can be further scoped to an single object in code.  The `OwningComponentBase` component class has functionality to restrict the life of a scoped service to the lifetime of the component.

`Services` is the Blazor IOC [Inversion of Control] container. Service instances are declared:
1. In Blazor Server in `Startup.cs` in `ConfigureServices`
2. In Blazor WASM in `Program.cs`.

The solution uses a Service Collection extension methods such as `AddApplicationServices` to keep all the application specific services under one roof.

```csharp
// Blazor.Database.Web/startup.cs
public void ConfigureServices(IServiceCollection services)
{
    services.AddRazorPages();
    services.AddServerSideBlazor();
    // the local application Services defined in ServiceCollectionExtensions.cs
    // services.AddApplicationServices(this.Configuration);
    services.AddInMemoryApplicationServices(this.Configuration);
}
```

Extensions are declared as a static extension methods in a static class.  The two methods are shown below.

```csharp
//Blazor.Database.Web/Extensions/ServiceCollectionExtensions.cs
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddWASMApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IDataBroker, APIDataBroker>();
        AddCommonServices(services);

        return services;
    }
    public static IServiceCollection AddServerApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {

        // Local DB Setup
        var dbContext = configuration.GetValue<string>("Configuration:DBContext");
        services.AddDbContextFactory<MSSQLWeatherDbContext>(options => options.UseSqlServer(dbContext), ServiceLifetime.Singleton);
        services.AddSingleton<IDataBroker, WeatherSQLDataBroker>();
        AddCommonServices(services);

        return services;
    }

    private static void AddCommonServices(this IServiceCollection services)
    {
        services.AddSingleton<RouteViewService>();
        services.AddScoped<ILogger, Logger<LoggingBroker>>();
        services.AddScoped<ILoggingBroker, LoggingBroker>();
        services.AddScoped<IDateTimeBroker, DateTimeBroker>();
        services.AddScoped<IDataServiceConnector, ModelDataServiceConnector>();
        services.AddScoped<WeatherForecastViewService>();
        services.AddSingleton<RandomNumberService>();
        services.AddScoped<DummyWeatherService>();
    }
}
```

 In the WASM project in `program.cs`:

```csharp
// program.cs
public static async Task Main(string[] args)
{
    .....
    // Added here as we don't have access to builder in AddApplicationServices
    builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
    // the Services for the Application
    builder.Services.AddWASMApplicationServices();
    .....
}
```

Points:
1. There's an `IServiceCollection` extension method for each project/library to encapsulate the specific services needed for the project.
2. Only the data layer service is different.  The Server version, used by both the Blazor Server and the WASM API Server, interfaces with the database and Entity Framework.  It's scoped as a Singleton.
3. Everything is async, using a `DbContextFactory` and manage `DbContext` instances as they are used.  The WASM Client version uses `HttpClient` (which is a scoped service) to make calls to the API and is therefore scoped.
4. The *Brokers* and *Connectors* handle data requests through generics.  `TRecord` defines which dataset is retrieved and returned.

### Generics

The factory library code relies heavily on Generics.  Two generic entities are defined:
1. `TRecord` represents a model record class.  It must be a class, implement `IDbRecord` and define an empty `new()`.  `TRecord` is used at the method level.
2. `TDbContext` is the database context. It must inherit from the `DbContext` class.

Class declarations look like this:

```csharp
public class ServerDataBroker<TDbContext> :
    BaseDataBroker,
    IDataBroker
    where TDbContext : DbContext
......
    // example method template  
    public virtual ValueTask<TRecord> SelectRecordAsync<TRecord>(Guid id) where TRecord : class, IDbRecord<TRecord>, new()
        => ValueTask.FromResult(new TRecord());

```
## Data Access

Before diving into the detail, let's look at the main CRUDL methods we need to implement:

1. *SelectAllRecords* - get a List of records in the dataset.
2. *SelectPagedRecords* - get a List of paged and sorted records in the dataset.
3. *SelectRecord* - get a single record
4. *SelectRecordListCount* - get the total number of records.
5. *CreateRecord* - Create a new record
6. *UpdateRecord* - Update the record
7. *DeleteRecord* - Delete the record

Keep these in mind as we work through this article.

### DbTaskResult

Data layer CUD operations return a `DbTaskResult` object.  Most of the properties are self-evident.  It's designed to be consumed by the UI to build CSS Framework entities such as Alerts and Toasts.  `NewID` returns the new ID from a *Create* operation if we are using an ID field.

```csharp
public class DbTaskResult
{
    public string Message { get; set; } = null;
    public MessageType Type { get; set; } = MessageType.None;
    public bool IsOK { get; set; } = true;
    public object Data { get; set; } = null;
}
```
## Data Classes

Data classes implement `IDbRecord`.

1. `ID` is the standard database Identity field.  normally an `int`.
2. `GUID` is a unique identifier for this copy of the record.
3. `DisplayName` provides a generic name for the record.  We can use this in titles and other UI components.
4. `GetDbSetName()` provides a method of defining a `DbSet` name other that the record name.  By default it gets the set name.

```csharp
public interface IDbRecord<TRecord> 
    where TRecord : class, IDbRecord<TRecord>, new()
{
    public Guid ID { get; }
    public string DisplayName { get; }
    public string GetDbSetName() => new TRecord().GetType().Name;
}
```

Edit classes implement `IEditRecord` and `IValidation`

```csharp
public interface IEditRecord<TRecord>
    where TRecord : class, IDbRecord<TRecord>, new()
{
    public Guid GUID { get; }

    public void Populate(IDbRecord<TRecord> dbRecord);

    public TRecord GetRecord();
}
```

More about Validation later.

```csharp
public interface IValidation
{
    public bool Validate(ValidationMessageStore validationMessageStore, string fieldname, object model = null);
}
```

### WeatherForecast

Here's the dataclass for a WeatherForecast data entity.

Points:
1. Entity Framework attributes used for property labelling.
2. Implementation of `IDbRecord`.
3. Defined as a `record` with immutable properties

```csharp
public record WeatherForecast : IDbRecord<WeatherForecast>
{
    [Key] public Guid ID { get; init; } = Guid.Empty;

    public DateTimeOffset Date { get; init; } = DateTimeOffset.Now;

    public int TemperatureC { get; init; } = 0;

    public string Summary { get; init; } = string.Empty;

    [NotMapped] public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);

    [NotMapped] public string DisplayName => $"Weather Forecast for {this.Date.LocalDateTime.ToShortDateString()} ";

    // A long string field to demo using a max row in a data table
    [NotMapped] public string Description => $"The Weather Forecast for this {this.Date.DayOfWeek}, the {this.Date.Day} of the month {this.Date.Month} in the year of {this.Date.Year} is {this.Summary}.  From the font of all knowledge!";
}
```

As we will be editing and creating records we also define a `EditWeatherForecast`.

Points:
1. Implementation of `IEditRecord` and `IValidation`.
2. Defined as a `class` with editable properties
3. `GetRecord` returns a `WeatherForecast` record.
4. `Populate` populates the current class with data from a `WeatherForecast`.
5. `Validate` runs the configured validations on the class properties. More later.

```csharp
public class EditWeatherForecast : IValidation, IEditRecord<WeatherForecast>
{
    public Guid ID { get; set; } = Guid.Empty;

    public DateTimeOffset Date { get; set; } = DateTimeOffset.Now;

    public int TemperatureC { get; set; } = 0;

    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);

    public string Summary { get; set; } = string.Empty;

    public Guid GUID { get; init; } = Guid.NewGuid();

    public string DisplayName => $"Weather Forecast for {this.Date.LocalDateTime.ToShortDateString()} ";

    public WeatherForecast GetRecord() => new WeatherForecast
    {
        ID = this.ID,
        Date = this.Date,
        TemperatureC = this.TemperatureC,
        Summary = this.Summary
    };

    public void Populate(IDbRecord<WeatherForecast> dbRecord)
    {
        var rec = (WeatherForecast)dbRecord;
        this.ID = rec.ID;
        this.Date = rec.Date;
        this.TemperatureC = rec.TemperatureC;
        this.Summary = rec.Summary;
    }

    public bool Validate(ValidationMessageStore validationMessageStore, string fieldname, object model = null)
    {
        model = model ?? this;
        bool trip = false;

        this.Summary.Validation("Summary", model, validationMessageStore)
            .LongerThan(2, "Your description needs to be a little longer! 3 letters minimum")
            .Validate(ref trip, fieldname);

        this.Date.Validation("Date", model, validationMessageStore)
            .NotDefault("You must select a date")
            .LessThan(DateTime.Now.AddMonths(1), true, "Date can only be up to 1 month ahead")
            .Validate(ref trip, fieldname);

        this.TemperatureC.Validation("TemperatureC", model, validationMessageStore)
            .LessThan(70, "The temperature must be less than 70C")
            .GreaterThan(-60, "The temperature must be greater than -60C")
            .Validate(ref trip, fieldname);

        return !trip;
    }

}
```

## The Entity Framework Tier

The application implements two Entity Framework `DBContext` classes.

#### WeatherForecastDBContext

The application implements an Entity Framework `DbContext` with one `DbSet` per record type.  The WeatherForecast application has a single record type.

#### MSSQLWeatherDbContext

The class is very basic, creating a `DbSet` per dataclass.  The DBSet either must be the same name as the dataclass, or the record `GetDbSetName` must return the correct `DbSet` name.

```csharp
    public class MSSQLWeatherDbContext : DbContext
    {
        private readonly Guid _id;

        public LocalWeatherDbContext(DbContextOptions<LocalWeatherDbContext> options)
            : base(options)
            => _id = Guid.NewGuid();

        public DbSet<WeatherForecast> WeatherForecast { get; set; }
    }
```

#### DbContextExtensions

We're using generics, so our methods only know about `TRecord` and the `IDbRecord` interface.  We therefore need a methodology to get the correct `DbSet`.  We use either a naming convention, name the record, the DbSet and the Table/View the same, or declare the `DbSet` name in the record class through `GetDbSetName`.  We implement the method to get the `DbSet` as an extension method on `DbContext`.

The method uses reflection to find the `DbSet` for `TRecord`.

```csharp
public static DbSet<TRecord> GetDbSet<TRecord>(this DbContext context) where TRecord : class, IDbRecord<TRecord>, new()
{
    var dbSetName = new TRecord().GetDbSetName();
    // Get the property info object for the DbSet 
    var pinfo = context.GetType().GetProperty(dbSetName);
    DbSet<TRecord> dbSet = null;
    Debug.Assert(pinfo != null);
    // Get the property DbSet
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
```

#### IDataBroker

`IDataBroker` defines the base CRUDL methods DataServices must implement.  Brokers are services defined in the Services container using the interface and consumed through the interface.  Note `TRecord` in each method and it's constraints.  `SelectPagedRecordsAsync` uses a `RecordPagingData` object which we'll look at in article 5.

```csharp
    public interface IDataBroker
    {
        public ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<List<TRecord>> SelectPagedRecordsAsync<TRecord>(RecordPagingData pagingData) where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<TRecord> SelectRecordAsync<TRecord>(Guid id) where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<int> SelectRecordListCountAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<DbTaskResult> InsertRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new();
        public ValueTask<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new();
    }
```

#### BaseDataBroker

`BaseDataBroker` is abstract implementation of `IDataBroker`.  It provides default records, lists or *not implemented* `DBTaskResult` messages. 

```csharp
    public abstract class BaseDataBroker: IDataBroker
    {
        public virtual ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(new List<TRecord>());
        public virtual ValueTask<List<TRecord>> SelectPagedRecordsAsync<TRecord>(RecordPagingData paginatorData) where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(new List<TRecord>());
        public virtual ValueTask<TRecord> SelectRecordAsync<TRecord>(Guid id) where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(new TRecord());
        public virtual ValueTask<int> SelectRecordListCountAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(0);
        public virtual ValueTask<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(new DbTaskResult() { IsOK = false, Type = MessageType.NotImplemented, Message = "Method not implemented" });
        public virtual ValueTask<DbTaskResult> InsertRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(new DbTaskResult() { IsOK = false, Type = MessageType.NotImplemented, Message = "Method not implemented" });
        public virtual ValueTask<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
            => ValueTask.FromResult(new DbTaskResult() { IsOK = false, Type = MessageType.NotImplemented, Message = "Method not implemented" });
    }
```

#### ServerDataBroker

This is the concrete server-side implementation.  Each database operation is implemented using separate `DbContext` instances.  Note `GetDBSet` used to get the correct DBSet for `TRecord`.

```csharp
public class ServerDataBroker<TDbContext> : BaseDataBroker, IDataBroker where TDbContext : DbContext
{

    protected virtual IDbContextFactory<TDbContext> DBContext { get; set; } = null;

    public ServerDataBroker(IConfiguration configuration, IDbContextFactory<TDbContext> dbContext)
        => this.DBContext = dbContext;

    public override async ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>()
        => await this.DBContext
        .CreateDbContext()
        .GetDbSet<TRecord>()
        .ToListAsync() ?? new List<TRecord>();

    public override async ValueTask<List<TRecord>> SelectPagedRecordsAsync<TRecord>(RecordPagingData paginatorData)
    {
        var startpage = paginatorData.Page <= 1 ? 0 : (paginatorData.Page - 1) * paginatorData.PageSize;
        var dbset = this.DBContext
            .CreateDbContext()
            .GetDbSet<TRecord>();
        var isSortable = typeof(TRecord).GetProperty(paginatorData.SortColumn) != null;
        if (isSortable)
        {
            var list = await dbset
                .OrderBy(paginatorData.SortDescending ? $"{paginatorData.SortColumn} descending" : paginatorData.SortColumn)
                .Skip(startpage)
                .Take(paginatorData.PageSize).ToListAsync() ?? new List<TRecord>();
            return list;
        }
        else
        {
            var list = await dbset
                .Skip(startpage)
                .Take(paginatorData.PageSize).ToListAsync() ?? new List<TRecord>();
            return list;
        }
    }

    public override async ValueTask<TRecord> SelectRecordAsync<TRecord>(Guid id)
        => await this.DBContext.
            CreateDbContext().
            GetDbSet<TRecord>().
            FirstOrDefaultAsync(item => ((IDbRecord<TRecord>)item).ID == id) ?? default;

    public override async ValueTask<int> SelectRecordListCountAsync<TRecord>()
        => await this.DBContext.CreateDbContext().GetDbSet<TRecord>().CountAsync();

    public override async ValueTask<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record)
    {
        var context = this.DBContext.CreateDbContext();
        context.Entry(record).State = EntityState.Modified;
        return await this.UpdateContext(context);
    }

    public override async ValueTask<DbTaskResult> InsertRecordAsync<TRecord>(TRecord record)
    {
        var context = this.DBContext.CreateDbContext();
        context.GetDbSet<TRecord>().Add(record);
        return await this.UpdateContext(context);
    }

    public override async ValueTask<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record)
    {
        var context = this.DBContext.CreateDbContext();
        context.Entry(record).State = EntityState.Deleted;
        return await this.UpdateContext(context);
    }

    protected async Task<DbTaskResult> UpdateContext(DbContext context)
        => await context.SaveChangesAsync() > 0 ? DbTaskResult.OK() : DbTaskResult.NotOK();
}
```

The `APIDataBroker` looks a little different.  It implements the interface, but uses `HttpClient` to get/post to the API on the server.

The service map looks like this:

View Service => APIDataBroker => API Controller => ServerDataBroker => DBContext

```csharp
public class APIDataBroker : BaseDataBroker, IDataBroker
{
    protected HttpClient HttpClient { get; set; }

    public APIDataBroker(IConfiguration configuration, HttpClient httpClient)
        => this.HttpClient = httpClient;

    public override async ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>()
        => await this.HttpClient.GetFromJsonAsync<List<TRecord>>($"/api/{GetRecordName<TRecord>()}/list");

    public override async ValueTask<List<TRecord>> SelectPagedRecordsAsync<TRecord>(RecordPagingData paginatorData)
    {
        var response = await this.HttpClient.PostAsJsonAsync($"/api/{GetRecordName<TRecord>()}/listpaged", paginatorData);
        return await response.Content.ReadFromJsonAsync<List<TRecord>>();
    }

    public override async ValueTask<TRecord> SelectRecordAsync<TRecord>(Guid id)
    {
        var response = await this.HttpClient.PostAsJsonAsync($"/api/{GetRecordName<TRecord>()}/read", id);
        var result = await response.Content.ReadFromJsonAsync<TRecord>();
        return result;
    }

    public override async ValueTask<int> SelectRecordListCountAsync<TRecord>()
        => await this.HttpClient.GetFromJsonAsync<int>($"/api/{GetRecordName<TRecord>()}/count");

    public override async ValueTask<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record)
    {
        var response = await this.HttpClient.PostAsJsonAsync<TRecord>($"/api/{GetRecordName<TRecord>()}/update", record);
        var result = await response.Content.ReadFromJsonAsync<DbTaskResult>();
        return result;
    }

    public override async ValueTask<DbTaskResult> InsertRecordAsync<TRecord>(TRecord record)
    {
        var response = await this.HttpClient.PostAsJsonAsync<TRecord>($"/api/{GetRecordName<TRecord>()}/create", record);
        var result = await response.Content.ReadFromJsonAsync<DbTaskResult>();
        return result;
    }

    public override async ValueTask<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record)
    {
        var response = await this.HttpClient.PostAsJsonAsync<TRecord>($"/api/{GetRecordName<TRecord>()}/update", record);
        var result = await response.Content.ReadFromJsonAsync<DbTaskResult>();
        return result;
    }

    protected string GetRecordName<TRecord>() where TRecord : class, new()
        => new TRecord().GetType().Name;

}
```

#### API Controllers

Controllers are implemented in the Web project, one per DataClass.

The WeatherForecast Controller is shown below.  It basically passes requests through the `IFactoryService` interface to the `FactoryServerDataService`.

```csharp
[ApiController]
public class WeatherForecastController : ControllerBase
{
    protected IDataBroker DataService { get; set; }
    private readonly ILogger<WeatherForecastController> logger;

    public WeatherForecastController(ILogger<WeatherForecastController> logger, IDataBroker dataService)
    {
        this.DataService = dataService;
        this.logger = logger;
    }

    [MVC.Route("/api/weatherforecast/list")]
    [HttpGet]
    public async Task<List<WeatherForecast>> GetList() => await DataService.SelectAllRecordsAsync<WeatherForecast>();

    [MVC.Route("/api/weatherforecast/listpaged")]
    [HttpPost]
    public async Task<List<WeatherForecast>> Read([FromBody] RecordPagingData data) => await DataService.SelectPagedRecordsAsync<WeatherForecast>(data);

    [MVC.Route("/api/weatherforecast/count")]
    [HttpGet]
    public async Task<int> Count() => await DataService.SelectRecordListCountAsync<WeatherForecast>();

    [MVC.Route("/api/weatherforecast/get")]
    [HttpGet]
    public async Task<WeatherForecast> GetRec(Guid id) => await DataService.SelectRecordAsync<WeatherForecast>(id);

    [MVC.Route("/api/weatherforecast/read")]
    [HttpPost]
    public async Task<WeatherForecast> Read([FromBody] Guid id) => await DataService.SelectRecordAsync<WeatherForecast>(id);

    [MVC.Route("weatherforecast/update")]
    [HttpPost]
    public async Task<DbTaskResult> Update([FromBody]WeatherForecast record) => await DataService.UpdateRecordAsync<WeatherForecast>(record);

    [MVC.Route("weatherforecast/create")]
    [HttpPost]
    public async Task<DbTaskResult> Create([FromBody]WeatherForecast record) => await DataService.CreateRecordAsync<WeatherForecast>(record);

    [MVC.Route("weatherforecast/delete")]
    [HttpPost]
    public async Task<DbTaskResult> Delete([FromBody] WeatherForecast record) => await DataService.DeleteRecordAsync<WeatherForecast>(record);
    }
```
### Connector Services

Connectors are the interface between View Services are the data layer.  The talk to Brokers.  While most of the code resides in `FactoryControllerService`, there's inevitiably some dataclass specific code.

#### IDataServiceConnector

`IDataServiceConnector` defines the common interface.

```csharp
public interface IDataServiceConnector
{
    ValueTask<DbTaskResult> AddRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new();
    ValueTask<TModel> GetRecordByIdAsync<TModel>(Guid ModelId) where TModel : class, IDbRecord<TModel>, new();
    ValueTask<DbTaskResult> ModifyRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new();
    ValueTask<DbTaskResult> RemoveRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new();
    ValueTask<int> GetRecordCountAsync<TModel>() where TModel : class, IDbRecord<TModel>, new();
    ValueTask<List<TModel>> GetAllRecordsAsync<TModel>() where TModel : class, IDbRecord<TModel>, new();
    ValueTask<List<TModel>> GetPagedRecordsAsync<TModel>(RecordPagingData paginatorData) where TModel : class, IDbRecord<TModel>, new();
}
```

#### ModelDataServiceConnector

`ModelDataServiceConnector` implements the interface and connects to the defined `IDataBroker` defined service.

```csharp
public class ModelDataServiceConnector : IDataServiceConnector

{
    private readonly IDataBroker dataBroker;
    private readonly ILoggingBroker loggingBroker;

    public ModelDataServiceConnector(IDataBroker dataBroker, ILoggingBroker loggingBroker)
    {
        this.dataBroker = dataBroker;
        this.loggingBroker = loggingBroker;
    }

    public async ValueTask<DbTaskResult> AddRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.InsertRecordAsync<TModel>(model);
    public async ValueTask<List<TModel>> GetAllRecordsAsync<TModel>() where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.SelectAllRecordsAsync<TModel>();
    public async ValueTask<List<TModel>> GetPagedRecordsAsync<TModel>(RecordPagingData pagingData) where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.SelectPagedRecordsAsync<TModel>(pagingData);
    public async ValueTask<TModel> GetRecordByIdAsync<TModel>(Guid modelId) where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.SelectRecordAsync<TModel>(modelId);
    public async ValueTask<DbTaskResult> ModifyRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.UpdateRecordAsync<TModel>(model);
    public async ValueTask<DbTaskResult> RemoveRecordAsync<TModel>(TModel model) where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.DeleteRecordAsync<TModel>(model);
    public async ValueTask<int> GetRecordCountAsync<TModel>() where TModel : class, IDbRecord<TModel>, new()
        => await this.dataBroker.SelectRecordListCountAsync<TModel>();
}
```


### View Services

View Services are the classes that represent the core of the application.  A UI view uses view services to interact with data.  

In data driven applications View Services come in three flavours:

1. *Model View Services* - these expose single base model data to the UI.
2. *Compound Model Services* - these expose complex models built from base models.  An example would be a weather station and its associated daily weather station data.
3. *Edit Model Services* - these transform record data into editable model classes and expose and manage the edit process for Compound Model Services.

#### IModelViewService

`IModelViewService` defines the common interface for a Model View Service.

Note:

1. Generic `TRecord`.
2. Properties holding the current record and record list.
3. Boolean logic properties to simplify state management.
3. Events for record and list changes.
4. Reset methods to reset the service/record/list.
5. CRUDL methods that update/use the current record/list.

```csharp
public interface IModelViewService<TRecord>
    where TRecord : class, new()
{
    public Guid Id { get; }
    public TRecord Record { get; }
    public List<TRecord> Records { get; }
    public int RecordCount { get; }
    public DbTaskResult DbResult { get; }
    public RecordPager RecordPager { get; }
    public bool IsRecord { get; }
    public bool HasRecords { get; }
    public bool IsNewRecord { get; }

    public event EventHandler RecordHasChanged;
    public event EventHandler ListHasChanged;

    public ValueTask ResetServiceAsync();
    public ValueTask ResetRecordAsync();
    public ValueTask ResetListAsync();
    public ValueTask GetRecordsAsync();
    public ValueTask<bool> SaveRecordAsync(TRecord record);
    public ValueTask<bool> GetRecordAsync(Guid id);
    public ValueTask<bool> NewRecordAsync();
    public ValueTask<bool> DeleteRecordAsync();
}
```

#### FactoryControllerService

`BaseModelViewService` implements `IModelViewService`.  It contains all the boilerplate code.

```csharp
public abstract class BaseModelViewService<TRecord> : IDisposable, IModelViewService<TRecord>
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

    public DbTaskResult DbResult { get; set; } = new DbTaskResult();

    public RecordPager RecordPager { get; private set; }

    public bool IsRecord => this.Record != null;

    public bool HasRecords => this.Records != null && this.Records.Count > 0;

    public bool IsNewRecord { get; protected set; } = true;

    protected IDataServiceConnector DataServiceConnector { get; set; }

    public int RecordCount => throw new NotImplementedException();

    public event EventHandler RecordHasChanged;

    public event EventHandler ListHasChanged;

    public BaseModelViewService(IDataServiceConnector dataServiceConnector)
    {
        this.DataServiceConnector = dataServiceConnector;
        this.RecordPager = new RecordPager(10, 5);
        this.RecordPager.PageChanged += this.OnPageChanged;
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
        this.IsNewRecord = false;
        return ValueTask.CompletedTask;
    }

    public async ValueTask GetRecordsAsync()
    {
        this.Records = await DataServiceConnector.GetPagedRecordsAsync<TRecord>(this.RecordPager.GetData);
        this.RecordPager.RecordCount = await GetRecordListCountAsync();
        this.ListHasChanged?.Invoke(null, EventArgs.Empty);
    }

    public async ValueTask<bool> GetRecordAsync(Guid id)
    {
        if (!id.Equals(Guid.Empty))
        {
            this.IsNewRecord = false;
            this.Record = await DataServiceConnector.GetRecordByIdAsync<TRecord>(id);
        }
        else
        {
            this.Record = new TRecord();
            this.IsNewRecord = true;
        }
        return this.IsRecord;
    }

    public async ValueTask<int> GetRecordListCountAsync()
        => await DataServiceConnector.GetRecordCountAsync<TRecord>();

    public async ValueTask<bool> SaveRecordAsync(TRecord record)
    {
        if (this.IsNewRecord)
            this.DbResult = await DataServiceConnector.AddRecordAsync<TRecord>(record);
        else
            this.DbResult = await DataServiceConnector.ModifyRecordAsync(record);
        await this.GetRecordsAsync();
        this.IsNewRecord = false;
        return this.DbResult.IsOK;
    }

    public async ValueTask<bool> DeleteRecordAsync()
    {
        this.DbResult = await DataServiceConnector.RemoveRecordAsync<TRecord>(this.Record);
        return this.DbResult.IsOK;
    }

    protected async void OnPageChanged(object sender, EventArgs e)
        => await this.GetRecordsAsync();

    protected void NotifyRecordChanged(object sender, EventArgs e)
        => this.RecordHasChanged?.Invoke(sender, e);

    protected void NotifyListChanged(object sender, EventArgs e)
        => this.ListHasChanged?.Invoke(sender, e);

    public ValueTask<bool> NewRecordAsync()
    {
        this.Record = new TRecord();
        this.IsNewRecord = true;
        return ValueTask.FromResult(false);
    }

    public virtual void Dispose() { }
}
```

#### WeatherForecastViewService

The boilerplating payback comes in the declaration of `WeatherForecastViewService`:

```csharp
    public class WeatherForecastViewService : 
        BaseModelViewService<WeatherForecast>, 
        IModelViewService<WeatherForecast>
    {
        public WeatherForecastViewService(IDataServiceConnector dataServiceConnector) : base(dataServiceConnector) { }
    }
```

## Wrap Up

This article shows how the data services can be built using a set of abstract classes implementing boilerplate code for CRUDL operations.  I've purposely kept error checking in the code to a minimum, to make it much more readable.  You can implement as little or as much as you like.

Some key points to note:
1. Aysnc code is used wherever possible.  The data access functions are all async.
2. Generics make much of the boilerplating possible.  They create complexity, but are worth the effort.
3. Interfaces are crucial for Dependancy Injection and UI boilerplating.

If you're reading this article in the future, check the readme in the repository for the latest version of this article set.

## History

* 15-Sep-2020: Initial version.
* 2-Oct-2020: Minor formatting updates and typo fixes.
* 17-Nov-2020: Major Blazor.CEC library changes.  Change to ViewManager from Router and new Component base implementation.
* 28-Mar-2021: Major updates to Services, project structure and data editing.
* 24-June-2021: revisions to data layers.
