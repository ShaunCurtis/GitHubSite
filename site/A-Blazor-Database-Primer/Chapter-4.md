---
title: Chapter 4 - Setting up the Solution to Run
oneliner: Setting up the Solution to Run
precis: Setting up the Solution to Run
date: 2021-08-13
published: 2021-08-13
---

At this point we're ready to re-build the projects and run the solution.

## Clean up the Project Files

The project files for several of the projects will contain redundant information/

Clean up the project files for the following projects:

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

Remove everything except *_Imports.razor* and *Program.cs*.

Clean up the project file and change the project sdk type to `Microsoft.NET.Sdk.Razor`.  You will probably need to reload the project as this point.

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
    <ProjectReference Include="..\BlazorDB.Data\BlazorDB.Data.csproj" />
  </ItemGroup>

</Project>
```

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

At this point you should be able to build and run the solution.
