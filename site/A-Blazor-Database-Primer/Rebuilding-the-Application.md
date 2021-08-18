---
title: Part 1 - A Blazor Database Primer - Project Structure and Framework
oneliner: This article walks the user through re-organising the Blazor Template Appplication.
precis: This article walks the user through re-organising the Blazor Template Appplication.
date: 2021-08-13
published: 2021-08-13
---

# A Blazor Database Primer

You've built the out-of-the-box template, done some exploratory coding.  You're now ready to work on your first application.

Where do you start?  It's a little daunting.  You expect to make mistakes, take the odd wrong road, need some help....

This set of articles is intended to provide guidance on how to get up and running.  It's aimed primarily at the small to medium sized project with one or two developers working on it.

The articles take a very practical approach, starting with the standard Blazor Server template, and turning it into a properly structured and testable solution.


# Part 1 - Re-building the Application

# Introduction

This first article shows how to rebuild the data and core logic layers of the application.  The starting point is the out-of-the-box Blazor Server template.

# Methodology

There are many programming methodologies.  I use the fairly simple three domain model shown below.

![Methodologies](/siteimages/articles/DB-Primer/methodology.png)

The heart of the application is the *Core Domain*.  This contains all the Application and Business logic code.  It only depends on Blazor and third party libraries.  There are no dependancies on the other application domains.  The *Data Domain* provides the interface into the data storage.  The *UI Domain* contains all the UI code.  Communications between domains is through interfaces.

# The Initial Solution

Create a new solution using the standard Blazor Server project with no authenication - BlazorDB.

Create the following projects in the solution:
1. *BlazorDB.Core* using the *Class Library* template.
2. *BlazorDB.Data* using the *Class Library* template.
3. *BlazorDB.UI* using the *Razor Class Library* template.
4. *BlazorDB.Test* using the *xUnit Test Project* template.
5. *BlazorDB.Web* using the *Blazor Server App* template.

Clear the contents from projects 1-4.  Leave *BlazorDB.Web* as is.  Set *BlazorDB.Web* as the startup project.

You should now have a solution that looks like:

![Solution](/siteimages/articles/DB-Primer/article-1-solution.png)


Add dependancies to the Data and UI projects back to Core. Add dependancies to the Test project to all three projects.

![Project Dependancies](/siteimages/articles/DB-Primer/project-dependancies.png)

## The Data Classes

Create *Interfaces* and *DataClasses* folders in *BlazorDb.Core*.

Copy `WeatherForecast` to the *BlazorDB.Core/DataClasses*.

Add a public interface to *Interfaces* called `IRecord`.  It should look like this:

```csharp
using System;
namespace BlazorDB.Core
{
    public interface IRecord
    {
        public Guid ID { get; }
        public string Name { get; }
    }
}
```

All our dataclasses will implement this interface.  They must have:
1. An `ID` field of type `Guid`.
2. A `Name` field of type `string`.

We'll use this interface in our generic classes and methods - more later.

Modify `WeatherForecast` to:

```csharp
using System;

namespace BlazorDB.Core
{
    public record WeatherForecast : IRecord
    {
        public Guid ID { get; init; } = Guid.Empty;
        public DateTime Date { get; init; }
        public int TemperatureC { get; init; }
        public string Summary { get; init; }
        public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
        public string Name => $"Weather Forecast for {Date.ToShortDateString()}";
    }
}
```

We've:
1. Added the `IRecord` interface.
2. Implemented `ID` and `Name`.
3. Changed from a `class` to a `record`.
4. Changed the setters to `init`.

Records from the data store should be immutable within the application.  We use the new C# `record` type to implement this.  So how do we edit records? More later.

# The Data Store

We're now ready to build an in-memory data store that "mimics" a Entity Framework context.  We'll look at a real SQL implementation using Entity Framework in the third article.

Add a `DB` folder to *BlazorDB.Data*, and add a `WeatherDataStore` class.

