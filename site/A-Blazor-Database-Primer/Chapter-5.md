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

1. *Blazr.Primer.WASM* using the *Blazor WebAssembly App* template.
2. *Blazr.Primer.Controllers* using the *ASP.NET Core Web App* template.

Clear both projects down to only *program.cs*.

## Blazr.Primer.Controllers

This project holds the API controllers.  It uses the `Microsoft.NET.Sdk.Web` Framework to implement controllers.

Remove everything but *Program.cs*.

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\Blazr.Primer.Core\Blazr.Primer.Core.csproj" />
  </ItemGroup>

</Project>
```

As we only have a single data class, we implement a single controller `WeatherForecastController`.

### Controllers

Add `WeatherForecastController` to *Blazr.Primer.Controllers/Controllers*.

The controller constructor defines a `IDataBroker` argument.

```csharp
using Blazr.Primer.Core;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;
using MVC = Microsoft.AspNetCore.Mvc;

namespace Blazr.Primer.Controllers
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

A web project must have a `Main`.  It's not used, so we define an empty one.

```csharp
namespace Blazr.Primer.Controllers
{
    public class Program
    {
        public static void Main(string[] args) { }
    }
}
```
## BlazorDB.Data

We need a new data broker to handle API requests from the WASM SPA.  This is where our design starts to come into play.  The new `APIDataBroker` simply replaces the `ServerDataBroker` in the WASM SPA Services Container.  The `DataConnector` doesn't need to know that the dat broker has changed.  It simply gets handed a class that implements `IDataBroker` and has a `SelectAllRecordsAsync<TRecord>()` method it can call. 

The diagram below shows the Services setup for the two versions of the SPA.

![WASM Page Filesystem](/siteimages/Articles/DB-Primer/SPA-Services.png)


### APIDataBroker

Add an `APIDataBroker` class to the *Brokers* folder.

```csharp
using Blazr.Primer.Core;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace Blazr.Primer.Data
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

This is a generic data broker.  As long as we stick to naming convertions - controllers with a path *API/DataClassName/xxx* - we can use boilerplate code.  
1. `GetRecordName` gets the record class name.
2. The service gets the `HttpClient` registered in the Services container.

## Blazr.Primer

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

## BlazorDB.WASM

This project builds the WASM code and associated configuration and JS files.

Remove except *program.cs*.

### Project file

```xml
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
    <ProjectReference Include="..\Blazr.Primer.UI\Blazr.Primer.UI.csproj" />
    <ProjectReference Include="..\Blazr.Primer\Blazr.Primer.csproj" />
  </ItemGroup>

</Project>
```

### Program.cs

```csharp
using Blazr.Primer.SPA;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Net.Http;
using System.Threading.Tasks;

namespace Blazr.Primer.WASM
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebAssemblyHostBuilder.CreateDefault(args);
            builder.RootComponents.Add<Blazr.Primer.UI.Components.App>("#app");

            builder.Services.AddWASMApplicationServices();
            builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

            await builder.Build().RunAsync();
        }
    }
}
```

1. Sets the root component to `Blazr.Primer.UI.App` - the same `App` as used by the Server project.
2. Adds the services defined in the *BlazorDB* `ServiceCollectionExtensions`.
3. Adds a `HttpClient` service to make API calls.

### Project File

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
    <ProjectReference Include="..\Blazr.Primer.UI\Blazr.Primer.UI.csproj" />
    <ProjectReference Include="..\Blazr.Primer\Blazr.Primer.csproj" />
  </ItemGroup>

</Project>
```

How does this work?  There's no code?

The all important bit is the definition of the root component in `Main`.  This creates the dependancy links so all the necessary project DLLs get compiled into the WASM code base.

`<StaticWebAssetBasePath>` sets the subdirectory the WASM code base is available through in the compiled code.  The image below shows the browser Filesystem for the running WASM SPA.

![WASM Page Filesystem](/siteimages/Articles/DB-Primer/Wasm-Page-Filesystem.png)

## BlazorDB.UI

Add additional `@page` definitions for each *RouteView*.

