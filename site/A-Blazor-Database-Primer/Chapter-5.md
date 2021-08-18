---
title: Chapter 5 - Adding a WASM SPA to the Solution
oneliner: Adding a WASM SPA to the Solution
precis: Adding a WASM SPA to the Solution
date: 2021-08-13
published: 2021-08-13
---

# Chapter 5 - Adding a WASM SPA to the Solution

Developing a Blazor application in Server mode is much easier than in WASM mode.  However, you probably want to deploy your application as a WASM solution.

In this chapter we'll look at how to build and run Server and WASM SPA side-by-side from the same web server/site. 

## Projects

We need to add two new projects to the solution:

1. *BlazorDB.WASM* using the *Blazor WebAssembly App* template.
2. *BlazorDB.Controllers* using the *ASP.NET Core Web App* template.

Clear both projects down to only *program.cs*.

## BlazorDB.Controllers

### Controllers

Add a *Controller* folder to *BlazorDB.Controllers* and a `WeatherForecastController` class.

```csharp
using BlazorDB.Core;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;
using MVC = Microsoft.AspNetCore.Mvc;

namespace BlazorDB.Controllers
{
    [ApiController]
    public class WeatherForecastController : ControllerBase
    {
        protected IDataBroker DataService { get; set; }

        public WeatherForecastController(IDataBroker dataService)
        {
            this.DataService = dataService;
        }

        [MVC.Route("/api/weatherforecast/list")]
        [HttpGet]
        public async Task<List<WeatherForecast>> GetListAsync() => await DataService.SelectAllRecordsAsync<WeatherForecast>();

    }
}
```

### Program.cs

As a web project the project must have a `Main`, so we give it an empty `Main`.

```csharp
namespace BlazorDB.Controllers
{
    public class Program
    {
        public static void Main(string[] args) { }
    }
}
```

### Clean up the Project File

The project file should look like this:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\BlazorDB.Core\BlazorDB.Core.csproj" />
    <ProjectReference Include="..\BlazorDB.Data\BlazorDB.Data.csproj" />
  </ItemGroup>

</Project>
```

## BlazorDB.WASM

The purpose of this project is to build the WASM code and associated configuration and JS files.

### Program.cs

```csharp
using BlazorDB.SPA;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Net.Http;
using System.Threading.Tasks;

namespace BlazorDB.WASM
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebAssemblyHostBuilder.CreateDefault(args);
            builder.RootComponents.Add<BlazorDB.UI.App>("#app");

            builder.Services.AddWASMApplicationServices();
            builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

            await builder.Build().RunAsync();
        }
    }
}
```

1. We set the root component to `BlazorDB.UI.App`.  This is the same `App` as used by the Server project'
2. We add the services defined in the *BlazorDB* `ServiceCollectionExtensions`.
3. We add a `HttpClient` service to make API calls.

### Clean up the Project File

The project file should look like this:

```xml
<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">

  <PropertyGroup>
    <StaticWebAssetBasePath>wasm</StaticWebAssetBasePath>
    <TargetFramework>net5.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly" Version="5.0.9" />
    <PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly.DevServer" Version="5.0.9" PrivateAssets="all" />
    <PackageReference Include="System.Net.Http.Json" Version="5.0.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\BlazorDB.UI\BlazorDB.UI.csproj" />
    <ProjectReference Include="..\BlazorDB\BlazorDB.csproj" />
  </ItemGroup>

</Project>
```

The `<StaticWebAssetBasePath>` is important for the startup page to access the WASM code files.

## BlazorDB.Data

We need to add a new data broker to handle API requests from the WASM SPA.

### APIDataBroker

Add a `APIDataBroker` class to the *Brokers* folder.

```csharp
using BlazorDB.Core;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace BlazorDB.Data
{
    public class APIDataBroker : DataBroker, IDataBroker
    {
        protected HttpClient HttpClient { get; set; }

        public APIDataBroker(HttpClient httpClient)
            => this.HttpClient = httpClient;

        public override async ValueTask<List<TRecord>> SelectAllRecordsAsync<TRecord>()
            => await this.HttpClient.GetFromJsonAsync<List<TRecord>>($"/api/{GetRecordName<TRecord>()}/list");

        protected string GetRecordName<TRecord>() where TRecord : class, IRecord, new()
            => new TRecord().GetType().Name;

    }
}
```

This is a generic data broker.  As long as we stick to naming convertions - controllers with a path *API/DataClassName/xxx*.  
1. `GetRecordName` gets the record class name.
2. The service gets the `HttpClient` registered in the Services container.

## BlazorDB

### ServiceCollectionExtensions

Update `AddWASMApplicationServices` to include adding the `APIDataBroker` as the `IDataBroker` service.

```csharp
    public static IServiceCollection AddWASMApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IDataBroker, APIDataBroker>();
        AddCommonServices(services);
        return services;
    }
```

## BlazorDB.UI

Add an additional `@page` definition for each *RouteView*.  This is so the pages are accessible to both Server and WASM SPA's.

Index.razor
```html
@page "/"
@page "/wasm/"
```
Counter.razor
```html
@page "/counter"
@page "/wasm/counter"
```
FetchData.razor
```html
@page "/fetchdata"
@page "/wasm/fetchdata"
```

## BlazorDB.Web

### _WASM.cshtml

Add a *_WASM.cshtml* file to the *Pages* folder.  This is the launch page for the WASM SPA.

```html
@page "/wasm"
@namespace BlazorDB.Web.Pages
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
@{
    Layout = null;
}

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BlazorDB.WASM</title>
    <base href="/wasm/" />
    <link rel="stylesheet" href="css/bootstrap/bootstrap.min.css" />
    <link href="css/site.css" rel="stylesheet" />
    <link href="BlazorDB.Web.styles.css" rel="stylesheet" />
</head>
<body>
    <div id="app">Loading...</div>

    <div id="blazor-error-ui">
        An unhandled error has occurred.
        <a href="" class="reload">Reload</a>
        <a class="dismiss">🗙</a>
    </div>
    <script src="/wasm/_framework/blazor.webassembly.js"></script>
</body>
</html>
```

### Startup

`Startup` is where the magic exists to make the two SPA's run together.

In `ConfigureServices` we add the Controllers, specifying where to find the controllers. 

```csharp
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddRazorPages();
        services.AddServerSideBlazor();
        services.AddServerApplicationServices();
        services.AddControllers().PartManager.ApplicationParts.Add(new AssemblyPart(typeof(BlazorDB.Controllers.Program).Assembly));
    }
```
In `Configure` we add a new middleware section based on mapping.  All URLs to */wasm* get mapped to *_WASM.cshtml*

```csharp
    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }
        else
        {
            app.UseExceptionHandler("/Error");
            // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseStaticFiles();

        app.MapWhen(ctx => ctx.Request.Path.StartsWithSegments("/wasm"), app1 =>
        {
            app1.UseBlazorFrameworkFiles("/wasm");
            app1.UseRouting();
            app1.UseEndpoints(endpoints =>
            {
                endpoints.MapFallbackToPage("/wasm/{*path:nonfile}", "/_WASM");
            });

        });

        app.UseRouting();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapBlazorHub();
            endpoints.MapFallbackToPage("/_Host");
        });
    }
```


NEED TO ADD NAVMENU  AND LAYOUT CHANGES