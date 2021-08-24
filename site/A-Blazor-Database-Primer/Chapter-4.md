---
title: Chapter 4 - Setting up the Solution to Run
oneliner: Setting up the Solution to Run
precis: Setting up the Solution to Run
date: 2021-08-13
published: 2021-08-13
---

# Chapter 4 - Setting up the Solution to Run

At this point we're ready to re-build the projects and run the solution.

## Refactoring the Solution

### Blazr.Primer.UI

### App

Update the `Router` line in *App.razor*

```html
<Router AppAssembly="@typeof(App).Assembly" PreferExactMatches="@true">
  .....
</Router>
```
This points the Router to use `App`'s Assembly as `AppAssembly` (where the router looks for classes with Route attributes).

### Blazr.Primer

Add a `ServiceCollectionExtensions` class.

```csharp
// Directory Blazr.Primer/Extensions
using Blazr.Primer.Core;
using Blazr.Primer.Data;
using Microsoft.Extensions.DependencyInjection;

namespace Blazr.Primer.SPA
{
    public static class ServiceCollectionExtensions
    {
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

This extends `IServiceCollection` with some methods to setup the required services for the application.  It keeps all the application specific services in one place.  There are two methods.

### BlazorDB.Web

Update the `component` type in *_Host.cshtml*.

```html
    <component type="typeof(Blazr.Primer.UI.App)" render-mode="ServerPrerendered" />
```

Update the `ConfigureServices` method in `Startup` to include the `IServiceCollection` extension method we built in *BlazorDB*.

```csharp
using Blazr.Primer.SPA;

.....

public void ConfigureServices(IServiceCollection services)
{
    services.AddRazorPages();
    services.AddServerSideBlazor();
    services.AddServerApplicationServices();
}
```

### BlazorDB.Ui

Update `FetchData` in *Blazr.Primer.Ui/RouteViews*.

```html
@page "/fetchdata"
@using Blazr.Primer.Core
@namespace Blazr.Primer.UI.RouteViews

<h1>Weather forecast</h1>

<p>This component demonstrates fetching data from a service.</p>

@if (!ViewService.HasRecords)
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
            @foreach (var forecast in ViewService.Records)
            {
                <tr>
                    <td>@forecast.Date.ToShortDateString()</td>
                    <td>@forecast.TemperatureC</td>
                    <td>@forecast.TemperatureF</td>
                    <td>@forecast.Summary</td>
                </tr>
            }
        </tbody>
    </table>
}

@code {
    [Inject] WeatherForecastViewService ViewService { get; set; }

    protected override async Task OnInitializedAsync()
    {
        await ViewService.GetRecordsAsync();
    }
}
```
### Build the Solution

At this point you should be able to build and run the solution.
