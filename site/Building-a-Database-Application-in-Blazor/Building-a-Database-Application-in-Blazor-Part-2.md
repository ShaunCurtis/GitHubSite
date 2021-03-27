---
title: Building the Services
oneliner: This article describes building the CRUDL data services for a Blazor Database Application.
precis: This article describes how to build the CRUDL data services for a Blazor Database Application.
date: 2021-03-15
published: 2020-07-01
---

# Part 2 - Services - Building the CRUD Data Layers

::: danger
This article and all the others in this series is a building site.  Total revamp.  See CodeProject for the most recent released version which is very out-of-date
:::

This article is the second in a series on Building a Blazor Database Projects.  It describes techniques and methodologies for abstracting the data and business logic layers into boilerplate library code.  It is a total rewrite from earlier releases.

1. Project Structure and Framework.
2. Services - Building the CRUD Data Layers.
3. View Components - CRUD Edit and View Operations in the UI.
4. UI Components - Building HTML/CSS Controls.
5. View Components - CRUD List Operations in the UI.
6. A walk through detailing how to add weather stations and weather station data to the application.

## Repository and Database

The repository for the articles has moved to [CEC.Blazor.SPA Repository](https://github.com/ShaunCurtis/CEC.Blazor.SPA).  [CEC.Blazor GitHub Repository](https://github.com/ShaunCurtis/CEC.Blazor) is obselete and will be removed.

There's a SQL script in /SQL in the repository for building the database.

[You can see the Server and WASM versions of the project running here on the same site](https://cec-blazor-server.azurewebsites.net/).

## Objective

Before diving into specifics, our goal is a front end service that the UI uses that looks something like:

```csharp
    public class WeatherForecastControllerService : FactoryControllerService<WeatherForecast>
    {
        public WeatherForecastControllerService(IFactoryDataService factoryDataService) : base(factoryDataService) { }
    }
```

And a database inteface `DbContext` that looks like:

```csharp
    public class LocalWeatherDbContext : DbContext
    {
        public LocalWeatherDbContext(DbContextOptions<LocalWeatherDbContext> options)
            : base(options)
        {}

        /// <summary>
        /// DbSet for the <see cref="WeatherForecast"/> record
        /// </summary>
        public DbSet<WeatherForecast> WeatherForecast { get; set; }

    }
```

And where all that is required to add a new record type is:
1. Add the necessary table to the database.
2. Define a Dataclass.
2. Define a `DbSet` in the `DbContext`.
3. Define a  `public class nnnnnnControllerService : FactoryControllerService<nnnnnn>` Service and register it with the Services container.

## Services

Blazor is built on DI [Dependency Injection] and IOC [Inversion of Control] principles.  If you're unfamiliar with these concepts, do a little [backgound reading](https://www.codeproject.com/Articles/5274732/Dependency-Injection-and-IoC-Containers-in-Csharp) before diving into Blazor.  You'll save yourself a lot of time in the long run!

Blazor Singleton and Transient services are relatively straight forward.  You can read more about them in the [Microsoft Documentation](https://docs.microsoft.com/en-us/aspnet/core/blazor/fundamentals/dependency-injection).  Scoped are a little more complicated.

1. A scoped service object exists for the lifetime of a client application session - note client and not server.  Any application resets, such as F5 or navigation away from the application, resets all scoped services.  A duplicated tab in a browser creates a new application, and a new set of scoped services.
2. A scoped service can be scoped to an object in code.  This is most common in a UI conponent.  The `OwningComponentBase` component class has functionality to restrict the life of a scoped service to the lifetime of the component. This is covered in more detail in another article. 

`Services` is the Blazor IOC [Inversion of Control] container.

In Blazor Server services are configured in `startup.cs`:

Note we're using a Service Colection extension `AddApplicationServices` to execute all the application specific services.

```csharp
// CEC.Blazor.Server/startup.cs
public void ConfigureServices(IServiceCollection services)
{
    services.AddRazorPages();
    services.AddServerSideBlazor();
    // the Services for the CEC.Blazor .
    services.AddCECBlazorSPA();
    // the local application Services defined in ServiceCollectionExtensions.cs
    services.AddApplicationServices(Configurtion);
}
```

`AddApplicationServices` is shown below.  It's declared within a static class as a static extension.


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
2. Only the data layer service is different.  The Server version, used by both the Blazor Server and the WASM API Server, interfaces with the database and Entitiy Framework.  It's scoped as a Singleton.  We running async, so we use the DbContextFactory and create and close DbContexts per query.  The Client version uses `HttpClient` (which is a scoped service) to make calls to the API and is therefore itself scoped.  There's also a "dummy" data service that uses the SQLite in-memory database.
4. `FactoryDataService` implementing `IFactoryDataService` is used to process all the data requests through generics, `TRecord` defining which dataset is retrieved and returned.   These services, along with a set of `DbContext` extensions, boilerplate all the core data service code into library classes.


### Generics

The boilerplate library code relies heavily on Generics.  The two generic entities used are:
1. `TRecord` - this represents a model record class.  It must implement `IDbRecord`, a vanilla `new()` and be a class.  `TRecord` is defined on a Method by Method basis, not at the class level.
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

1. *GetRecordList* - get a List of all the records in the dataset.
3. *GetRecord* - get a single record by ID or GUID
4. *CreateRecord* - Create a new record
5. *UpdateRecord* - Update the record based on ID
6. *DeleteRecord* - Delete the record based on ID

Keep these in mind as we work through the data layers.

#### DbTaskResult

Data layer CUD operations return a `DbTaskResult` object.  Most of the properties are self-evident.  The UI can use the information returned to display messages based on the result.  `NewID` returns the new ID from a Create operation.

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

1. `ID` is the standard database Identity field
2. `GUID` is a unique identifier for this copy of the record
3. `DisplayName` provides a generic name for the record

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
3. Implementation of `IValidation` for Validation we saw in one of the previous articles.

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

In the application we implement two Entity Framework DBContexts.

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
It looks pretty bare because most of the real database activity takes place in a set of extensions.  Out-of-the-box `DbContext` doesn't provide the Stored Procedure and generics support we require, so we add that functionality through a set of extensions on `DbContext`.  These are defined in the static class `DbContextExtensions`.  We'll look at the methods individually.

`GetDbSet` is a utility function to get the correct `DbSet` for the record type defined in `TRecord`.  `TRecord` must implement `IDbRecord` (we'll look at it shortly).  `IDbRecord` has a `DbRecordInfo` property `RecordInfo` which contains the information we need to get the correct `DbSet`.  The `DbSet` name can be provided directly provided as `dbSetName` when we call the method, or (normally the case), the method creates an instance of `TRecord` and gets `RecordInfo` to get the `DbSet` name.  The method uses reflection to get the correct reference to the `DbSet`, casts it and returns the casted reference.  To be clear, we return a reference to the correct `DbSet` in `WeatherForecastDbContext`.  If `TRecord` is `DbWeatherForecast`, the `RecordName` defined in `RecordInfo` is *WeatherForecast*, `GetDbSet` returns a reference to `DbWeatherForecast.WeatherForecast`.  With the correct `DbSet` we can run Linq queries against that `DbSet`.  `DbContext` will translate those Linq queries into SQL queries against the database View.

```csharp
private static DbSet<TRecord> GetDbSet<TRecord>(this DbContext context, string dbSetName = null) where TRecord : class, IDbRecord<TRecord>, new()
{
    // Get the property info object for the DbSet 
    var rec = new TRecord();
    var pinfo = context.GetType().GetProperty(dbSetName ?? rec.RecordInfo.RecordName);
    // Get the property DbSet
    return (DbSet<TRecord>)pinfo.GetValue(context);
}
```

`GetRecordAsync` uses `GetDbSet` to get the `DbSet`, queries the `DbSet` for the specific record and returns it.

```csharp
public async static Task<TRecord> GetRecordAsync<TRecord>(this DbContext context, int id, string dbSetName = null) where TRecord : class, IDbRecord<TRecord>, new()
{
    var dbset = GetDbSet<TRecord>(context, dbSetName);
    return await dbset.FirstOrDefaultAsync(item => ((IDbRecord<TRecord>)item).ID == id);
}
```

`GetRecordListAsync` gets a `<List<TRecord>>` from the `DbSet` for `TRecord`.

```csharp
public async static Task<List<TRecord>> GetRecordListAsync<TRecord>(this DbContext context, string dbSetName = null) where TRecord : class, IDbRecord<TRecord>, new()
{
    var dbset = GetDbSet<TRecord>(context, dbSetName);
    return await dbset.ToListAsync() ?? new List<TRecord>();
}
```

`GetRecordFilteredListAsync` gets a `<List<TRecord>>` based on the filters set in `filterList`.  It cycles through the filters applying them sequentially.  The method runs the filter against the `DbSet` until it gets a result, then runs the rest of the filters against `list`.

```csharp
public async static Task<List<TRecord>> GetRecordFilteredListAsync<TRecord>(this DbContext context, FilterListCollection filterList, string dbSetName = null) where TRecord : class, IDbRecord<TRecord>, new()
{
    // Get the DbSet
    var dbset = GetDbSet<TRecord>(context, null);
    // Get a empty list
    var list = new List<TRecord>();
    // if we have a filter go through each filter
    // note that only the first filter runs a SQL query against the database
    // the rest are run against the dataset.  So do the biggest slice with the first filter for maximum efficiency.
    if (filterList != null && filterList.Filters.Count > 0)
    {
        foreach (var filter in filterList.Filters)
        {
            // Get the filter propertyinfo object
            var x = typeof(TRecord).GetProperty(filter.Key);
            // We have records so need to filter on the list
            if (list.Count > 0)
                list = list.Where(item => x.GetValue(item).Equals(filter.Value)).ToList();
            // We don't have any records so can query the DbSet directly
            else
                list = await dbset.Where(item => x.GetValue(item).Equals(filter.Value)).ToListAsync();
        }
    }
    //  No list, just get the full recordset if allowed by filterlist
    else if (!filterList.OnlyLoadIfFilters)
        list = await dbset.ToListAsync();
    // otherwise return an empty list
    return list;
}
```


`GetLookupListAsync` gets a `SortedDictionary` for the UI to use in Selects.  It gets the `DbSet` for `TRecord` and builds a `SortedDictionary` from the `ID` and `DisplayName` fields.  `ID` and `DisplayName` are defined in the `IDbRecord` interface.

```csharp
public async static Task<SortedDictionary<int, string>> GetLookupListAsync<TRecord>(this DbContext context) where TRecord : class, IDbRecord<TRecord>, new()
{
    var list = new SortedDictionary<int, string>();
    var dbset = GetDbSet<TRecord>(context, null);
    if (dbset != null) await dbset.ForEachAsync(item => list.Add(item.ID, item.DisplayName));
    return list;
}
```

`GetDistinctListAsync` gets a `List<string>` of `fieldName` from the `DbSet` for `TRecord`.  It uses reflection to the the `PropertyInfo` for `fieldName` and then runs a `Select` on `DbSet` to get the values, converting them to a string in the process.  It finally runs a `Distinct` operation on the list.  It's done this way as running `Distinct` on the `DbSet` doesn't work.

```csharp
public async static Task<List<string>> GetDistinctListAsync<TRecord>(this DbContext context, string fieldName) where TRecord : class, IDbRecord<TRecord>, new()
{
    var dbset = GetDbSet<TRecord>(context, null);
    var list = new List<string>();
    var x = typeof(TRecord).GetProperty(fieldName);
    if (dbset != null && x != null)
    {
        // we get the full list and then run a distinct because we can't run a distinct directly on the dbSet
        var fulllist = await dbset.Select(item => x.GetValue(item).ToString()).ToListAsync();
        list = fulllist.Distinct().ToList();
    }
    return list ?? new List<string>();
}
```

`ExecStoredProcAsync` is a classic Stored Procedure implementation run through a `DbCommand` obtained from  Entity Framework's underlying database connection.

```csharp
public static async Task<bool> ExecStoredProcAsync(this DbContext context, string storedProcName, List<SqlParameter> parameters)
{
    var result = false;

    var cmd = context.Database.GetDbConnection().CreateCommand();
    cmd.CommandText = storedProcName;
    cmd.CommandType = CommandType.StoredProcedure;
    parameters.ForEach(item => cmd.Parameters.Add(item));
    using (cmd)
    {
        if (cmd.Connection.State == ConnectionState.Closed) cmd.Connection.Open();
        try
        {
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception e)
        {
            Debug.WriteLine(e.Message);
        }
        finally
        {
            cmd.Connection.Close();
            result = true;
        }
    }
    return result;
}
```

## The Data Service Tier

#### IFactoryDataService

Core Data Service functionality is defined in the `IFactoryDataService` interface.
Important points to understand at this point are:

1. All methods are `async`, returning `Tasks`.
2. All methods use generics. `TRecord` defines the record type.
3. CUD operations return a `DbTaskResult` object that contains detail about the result.
4. There's a filtered version of get list using a `IFilterList` object defining the filters to apply to the returned dataset.
5. `GetLookupListAsync` provides a Id/Value `SortedDictionary` to use in *Select* controls in the UI.
6. `GetDistinctListAsync` builds a unique list of the field defined in `DbDinstinctRequest`.  These are used in filter list controls in the UI.  


```csharp
// CEC.Blazor.SPA/Services/Interfaces
public interface IFactoryDataService<TContext> 
    where TContext : DbContext
{
    public HttpClient HttpClient { get; set; }

    public IDbContextFactory<TContext> DBContext { get; set; }

    public IConfiguration AppConfiguration { get; set; }

    public Task<List<TRecord>> GetRecordListAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new();

    public Task<List<TRecord>> GetFilteredRecordListAsync<TRecord>(IFilterList filterList) where TRecord : class, IDbRecord<TRecord>, new(); 

    public Task<TRecord> GetRecordAsync<TRecord>(int id) where TRecord : class, IDbRecord<TRecord>, new() ;

    public Task<TRecord> GetRecordAsync<TRecord>(Guid guid) where TRecord : class, IDbRecord<TRecord>, new(); 

    public Task<int> GetRecordListCountAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new() ;

    public Task<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new() ;

    public Task<DbTaskResult> CreateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new() ;

    public Task<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new() ;

    public Task<SortedDictionary<int, string>> GetLookupListAsync<TLookup>() where TLookup : class, IDbRecord<TLookup>, new() ;

    public Task<List<string>> GetDistinctListAsync<TRecord>(string fieldName) where TRecord : class, IDbRecord<TRecord>, new() ;
        
    public Task<List<DbBaseRecord>> GetBaseRecordListAsync<TLookup>() where TLookup : class, IDbRecord<TLookup>, new() ;

    public List<SqlParameter> GetSQLParameters<TRecord>(TRecord item, bool withid = false) where TRecord : class, new() ;
}
```
#### FactoryDataService

`FactoryDataService` is a base abstract implementation of the Interface

```csharp
// CEC.Blazor.SPA/Services/Base
    public abstract class FactoryDataService<TContext>: IFactoryDataService<TContext>
        where TContext : DbContext
    {
        public Guid ServiceID { get; } = Guid.NewGuid();

        public HttpClient HttpClient { get; set; } = null;

        public virtual IDbContextFactory<TContext> DBContext { get; set; } = null;

        public IConfiguration AppConfiguration { get; set; }

        public FactoryDataService(IConfiguration configuration) => this.AppConfiguration = configuration;

        /// <summary>
        /// Gets the Record Name from TRecord
        /// </summary>
        /// <typeparam name="TRecord"></typeparam>
        /// <returns></returns>
        protected string GetRecordName<TRecord>() where TRecord : class, IDbRecord<TRecord>, new()
        {
            var rec = new TRecord();
            return rec.RecordInfo.RecordName ?? string.Empty;
        }

        protected bool TryGetRecordName<TRecord>(out string name) where TRecord : class, IDbRecord<TRecord>, new()
        {
            var rec = new TRecord();
            name = rec.RecordInfo.RecordName ?? string.Empty;
            return !string.IsNullOrWhiteSpace(name);
        }

        public virtual Task<List<TRecord>> GetRecordListAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new()
            => Task.FromResult(new List<TRecord>());

        public virtual Task<List<TRecord>> GetFilteredRecordListAsync<TRecord>(FilterListCollection filterList) where TRecord : class, IDbRecord<TRecord>, new()
            => Task.FromResult(new List<TRecord>());

        public virtual Task<TRecord> GetRecordAsync<TRecord>(int id) where TRecord : class, IDbRecord<TRecord>, new()
            => Task.FromResult(new TRecord());

        public virtual Task<TRecord> GetRecordAsync<TRecord>(Guid guid) where TRecord : class, IDbRecord<TRecord>, new()
            => Task.FromResult(new TRecord());

        public virtual Task<int> GetRecordListCountAsync<TRecord>() where TRecord : class, IDbRecord<TRecord>, new()
            => Task.FromResult(0);

        public virtual Task<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
            => Task.FromResult(new DbTaskResult() { IsOK = false, Type = MessageType.NotImplemented, Message = "Method not implemented" });

        public virtual Task<DbTaskResult> CreateRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
            => Task.FromResult(new DbTaskResult() { IsOK = false, Type = MessageType.NotImplemented, Message = "Method not implemented" });

        public virtual Task<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record) where TRecord : class, IDbRecord<TRecord>, new()
            => Task.FromResult(new DbTaskResult() { IsOK = false, Type = MessageType.NotImplemented, Message = "Method not implemented" });

        public virtual Task<SortedDictionary<int, string>> GetLookupListAsync<TLookup>() where TLookup : class, IDbRecord<TLookup>, new()
            => Task.FromResult(new SortedDictionary<int, string>());

        public virtual Task<SortedDictionary<int, string>> GetLookupListAsync(string recordName)
            => Task.FromResult(new SortedDictionary<int, string>());

        public virtual Task<List<string>> GetDistinctListAsync<TRecord>(string fieldName) where TRecord : class, IDbRecord<TRecord>, new()
            => Task.FromResult(new List<string>());

        public virtual List<SqlParameter> GetSQLParameters<TRecord>(TRecord item, bool withid = false) where TRecord : class, new()
            => new List<SqlParameter>();
    }
```
#### FactoryServerDataService

`FactoryServerDataService` is a concrete implementation of `IFactoryDataService`.  Methods call back into the `DBContext` extension methods.  

`RunStoredProcedure`:

1. Uses the `RecordInfo` property of an instance of `TRecord` to get the correct stored procedure
2. Builds the SQLParameters through `GetSQLParameters` which reads the `SPParameters` attribute labelled properties of `TRecord`.

```csharp
// CEC.Blazor.SPA/Services/Base
    public class FactoryServerDataService<TContext> :
        FactoryDataService<TContext>,
        IFactoryDataService<TContext>
        where TContext : DbContext
    {

        public FactoryServerDataService(IConfiguration configuration, IDbContextFactory<TContext> dbContext) : base(configuration)
            => this.DBContext = dbContext;

        public override async Task<List<TRecord>> GetRecordListAsync<TRecord>()
            => await this.DBContext.CreateDbContext().GetRecordListAsync<TRecord>();

        public override async Task<List<TRecord>> GetFilteredRecordListAsync<TRecord>(FilterListCollection filterList)
            => await this.DBContext.CreateDbContext().GetRecordFilteredListAsync<TRecord>(filterList);

        public override async Task<TRecord> GetRecordAsync<TRecord>(int id)
            => await this.DBContext.CreateDbContext().GetRecordAsync<TRecord>(id);

        public override async Task<TRecord> GetRecordAsync<TRecord>(Guid guid)
            => await this.DBContext.CreateDbContext().GetRecordAsync<TRecord>(guid);

        public override async Task<int> GetRecordListCountAsync<TRecord>()
            => await this.DBContext.CreateDbContext().GetRecordListCountAsync<TRecord>();

        public override async Task<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record)
            => await this.RunStoredProcedure<TRecord>(record, SPType.Update);

        public override async Task<DbTaskResult> CreateRecordAsync<TRecord>(TRecord record)
            => await this.RunStoredProcedure<TRecord>(record, SPType.Create);

        public override async Task<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record)
            => await this.RunStoredProcedure<TRecord>(record, SPType.Delete);

        public override async Task<List<string>> GetDistinctListAsync<TRecord>(string fieldName)
            => await this.DBContext.CreateDbContext().GetDistinctListAsync<TRecord>(fieldName);

        public override async Task<SortedDictionary<int, string>> GetLookupListAsync<TLookup>()
            => await this.DBContext.CreateDbContext().GetLookupListAsync<TLookup>() ?? new SortedDictionary<int, string>();

        protected async Task<DbTaskResult> RunStoredProcedure<TRecord>(TRecord record, SPType spType) where TRecord : class, IDbRecord<TRecord>, new()
        {
            var recordInfo = new TRecord().RecordInfo;
            var ret = new DbTaskResult()
            {
                Message = $"Error saving {recordInfo.RecordDescription}",
                IsOK = false,
                Type = MessageType.Danger
            };

            var spname = spType switch
            {
                SPType.Create => recordInfo.CreateSP,
                SPType.Update => recordInfo.UpdateSP,
                SPType.Delete => recordInfo.DeleteSP,
                _ => string.Empty
            };
            var parms = this.GetSQLParameters(record, spType);
            if (await this.DBContext.CreateDbContext().ExecStoredProcAsync(spname, parms))
            {
                var idparam = parms.FirstOrDefault(item => item.Direction == ParameterDirection.Output && item.SqlDbType == SqlDbType.Int && item.ParameterName.Contains("ID"));
                ret = new DbTaskResult()
                {
                    Message = $"{recordInfo.RecordDescription} saved",
                    IsOK = true,
                    Type = MessageType.Success
                };
                if (idparam != null) ret.NewID = Convert.ToInt32(idparam.Value);
            }
            return ret;
        }

        protected virtual List<SqlParameter> GetSQLParameters<TRecord>(TRecord record, SPType spType) where TRecord : class, IDbRecord<TRecord>, new()
        {
            var parameters = new List<SqlParameter>();
            foreach (var prop in (record as IDbRecord<TRecord>).GetSPParameters())
            {
                var attr = prop.GetCustomAttribute<SPParameterAttribute>();
                attr.CheckName(prop);
                // If its a delete we only need the ID and then break out of the for
                if (attr.IsID && spType == SPType.Delete)
                {
                    parameters.Add(new SqlParameter(attr.ParameterName, attr.DataType) { Direction = ParameterDirection.Input, Value = prop.GetValue(record) });
                    break;
                }
                // skip if its a delete
                if (spType != SPType.Delete)
                {
                    // if its a create add the ID as an output foe capturing the new ID
                    if (attr.IsID && spType == SPType.Create) parameters.Add(new SqlParameter(attr.ParameterName, attr.DataType) { Direction = ParameterDirection.Output });
                    // Deal with dates
                    else if (attr.DataType == SqlDbType.SmallDateTime) parameters.Add(new SqlParameter(attr.ParameterName, attr.DataType) { Direction = ParameterDirection.Input, Value = ((DateTime)prop.GetValue(record)).ToString("dd-MMM-yyyy") });
                    // Deal with Strings in default or null
                    else if (attr.DataType == SqlDbType.NVarChar || attr.DataType == SqlDbType.VarChar) parameters.Add(new SqlParameter(attr.ParameterName, attr.DataType) { Direction = ParameterDirection.Input, Value = string.IsNullOrEmpty(prop.GetValueAsString(record)) ? "" : prop.GetValueAsString(record) });
                    else parameters.Add(new SqlParameter(attr.ParameterName, attr.DataType) { Direction = ParameterDirection.Input, Value = prop.GetValue(record) });
                }
            }
            return parameters;
        }
    }
```

#### FactoryWASMDataService

`FactoryWASMDataService` is the WASM client implementation of `IFactoryDataService`.  It makes API calls into the server controller services.

```csharp
// CEC.Blazor/Services/Base
    public class FactoryWASMDataService<TContext> :
        FactoryDataService<TContext>
        where TContext : DbContext
    {

        public FactoryWASMDataService(IConfiguration configuration, HttpClient httpClient) : base(configuration) 
            => this.HttpClient = httpClient;

        public override async Task<TRecord> GetRecordAsync<TRecord>(int id)
        {
            var result = new TRecord();
            if (TryGetRecordName<TRecord>(out string recName))
            {
                var response = await this.HttpClient.PostAsJsonAsync($"{recName}/read?gid={Guid.NewGuid().ToString("D")}", id);
                result = await response.Content.ReadFromJsonAsync<TRecord>();
            }
            return result ?? default;
        }

        public override async Task<SortedDictionary<int, string>> GetLookupListAsync<TRecord>()
        {
            var result = new SortedDictionary<int, string>();
            if (TryGetRecordName<TRecord>(out string recName))
            {
                result = await this.HttpClient.GetFromJsonAsync<SortedDictionary<int, string>>($"{recName}/lookuplist?gid={Guid.NewGuid().ToString("D")}");
            }
            return result ?? default;
        }

        public override async Task<List<string>> GetDistinctListAsync<TRecord>(string fieldName)
        {
            var result = new List<string>();
            if (TryGetRecordName<TRecord>(out string recName))
            {
                var response = await this.HttpClient.PostAsJsonAsync($"{recName}/distinctlist?gid={Guid.NewGuid().ToString("D")}", fieldName);
                result = await response.Content.ReadFromJsonAsync<List<string>>();
            }
            return result ?? default;
        }

        public override async Task<List<TRecord>> GetFilteredRecordListAsync<TRecord>(FilterListCollection filterList)
        {
            var result = new List<TRecord>();
            if (TryGetRecordName<TRecord>(out string recName))
            {
                var response = await this.HttpClient.PostAsJsonAsync<FilterListCollection>($"{recName}/filteredlist?gid={Guid.NewGuid().ToString("D")}", filterList);
                result = await response.Content.ReadFromJsonAsync<List<TRecord>>();
            }
            return result ?? default;
        }

        public override async Task<List<TRecord>> GetRecordListAsync<TRecord>()
        {
            var result = new List<TRecord>();
            if (TryGetRecordName<TRecord>(out string recName))
                result = await this.HttpClient.GetFromJsonAsync<List<TRecord>>($"{recName}/list?gid={Guid.NewGuid().ToString("D")}");
            return result;
        }

        public override async Task<int> GetRecordListCountAsync<TRecord>()
        {
            var result = 0;
            if (TryGetRecordName<TRecord>(out string recName))
                result = await this.HttpClient.GetFromJsonAsync<int>($"{recName}/count?gid={Guid.NewGuid().ToString("D")}"); 
            return result;
        }

        public override async Task<DbTaskResult> UpdateRecordAsync<TRecord>(TRecord record)
        {
            var result = new DbTaskResult();
            if (TryGetRecordName<TRecord>(out string recName))
            {
                var response = await this.HttpClient.PostAsJsonAsync<TRecord>($"{recName}/update?gid={Guid.NewGuid().ToString("D")}", record);
                result = await response.Content.ReadFromJsonAsync<DbTaskResult>();
            }
            return result ?? default;
        }

        public override async Task<DbTaskResult> CreateRecordAsync<TRecord>(TRecord record)
        {
            var result = new DbTaskResult();
            if (TryGetRecordName<TRecord>(out string recName))
            {
                var response = await this.HttpClient.PostAsJsonAsync<TRecord>($"{recName}/create?gid={Guid.NewGuid().ToString("D")}", record);
                result = await response.Content.ReadFromJsonAsync<DbTaskResult>();
            }
            return result ?? default;
        }

        public override async Task<DbTaskResult> DeleteRecordAsync<TRecord>(TRecord record)
        {
            var result = new DbTaskResult();
            if (TryGetRecordName<TRecord>(out string recName))
            {
                var response = await this.HttpClient.PostAsJsonAsync<TRecord>($"{recName}/delete?gid={Guid.NewGuid().ToString("D")}", record);
                result = await response.Content.ReadFromJsonAsync<DbTaskResult>();
            }
            return result ?? default;
        }
    }
```

We'll look at the Server Side Controller shortly.

## The Business Logic/Controller Service Tier

Controllers are normally configured as Scoped Services.

The controller tier interface and base class are generic and reside in the CEC.Blazor.SPA library.  Two interfaces `IFactoryControllerService` and `IControllerPagingService` define the required functionality.  Both are implemented in the `FactoryControllerService` class.  

The code for these services is far too long to reproduce here.  `FactoryControllerService` is split into three partial classes.  We'll cover most of the functionality when we look at how the UI layer interfaces with the controller layer.

The main functionality implemented is:

1. Properties to hold the current record and recordset and their status.
2. Properties and methods - defined in `IControllerPagingService` - for UI paging operations on large datasets.
4. Properties and methods to sort the the dataset.
3. Properties and methods to track the edit status of the record (Dirty/Clean).
4. Methods to implement CRUD operations through the IDataService Interface.
5. Events triggered on record and record set changes.  Used by the UI to control page refreshes.
7. Methods to reset the Controller to a vanilla state.

All code needed to provide the above functionality is boilerplated in the base class.  Implementing specific record based controllers is a simple task with minimal coding.

#### WeatherForecastControllerService

Let's look at the `WeatherForecastControllerService` as an example.

The class:
 
1. Inherits from `FactoryControllerService` and sets the generic `TDbContext` and `TRecord` to specific classes.
2. Implements the class constructor that gets the required DI services and sets up the base class.
3. Gets the Dictionary object for the Outlook Enum Select box in the UI.

Note that the data service used is the `IFactoryDataService` configured in Services.  For WASM this is `FasctoryWASMDataService` and for Server or the API EASM Server this is `FactoryServerDataService`.
```csharp
// CEC.Weather/Controllers/ControllerServices/WeatherForecastControllerService.cs
public class WeatherForecastControllerService : 
    FactoryControllerService<DbWeatherForecast, WeatherForecastDbContext> 
{
    /// List of Outlooks for Select Controls
    public SortedDictionary<int, string> OutlookOptionList => Utils.GetEnumList<WeatherOutlook>();

    public WeatherForecastControllerService(NavigationManager navmanager, IConfiguration appconfiguration, IFactoryDataService<WeatherForecastDbContext> dataService) : base(appconfiguration, navmanager,dataService)
    {
    }
}
```

#### API Controllers

While they are not a service they are the final bit of the data layers to cover.  All the controllers use  the `IFactoryDataService` service to access the `FactoryServerDataService` data layer.  There's a controller per record.  We'll look at `WeatherForecastController` to review the code.

Note:
1. It gets the `IFactoryDataService` when the controller is initialized.
2. It maps the API calls directly into the `IFactoryDataService` methods.
 
```csharp
// CEC.Blazor.WASM.Server/Controllers/WeatherForecastController.cs
[ApiController]
public class WeatherForecastController : ControllerBase
{
    protected IFactoryDataService<WeatherForecastDbContext> DataService { get; set; }

    private readonly ILogger<WeatherForecastController> logger;

    public WeatherForecastController(ILogger<WeatherForecastController> logger, IFactoryDataService<WeatherForecastDbContext> dataService)
    {
        this.DataService = dataService;
        this.logger = logger;
    }

    [MVC.Route("weatherforecast/list")]
    [HttpGet]
    public async Task<List<DbWeatherForecast>> GetList() => await DataService.GetRecordListAsync<DbWeatherForecast>();

    [MVC.Route("weatherforecast/filteredlist")]
    [HttpPost]
    public async Task<List<DbWeatherForecast>> GetFilteredRecordListAsync([FromBody] FilterListCollection filterList) => await DataService.GetFilteredRecordListAsync<DbWeatherForecast>(filterList);

    [MVC.Route("weatherforecast/lookuplist")]
    [HttpGet]
    public async Task<SortedDictionary<int, string>> GetLookupListAsync() => await DataService.GetLookupListAsync<DbWeatherForecast>();

    [MVC.Route("weatherforecast/distinctlist")]
    [HttpPost]
    public async Task<List<string>> GetDistinctListAsync([FromBody] string fieldName) => await DataService.GetDistinctListAsync<DbWeatherForecast>(fieldName);

    [MVC.Route("weatherforecast/count")]
    [HttpGet]
    public async Task<int> Count() => await DataService.GetRecordListCountAsync<DbWeatherForecast>();

    [MVC.Route("weatherforecast/get")]
    [HttpGet]
    public async Task<DbWeatherForecast> GetRec(int id) => await DataService.GetRecordAsync<DbWeatherForecast>(id);

    [MVC.Route("weatherforecast/read")]
    [HttpPost]
    public async Task<DbWeatherForecast> Read([FromBody]int id) => await DataService.GetRecordAsync<DbWeatherForecast>(id);

    [MVC.Route("weatherforecast/update")]
    [HttpPost]
    public async Task<DbTaskResult> Update([FromBody]DbWeatherForecast record) => await DataService.UpdateRecordAsync<DbWeatherForecast>(record);

    [MVC.Route("weatherforecast/create")]
    [HttpPost]
    public async Task<DbTaskResult> Create([FromBody]DbWeatherForecast record) => await DataService.CreateRecordAsync<DbWeatherForecast>(record);

    [MVC.Route("weatherforecast/delete")]
    [HttpPost]
    public async Task<DbTaskResult> Delete([FromBody] DbWeatherForecast record) => await DataService.DeleteRecordAsync<DbWeatherForecast>(record);
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
* 7-Feb-2021: Major updates to Services, project structure and data editing.