```csharp
using BlazorDB.Core;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

namespace BlazorDB.Data
{
    public class WeatherDataStore
    {
        // field holding the internal "table" of weatherforecast records
        private List<_WeatherForecast> _weatherForecastRecords = new List<_WeatherForecast>();

        public WeatherDataStore()
            => _weatherForecastRecords = _getForecasts();

        // The Dataset for WeatherForecasts
        public IEnumerable<WeatherForecast> WeatherForecast
        {
            get
            {
                var list = new List<WeatherForecast>();
                _weatherForecastRecords.ForEach(item => list.Add(new WeatherForecast { ID = item.ID, Date = item.Date, TemperatureC = item.TemperatureC, Summary = item.Summary }));
                return list.AsEnumerable<WeatherForecast>();
            }
        }

        // Generics method to get the correct dataset for TRecord
        public ValueTask<List<TRecord>> GetDataSet<TRecord>() where TRecord : class, IRecord, new()
        {

            var dbSetName = new TRecord().GetType().Name;
            // Get the property info object for the DbSet 
            var pinfo = this.GetType().GetProperty(dbSetName);
            List<TRecord> dbSet = null;
            Debug.Assert(pinfo != null);
            // Get the property DbSet
            try
            {
                dbSet = (List<TRecord>)pinfo.GetValue(this);
            }
            catch
            {
                throw new InvalidOperationException($"{dbSetName} does not have a matching DBset ");
            }
            Debug.Assert(dbSet != null);
            Task.Delay(100);
            return ValueTask.FromResult(dbSet);
        }

        //  Internal Read/Write class for a WeatherForecast
        private struct _WeatherForecast
        {
            public Guid ID;
            public DateTime Date;
            public int TemperatureC;
            public string Summary;
        }

        // method to build the internal WeatherForecast "table"
        private List<_WeatherForecast> _getForecasts()
        {
            var rng = new Random();
            var summaries = new[]  {
                "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
            };
            return Enumerable.Range(1, 50).
                    Select(index => new _WeatherForecast
                    {
                        ID = Guid.NewGuid(),
                        Date = DateTime.Now.AddDays(index),
                        TemperatureC = rng.Next(-20, 55),
                        Summary = summaries[rng.Next(summaries.Length)]
                    }).ToList();
        }
    }
}
```

The class builds an internal list of records on initialisation.  See the inline comments for details.  The public `WeatherForcast` property provides an `IEnumerable` list of `WeatherForecast` records from the internal store.  By convention the data store *dataset* is always named the same as the record class.  Using this convention, the generic method `List<TRecord> GetDataSet<TRecord>()` gets the correct `IEnumerable<TRecord>` property for `TRecord`.  In our case we only have one, but we're building the logic to make this scaleable.

## Data Brokers

Data Brokers are the external interface for the **Data Domain** black box.  The **Core Domain** talks to the **Data Domain** through brokers.  They're often known as *shims*.

### IDataBroker

This is the interface definition.  It resides in the **Core Domain**.

Add a *Interface* folder to *BlazorDB.Core*, and add a `IDataBroker` interface.

```csharp
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlazorDB.Core
{
    public interface IDataBroker
    {
        public ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>() where TRecord : class, IRecord, new();
    }
}
```

Normally we would implement a full set of CRUD methods in the broker, but at the moment we're only doing the List operation, so define a single method `SelectAllRecordsAsync`.

It's:
1. Generic using `TRecord` which has constraints - it must be a class (or record), implement IRecord and have an empty new method.
2. Returns a `Task`, so can be async.  Almost all database operations are async, so we start out implementing the broker using Task based methods.
3. Returns a `List` of `TRecord`s.

### DataBroker

This is the base interface definition.  It resides in the **Data Domain**.

Add a *Broker* folder to *BlazorDB.Core*, and add a `DataBroker` class.

```csharp
using BlazorDB.Core;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlazorDB.Data
{
    public abstract class DataBroker : IDataBroker
    {
        public virtual ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>() where TRecord : class, IRecord, new()
            => throw new InvalidOperationException($"The SelectAllRecordsAsync method is not implemented for this Broker.");
    }
}
```

It doesn't do a great deal, just returns an exception.  In full Crud operations it implements all the CRUD methods.  Specific implementations then only need to override relevant methods, and rely on the base implement to return "Not Implemented" exceptions.

### ServerDataBroker

Finally a real implementation.

Add a *Broker* folder to *BlazorDB.Core*, and add a `ServerDataBroker` class.

```csharp
using BlazorDB.Core;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlazorDB.Data
{
    public class ServerDataBroker : DataBroker, IDataBroker
    {
        // internal field for the data store
        private WeatherDataStore dataStore;

        // Initialization - get passed the weatherForecastDataStore
        //  As a service we will get this passed to us by the Service Container
        public ServerDataBroker(WeatherDataStore weatherForecastDataStore)
        {
            this.dataStore = weatherForecastDataStore;
        }

        // Concrete implementation getting all the records from the data store
        public async override ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>()
        {
            var dbset = await dataStore.GetDataSet<TRecord>();
            return dbset;
        }
    }
}
```

This uses generics and the naming conventions to get the correct DataSet for `TRecord`.

## Testing

