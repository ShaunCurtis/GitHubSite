---
title: A Blazor Database Primer - Chapter 1 - Project Design and Structure
oneliner: Structuring your Application
precis: This article chapter looks at how to structure your application and what design methodologies to apply.
date: 2021-08-13
published: 2021-08-13
---

# Chapter 1 - Project Design and Structure

You've built the out-of-the-box template, played around a little, added a bit of code.  You're now ready to start on your first application.

Where do you start?  It's a little daunting.  How can you minimize making mistakes, taking the wrong road, ....

This primer is intended to provide guidance on how to get up and running.  It's aimed primarily at the small to medium sized project with one or two developers working on it.  It takes a very practical approach: start with the standard Blazor Server template and turn it into a properly structured and testable solution.

# Methodology

There are many methodologies you could apply in designing and implementing an application.  Mine is a fairly simple three domain model.

![Methodologies](/siteimages/articles/DB-Primer/Methodology.png)

So what are we trying to achieve?

It's your application, you can build it howver you wish.  You know it intimately, so when things go wrong you know where to look.  But:
1. What is someone else is going to maintain it?  
2. What happens when you come back to it a year later?  
3. How do you test new functionality and updates?  
4. How do you change to a different data source?  
5. How do you put a new frontend on the application? 

To answer these question you need to apply structure and principles to you code base.

1.  **Separation of Concerns**.  Classes should represent a *unit of work*.  UI code should not include database access or business logic functionality.
2.  **Inversion of Control**.  Higher level classes should not depend on lower level classes.  A business logic class should not contain specific declarations for database access classes.
3.  **Project Dependancy Enforcement**.  Use code projects with strict dependancies to provide separation of concerns.  In my framework there are separate projects for the UI, Core and Data domains, with project level defined project to project dependancies.  I can't code a business logic class with a dependancy on a Data Domain class.

The real application is the **Core Domain**: Core = Application and Business logic code.  It represents what makes your application unique.  You should be able to change out the data source and the UI without impacting on the core domain code.  Core domain code only depends on Blazor and third party libraries: there's no dependancies on the other application domains.  The *Data Domain* provides the interface into the data storage.  The *UI Domain* contains all the UI code.

Core to Data Domain communications are implemented through interfaces.  Our core domain classes make data requests through an `IDataConnector` interface.  This all plugs together using the Blazor Services container.  

Let's look at what our application services definition will look like:

```csharp
    // Data Domain Code
    services.AddSingleton<WeatherDataStore>();
    services.AddSingleton<IDataBroker, ServerDataBroker>();
    // Core Domain code
    services.AddScoped<IDataConnector, DataConnector>();
    services.AddScoped<WeatherForecastViewService>();
```

Our business logic class `WeatherForecastViewService` defines a constructor with an `IDataConnector` argument. When the Services Container instanciates `WeatherForecastViewService` it injects its  instance of `IDataConnector`.  In the code above `DataConnector`.    `DataConnector` defines a constructor with an `IDataBroker` argument, and `ServerDataBroker` a `WeatherDataStore` argument, ....

The benefits in this design become apparent when we need to change out the Data Store.  We'll see this when we implement a WASM version of the site, and when we add support for a SQL database data store.

```csharp
    // Data Domain Code
    services.AddScoped<IDataBroker, APIDataBroker>();
    // Core Domain code
    services.AddScoped<IDataConnector, DataConnector>();
    services.AddScoped<WeatherForecastViewService>();
```

# The Initial Solution

Create a new solution using the standard Blazor Server project with no authenication - BlazorDB.  

Why Server? I want a WebAssembly application.

It is faster, easier and more efficient developing using Server Mode.  Design your application correctly, and it wil run in either mode.  In Chapter 5 you will learn how to modify the solution to dual mode operation, running both the Server and WASM SPAs from the same web site.

You should now have a solution with one "Web" project.

Create the following projects in the solution:
1. *BlazorDB.Core* using the *Class Library* template.
2. *BlazorDB.Data* using the *Class Library* template.
3. *BlazorDB.UI* using the *Razor Class Library* template.
4. *BlazorDB.Test* using the *xUnit Test Project* template.
5. *BlazorDB.Web* using the *Blazor Server App* template.

6. Clear the contents from projects 1-4.  
7. Leave *BlazorDB.Web* as is.  
8. Set *BlazorDB.Web* as the startup project.

You should now have a solution that looks like:

![Solution](/siteimages/Articles/DB-Primer/Article-1-solution.png)


Add dependancies to the Data and UI projects back to Core. Add dependancies to the Test project to all three projects.

![Project Dependancies](/siteimages/Articles/DB-Primer/Project-Dependancies.png)
