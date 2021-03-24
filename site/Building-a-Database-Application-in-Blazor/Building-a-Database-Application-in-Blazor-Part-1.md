---
title: Part 1 - Project Structure and Framework
date: 2020-10-01
---

# Building a Database Application in Blazor 
# Part 1 - Project Structure and Framework

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
5. The Server and WASM are now hosted and run from the same site.
   
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

The data side of the project is structured fairly conventionally, loosely based on the three tier - data, logical and presentation layer - model.  The exposed data classes all run as Services and are available for dependency injection.   The detail is covered in the second and third articles.

I take a small step away from the basic Pages philosophy.  I think programmers need to think a little differently with SPAs and get out of the webpage paradigm.  Everthing in the Blazor UI is a component.  The concept of a web page is obselete.  The only web page is the launch page on the server.  Once the SPA launches, the application changes out components to transition between Views.  You build a SPA without a router by replacing the `Router` with a view manager.

I use the following terminology:
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
. Forms are logical collections of controls that are either displayed in a view or a modal dialog.  Lists, view forms, edit forms are all classic forms. Forms contain controls not HTML.

### Controls



## CEC.Blazor.WASM.Client Project

![Project Files](https://raw.githubusercontent.com/ShaunCurtis/CEC.Blazor.SPA/master/Images/CEC-Weather-WASM-Client-Project-View.png)

The project is almost empty.  The controls and services are all in the libraries.  It contains only the code needed to build the WASM executable.

### Program.cs

`CEC.Blazor` and local application services are loaded.  Note the Blazor root component is defined here.  You don't have to use `App`.

```csharp
public static async Task Main(string[] args)
{
    var builder = WebAssemblyHostBuilder.CreateDefault(args);
    // Full class name used here to make it a little more obvious.  Not required if the assemble is referenced.
    builder.RootComponents.Add<CEC.Weather.Components.App>("app");

    // Added here as we don't have access to builder in AddApplicationServices
    builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
    // the Services for the CEC.Blazor Library
    builder.Services.AddCECBlazorSPA();
    // the local application Services defined in ServiceCollectionExtensions.cs
    builder.Services.AddApplicationServices();

    await builder.Build().RunAsync();
}
```
Services for each project/library are specified in `IServiceCollection` Extensions.

#### ServiceCollectionExtensions.cs

The site specific services loaded are the controller service `WeatherForecastControllerService` and the data service as an `IWeatherForecastDataService` interface loading  `WeatherForecastWASMDataService`.  The final transient service is the Fluent Validator for the Edit form.

```csharp
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // Scoped service for the WASM Client version of WASM Factory Data Service 
        services.AddScoped<IFactoryDataService<WeatherForecastDbContext>, FactoryWASMDataService<WeatherForecastDbContext>>();
        // Scoped service for the WeatherForecast Controller Services
        services.AddScoped<WeatherForecastControllerService>();
        services.AddScoped<WeatherStationControllerService>();
        services.AddScoped<WeatherReportControllerService>();
        return services;
    }
}
```

## CEC.Blazor.WASM.Server Project

The *CEC.Blazor.WASM.Server* project only exists for debugging the WASM project.  All files are copies of the originals from *CEC.Blazor.Server*.

![Project Files](https://raw.githubusercontent.com/ShaunCurtis/CEC.Blazor.SPA/master/Images/CEC-Weather-WASM-Server-Project-View.png?raw=true)

The only files in the server project, other than error handling for anyone trying to navigate to the site, are the WeatherForecast Controller and the startup/program files.

#### ServiceCollectionExtensions.cs

The site specific service is a singleton `IWeatherForecastDataService` interface loading either `WeatherForecastServerDataService` or `WeatherForecastDummyDataService`. `WeatherForecastDummyDataService` is for demo purposes and doesn't need a backend SQL database. It does what it says, creates an in-application dataset.  

```csharp
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // You have a choice of data sources.
        // services.AddSingleton<IFactoryDataService<WeatherForecastDbContext>, FactoryServerDataService<WeatherForecastDbContext>>();
        services.AddSingleton<IFactoryDataService<WeatherForecastDbContext>, WeatherDummyDataService>();

        // Factory for building the DBContext 
        var dbContext = configuration.GetValue<string>("Configuration:DBContext");
        services.AddDbContextFactory<WeatherForecastDbContext>(options => options.UseSqlServer(dbContext), ServiceLifetime.Singleton);
        return services;
    }
}
```

#### Startup.cs

Note that the default endpoint is set to *wwwroot/wasm.html*.

```csharp
public void ConfigureServices(IServiceCollection services)
{

    services.AddControllersWithViews();
    services.AddRazorPages();
    services.AddApplicationServices(Configuration);
}

// This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    if (env.IsDevelopment())
    {
        app.UseDeveloperExceptionPage();
        app.UseWebAssemblyDebugging();
    }
    else
    {
        app.UseExceptionHandler("/Error");
        app.UseHsts();
    }

    app.UseHttpsRedirection();
    app.UseBlazorFrameworkFiles();
    app.UseStaticFiles();

    app.UseRouting();

    app.UseEndpoints(endpoints =>
    {
        endpoints.MapRazorPages();
        endpoints.MapControllers();
        // default endpoint set to the file: wwwroot/wasm.html
        endpoints.MapFallbackToFile("wasm.html");
    });
}
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

## CEC.Blazor.Server Project

![Project Files](https://github.com/ShaunCurtis/CEC.Blazor.SPA/blob/master/Images/CEC-Weather-Server-Project-View.png?raw=true)

#### Pages

We have one real page - the standard issue `_Host.cshtml`.  As we're running on the server this is an Aspnetcore server-side page.
1. Added stylesheet references.  Note that you use the virtual directory `_content/Assembly_Name` to access content exposed in the `wwwroot` folders of dependency assembles and the reference to the component styling - `CEC.Weather.WASM.Server.styles.css`..  Scripts are accessed in the same way.
2. The base content of `app` uses a TagHelper to load the root component - in this case `CEC.Weather.Components.App`.  Again, you're not tied to App, just specify a different component class. 

```csharp
@page "/"
@namespace CEC.Blazor.Server.Pages
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
@{
    Layout = null;
}

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CEC.Blazor.Server</title>
    <base href="~/" />
    <link href="https://fonts.googleapis.com/css?family=Nunito:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i" rel="stylesheet">
    <link rel="stylesheet" href="CEC.Weather.Server.styles.css" />
    <link rel="stylesheet" href="_content/CEC.Blazor.SPA/site.min.css" />
    <link rel="stylesheet" href="_content/CEC.Weather/css/site.min.css" />
</head>
<body>
    <app>
        <component type="typeof(CEC.Weather.Components.App)" render-mode="Server" />
    </app>

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
    <script src="_framework/blazor.server.js"></script>
    <script src="_content/CEC.Blazor.SPA/site.js"></script>
</body>
</html>
```
### wasm.html

`wasm.html` is a copy of `wasm.html` from the *CEC.Weather.WASM.Server*.  It's the entry point for the WASM version of the application.

#### Startup.cs

The local services and `CEC.Blazor.SPA` library services are added.

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllersWithViews();
    services.AddRazorPages();
    services.AddServerSideBlazor();
    services.AddCECBlazorSPA();
    services.AddApplicationServices();
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
    app.UseBlazorFrameworkFiles();
    app.UseStaticFiles();

    app.UseRouting();

    app.UseEndpoints(endpoints =>
    {
        endpoints.MapBlazorHub();
        endpoints.MapRazorPages();
        endpoints.MapControllers();
        endpoints.MapFallbackToPage("/_Host");
    });
}
```

#### ServiceCollectionExtensions.cs

The site specific services are a singleton `IWeatherForecastDataService` interface loading either `WeatherForecastServerDataService` or `WeatherForecastDummyDataService`, a scoped `WeatherForecastControllerService` and a transient Fluent Validator service for the Editor.

```csharp
public static IServiceCollection AddApplicationServices(this IServiceCollection services)
{
    services.AddSingleton<IFactoryDataService<WeatherForecastDbContext>, WeatherDummyDataService>();
    // services.AddSingleton<IFactoryDataService<WeatherForecastDbContext>, FactoryServerDataService<WeatherForecastDbContext>>();
    services.AddScoped<WeatherForecastControllerService>();
    services.AddScoped<WeatherStationControllerService>();
    services.AddScoped<WeatherReportControllerService>();
    // Factory for building the DBContext 
    var dbContext = configuration.GetValue<string>("Configuration:DBContext");
    services.AddDbContextFactory<WeatherForecastDbContext>(options => options.UseSqlServer(dbContext), ServiceLifetime.Singleton);
    return services;
}
```

## Wrap Up
That wraps up this section.  It's a bit of an overview, with a lot more detail to come later.  Hopefully it demonstrates the level of abstraction you can achieve with Blazor projects.  The next section looks at Services and implementing the data layers.

Some key points to note:
1. You can build your code so that almost all is common to both Server and WASM projects.  With care you can write an application that can be deployed either way as is the case with this project.
2. Be very careful about the terminology.  We don't have "Pages" in the application.

## History

* 15-Sep-2020: Initial version
* 17-Nov-2020: Major Blazor.CEC library changes.  Change to ViewManager from Router and new Component base implementation.
* 7-Feb-2021: Major updates to Services, project structure and data editing

