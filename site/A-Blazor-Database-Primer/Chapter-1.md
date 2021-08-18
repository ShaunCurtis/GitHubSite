---
title: A Blazor Database Primer - Chapter 1 - Project Design and Structure
oneliner: Structuring your Application
precis: This article chapter looks at how to structure your application and what design methodologies to apply.
date: 2021-08-13
published: 2021-08-13
---

# Chapter 1 - Project Design and Structure

You've built the out-of-the-box template, done some exploratory coding.  You're now ready to work on your first application.

Where do you start?  It's a little daunting.  You expect to make mistakes, take the odd wrong road, need some help....

This primer is intended to provide guidance on how to get up and running.  It's aimed primarily at the small to medium sized project with one or two developers working on it.  It takes a very practical approach: we starti with the standard Blazor Server template and turn it into a properly structured and testable solution.

# Methodology

There are many programming methodologies that you could apply.  I'm going to use my own fairly simple three domain model.

![Methodologies](/siteimages/articles/DB-Primer/methodology.png)

What are we trying to achieve?

When you build your own application you can build it in whatever way you wish.  You know it intimately, so where to go when you have bugs and problem.  But what is someone else is going to maintain it?  What happens when you come back to it a year later?  How do you test new functionality and updates?  How do you change to a different data source?  How do you put a new frontend on the application? 

The answer is to apply some basic principles.

1.  **Separation of Concerns**.  Code classes should only be responsible for a definable *unit of work*.  UI code should not include database access functionality.
2.  **Inversion of Control**.  Higher level classes should not depend on lower level classes.  A business logic class should not contain a specific declaration of a database access class.
3.  **Project Dependancy Enforcement**.  In my framework Separate Projects for the UI, Core and Data domains, with project level defined project to project dependancies.  You can't code a business logic class with a dependancy on a Data Domain class.

The heart of the application is the *Core Domain*: Core = Application and Business logic code.  Notice that it only depends on Blazor and third party libraries: there's no dependancies on the other application domains.  The *Data Domain* provides the interface into the data storage.  The *UI Domain* contains all the UI code.

Core to Data Domain communications is through interfaces.  In our application Core domain business logic classes make data requests through the `IDataConnector` interface.  This talks to the Data Domain through an `IDataBroker` interface defined by the Data Domain.

This all plugs together using the Blazor Services container.  

Let's look at what our application services definition will look like:

```csharp
    // Data Domain Code
    services.AddSingleton<WeatherDataStore>();
    services.AddSingleton<IDataBroker, ServerDataBroker>();
    // Core Domain code
    services.AddScoped<IDataConnector, DataConnector>();
    services.AddScoped<WeatherForecastViewService>();
```

Our business logic class is `WeatherForecastViewService`.  The `WeatherForecastViewService` constructor defines an `IDataConnector` argument. When `WeatherForecastViewService` is instanciated by the Services Container, it injects the instance of `IDataConnector` defined for the Service Container, in our case `DataConnector`.    The `DataConnector` constructor defines an `IDataBroker` argument, and `ServerDataBroker` a `WeatherDataStore` arguement, ....

The benefits in this design become apparent when we need to change out the Data Store.  We'll see this when we implement a WASM version of the site, and when we add support for a SQL database data store.

```csharp
    // Data Domain Code
    services.AddSingleton<WeatherDataStore>();
    services.AddSingleton<IDataBroker, APIDataBroker>();
    // No Core Domain code - all in the Server Controller
```

# The Initial Solution

Create a new solution using the standard Blazor Server project with no authenication - BlazorDB.

you should now have a solution with one "Web" project.

Create the following projects in the solution:
1. *BlazorDB.Core* using the *Class Library* template.
2. *BlazorDB.Data* using the *Class Library* template.
3. *BlazorDB.UI* using the *Razor Class Library* template.
4. *BlazorDB.Test* using the *xUnit Test Project* template.
5. *BlazorDB.Web* using the *Blazor Server App* template.

1. Clear the contents from projects 1-4.  
2. Leave *BlazorDB.Web* as is.  
4. Set *BlazorDB.Web* as the startup project.

You should now have a solution that looks like:

![Solution](/siteimages/articles/DB-Primer/article-1-solution.png)


Add dependancies to the Data and UI projects back to Core. Add dependancies to the Test project to all three projects.

![Project Dependancies](/siteimages/articles/DB-Primer/project-dependancies.png)
