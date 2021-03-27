---
title: A Blazor Database Template - Project Structure and Framework
oneliner: This article describes the Structire and Framework for Blazor Database Template.
precis: This article is the first in a series describing a Blazor Database Template using the Weather Forecast theme of the base Blazor Template.
date: 2021-03-27
published: 2020-10-01
---

# Building a Database Application in Blazor 
# Part 1 - Project Structure and Framework

::: danger
This article and all the others in this series is a building site.  Total revamp.  See CodeProject for the most recent released version which is very out-of-date
:::

This set of articles describes a framework for building and structuring Database Applications in Blazor.

It is **A** framework, not **THE** framework.  I make no recommendations, use it or abuse it.  I've used it on my last two projects, an Animal Feeds tracking and Delivery/Invoicing system and a Club Membership system.  The framework is lightly opinionated: it uses out-of-the-box Blazor/Razor/DotNetCore systems and toolkits and lightly modified BootStrap. 
 
There are 6 articles:

1. Project Structure and Framework.
2. Services - Building the CRUD Data Layers.
3. View Components - CRUD Edit and View Operations in the UI.
4. UI Components - Building HTML/CSS Controls.
5. View Components - CRUD List Operations in the UI.
6. A walk through detailing how to add weather stations and weather station data to the application.

The articles have changed drastically from their original release:

1. The whole framework is significantly less opinionated.  I've moved back from some of the more radical approaches I was advocating.
2. The libraries have major code updates, particularly in the Data Services.
2. Everything has been updated to Net5.
3. The Repo home has moved.
5. Server and WASM SPAs are now hosted and run from the same site.
   
They are not:
1. An attempt to define best practice.
2. The finished product.

This first articles proves an overview and a study of the Framework.

## Repository and Database

