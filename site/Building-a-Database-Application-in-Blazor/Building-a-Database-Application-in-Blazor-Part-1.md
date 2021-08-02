---
title: Part 1 - A Blazor Database Template - Project Structure and Framework
oneliner: This article describes the Structire and Framework for Blazor Database Template.
precis: This article is the first in a series describing a Blazor Database Template using the Weather Forecast theme of the base Blazor Template.
date: 2021-07-04
published: 2020-10-01
---

# Building a Database Application in Blazor 
# Part 1 - Project Structure and Framework

This set of articles describes a framework for building and structuring Database Applications in Blazor.

It's just a framework.  I make no recommendations: use it or abuse it.  It's what I use.  It's lightly opinionated: using out-of-the-box Blazor/Razor/DotNetCore systems and toolkits whereever possible.  The CSS framework is a lightly customized version of BootStrap. 
 
There are 5 articles describing various aspects of the framework and coding patterns used:

1. Project Structure and Framework - a bit of an introduction.
2. Services - Building CRUD Data Layers.
3. View Components - CRUD Edit and View Operations in the UI.
4. UI Components - Building HTML/CSS Controls.
5. View Components - CRUD List Operations in the UI.

The articles have changed drastically since their original release:

1. The whole framework is less opinionated.  I've dropped many of the more radical approaches to some issues in Blazor/SPAs.
2. The libraries have been re-organised as my understanding has grown on how to make Server and WASM projects co-exist.
2. Everything has been updated to Net5.
3. The Repo home has moved.
5. Server and WASM SPAs are now hosted and run from the same site.
   
These articles are not:
1. An attempt to define best practice.
2. The finished product.

This first article proves an overview of the framework and solution architecture, and my reasons for making certain design decisions.

## Repository and Database

