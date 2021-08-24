---
title: Chapter 3 - The Business and Application Code
oneliner: The Business and Application Code
precis: The Business and Application Code
date: 2021-08-13
published: 2021-08-13
---

# Chapter 3 - The Business and Application Code

Before writing **Core Domain** code, it's important to understand one overriding principle - Core code has no dependancies on the other project domains.  If you need a dependancy:
1. Your code doesn't belong in the core.
2. The dependancy needs to move into the core.
3. You need to re-design your functionality implementation. 

The "No dependancy" rule is sacrosanct!

## Data Connectors

Data Connectors are the data facing interface of the **Core Domain** black box.  Data connectors talk to data brokers.

### IDataConnector

All data connectors implement  the `IDataConnector` interface.

```csharp
\\ directory: Blazr.Primer.Core\Interfaces
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Blazr.Primer.Core
{
    public interface IDataConnector
    {
        public ValueTask<List<TRecord>> GetRecordsAsync<TRecord>() where TRecord : class, IRecord, new();
    }
}
```
### DataConnector

`DataConnector` implements `IDataConnector`.  It takes an `IDataBroker` and calls methods on `IDataBroker` to get/post it's data.

```csharp
\\ directory: Blazr.Primer.Core\Connectors
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Blazr.Primer.Core
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
Each method uses generics, so there is no need for specific data connectors for each data class.  To get the `WeatherForecast` record dataset call:

```csharp
var records = GetRecordsAsync<WeatherForecast>();
```

### Testing

Add a `DataConnectorTests` class.

```csharp
// Directory: Blazr.Primer.Test/Unit
using Blazr.Primer.Core;
using Moq;
using System.Collections.Generic;
using Xunit;

namespace Blazr.Primer.Test
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
               .Returns(WeatherForecastHelper.CreateRandomWeatherForecastListAsync(noOfRecords)
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
3. Verifies the `IDataBroker` method `SelectAllRecordsAsync` was called only once.
4. Verifies no other method was called on `IDataBroker`.

## View Services

View Services are the basic building blocks for the Application/Business logic.

### IViewService

Add an `IViewService` interface to *Blazr.Primer.Core/Interfaces*

```csharp
using Blazorr.Primer.Core;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Blazr.Primer.Core
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

Add a `ViewService` class to *Blazr.Primer.Core/ViewServices*.  This is the base implementation.

The code is self evident.  `RecordListHasChanged` is triggered when the `Records` property is updated.

```csharp
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Blazr.Primer.Core
{
    public class ViewService<TRecord> :
        IViewService<TRecord>,
        IDisposable
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

        public bool HasRecordList => Records is not null;

        public bool HasRecords => this.RecordCount > 0;

        public int RecordCount => this.Records?.Count ?? 0;

        private List<TRecord> _records;

        public event EventHandler RecordListHasChanged;

        public ViewService(IDataConnector dataConnector)
            =>  this.dataConnector = dataConnector;

        public async ValueTask GetRecordsAsync()
            =>  Records = await dataConnector.GetRecordsAsync<TRecord>();

        public void Dispose() { }
    }
}
```

### WeatherForecastViewService

Finally we add a concrete implementation of the View Service for the `WeatherForecast` record.

```csharp
namespace Blazr.Primer.Core
{
    public class WeatherForecastViewService : ViewService<WeatherForecast>
    {
        public WeatherForecastViewService(IDataConnector dataConnector) : base(dataConnector) { }
    }
}
```

This is minimlistic, just setting `IRecord` as `WeatherForecast`.

### Testing

Add a `ViewServiceTests` class

```csharp
// Directory: Blazr.Primer.Test/Unit
using Blazr.Primer.Core;
using Moq;
using System;
using System.Collections.Generic;
using Xunit;

namespace Blazr.Primer.Test
{
    public class ViewServiceTests
    {
        [Fact]
        public async void ViewShouldGetWeatherForecastsAsync()
        {
            // define
            var rand = new Random();
            var noOfRecords = rand.Next(25, 250);
            var dataConnectorMock = new Mock<IDataConnector>();
            var weatherForecastViewService = new WeatherForecastViewService(dataConnector: dataConnectorMock.Object);
            //TODO - need to add paging and count returns
            dataConnectorMock.Setup(item =>
                item.GetRecordsAsync<WeatherForecast>())
               .Returns(WeatherForecastHelper.CreateRandomWeatherForecastListAsync(noOfRecords)
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
This test uses `Mock` to mock the IDataConnector so we can monitor calls into the interface.  The test:
1. Checks the type of the return is `List<WeatherForecast>`.
2. Checks we have 25 records - what was created in the mock.
3. Checks the event returns a `List<WeatherForecast>`.
4. Verifies the `IDataConnector` method `GetRecordsAsync` was called only once.
5. Verifies no other method was called on `IDataConnector`.

## System Testing

We can now do an end to end test on our data stream.

Add a `SystemTests` class

```csharp
// Directory: Blazr.Primer.Test/System
using Blazr.Primer.Core;
using Blazr.Primer.Data;
using System;
using System.Collections.Generic;
using Xunit;

namespace Blazr.Primer.Test
{
    public class SystemTests
    {
        [Fact]
        public async void ViewShouldGet50WeatherForecastsAsync()
        {
            // define
            var rand = new Random();
            var noOfRecords = rand.Next(25, 250);
            var records = await WeatherForecastHelper.CreateRandomWeatherForecastListAsync(noOfRecords);
            var weatherForecastDataStore = new WeatherDataStore();
            weatherForecastDataStore.OverrideWeatherForecastDateSet(records);
            var dataBroker = new ServerDataBroker(weatherForecastDataStore: weatherForecastDataStore);
            var dataConnector = new DataConnector(dataBroker: dataBroker);
            var weatherForecastViewService = new WeatherForecastViewService(dataConnector: dataConnector);
            object eventSender = null;
            weatherForecastViewService.RecordListHasChanged += (sender, e) => { eventSender = sender; };

            // test
            await weatherForecastViewService.GetRecordsAsync();

            // assert
            Assert.IsType<List<WeatherForecast>>(weatherForecastViewService.Records);
            Assert.Equal(noOfRecords, weatherForecastViewService.RecordCount);
            Assert.IsType<List<WeatherForecast>>(eventSender);
        }
    }
}
```
The test:
1. Builds a random data set.
2. Checks the type of the return is `List<WeatherForecast>`.
3. Checks we have `noOfRecords` records - what was created.
4. Checks the event returns a `List<WeatherForecast>`.
5. Verifies We have the correct number of records.
6. Verifies RecordListHasChanged was called and returned a `List<WeatherForecast>`.