Index.razor
```html
@page "/"
@page "/index"
@page "/wasm/index"
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

### MainLayout

Update `MainLayout`.

```html
@inherits LayoutComponentBase
@namespace Blazr.Primer.UI.Components

<div class="page">
    <div class="@_sidebarCss">
        <NavMenu />
    </div>

    <div class="main">
        <div class="top-row px-4">
            <a href="https://docs.microsoft.com/aspnet/" target="_blank">About</a>
        </div>

        <div class="content px-4">
            @Body
        </div>
    </div>
</div>
```
```csharp
@code 
{
    [Inject] NavigationManager NavManager { get; set; }
    private bool _isWasm => NavManager?.Uri.Contains("wasm", StringComparison.CurrentCultureIgnoreCase) ?? false;
    private string _sidebarCss => _isWasm ? "sidebar sidebar-teal" : "sidebar sidebar-steel";
}
```
And MainLayout.razor.css

```css
.... /*line 10*/
.sidebar {
    background-image: linear-gradient(180deg, rgb(5, 39, 103) 0%, #3a0647 70%);
}

/* Added Styles*/
.sidebar-teal {
    background-image: linear-gradient(180deg, rgb(0, 64, 128) 0%, rgb(0,96,192) 70%);
}

.sidebar-steel {
    background-image: linear-gradient(180deg, #2a3f4f 0%, #446680 70%);
}
/* End Added Styles*/
.....
```

The component checks the URL and if it contains "wasm" it changes the sidebar colour.

## NavMenu

Update `NavMenu`

```html
@namespace Blazr.Primer.UI.Components

<div class="top-row pl-4 navbar navbar-dark">
    @*Change title*@
    <a class="navbar-brand" href="">@_title</a>
    <button class="navbar-toggler" @onclick="ToggleNavMenu">
        <span class="navbar-toggler-icon"></span>
    </button>
</div>

<div class="@NavMenuCssClass" @onclick="ToggleNavMenu">
    <ul class="nav flex-column">
        @*Add links bewteen contexts*@
        <li class="nav-item px-3">
            <NavLink class="nav-link" href="@_otherContextUrl" Match="NavLinkMatch.All">
                <span class="oi oi-home" aria-hidden="true"></span> @_otherContextLinkName
            </NavLink>
        </li>
        <li class="nav-item px-3">
            <NavLink class="nav-link" href="" Match="NavLinkMatch.All">
                <span class="oi oi-home" aria-hidden="true"></span> Home
            </NavLink>
        </li>
        <li class="nav-item px-3">
            <NavLink class="nav-link" href="counter">
                <span class="oi oi-plus" aria-hidden="true"></span> Counter
            </NavLink>
        </li>
        <li class="nav-item px-3">
            <NavLink class="nav-link" href="fetchdata">
                <span class="oi oi-list-rich" aria-hidden="true"></span> Fetch data
            </NavLink>
        </li>
        <li class="nav-item px-3">
            <NavLink class="nav-link" href="weatherforecasts">
                <span class="oi oi-list-rich" aria-hidden="true"></span> WeatherForecasts
            </NavLink>
        </li>
    </ul>
</div>
```
```csharp
@code {

    [Inject] NavigationManager NavManager { get; set; }

    private bool _isWasm => NavManager?.Uri.Contains("wasm", StringComparison.CurrentCultureIgnoreCase) ?? false;

    private string _otherContextUrl => _isWasm ? "/" : "/wasm";

    private string _otherContextLinkName => _isWasm ? "Server Home" : "WASM Home";

    private string _title => _isWasm ? "BlazorDB WASM" : "BlazorDB Server";

    private bool collapseNavMenu = true;

    private string NavMenuCssClass => collapseNavMenu ? "collapse" : null;

    private void ToggleNavMenu()
    {
        collapseNavMenu = !collapseNavMenu;
    }
}
```

The component uses the URL to set the correct title and navigation options for WASM or Server mode.


## BlazorDB.Web

### Project File

The project file should look like this:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly.Server" Version="5.0.9" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\Blazr.Primer.Controllers\Blazr.Primer.Controllers.csproj" />
    <ProjectReference Include="..\Blazr.Primer.Core\Blazr.Primer.Core.csproj" />
    <ProjectReference Include="..\Blazr.Primer.Data\Blazr.Primer.Data.csproj" />
    <ProjectReference Include="..\Blazr.Primer.WASM\Blazr.Primer.WASM.csproj" />
    <ProjectReference Include="..\Blazr.Primer\Blazr.Primer.csproj" />
    <ProjectReference Include="..\Blazr.Primer.UI\Blazr.Primer.UI.csproj" />
  </ItemGroup>

</Project>
```

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
    <link rel="stylesheet" href="/css/bootstrap/bootstrap.min.css" />
    <link href="/css/site.css" rel="stylesheet" />
    <link href="/BlazorDB.Web.styles.css" rel="stylesheet" />
</head>
<body>

<div id="app">
        <div class="mt-4" style="margin-right:auto; margin-left:auto; width:100%;">
            <div class="loader"></div>
            <div style="width:100%; text-align:center;"><h4>Web Application Loading</h4></div>
        </div>
    </div>

    <div id="blazor-error-ui">
        An unhandled error has occurred.
        <a href="" class="reload">Reload</a>
        <a class="dismiss">🗙</a>
    </div>
    <script src="/wasm/_framework/blazor.webassembly.js"></script>
</body>
</html>
```

### Site.css

Add the following css to *Blazr.Primer.Web/wwwroot/css/site.css*.  It formats the Css in `<div id="app">` to give a pretty spinner.

```css
.page-loader {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 1;
    width: 150px;
    height: 150px;
    margin: -75px 0 0 -75px;
    border: 16px solid #f3f3f3;
    border-radius: 50%;
    border-top: 16px solid #3498db;
    width: 120px;
    height: 120px;
    -webkit-animation: spin 2s linear infinite;
    animation: spin 2s linear infinite;
}

.loader {
    border: 16px solid #f3f3f3;
    /* Light grey */
    border-top: 16px solid #3498db;
    /* Blue */
    border-radius: 50%;
    width: 120px;
    height: 120px;
    animation: spin 2s linear infinite;
    margin-left: auto;
    margin-right: auto;
}

@-webkit-keyframes spin {
    0% {
        -webkit-transform: rotate(0deg);
    }
    100% {
        -webkit-transform: rotate(360deg);
    }
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
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
            endpoints.MapControllers();
            endpoints.MapBlazorHub();
            endpoints.MapFallbackToPage("/_Host");
        });
    }