The repository for the articles has moved to [Blazor.Database Repository](https://github.com/ShaunCurtis/Blazor.Database).  All previous repos are obselete and will be removed shortly.

There's a SQL script in /SQL in the repository for building the database.

The demo site has changed now the Server and WASM have been combined.  The site starts in Server mode - [https://cec-blazor-database.azurewebsites.net/](https://cec-blazor-server.azurewebsites.net/).

## Design Philosophy

The high level application design looks like this:

![Basic Application Design](/siteimages/articles/database/basic-app-design.png)

This may look too complex for a simple application, we can just grab the data from the datasource in the display page.  Up to you, but you (or someone else who has to maintain the code) will almost certainly regret that decision at some point.

*UI* and *Data Interface* are pretty self explanatory, but what exactly is the *Core Application*.  It's all the code that makes your application unique.  It's the business logic that processes the raw data from the data store and the logic that takes user input are stores sensible data from it.  The point to make is you should de-couple all this code from the data source and the UI.  Get it right and you can change the data store or the front end with little or no impact on the core application.

## Solution Structure

The application is configured to build and deploy both Server and WASM versions of the SPA, and host both on the same web site.  The base solution architecture is:

1. Core Razor Library - contains the code that can be deployed to any application.  These could be built and deployed as a Nuget Package.
2. Web Assembly Razor Library - contains the application specific code for the SPA along with the Web Assembly specific code.
3. ASPNetCore Razor Web Project.  The host project that contains the startup pages for the WASM and Server SPAs, the services for the Blazor Server Hub and the server-side API Controllers for the WASM SPA.

I use Visual Studio, so the Github repository consists of a solution with five projects.  These are:

1. Blazor.SPA - the core library containing everything that can be boilerplated and reused across any project.
2. Blazor.Database - this is the WASM/Server library shared by the other projests.  Almost all the project code lives here.  Examples are the EF DB Context, Model classes, model specific CRUD components, Bootstrap SCSS, Views, Forms, ...
3. Blazor.Database.Web - The host ASPNetCore server.

You may have noticed at this point that there's no Server project.  You don't need one.

### The Data Box

The data box is designed to:

1. Standardise the interfaces between the application data box and the underlying data storage, 
2. Standardise the interfaces between the application data box and the application core application.
3. Make the data box components testable.
4. Use naming conventions to provide abstraction.  Model classes have the same names as EF `DbSets`.

![Data Pipeline](/siteimages/articles/database/data-pipeline.png)

#### Data Classes

Data is divided into three object types:

1. **Model Records** - these are immutable records and represent a single table or view in the database.  Brokers and Connectors work with Model Records.  All model classes implement an `IDbRecord` interface. 

2. **Compound Records** - these are immutable records based on a Model Record, but contain processed data and/or data from other model records associated with the main model record.

3. **Edit Model Classes** - these are editable versions of model records.  They contain logic to track, validate and build saveable model records.  All edit classes implement `IEditRecord`, and optionally `IValidation` interfaces

The data storage for the application is a SQL database accessed through Entity Framework.  The connection string defined in `AppSettings`.  The database is accessed through a `DbContext` class `LocalWeatherDbContext`.  The `DbContext` services are created through a DBContextFactory implemented through the `AddDBContextFactory` service extension.  The application accesses the database using the `IDbContextFactory<TDbContext>` interface.

#### Brokers

*Brokers* provide the application interface into the data box .  The *DataBroker* is responsible for standard CRUDL - Create/Read/Update/Delete/List - actions against database entities.

`IDataBroker` defines the common interface, implementing CRUDL in Database language terminology.  Method names reflect the terminology used in the underlying data storage - Select, Update, Insert,...

`BaseDataBroker` provides an abstract base implementation of the interface.

`ServerDataBroker` interfaces with the SQL EF database context used by Blazor Server and the API controller.  `APIDataBroker` provides the API based data broker for Blazor WebAssembly.

These brokers implement generics where `TRecord` is the model class that represents the EF `DbSet`.  The methods use `GetDbSet`, a  `DbContext` extension method, to return the `DbSet` object for the model class.

To demonstrate the level of abstraction and boilerplating achieved in the generic library services, the declaration of the Local Database Broker for the application is:

```csharp
public class WeatherSQLDataBroker :
    ServerDataBroker<LocalWeatherDbContext>
{
    public WeatherSQLDataBroker(IConfiguration configuration, IDbContextFactory<LocalWeatherDbContext> dbContext) : base(configuration, dbContext) { }
}
```

#### Connectors

Connectors provide the data interfaces between the core application and brokers.

`IDataServiceConnector` defines the common interface, implmementing CRUDL in more normal programming terminology - get, save, update, ...

`ModelDataServiceConnector` implements the interface using generics to provide a abstract connector to any model/DbSet implementated by EF.

#### ViewServices

View Services provide the connection between the UI and the core application.  They contain all the business and UI logic.  There are three types:

1. ModelViewServices - these expose single base model data to the UI.
2. CompoundModelServics - these expose complex models built from base models.  An example would be a weather station and its associated daily weather station data.
3. EditModelServices - these transform record data into editable model classes and expose and manage the edit process.

In the library `IModelViewService` defines the interface for standard model view services with `BaseModelViewService` defining an abstract implementation.

In the solution `WeatherForecastViewService` looks like this.

```csharp
public class WeatherForecastViewService : 
    BaseModelViewService<WeatherForecast>, 
    IModelViewService<WeatherForecast>
{
    public WeatherForecastViewService(IDataServiceConnector dataServiceConnector) : base(dataServiceConnector) { }
}
```

## UI Structure

The UI is structured to use re-usable components built in Razor/Html markup across an application, with the majority of the code in the base library.

*Page* is is very misused term in SPAs: frameworks could and should have introduced some new terminology.  I only use the *Pages* directory for real web pages, and *Page* to describe a web page served by a web server.  SPAs aren't web sites.  Programmers need step outside the web page paradigm to understand how they work.  The Blazor UI is component based; to think of it containing *Pages* perpetuates the paradigm, and a lot of misconceptions.  The only web page in a SPA is the launch page.  Once the SPA launches, the application changes out components to transition between Views.  I've built an SPA with no router or Urls in sight - just like a desktop application.

I use the following terminology thoughout these articles:
1. Page - the launch web page on the web site.  The only page in an SPA.
2. RouteView/Routed Component.  These are all terms used by various people describing the pseudo page.  I use the term RouteViews.  This is the content displayed in the content section of a Layout, and normally determined by a defined route.  A *Route* deson't load a page, it loads a RouteView which is a component.  We'll look at these in more detail later in this article.
3. Forms.  Forms are logical collections of controls that are either displayed in a view or a modal dialog.  Lists, view forms, edit forms are all classic forms. Forms contain controls not HTML.
4. Controls.  Controls are components that display something: they emit HTML code to the Renderer.  For example, an edit box, a dropdown, button, ... A Form is a collection of controls.

![UI Pipeline](/siteimages/articles/database/ui-pipeline.png)

### Pages

Pages are the web pages that act as the host for the the application.  There's one per application.

### RouteViews

RouteViews are the components loaded into the root `App` component, normally by the Router through a Layout.  They don't have to be.  You can write your own View Manager, and you don't have to use Layouts.  The only two requirements for a View are:

1. It must be declared as a razor component or class implementing `IComponent`.
2. It must declare one or more routes either through the `@page` directive or as a `RouteAttribute`.

The `FetchData` view is declared as shown below.  The Razor makrup is mimimal, just the `WeatherForecastListForm`.  The code handles what happens on various actions in the List Form.  

```csharp
@page "/fetchdata"
<WeatherForecastListForm EditRecord="this.GoToEditor" ViewRecord="this.GoToViewer" NewRecord="this.GoToNew" ExitAction="Exit"></WeatherForecastListForm>
@code {
    [Inject] NavigationManager NavManager { get; set; }
    private bool _isWasm => NavManager?.Uri.Contains("wasm", StringComparison.CurrentCultureIgnoreCase) ?? false;

    public void GoToEditor(int id)
    => this.NavManager.NavigateTo($"weather/edit/{id}");

    public void GoToNew()
    => this.NavManager.NavigateTo($"weather/edit/-1");

    public void GoToViewer(int id)
    => this.NavManager.NavigateTo($"weather/view/{id}");

    public void Exit()
    {
        if (_isWasm)
            this.NavManager.NavigateTo($"/wasm");
        else
            this.NavManager.NavigateTo($"/");
    }
}
``` 

The purpose of the RouteView is to declare routes that the `Router` component can find when the SPA starts.  The root component `App` is shown below which declares the `Router` component.  `AppAssembly="@typeof(WeatherApp).Assembly"` points the router to the assembly it browses to find route declarations.  In this case it's pointed to assembly containing the root component.

```html
<Router AppAssembly="@typeof(WeatherApp).Assembly" PreferExactMatches="@true">
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

Note that the display component is called `RouteView` which it where RouteViews comes from.

### Layouts

Layouts are out-of-the-box Blazor Layouts.  The Router renders the Layout with the `RouteView` as the child content.  There's a default `Layout` defined in the `Router` definition.  I'll skip layouts here, we've had them for a long while and they are adequately covered elsewhere.

### Forms

A form is a mid level unit in the component hierarchy.  RouteViews contain one or more forms.
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

## Blazor.Database Project

The Blazor.Database project contains all the project specific Blazor code plus the startup code and Web Assembly code for the WASM application.

### Program.cs

`Program` is the entry point for the WASM application and contains the service definitions and reference to the root component.

```csharp
public static async Task Main(string[] args)
{
    var builder = WebAssemblyHostBuilder.CreateDefault(args);
    builder.RootComponents.Add<WeatherApp>("#app");

    builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
    builder.Services.AddWASMApplicationServices();

    await builder.Build().RunAsync();
}
```
Services for each project/library are specified in `IServiceCollection` Extensions.

#### ServiceCollectionExtensions.cs

There are methods for site specific services and a `AddCommonServices` method to cover all the services common to WASM and Server modes.

```csharp
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddWASMApplicationServices(this IServiceCollection services)
        {
            services.AddScoped<IDataBroker, APIDataBroker>();
            AddCommonServices(services);

            return services;
        }
        public static IServiceCollection AddServerApplicationServices(this IServiceCollection services, IConfiguration configuration)
        {

            // Local DB Setup
            var dbContext = configuration.GetValue<string>("Configuration:DBContext");
            services.AddDbContextFactory<MSSQLWeatherDbContext>(options => options.UseSqlServer(dbContext), ServiceLifetime.Singleton);
            services.AddSingleton<IDataBroker, WeatherSQLDataBroker>();
            AddCommonServices(services);

            return services;
        }

        private static void AddCommonServices(this IServiceCollection services)
        {
            services.AddSingleton<RouteViewService>();
            services.AddScoped<ILogger, Logger<LoggingBroker>>();
            services.AddScoped<ILoggingBroker, LoggingBroker>();
            services.AddScoped<IDateTimeBroker, DateTimeBroker>();
            services.AddScoped<IDataServiceConnector, ModelDataServiceConnector>();
            services.AddScoped<WeatherForecastViewService>();
            services.AddSingleton<RandomNumberService>();
            services.AddScoped<DummyWeatherService>();
        }
    }
```

The final setup on the WASM project is to set the `StaticWebAssetBasePath` in the project file.  This will let us run the WASM and Server version together on the *Web* project.

```xml
  <PropertyGroup>
    <TargetFramework>net5.0</TargetFramework>
    <StaticWebAssetBasePath>WASM</StaticWebAssetBasePath>
  </PropertyGroup>
```

### CSS

All CSS is shared, so lives in `Blazor.Database.Web`.  I use Bootstrap, customized a little with SASS.  The *WEB COMPILER* extension is installed in Visual Studio to compile SASS files on the fly.

## Blazor.Database.Web Project

### CSS

The project uses a SCSS to build a custom version of Bootstrap, with some colour and small formatting differences.  I'll not cover the setup here - search *shaun curtis blazor css frameworks* to find an article I've written on the subject.

#### Pages

We have two real pages - the standard issue `_Host.cshtml` for starting the Blazor Server SPA and `_WASM.cshtml` to start the WASM SPA.

#### _Host.cshtml

Standard Blazor Server startup page.  Note:
1. The stylesheet references to the custom CSS and the component CSS.
2. The *blazor.server.js* file script reference.
3. The `component` reference to the root component - in this case `Blazor.Database.Server.Components.WeatherApp`.  The root coponent is in the *Blazor.Database* library. 
  
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
    <link href="/wasm/Blazor.Database.styles.css" rel="stylesheet" />
</head>
<body>
    <component type="typeof(Blazor.Database.Components.WeatherApp)" render-mode="ServerPrerendered" />

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

    <script src="_content/Blazor.SPA/site.js"></script>
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
    <base href="/wasm/" />
    <link rel="stylesheet" href="/css/site.min.css" />
    <link href="/Blazor.Database.Web.styles.css" rel="stylesheet" />
    <link href="/wasm/Blazor.Database.styles.css" rel="stylesheet" />
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
    <script src="_content/Blazor.SPA/site.js"></script>
    <script src="/wasm/_framework/blazor.webassembly.js"></script>
</body>
</html>
```

#### Startup.cs

The local services and `Blazor.SPA` library services are added.  It:

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
            endpoints.MapRazorPages();
            endpoints.MapFallbackToPage("/Server/{*path:nonfile}","/_Host");
            endpoints.MapFallbackToPage("/_Host");
        });
    }
}
```

## Wrap Up
That wraps up this section.  It's a bit of an overview, with a lot more detail to come later.  Hopefully it demonstrates the level of abstraction you can achieve with Blazor projects.  The next section looks at Services and implementing the data layers.

Some key points to note:
1. You can build your code with common code for Server and WASM projects.  With care you can write an application that can be deployed either way as is the case with this project.
2. Both WASM and Server can be run from the same web site, and you can switch between the two.
3. Be very careful about the terminology.  Understand the different meanings of "Page".

If you're reading this article well into the future, check the readme in the repository for the latest version of the article set.

## History

* 15-Sep-2020: Initial version
* 17-Nov-2020: Major Blazor.CEC library changes.  Change to ViewManager from Router and new Component base implementation.
* 26-Mar-2021: Major updates to Services, project structure and data editing
* 24-June-2021: revisions to data layers.

