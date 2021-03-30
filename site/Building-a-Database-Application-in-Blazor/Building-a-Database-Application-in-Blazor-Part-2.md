---
title: Part 2 - Building the Services
oneliner: This article describes building the CRUDL data services for a Blazor Database Application.
precis: This article describes how to build the CRUDL data services for a Blazor Database Application.
date: 2021-03-15
published: 2020-07-01
---

# Part 2 - Services - Building the CRUD Data Layers

::: danger
This article and all the others in this series is a building site.  Total revamp.  See CodeProject for the most recent released version which is very out-of-date
:::

This article is the second in a series on Building Blazor Database Applications.  This article describes techniques and methods for abstracting the data and business logic layers into boilerplate library code.  It is a total rewrite from earlier releases.

The articles in the series are:

1. Project Structure and Framework.
2. Services - Building the CRUD Data Layers.
3. View Components - CRUD Edit and View Operations in the UI.
4. UI Components - Building HTML/CSS Controls.
5. View Components - CRUD List Operations in the UI.
6. A walk through detailing how to add weather stations and weather station data to the application.

## Repository and Database

The repository for the articles has moved to [CEC.Database Repository](https://github.com/ShaunCurtis/CEC.Database).  [CEC.Blazor GitHub Repository](https://github.com/ShaunCurtis/CEC.Blazor) is obselete and will be removed.

There's a SQL script in /SQL in the repository for building the database.

[You can see the Server and WASM versions of the project running here on the same site](https://cec-blazor-database.azurewebsites.net/).

## Objective

Before diving into specifics, our goal is to be able to declare a UI controller service something like this:

```csharp
    public class WeatherForecastControllerService : FactoryControllerService<WeatherForecast>
    {
        public WeatherForecastControllerService(IFactoryDataService factoryDataService) : base(factoryDataService) { }
    }
```

And a database `DbContext` that looks like:

```csharp
    public class LocalWeatherDbContext : DbContext
    {
        public LocalWeatherDbContext(DbContextOptions<LocalWeatherDbContext> options)
            : base(options)
        {}

        // A DbSet per database entity
        public DbSet<WeatherForecast> WeatherForecast { get; set; }

    }
```
The process is:
1. Add the necessary table to the database.
2. Define a Dataclass.
2. Define a `DbSet` in the `DbContext`.
3. Define a  `public class nnnnnnControllerService : FactoryControllerService<nnnnnn>` Service and register it with the Services container.


## Services

Blazor is built on DI [Dependency Injection] and IOC [Inversion of Control] principles.  If you're unfamiliar with these concepts, do a little [backgound reading](https://www.codeproject.com/Articles/5274732/Dependency-Injection-and-IoC-Containers-in-Csharp) before diving into Blazor.  You'll save yourself a lot of time in the long run!

Blazor Singleton and Transient services are relatively straight forward.  You can read more about them in the [Microsoft Documentation](https://docs.microsoft.com/en-us/aspnet/core/blazor/fundamentals/dependency-injection).  Scoped are a little more complicated.

1. A scoped service object exists for the lifetime of a client application session - note client and not server.  Any application resets, such as F5 or navigation away from the application, resets all scoped services.  A duplicated tab in a browser creates a new application, and a new set of scoped services.
2. A scoped service can be scoped to an object in code.  This is most common in a UI conponent.  The `OwningComponentBase` component class has functionality to restrict the life of a scoped service to the lifetime of the component. This is covered in more detail in another article. 

`Services` is the Blazor IOC [Inversion of Control] container. They are declared in `startup.cs` in `ConfigureServices`:

We use a Service Collection extension `AddApplicationServices` to keep all the application specific services under one roof.

```csharp
// Blazor.Database.Web/startup.cs
public void ConfigureServices(IServiceCollection services)
{
    services.AddRazorPages();
    services.AddServerSideBlazor();
    // the local application Services defined in ServiceCollectionExtensions.cs
    services.AddApplicationServices(Configurtion);
}
```

`AddApplicationServices` is shown below.  It's declared within a static class as a static extension.  There are two methods, one for each database configuration.


```csharp
/Extensions/ServiceCollectionExtensions.cs
public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
{

    // Local DB Setup
    //var dbContext = configuration.GetValue<string>("Configuration:DBContext");
    //services.AddDbContextFactory<LocalWeatherDbContext>(options => options.UseSqlServer(dbContext), ServiceLifetime.Singleton);
    //services.AddSingleton<IFactoryDataService, LocalDatabaseDataService>();

    // In Memory DB Setup
    var memdbContext = "Data Source=:memory:";
    services.AddDbContextFactory<InMemoryWeatherDbContext>(options => options.UseSqlite(memdbContext), ServiceLifetime.Singleton);
    services.AddSingleton<IFactoryDataService, TestDatabaseDataService>();

    services.AddScoped<WeatherForecastControllerService>();

    return services;
}
```

 and `program.cs` in WASM mode:

```csharp
// program.cs
public static async Task Main(string[] args)
{
    .....
    // Added here as we don't have access to builder in AddApplicationServices
    builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
    // the Services for the Application
    builder.Services.AddApplicationServices();
    .....
}
```

```csharp
// ServiceCollectionExtensions.cs
public static IServiceCollection AddApplicationServices(this IServiceCollection services)
{
    services.AddScoped<IFactoryDataService, FactoryWASMDataService>();
    services.AddScoped<WeatherForecastControllerService>();
    return services;
}
```
Points:
1. There's an `IServiceCollection` extension method for each project/library to encapsulate the specific services needed for the project.
2. Only the data layer service is different.  The Server version, used by both the Blazor Server and the WASM API Server, interfaces with the database and Entity Framework.  It's scoped as a Singleton.
3. Everything is async, so we use a `DbContextFactory` and manage `DbContext` instances as we use and release them.  The WASM Client version uses `HttpClient` (which is a scoped service) to make calls to the API and is therefore scoped.
4. `FactoryDataService` implementing `IFactoryDataService` is used to process all the data requests through generics, `TRecord` defining which dataset is retrieved and returned.   These services, along with a set of `DbContext` extensions, boilerplate all the core data service code into library classes.
5. We have both a real SQL Database and an in-memory SQLite `DbContext` definition.


### Generics

The boilerplate library code relies heavily on Generics.  The two generic entities we use are:
1. `TRecord` - this represents a model record class.  It must implement `IDbRecord`, a vanilla `new()` and be a class.  `TRecord` is used at the Method level.
2. `TDbContext` - this is the database context and must inherit from the `DbContext` class.

Class declarations look like this:

```csharp
/Services/FactoryDataService.cs
public abstract class FactoryDataService<TContext>: IFactoryDataService<TContext>
    where TContext : DbContext
......
    // example method template  
    public virtual Task<TRecord> GetRecordAsync<TRecord>(int id) where TRecord : class, IDbRecord<TRecord>, new()
        => Task.FromResult(new TRecord());

```
## Data Access

Before we dive into the detail, let's look at the main CRUDL methods we need to implement:

1. *GetRecordList* - get a List of records in the dataset.  This can be paged and sorted.
3. *GetRecord* - get a single record by ID or GUID
4. *CreateRecord* - Create a new record
5. *UpdateRecord* - Update the record based on ID
6. *DeleteRecord* - Delete the record based on ID

Keep these in mind as we work through the data layers.

#### DbTaskResult

Data layer CUD operations return a `DbTaskResult` object.  Most of the properties are self-evident.  The UI consumes the information returned to display result messages.  `NewID` returns the new ID from a Create operation.  The information is structured to be used in CSS Framework Alerts and Toasts.

```csharp
public class DbTaskResult
{
    public string Message { get; set; } = "New Object Message";
    public MessageType Type { get; set; } = MessageType.None;
    public bool IsOK { get; set; } = true;
    public int NewID { get; set; } = 0;
}
```
## Data Classes

Data classes implement `IDbRecord`.

1. `ID` is the standard database Identity field.  normally an `int`.
2. `GUID` is a unique identifier for this copy of the record.
3. `DisplayName` provides a generic name for the record.

```csharp
    public interface IDbRecord<TRecord> 
        where TRecord : class, IDbRecord<TRecord>, new()
    {
        public int ID { get; }
        public Guid GUID { get; }
        public string DisplayName { get; }
    }
```

### WeatherForecast

Points:
1. Use of Attributes for Entity Framework.
2. Implementation of `IDbRecord`.
3. Implementation of `IValidation`.  This will be covered later.

```csharp
    public class WeatherForecast : IValidation, IDbRecord<WeatherForecast>
    {
        [Key] public int ID { get; set; } = -1;
        public DateTime Date { get; set; } = DateTime.Now;
        public int TemperatureC { get; set; } = 0;
        [NotMapped] public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
        public string Summary { get; set; } = string.Empty;
        [NotMapped] public Guid GUID { get; init; } = Guid.NewGuid();
        [NotMapped] public string DisplayName => $"Weather Forecast for {this.Date.ToShortDateString()} ";

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
```

## The Entity Framework Tier

The application implements two Entity Framework DBContexts.

#### WeatherForecastDBContext

The `DbContext` has a `DbSet` per record type.  Each `DbSet` is linked to a view in `OnModelCreating()`.  The WeatherForecast application has one record type.

#### LocalWeatherDbContext

The class looks like this:
```csharp
    public class LocalWeatherDbContext : DbContext
    {
        private readonly Guid _id;

        public LocalWeatherDbContext(DbContextOptions<LocalWeatherDbContext> options)
            : base(options)
            => _id = Guid.NewGuid();

        public DbSet<WeatherForecast> WeatherForecast { get; set; }
    }
```

#### 

```csharp
    public class InMemoryWeatherDbContext : DbContext
    {
        private readonly Guid _id;

        public InMemoryWeatherDbContext(DbContextOptions<InMemoryWeatherDbContext> options)
            : base(options)
        {
            this._id = Guid.NewGuid();
            this.BuildInMemoryDatabase();
        }

        public DbSet<WeatherForecast> WeatherForecast { get; set; }

        private void BuildInMemoryDatabase()
        {
            var conn = this.Database.GetDbConnection();
            conn.Open();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "CREATE TABLE [WeatherForecast]([ID] INTEGER PRIMARY KEY AUTOINCREMENT, [Date] [smalldatetime] NOT NULL, [TemperatureC] [int] NOT NULL, [Summary] [varchar](255) NULL)";
            cmd.ExecuteNonQuery();
            foreach (var forecast in this.NewForecasts)
            {
                cmd.CommandText = $"INSERT INTO WeatherForecast([Date], [TemperatureC], [Summary]) VALUES('{forecast.Date.ToLongDateString()}', {forecast.TemperatureC}, '{forecast.Summary}')";
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

                    return Enumerable.Range(1, 10).Select(index => new WeatherForecast
                    {
                        //ID = index,
                        Date = DateTime.Now.AddDays(index),
                        TemperatureC = rng.Next(-20, 55),
                        Summary = Summaries[rng.Next(Summaries.Length)]
                    }).ToList();
                }
            }
        }

```

#### DbContextExtensions

The base library adds a helper extension method to `DbContext` to get a `DbSet` object for a dataclass.

It relies on naming conventions i.e. the `DbSet` having the same name as the dataclass, and uses reflection to find the `DbSet` for `TRecord`.

```csharp
public static DbSet<TRecord> GetDbSet<TRecord>(this DbContext context, string dbSetName = null) where TRecord : class, IDbRecord<TRecord>, new()
{
    var recname = new TRecord().GetType().Name;
    // Get the property info object for the DbSet 
    var pinfo = context.GetType().GetProperty(dbSetName ?? recname);
    DbSet<TRecord> dbSet = null; 
    // Get the property DbSet
    try
    {
        dbSet = (DbSet<TRecord>)pinfo.GetValue(context);
    }
    catch
    {
        throw new InvalidOperationException($"{recname} does not have a matching DBset ");
    }
    Debug.Assert(dbSet != null);
    return dbSet;
}
```

#### IFactoryDataService

the `IFactoryDataService` defines the base CRUDL methods all DataServices must implement.  All Data Services are loaded into the Services container through the interface and consumed through this interface.  Note the use of `TRecord` in each method.  

```csharp
public interface IFactoryDataService 
{
    public Task<List<TRecord>> GetRecordListAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new();
    public Task<List<TRecord>> GetRecordListAsync<TRecord>(int page, int pagesize) where TRecord : class, IDbRecord<TRecord>, new();
    public Task<TRecord> GetRecordAsync<TRecord>(int id) where TRecord : class, IDbRecord<TRecord>, new();
    public Task<int> GetRecordListCountAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new();
    public Task<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new();
    public Task<DbTaskResult> CreateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new();
    public Task<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new();
}
```

#### FactoryDataService

`FactoryDataService` is abstract implementation of `IFactoryDataService`.  It provides default records, lists or *not implemented* `DBTaskResult` messages. 

```csharp
public abstract class FactoryDataService: IFactoryDataService
{
    public Guid ServiceID { get; } = Guid.NewGuid();
    public IConfiguration AppConfiguration { get; set; }

    public FactoryDataService(IConfiguration configuration) => this.AppConfiguration = configuration;

    public virtual Task<List<TRecord>> GetRecordListAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new()
        => Task.FromResult(new List<TRecord>());
    public virtual Task<List<TRecord>> GetRecordListAsync<TRecord>(int page, int pagesize) where TRecord : class, IDbRecord<TRecord>, new()
        => Task.FromResult(new List<TRecord>());
    public virtual Task<TRecord> GetRecordAsync<TRecord>(int id) where TRecord : class, IDbRecord<TRecord>, new()
        => Task.FromResult(new TRecord());
    public virtual Task<int> GetRecordListCountAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new()
        => Task.FromResult(0);
    public virtual Task<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
        => Task.FromResult(new DbTaskResult() { IsOK = false, Type = MessageType.NotImplemented, Message = "Method not implemented" });
    public virtual Task<DbTaskResult> CreateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
        => Task.FromResult(new DbTaskResult() { IsOK = false, Type = MessageType.NotImplemented, Message = "Method not implemented" });
    public virtual Task<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
        => Task.FromResult(new DbTaskResult() { IsOK = false, Type = MessageType.NotImplemented, Message = "Method not implemented" });
}
```

#### FactoryServerDataService

This is the concrete server-side implmentation.  Each CRUDL operation is implemented using Entity Framework.  note the use of `DbContext` instances per operation and `GetDBSet` to get the correct DBSet for `TRecord`.
```csharp
public class FactoryServerDataService<TDbContext> : FactoryDataService where TDbContext : DbContext
{
    protected virtual IDbContextFactory<TDbContext> DBContext { get; set; } = null;

    public FactoryServerDataService(IConfiguration configuration, IDbContextFactory<TDbContext> dbContext) : base(configuration)
        => this.DBContext = dbContext;

    public override async Task<List<TRecord>> GetRecordListAsync<TRecord>()
        => await this.DBContext
            .CreateDbContext()
            .GetDbSet<TRecord>()
            .ToListAsync() ?? new List<TRecord>();

    public override async Task<List<TRecord>> GetRecordListAsync<TRecord>(int page, int pagesize)
    {
        var startpage = page <= 1
            ? 0
            : (page - 1) * pagesize;
        var context = this.DBContext.CreateDbContext();
        var dbset = this.DBContext
            .CreateDbContext()
            .GetDbSet<TRecord>();
        return await dbset.Skip(startpage).Take(pagesize).ToListAsync() ?? new List<TRecord>();
    }

    public override async Task<TRecord> GetRecordAsync<TRecord>(int id)
        => await this.DBContext.
            CreateDbContext().
            GetDbSet<TRecord>().
            FirstOrDefaultAsync(item => ((IDbRecord<TRecord>)item).ID == id) ?? default;

    public override async Task<int> GetRecordListCountAsync<TRecord>()
        => await this.DBContext.CreateDbContext().GetDbSet<TRecord>().CountAsync();

    public override async Task<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record)
    {
        var context = this.DBContext.CreateDbContext();
        context.Entry(record).State = EntityState.Modified;
        return await this.UpdateContext(context);
    }

    public override async Task<DbTaskResult> CreateRecordAsync<TRecord>(TRecord record)
    {
        var context = this.DBContext.CreateDbContext();
        context.GetDbSet<TRecord>().Add(record);
        return await this.UpdateContext(context);
    }

    public override async Task<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record)
    {
        var context = this.DBContext.CreateDbContext();
        context.Entry(record).State = EntityState.Deleted;
        return await this.UpdateContext(context);
    }

    protected async Task<DbTaskResult> UpdateContext(DbContext context)
        => await context.SaveChangesAsync() > 0 ? DbTaskResult.OK() : DbTaskResult.NotOK();
}
```

The `FactoryWASMDataService` looks a little different.  It implements the interface, but uses `HttpClient` to get/post to the API on the server.

The structure is:

UI Controller Service => WASMDataService => API Controller => ServerDataService => DBContext

```csharp
    public class FactoryWASMDataService : FactoryDataService, IFactoryDataService
    {
        protected HttpClient HttpClient { get; set; }

        public FactoryWASMDataService(IConfiguration configuration, HttpClient httpClient) : base(configuration)
            => this.HttpClient = httpClient;

        public override async Task<List<TRecord>> GetRecordListAsync<TRecord>()
            => await this.HttpClient.GetFromJsonAsync<List<TRecord>>($"{GetRecordName<TRecord>()}/list");

        public override async Task<List<TRecord>> GetRecordListAsync<TRecord>(int page, int pagesize)
        {
            var paging = new Paginator(page, pagesize);
            var response = await this.HttpClient.PostAsJsonAsync($"{GetRecordName<TRecord>()}/listpaged", paging);
            var result = await response.Content.ReadFromJsonAsync<List<TRecord>>();
            return result;
        }

        public override async Task<TRecord> GetRecordAsync<TRecord>(int id)
        {
            var response = await this.HttpClient.PostAsJsonAsync($"{GetRecordName<TRecord>()}/read", id);
            var result = await response.Content.ReadFromJsonAsync<TRecord>();
            return result;
        }

        public override async Task<int> GetRecordListCountAsync<TRecord>()
            => await this.HttpClient.GetFromJsonAsync<int>($"{GetRecordName<TRecord>()}/count");

        public override async Task<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record)
        {
            var response = await this.HttpClient.PostAsJsonAsync<TRecord>($"{GetRecordName<TRecord>()}/update", record);
            var result = await response.Content.ReadFromJsonAsync<DbTaskResult>();
            return result;
        }

        public override async Task<DbTaskResult> CreateRecordAsync<TRecord>(TRecord record)
        {
            var response = await this.HttpClient.PostAsJsonAsync<TRecord>($"{GetRecordName<TRecord>()}/create", record);
            var result = await response.Content.ReadFromJsonAsync<DbTaskResult>();
            return result;
        }

        public override async Task<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record)
        {
            var response = await this.HttpClient.PostAsJsonAsync<TRecord>($"{GetRecordName<TRecord>()}/update", record);
            var result = await response.Content.ReadFromJsonAsync<DbTaskResult>();
            return result;
        }

        protected string GetRecordName<TRecord>() where TRecord : class, IDbRecord<TRecord>, new()
            => new TRecord().GetType().Name;
    }
```

#### API Controllers

Controllers are implemented in the Web Server.  There's one API controlller per DataClass.

The WeatherForecast Controller is shown below.  It basically passes requests through to the `FactoryServerDataService` through the `IFactoryService` and returns the results.

```csharp
[ApiController]
public class WeatherForecastController : ControllerBase
{
    protected IFactoryDataService DataService { get; set; }
    private readonly ILogger<WeatherForecastController> logger;

    public WeatherForecastController(ILogger<WeatherForecastController> logger, IFactoryDataService dataService)
    {
        this.DataService = dataService;
        this.logger = logger;
    }

    [MVC.Route("weatherforecast/list")]
    [HttpGet]
    public async Task<List<WeatherForecast>> GetList() => await DataService.GetRecordListAsync<WeatherForecast>();

    [MVC.Route("weatherforecast/listpaged")]
    [HttpGet]
    public async Task<List<WeatherForecast>> Read([FromBody] Paginator data) => await DataService.GetRecordListAsync<WeatherForecast>(page: data.Page, pagesize: data.PageSize);

    [MVC.Route("weatherforecast/count")]
    [HttpGet]
    public async Task<int> Count() => await DataService.GetRecordListCountAsync<WeatherForecast>();

    [MVC.Route("weatherforecast/get")]
    [HttpGet]
    public async Task<WeatherForecast> GetRec(int id) => await DataService.GetRecordAsync<WeatherForecast>(id);

    [MVC.Route("weatherforecast/read")]
    [HttpPost]
    public async Task<WeatherForecast> Read([FromBody]int id) => await DataService.GetRecordAsync<WeatherForecast>(id);

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

### Controller Services

Controller Services are the interface between the Data Service and the UI.  They implement the logic needed to manage the dataclass they are responsible for.  While we intreface and boilerplate the common code, there will be some dataclass specific code.

#### IFactoryControllerService

`IFactoryControllerService` defines the common interface that the boilerplate form code uses.  Note:

1. Generic `TRecord`.
2. The Controller holds the current record and record list.
3. There are events for record and list changes.
4. There are reset methods to reset the service/record/list.
5. There are methods for CRUDL that operate on the current record/list.

```csharp
    public interface IFactoryControllerService<TRecord> where TRecord : class, IDbRecord<TRecord>, new()
    {
        public Guid Id { get; }
        public TRecord Record { get; }
        public List<TRecord> Records { get; }
        public int RecordCount => this.Records?.Count ?? 0;
        public int RecordId { get; }
        public Guid RecordGUID { get; }
        public DbTaskResult DbResult { get; }
        public Paginator Paginator { get; }
        public bool IsRecord => this.Record != null && this.RecordId > -1;
        public bool HasRecords => this.Records != null && this.Records.Count > 0;
        public bool IsNewRecord => this.IsRecord && this.RecordId == -1;

        public event EventHandler RecordHasChanged;
        public event EventHandler ListHasChanged;

        public Task Reset();
        public Task ResetRecordAsync();
        public Task ResetListAsync();

        public Task GetRecordsAsync() => Task.CompletedTask;
        public Task<bool> SaveRecordAsync();
        public Task<bool> GetRecordAsync(int id);
        public Task<bool> NewRecordAsync();
        public Task<bool> DeleteRecordAsync();
    }
```

#### FactoryControllerService

`FactoryControllerService` is abstract implementation of the `IFactoryControllerService` that contains all the boilerplate code.  Much of the code is self evident.  

```csharp
public abstract class FactoryControllerService<TRecord> : IDisposable, IFactoryControllerService<TRecord> where TRecord : class, IDbRecord<TRecord>, new()
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

    public int RecordId => this.Record?.ID ?? 0;
    public Guid RecordGUID => this.Record?.GUID ?? Guid.Empty;
    public DbTaskResult DbResult { get; set; } = new DbTaskResult();

    /// Property for the Paging object that controls paging and interfaces with the UI Paging Control 
    public Paginator Paginator { get; private set; }

    public bool IsRecord => this.Record != null && this.RecordId > -1;
    public bool HasRecords => this.Records != null && this.Records.Count > 0;
    public bool IsNewRecord => this.IsRecord && this.RecordId == -1;

    /// Data Service for data access
    protected IFactoryDataService DataService { get; set; }

    public event EventHandler RecordHasChanged;
    public event EventHandler ListHasChanged;

    public FactoryControllerService(IFactoryDataService factoryDataService)
    {
        this.DataService = factoryDataService;
        this.Paginator = new Paginator(10, 5);
        this.Paginator.PageChanged += this.OnPageChanged;
    }

    /// Method to reset the service
    public Task Reset()
    {
        this.Record = null;
        this.Records = null;
        return Task.CompletedTask;
    }

    /// Method to reset the record list
    public Task ResetListAsync()
    {
        this.Records = null;
        return Task.CompletedTask;
    }

    /// Method to reset the Record
    public Task ResetRecordAsync()
    {
        this.Record = null;
        return Task.CompletedTask;
    }

    /// Method to get a recordset
    public async Task GetRecordsAsync()
    {
        this.Records = await DataService.GetRecordListAsync<TRecord>(this.Paginator.Page, this.Paginator.PageSize);
        this.Paginator.RecordCount = await GetRecordListCountAsync();
        this.ListHasChanged?.Invoke(null, EventArgs.Empty);
    }

    /// Method to get a record
    /// if id < 1 will create a new record
    public async Task<bool> GetRecordAsync(int id)
    {
        if (id > 0)
            this.Record = await DataService.GetRecordAsync<TRecord>(id);
        else
            this.Record = new TRecord();
        return this.IsRecord;
    }

    /// Method to get the current record count
    public async Task<int> GetRecordListCountAsync()
        => await DataService.GetRecordListCountAsync<TRecord>();


    public async Task<bool> SaveRecordAsync()
    {
        if (this.RecordId == -1)
            this.DbResult = await DataService.CreateRecordAsync<TRecord>(this.Record);
        else
            this.DbResult = await DataService.UpdateRecordAsync(this.Record);
        await this.GetRecordsAsync();
        return this.DbResult.IsOK;
    }

    public async Task<bool> DeleteRecordAsync()
    {
        this.DbResult = await DataService.DeleteRecordAsync<TRecord>(this.Record);
        return this.DbResult.IsOK;
    }

    public Task<bool> NewRecordAsync()
    {
        this.Record = default(TRecord);
        return Task.FromResult(false);
    }

    protected async void OnPageChanged(object sender, EventArgs e)
        => await this.GetRecordsAsync();

    protected void NotifyRecordChanged(object sender, EventArgs e)
        => this.RecordHasChanged?.Invoke(sender, e);

    protected void NotifyListChanged(object sender, EventArgs e)
        => this.ListHasChanged?.Invoke(sender, e);

    public virtual void Dispose() {}
}
```

#### WeatherForecastControllerService

The net gain from all boilerplating is a declaration of the `WeatheForcastControllerService` like this:

```csharp
public class WeatherForecastControllerService : FactoryControllerService<WeatherForecast>
{
    public WeatherForecastControllerService(IFactoryDataService factoryDataService) : base(factoryDataService) { }
}
```

## Wrap Up
This article demonstrates how to abstract the data and controller tier code into a library and build boilerplate code using generics.

Some key points to note:
1. Aysnc code is used wherever possible.  The data access functions are all async.
2. Generics make much of the boilerplating possible.  They create complexity, but are worth the effort.
3. Interfaces are crucial for Dependancy Injection and UI boilerplating.

The next section looks at the [Presentation Layer / UI Framework](https://www.codeproject.com/Articles/5279963/Building-a-Database-Application-in-Blazor-Part-3-C).

## History

* 15-Sep-2020: Initial version.
* 2-Oct-2020: Minor formatting updates and typo fixes.
* 17-Nov-2020: Major Blazor.CEC library changes.  Change to ViewManager from Router and new Component base implementation.
* 28-Mar-2021: Major updates to Services, project structure and data editing.
