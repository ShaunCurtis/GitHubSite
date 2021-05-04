---
title: Common Early Blazor Mistakes
precis: Common mistakes that programmers new to Balzor Make
date: 2021-03-31
---

# Blazor Notification Service Pattern

This article is about common mistakes programmers new to Blazor make.  I have travelled this road myself, and answered many questions on various sites recently.

## It's just a different way of creating web pages

Blazor is a Single Page Application aka SPA.  The only true web page in a Blazor SPA is the launch page.  From that point, Blazor treats the browser window as an application.  Some or all of the view area is changed out or updated.  The page through is never reloaded.  Reloading the page or F5 reloads the application, like retarting a desktop application.

The simplest way to see this is create a Blazor Application from the standard template.  Start the application and go to the counter page.  Click the button and the counter advances.  Hit R5 and the counter resets.

The page consists of a set of UI components.  Clicking links, menus, buttons to navigate just loads new components.  The Url may change, but there is no http post or get.  The Blazor client code intercepts the Url navigation from the page and passes the information to the `Router` that works out which component to load.

Routing equals loading a new component into the page.

## You need to be able to write Javascript

There are very few instances where you need to write any Javascript in your early days with Blazor.  Forget JQuery, you won't need it.  Don't load it.  In Blazor, you don't manipulate the DOM in the same way as other frameworks.