At this point we can set up our first test.

The test project file should look like this:

```csharp
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>

    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="16.10.0" />
    <PackageReference Include="xunit" Version="2.4.1" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.4.3">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="coverlet.collector" Version="3.1.0">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="FluentAssertions" Version="5.10.3" />
    <PackageReference Include="Tynamix.ObjectFiller" Version="1.5.6" />
    <PackageReference Include="Moq" Version="4.16.1" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\BlazorDB.Core\BlazorDB.Core.csproj" />
    <ProjectReference Include="..\BlazorDB.Data\BlazorDB.Data.csproj" />
  </ItemGroup>

</Project>
```

Add two partial classes to the test project `UnitTests.cs` and `UnitTests.Base.cs`.

`UnitTests.Base.cs` looks like this with a sinlge method to build a dummy `List<WeatherForecast>`.

```csharp
using BlazorDB.Core;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace BlazorDb.Data.Test
{
    public partial class UnitTests
    {
        private ValueTask<List<WeatherForecast>> CreateRandomWeatherForecastListAsync(int number)
        {
            var rng = new Random();
            var summaries = new[]  {
                    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
                };
            var list = Enumerable.Range(1, number).
                 Select(index => new WeatherForecast
                 {
                     ID = Guid.NewGuid(),
                     Date = DateTime.Now.AddDays(index),
                     TemperatureC = rng.Next(-20, 55),
                     Summary = summaries[rng.Next(summaries.Length)]
                 }).ToList();
            return ValueTask.FromResult<List<WeatherForecast>>(list);
        }
    }
}
```

In `UnitTests.cs` we add a single test `DataBrokerShouldGet50WeatherForecastsAsync`.

```csharp
using BlazorDB.Core;
using BlazorDB.Data;
using Moq;
using System.Collections.Generic;
using Xunit;

namespace BlazorDb.Data.Test
{
    public partial class UnitTests
    {

        [Fact]
        public async void DataBrokerShouldGet50WeatherForecastsAsync()
        {
            // define
            var weatherForecastDataStore = new WeatherDataStore();
            var dataBroker = new ServerDataBroker(weatherForecastDataStore: weatherForecastDataStore);

            // test
            var retrievedRecords = await dataBroker.SelectAllRecordsAsync<WeatherForecast>();

            // assert
            Assert.IsType<List<WeatherForecast>>(retrievedRecords);
            Assert.Equal(50, retrievedRecords.Count);
        }
    }
}
```
Our data store builds a 50 record dataset, so we can test if:
1. We get a `List<WeatherForecast>` as our return object - we get a list of the correct records type.
2. We get 50 rows.

On the project you can now run the test and make sure it passes.  Check the errors and debug if you have problems.

![Unit Testing](/siteimages/articles/DB-Primer/unittest-1.png)

## Data Connectors

Data Connectors are the data facing interface of the **Core Domain** back box.  Data connectors talk to dfata brokers.

### IDataConnector

Add an `IDataConnector` interface to *BlazorDB.Core.Interfaces*

```csharp
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlazorDB.Core
{
    public interface IDataConnector
    {
        public ValueTask<List<TRecord>> GetRecordsAsync<TRecord>() where TRecord : class, IRecord, new();
    }
}
```

This looks the same as `ServerDataBroker`, but the language has now changed.  We are using more general `get` rather than database `select`.

### DataConnector

Add a *Connectors* folder to *DatabaseDB.Core* and add a `DataConnector` class.

This is the base implementation of `IDataConnector`.

```csharp
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlazorDB.Core
{
    public class DataConnector : IDataConnector
    {

        private IDataBroker dataBroker;

        public DataConnector(IDataBroker dataBroker)
            => this.dataBroker = dataBroker;

        public ValueTask<List<TRecord>> GetRecordsAsync<TRecord>() where TRecord: class, IRecord, new() 
            => dataBroker.SelectAllRecordsAsync<TRecord>();
    }
}
```

We obtain the registered `IDataBroker` from the Services Container, and, in our case, call the `SelectAllRecordsAsync` on the interface.

### Testing

We can test the connector with the follow test added to `UnitTests`:

```csharp
[Fact]
public async void DataConnectorShouldGet25WeatherForecastsAsync()
{
    // define
    var dataBrokerMock = new Mock<IDataBroker>();
    var dataConnector = new DataConnector(dataBroker: dataBrokerMock.Object);
    dataBrokerMock.Setup(broker =>
        broker.SelectAllRecordsAsync<WeatherForecast>())
        .Returns(CreateRandomWeatherForecastListAsync(25)
        );

    // test
    var retrievedRecords = await dataConnector.GetRecordsAsync<WeatherForecast>();

    // assert
    Assert.IsType<List<WeatherForecast>>(retrievedRecords);
    Assert.Equal(25, retrievedRecords.Count);
    dataBrokerMock.Verify(broker => broker.SelectAllRecordsAsync<WeatherForecast>(), Times.Once);
    dataBrokerMock.VerifyNoOtherCalls();
}
```

This test uses `Mock` to mock the IDataBroker so we can monitor calls into the interface.  The test:
1. Checks the type of the return is `List<WeatherForecast>`.
2. Checks we have 25 records - what was created in the mock.
3. Verifies the `IBroker` method `SelectAllRecordsAsync` was called only once.
4. Verifies no other method was called on `IBroker`.

## View Services

View Services are the basic building blocks for the Application/Business logic.

Add a *ViewServices* folder to *BlazorDB.Core*.

### IViewService

Add a `IViewService` interface to *BlazorDB.Core/Interfaces*

```csharp
using BlazorDB.Core;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlazorDB
{
    public interface IViewService<TRecord>
        where TRecord : class, IRecord, new()
    {
        public List<TRecord> Records { get; }
        public bool HasRecords { get; }
        public int RecordCount { get; }
        public event EventHandler RecordListHasChanged;
        public ValueTask GetRecordsAsync();
    }
}
```

### ViewService

Add a `ViewService` class to *BlazorDB.Core/ViewServices*.  This is the base implementation.

The code is preety self evident.  The event `RecordListHasChanged` is triggered whenever the `Records` property is updated.

```csharp
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlazorDB.Core
{
    public class ViewService<TRecord> :
        IViewService<TRecord>
        where TRecord : class, IRecord, new()
    {
        private IDataConnector dataConnector;

        public List<TRecord> Records
        {
            get => _records;

            protected set
            {
                _records = value;
                this.RecordListHasChanged?.Invoke(value, EventArgs.Empty);
            }
        }

        public bool HasRecords => Records is not null;

        public int RecordCount => this.Records?.Count ?? 0;

        private List<TRecord> _records;

        public event EventHandler RecordListHasChanged;

        public ViewService( IDataConnector dataConnector)
        => this.dataConnector = dataConnector;

        public async ValueTask GetRecordsAsync()
            => Records = await dataConnector.GetRecordsAsync<TRecord>();
    }
}
```

### WeatherForecastViewService

Finally we add a concrete implementation of the View Service for the `WeatherForecast` record.

```csharp
namespace BlazorDB.Core
{
    public class WeatherForecastViewService : ViewService<WeatherForecast>
    {
        public WeatherForecastViewService(IDataConnector dataConnector) : base(dataConnector) { }
    }
}
```

This is minimlistic, just setting `IRecord` as `WeatherForecast`.

### Testing

We can add a test to check thst this is working correctly.  Add the folwwoing method to *BlazorDB.Test/UnitTests*:

```csharp
    [Fact]
    public async void ViewShouldGet25WeatherForecastsAsync()
    {
        // define
        var dataConnectorMock = new Mock<IDataConnector>();
        var weatherForecastViewService = new WeatherForecastViewService(dataConnector: dataConnectorMock.Object);
        dataConnectorMock.Setup(item =>
            item.GetRecordsAsync<WeatherForecast>())
            .Returns(CreateRandomWeatherForecastListAsync(25)
            );
        object eventSender = null;
        weatherForecastViewService.RecordListHasChanged += (sender, e) => { eventSender = sender; };

        // test
        await weatherForecastViewService.GetRecordsAsync();

        // assert
        Assert.IsType<List<WeatherForecast>>(weatherForecastViewService.Records);
        Assert.Equal(25, weatherForecastViewService.RecordCount);
        Assert.IsType<List<WeatherForecast>>(eventSender);
        dataConnectorMock.Verify(item => item.GetRecordsAsync<WeatherForecast>(), Times.Once);
        dataConnectorMock.VerifyNoOtherCalls();
    }
```

We mock the data connector and do the same set of tests as before.

### Clean up the Project Files

Clean up the project files for the three projects:

*BlazorDb.Core*
```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>
  </PropertyGroup>

</Project>
```

*BlazorDb.Data*

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>
  </PropertyGroup>
  
  <ItemGroup>
    <ProjectReference Include="..\BlazorDB.Core\BlazorDB.Core.csproj" />
  </ItemGroup>