The repository for the articles has moved to [CEC.Blazor.SPA Repository](https://github.com/ShaunCurtis/CEC.Blazor.SPA).  [CEC.Blazor GitHub Repository](https://github.com/ShaunCurtis/CEC.Blazor) is now obselete and will be removed.

There's a SQL script in /SQL in the repository for building the database.

The Server and WASM versions of the site have been combined into a single site.  You can switch between the two in the left hand menu.  The site starts in Server mode - [https://cec-blazor-server.azurewebsites.net/](https://cec-blazor-server.azurewebsites.net/).  The WASM server site exists for bebugging WASM code only.

Serveral classes described here are part of the separate *CEC.Blazor.Core* library.  The Github is [here](https://github.com/ShaunCurtis/CEC.Blazor.Core), and is available as a Nuget Package.

## Design Philosophy

### Data

The data side of the project is structured fairly conventionally, loosely based on the three tier - data, logical and presentation layer - model.

The data layers implement standard CRUDL - Create/Read/Update/Delete/List - actions against database entities.

The application library contains two `DbContext` classes:

1. `LocalWeatherDbContext` uses a standard SQL database with a connection string defined in `AppSettings`.
2. `InMemoryWeatherDbContext` uses an In-Memory SQLite database for testing and demo purposes.

Services for `DbContext` classes are created using `AddDBContextFactory` and injected into or captured by consuming classes through the `IDbContextFactory<TDbContext>` interface.

The base data layer is defined by a `IFactoryDataService` interface.  `FactoryDataService` is an abstract level implementation of `IFactoryDataService`.  There are three data services that implement most of the boilerplate code:

1. `FactoryServerDataService` for normal SQL databases.  It's all `Async` and uses `IDbContextFactory` to generate `DbContext` instances for each transaction.
2. `FactoryServerInMemoryDataService`.  A SQLite In-Memory database only exists within a single `DbContext`, so this data service creates a single `DbContext` instance at startup and uses it for all transactions.
3. `FactoryWASMDataService` for WASM SPAs.  This data service makes remote API calls to the API server.

To demonstrate the degree to which the case can be boilerplated, the declaration of the Local Database Data Service is:

```csharp
public class LocalDatabaseDataService : FactoryServerDataService<LocalWeatherDbContext>
{
    public LocalDatabaseDataService(IConfiguration configuration, IDbContextFactory<LocalWeatherDbContext> dbContext) : base(configuration, dbContext) {}
}
```

and the Controller Service for the WeatherForecast:

```csharp
public class WeatherForecastControllerService : FactoryControllerService<WeatherForecast>
{
    public WeatherForecastControllerService(IFactoryDataService factoryDataService) : base(factoryDataService) { }
}
```


We'll examine these in detail in articles two and three, along with the specific implementations for the Weather application.

The UI Interface layer is defined by `IFactoryControllerService` with a base abstract implementation in `FactoryControllerService`.  Again we'll look at these in detail in articles two and three.

The data services are accessed using dependency injection, either directly or through their interfaces.

### UI

I step away from the basic *Pages* philosophy - there are no *Pages* directories except in the *Web* project.  SPAs aren't web sites.  We need step outside the webpage paradigm.  The Blazor UI is a component based; to think of it as a web page perpetuates the paradigm.  The only web page is the launch page on the server.  Once the SPA launches, the application changes out components to transition between Views.  I've built an SPA without a router and no Urls in sight.

I'll use the following terminology thoughout these articles:
1. Page - the launch web page on the web site.  The only page in an SPA.
2. RouteView/Routed Component.  These are all terms used by various people describing the pseudo page.  I call these RouteViews.  This is the content displayed in the content section of a Layout, and normally determined by a defined route.  We'll look at these in a little more detail later in this article.
3. Forms.  Forms are logical collections of controls that are either displayed in a view or a modal dialog.  Lists, view forms, edit forms are all classic forms. Forms contain controls not HTML.
4. Controls.  Controls are components that display something: they emit HTML code.  For example, an edit box, a dropdown, button, ... A Form is a collection of controls.

The application is configured to build and deploy both Server or WASM versions of the SPA, and host both on the same web site.  The base solution architecture is:

1. Core Razor Library - contains the code that can be deployed to any application.  These could be built and deployed as a Nuget Package.
2. Application Razor Library - contains the specific code for the application shared by the Server and WASM projects.
3. Server Razor Library - secific code for the Server SPA.  Principly the Views/Routed Components and startup App.  This project should contain very little code.
4. WASM Web Project - specific code to build the WASM SPA. Again, principly the Views/Routed Components and startup App.  This project should contain very little code.
5. ASPNetCore Razor Web Project.  The host project that contains the startup pages for the WASM and Server SPAs, the services for the Blazor Server Hub and the server-side API Controllers for the WASM SPA.

## Solution Structure

I use Visual Studio, so the Github repository consists of a solution with five projects.  These are:

1. Blazor.SPA - the core library containing everything that can be boilerplated and reused across any project.
2. Blazor.Database - this is the library shared by both the Server and WASM projests.  Almost all the project code lives here.  Examples are the EF DB Context, Model classes, model specific CRUD components, Bootstrap SCSS, Views, Forms, ...
3. Blazor.DataBase.Server - the combined Server Library project.
4. Blazor.Database.WASM - the WASM Client project.
5. Blazor.Database.Web - The host ASPNetCore server.

## UI Structure

The application uses a structure approach to the UI.  This makes it easier to stop repeating the same old Razor/Html markup across an application, build re-usable components and move code from the application into libraries.

### Pages

Pages are the web pages that act as the host for the the application.  There's one per application.

### RouteViews

RouteViews are the components loaded into the root `App` component, normally by the Router through a Layout.  They don't have to be.  You can write your own View Manager, and you don't have to use Layouts.  The only two requirements for a View are:

1. It must be declared as a razor component.
2. It must declare one or more routes using the `@page` directive.

In the WASM application the `Counter` view is declared as shown below.  Very minimalist, because we want to share the actual counter code between the applications, so it becomes a *Form* in the shared library.  It just contains the route declaration and the top level form component.

```html
@page "/counter"
<CounterComponent></CounterComponent>
``` 

The purpose of the RouteView is to declare routes that the `Router` component can find when the SPA starts.  The root component `App` is shown below which declares the `Router` component.  `AppAssembly="@typeof(WASMApp).Assembly"` points the router to the assembly it browses to find route declarations.  In this case it's pointed to assembly containing the root component.

```html
<Router AppAssembly="@typeof(WASMApp).Assembly" PreferExactMatches="@true">
    <Found Context="routeData">
        <RouteView RouteData="@routeData" DefaultLayout="@typeof(WASMLayout)" />
    </Found>
    <NotFound>
        <LayoutView Layout="@typeof(WASMLayout)">
            <p>Sorry, there's nothing at this address.</p>
        </LayoutView>
    </NotFound>
</Router>
```

Note that `Router` calls them RouteViews which is why I call them that.

### Layouts

Layouts are out-of-the-box Blazor Layouts.  The Router renders the Layout with the `RouteView` as the child content.  There's a default `Layout` defined in the `Router` definition.  I'll skip layouts here, we've had them for a long while and they are adequately covered elsewhere.

### Forms

A form is a mid level unit in the component hierarchy.  RouteViews can contain one or more forms
. Forms are logical collections of controls that are either displayed in a view or a modal dialog.  Lists, view forms, edit forms are all classic forms. Forms contain controls not Html.

### Controls

A control is the low level component.  It's where the Html code is built.  Controls can contain other controls to build more complex controls.

How often do you repeat the same Html code in a Razor component.  What you do in Razor you wouldn't dream of doing in C# code.  You'd write a helper method.  Why not do the same thing in components.

```html
// mylist.razor
<td class="px-1 py-2">xxxx</td>
.... 10 times
```
may appear more complicated that:
```html
// UiListRow.razor
<td class="px-1 py-2">@childContent</td>
```
and: 
```html
// mylist.razor
<UiListRow>xxxx</UiListRow>
.... 10 times
```

but changing the padding across the application is simple in the component approach and a pain in markup.

```html
// UiListRow.razor
<td class="px-1 py-1">@childContent</td>
```


## Blazor.Database.WASM Project

![Project Files](https://raw.githubusercontent.com/ShaunCurtis/CEC.Blazor.SPA/master/Images/CEC-Weather-WASM-Client-Project-View.png)

The project is almost empty.  The controls and services are all in the libraries.  It contains only the code needed to build the WASM executable.

### Program.cs

`CEC.Blazor` and local application services are loaded.  Note the Blazor root component is defined here.  You don't have to use `App` - we're using `WASMApp`.

```csharp
public static async Task Main(string[] args)
{
    var builder = WebAssemblyHostBuilder.CreateDefault(args);
    builder.RootComponents.Add<WASMApp>("#app");

    builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
    builder.Services.AddApplicationServices();

    await builder.Build().RunAsync();
}
```
Services for each project/library are specified in `IServiceCollection` Extensions.

#### ServiceCollectionExtensions.cs

The site specific services loaded are the controller service `WeatherForecastControllerService` and the data service as an `IFactoryDataService` interface loading  `FactoryWASMDataService`.

```csharp
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IFactoryDataService, FactoryWASMDataService>();
        services.AddScoped<WeatherForecastControllerService>();
        return services;
    }
}
```

#### Blazor.Database.WASM.csproj

The final setup on the WASM project is to set the `StaticWebAssetBasePath` in the project file.  This will let us run the WASM and Server version together on the *Web* project.

```xml
  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>
    <StaticWebAssetBasePath>WASM</StaticWebAssetBasePath>
  </PropertyGroup>
```

```
### wasm.html

`wasm.html` is an almost out-of-the-box  `index.html` with:

1. Added stylesheet references.  Note that you use the virtual directory `_content/Assembly_Name` to access content exposed in the `wwwroot` folders of dependency assembles and the reference to the component styling - `CEC.Weather.WASM.Server.styles.css`.  Scripts are accessed in the same way.
2. The base content of `app` is an HTML block that displays a spinner while the application is initializing. 

![App Start Screen](https://github.com/ShaunCurtis/CEC.Blazor.SPA/blob/master/Images/WASM-Start-Screen.png?raw=true)

```html
<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>CEC.Blazor.WASM</title>
    <base href="/" />
    <link href="https://fonts.googleapis.com/css?family=Nunito:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i" rel="stylesheet">
    <link rel="stylesheet" href="CEC.Weather.WASM.Server.styles.css" />
    <link rel="stylesheet" href="_content/CEC.Blazor.SPA/site.min.css" />
    <link rel="stylesheet" href="_content/CEC.Weather/css/site.min.css" />
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
    <script src="_framework/blazor.webassembly.js"></script>
    <script src="_content/CEC.Blazor.SPA/site.js"></script>
</body>

</html>
```
### CSS

All CSS is shared, so lives in `CEC.Weather`.  I use Bootstrap, customized a little with SASS.  I have the WEB COMPILER extension installed in Visual Studio to compile SASS files on the fly.

## Blazor.Database.Web Project

![Project Files](https://github.com/ShaunCurtis/CEC.Blazor.SPA/blob/master/Images/CEC-Weather-Server-Project-View.png?raw=true)

### CSS

The project uses a SCSS to build a custom version of Bootstrap, with some colour and small formatting differences.  I'll not cover the setup here - search *shaun curtis blazor css frameworks* to find an article I've written on the subject.

#### Pages

We have two real pages - the standard issue `_Host.cshtml` for starting the Blazor Server SPA and `_WASM.cshtml` to start the WASM SPA.

#### _Host.cshtml

Standard Blazor Server startup page.  Note:
1. The stylesheet references to the custom CSS and the component CSS.
2. The *blazor.server.js* file script reference.
3. The `component` reference to the root component - in this case `Blazor.Database.Server.Components.ServerApp`.  The root coponent is in the *Blazor.Database.Server* library. 
  
```html
@page "/"
@namespace Blazor.Database.Web.Pages
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
@{
    Layout = null;
}

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blazor.Database.Web</title>
    <base href="~/" />
    <link rel="stylesheet" href="css/site.min.css" />
    <link href="Blazor.Database.Web.styles.css" rel="stylesheet" />
</head>
<body>
    <component type="typeof(Blazor.Database.Server.Components.ServerApp)" render-mode="ServerPrerendered" />

    <div id="blazor-error-ui">
        <environment include="Staging,Production">
            An error has occurred. This application may no longer respond until reloaded.
        </environment>
        <environment include="Development">
            An unhandled exception has occurred. See browser dev tools for details.
        </environment>
        <a href="" class="reload">Reload</a>
        <a class="dismiss">🗙</a>
    </div>

    <script src="_content/Blazor.Database/site.js"></script>
    <script src="_framework/blazor.server.js"></script>
</body>
</html>
``` 
#### _WASM.cshtml

This is just a server version of  WASM *index.html**.

1. The same CSS references and the server file.
2. The same *site.js*.
3. The `<base href>` set to the WASM subdirectory.
4. *blazor.webassembly.js* referenced to the subdirectory.

```csharp
@page "/WASM"
@namespace Blazor.Database.Web.Pages
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
@{
    Layout = null;
}

<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Blazor.DataBase.WASM</title>
    <base href="/WASM/" />
    <link rel="stylesheet" href="/css/site.min.css" />
    <link href="/Blazor.Database.Web.styles.css" rel="stylesheet" />
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
    <script src="_content/Blazor.Database/site.js"></script>
    <script src="/WASM/_framework/blazor.webassembly.js"></script>
</body>

</html>
```

#### Startup.cs

The local services and `CEC.Blazor.SPA` library services are added.  It:

1. Adds the Blazor Server side Services
2. Configures two Middleware pathways, dependant on the Url.

I'll not go into detail here - you can read more about multi SPA hosting in a separate article - search *shaun curtis blazor hydra*.

```csharp
public class Startup
{
    public Startup(IConfiguration configuration)
    {
        Configuration = configuration;
    }

    public IConfiguration Configuration { get; }

    public void ConfigureServices(IServiceCollection services){
        services.AddRazorPages();
        services.AddServerSideBlazor();
        services.AddControllersWithViews();

        // services.AddApplicationServices(this.Configuration);
        services.AddInMemoryApplicationServices(this.Configuration);
            
        // Server Side Blazor doesn't register HttpClient by default
        // Thanks to Robin Sue - Suchiman https://github.com/Suchiman/BlazorDualMode
        if (!services.Any(x => x.ServiceType == typeof(HttpClient)))
        {
            // Setup HttpClient for server side in a client side compatible fashion
            services.AddScoped<HttpClient>(s =>
            {
                // Creating the URI helper needs to wait until the JS Runtime is initialized, so defer it.
                var uriHelper = s.GetRequiredService<NavigationManager>();
                return new HttpClient
                {
                    BaseAddress = new Uri(uriHelper.BaseUri)
                };
            });
        }
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }
        else
        {
            app.UseExceptionHandler("/Error");
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseStaticFiles();

        app.MapWhen(ctx => ctx.Request.Path.StartsWithSegments("/WASM"), app1 =>
        {
            app1.UseBlazorFrameworkFiles("/WASM");
            app1.UseRouting();
            app1.UseEndpoints(endpoints =>
            {
                endpoints.MapFallbackToPage("/red/{*path:nonfile}", "/_WASM");
            });
        });

        app.UseRouting();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
            endpoints.MapBlazorHub();
            endpoints.MapRazorPages();
            endpoints.MapFallbackToPage("/Server/{*path:nonfile}","/_Host");
            endpoints.MapFallbackToPage("/_Host");
        });
    }
}
```

#### ServiceCollectionExtensions.cs

There are two service collection extension methods.  One for a normal SQL database and a second for the testing In-Memory database. 

```csharp
public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
{

    // Local DB Setup
    var dbContext = configuration.GetValue<string>("Configuration:DBContext");
    services.AddDbContextFactory<LocalWeatherDbContext>(options => options.UseSqlServer(dbContext), ServiceLifetime.Singleton);
    services.AddSingleton<IFactoryDataService, LocalDatabaseDataService>();

    services.AddScoped<WeatherForecastControllerService>();

    return services;
}

public static IServiceCollection AddInMemoryApplicationServices(this IServiceCollection services, IConfiguration configuration)
{

    // In Memory DB Setup
    var memdbContext = "Data Source=:memory:";
    services.AddDbContextFactory<InMemoryWeatherDbContext>(options => options.UseSqlite(memdbContext), ServiceLifetime.Singleton);
    services.AddSingleton<IFactoryDataService, TestDatabaseDataService>();

    services.AddScoped<WeatherForecastControllerService>();

    return services;
}
```

## Wrap Up
That wraps up this section.  It's a bit of an overview, with a lot more detail to come later.  Hopefully it demonstrates the level of abstraction you can achieve with Blazor projects.  The next section looks at Services and implementing the data layers.

Some key points to note:
1. You can build your code with common code for Server and WASM projects.  With care you can write an application that can be deployed either way as is the case with this project.
2. Both WASM and Server can be run from the same web site, and you can switch between the two.
3. Be very careful about the terminology.  Understand the different meanings of "Page".

## History

* 15-Sep-2020: Initial version
* 17-Nov-2020: Major Blazor.CEC library changes.  Change to ViewManager from Router and new Component base implementation.
* 26-Mar-2021: Major updates to Services, project structure and data editing

