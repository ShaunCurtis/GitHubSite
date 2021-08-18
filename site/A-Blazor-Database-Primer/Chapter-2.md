---
title: Chapter 2 - The Data Store and Data Classes
oneliner: The Data Store and Data Classes
precis: The Data Store and Data Classes
date: 2021-08-13
published: 2021-08-13
---
# Chapter 2 - The Data Store and Data Classes

Data is retrieved from the data store into data classes.  To add structure to our application we are going to apply some rules:

1. All data classes need to a `IRecord` interface we will define.  This will define some properties all data classes must implement.  We will also use this interface in our generic classes and methods.
2. All Data classes will be immutable and there implemented as `records`.
3. All data classes and their data store datasets will use the same names.  Again we'll use this convention in our generic methods.

Which domain do our data classes belong?  

The initial answer is obviously Data.  However, the moment you start to write some application logic code, you will need to use a data class.  Core can't depend on Data, so data classes live in the Core Domain.  I'll discuss more complex examples in a later chapter where we have multiple data classes representing the same data set and where those live.

## IRecord

Add a public interface to *BlazorDB.Core/Interfaces* called `IRecord`.

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

All dataclasses implement this interface.  They must have:
1. An `ID` field of type `Guid`.
2. A `Name` field of type `string`.


## The WeatherForecast Data Classes

Move `WeatherForecast` from *BlazorDB/data* to *BlazorDB.Core/DataClasses*.

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

## The Data Store

To get started, We're building an in-memory data store that "mimics" a Entity Framework context.  We'll look at a real SQL implementation using Entity Framework in a later chapter.

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

Most of the code is self evident, but `GetDataSet` uses some advanced programming techniques using `Reflection` so we'll look at it in detail:

```csharp
public ValueTask<List<TRecord>> GetDataSet<TRecord>() where TRecord : class, IRecord, new()
```
The declaration uses generics.  We define that `TRecord` must:
1. Be a class (or record).
2. Must implement `IRecord`.
3. Must implement and empty constructor.

Normal database operations as asynchronous, so we wrap the code in a `ValueTask` and we return a "dataset", which in this case is a  `List` of `TRecords`.

Let's look at a real call into the data store:

```csharp
var dbset = await dataStore.GetDataSet<WeatherForecast>();
```

`new TRecord()` constructs a new copy of `WeatherForecast`. `.GetType().Name` gets the class name.  In our case `WeatherForecast`.

```csharp
var dbSetName = new TRecord().GetType().Name;
```

`this.GetType().GetProperty(dbSetName)` gets the datastore `Type` and then gets the `PropertyInfo` object with the name we retrieved above, in our case `WeatherForecast`.

```csharp
var pinfo = this.GetType().GetProperty(dbSetName);
```

Finally we get the value of `pinfo` for this instance of the data store.  `GetValue` returns an `object`, so we cast it to what we know it is a `List` of `TRecord`.

```csharp
dbSet = (List<TRecord>)pinfo.GetValue(this);
```

## Data Brokers

Data Brokers are the external interface for the **Data Domain** black box.  The **Core Domain** uses brokers to make calls into the **Data Domain**.  They're often known as *shims*, skinny one line method classes.  While the data brokers themselves reside in the **Data Domain**, the interface is used by the **Core Domain** and thus resides there.

### IDataBroker

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

Normally this would implement a full set of CRUD methods, but at the moment we're only doing the List operation, so define a single method `SelectAllRecordsAsync`.

It's:
1. Generic using `TRecord` which has constraints - it must be a class (or record), implement `IRecord` and have an empty constructor.
2. Returns a `ValueTask`, so can be async.  Almost all database operations are async, so we start out implementing the broker using Task based methods.
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