</Project>
```

## Refactoring the Solution

### BlazorDB.UI

Copy the following from *BlazorDB*.
1. *Pages* and *Shared* folders.
2. *App.razor* to the root folder.

Delete:
1. *_Hosts.cshtml*
2. *Error.cshtml*

Update *_Imports.razor*.

```csharp
@using System.Net.Http
@using Microsoft.AspNetCore.Authorization
@using Microsoft.AspNetCore.Components.Forms
@using Microsoft.AspNetCore.Components.Routing
@using Microsoft.AspNetCore.Components.Web
@using Microsoft.AspNetCore.Components.Web.Virtualization
@using Microsoft.JSInterop
@using BlazorDB.Core
@using BlazorDB.UI
@using BlazorDB.UI.Pages
@using BlazorDB.UI.Shared
```

We're adding the new `BlazorDB.UI` namespaces

Update the `Router` line in *App.razor*

```html
<Router AppAssembly="@typeof(App).Assembly" PreferExactMatches="@true">
  .....
</Router>
```
We're pointing `AppAssembly` (where the router looks for classes with Route attributes) to itself - i.e. this Assembly.

Clean up the project file:

```xml
<Project Sdk="Microsoft.NET.Sdk.Razor">

  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Components.Web" Version="5.0.7" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\BlazorDB.Core\BlazorDB.Core.csproj" />
  </ItemGroup>

</Project>
```

### BlazorDB

Remove everything but *_Imports.razor* and *Program.cs*.

Add an *Extensions* folder and create a `ServiceCollectionExtensions` class in the folder.

```csharp
using BlazorDB.Core;
using BlazorDB.Data;
using Microsoft.Extensions.DependencyInjection;

namespace BlazorDB.SPA
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddWASMApplicationServices(this IServiceCollection services)
        {
            //services.AddScoped<IDataBroker, APIDataBroker>();
            AddCommonServices(services);
            return services;
        }

        public static IServiceCollection AddServerApplicationServices(this IServiceCollection services)
        {
            // In Memory Datastore Setup
            services.AddSingleton<WeatherDataStore>();
            services.AddSingleton<IDataBroker, ServerDataBroker>();
            AddCommonServices(services);
            return services;
        }

        private static void AddCommonServices(this IServiceCollection services)
        {
            services.AddScoped<IDataConnector, DataConnector>();
            services.AddScoped<WeatherForecastViewService>();
        }
    }
}
```

This extends `IServiceCollection` with some methods to setup the required services for the application.  It keeps all the application specific services in one place.  There are two methods .  We'll look at the `AddWASMApplicationServices` in a later article.

Update `Program.cs` as follows:

```csharp
namespace BlazorDB
{
    public class Program
    {
        public static void Main(string[] args) { }
    }
}
```

*"Microsoft.NET.Sdk.Web* projects must have a `Main`.

Clean up the project file:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Components.Web" Version="5.0.7" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\BlazorDB.Core\BlazorDB.Core.csproj" />
    <ProjectReference Include="..\BlazorDB.Data\BlazorDB.Data.csproj" />
  </ItemGroup>

</Project>
```

### BlazorDB.Web

Remove:
1. The *Shared* folder and contents.
2. *Counter.razor*, *Index.razor* and *Fetchdata.razor* from *Pages* 
3. *App.razor* from the root folder.

Update the `component` type in *_Host.cshtml*.

```html
    <component type="typeof(BlazorDB.UI.App)" render-mode="ServerPrerendered" />
```

Clean up the Project file:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\BlazorDB.Core\BlazorDB.Core.csproj" />
    <ProjectReference Include="..\BlazorDB.Data\BlazorDB.Data.csproj" />
    <ProjectReference Include="..\BlazorDB\BlazorDB.csproj" />
    <ProjectReference Include="..\BlazorDB.UI\BlazorDB.UI.csproj" />
  </ItemGroup>

</Project>
```

### Blazor.UI

Update the `ConfigureServices` method in `Startup` to include the `IServiceCollection` extension method we built in *BlazorDB*.

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddRazorPages();
    services.AddServerSideBlazor();
    services.AddServerApplicationServices();
}
```

### Build the Solution

At this point you should be able to build the solution.

## Wrapping Up

To summarise what we're done:

1. Created testable data and core logic layers for our application.
2. Moved all the UI razor files into the *BlazorDB.UI* project.
4. Created a `ServiceCollectionExtensions` class to manage the application Services.
5. The Web project contains only the static files and the SPA startup server side web page.

The next article looks at:
 - How to take the same approach with the UI, building a set of re-usable generic components.
 - How to configure the solution to run both Server and WASM SPAs side-by-side. 