```

## How does all this Work?

Lets look at some scenarios to understand what's going on.

### Browsing to the Site - https://mysite.com/

`Startup.Config` runs and uses the default endpoint mapping which maps a fallback page */_Host* i.e. *_Host.cshtml*.  This is the Blazor Server startup page so the Blazor Server SPA starts.

### Browsing directly to the WASM Site - https://mysite.com/wasm

`Startup.Config` runs and uses the WASM endpoint mapping as the URL matches `Request.Path.StartsWithSegments("/wasm")`.  This maps to a fallback page */_WASM* i.e. *_WASM.cshtml*.  This is the Blazor WASM startup page so the Blazor WASM SPA starts.

### Clicking on the WASM link in the Server SPA - https://mysite.com/wasm

The server `Router` doesn't recognise the route so it forces a browser page load for the URL.  This is now the same as *Browsing directly to the WASM Site* above.

### Browsing directly to https://mysite.com/counter

`Startup.Config` runs and uses the default endpoint mapping which maps a fallback page */_Host* i.e. *_Host.cshtml*.  ..... as above.

### Browsing directly to https://mysite.com/wasm/counter

`Startup.Config` runs and uses the WASM endpoint mapping as the URL matches `Request.Path.StartsWithSegments("/wasm")`.  This maps to a fallback page */_WASM* i.e. *_WASM.cshtml*.  ..... as above.

### Clicking a link within the Server SPA to Counter - https://mysite.com/counter

The server `Router` recognises the route and loads the appropriate RouteView component.  No page loading takes place.

### Clicking a link within the WASM SPA to Counter - https://mysite.com/counter

The server `Router` recognises the route and loads the appropriate RouteView component.  No page loading takes place.










