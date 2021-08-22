---
title: Chapter 3 - The Business and Application Code
oneliner: The Business and Application Code
precis: The Business and Application Code
date: 2021-08-13
published: 2021-08-13
---

Before we start on the **Core Domain** code, it's important to understand that core code has no dependancies on code in the other project domains.  If you need a dependancy, then:
1. Your cpde doesn't belong in the core 
2. The dependancy needs to move into the core
3. You need to re-design your functionality implementation. 

The "No dependancy on Data or UI Domain projects" rule is sacrosanct!

## Data Connectors

Data Connectors are the data facing interface of the **Core Domain** back box.  Data connectors talk to data brokers.

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

We get passed the registered `IDataBroker` from the Services Container when the class is instanciated by the Services Container.  `GetRecordsAsync` calls `SelectAllRecordsAsync` on the interface.

### Testing

We can test the connector.  Add a `DataConnectorTests` class.

```csharp
// Directory: BlazorDb.Test/Unit
using BlazorDB.Core;
using BlazorDB.Core.Data;
using Moq;
using System.Collections.Generic;
using Xunit;

namespace BlazorDb.Test
{
    public partial class DataConnectorTests
    {

        [Fact]
        public async void DataConnectorShouldGet25WeatherForecastsAsync()
        {
            // define
            var noOfRecords = 25;

            var dataBrokerMock = new Mock<IDataBroker>();
            var dataConnector = new DataConnector(dataBroker: dataBrokerMock.Object);
            dataBrokerMock.Setup(broker =>
                broker.SelectAllRecordsAsync<WeatherForecast>())
               .Returns(WeatherForcastUtils.CreateRandomWeatherForecastListAsync(noOfRecords)
               );

            // test
            var retrievedRecords = await dataConnector.GetRecordsAsync<WeatherForecast>();

            // assert
            Assert.IsType<List<WeatherForecast>>(retrievedRecords);
            Assert.Equal(noOfRecords, retrievedRecords.Count);
            dataBrokerMock.Verify(broker => broker.SelectAllRecordsAsync<WeatherForecast>(), Times.Once);
            dataBrokerMock.VerifyNoOtherCalls();
        }
    }
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

We can now test our ViewService.  Add a `ViewServiceTests` class

```csharp
// Directory: BlazorDb.Test/Unit
using BlazorDB.Core;
using Moq;
using System.Collections.Generic;
using Xunit;

namespace BlazorDb.Test
{
    public class ViewServiceTests
    {

        [Fact]
        public async void ViewShouldGetWeatherForecastsAsync()
        {
            // define
            var noOfRecords = 25;
            var dataConnectorMock = new Mock<IDataConnector>();
            var weatherForecastViewService = new WeatherForecastViewService(dataConnector: dataConnectorMock.Object);
            dataConnectorMock.Setup(item =>
                item.GetRecordsAsync<WeatherForecast>())
               .Returns(WeatherForcastUtils.CreateRandomWeatherForecastListAsync(noOfRecords)
               );
            object eventSender = null;
            weatherForecastViewService.RecordListHasChanged += (sender, e) => { eventSender = sender; };

            // test
            await weatherForecastViewService.GetRecordsAsync();

            // assert
            Assert.IsType<List<WeatherForecast>>(weatherForecastViewService.Records);
            Assert.Equal(noOfRecords, weatherForecastViewService.RecordCount);
            Assert.IsType<List<WeatherForecast>>(eventSender);
            dataConnectorMock.Verify(item => item.GetRecordsAsync<WeatherForecast>(), Times.Once);
            dataConnectorMock.VerifyNoOtherCalls();
        }

    }
}
```

We mock the data connector and do the same set of tests as before.
